import bcrypt from "bcryptjs";

const configuredRounds = parseInt(process.env.BCRYPT_ROUNDS || "10", 10);
export const BCRYPT_ROUNDS =
  !isNaN(configuredRounds) && configuredRounds >= 10 && configuredRounds <= 14
    ? configuredRounds
    : 10;

export const SETUP_REQUIRED_SENTINEL = "__REQUIRES_PASSWORD_SETUP__";

// Precomputed valid bcrypt hash used for constant-time dummy comparisons when user is not found
const DUMMY_BCRYPT_HASH =
  "$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";

export function isBcryptHash(value: string | null | undefined): boolean {
  if (!value || typeof value !== "string") return false;
  return /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(value);
}

/**
 * Detects whether a string matches common Date of Birth formats
 * (e.g., DD-MM-YYYY, YYYY-MM-DD, DD/MM/YYYY, DD.MM.YYYY, or 8-digit dates).
 */
export function isDobPattern(value: string | null | undefined): boolean {
  if (!value || typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed) return false;

  // DD-MM-YYYY, DD/MM/YYYY, DD.MM.YYYY
  if (/^\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}$/.test(trimmed)) {
    return true;
  }
  // YYYY-MM-DD, YYYY/MM/DD, YYYY.MM.DD
  if (/^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}$/.test(trimmed)) {
    return true;
  }
  // 8-digit compact date e.g. 18042007 or 20070418
  if (/^(?:19\d{2}|20[0-2]\d)(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])$/.test(trimmed)) {
    return true;
  }
  if (/^(?:0[1-9]|[12]\d|3[01])(?:0[1-9]|1[0-2])(?:19\d{2}|20[0-2]\d)$/.test(trimmed)) {
    return true;
  }
  return false;
}

export function isPasswordSetupRequired(
  passwordColValue: string | null | undefined
): boolean {
  if (!passwordColValue || typeof passwordColValue !== "string") return true;
  const trimmed = passwordColValue.trim();
  if (!trimmed) return true;
  if (
    trimmed === SETUP_REQUIRED_SENTINEL ||
    trimmed.startsWith("__REQUIRES_") ||
    trimmed === "UNINITIALIZED"
  ) {
    return true;
  }
  return false;
}

export interface PasswordValidationResult {
  valid: boolean;
  message?: string;
}

export function validatePasswordPolicy(
  password: unknown,
  context?: {
    rollNumber?: string;
    name?: string;
    registerNumber?: number | string;
  }
): PasswordValidationResult {
  if (typeof password !== "string" || password.length === 0) {
    return { valid: false, message: "Password is required" };
  }

  if (password.trim().length === 0) {
    return {
      valid: false,
      message: "Password cannot consist only of whitespace",
    };
  }

  if (password.length < 8) {
    return {
      valid: false,
      message: "Password must be at least 8 characters long",
    };
  }

  if (password.length > 128) {
    return {
      valid: false,
      message: "Password must not exceed 128 characters",
    };
  }

  if (isDobPattern(password)) {
    return {
      valid: false,
      message:
        "Date of Birth values are not permitted as passwords. Please choose a strong password.",
    };
  }

  if (context?.rollNumber) {
    if (
      password.trim().toLowerCase() ===
      context.rollNumber.trim().toLowerCase()
    ) {
      return {
        valid: false,
        message: "Password cannot be identical to your Roll Number",
      };
    }
  }

  if (context?.registerNumber !== undefined && context?.registerNumber !== null) {
    if (password.trim() === String(context.registerNumber).trim()) {
      return {
        valid: false,
        message: "Password cannot be identical to your Register Number",
      };
    }
  }

  return { valid: true };
}

export async function hashPassword(plainPassword: string): Promise<string> {
  return bcrypt.hash(plainPassword, BCRYPT_ROUNDS);
}

export async function verifyPassword(
  plainPassword: string,
  storedPasswordOrHash: string | null | undefined
): Promise<boolean> {
  if (
    typeof plainPassword !== "string" ||
    plainPassword.length === 0 ||
    !storedPasswordOrHash ||
    isPasswordSetupRequired(storedPasswordOrHash)
  ) {
    return false;
  }

  if (isBcryptHash(storedPasswordOrHash)) {
    try {
      return await bcrypt.compare(plainPassword, storedPasswordOrHash);
    } catch {
      return false;
    }
  }

  // Fallback for any pre-existing plaintext password stored in the database before bcrypt migration completes
  await performDummyPasswordCompare(plainPassword);
  return plainPassword === storedPasswordOrHash;
}

export async function performDummyPasswordCompare(
  plainPassword: string
): Promise<void> {
  try {
    await bcrypt.compare(plainPassword || "dummy", DUMMY_BCRYPT_HASH);
  } catch {
    // ignore
  }
}

export function deriveRegisterNumberFromRoll(
  rollNumber: string,
  fallbackId: number
): number {
  const digitsMatch = String(rollNumber || "").match(/(\d{3,6})$/);
  if (digitsMatch) {
    const suffix = parseInt(digitsMatch[1], 10);
    if (!isNaN(suffix) && suffix > 0) {
      return 211424244000 + suffix;
    }
  }
  return 211424244000 + (fallbackId || 1);
}

export function sanitizeStudentRecord(student: any) {
  if (!student) return null;
  const setupRequired = isPasswordSetupRequired(student.password);
  const { password: _omittedPassword, dob: _omittedDob, ...rest } = student;
  return {
    id: rest.id,
    rollNumber: rest.rollNumber ?? rest.roll_number,
    name: rest.name,
    department: rest.department || "Computer Science and Business Systems",
    registerNumber:
      typeof rest.registerNumber === "number"
        ? rest.registerNumber
        : typeof rest.register_number === "number"
        ? rest.register_number
        : deriveRegisterNumberFromRoll(
            rest.rollNumber ?? rest.roll_number ?? "",
            rest.id
          ),
    passwordStatus: setupRequired ? "setup_required" : "active",
    hasPasswordInitialized: !setupRequired,
  };
}

