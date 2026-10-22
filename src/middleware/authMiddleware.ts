import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { db } from "../db/index.js";
import { studentAuthMetadata, students } from "../db/schema.js";
import { eq } from "drizzle-orm";

const JWT_SECRET = process.env.JWT_SECRET || "codelab-secret-key-123";

export interface AuthRequest extends Request {
  user?: {
    id: number;
    role: "student" | "faculty";
    rollNumber?: string;
    tokenVersion?: number;
  };
}

export const authMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.split(" ")[1]
    : undefined;

  if (!token) {
    return res.status(401).json({ message: "Authentication required" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      id: number;
      role: "student" | "faculty";
      rollNumber?: string;
      tokenVersion?: number;
    };

    if (!decoded || typeof decoded.id !== "number" || !decoded.role) {
      return res.status(401).json({ message: "Invalid token" });
    }

    if (decoded.role === "student" && typeof decoded.tokenVersion === "number") {
      const studentExists = await db
        .select({ id: students.id })
        .from(students)
        .where(eq(students.id, decoded.id))
        .get();

      if (!studentExists) {
        return res.status(401).json({ message: "Account no longer exists" });
      }

      const meta = await db
        .select()
        .from(studentAuthMetadata)
        .where(eq(studentAuthMetadata.studentId, decoded.id))
        .get();

      const expectedVersion = meta?.tokenVersion ?? 1;
      if (decoded.tokenVersion !== expectedVersion) {
        return res.status(401).json({
          message: "Session expired or invalidated. Please log in again.",
        });
      }
    }

    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid token" });
  }
};

export const roleMiddleware = (role: "student" | "faculty") => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (req.user?.role !== role) {
      return res.status(403).json({ message: "Access denied" });
    }
    next();
  };
};
