import { Response } from "express";
import { db } from "../db/index.js";
import {
  tests,
  questions,
  submissions,
  students,
  testCompletions,
  assessmentTimerConfigs,
  assessmentSessions,
} from "../db/schema.js";
import { eq, and, desc, lte, sql } from "drizzle-orm";
import { AuthRequest } from "../middleware/authMiddleware.js";
import { ensureTimerTables } from "../db/migrate.js";
import {
  evaluateQuestionCode,
  getQuestionTestCasesFromDb,
} from "../lib/codeEvaluator.js";
import axios from "axios";

const JUDGE0_URL = process.env.JUDGE0_URL || "https://ce.judge0.com";

const languageMap: Record<string, number> = {
  C: 50,
  "C++": 54,
  Java: 62,
  Python: 71,
  JavaScript: 93,
};

export function validateAlgorithmHelper(code: string, questionTitle: string) {
  const normalized = code.replace(/\/\/.*|\/\*[\s\S]*?\*\//g, "").toLowerCase();

  if (
    /arrays\.sort|collections\.sort|\.sort\(|\bqsort\(|\bsorted\(/i.test(
      normalized
    )
  ) {
    return { isValid: false, detected: "Built-in Sort", required: questionTitle };
  }

  const titleLower = questionTitle.toLowerCase();

  const hasMergeWord = /merge/.test(normalized);
  const hasPivotWord = /pivot|partition/.test(normalized);

  const hasRecursion = /([a-z0-9_]+)\s*\([^)]*\)[\s\S]*?\1\s*\(/i.test(
    normalized
  );
  const hasMidCalc =
    /\+\s*[a-z0-9_]+\s*\)\s*\/\s*2|>>\s*1/.test(normalized) ||
    /mid/.test(normalized);
  const hasSwap =
    /=\s*[a-z0-9_\[\]]+\s*;\s*[a-z0-9_\[\]]+\s*=\s*[a-z0-9_\[\]]+\s*;\s*[a-z0-9_\[\]]+\s*=/i.test(
      normalized
    ) ||
    /swap/.test(normalized) ||
    /\[[a-z0-9_]+\],\s*\[[a-z0-9_]+\]\s*=\s*\[[a-z0-9_]+\],\s*\[[a-z0-9_]+\]/.test(
      normalized
    );
  const hasTwoPointerMergeLoop =
    /while\s*\([^)]+(<|<=)[^)]+(&&|and)[^)]+(<|<=)[^)]+\)/.test(normalized) ||
    /while\s*[a-z0-9_]+\s*<\s*[a-z0-9_]+\s*and\s*[a-z0-9_]+\s*<\s*[a-z0-9_]+/.test(
      normalized
    );

  let detected = "Unknown";

  if (
    hasPivotWord ||
    (hasSwap && hasRecursion && !hasMergeWord && !hasTwoPointerMergeLoop)
  ) {
    detected = "Quick Sort";
  } else if (
    hasMergeWord ||
    (hasRecursion && hasMidCalc && hasTwoPointerMergeLoop) ||
    hasTwoPointerMergeLoop
  ) {
    detected = "Merge Sort";
  } else if (hasMidCalc && !hasSwap && !hasTwoPointerMergeLoop) {
    detected = "Binary Search";
  }

  if (titleLower.includes("merge sort")) {
    if (
      detected === "Merge Sort" ||
      (hasTwoPointerMergeLoop && !hasPivotWord)
    ) {
      return { isValid: true, detected: "Merge Sort", required: "Merge Sort" };
    }
    return { isValid: false, detected, required: "Merge Sort" };
  }

  if (titleLower.includes("quick sort")) {
    if (
      detected === "Quick Sort" ||
      (hasSwap && hasRecursion && !hasMergeWord && !hasTwoPointerMergeLoop)
    ) {
      return { isValid: true, detected: "Quick Sort", required: "Quick Sort" };
    }
    return { isValid: false, detected, required: "Quick Sort" };
  }

  if (titleLower.includes("binary search")) {
    if (
      detected === "Binary Search" ||
      (hasMidCalc && !hasSwap && !hasTwoPointerMergeLoop)
    ) {
      return {
        isValid: true,
        detected: "Binary Search",
        required: "Binary Search",
      };
    }
    return { isValid: false, detected, required: "Binary Search" };
  }

  return { isValid: true, detected: "Unknown", required: "Unknown" };
}

/**
 * Fetches or initializes the authoritative timer configuration for an assessment.
 */
