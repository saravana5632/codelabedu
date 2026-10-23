import { Express } from "express";
import {
  login,
  getMe,
  logout,
} from "./controllers/auth.js";
import {
  getTests,
  getTestDetails,
  getQuestion,
  submitCode,
  submitQuestionCode,
  runCode,
  getSubmissions,
} from "./controllers/student.js";
import {
  getFacultyTests,
  createTest,
  updateTest,
  deleteTest,
  duplicateTest,
  getTestResults,
  createQuestion,
  getAllAdminQuestions,
  getAdminQuestionById,
  updateQuestion,
  updateQuestionStatus,
  deleteQuestion,
  getQuestionTestCases,
  addQuestionTestCase,
  updateQuestionTestCase,
  deleteQuestionTestCase,
  reorderQuestionTestCases,
  validateQuestionConfiguration,
  getTestQuestions,
  checkTestSubmissions,
  getAllStudents,
  createStudent,
  updateStudent,
  resetStudentPassword,
  bulkInitializeStudentPasswords,
} from "./controllers/faculty.js";
import {
  getAllAssessmentTimers,
  getAssessmentTimer,
  updateAssessmentTimer,
  startOrRecoverAssessmentSession,
  getSessionTimerStatus,
  saveSessionDraft,
  submitAssessmentSession,
} from "./controllers/timer.js";
import {
  getAnalyticsDashboard,
  getTestAnalytics,
} from "./controllers/analytics.js";
import {
  getAdminMalpracticeSettings,
  updateAdminMalpracticeSettings,
  getStudentMalpracticeSettings,
  recordMalpracticeEvent,
  getAdminMalpracticeEvents,
  updateMalpracticeEventReview,
} from "./controllers/malpractice.js";
import { authMiddleware, roleMiddleware } from "./middleware/authMiddleware.js";

