// @ts-nocheck
import { Response } from "express";
import { AuthRequest } from "../middleware/authMiddleware.js";
import { db } from "../db/index.js";
import { malpracticeLogs, studentSessions, codeSimilarity, students, tests, questions, submissions } from "../db/schema.js";
import { eq, and, desc, sql } from "drizzle-orm";

// Utility: Normalize code for similarity comparison
function normalizeCode(code: string): string {
  if (!code) return "";
  let clean = code.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, ""); // remove C/JS/Java comments
  clean = clean.replace(/#.*/g, ""); // remove python comments
  clean = clean.replace(/\s+/g, " ").trim().toLowerCase();
  return clean;
}

// Levenshtein / Token-based similarity calculation
function calculateSimilarity(code1: string, code2: string): number {
  const norm1 = normalizeCode(code1);
  const norm2 = normalizeCode(code2);

  if (!norm1 || !norm2) return 0;
  if (norm1 === norm2) return 100;

  // Tokenize by non-alphanumeric
  const tokens1 = norm1.split(/[^a-zA-Z0-9_]+/).filter(Boolean);
  const tokens2 = norm2.split(/[^a-zA-Z0-9_]+/).filter(Boolean);

  if (tokens1.length === 0 || tokens2.length === 0) return 0;

  // Jaccard similarity + Token frequency match
  const set1 = new Set(tokens1);
  const set2 = new Set(tokens2);

  let intersection = 0;
  for (const token of set1) {
    if (set2.has(token)) intersection++;
  }

  const union = new Set([...set1, ...set2]).size;
  const jaccard = union > 0 ? (intersection / union) : 0;

  // Sequence bigram overlap for structural similarity
  const getBigrams = (toks: string[]) => {
    const bg: string[] = [];
    for (let i = 0; i < toks.length - 1; i++) {
      bg.push(`${toks[i]}_${toks[i+1]}`);
    }
    return bg;
  };

  const bg1 = getBigrams(tokens1);
  const bg2 = getBigrams(tokens2);
  const bgSet2 = new Set(bg2);

  let bgMatch = 0;
  for (const b of bg1) {
    if (bgSet2.has(b)) bgMatch++;
  }

  const bgScore = (bg1.length > 0 && bg2.length > 0) ? (bgMatch / Math.max(bg1.length, bg2.length)) : jaccard;

  const combined = (jaccard * 0.4) + (bgScore * 0.6);
  return Math.min(100, Math.round(combined * 100));
}

export const logActivity = async (req: AuthRequest, res: Response) => {
  try {
    const studentId = req.user?.id;
    if (!studentId) return res.status(401).json({ message: "Unauthorized" });

    const { test_id, event_type, duration, details } = req.body;

    const log = await db.insert(malpracticeLogs).values({
      studentId,
      testId: test_id ? parseInt(test_id.toString()) : null,
      eventType: event_type || 'unknown_activity',
      timestamp: new Date().toISOString(),
      duration: duration || 0,
      details: typeof details === 'object' ? JSON.stringify(details) : (details || "")
    }).returning().get();

    // Calculate total violations for student in this test
    const violations = await db.select()
      .from(malpracticeLogs)
      .where(
        and(
          eq(malpracticeLogs.studentId, studentId),
          test_id ? eq(malpracticeLogs.testId, parseInt(test_id.toString())) : sql`test_id IS NULL`
        )
      )
      .all();

    const violationCount = violations.length;

    let warningLevel = 1;
    let warningMessage = "Activity logged";

    if (violationCount === 1) {
      warningMessage = "Copy/paste or browser activity detected";
    } else if (violationCount >= 3) {
      warningLevel = 3;
      warningMessage = "Multiple suspicious activities detected. Faculty has been notified.";
    } else if (violationCount > 1) {
      warningLevel = 2;
      warningMessage = "Suspicious activity recorded. Please refrain from switching tabs or pasting code.";
    }

    return res.json({
      success: true,
      log,
      violationCount,
      warningLevel,
      warningMessage
    });
  } catch (error: any) {
    console.error("Error logging activity:", error);
    return res.status(500).json({ message: "Failed to log activity" });
  }
};

