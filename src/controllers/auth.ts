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
      let student = await db.select().from(students).where(
        and(eq(students.rollNumber, rollNumber), eq(students.dob, dob))
      ).get();

      if (!student) {
        return res.status(401).json({ message: "Invalid roll number or date of birth" });
      }

      const token = jwt.sign({ id: student.id, role: "student" }, JWT_SECRET, { expiresIn: '24h' });
      return res.json({ token, user: { id: student.id, role: "student", name: student.name, rollNumber: student.rollNumber } });
    } else if (loginType === 'faculty') {
      // Mock faculty auth, auto-create if not exists
      let fac = await db.select().from(faculty).where(
        and(eq(faculty.email, email), eq(faculty.password, password))
      ).get();

      if (!fac) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      const token = jwt.sign({ id: fac.id, role: "faculty" }, JWT_SECRET, { expiresIn: '24h' });
      return res.json({ token, user: { id: fac.id, role: "faculty", name: fac.name, email: fac.email } });
    }

    return res.status(400).json({ message: "Invalid login type" });
  } catch (error: any) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Internal server error" });
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