export async function getOrCreateTimerConfig(assessmentId: number, facultyId?: number | null) {
  await ensureTimerTables();

  let config = await db
    .select()
    .from(assessmentTimerConfigs)
    .where(eq(assessmentTimerConfigs.assessmentId, assessmentId))
    .get();

  if (!config) {
    const test = await db
      .select()
      .from(tests)
      .where(eq(tests.id, assessmentId))
      .get();

    if (!test) return null;

    const initialDuration = test.duration && test.duration > 0 ? test.duration : 60;
    const nowIso = new Date().toISOString();

    await db
      .insert(assessmentTimerConfigs)
      .values({
        assessmentId,
        timerEnabled: true,
        durationMinutes: initialDuration,
        gracePeriodSeconds: 15,
        autoSubmitOnExpiry: true,
        updatedAt: nowIso,
        updatedBy: facultyId || test.facultyId || null,
      })
      .onConflictDoNothing()
      .execute();

    config = await db
      .select()
      .from(assessmentTimerConfigs)
      .where(eq(assessmentTimerConfigs.assessmentId, assessmentId))
      .get();
  }

  return config;
}

/**
 * Calculates remaining seconds from an ISO deadline string using server clock.
 */
export function computeRemainingSeconds(
  timerEnabled: boolean,
  deadlineAt: string | null
): number | null {
  if (!timerEnabled || !deadlineAt) return null;
  const diffMs = new Date(deadlineAt).getTime() - Date.now();
  return Math.max(0, Math.floor(diffMs / 1000));
}

export interface SubmissionItemInput {
  question_id: number;
  source_code: string;
  language: string;
  isAutoSubmit?: boolean;
}

/**
 * Evaluates and records a student's final assessment submissions idempotently.
 * Safe across concurrent calls, retries, and multiple backend instances.
 */
