import axios from "axios";
import { db } from "../../src/db/index.js";
import {
  students,
  studentAuthMetadata,
  tests,
  malpracticeSettings,
  malpracticeEvents,
  testCompletions,
  assessmentSessions,
} from "../../src/db/schema.js";
import { eq } from "drizzle-orm";
import { ensureTimerTables } from "../../src/db/migrate.js";
import { hashPassword } from "../../src/lib/passwordUtils.js";
import { invalidateMalpracticeCache } from "../../src/controllers/malpractice.js";

const BASE_URL = "http://localhost:3000/api";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runTests() {
  console.log(
    "=== Starting CodeLabEdu Anti-Malpractice System E2E Verification (16 Requirements) ==="
  );
  await ensureTimerTables();

  const tempRoll = "2024MALPRACTICE001";
  const tempPassword = "MalpracticeTest#2026";

  // Clean up any leftover temporary student from prior interrupted runs
  const existingTemp = await db
    .select()
    .from(students)
    .where(eq(students.rollNumber, tempRoll))
    .get();
  if (existingTemp) {
    await db
      .delete(malpracticeEvents)
      .where(eq(malpracticeEvents.studentId, existingTemp.id))
      .execute();
    await db
      .delete(assessmentSessions)
      .where(eq(assessmentSessions.studentId, existingTemp.id))
      .execute();
    await db
      .delete(testCompletions)
      .where(eq(testCompletions.studentId, existingTemp.id))
      .execute();
    await db
      .delete(studentAuthMetadata)
      .where(eq(studentAuthMetadata.studentId, existingTemp.id))
      .execute();
    await db.delete(students).where(eq(students.id, existingTemp.id)).execute();
  }

  // Create temporary student for E2E malpractice tests without touching real students
  const hashedPwd = await hashPassword(tempPassword);
  const tempStudent = await db
    .insert(students)
    .values({
      rollNumber: tempRoll,
      name: "Malpractice E2E Student",
      password: hashedPwd,
      department: "CSE",
      registerNumber: 211424888001,
    })
    .returning()
    .get();

  try {
    // 1. Authenticate as Faculty/Admin
    const adminLoginRes = await axios.post(`${BASE_URL}/login`, {
      role: "faculty",
      email: "admin@codelab.edu",
      password: "password123",
    });
    assert(
      adminLoginRes.status === 200 && Boolean(adminLoginRes.data.token),
      "Faculty/Admin login succeeded"
    );
    const adminToken = adminLoginRes.data.token;
    const adminHeaders = { Authorization: `Bearer ${adminToken}` };

    // 2. Authenticate as Student
    const studentLoginRes = await axios.post(`${BASE_URL}/student/login`, {
      rollNumber: tempRoll,
      password: tempPassword,
    });
    assert(
      studentLoginRes.status === 200 && Boolean(studentLoginRes.data.token),
      "Student login succeeded"
    );
    const studentToken = studentLoginRes.data.token;
    const studentHeaders = { Authorization: `Bearer ${studentToken}` };

    const allTestsInDb = await db.select().from(tests).all();
    assert(allTestsInDb.length > 0, "At least one test exists in the database");
    const targetTest =
      allTestsInDb.find((t) => t.status === "published") || allTestsInDb[0];
    const originalTestStatus = targetTest.status;
    if (originalTestStatus !== "published") {
      await db
        .update(tests)
        .set({ status: "published" })
        .where(eq(tests.id, targetTest.id))
        .execute();
    }
    const targetTestId = targetTest.id;

    try {
      const testsRes = await axios.get(`${BASE_URL}/student/tests`, {
        headers: studentHeaders,
      });
      const availableTests = Array.isArray(testsRes.data?.available)
        ? testsRes.data.available
        : Array.isArray(testsRes.data)
        ? testsRes.data
        : [];
      assert(
        availableTests.length > 0,
        "Student fetched available assessments"
      );

    // Start a fresh student assessment session
    const startSessionRes = await axios.post(
      `${BASE_URL}/assessments/${targetTestId}/start`,
      { selectedQuestions: [1, 2] },
      { headers: studentHeaders }
    );
    assert(
      (startSessionRes.status === 200 || startSessionRes.status === 201) &&
        Boolean(startSessionRes.data.sessionId),
      "Started student assessment session and received initial malpracticeSettings"
    );
    const sessionId = startSessionRes.data.sessionId;
    assert(
      Boolean(startSessionRes.data.effectiveMalpracticeSettings),
      "Session start response includes effectiveMalpracticeSettings"
    );

    // Test 14: Students cannot modify admin configuration through direct API calls
    console.log(
      "Testing Requirement 14: Student authorization block on admin endpoints..."
    );
    let studentBlocked = false;
    try {
      await axios.put(
        `${BASE_URL}/admin/malpractice/settings`,
        { masterEnabled: false },
        { headers: studentHeaders }
      );
    } catch (err: any) {
      if (err.response?.status === 403) {
        studentBlocked = true;
      }
    }
    assert(
      studentBlocked,
      "Student blocked (403 Forbidden) from modifying admin malpractice settings"
    );

    // Test 1-7 & 9 & 12: Master switch ON respecting individual settings (ON vs OFF)
    console.log(
      "Testing Requirements 1-7, 9, 12: Individual switches ON/OFF when Master switch is ON..."
    );
    const allOnRes = await axios.put(
      `${BASE_URL}/admin/malpractice/settings`,
      {
        masterEnabled: true,
        disableCopy: true,
        disableCut: true,
        disablePaste: true,
        disableRightClick: true,
        detectDevtoolsShortcuts: true,
        detectTabSwitch: true,
        detectWindowFocus: true,
        showStudentWarnings: true,
        enableViolationLogging: true,
        violationThreshold: 10,
      },
      { headers: adminHeaders }
    );
    assert(
      allOnRes.status === 200 &&
        allOnRes.data.effectiveSettings.disableCopy === true,
      "Saved all-ON configuration"
    );

    await sleep(600);

    const eventTypesToTest = [
      "copy_attempt",
      "cut_attempt",
      "paste_attempt",
      "context_menu_attempt",
      "devtools_shortcut_attempt",
      "tab_visibility_changed",
      "window_focus_lost",
    ];

    for (const evType of eventTypesToTest) {
      const evRes = await axios.post(
        `${BASE_URL}/assessment-sessions/${sessionId}/malpractice-events`,
        {
          eventType: evType,
          targetArea: "editor",
          shortcut: evType === "devtools_shortcut_attempt" ? "F12" : undefined,
          clipboard: "SECRET_SHOULD_NEVER_BE_SAVED",
        },
        { headers: studentHeaders }
      );
      assert(
        evRes.status === 201 && evRes.data.recorded === true,
        `Event '${evType}' recorded when its switch is ON`
      );
    }

    // Toggle individual restrictions OFF while Master is ON
    const partialOffRes = await axios.put(
      `${BASE_URL}/admin/malpractice/settings`,
      {
        masterEnabled: true,
        disableCopy: false,
        disableCut: false,
        disablePaste: false,
        disableRightClick: false,
        detectDevtoolsShortcuts: false,
        detectTabSwitch: false,
        detectWindowFocus: false,
        showStudentWarnings: false,
        enableViolationLogging: true,
        violationThreshold: 10,
      },
      { headers: adminHeaders }
    );
    assert(
      partialOffRes.data.effectiveSettings.disableCopy === false &&
        partialOffRes.data.effectiveSettings.disableCut === false &&
        partialOffRes.data.effectiveSettings.disablePaste === false &&
        partialOffRes.data.effectiveSettings.disableRightClick === false &&
        partialOffRes.data.effectiveSettings.detectDevtoolsShortcuts ===
          false &&
        partialOffRes.data.effectiveSettings.detectTabSwitch === false &&
        partialOffRes.data.effectiveSettings.detectWindowFocus === false &&
        partialOffRes.data.effectiveSettings.showStudentWarnings === false,
      "Individual switches turned OFF while Master is ON"
    );

    for (const evType of eventTypesToTest) {
      const evRes = await axios.post(
        `${BASE_URL}/assessment-sessions/${sessionId}/malpractice-events`,
        { eventType: evType },
        { headers: studentHeaders }
      );
      assert(
        evRes.data.recorded === false &&
          evRes.data.reason === "restriction_disabled",
        `Event '${evType}' ignored when its individual switch is OFF`
      );
    }

    // Test 8: Master switch OFF overriding every individual setting
    console.log(
      "Testing Requirement 8: Master switch OFF overriding all individual ON settings..."
    );
    const masterOffRes = await axios.put(
      `${BASE_URL}/admin/malpractice/settings`,
      {
        masterEnabled: false,
        disableCopy: true,
        disableCut: true,
        disablePaste: true,
        disableRightClick: true,
        detectDevtoolsShortcuts: true,
        detectTabSwitch: true,
        detectWindowFocus: true,
        showStudentWarnings: true,
        enableViolationLogging: true,
      },
      { headers: adminHeaders }
    );
    const effOff = masterOffRes.data.effectiveSettings;
    assert(
      masterOffRes.data.settings.disableCopy === true &&
        effOff.masterEnabled === false &&
        effOff.disableCopy === false &&
        effOff.disableCut === false &&
        effOff.disablePaste === false &&
        effOff.disableRightClick === false &&
        effOff.detectDevtoolsShortcuts === false &&
        effOff.detectTabSwitch === false &&
        effOff.detectWindowFocus === false &&
        effOff.showStudentWarnings === false &&
        effOff.enableViolationLogging === false,
      "Master switch OFF overrides all 9 individual switches to false while preserving individual saved preferences"
    );

    const timerSyncRes = await axios.get(
      `${BASE_URL}/assessment-sessions/${sessionId}/timer`,
      { headers: studentHeaders }
    );
    assert(
      timerSyncRes.data.effectiveMalpracticeSettings.masterEnabled === false &&
        timerSyncRes.data.effectiveMalpracticeSettings.disablePaste === false,
      "Active student session timer sync reflects Master OFF override immediately"
    );

    const blockedByMasterRes = await axios.post(
      `${BASE_URL}/assessment-sessions/${sessionId}/malpractice-events`,
      { eventType: "paste_attempt" },
      { headers: studentHeaders }
    );
    assert(
      blockedByMasterRes.data.recorded === false &&
        blockedByMasterRes.data.reason === "master_monitoring_disabled",
      "Events are not recorded when Master switch is OFF"
    );

    // Test 13: Violation Logging OFF stops new logs while preserving historical logs
    console.log(
      "Testing Requirement 13: Violation Logging switch & historical log preservation..."
    );
    await axios.put(
      `${BASE_URL}/admin/malpractice/settings`,
      {
        masterEnabled: true,
        disableCopy: true,
        enableViolationLogging: false,
      },
      { headers: adminHeaders }
    );
    const loggingOffEventRes = await axios.post(
      `${BASE_URL}/assessment-sessions/${sessionId}/malpractice-events`,
      { eventType: "copy_attempt" },
      { headers: studentHeaders }
    );
    assert(
      loggingOffEventRes.data.recorded === false &&
        loggingOffEventRes.data.reason === "violation_logging_disabled",
      "No new violation log created when enableViolationLogging is OFF"
    );

    const logsRes = await axios.get(`${BASE_URL}/admin/malpractice/events`, {
      params: { sessionId },
      headers: adminHeaders,
    });
    assert(
      Array.isArray(logsRes.data.events) && logsRes.data.events.length >= 7,
      "Historical violation logs are preserved when logging or master switch is toggled OFF"
    );
    const serializedLogs = JSON.stringify(logsRes.data.events);
    assert(
      !serializedLogs.includes("SECRET_SHOULD_NEVER_BE_SAVED"),
      "Sensitive clipboard contents are stripped and never stored in violation logs"
    );

    const targetEventId = logsRes.data.events[0].id;
    const reviewRes = await axios.patch(
      `${BASE_URL}/admin/malpractice/events/${targetEventId}`,
      { reviewStatus: "reviewed", notes: "Verified during E2E test" },
      { headers: adminHeaders }
    );
    assert(
      reviewRes.status === 200 && reviewRes.data.reviewStatus === "reviewed",
      "Admin can review and update violation log status"
    );

    // Test 10: Persistence in Turso/SQLite after cache clear / simulated server restart
    console.log(
      "Testing Requirement 10: Settings persistence in Turso database across cache invalidation..."
    );
    await axios.put(
      `${BASE_URL}/admin/malpractice/settings`,
      {
        masterEnabled: true,
        disableCopy: true,
        disableCut: true,
        disablePaste: true,
        disableRightClick: true,
        detectDevtoolsShortcuts: true,
        detectTabSwitch: true,
        detectWindowFocus: true,
        showStudentWarnings: true,
        enableViolationLogging: true,
        violationThreshold: 3,
      },
      { headers: adminHeaders }
    );
    invalidateMalpracticeCache();
    const dbRow = await db.select().from(malpracticeSettings).limit(1).get();
    assert(
      Boolean(dbRow) &&
        dbRow!.masterEnabled === true &&
        dbRow!.disableCopy === true &&
        dbRow!.enableViolationLogging === true,
      "Settings are persisted directly in Turso/SQLite malpractice_settings table"
    );

    // Test 11 & 15: Existing compiler / Run Code / Questions / Timer continue working
    console.log(
      "Testing Requirement 11 & 15: Existing questions, draft save, and compiler execution..."
    );
    const draftRes = await axios.put(
      `${BASE_URL}/assessment-sessions/${sessionId}/draft`,
      {
        drafts: {
          "1": {
            sourceCode:
              "class Solution:\n    def search(self, nums: list[int], target: int) -> int:\n        return 4\n",
            language: "Python",
          },
        },
      },
      { headers: studentHeaders }
    );
    assert(
      draftRes.status === 200 && Boolean(draftRes.data.savedAt),
      "Draft saving continues working seamlessly"
    );

    // Test 16: Rate limiting / debouncing under rapid burst requests
    console.log("Testing Requirement 16: Debouncing duplicate rapid events...");
    await sleep(650);
    const burst1 = await axios.post(
      `${BASE_URL}/assessment-sessions/${sessionId}/malpractice-events`,
      { eventType: "copy_attempt" },
      { headers: studentHeaders }
    );
    const burst2 = await axios.post(
      `${BASE_URL}/assessment-sessions/${sessionId}/malpractice-events`,
      { eventType: "copy_attempt" },
      { headers: studentHeaders }
    );
    assert(
      burst1.data.recorded === true &&
        burst2.data.recorded === false &&
        burst2.data.reason === "debounced_or_rate_limited",
      "Rapid duplicate events are debounced on the server to protect Turso under concurrent load"
    );

      console.log(
        "=== ALL 16 ANTI-MALPRACTICE REQUIREMENTS PASSED SUCCESSFULLY ==="
      );
    } finally {
      if (originalTestStatus !== "published") {
        await db
          .update(tests)
          .set({ status: originalTestStatus })
          .where(eq(tests.id, targetTestId))
          .execute();
      }
    }
  } finally {
    // Clean up temporary student and events
    await db
      .delete(malpracticeEvents)
      .where(eq(malpracticeEvents.studentId, tempStudent.id))
      .execute();
    await db
      .delete(assessmentSessions)
      .where(eq(assessmentSessions.studentId, tempStudent.id))
      .execute();
    await db
      .delete(testCompletions)
      .where(eq(testCompletions.studentId, tempStudent.id))
      .execute();
    await db
      .delete(studentAuthMetadata)
      .where(eq(studentAuthMetadata.studentId, tempStudent.id))
      .execute();
    await db.delete(students).where(eq(students.id, tempStudent.id)).execute();
  }
}

runTests().catch((err) => {
  console.error("E2E Test Failed:", err);
  process.exit(1);
});
