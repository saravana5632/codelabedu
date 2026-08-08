import { Request, Response } from "express";
import { db } from "../db/index.js";
import { students, faculty } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import jwt from "jsonwebtoken";
import { AuthRequest } from "../middleware/authMiddleware.js";

const JWT_SECRET = process.env.JWT_SECRET || "codelab-secret-key-123";

export const login = async (req: Request, res: Response) => {
  try {
    const {
      loginType,
      rollNumber,
      dob,
      email,
      password,
    } = req.body;

    // ==========================================
    // STUDENT LOGIN
    // ==========================================

    if (loginType === "student") {
      if (!rollNumber || !dob) {
        return res.status(401).json({
          success: false,
          message: "Invalid roll number or date of birth",
        });
      }

      let normalizedDob = String(dob).trim();

      // Convert YYYY-MM-DD to DD-MM-YYYY
      if (normalizedDob.includes("-")) {
        const parts = normalizedDob.split("-");

        if (
          parts.length === 3 &&
          parts[0].length === 4 &&
          parts[1].length === 2 &&
          parts[2].length === 2
        ) {
          normalizedDob = `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
      }

      console.log(
        `[LOGIN] Student: ${rollNumber}, DOB: ${normalizedDob}`
      );

      const student = await db
        .select()
        .from(students)
        .where(
          and(
            eq(students.rollNumber, String(rollNumber).trim()),
            eq(students.dob, normalizedDob)
          )
        )
        .get();

      if (!student) {
        console.log(
          `[LOGIN] Student not found: ${rollNumber}`
        );

        return res.status(401).json({
          success: false,
          message: "Student not found or incorrect credentials",
        });
      }

      const token = jwt.sign(
        {
          id: student.id,
          role: "student",
        },
        JWT_SECRET,
        {
          expiresIn: "24h",
        }
      );

      console.log(
        `[LOGIN] Student login successful: ${rollNumber}`
      );

      return res.json({
        success: true,
        token,
        user: {
          id: student.id,
          role: "student",
          name: student.name,
          rollNumber: student.rollNumber,
        },
      });
    }

    // ==========================================
    // FACULTY LOGIN
    // ==========================================

    if (loginType === "faculty") {
      if (!email || !password) {
        return res.status(401).json({
          success: false,
          message: "Invalid email or password",
        });
      }

      const facultyMail = String(email).trim();
      const facultyPassword = String(password);

      console.log(
        `[LOGIN] Faculty login attempt: ${facultyMail}`
      );

      /*
       * IMPORTANT:
       *
       * Turso faculty table:
       *
       * id
       * mail
       * password
       *
       * Therefore use faculty.mail.
       */

      const fac = await db
        .select()
        .from(faculty)
        .where(
          and(
            eq(faculty.email, email),
            eq(faculty.password, password)
          )
        )
        .get();

      if (!fac) {
        console.log(
          `[LOGIN] Faculty login failed: ${facultyMail}`
        );

        return res.status(401).json({
          success: false,
          message: "Invalid email or password",
        });
      }

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

      console.log(
        `[LOGIN] Faculty login successful: ${facultyMail}`
      );

      return res.json({
        success: true,
        token,
        user: {
          id: fac.id,
          role: "faculty",
          email: fac.mail,
        },
      });
    }

    // ==========================================
    // INVALID LOGIN TYPE
    // ==========================================

    return res.status(400).json({
      success: false,
      message: "Invalid login type",
    });

  } catch (error: any) {
    console.error(
      "[LOGIN] Unexpected error:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ==========================================
// GET CURRENT USER
// ==========================================

export const getMe = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    // ==========================================
    // STUDENT
    // ==========================================

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
      });
    }

    // ==========================================
    // FACULTY
    // ==========================================

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
        email: fac.mail,
      });
    }

    return res.status(400).json({
      message: "Invalid user role",
    });

  } catch (error: any) {
    console.error(
      "[GET ME] Error:",
      error.message
    );

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};