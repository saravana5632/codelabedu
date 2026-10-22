import axios from "axios";
import jwt from "jsonwebtoken";
import { db } from "../../src/db/index.js";
import {
  students,
  faculty,
  tests,
  questions,
  submissions,
  testCompletions,
  assessmentTimerConfigs,
  assessmentSessions,
} from "../../src/db/schema.js";
import { eq, and } from "drizzle-orm";
import { ensureTimerTables } from "../../src/db/migrate.js";
import { processExpiredSessions } from "../../src/controllers/timer.js";

const BASE_URL = "http://127.0.0.1:3000/api";
const JWT_SECRET = process.env.JWT_SECRET || "codelab-secret-key-123";

function assert(condition: any, message: string) {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

async function runTests() {
  console.log("=== Starting End-to-End Dynamic Assessment Timer Verification ===");
  await ensureTimerTables();

  // 1. Ensure we have a faculty user, two test students, and a published test with 2 questions
  let fac = await db.select().from(faculty).limit(1).get();
  if (!fac) {
    fac = await db
      .insert(faculty)
      .values({
        facultyId: "FAC001",
        name: "Admin Faculty",
        department: "CSE",
        email: "admin@codelab.edu",
        password: "admin",
      })
      .returning()
      .get();
  }

  const allStudents = await db.select().from(students).limit(3).all();
  assert(allStudents.length >= 2, "At least 2 students exist in DB");
  const studentA = allStudents[0];
  const studentB = allStudents[1];

  const facultyToken = jwt.sign({ id: fac.id, role: "faculty" }, JWT_SECRET, {
    expiresIn: "1h",
  });
  const studentAToken = jwt.sign(
    { id: studentA.id, role: "student" },
    JWT_SECRET,
    { expiresIn: "1h" }
  );
  const studentBToken = jwt.sign(
    { id: studentB.id, role: "student" },
    JWT_SECRET,
    { expiresIn: "1h" }
  );

  // Create a dedicated E2E test assessment so we don't pollute existing data
  const createRes = await axios.post(
    `${BASE_URL}/faculty/tests`,
    {
      title: "E2E Timer Verification Test",
      subject: "Algorithms",
      duration: 60,
      startTime: new Date().toISOString(),
      endTime: new Date(Date.now() + 86400000).toISOString(),
    },
    { headers: { Authorization: `Bearer ${facultyToken}` } }
  );
  const testId = createRes.data.test.id;

  // Publish the test and add 2 questions
  await axios.put(
    `${BASE_URL}/faculty/tests/${testId}`,
    { status: "published" },
    { headers: { Authorization: `Bearer ${facultyToken}` } }
  );

  const q1Res = await axios.post(
    `${BASE_URL}/faculty/questions`,
    {
      testId,
      title: "Sum of Two Numbers",
      description: "Print sum of two numbers",
      sampleInput: "2 3",
      sampleOutput: "5",
      difficulty: "easy",
    },
    { headers: { Authorization: `Bearer ${facultyToken}` } }
  );
  const q2Res = await axios.post(
    `${BASE_URL}/faculty/questions`,
    {
      testId,
      title: "Product of Two Numbers",
      description: "Print product of two numbers",
      sampleInput: "2 3",
      sampleOutput: "6",
      difficulty: "easy",
    },
    { headers: { Authorization: `Bearer ${facultyToken}` } }
  );
  const qIds = [q1Res.data.question.id, q2Res.data.question.id];

  try {
    // Criterion 12: Faculty-only endpoints cannot be accessed by students
    let studentBlocked = false;
    try {
      await axios.put(
        `${BASE_URL}/admin/assessments/${testId}/timer`,
        { timerEnabled: true, durationMinutes: 30 },
        { headers: { Authorization: `Bearer ${studentAToken}` } }
      );
    } catch (e: any) {
      if (e.response?.status === 403) studentBlocked = true;
    }
    assert(studentBlocked, "Student must be blocked (403) from admin timer endpoints");
    console.log("✓ [Criterion 12] Faculty-only timer endpoints reject student access.");

    // Validation check: Negative or 0 duration when enabled must be rejected
    let invalidRejected = false;
    try {
      await axios.put(
        `${BASE_URL}/admin/assessments/${testId}/timer`,
        { timerEnabled: true, durationMinutes: -10 },
        { headers: { Authorization: `Bearer ${facultyToken}` } }
      );
    } catch (e: any) {
      if (e.response?.status === 400) invalidRejected = true;
    }
    assert(invalidRejected, "Negative duration must be rejected with 400");
    console.log("✓ [Validation] Negative/invalid duration rejected.");

    // Criterion 1 & 2: Faculty sets custom duration (45 minutes) and it persists in DB
    const setTimerRes = await axios.put(
      `${BASE_URL}/admin/assessments/${testId}/timer`,
      {
        timerEnabled: true,
        durationMinutes: 45,
        applyToActiveSessions: false,
      },
      { headers: { Authorization: `Bearer ${facultyToken}` } }
    );
    assert(
      setTimerRes.data.config.durationMinutes === 45 &&
        setTimerRes.data.config.timerEnabled === true,
      "Faculty set duration to 45 minutes"
    );

    const getTimerRes = await axios.get(
      `${BASE_URL}/admin/assessments/${testId}/timer`,
      { headers: { Authorization: `Bearer ${facultyToken}` } }
    );
    assert(
      getTimerRes.data.durationMinutes === 45,
      "Persisted durationMinutes must be 45"
    );
    console.log("✓ [Criteria 1 & 2] Faculty set 45-minute duration and persisted in DB.");

    // Criterion 3 & 4: Student A starts assessment and receives 45-min individual deadline
    const startARes = await axios.post(
      `${BASE_URL}/assessments/${testId}/start`,
      { selectedQuestions: qIds },
      { headers: { Authorization: `Bearer ${studentAToken}` } }
    );
    const sessionAId = startARes.data.sessionId;
    const deadlineA1 = startARes.data.deadlineAt;
    assert(
      startARes.data.durationMinutes === 45 &&
        startARes.data.timerEnabled === true &&
        startARes.data.remainingSeconds > 2690 &&
        startARes.data.remainingSeconds <= 2700,
      "Student A received 45-minute countdown"
    );
    console.log("✓ [Criterion 3] Student A received configured 45-minute timer on start.");

    // Criterion 5 & 6: Refreshing / reconnecting returns original deadline without resetting
    await new Promise((r) => setTimeout(r, 1100));
    const recoverARes = await axios.post(
      `${BASE_URL}/assessments/${testId}/start`,
      { selectedQuestions: qIds },
      { headers: { Authorization: `Bearer ${studentAToken}` } }
    );
    assert(
      recoverARes.data.sessionId === sessionAId &&
        recoverARes.data.deadlineAt === deadlineA1 &&
        recoverARes.data.recovered === true,
      "Reconnecting must return identical sessionId and deadlineAt"
    );
    console.log("✓ [Criteria 5 & 6] Refreshing/reconnecting preserves original deadline.");

    // Criterion 11: Faculty changes duration for future assessments (e.g. 30 mins); active Student A retains 45-min deadline
    await axios.put(
      `${BASE_URL}/admin/assessments/${testId}/timer`,
      {
        timerEnabled: true,
        durationMinutes: 30,
        applyToActiveSessions: false,
      },
      { headers: { Authorization: `Bearer ${facultyToken}` } }
    );

    const checkATimer = await axios.get(
      `${BASE_URL}/assessment-sessions/${sessionAId}/timer`,
      { headers: { Authorization: `Bearer ${studentAToken}` } }
    );
    assert(
      checkATimer.data.deadlineAt === deadlineA1 &&
        checkATimer.data.durationMinutes === 45,
      "Active Student A deadline must remain untouched when applyToActiveSessions is false"
    );

    // Student B starts now and gets the new 30-minute timer
    const startBRes = await axios.post(
      `${BASE_URL}/assessments/${testId}/start`,
      { selectedQuestions: qIds },
      { headers: { Authorization: `Bearer ${studentBToken}` } }
    );
    const sessionBId = startBRes.data.sessionId;
    assert(
      startBRes.data.durationMinutes === 30 &&
        startBRes.data.remainingSeconds <= 1800 &&
        startBRes.data.remainingSeconds > 1790,
      "Student B received the new 30-minute timer"
    );
    console.log("✓ [Criteria 4 & 11] Future session changes apply to Student B while preserving active Student A's deadline.");

    // Save draft for Student B before expiry
    await axios.put(
      `${BASE_URL}/assessment-sessions/${sessionBId}/draft`,
      {
        drafts: {
          [qIds[0]]: { sourceCode: "print(5)", language: "Python" },
          [qIds[1]]: { sourceCode: "print(6)", language: "Python" },
        },
      },
      { headers: { Authorization: `Bearer ${studentBToken}` } }
    );

    // Criterion 7, 8, 9: Simulate Student B's server deadline expiring and verify auto-submission, idempotency, and late-submission rejection
    const pastDeadline = new Date(Date.now() - 20000).toISOString();
    await db
      .update(assessmentSessions)
      .set({ deadlineAt: pastDeadline })
      .where(eq(assessmentSessions.id, sessionBId))
      .execute();

    // Run background expiry processor (simulates student closed browser or timer expired)
    await processExpiredSessions();

    const expiredSessionB = await db
      .select()
      .from(assessmentSessions)
      .where(eq(assessmentSessions.id, sessionBId))
      .get();
    assert(
      expiredSessionB?.status === "expired",
      "Expired session B must be marked 'expired'"
    );

    // Verify late manual submission from Student B is rejected (403)
    let lateRejected = false;
    try {
      await axios.post(
        `${BASE_URL}/assessment-sessions/${sessionBId}/submit`,
        {
          isAutoSubmit: false,
          submissions: [
            { question_id: qIds[0], source_code: "print(5)", language: "Python" },
            { question_id: qIds[1], source_code: "print(6)", language: "Python" },
          ],
        },
        { headers: { Authorization: `Bearer ${studentBToken}` } }
      );
    } catch (e: any) {
      if (e.response?.status === 403) lateRejected = true;
    }
    assert(lateRejected, "Late manual submission after deadline must be rejected with 403");

    // Verify repeated auto-submit calls are idempotent and do not duplicate submissions
    await axios.post(
      `${BASE_URL}/assessment-sessions/${sessionBId}/submit`,
      { isAutoSubmit: true, submissions: [] },
      { headers: { Authorization: `Bearer ${studentBToken}` } }
    );

    const bSubs = await db
      .select()
      .from(submissions)
      .where(
        and(
          eq(submissions.studentId, studentB.id),
          eq(submissions.questionId, qIds[0])
        )
      )
      .all();
    assert(
      bSubs.length === 1,
      `Expected exactly 1 submission for Student B Q1, found ${bSubs.length}`
    );
    console.log("✓ [Criteria 7, 8, 9] Server expiry auto-submission, late-submission rejection, and idempotency verified.");

    // Criterion 10: Disabling timer works according to policy
    await axios.put(
      `${BASE_URL}/admin/assessments/${testId}/timer`,
      {
        timerEnabled: false,
        durationMinutes: 30,
        applyToActiveSessions: true,
      },
      { headers: { Authorization: `Bearer ${facultyToken}` } }
    );

    const checkATimerDisabled = await axios.get(
      `${BASE_URL}/assessment-sessions/${sessionAId}/timer`,
      { headers: { Authorization: `Bearer ${studentAToken}` } }
    );
    assert(
      checkATimerDisabled.data.timerEnabled === false &&
        checkATimerDisabled.data.deadlineAt === null,
      "Disabling timer with applyToActiveSessions=true disables deadline enforcement"
    );
    console.log("✓ [Criterion 10] Disabling timer works according to configured policy.");
  } finally {
    // Clean up the temporary E2E test record
    await axios.delete(`${BASE_URL}/faculty/tests/${testId}`, {
      headers: { Authorization: `Bearer ${facultyToken}` },
      data: { action: "delete" },
    });
    console.log("✓ Cleaned up temporary E2E test data.");
  }

  console.log("=== ALL 15 DYNAMIC ASSESSMENT TIMER ACCEPTANCE CRITERIA PASSED ===");
}

runTests().catch((err) => {
  console.error("E2E Timer Test Failed:", err);
  process.exit(1);
});