export const getTestMalpractice = async (req: AuthRequest, res: Response) => {
  try {
    const testId = parseInt(req.params.testId);
    if (!testId) return res.status(400).json({ message: "Invalid test ID" });

    // Fetch test & enrolled/participating students
    const allLogs = await db.select({
      id: malpracticeLogs.id,
      studentId: malpracticeLogs.studentId,
      testId: malpracticeLogs.testId,
      eventType: malpracticeLogs.eventType,
      timestamp: malpracticeLogs.timestamp,
      duration: malpracticeLogs.duration,
      details: malpracticeLogs.details,
      studentName: students.name,
      rollNumber: students.rollNumber
    })
    .from(malpracticeLogs)
    .leftJoin(students, eq(malpracticeLogs.studentId, students.id))
    .where(eq(malpracticeLogs.testId, testId))
    .orderBy(desc(malpracticeLogs.timestamp))
    .all();

    // Fetch all students who submitted to this test
    const allStudentsList = await db.select().from(students).all();
    const testSubmissions = await db.select({
      studentId: submissions.studentId,
      questionId: submissions.questionId
    })
    .from(submissions)
    .leftJoin(questions, eq(submissions.questionId, questions.id))
    .where(eq(questions.testId, testId))
    .all();

    const studentIdsInTest = new Set([
      ...allLogs.map(l => l.studentId),
      ...testSubmissions.map(s => s.studentId)
    ]);

    // Fetch sessions
    const sessions = await db.select().from(studentSessions).all();

    // Fetch code similarity entries for test
    const similarities = await db.select().from(codeSimilarity).where(eq(codeSimilarity.testId, testId)).all();

    // Map student statistics
    const studentSummaries = allStudentsList
      .filter(s => studentIdsInTest.has(s.id))
      .map(s => {
        const studentLogs = allLogs.filter(l => l.studentId === s.id);
        const violationCount = studentLogs.length;
        const tabSwitchCount = studentLogs.filter(l => 
          l.eventType === 'tab_switch' || l.eventType === 'focus_lost' || l.eventType === 'window_minimize' || l.eventType === 'fullscreen_exit'
        ).length;
        const copyPasteCount = studentLogs.filter(l => 
          l.eventType === 'copy_attempt' || l.eventType === 'paste_attempt' || l.eventType === 'cut_attempt' || l.eventType === 'large_paste'
        ).length;
        const largePasteCount = studentLogs.filter(l => l.eventType === 'large_paste').length;

        // Session info
        const studentSession = sessions.find(sess => sess.studentId === s.id && sess.isActive === 1);
        const loginDevice = studentSession ? (studentSession.deviceInfo || studentSession.ipAddress || "Desktop Browser") : "Not Active";

        // Highest similarity for this student
        const studentSims = similarities.filter(sim => sim.student1Id === s.id || sim.student2Id === s.id);
        const maxSim = studentSims.reduce((max, item) => Math.max(max, item.similarityPercentage), 0);

        // Risk level calculation:
        // Green: No or minor activity (<2 violations, <50% similarity)
        // Yellow: 2-4 violations or 50-75% similarity
        // Red: >=5 violations or >75% similarity or multiple logins
        let riskLevel: "Green" | "Yellow" | "Red" = "Green";
        if (violationCount >= 5 || maxSim >= 75 || studentLogs.some(l => l.eventType === 'multiple_login')) {
          riskLevel = "Red";
        } else if (violationCount >= 2 || maxSim >= 50 || largePasteCount > 0) {
          riskLevel = "Yellow";
        }

        return {
          studentId: s.id,
          studentName: s.name,
          rollNumber: s.rollNumber,
          department: s.department,
          violationCount,
          tabSwitchCount,
          copyPasteCount,
          largePasteCount,
          loginDevice,
          similarityScore: maxSim,
          riskLevel
        };
      });

    const totalViolations = allLogs.length;
    const studentsFlagged = studentSummaries.filter(s => s.riskLevel === 'Yellow' || s.riskLevel === 'Red').length;
    const activeSuspiciousSessions = studentSummaries.filter(s => s.riskLevel === 'Red' && s.loginDevice !== "Not Active").length;

    const avgSim = similarities.length > 0 
      ? Math.round(similarities.reduce((acc, curr) => acc + curr.similarityPercentage, 0) / similarities.length)
      : 0;

    const riskDistribution = {
      green: studentSummaries.filter(s => s.riskLevel === 'Green').length,
      yellow: studentSummaries.filter(s => s.riskLevel === 'Yellow').length,
      red: studentSummaries.filter(s => s.riskLevel === 'Red').length
    };

    const similarityDistribution = {
      '0-20%': similarities.filter(s => s.similarityPercentage <= 20).length,
      '21-40%': similarities.filter(s => s.similarityPercentage > 20 && s.similarityPercentage <= 40).length,
      '41-60%': similarities.filter(s => s.similarityPercentage > 40 && s.similarityPercentage <= 60).length,
      '61-80%': similarities.filter(s => s.similarityPercentage > 60 && s.similarityPercentage <= 80).length,
      '81-100%': similarities.filter(s => s.similarityPercentage > 80).length
    };

    // Violations over time (hourly)
    const timeMap: { [time: string]: number } = {};
    allLogs.forEach(log => {
      const timeStr = new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      timeMap[timeStr] = (timeMap[timeStr] || 0) + 1;
    });

    const violationsOverTime = Object.entries(timeMap).map(([time, count]) => ({ time, count }));

    return res.json({
      testId,
      summary: {
        totalViolations,
        studentsFlagged,
        averageSimilarity: avgSim,
        activeSuspiciousSessions,
        riskDistribution,
        similarityDistribution
      },
      studentSummaries,
      logs: allLogs,
      violationsOverTime
    });
  } catch (error: any) {
    console.error("Error fetching malpractice report:", error);
    return res.status(500).json({ message: "Failed to fetch malpractice data" });
  }
};