export function setupRoutes(app: Express) {
  // ==========================================
  // Authentication Routes
  // ==========================================
  app.post("/api/login", login);
  app.post("/api/auth/login", login);
  app.post("/api/student/login", login);

  app.post("/api/logout", authMiddleware, logout);
  app.post("/api/auth/logout", authMiddleware, logout);

  app.get("/api/me", authMiddleware, getMe);
  app.get("/api/auth/me", authMiddleware, getMe);

  // ==========================================
  // Faculty / Admin Timer Control Routes
  // ==========================================
  app.get(
    "/api/admin/assessments/timers",
    authMiddleware,
    roleMiddleware("faculty"),
    getAllAssessmentTimers
  );
  app.get(
    "/api/faculty/timers",
    authMiddleware,
    roleMiddleware("faculty"),
    getAllAssessmentTimers
  );
  app.get(
    "/api/admin/assessments/:id/timer",
    authMiddleware,
    roleMiddleware("faculty"),
    getAssessmentTimer
  );
  app.get(
    "/api/faculty/tests/:id/timer",
    authMiddleware,
    roleMiddleware("faculty"),
    getAssessmentTimer
  );
  app.put(
    "/api/admin/assessments/:id/timer",
    authMiddleware,
    roleMiddleware("faculty"),
    updateAssessmentTimer
  );
  app.put(
    "/api/faculty/tests/:id/timer",
    authMiddleware,
    roleMiddleware("faculty"),
    updateAssessmentTimer
  );

  // ==========================================
  // Student Assessment Session & Timer Routes
  // ==========================================
  app.post(
    "/api/assessments/:id/start",
    authMiddleware,
    roleMiddleware("student"),
    startOrRecoverAssessmentSession
  );
  app.post(
    "/api/student/tests/:id/start",
    authMiddleware,
    roleMiddleware("student"),
    startOrRecoverAssessmentSession
  );
  app.get(
    "/api/assessment-sessions/:sessionId/timer",
    authMiddleware,
    roleMiddleware("student"),
    getSessionTimerStatus
  );
  app.get(
    "/api/student/tests/:id/timer",
    authMiddleware,
    roleMiddleware("student"),
    getSessionTimerStatus
  );
  app.put(
    "/api/assessment-sessions/:sessionId/draft",
    authMiddleware,
    roleMiddleware("student"),
    saveSessionDraft
  );
  app.post(
    "/api/student/tests/:id/draft",
    authMiddleware,
    roleMiddleware("student"),
    saveSessionDraft
  );
  app.post(
    "/api/assessment-sessions/:sessionId/submit",
    authMiddleware,
    roleMiddleware("student"),
    submitAssessmentSession
  );

  // ==========================================
  // Anti-Malpractice Control & Event Routes
  // ==========================================
  app.get(
    "/api/admin/malpractice/settings",
    authMiddleware,
    roleMiddleware("faculty"),
    getAdminMalpracticeSettings
  );
  app.get(
    "/api/faculty/malpractice/settings",
    authMiddleware,
    roleMiddleware("faculty"),
    getAdminMalpracticeSettings
  );
  app.put(
    "/api/admin/malpractice/settings",
    authMiddleware,
    roleMiddleware("faculty"),
    updateAdminMalpracticeSettings
  );
  app.put(
    "/api/faculty/malpractice/settings",
    authMiddleware,
    roleMiddleware("faculty"),
    updateAdminMalpracticeSettings
  );
  app.get(
    "/api/admin/malpractice/events",
    authMiddleware,
    roleMiddleware("faculty"),
    getAdminMalpracticeEvents
  );
  app.get(
    "/api/faculty/malpractice/events",
    authMiddleware,
    roleMiddleware("faculty"),
    getAdminMalpracticeEvents
  );
  app.patch(
    "/api/admin/malpractice/events/:id",
    authMiddleware,
    roleMiddleware("faculty"),
    updateMalpracticeEventReview
  );
  app.patch(
    "/api/faculty/malpractice/events/:id",
    authMiddleware,
    roleMiddleware("faculty"),
    updateMalpracticeEventReview
  );
  app.get(
    "/api/student/malpractice/settings",
    authMiddleware,
    roleMiddleware("student"),
    getStudentMalpracticeSettings
  );
  app.get(
    "/api/malpractice/settings",
    authMiddleware,
    getStudentMalpracticeSettings
  );
  app.post(
    "/api/assessment-sessions/:sessionId/malpractice-events",
    authMiddleware,
    roleMiddleware("student"),
    recordMalpracticeEvent
  );

  // ==========================================
  // Student Question, Execution & Submission Routes
  // ==========================================
  app.get(
    "/api/student/tests",
    authMiddleware,
    roleMiddleware("student"),
    getTests
  );
  app.get(
    "/api/student/tests/:id",
    authMiddleware,
    roleMiddleware("student"),
    getTestDetails
  );
  app.get(
    "/api/student/questions/:id",
    authMiddleware,
    roleMiddleware("student"),
    getQuestion
  );
  app.post(
    "/api/student/run",
    authMiddleware,
    roleMiddleware("student"),
    runCode
  );
  app.post(
    "/api/student/questions/:id/submit",
    authMiddleware,
    roleMiddleware("student"),
    submitQuestionCode
  );
  app.post(
    "/api/student/submit",
    authMiddleware,
    roleMiddleware("student"),
    submitCode
  );
  app.get(
    "/api/student/submissions",
    authMiddleware,
    roleMiddleware("student"),
    getSubmissions
  );

  // ==========================================
  // Faculty / Admin Test & Question Management Routes
  // ==========================================
  // ==========================================
  // Faculty / Admin Student & Credential Management Routes
  // ==========================================
  app.get(
    "/api/faculty/students",
    authMiddleware,
    roleMiddleware("faculty"),
    getAllStudents
  );
  app.get(
    "/api/admin/students",
    authMiddleware,
    roleMiddleware("faculty"),
    getAllStudents
  );
  app.post(
    "/api/faculty/students",
    authMiddleware,
    roleMiddleware("faculty"),
    createStudent
  );
  app.post(
    "/api/admin/students",
    authMiddleware,
    roleMiddleware("faculty"),
    createStudent
  );
  app.put(
    "/api/faculty/students/:id",
    authMiddleware,
    roleMiddleware("faculty"),
    updateStudent
  );
  app.put(
    "/api/admin/students/:id",
    authMiddleware,
    roleMiddleware("faculty"),
    updateStudent
  );
  app.post(
    "/api/faculty/students/:id/reset-password",
    authMiddleware,
    roleMiddleware("faculty"),
    resetStudentPassword
  );
  app.post(
    "/api/admin/students/:id/reset-password",
    authMiddleware,
    roleMiddleware("faculty"),
    resetStudentPassword
  );
  app.post(
    "/api/faculty/students/bulk-initialize",
    authMiddleware,
    roleMiddleware("faculty"),
    bulkInitializeStudentPasswords
  );
  app.post(
    "/api/admin/students/bulk-initialize",
    authMiddleware,
    roleMiddleware("faculty"),
    bulkInitializeStudentPasswords
  );
  app.get(
    "/api/faculty/tests",
    authMiddleware,
    roleMiddleware("faculty"),
    getFacultyTests
  );
  app.post(
    "/api/faculty/tests",
    authMiddleware,
    roleMiddleware("faculty"),
    createTest
  );
  app.put(
    "/api/faculty/tests/:id",
    authMiddleware,
    roleMiddleware("faculty"),
    updateTest
  );
  app.delete(
    "/api/faculty/tests/:id",
    authMiddleware,
    roleMiddleware("faculty"),
    deleteTest
  );
  app.get(
    "/api/faculty/tests/:id/questions",
    authMiddleware,
    roleMiddleware("faculty"),
    getTestQuestions
  );
  app.get(
    "/api/faculty/tests/:id/check-submissions",
    authMiddleware,
    roleMiddleware("faculty"),
    checkTestSubmissions
  );
  app.post(
    "/api/faculty/tests/:id/duplicate",
    authMiddleware,
    roleMiddleware("faculty"),
    duplicateTest
  );

  // Question CRUD & Test Case Management Routes (both /api/faculty/* and /api/admin/*)
  app.post(
    "/api/faculty/questions/validate",
    authMiddleware,
    roleMiddleware("faculty"),
    validateQuestionConfiguration
  );
  app.post(
    "/api/admin/questions/validate",
    authMiddleware,
    roleMiddleware("faculty"),
    validateQuestionConfiguration
  );

  app.get(
    "/api/faculty/questions",
    authMiddleware,
    roleMiddleware("faculty"),
    getAllAdminQuestions
  );
  app.get(
    "/api/admin/questions",
    authMiddleware,
    roleMiddleware("faculty"),
    getAllAdminQuestions
  );

  app.post(
    "/api/faculty/questions",
    authMiddleware,
    roleMiddleware("faculty"),
    createQuestion
  );
  app.post(
    "/api/admin/questions",
    authMiddleware,
    roleMiddleware("faculty"),
    createQuestion
  );

  app.get(
    "/api/faculty/questions/:id",
    authMiddleware,
    roleMiddleware("faculty"),
    getAdminQuestionById
  );
  app.get(
    "/api/admin/questions/:id",
    authMiddleware,
    roleMiddleware("faculty"),
    getAdminQuestionById
  );

  app.put(
    "/api/faculty/questions/:id",
    authMiddleware,
    roleMiddleware("faculty"),
    updateQuestion
  );
  app.put(
    "/api/admin/questions/:id",
    authMiddleware,
    roleMiddleware("faculty"),
    updateQuestion
  );

  app.patch(
    "/api/faculty/questions/:id/status",
    authMiddleware,
    roleMiddleware("faculty"),
    updateQuestionStatus
  );
  app.patch(
    "/api/admin/questions/:id/status",
    authMiddleware,
    roleMiddleware("faculty"),
    updateQuestionStatus
  );

  app.delete(
    "/api/faculty/questions/:id",
    authMiddleware,
    roleMiddleware("faculty"),
    deleteQuestion
  );
  app.delete(
    "/api/admin/questions/:id",
    authMiddleware,
    roleMiddleware("faculty"),
    deleteQuestion
  );

  // Test cases per question
  app.get(
    "/api/faculty/questions/:id/test-cases",
    authMiddleware,
    roleMiddleware("faculty"),
    getQuestionTestCases
  );
  app.post(
    "/api/faculty/questions/:id/test-cases",
    authMiddleware,
    roleMiddleware("faculty"),
    addQuestionTestCase
  );
  app.put(
    "/api/faculty/questions/:id/test-cases/reorder",
    authMiddleware,
    roleMiddleware("faculty"),
    reorderQuestionTestCases
  );
  app.put(
    "/api/faculty/questions/:id/test-cases/:tcId",
    authMiddleware,
    roleMiddleware("faculty"),
    updateQuestionTestCase
  );
  app.delete(
    "/api/faculty/questions/:id/test-cases/:tcId",
    authMiddleware,
    roleMiddleware("faculty"),
    deleteQuestionTestCase
  );

  app.get(
    "/api/faculty/results/:testId",
    authMiddleware,
    roleMiddleware("faculty"),
    getTestResults
  );

  // ==========================================
  // Analytics Routes
  // ==========================================
  app.get(
    "/api/analytics/dashboard",
    authMiddleware,
    roleMiddleware("faculty"),
    getAnalyticsDashboard
  );
  app.get(
    "/api/analytics/test/:testId",
    authMiddleware,
    roleMiddleware("faculty"),
    getTestAnalytics
  );
}