export async function evaluateAndFinalizeSubmission(params: {
  studentId: number;
  assessmentId: number;
  sessionId?: number;
  submissionItems?: SubmissionItemInput[];
  finalStatus: "submitted" | "expired";
  isMalpracticeAutoSubmit?: boolean;
}) {
  await ensureTimerTables();
  const {
    studentId,
    assessmentId,
    sessionId,
    submissionItems,
    finalStatus,
    isMalpracticeAutoSubmit = false,
  } = params;

  const nowIso = new Date().toISOString();

  // Check if already completed in testCompletions
  const existingCompletion = await db
    .select()
    .from(testCompletions)
    .where(
      and(
        eq(testCompletions.studentId, studentId),
        eq(testCompletions.testId, assessmentId)
      )
    )
    .get();

  // Locate session
  let session = sessionId
    ? await db
        .select()
        .from(assessmentSessions)
        .where(eq(assessmentSessions.id, sessionId))
        .get()
    : await db
        .select()
        .from(assessmentSessions)
        .where(
          and(
            eq(assessmentSessions.studentId, studentId),
            eq(assessmentSessions.assessmentId, assessmentId)
          )
        )
        .orderBy(desc(assessmentSessions.id))
        .get();

  if (existingCompletion && session && session.status !== "active") {
    return {
      alreadyFinalized: true,
      session,
      status: session.status,
    };
  }

  // Atomically claim the active session so concurrent requests cannot double-submit
  if (session) {
    const updateRes = await db.run(
      sql`UPDATE assessment_sessions
          SET status = ${finalStatus},
              submitted_at = ${nowIso},
              updated_at = ${nowIso}
          WHERE id = ${session.id} AND status = 'active'`
    );

    if (updateRes.rowsAffected === 0 && existingCompletion) {
      const latestSession = await db
        .select()
        .from(assessmentSessions)
        .where(eq(assessmentSessions.id, session.id))
        .get();
      return {
        alreadyFinalized: true,
        session: latestSession || session,
        status: latestSession?.status || finalStatus,
      };
    }
  }

  // Double-check testCompletions before inserting submissions
  const recheckCompletion = await db
    .select()
    .from(testCompletions)
    .where(
      and(
        eq(testCompletions.studentId, studentId),
        eq(testCompletions.testId, assessmentId)
      )
    )
    .get();

  if (recheckCompletion) {
    return {
      alreadyFinalized: true,
      session,
      status: session?.status || finalStatus,
    };
  }

  // Record completion first to guard against concurrent duplicate evaluations
  await db
    .insert(testCompletions)
    .values({
      studentId,
      testId: assessmentId,
      completedAt: nowIso,
    })
    .execute();

  // Determine which questions and code drafts to evaluate
  let itemsToEvaluate: SubmissionItemInput[] = [];

  if (submissionItems && submissionItems.length > 0) {
    itemsToEvaluate = submissionItems;
  } else if (session) {
    const draftsObj: Record<
      string,
      { sourceCode?: string; code?: string; language?: string }
    > =
      typeof session.drafts === "string"
        ? JSON.parse(session.drafts || "{}")
        : (session.drafts as any) || {};

    let selectedQIds: number[] = [];
    if (session.selectedQuestions) {
      selectedQIds =
        typeof session.selectedQuestions === "string"
          ? JSON.parse(session.selectedQuestions)
          : (session.selectedQuestions as number[]);
    }

    if (!Array.isArray(selectedQIds) || selectedQIds.length === 0) {
      const draftKeys = Object.keys(draftsObj)
        .map((k) => Number(k))
        .filter((n) => !isNaN(n));
      if (draftKeys.length > 0) {
        selectedQIds = draftKeys;
      } else {
        const testQs = await db
          .select({ id: questions.id })
          .from(questions)
          .where(eq(questions.testId, assessmentId))
          .limit(2)
          .all();
        selectedQIds = testQs.map((q) => q.id);
      }
    }

    itemsToEvaluate = selectedQIds.map((qId) => {
      const draft = draftsObj[String(qId)] || {};
      return {
        question_id: qId,
        source_code: draft.sourceCode ?? draft.code ?? "",
        language: draft.language || "Python",
        isAutoSubmit: true,
      };
    });
  }

  const student = await db
    .select()
    .from(students)
    .where(eq(students.id, studentId))
    .get();

  const webhookUrl = process.env.APPS_SCRIPT_WEBHOOK_URL;

  const evaluations: Record<number, any> = {};

  for (const sub of itemsToEvaluate) {
    const { question_id, source_code = "", language = "Python" } = sub;
    const question = await db
      .select()
      .from(questions)
      .where(eq(questions.id, Number(question_id)))
      .get();
    if (!question) continue;

    const maxMarks = Number(question.maxMarks) > 0 ? Number(question.maxMarks) : 50;
    const hasMeaningfulCode = source_code && source_code.trim().length > 0;

    let questionMarks = 0;
    let verdict: "PASSED" | "PARTIAL" | "FAILED" = "FAILED";
    let finalOutputText = "";

    if (hasMeaningfulCode && !isMalpracticeAutoSubmit) {
      const dbCases = await getQuestionTestCasesFromDb(question.id);
      const evalSummary = await evaluateQuestionCode({
        question,
        sourceCode: source_code,
        language,
        testCases: dbCases,
        includePrivateDetails: false,
      });

      questionMarks = evalSummary.score;
      verdict = evalSummary.verdict;
      finalOutputText = evalSummary.formattedReport;
      evaluations[question.id] = evalSummary;
    } else {
      finalOutputText = `Passed: 0/0\nQuestion Score: 0/${maxMarks}`;
    }

    const submissionModeNote =
      finalStatus === "expired"
        ? "\nSubmission Mode: Auto-Submitted at Timer Expiry"
        : "";

    await db
      .insert(submissions)
      .values({
        studentId,
        questionId: Number(question_id),
        language,
        sourceCode: source_code,
        output: finalOutputText + submissionModeNote,
        status: verdict,
        submittedAt: nowIso,
      })
      .execute();

    // Optional Google Sheets webhook logging
    if (student && webhookUrl) {
      const payload = {
        rollNo: student.rollNumber,
        name: student.name,
        question: question.title,
        solution: source_code || "// Empty submission",
        status: verdict,
        marks: questionMarks,
        totalMarks: maxMarks * itemsToEvaluate.length,
      };
      axios
        .post(webhookUrl, payload, {
          headers: { "Content-Type": "application/json" },
        })
        .catch(() => {});
    }
  }

  const updatedSession = session
    ? await db
        .select()
        .from(assessmentSessions)
        .where(eq(assessmentSessions.id, session.id))
        .get()
    : null;

  return {
    alreadyFinalized: false,
    session: updatedSession,
    status: finalStatus,
    evaluations,
  };
}

let isSweepingExpired = false;

/**
 * Background / on-demand sweep that finds any active sessions whose server deadline has passed
 * and automatically finalizes & evaluates their saved drafts.
 * Uses atomic row updates so multiple server instances never conflict.
 */
export async function processExpiredSessions() {
  if (isSweepingExpired) return;
  isSweepingExpired = true;
  try {
    await ensureTimerTables();
    const nowIso = new Date().toISOString();

    const expiredActiveSessions = await db
      .select()
      .from(assessmentSessions)
      .where(
        and(
          eq(assessmentSessions.status, "active"),
          eq(assessmentSessions.timerEnabled, true),
          lte(assessmentSessions.deadlineAt, nowIso)
        )
      )
      .limit(100)
      .all();

    for (const sess of expiredActiveSessions) {
      if (!sess.deadlineAt) continue;
      const deadlineMs = new Date(sess.deadlineAt).getTime();
      if (Date.now() >= deadlineMs) {
        await evaluateAndFinalizeSubmission({
          studentId: sess.studentId,
          assessmentId: sess.assessmentId,
          sessionId: sess.id,
          finalStatus: "expired",
        });
      }
    }
  } catch (err) {
    console.error("[TIMER SWEEP] Error processing expired sessions:", err);
  } finally {
    isSweepingExpired = false;
  }
}

