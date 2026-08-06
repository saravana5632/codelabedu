import { Express } from "express";
import { login, getMe } from "./controllers/auth.js";
import { getTests, getTestDetails, getQuestion, submitCode, runCode, getSubmissions } from "./controllers/student.js";
import { getFacultyTests, createTest, updateTest, deleteTest, duplicateTest, getTestResults, createQuestion, checkTestSubmissions, getAllStudents } from "./controllers/faculty.js";
import { getAnalyticsDashboard, getTestAnalytics } from "./controllers/analytics.js";
import { authMiddleware, roleMiddleware } from "./middleware/authMiddleware.js";

export function setupRoutes(app: Express) {
  app.post("/api/login", login);
  app.get("/api/me", authMiddleware, getMe);

  // Student Routes
  app.get("/api/student/tests", authMiddleware, roleMiddleware("student"), getTests);
  app.get("/api/student/tests/:id", authMiddleware, roleMiddleware("student"), getTestDetails);
  app.get("/api/student/questions/:id", authMiddleware, roleMiddleware("student"), getQuestion);
  app.post("/api/student/run", authMiddleware, roleMiddleware("student"), runCode);
  app.post("/api/student/submit", authMiddleware, roleMiddleware("student"), submitCode);
  app.get("/api/student/submissions", authMiddleware, roleMiddleware("student"), getSubmissions);

  // Faculty Routes
  app.get("/api/faculty/students", authMiddleware, roleMiddleware("faculty"), getAllStudents);
  app.get("/api/faculty/tests", authMiddleware, roleMiddleware("faculty"), getFacultyTests);
  app.post("/api/faculty/tests", authMiddleware, roleMiddleware("faculty"), createTest);
  app.put("/api/faculty/tests/:id", authMiddleware, roleMiddleware("faculty"), updateTest);
  app.delete("/api/faculty/tests/:id", authMiddleware, roleMiddleware("faculty"), deleteTest);
  app.get("/api/faculty/tests/:id/check-submissions", authMiddleware, roleMiddleware("faculty"), checkTestSubmissions);
  app.post("/api/faculty/tests/:id/duplicate", authMiddleware, roleMiddleware("faculty"), duplicateTest);
  app.post("/api/faculty/questions", authMiddleware, roleMiddleware("faculty"), createQuestion);
  app.get("/api/faculty/results/:testId", authMiddleware, roleMiddleware("faculty"), getTestResults);
  
  app.get("/api/analytics/dashboard", authMiddleware, roleMiddleware("faculty"), getAnalyticsDashboard);
  app.get("/api/analytics/test/:testId", authMiddleware, roleMiddleware("faculty"), getTestAnalytics);
}
