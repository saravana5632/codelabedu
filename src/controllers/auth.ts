import { Request, Response } from "express";
import { db } from "../db/index.js";
import { students, studentAuthMetadata, faculty } from "../db/schema.js";
import { eq, and, sql } from "drizzle-orm";
import jwt from "jsonwebtoken";
import { AuthRequest } from "../middleware/authMiddleware.js";
import {
  isPasswordSetupRequired,
  validatePasswordPolicy,
  hashPassword,
  verifyPassword,
  performDummyPasswordCompare,
  isBcryptHash,
} from "../lib/passwordUtils.js";
import { ensureTimerTables } from "../db/migrate.js";

const JWT_SECRET = process.env.JWT_SECRET || "codelab-secret-key-123";

// ==========================================
// LOGIN RATE LIMITER (In-Memory Per IP + Identifier)
// ==========================================

interface RateLimitEntry {
  count: number;
  firstAttemptAt: number;
  blockedUntil: number | null;
}

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_FAILED_ATTEMPTS = 8;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

const loginAttemptStore = new Map<string, RateLimitEntry>();

function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || "local";
}

function getRateLimitKey(req: Request, identifier: string): string {
  return `${getClientIp(req)}:${identifier.trim().toLowerCase()}`;
}

function checkRateLimit(key: string): {
  allowed: boolean;
  retryAfterSeconds?: number;
} {
  const now = Date.now();
  const entry = loginAttemptStore.get(key);
  if (!entry) return { allowed: true };

  if (entry.blockedUntil && now < entry.blockedUntil) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((entry.blockedUntil - now) / 1000),
    };
  }

  if (now - entry.firstAttemptAt > RATE_LIMIT_WINDOW_MS) {
    loginAttemptStore.delete(key);
    return { allowed: true };
  }

  return { allowed: true };
}

function recordFailedAttempt(key: string): void {
  const now = Date.now();
  const entry = loginAttemptStore.get(key);
  if (!entry || now - entry.firstAttemptAt > RATE_LIMIT_WINDOW_MS) {
    loginAttemptStore.set(key, {
      count: 1,
      firstAttemptAt: now,
      blockedUntil: null,
    });
    return;
  }

  entry.count += 1;
  if (entry.count >= MAX_FAILED_ATTEMPTS) {
    entry.blockedUntil = now + LOCKOUT_DURATION_MS;
  }
  loginAttemptStore.set(key, entry);
}

function clearFailedAttempts(key: string): void {
  loginAttemptStore.delete(key);
}

export function clearAllLoginRateLimits(): void {
  loginAttemptStore.clear();
}

export async function getOrInitStudentTokenVersion(
  studentId: number
): Promise<number> {
  const existing = await db
    .select()
    .from(studentAuthMetadata)
    .where(eq(studentAuthMetadata.studentId, studentId))
    .get();

  if (existing) {
    return existing.tokenVersion;
  }

  await db
    .insert(studentAuthMetadata)
    .values({
      studentId,
      tokenVersion: 1,
    })
    .onConflictDoNothing()
    .execute();

  return 1;
}

export async function incrementStudentTokenVersion(
  studentId: number,
  isInitialization = false
): Promise<number> {
  const nowIso = new Date().toISOString();
  const existing = await db
    .select()
    .from(studentAuthMetadata)
    .where(eq(studentAuthMetadata.studentId, studentId))
    .get();

  if (!existing) {
    await db
      .insert(studentAuthMetadata)
      .values({
        studentId,
        tokenVersion: 2,
        passwordInitializedAt: isInitialization ? nowIso : null,
        passwordUpdatedAt: nowIso,
      })
      .execute();
    return 2;
  }

  const nextVersion = (existing.tokenVersion || 1) + 1;
  await db
    .update(studentAuthMetadata)
    .set({
      tokenVersion: nextVersion,
      ...(isInitialization && !existing.passwordInitializedAt
        ? { passwordInitializedAt: nowIso }
        : {}),
      passwordUpdatedAt: nowIso,
    })
    .where(eq(studentAuthMetadata.studentId, studentId))
    .execute();

  return nextVersion;
}