// =========================================================
// FACULTY / ADMIN ENDPOINTS
// =========================================================

export const getAllAssessmentTimers = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    await ensureTimerTables();
    await processExpiredSessions();

    const allTests = await db
      .select()
      .from(tests)
      .orderBy(desc(tests.id))
      .all();

    const visibleTests = allTests.filter((t) => t.status !== "archived");

    const results = await Promise.all(
      visibleTests.map(async (test) => {
        const config = await getOrCreateTimerConfig(test.id, req.user?.id);
        const sessions = await db
          .select({
            status: assessmentSessions.status,
          })
          .from(assessmentSessions)
          .where(eq(assessmentSessions.assessmentId, test.id))
          .all();

        const activeSessionsCount = sessions.filter(
          (s) => s.status === "active"
        ).length;
        const submittedSessionsCount = sessions.filter(
          (s) => s.status === "submitted"
        ).length;
        const expiredSessionsCount = sessions.filter(
          (s) => s.status === "expired"
        ).length;

        return {
          assessmentId: test.id,
          title: test.title,
          subject: test.subject,
          status: test.status,
          startTime: test.startTime,
          endTime: test.endTime,
          timerEnabled: config ? Boolean(config.timerEnabled) : true,
          durationMinutes: config ? config.durationMinutes : test.duration,
          gracePeriodSeconds: config ? config.gracePeriodSeconds : 15,
          autoSubmitOnExpiry: config ? Boolean(config.autoSubmitOnExpiry) : true,
          updatedAt: config?.updatedAt || null,
          updatedBy: config?.updatedBy || null,
          activeSessionsCount,
          submittedSessionsCount,
          expiredSessionsCount,
        };
      })
    );

    return res.json(results);
  } catch (error: any) {
    console.error("[GET ALL TIMERS] Error:", error);
    return res.status(500).json({
      message: "Error fetching assessment timer configurations",
    });
  }
};