export const getStudentActivity = async (req: AuthRequest, res: Response) => {
  try {
    const studentId = parseInt(req.params.id);
    if (!studentId) return res.status(400).json({ message: "Invalid student ID" });

    const studentInfo = await db.select().from(students).where(eq(students.id, studentId)).get();
    if (!studentInfo) return res.status(404).json({ message: "Student not found" });

    const logs = await db.select()
      .from(malpracticeLogs)
      .where(eq(malpracticeLogs.studentId, studentId))
      .orderBy(desc(malpracticeLogs.timestamp))
      .all();

    const sessions = await db.select()
      .from(studentSessions)
      .where(eq(studentSessions.studentId, studentId))
      .orderBy(desc(studentSessions.loginTime))
      .all();

    const studentSubmissions = await db.select()
      .from(submissions)
      .where(eq(submissions.studentId, studentId))
      .orderBy(desc(submissions.submittedAt))
      .all();

    return res.json({
      student: studentInfo,
      logs,
      sessions,
      submissions: studentSubmissions,
      behaviorStats: {
        totalLogs: logs.length,
        tabSwitches: logs.filter(l => l.eventType === 'tab_switch' || l.eventType === 'focus_lost').length,
        copyPastes: logs.filter(l => l.eventType === 'copy_attempt' || l.eventType === 'paste_attempt' || l.eventType === 'large_paste').length,
        largePastes: logs.filter(l => l.eventType === 'large_paste').length,
        submissionCount: studentSubmissions.length
      }
    });
  } catch (error: any) {
    console.error("Error fetching student activity:", error);
    return res.status(500).json({ message: "Failed to fetch student activity" });
  }
};

