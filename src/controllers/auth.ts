import { Request, Response } from "express";
import { db } from "../db/index.js";
import { students, faculty, studentSessions, malpracticeLogs } from "../db/schema.js";
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

      const sessionToken = Math.random().toString(36).substring(2) + Date.now().toString(36);
      const token = jwt.sign({ id: student.id, role: "student", sessionToken }, JWT_SECRET, { expiresIn: '24h' });

      // Session & IP/Device tracking
      const ipAddress = req.ip || req.socket.remoteAddress || "127.0.0.1";
      const deviceInfo = req.headers["user-agent"] || "Desktop Web Browser";

      // Check active sessions
      const existingSessions = await db.select()
        .from(studentSessions)
        .where(and(eq(studentSessions.studentId, student.id), eq(studentSessions.isActive, 1)))
        .all();

      if (existingSessions.length > 0) {
        // Invalidate previous sessions
        await db.update(studentSessions)
          .set({ isActive: 0, logoutTime: new Date().toISOString() })
          .where(and(eq(studentSessions.studentId, student.id), eq(studentSessions.isActive, 1)))
          .run();

        // Log multiple login alert
        await db.insert(malpracticeLogs).values({
          studentId: student.id,
          eventType: "multiple_login",
          timestamp: new Date().toISOString(),
          duration: 0,
          details: `Account logged in from a new session (${deviceInfo}). Logout initiated on previous device.`
        }).run();
      }

      // Record new active session
      await db.insert(studentSessions).values({
        studentId: student.id,
        sessionToken,
        ipAddress,
        deviceInfo,
        loginTime: new Date().toISOString(),
        isActive: 1
      }).run();

      return res.json({
        token,
        sessionToken,
        user: { id: student.id, role: "student", name: student.name, rollNumber: student.rollNumber }
      });
    } else if (loginType === 'faculty') {
      // Mock faculty auth, auto-create if not exists
      let fac = await db.select().from(faculty).where(eq(faculty.email, email)).get();

      if (!fac) {
        await db.insert(faculty).values({
          name: "Test Faculty",
          email,
          password
        }).run();

        fac = await db.select().from(faculty).where(eq(faculty.email, email)).get();
      } else {
        if (fac.password !== password) {
          return res.status(401).json({ message: "Invalid email or password" });
        }
      }

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