export const getAssessmentTimer = async (req: AuthRequest, res: Response) => {
  try {
    await ensureTimerTables();
    await processExpiredSessions();

    const assessmentId = Number(req.params.id);
    if (!assessmentId || isNaN(assessmentId)) {
      return res.status(400).json({ message: "Invalid assessment ID" });
    }

    const test = await db
      .select()
      .from(tests)
      .where(eq(tests.id, assessmentId))
      .get();

    if (!test) {
      return res.status(404).json({ message: "Assessment not found" });
    }

    const config = await getOrCreateTimerConfig(assessmentId, req.user?.id);

    const sessions = await db
      .select({
        id: assessmentSessions.id,
        studentId: assessmentSessions.studentId,
        status: assessmentSessions.status,
        startedAt: assessmentSessions.startedAt,
        deadlineAt: assessmentSessions.deadlineAt,
        submittedAt: assessmentSessions.submittedAt,
      })
      .from(assessmentSessions)
      .where(eq(assessmentSessions.assessmentId, assessmentId))
      .all();

    const activeSessionsCount = sessions.filter(
      (s) => s.status === "active"
    ).length;
    const submittedSessionsCount = sessions.filter(
      (s) => s.status === "submitted"
    ).length;
    const expiredSessionsCount = sessions.filter(
      (s) => s.status === "expired"
    ).length;

    return res.json({
      assessmentId: test.id,
      title: test.title,
      subject: test.subject,
      status: test.status,
      timerEnabled: config ? Boolean(config.timerEnabled) : true,
      durationMinutes: config ? config.durationMinutes : test.duration,
      gracePeriodSeconds: config ? config.gracePeriodSeconds : 15,
      autoSubmitOnExpiry: config ? Boolean(config.autoSubmitOnExpiry) : true,
      updatedAt: config?.updatedAt || null,
      updatedBy: config?.updatedBy || null,
      activeSessionsCount,
      submittedSessionsCount,
      expiredSessionsCount,
      serverTime: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("[GET TIMER] Error:", error);
    return res.status(500).json({
      message: "Error fetching timer configuration",
    });
  }
};

export const updateAssessmentTimer = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    await ensureTimerTables();

    const assessmentId = Number(req.params.id);
    const facultyId = req.user!.id;

    if (!assessmentId || isNaN(assessmentId)) {
      return res.status(400).json({ message: "Invalid assessment ID" });
    }

    const test = await db
      .select()
      .from(tests)
      .where(eq(tests.id, assessmentId))
      .get();

    if (!test) {
      return res.status(404).json({ message: "Assessment not found" });
    }

    const {
      timerEnabled = true,
      durationMinutes,
      hours,
      minutes,
      gracePeriodSeconds = 15,
      autoSubmitOnExpiry = true,
      applyToActiveSessions = false,
    } = req.body;

    const isEnabled = Boolean(timerEnabled);

    // Compute total duration in minutes from either durationMinutes or hours + minutes
    let resolvedDuration: number;
    if (durationMinutes !== undefined && durationMinutes !== null && durationMinutes !== "") {
      resolvedDuration = Number(durationMinutes);
    } else if (hours !== undefined || minutes !== undefined) {
      const h = Number(hours || 0);
      const m = Number(minutes || 0);
      if (isNaN(h) || isNaN(m) || h < 0 || m < 0) {
        return res.status(400).json({
          message: "Hours and minutes must be non-negative numbers.",
        });
      }
      resolvedDuration = Math.round(h * 60 + m);
    } else {
      resolvedDuration = test.duration || 60;
    }

    if (isNaN(resolvedDuration) || !Number.isFinite(resolvedDuration)) {
      return res.status(400).json({
        message: "Assessment duration must be a valid number.",
      });
    }

    if (resolvedDuration < 0) {
      return res.status(400).json({
        message: "Assessment duration cannot be negative.",
      });
    }

    if (isEnabled && resolvedDuration <= 0) {
      return res.status(400).json({
        message: "A positive duration (at least 1 minute) is required when the timer is enabled.",
      });
    }

    if (resolvedDuration > 720) {
      return res.status(400).json({
        message: "Assessment duration cannot exceed 720 minutes (12 hours).",
      });
    }

    const finalDuration =
      resolvedDuration > 0 ? Math.round(resolvedDuration) : test.duration || 60;
    const finalGrace = Math.max(0, Math.min(300, Number(gracePeriodSeconds) || 15));
    const nowIso = new Date().toISOString();

    await getOrCreateTimerConfig(assessmentId, facultyId);

    await db
      .update(assessmentTimerConfigs)
      .set({
        timerEnabled: isEnabled,
        durationMinutes: finalDuration,
        gracePeriodSeconds: finalGrace,
        autoSubmitOnExpiry: Boolean(autoSubmitOnExpiry),
        updatedAt: nowIso,
        updatedBy: facultyId,
      })
      .where(eq(assessmentTimerConfigs.assessmentId, assessmentId))
      .execute();

    // Keep tests.duration synchronized with the authoritative durationMinutes
    await db
      .update(tests)
      .set({
        duration: finalDuration,
      })
      .where(eq(tests.id, assessmentId))
      .execute();

    // Check active student sessions for this assessment
    const activeSessions = await db
      .select()
      .from(assessmentSessions)
      .where(
        and(
          eq(assessmentSessions.assessmentId, assessmentId),
          eq(assessmentSessions.status, "active")
        )
      )
      .all();

    let updatedActiveSessionsCount = 0;
    let preservedActiveSessionsCount = activeSessions.length;

    if (applyToActiveSessions && activeSessions.length > 0) {
      for (const sess of activeSessions) {
        const startMs = new Date(sess.startedAt).getTime();
        const newDeadlineIso = isEnabled
          ? new Date(startMs + finalDuration * 60 * 1000).toISOString()
          : null;

        await db
          .update(assessmentSessions)
          .set({
            timerEnabled: isEnabled,
            durationMinutes: finalDuration,
            deadlineAt: newDeadlineIso,
            updatedAt: nowIso,
          })
          .where(eq(assessmentSessions.id, sess.id))
          .execute();
        updatedActiveSessionsCount++;
      }
      preservedActiveSessionsCount = 0;
    }

    const updatedConfig = await getOrCreateTimerConfig(assessmentId, facultyId);

    return res.json({
      success: true,
      message: applyToActiveSessions
        ? `Timer settings saved and applied to ${updatedActiveSessionsCount} active session(s) and all future sessions.`
        : activeSessions.length > 0
        ? `Timer settings saved for future sessions. ${preservedActiveSessionsCount} currently active student session(s) retained their existing deadline.`
        : "Timer settings saved and applied successfully.",
      config: {
        assessmentId,
        title: test.title,
        subject: test.subject,
        status: test.status,
        timerEnabled: Boolean(updatedConfig?.timerEnabled),
        durationMinutes: updatedConfig?.durationMinutes ?? finalDuration,
        gracePeriodSeconds: updatedConfig?.gracePeriodSeconds ?? finalGrace,
        autoSubmitOnExpiry: Boolean(updatedConfig?.autoSubmitOnExpiry),
        updatedAt: updatedConfig?.updatedAt ?? nowIso,
        updatedBy: updatedConfig?.updatedBy ?? facultyId,
        activeSessionsCount: activeSessions.length,
        updatedActiveSessionsCount,
        preservedActiveSessionsCount,
      },
    });
  } catch (error: any) {
    console.error("[UPDATE TIMER] Error:", error);
    return res.status(500).json({
      message: "Error saving timer configuration",
      error: error.message,
    });
  }
};

