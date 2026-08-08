import { Request, Response } from "express";
import { db } from "../db/index.js";
import { students, faculty } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import jwt from "jsonwebtoken";
import { AuthRequest } from "../middleware/authMiddleware.js";

const JWT_SECRET = process.env.JWT_SECRET || "codelab-secret-key-123";

export const login = async (req: Request, res: Response) => {
  try {
    const { loginType, rollNumber, dob, email, password } = req.body;

    if (loginType === 'student') {
      if (!rollNumber || !dob) return res.status(401).json({ success: false, message: "Invalid roll number or date of birth" });
      
      // Normalize DOB to DD-MM-YYYY
      let normalizedDob = dob;
      if (dob.includes('-')) {
        const parts = dob.split('-');
        if (parts.length === 3) {
          if (parts[0].length === 4) {
            // YYYY-MM-DD -> DD-MM-YYYY
            normalizedDob = `${parts[2]}-${parts[1]}-${parts[0]}`;
          } else if (parts[2].length === 4) {
            // Already DD-MM-YYYY
            normalizedDob = dob;
          }
        }
      }

      console.log(`[LOGIN] Attempting student login for Roll Number: ${rollNumber}, DOB (Normalized): ${normalizedDob}`);

      let student;
      try {
        student = await db.select().from(students).where(
          and(eq(students.rollNumber, rollNumber), eq(students.dob, normalizedDob))
        ).get();
      } catch (dbError: any) {
        console.error(`[LOGIN] Database query failed:`, dbError.message);
        return res.status(500).json({ success: false, message: "Database connection failed" });
      }

      if (!student) {
        console.log(`[LOGIN] Student not found or incorrect DOB for Roll Number: ${rollNumber}`);
        return res.status(401).json({ success: false, message: "Student not found or incorrect credentials" });
      }

      console.log(`[LOGIN] Successful login for student: ${rollNumber}`);
      const token = jwt.sign({ id: student.id, role: "student" }, JWT_SECRET, { expiresIn: '24h' });
      return res.json({ success: true, token, user: { id: student.id, role: "student", name: student.name, rollNumber: student.rollNumber } });
    } else if (loginType === 'faculty') {
      if (!email || !password) return res.status(401).json({ success: false, message: "Invalid email or password" });
      
      let fac;
      try {
         fac = await db.select().from(faculty).where(
           and(eq(faculty.email, email), eq(faculty.password, password))
         ).get();
      } catch (dbError: any) {
         console.error(`[LOGIN] Database query failed for faculty:`, dbError.message);
         return res.status(500).json({ success: false, message: "Database connection failed" });
      }

      if (!fac) {
        return res.status(401).json({ success: false, message: "Invalid email or password" });
      }

      const token = jwt.sign({ id: fac.id, role: "faculty" }, JWT_SECRET, { expiresIn: '24h' });
      return res.json({ success: true, token, user: { id: fac.id, role: "faculty", name: fac.name, email: fac.email } });
    }

    return res.status(400).json({ success: false, message: "Invalid login type" });
  } catch (error: any) {
    console.error("[LOGIN] Unexpected error:", error.message);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const getMe = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    if (user.role === "student") {
      const student = await db.select().from(students).where(eq(students.id, user.id)).get();
      if (!student) return res.status(404).json({ message: "Student not found" });
      return res.json({ id: student.id, role: "student", name: student.name, rollNumber: student.rollNumber });
    } else {
      const fac = await db.select().from(faculty).where(eq(faculty.id, user.id)).get();
      if (!fac) return res.status(404).json({ message: "Faculty not found" });
      return res.json({ id: fac.id, role: "faculty", name: fac.name, email: fac.email });
    }
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
};
