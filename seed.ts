import { Request, Response } from "express";
import { db } from "./src/db/index.js";
import { students, faculty } from "./src/db/schema.js";
import { eq, and, sql } from "drizzle-orm";
import jwt from "jsonwebtoken";
import { AuthRequest } from "../middleware/authMiddleware.js";

const JWT_SECRET =
  process.env.JWT_SECRET || "codelab-secret-key-123";

// ==========================================
// LOGIN
// ==========================================

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

      // Normalize DOB to DD-MM-YYYY
      let normalizedDob = String(dob).trim();

      if (normalizedDob.includes("-")) {
        const parts = normalizedDob.split("-");

        if (parts.length === 3) {
          // YYYY-MM-DD -> DD-MM-YYYY
          if (parts[0].length === 4) {
            normalizedDob =
              `${parts[2]}-${parts[1]}-${parts[0]}`;
          }
        }
      }

      console.log(
        `[LOGIN] Student: ${rollNumber}, DOB: ${normalizedDob}`
      );

      let student;

      try {
        student = await db
          .select()
          .from(students)
          .where(
            and(
              eq(students.rollNumber, rollNumber),
              eq(students.dob, normalizedDob)
            )
          )
          .get();
      } catch (dbError: any) {
        console.error(
          "[LOGIN] Student database error:",
          dbError.message
        );

        return res.status(500).json({
          success: false,
          message: "Database connection failed",
        });
      }

      if (!student) {
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

      console.log(
        `[LOGIN] Faculty attempting login: ${email}`
      );

      let facultyUser: any;

      try {
        /*
         * IMPORTANT:
         * Faculty table in Turso contains:
         *
         * id
         * email
         * password
         *
         * We use raw SQL here so the code does not
         * depend on an incorrectly named Drizzle field.
         */

        const result = await db.all(
          sql`
            SELECT id, email, password
            FROM faculty
            WHERE email = ${email}
            AND password = ${password}
            LIMIT 1
          `
        );

        facultyUser = result[0];
      } catch (dbError: any) {
        console.error(
          "[LOGIN] Faculty database error:",
          dbError.message
        );

        return res.status(500).json({
          success: false,
          message: "Database connection failed",
        });
      }

      if (!facultyUser) {
        console.log(
          `[LOGIN] Faculty login failed: ${email}`
        );

        return res.status(401).json({
          success: false,
          message: "Invalid email or password",
        });
      }

      console.log(
        `[LOGIN] Faculty login successful: ${email}`
      );

      const token = jwt.sign(
        {
          id: facultyUser.id,
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
          id: facultyUser.id,
          role: "faculty",
          email: facultyUser.email,
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
      let facultyUser: any;

      try {
        const result = await db.all(
          sql`
            SELECT id, email
            FROM faculty
            WHERE id = ${user.id}
            LIMIT 1
          `
        );

        facultyUser = result[0];
      } catch (dbError: any) {
        console.error(
          "[GET ME] Faculty database error:",
          dbError.message
        );

        return res.status(500).json({
          message: "Database connection failed",
        });
      }

      if (!facultyUser) {
        return res.status(404).json({
          message: "Faculty not found",
        });
      }

      return res.json({
        id: facultyUser.id,
        role: "faculty",
        email: facultyUser.email,
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