// =========================================================
// STUDENT ASSESSMENT SESSION & TIMER ENDPOINTS
// =========================================================

export const startOrRecoverAssessmentSession = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    await ensureTimerTables();

    const studentId = req.user!.id;
    const assessmentId = Number(req.params.id);

    if (!assessmentId || isNaN(assessmentId)) {
      return res.status(400).json({ message: "Invalid assessment ID" });
    }

    const test = await db
      .select()
      .from(tests)
      .where(eq(tests.id, assessmentId))
      .get();

    if (!test) {
      return res.status(404).json({ message: "Assessment not found" });
    }

    if (test.status !== "published") {
      return res.status(403).json({
        message: "This assessment is not currently active.",
      });
    }

    // Check if student already completed this assessment
    const existingCompletion = await db
      .select()
      .from(testCompletions)
      .where(
        and(
          eq(testCompletions.studentId, studentId),
          eq(testCompletions.testId, assessmentId)
        )
      )
      .get();

    if (existingCompletion) {
      return res.status(403).json({
        message: "You have already completed and submitted this assessment.",
        completed: true,
      });
    }

    const requestedQuestions = Array.isArray(req.body?.selectedQuestions)
      ? req.body.selectedQuestions.map((q: any) => Number(q))
      : undefined;

    // Look for an existing session for this student and assessment
    const existingSession = await db
      .select()
      .from(assessmentSessions)
      .where(
        and(
          eq(assessmentSessions.studentId, studentId),
          eq(assessmentSessions.assessmentId, assessmentId)
        )
      )
      .orderBy(desc(assessmentSessions.id))
      .get();

    if (existingSession) {
      if (
        existingSession.status === "submitted" ||
        existingSession.status === "expired"
      ) {
        return res.status(403).json({
          message:
            existingSession.status === "expired"
              ? "Your assessment time has expired and your work was automatically submitted."
              : "You have already submitted this assessment.",
          completed: true,
          status: existingSession.status,
        });
      }

      // Check if the active session has expired according to server clock
      if (existingSession.timerEnabled && existingSession.deadlineAt) {
        const deadlineMs = new Date(existingSession.deadlineAt).getTime();
        if (Date.now() >= deadlineMs) {
          await evaluateAndFinalizeSubmission({
            studentId,
            assessmentId,
            sessionId: existingSession.id,
            finalStatus: "expired",
          });
          return res.status(403).json({
            message:
              "Your assessment time has expired and your saved code has been automatically submitted.",
            completed: true,
            expired: true,
            status: "expired",
          });
        }
      }

      // Update selectedQuestions if newly provided and not yet locked in
      let currentSelectedQuestions = existingSession.selectedQuestions
        ? typeof existingSession.selectedQuestions === "string"
          ? JSON.parse(existingSession.selectedQuestions)
          : existingSession.selectedQuestions
        : null;

      if (
        requestedQuestions &&
        requestedQuestions.length >= 1 &&
        (!currentSelectedQuestions || currentSelectedQuestions.length === 0)
      ) {
        currentSelectedQuestions = requestedQuestions;
        await db
          .update(assessmentSessions)
          .set({
            selectedQuestions: currentSelectedQuestions,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(assessmentSessions.id, existingSession.id))
          .execute();
      }

      const remainingSeconds = computeRemainingSeconds(
        Boolean(existingSession.timerEnabled),
        existingSession.deadlineAt
      );

      const drafts =
        typeof existingSession.drafts === "string"
          ? JSON.parse(existingSession.drafts || "{}")
          : existingSession.drafts || {};

      return res.json({
        sessionId: existingSession.id,
        assessmentId: existingSession.assessmentId,
        studentId: existingSession.studentId,
        status: existingSession.status,
        timerEnabled: Boolean(existingSession.timerEnabled),
        durationMinutes: existingSession.durationMinutes,
        startedAt: existingSession.startedAt,
        deadlineAt: existingSession.deadlineAt,
        serverTime: new Date().toISOString(),
        remainingSeconds,
        selectedQuestions: currentSelectedQuestions,
        drafts,
        recovered: true,
      });
    }

    // Create a brand new individual session using authoritative timer configuration
    const timerConfig = await getOrCreateTimerConfig(assessmentId);
    const timerEnabled = timerConfig ? Boolean(timerConfig.timerEnabled) : true;
    const durationMinutes = timerConfig
      ? timerConfig.durationMinutes
      : test.duration || 60;

    const now = new Date();
    const startedAt = now.toISOString();
    const deadlineAt = timerEnabled
      ? new Date(now.getTime() + durationMinutes * 60 * 1000).toISOString()
      : null;

    const newSession = await db
      .insert(assessmentSessions)
      .values({
        studentId,
        assessmentId,
        timerEnabled,
        durationMinutes,
        startedAt,
        deadlineAt,
        submittedAt: null,
        status: "active",
        selectedQuestions:
          requestedQuestions && requestedQuestions.length >= 1
            ? requestedQuestions
            : null,
        drafts: {},
        updatedAt: startedAt,
      })
      .returning()
      .get();

    const remainingSeconds = computeRemainingSeconds(timerEnabled, deadlineAt);

    return res.status(201).json({
      sessionId: newSession.id,
      assessmentId: newSession.assessmentId,
      studentId: newSession.studentId,
      status: newSession.status,
      timerEnabled: Boolean(newSession.timerEnabled),
      durationMinutes: newSession.durationMinutes,
      startedAt: newSession.startedAt,
      deadlineAt: newSession.deadlineAt,
      serverTime: new Date().toISOString(),
      remainingSeconds,
      selectedQuestions: requestedQuestions || null,
      drafts: {},
      recovered: false,
    });
  } catch (error: any) {
    console.error("[START SESSION] Error:", error);
    return res.status(500).json({
      message: "Error starting or recovering assessment session",
    });
  }
};