async function findStudentByRollNumber(rawRollNumber: string) {
  const trimmedRoll = rawRollNumber.trim();
  if (!trimmedRoll) return null;

  let student = await db
    .select()
    .from(students)
    .where(eq(students.rollNumber, trimmedRoll))
    .get();

  if (!student) {
    student = await db
      .select()
      .from(students)
      .where(sql`UPPER(${students.rollNumber}) = ${trimmedRoll.toUpperCase()}`)
      .get();
  }

  return student || null;
}

// ==========================================
// LOGIN (STUDENT & FACULTY)
// ==========================================

export const login = async (req: Request, res: Response) => {
  try {
    await ensureTimerTables();

    const body = req.body || {};
    const rawRollNumber = body.rollNumber ?? body.roll_number;
    const rawEmail = body.email;
    const rawPassword = body.password;
    const rawDob = body.dob;

    // Determine loginType: defaults to "student" if rollNumber is provided or route is /student/login
    const loginType =
      body.loginType ||
      (req.path.includes("/student") || rawRollNumber !== undefined
        ? "student"
        : rawEmail !== undefined
        ? "faculty"
        : "");

    // ==========================================
    // STUDENT LOGIN
    // ==========================================
    if (loginType === "student") {
      // Explicitly reject legacy Date of Birth login attempts
      if (rawDob !== undefined && (rawPassword === undefined || rawPassword === "")) {
        return res.status(400).json({
          success: false,
          message:
            "Date of Birth authentication is no longer supported. Please sign in with your Roll Number and Password.",
        });
      }

      const trimmedRollNumber =
        typeof rawRollNumber === "string" ? rawRollNumber.trim() : "";
      const passwordInput =
        typeof rawPassword === "string" ? rawPassword : "";

      if (!trimmedRollNumber || !passwordInput) {
        return res.status(400).json({
          success: false,
          message: "Roll number and password are required",
        });
      }

      const rateKey = getRateLimitKey(req, `student:${trimmedRollNumber}`);
      const rateStatus = checkRateLimit(rateKey);
      if (!rateStatus.allowed) {
        return res.status(429).json({
          success: false,
          message:
            "Too many failed login attempts. Please wait before trying again.",
          retryAfterSeconds: rateStatus.retryAfterSeconds,
        });
      }

      const student = await findStudentByRollNumber(trimmedRollNumber);

      if (!student) {
        await performDummyPasswordCompare(passwordInput);
        recordFailedAttempt(rateKey);
        return res.status(401).json({
          success: false,
          message: "Invalid roll number or password",
        });
      }

      const isPasswordValid = await verifyPassword(
        passwordInput,
        student.password
      );

      if (!isPasswordValid) {
        recordFailedAttempt(rateKey);
        return res.status(401).json({
          success: false,
          message: "Invalid roll number or password",
        });
      }

      // If the password stored in the database was plaintext (not yet a bcrypt hash), upgrade it to bcrypt in-place
      if (!isBcryptHash(student.password)) {
        const upgradedHash = await hashPassword(passwordInput);
        await db
          .update(students)
          .set({ password: upgradedHash })
          .where(eq(students.id, student.id))
          .execute();
      }

      clearFailedAttempts(rateKey);
      const tokenVersion = await getOrInitStudentTokenVersion(student.id);

      const token = jwt.sign(
        {
          id: student.id,
          rollNumber: student.rollNumber,
          role: "student",
          tokenVersion,
        },
        JWT_SECRET,
        {
          expiresIn: "24h",
        }
      );

      return res.json({
        success: true,
        token,
        user: {
          id: student.id,
          role: "student",
          name: student.name,
          rollNumber: student.rollNumber,
          department: student.department,
          registerNumber: student.registerNumber,
        },
      });
    }

    // ==========================================
    // FACULTY LOGIN
    // ==========================================
    if (loginType === "faculty") {
      const facultyMail =
        typeof rawEmail === "string" ? rawEmail.trim() : "";
      const facultyPassword =
        typeof rawPassword === "string" ? rawPassword : "";

      if (!facultyMail || !facultyPassword) {
        return res.status(400).json({
          success: false,
          message: "Email and password are required",
        });
      }

      const rateKey = getRateLimitKey(req, `faculty:${facultyMail}`);
      const rateStatus = checkRateLimit(rateKey);
      if (!rateStatus.allowed) {
        return res.status(429).json({
          success: false,
          message:
            "Too many failed login attempts. Please wait before trying again.",
          retryAfterSeconds: rateStatus.retryAfterSeconds,
        });
      }

      const fac = await db
        .select()
        .from(faculty)
        .where(eq(faculty.email, facultyMail))
        .get();

      if (!fac || !fac.password) {
        await performDummyPasswordCompare(facultyPassword);
        recordFailedAttempt(rateKey);
        return res.status(401).json({
          success: false,
          message: "Invalid email or password",
        });
      }

      let isFacValid = false;
      if (isBcryptHash(fac.password)) {
        isFacValid = await verifyPassword(facultyPassword, fac.password);
      } else {
        isFacValid = fac.password === facultyPassword;
      }

      if (!isFacValid) {
        recordFailedAttempt(rateKey);
        return res.status(401).json({
          success: false,
          message: "Invalid email or password",
        });
      }

      clearFailedAttempts(rateKey);

      const token = jwt.sign(
        {
          id: fac.id,
          role: "faculty",
        },
        JWT_SECRET,
        {
          expiresIn: "24h",
        }
      );

      return res.json({
        success: true,
        token,
        user: {
          id: fac.id,
          role: "faculty",
          name: fac.name,
          email: fac.email,
        },
      });
    }

    return res.status(400).json({
      success: false,
      message: "Invalid login type",
    });
  } catch (error: any) {
    console.error("[LOGIN] Unexpected error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ==========================================
// FIRST-TIME STUDENT PASSWORD INITIALIZATION
// ==========================================

export const initializeStudentPassword = async (
  req: Request,
  res: Response
) => {
  try {
    await ensureTimerTables();

    const body = req.body || {};
    const rawRollNumber = body.rollNumber ?? body.roll_number;
    const rawRegisterNumber = body.registerNumber ?? body.register_number;
    const newPassword = body.newPassword ?? body.new_password ?? body.password;
    const confirmPassword =
      body.confirmPassword ?? body.confirm_password ?? newPassword;

    const trimmedRollNumber =
      typeof rawRollNumber === "string" ? rawRollNumber.trim() : "";

    if (
      !trimmedRollNumber ||
      rawRegisterNumber === undefined ||
      rawRegisterNumber === null ||
      String(rawRegisterNumber).trim() === ""
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Roll Number and Register Number are required to initialize your password",
      });
    }

    const rateKey = getRateLimitKey(req, `init:${trimmedRollNumber}`);
    const rateStatus = checkRateLimit(rateKey);
    if (!rateStatus.allowed) {
      return res.status(429).json({
        success: false,
        message:
          "Too many failed verification attempts. Please wait before trying again.",
        retryAfterSeconds: rateStatus.retryAfterSeconds,
      });
    }

    const student = await findStudentByRollNumber(trimmedRollNumber);
    if (!student) {
      recordFailedAttempt(rateKey);
      return res.status(401).json({
        success: false,
        message: "Invalid Roll Number or Register Number",
      });
    }

    if (!isPasswordSetupRequired(student.password)) {
      return res.status(403).json({
        success: false,
        message:
          "Password is already initialized for this account. Please sign in with your password or contact faculty for a password reset.",
      });
    }

    const parsedRegNum = Number(String(rawRegisterNumber).trim());
    if (
      isNaN(parsedRegNum) ||
      parsedRegNum !== Number(student.registerNumber)
    ) {
      recordFailedAttempt(rateKey);
      return res.status(401).json({
        success: false,
        message: "Invalid Roll Number or Register Number",
      });
    }

    if (typeof newPassword !== "string" || newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "New password and confirm password do not match",
      });
    }

    const policyCheck = validatePasswordPolicy(newPassword, {
      rollNumber: student.rollNumber,
      name: student.name,
      registerNumber: student.registerNumber,
    });
    if (!policyCheck.valid) {
      return res.status(400).json({
        success: false,
        message: policyCheck.message,
      });
    }

    const hashedPassword = await hashPassword(newPassword);

    await db
      .update(students)
      .set({ password: hashedPassword })
      .where(eq(students.id, student.id))
      .execute();

    clearFailedAttempts(rateKey);
    const tokenVersion = await incrementStudentTokenVersion(student.id, true);

    const token = jwt.sign(
      {
        id: student.id,
        rollNumber: student.rollNumber,
        role: "student",
        tokenVersion,
      },
      JWT_SECRET,
      { expiresIn: "24h" }
    );

    return res.json({
      success: true,
      message: "Password initialized successfully",
      token,
      user: {
        id: student.id,
        role: "student",
        name: student.name,
        rollNumber: student.rollNumber,
        department: student.department,
        registerNumber: student.registerNumber,
      },
    });
  } catch (error: any) {
    console.error("[INIT PASSWORD] Error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ==========================================
// CHANGE PASSWORD (AUTHENTICATED STUDENT)
// ==========================================

export const changeStudentPassword = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    await ensureTimerTables();

    const user = req.user;
    if (!user || user.role !== "student") {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const body = req.body || {};
    const currentPassword = body.currentPassword ?? body.current_password;
    const newPassword = body.newPassword ?? body.new_password;
    const confirmPassword =
      body.confirmPassword ?? body.confirm_password ?? newPassword;

    if (typeof currentPassword !== "string" || !currentPassword) {
      return res.status(400).json({
        success: false,
        message: "Current password is required",
      });
    }

    if (typeof newPassword !== "string" || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "New password is required",
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "New password and confirm password do not match",
      });
    }

    const student = await db
      .select()
      .from(students)
      .where(eq(students.id, user.id))
      .get();

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student account not found",
      });
    }

    const isCurrentValid = await verifyPassword(
      currentPassword,
      student.password
    );
    if (!isCurrentValid) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({
        success: false,
        message: "New password must be different from your current password",
      });
    }

    const policyCheck = validatePasswordPolicy(newPassword, {
      rollNumber: student.rollNumber,
      name: student.name,
      registerNumber: student.registerNumber,
    });
    if (!policyCheck.valid) {
      return res.status(400).json({
        success: false,
        message: policyCheck.message,
      });
    }

    const hashedPassword = await hashPassword(newPassword);

    await db
      .update(students)
      .set({ password: hashedPassword })
      .where(eq(students.id, student.id))
      .execute();

    const nextTokenVersion = await incrementStudentTokenVersion(
      student.id,
      false
    );

    const newToken = jwt.sign(
      {
        id: student.id,
        rollNumber: student.rollNumber,
        role: "student",
        tokenVersion: nextTokenVersion,
      },
      JWT_SECRET,
      { expiresIn: "24h" }
    );

    return res.json({
      success: true,
      message: "Password changed successfully",
      token: newToken,
    });
  } catch (error: any) {
    console.error("[CHANGE PASSWORD] Error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ==========================================
// LOGOUT (INVALIDATES ACTIVE TOKEN VERSION)
// ==========================================

export const logout = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user;
    if (user && user.role === "student") {
      await incrementStudentTokenVersion(user.id, false);
    }
    return res.json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: "Error logging out",
    });
  }
};

// ==========================================
// GET CURRENT USER
// ==========================================

export const getMe = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    if (user.role === "student") {
      const student = await db
        .select()
        .from(students)
        .where(eq(students.id, user.id))
        .get();

      if (!student) {
        return res.status(404).json({
          message: "Student not found",
        });
      }

      return res.json({
        id: student.id,
        role: "student",
        name: student.name,
        rollNumber: student.rollNumber,
        department: student.department,
        registerNumber: student.registerNumber,
      });
    }

    if (user.role === "faculty") {
      const fac = await db
        .select()
        .from(faculty)
        .where(eq(faculty.id, user.id))
        .get();

      if (!fac) {
        return res.status(404).json({
          message: "Faculty not found",
        });
      }

      return res.json({
        id: fac.id,
        role: "faculty",
        name: fac.name,
        email: fac.email,
      });
    }

    return res.status(400).json({
      message: "Invalid user role",
    });
  } catch (error: any) {
    console.error("[GET ME] Error:", error.message);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
};