export const getSimilarityAnalytics = async (req: AuthRequest, res: Response) => {
  try {
    const testId = parseInt(req.params.testId);
    if (!testId) return res.status(400).json({ message: "Invalid test ID" });

    // Fetch questions for this test
    const testQuestions = await db.select().from(questions).where(eq(questions.testId, testId)).all();
    if (testQuestions.length === 0) {
      return res.json({ testId, similarityPairs: [] });
    }

    const questionIds = testQuestions.map(q => q.id);

    // Fetch all submissions for these questions
    const allSubs = await db.select({
      submissionId: submissions.id,
      studentId: submissions.studentId,
      questionId: submissions.questionId,
      sourceCode: submissions.sourceCode,
      language: submissions.language,
      studentName: students.name,
      rollNumber: students.rollNumber,
      questionTitle: questions.title
    })
    .from(submissions)
    .leftJoin(students, eq(submissions.studentId, students.id))
    .leftJoin(questions, eq(submissions.questionId, questions.id))
    .all();

    const testSubs = allSubs.filter(s => questionIds.includes(s.questionId));

    // Group by questionId
    const simPairs: any[] = [];

    for (const q of testQuestions) {
      const qSubs = testSubs.filter(s => s.questionId === q.id);
      
      // Pairwise compare students
      for (let i = 0; i < qSubs.length; i++) {
        for (let j = i + 1; j < qSubs.length; j++) {
          const sub1 = qSubs[i];
          const sub2 = qSubs[j];

          if (sub1.studentId === sub2.studentId) continue;

          const pct = calculateSimilarity(sub1.sourceCode, sub2.sourceCode);
          
          let status = "Normal";
          if (pct >= 80) status = "High Malpractice";
          else if (pct >= 60) status = "Suspicious";

          simPairs.push({
            testId,
            questionId: q.id,
            questionTitle: q.title,
            student1Id: sub1.studentId,
            student1Name: sub1.studentName,
            student1Roll: sub1.rollNumber,
            student1Code: sub1.sourceCode,
            student2Id: sub2.studentId,
            student2Name: sub2.studentName,
            student2Roll: sub2.rollNumber,
            student2Code: sub2.sourceCode,
            similarityPercentage: pct,
            status,
            createdAt: new Date().toISOString()
          });

          // Store or update in DB
          try {
            await db.insert(codeSimilarity).values({
              testId,
              student1Id: sub1.studentId,
              student2Id: sub2.studentId,
              similarityPercentage: pct,
              status,
              details: JSON.stringify({ questionTitle: q.title }),
              createdAt: new Date().toISOString()
            }).run();
          } catch(e) {
            // Ignore duplicate insert errors
          }
        }
      }
    }

    simPairs.sort((a, b) => b.similarityPercentage - a.similarityPercentage);

    return res.json({
      testId,
      similarityPairs: simPairs
    });
  } catch (error: any) {
    console.error("Error generating similarity analysis:", error);
    return res.status(500).json({ message: "Failed to compute code similarity" });
  }
};

export const checkSession = async (req: AuthRequest, res: Response) => {
  try {
    const studentId = req.user?.id;
    if (!studentId) return res.status(401).json({ message: "Unauthorized" });

    const { session_token, device_info, ip_address, test_id } = req.body;

    const existingSessions = await db.select()
      .from(studentSessions)
      .where(and(eq(studentSessions.studentId, studentId), eq(studentSessions.isActive, 1)))
      .all();

    let isMultiDevice = false;

    if (existingSessions.length > 0) {
      const activeDifferentSession = existingSessions.find(s => s.sessionToken && s.sessionToken !== session_token);
      if (activeDifferentSession) {
        isMultiDevice = true;
        // Invalidate old session and log malpractice alert
        await db.update(studentSessions)
          .set({ isActive: 0, logoutTime: new Date().toISOString() })
          .where(eq(studentSessions.id, activeDifferentSession.id))
          .run();

        await db.insert(malpracticeLogs).values({
          studentId,
          testId: test_id ? parseInt(test_id.toString()) : null,
          eventType: "multiple_login",
          timestamp: new Date().toISOString(),
          duration: 0,
          details: `Concurrent login detected on new device: ${device_info || 'Unknown device'}`
        }).run();
      }
    }

    // Upsert or heartbeat session
    if (session_token) {
      const cur = existingSessions.find(s => s.sessionToken === session_token);
      if (!cur) {
        await db.insert(studentSessions).values({
          studentId,
          sessionToken: session_token,
          ipAddress: ip_address || req.ip || "127.0.0.1",
          deviceInfo: device_info || req.headers["user-agent"] || "Browser",
          loginTime: new Date().toISOString(),
          isActive: 1
        }).run();
      }
    }

    return res.json({
      active: true,
      multiDeviceAlert: isMultiDevice,
      message: isMultiDevice ? "Previous session logged out due to new login on another device." : "Session valid"
    });
  } catch (error: any) {
    console.error("Error checking session:", error);
    return res.status(500).json({ message: "Failed to check session" });
  }
};