export const getSessionTimerStatus = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    await ensureTimerTables();

    const studentId = req.user!.id;
    const sessionIdParam = req.params.sessionId
      ? Number(req.params.sessionId)
      : null;
    const assessmentIdParam = req.params.id ? Number(req.params.id) : null;

    let session = sessionIdParam
      ? await db
          .select()
          .from(assessmentSessions)
          .where(
            and(
              eq(assessmentSessions.id, sessionIdParam),
              eq(assessmentSessions.studentId, studentId)
            )
          )
          .get()
      : assessmentIdParam
      ? await db
          .select()
          .from(assessmentSessions)
          .where(
            and(
              eq(assessmentSessions.assessmentId, assessmentIdParam),
              eq(assessmentSessions.studentId, studentId)
            )
          )
          .orderBy(desc(assessmentSessions.id))
          .get()
      : null;

    if (!session) {
      return res.status(404).json({
        message: "Active assessment session not found",
      });
    }

    if (
      session.status === "active" &&
      session.timerEnabled &&
      session.deadlineAt
    ) {
      const deadlineMs = new Date(session.deadlineAt).getTime();
      if (Date.now() >= deadlineMs) {
        const result = await evaluateAndFinalizeSubmission({
          studentId,
          assessmentId: session.assessmentId,
          sessionId: session.id,
          finalStatus: "expired",
        });
        session = result.session || {
          ...session,
          status: "expired",
          submittedAt: new Date().toISOString(),
        };
      }
    }

    const remainingSeconds =
      session.status === "active"
        ? computeRemainingSeconds(
            Boolean(session.timerEnabled),
            session.deadlineAt
          )
        : 0;

    return res.json({
      sessionId: session.id,
      assessmentId: session.assessmentId,
      studentId: session.studentId,
      status: session.status,
      timerEnabled: Boolean(session.timerEnabled),
      durationMinutes: session.durationMinutes,
      startedAt: session.startedAt,
      deadlineAt: session.deadlineAt,
      submittedAt: session.submittedAt,
      serverTime: new Date().toISOString(),
      remainingSeconds,
    });
  } catch (error: any) {
    console.error("[GET SESSION TIMER] Error:", error);
    return res.status(500).json({
      message: "Error fetching session timer status",
    });
  }
};

export const saveSessionDraft = async (req: AuthRequest, res: Response) => {
  try {
    await ensureTimerTables();

    const studentId = req.user!.id;
    const sessionIdParam = req.params.sessionId
      ? Number(req.params.sessionId)
      : null;
    const assessmentIdParam = req.params.id ? Number(req.params.id) : null;

    const session = sessionIdParam
      ? await db
          .select()
          .from(assessmentSessions)
          .where(
            and(
              eq(assessmentSessions.id, sessionIdParam),
              eq(assessmentSessions.studentId, studentId)
            )
          )
          .get()
      : assessmentIdParam
      ? await db
          .select()
          .from(assessmentSessions)
          .where(
            and(
              eq(assessmentSessions.assessmentId, assessmentIdParam),
              eq(assessmentSessions.studentId, studentId)
            )
          )
          .orderBy(desc(assessmentSessions.id))
          .get()
      : null;

    if (!session) {
      return res.status(404).json({ message: "Assessment session not found" });
    }

    if (session.status !== "active") {
      return res.status(403).json({
        message: "Assessment session is no longer active. Edits are disabled.",
        expired: session.status === "expired",
        status: session.status,
      });
    }

    if (session.timerEnabled && session.deadlineAt) {
      const deadlineMs = new Date(session.deadlineAt).getTime();
      if (Date.now() > deadlineMs) {
        await evaluateAndFinalizeSubmission({
          studentId,
          assessmentId: session.assessmentId,
          sessionId: session.id,
          finalStatus: "expired",
        });
        return res.status(403).json({
          message:
            "Assessment time has expired. Your latest saved code has been automatically submitted.",
          expired: true,
          status: "expired",
        });
      }
    }

    const { drafts: incomingDrafts, questionId, sourceCode, language } = req.body;

    const existingDrafts: Record<string, any> =
      typeof session.drafts === "string"
        ? JSON.parse(session.drafts || "{}")
        : (session.drafts as any) || {};

    const nowIso = new Date().toISOString();

    if (incomingDrafts && typeof incomingDrafts === "object") {
      for (const [qId, val] of Object.entries(incomingDrafts)) {
        existingDrafts[String(qId)] = {
          ...(val as any),
          updatedAt: nowIso,
        };
      }
    } else if (questionId !== undefined) {
      existingDrafts[String(questionId)] = {
        sourceCode: sourceCode ?? "",
        language: language || "Python",
        updatedAt: nowIso,
      };
    }

    await db
      .update(assessmentSessions)
      .set({
        drafts: existingDrafts,
        updatedAt: nowIso,
      })
      .where(eq(assessmentSessions.id, session.id))
      .execute();

    return res.json({
      success: true,
      savedAt: nowIso,
      remainingSeconds: computeRemainingSeconds(
        Boolean(session.timerEnabled),
        session.deadlineAt
      ),
    });
  } catch (error: any) {
    console.error("[SAVE DRAFT] Error:", error);
    return res.status(500).json({ message: "Error saving code draft" });
  }
};

export const submitAssessmentSession = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    await ensureTimerTables();

    const studentId = req.user!.id;
    const sessionId = Number(req.params.sessionId);

    const session = await db
      .select()
      .from(assessmentSessions)
      .where(
        and(
          eq(assessmentSessions.id, sessionId),
          eq(assessmentSessions.studentId, studentId)
        )
      )
      .get();

    if (!session) {
      return res.status(404).json({ message: "Assessment session not found" });
    }

    const {
      submissions: payloadSubmissions,
      isAutoSubmit = false,
      reason,
    } = req.body;

    // If session was already finalized (e.g. by background sweep or a duplicate click)
    if (session.status !== "active") {
      if (isAutoSubmit) {
        return res.json({
          message: "Assessment already finalized",
          status: session.status,
          alreadyFinalized: true,
        });
      }
      return res.status(403).json({
        message:
          session.status === "expired"
            ? "Assessment deadline has passed. Your assessment was already automatically submitted."
            : "Assessment has already been submitted.",
        status: session.status,
        expired: session.status === "expired",
      });
    }

    const config = await getOrCreateTimerConfig(session.assessmentId);
    const gracePeriodMs = ((config?.gracePeriodSeconds ?? 15) * 1000);

    if (session.timerEnabled && session.deadlineAt) {
      const deadlineMs = new Date(session.deadlineAt).getTime();
      const nowMs = Date.now();

      // Reject manual submissions that arrive after deadline + grace period
      if (!isAutoSubmit && nowMs > deadlineMs + gracePeriodMs) {
        await evaluateAndFinalizeSubmission({
          studentId,
          assessmentId: session.assessmentId,
          sessionId: session.id,
          finalStatus: "expired",
        });

        return res.status(403).json({
          code: "DEADLINE_EXCEEDED",
          expired: true,
          status: "expired",
          message:
            "Submission rejected: The server assessment deadline has passed. Your last saved draft before expiry was automatically submitted.",
        });
      }
    }

    const isExpirySubmit =
      Boolean(isAutoSubmit) &&
      reason !== "malpractice" &&
      session.timerEnabled &&
      session.deadlineAt &&
      Date.now() >= new Date(session.deadlineAt).getTime() - 5000;

    const result = await evaluateAndFinalizeSubmission({
      studentId,
      assessmentId: session.assessmentId,
      sessionId: session.id,
      submissionItems: Array.isArray(payloadSubmissions)
        ? payloadSubmissions
        : undefined,
      finalStatus: isExpirySubmit ? "expired" : "submitted",
      isMalpracticeAutoSubmit: reason === "malpractice",
    });

    return res.json({
      message: isExpirySubmit
        ? "Time expired. Your assessment has been automatically submitted."
        : "Assessment submitted successfully",
      status: result.status,
      alreadyFinalized: result.alreadyFinalized,
    });
  } catch (error: any) {
    console.error("[SUBMIT SESSION] Error:", error);
    return res.status(500).json({
      message: "Error submitting assessment session",
    });
  }
};
