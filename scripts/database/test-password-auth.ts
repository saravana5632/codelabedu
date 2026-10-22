import axios from "axios";
import jwt from "jsonwebtoken";
import { db, client } from "../../src/db/index.js";
import {
  students,
  faculty,
  tests,
  questions,
  submissions,
} from "../../src/db/schema.js";
import { eq } from "drizzle-orm";
import {
  ensureTimerTables,
  migrateStudentCredentials,
} from "../../src/db/migrate.js";
import {
  isBcryptHash,
  isPasswordSetupRequired,
  SETUP_REQUIRED_SENTINEL,
} from "../../src/lib/passwordUtils.js";
import { clearAllLoginRateLimits } from "../../src/controllers/auth.js";

const BASE_URL = process.env.TEST_BASE_URL || "http://127.0.0.1:3000/api";
const JWT_SECRET = process.env.JWT_SECRET || "codelab-secret-key-123";

function assert(condition: any, message: string) {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

async function runAuthTests() {
  console.log(
    "=== Starting CodeLabEdu Password Authentication & Turso Schema E2E Verification (25 Test Cases) ==="
  );
  await ensureTimerTables();
  clearAllLoginRateLimits();

  // Verify actual SQLite/Turso table columns on `students`
  const tableInfo = await client.execute("PRAGMA table_info(students)");
  const colNames = tableInfo.rows.map((r: any) => String(r.name));
  console.log(`[SCHEMA] students columns: ${colNames.join(", ")}`);
  assert(
    colNames.includes("id") &&
      colNames.includes("roll_number") &&
      colNames.includes("name") &&
      colNames.includes("password") &&
      colNames.includes("department") &&
      colNames.includes("register_number"),
    "students table must have id, roll_number, name, password, department, register_number"
  );
  assert(
    !colNames.includes("dob"),
    "Legacy dob column must not be required on students table"
  );

  // Prepare Faculty Token for Admin operations
  const fac = await db.select().from(faculty).limit(1).get();
  assert(fac, "Faculty user must exist");
  const facultyToken = jwt.sign({ id: fac!.id, role: "faculty" }, JWT_SECRET, {
    expiresIn: "1h",
  });

  // Clean up any leftover test student records from previous runs
  const testRoll1 = "2024AUTHTEST001";
  const testRoll2 = "2024AUTHTEST002";
  const testRoll3 = "2024AUTHTEST003";
  for (const r of [testRoll1, testRoll2, testRoll3]) {
    const existing = await db
      .select()
      .from(students)
      .where(eq(students.rollNumber, r))
      .get();
    if (existing) {
      await client.execute({
        sql: "DELETE FROM student_auth_metadata WHERE student_id = ?",
        args: [existing.id],
      });
      await db.delete(students).where(eq(students.id, existing.id)).execute();
    }
  }

  try {
    // =========================================================================
    // Test 9, 10, 13, 14: Safe Migration of Case A (hashed), Case B (plaintext), Case C (DOB/empty) & Foreign Key Preservation
    // =========================================================================
    console.log(
      "\n[Tests 9, 10, 13, 14] Verifying safe credential migration (Case A hashed, Case B plaintext, Case C legacy DOB) and foreign key preservation..."
    );

    // Insert a student with a plaintext non-DOB password in DB (Case B) and a student with a legacy DOB string in password (Case C)
    const caseBStudent = await db
      .insert(students)
      .values({
        rollNumber: testRoll2,
        name: "Case B Plaintext Student",
        password: "InitialPlainPassword#2026",
        department: "CSE",
        registerNumber: 211424999002,
      })
      .returning()
      .get();

    const caseCStudent = await db
      .insert(students)
      .values({
        rollNumber: testRoll3,
        name: "Case C Legacy DOB Student",
        password: "18-04-2007", // Legacy DOB value! Must NOT become a valid password
        department: "CSBS",
        registerNumber: 211424999003,
      })
      .returning()
      .get();

    // Link a submission to caseBStudent to verify foreign key & ID preservation across migration
    const sampleQuestion = await db.select().from(questions).limit(1).get();
    let linkedSubId: number | null = null;
    if (sampleQuestion) {
      const sub = await db
        .insert(submissions)
        .values({
          studentId: caseBStudent.id,
          questionId: sampleQuestion.id,
          language: "Python",
          sourceCode: "print(1)",
          output: "1",
          status: "Accepted",
          submittedAt: new Date().toISOString(),
        })
        .returning()
        .get();
      linkedSubId = sub.id;
    }

    // Run migration
    await migrateStudentCredentials();

    const migratedB = await db
      .select()
      .from(students)
      .where(eq(students.id, caseBStudent.id))
      .get();
    const migratedC = await db
      .select()
      .from(students)
      .where(eq(students.id, caseCStudent.id))
      .get();

    assert(
      migratedB && migratedB.id === caseBStudent.id,
      "Student ID must be preserved after migration (Test 13)"
    );
    assert(
      isBcryptHash(migratedB!.password) &&
        migratedB!.password !== "InitialPlainPassword#2026",
      "Case B plaintext password must be converted to a bcrypt hash and never left in plaintext (Tests 9, 10)"
    );
    assert(
      migratedC &&
        migratedC.password === SETUP_REQUIRED_SENTINEL &&
        isPasswordSetupRequired(migratedC.password),
      "Case C legacy DOB value must NEVER be converted to a valid password and must require setup (Test 6, 10)"
    );

    if (linkedSubId) {
      const checkSub = await db
        .select()
        .from(submissions)
        .where(eq(submissions.id, linkedSubId))
        .get();
      assert(
        checkSub && checkSub.studentId === caseBStudent.id,
        "Existing student submission remains linked to exact same student ID (Test 14)"
      );
      await db
        .delete(submissions)
        .where(eq(submissions.id, linkedSubId))
        .execute();
    }
    console.log("✓ Tests 9, 10, 13, 14 passed.");

    // =========================================================================
    // Test 12 & 11: Faculty Student Creation, Duplicate Roll Number Rejection & No Password Hash Exposure
    // =========================================================================
    console.log(
      "\n[Tests 11, 12] Verifying student creation, duplicate roll_number rejection, and zero password exposure in API responses..."
    );
    const createStudentRes = await axios.post(
      `${BASE_URL}/faculty/students`,
      {
        rollNumber: testRoll1,
        name: "Auth Test Student One",
        department: "Computer Science and Business Systems",
        registerNumber: 211424999001,
        password: " MySecurePass!123 ", // Note leading/trailing space to test exact password preservation (Test 8)
      },
      { headers: { Authorization: `Bearer ${facultyToken}` } }
    );
    assert(
      createStudentRes.status === 201 && createStudentRes.data.student,
      "Student creation should return 201"
    );
    assert(
      createStudentRes.data.student.password === undefined,
      "POST /faculty/students response must never include password or hash (Test 11)"
    );

    const listStudentsRes = await axios.get(`${BASE_URL}/faculty/students`, {
      headers: { Authorization: `Bearer ${facultyToken}` },
    });
    assert(
      Array.isArray(listStudentsRes.data) &&
        listStudentsRes.data.every((s: any) => s.password === undefined),
      "GET /faculty/students must never return password hashes (Test 11)"
    );

    let duplicateRejected = false;
    try {
      await axios.post(
        `${BASE_URL}/faculty/students`,
        {
          rollNumber: testRoll1,
          name: "Duplicate Student",
          department: "CSE",
          registerNumber: 211424999999,
          password: "AnotherValidPassword123",
        },
        { headers: { Authorization: `Bearer ${facultyToken}` } }
      );
    } catch (err: any) {
      if (err.response?.status === 409) duplicateRejected = true;
    }
    assert(duplicateRejected, "Duplicate roll_number must be rejected with 409 (Test 12)");
    console.log("✓ Tests 11, 12 passed.");

    // =========================================================================
    // Tests 1, 2, 3, 4, 5, 6, 7, 8: Login Validation, Trimming, Exact Password & Generic Errors
    // =========================================================================
    console.log(
      "\n[Tests 1-8] Verifying login with valid credentials, wrong password, invalid roll_number, empty inputs, DOB rejection, roll_number trimming, and password whitespace preservation..."
    );

    // Test 4: Empty roll_number
    let emptyRollFailed = false;
    try {
      await axios.post(`${BASE_URL}/login`, {
        loginType: "student",
        rollNumber: "   ",
        password: "somepassword",
      });
    } catch (err: any) {
      if (err.response?.status === 400) emptyRollFailed = true;
    }
    assert(emptyRollFailed, "Empty roll_number must fail validation with 400 (Test 4)");

    // Test 5: Empty password
    let emptyPwdFailed = false;
    try {
      await axios.post(`${BASE_URL}/login`, {
        loginType: "student",
        rollNumber: testRoll1,
        password: "",
      });
    } catch (err: any) {
      if (err.response?.status === 400) emptyPwdFailed = true;
    }
    assert(emptyPwdFailed, "Empty password must fail validation with 400 (Test 5)");

    // Test 6: Legacy DOB login attempt
    let dobLoginFailed = false;
    try {
      await axios.post(`${BASE_URL}/login`, {
        loginType: "student",
        rollNumber: testRoll3,
        dob: "18-04-2007",
      });
    } catch (err: any) {
      if (err.response?.status === 400 || err.response?.status === 401) {
        dobLoginFailed = true;
      }
    }
    assert(dobLoginFailed, "Legacy DOB login payload must be rejected (Test 6)");

    // Also try sending DOB value as password for Case C student
    let dobAsPwdFailed = false;
    try {
      await axios.post(`${BASE_URL}/login`, {
        loginType: "student",
        rollNumber: testRoll3,
        password: "18-04-2007",
      });
    } catch (err: any) {
      if (err.response?.status === 403 || err.response?.status === 401) {
        dobAsPwdFailed = true;
      }
    }
    assert(
      dobAsPwdFailed,
      "Legacy DOB string used as password must be rejected (Test 6)"
    );

    // Test 2: Valid roll_number and wrong password
    let wrongPwdMsg = "";
    let wrongPwdStatus = 0;
    try {
      await axios.post(`${BASE_URL}/login`, {
        loginType: "student",
        rollNumber: testRoll1,
        password: "WrongPassword999",
      });
    } catch (err: any) {
      wrongPwdStatus = err.response?.status;
      wrongPwdMsg = err.response?.data?.message;
    }
    assert(
      wrongPwdStatus === 401 &&
        wrongPwdMsg === "Invalid roll number or password",
      `Expected generic 401 'Invalid roll number or password' for wrong password, got ${wrongPwdStatus}: ${wrongPwdMsg} (Test 2)`
    );

    // Test 3: Invalid roll_number and any password
    let badRollMsg = "";
    let badRollStatus = 0;
    try {
      await axios.post(`${BASE_URL}/login`, {
        loginType: "student",
        rollNumber: "NON_EXISTENT_ROLL_999",
        password: "AnyPassword123",
      });
    } catch (err: any) {
      badRollStatus = err.response?.status;
      badRollMsg = err.response?.data?.message;
    }
    assert(
      badRollStatus === 401 && badRollMsg === "Invalid roll number or password",
      `Expected identical generic 401 'Invalid roll number or password' for non-existent roll_number, got ${badRollStatus}: ${badRollMsg} (Test 3)`
    );

    // Test 8: Stripping whitespace from password should FAIL because password had intentional spaces " MySecurePass!123 "
    let trimmedPwdFailed = false;
    try {
      await axios.post(`${BASE_URL}/login`, {
        loginType: "student",
        rollNumber: testRoll1,
        password: "MySecurePass!123", // missing the spaces!
      });
    } catch (err: any) {
      if (err.response?.status === 401) trimmedPwdFailed = true;
    }
    assert(
      trimmedPwdFailed,
      "Password whitespace must NOT be stripped before comparison (Test 8)"
    );

    // Test 1 & Test 7: Valid login with leading/trailing spaces in roll_number and exact password
    const validLoginRes = await axios.post(`${BASE_URL}/login`, {
      loginType: "student",
      rollNumber: `  ${testRoll1}  `,
      password: " MySecurePass!123 ",
    });
    assert(
      validLoginRes.status === 200 &&
        validLoginRes.data.success === true &&
        validLoginRes.data.token &&
        validLoginRes.data.user.rollNumber === testRoll1 &&
        validLoginRes.data.user.password === undefined,
      "Valid login with trimmed roll_number and exact password must succeed without exposing password (Tests 1, 7, 8, 11)"
    );

    // Also verify Case B migrated student can log in with their migrated password
    const caseBLoginRes = await axios.post(`${BASE_URL}/student/login`, {
      rollNumber: testRoll2,
      password: "InitialPlainPassword#2026",
    });
    assert(
      caseBLoginRes.status === 200 && caseBLoginRes.data.token,
      "Case B student whose plaintext password was migrated to bcrypt hash must be able to log in"
    );
    console.log("✓ Tests 1-8 passed.");

    // =========================================================================
    // Tests 15, 17, 18, 25: Session Persistence, Protected Routes, Invalid Tokens & Assessment Workflow
    // =========================================================================
    console.log(
      "\n[Tests 15, 17, 18, 25] Verifying session persistence, protected student endpoints, tampered token rejection, and assessment/compiler access..."
    );
    const activeToken = validLoginRes.data.token;

    // Test 15: Session works on /api/me
    const meRes = await axios.get(`${BASE_URL}/me`, {
      headers: { Authorization: `Bearer ${activeToken}` },
    });
    assert(
      meRes.status === 200 &&
        meRes.data.rollNumber === testRoll1 &&
        meRes.data.registerNumber === 211424999001 &&
        meRes.data.password === undefined,
      "GET /api/me must return authenticated student profile without password (Test 15)"
    );

    // Test 18: Unauthenticated access to protected student routes is blocked
    let unauthBlocked = false;
    try {
      await axios.get(`${BASE_URL}/student/tests`);
    } catch (err: any) {
      if (err.response?.status === 401) unauthBlocked = true;
    }
    assert(
      unauthBlocked,
      "Unauthenticated access to /api/student/tests must be blocked with 401 (Test 18)"
    );

    // Test 17: Tampered or expired token is rejected
    const expiredToken = jwt.sign(
      { id: validLoginRes.data.user.id, role: "student", tokenVersion: 1 },
      JWT_SECRET,
      { expiresIn: "-10s" }
    );
    let expiredBlocked = false;
    try {
      await axios.get(`${BASE_URL}/me`, {
        headers: { Authorization: `Bearer ${expiredToken}` },
      });
    } catch (err: any) {
      if (err.response?.status === 401) expiredBlocked = true;
    }
    assert(
      expiredBlocked,
      "Expired/tampered token must be rejected with 401 (Test 17)"
    );

    // Test 25: Authenticated student can access tests and run code
    const studentTestsRes = await axios.get(`${BASE_URL}/student/tests`, {
      headers: { Authorization: `Bearer ${activeToken}` },
    });
    assert(
      studentTestsRes.status === 200 &&
        Array.isArray(studentTestsRes.data.available),
      "Authenticated student can fetch available assessments (Test 25)"
    );

    if (sampleQuestion) {
      const qDetailRes = await axios.get(
        `${BASE_URL}/student/questions/${sampleQuestion.id}`,
        { headers: { Authorization: `Bearer ${activeToken}` } }
      );
      assert(
        qDetailRes.status === 200 && qDetailRes.data.id === sampleQuestion.id,
        "Authenticated student can load question details (Test 25)"
      );
    }
    console.log("✓ Tests 15, 17, 18, 25 passed.");

    // =========================================================================
    // Tests 19, 20, 21: Authenticated Password Change Workflow
    // =========================================================================
    console.log(
      "\n[Tests 19, 20, 21] Verifying authenticated password change, wrong current password rejection, and immediate old password/token invalidation..."
    );

    // Test 20: Wrong current password fails
    let wrongCurrentFailed = false;
    try {
      await axios.post(
        `${BASE_URL}/auth/change-password`,
        {
          currentPassword: "WrongCurrentPassword!",
          newPassword: "UpdatedStrongPass#456",
          confirmPassword: "UpdatedStrongPass#456",
        },
        { headers: { Authorization: `Bearer ${activeToken}` } }
      );
    } catch (err: any) {
      if (err.response?.status === 401) wrongCurrentFailed = true;
    }
    assert(
      wrongCurrentFailed,
      "Password change with wrong current password must fail with 401 (Test 20)"
    );

    // Test 19: Correct current password succeeds
    const changePwdRes = await axios.post(
      `${BASE_URL}/auth/change-password`,
      {
        currentPassword: " MySecurePass!123 ",
        newPassword: "UpdatedStrongPass#456",
        confirmPassword: "UpdatedStrongPass#456",
      },
      { headers: { Authorization: `Bearer ${activeToken}` } }
    );
    assert(
      changePwdRes.status === 200 &&
        changePwdRes.data.success === true &&
        changePwdRes.data.token,
      "Password change with correct current password must succeed (Test 19)"
    );

    // Old token prior to password change must be invalidated
    let oldTokenInvalidatedAfterChange = false;
    try {
      await axios.get(`${BASE_URL}/me`, {
        headers: { Authorization: `Bearer ${activeToken}` },
      });
    } catch (err: any) {
      if (err.response?.status === 401) oldTokenInvalidatedAfterChange = true;
    }
    assert(
      oldTokenInvalidatedAfterChange,
      "Old JWT issued before password change must be invalidated"
    );

    // Test 21: Old password stops working, new password works
    let oldPwdFailed = false;
    try {
      await axios.post(`${BASE_URL}/login`, {
        loginType: "student",
        rollNumber: testRoll1,
        password: " MySecurePass!123 ",
      });
    } catch (err: any) {
      if (err.response?.status === 401) oldPwdFailed = true;
    }
    assert(
      oldPwdFailed,
      "Old password must stop working after password change (Test 21)"
    );

    const newPwdLoginRes = await axios.post(`${BASE_URL}/login`, {
      loginType: "student",
      rollNumber: testRoll1,
      password: "UpdatedStrongPass#456",
    });
    assert(
      newPwdLoginRes.status === 200 && newPwdLoginRes.data.token,
      "New password must work immediately after password change (Test 21)"
    );
    console.log("✓ Tests 19, 20, 21 passed.");

    // =========================================================================
    // Test 16: Logout Invalidates Token
    // =========================================================================
    console.log("\n[Test 16] Verifying logout invalidates active student JWT...");
    const tokenToLogout = newPwdLoginRes.data.token;
    const logoutRes = await axios.post(
      `${BASE_URL}/auth/logout`,
      {},
      { headers: { Authorization: `Bearer ${tokenToLogout}` } }
    );
    assert(logoutRes.status === 200, "Logout endpoint must return 200");

    let loggedOutTokenRejected = false;
    try {
      await axios.get(`${BASE_URL}/me`, {
        headers: { Authorization: `Bearer ${tokenToLogout}` },
      });
    } catch (err: any) {
      if (err.response?.status === 401) loggedOutTokenRejected = true;
    }
    assert(
      loggedOutTokenRejected,
      "Token must be rejected by protected endpoints after logout (Test 16)"
    );
    console.log("✓ Test 16 passed.");

    // =========================================================================
    // Tests 22 & 23: Uninitialized Account First-Time Setup & Faculty Password Reset
    // =========================================================================
    console.log(
      "\n[Tests 22, 23] Verifying uninitialized account login block, first-time setup with Register Number, and faculty password reset..."
    );

    // Case C student (testRoll3) currently has SETUP_REQUIRED_SENTINEL
    let uninitBlockedWithSetupCode = false;
    try {
      await axios.post(`${BASE_URL}/login`, {
        loginType: "student",
        rollNumber: testRoll3,
        password: "AnyAttemptedPassword123",
      });
    } catch (err: any) {
      if (
        err.response?.status === 403 &&
        err.response?.data?.requiresPasswordSetup === true
      ) {
        uninitBlockedWithSetupCode = true;
      }
    }
    assert(
      uninitBlockedWithSetupCode,
      "Uninitialized account must return 403 requiresPasswordSetup: true on login attempt (Test 22)"
    );

    // Wrong register_number must be rejected during initialization
    let wrongRegRejected = false;
    try {
      await axios.post(`${BASE_URL}/auth/initialize-password`, {
        rollNumber: testRoll3,
        registerNumber: 999999999999,
        newPassword: "FirstTimeSetupPass!99",
        confirmPassword: "FirstTimeSetupPass!99",
      });
    } catch (err: any) {
      if (err.response?.status === 401) wrongRegRejected = true;
    }
    assert(
      wrongRegRejected,
      "First-time password setup with wrong Register Number must be rejected with 401 (Test 22)"
    );

    // Correct register_number initializes the password and returns a valid token
    const initRes = await axios.post(`${BASE_URL}/auth/initialize-password`, {
      rollNumber: testRoll3,
      registerNumber: 211424999003,
      newPassword: "FirstTimeSetupPass!99",
      confirmPassword: "FirstTimeSetupPass!99",
    });
    assert(
      initRes.status === 200 &&
        initRes.data.success === true &&
        initRes.data.token,
      "First-time password setup with valid Roll Number + Register Number must succeed (Test 22)"
    );

    // Attempting to re-initialize an already-initialized account without admin reset must be blocked with 403
    let reinitBlocked = false;
    try {
      await axios.post(`${BASE_URL}/auth/initialize-password`, {
        rollNumber: testRoll3,
        registerNumber: 211424999003,
        newPassword: "HijackAttemptPass!00",
        confirmPassword: "HijackAttemptPass!00",
      });
    } catch (err: any) {
      if (err.response?.status === 403) reinitBlocked = true;
    }
    assert(
      reinitBlocked,
      "Re-initializing an already-initialized account must be blocked with 403 (Test 22)"
    );

    // Test 23: Faculty/Admin resets student password directly
    const adminResetRes = await axios.post(
      `${BASE_URL}/faculty/students/${caseCStudent.id}/reset-password`,
      {
        mode: "set_password",
        newPassword: "AdminAssignedPass#777",
      },
      { headers: { Authorization: `Bearer ${facultyToken}` } }
    );
    assert(
      adminResetRes.status === 200 &&
        adminResetRes.data.student.hasPasswordInitialized === true,
      "Admin password reset must succeed (Test 23)"
    );

    // Student can now log in with the admin-assigned password
    const afterAdminResetLogin = await axios.post(`${BASE_URL}/login`, {
      loginType: "student",
      rollNumber: testRoll3,
      password: "AdminAssignedPass#777",
    });
    assert(
      afterAdminResetLogin.status === 200 && afterAdminResetLogin.data.token,
      "Student can log in with admin-reset password (Test 23)"
    );
    console.log("✓ Tests 22, 23 passed.");

    // =========================================================================
    // Test 24: Login Rate Limiting Blocks Brute-Force Attempts
    // =========================================================================
    console.log(
      "\n[Test 24] Verifying login rate limiting blocks repeated failed attempts with 429..."
    );
    clearAllLoginRateLimits();
    let rateLimited = false;
    for (let i = 0; i < 10; i++) {
      try {
        await axios.post(`${BASE_URL}/login`, {
          loginType: "student",
          rollNumber: testRoll1,
          password: `BruteForceWrongPass_${i}`,
        });
      } catch (err: any) {
        if (err.response?.status === 429) {
          rateLimited = true;
          break;
        }
      }
    }
    assert(
      rateLimited,
      "Repeated failed login attempts must trigger 429 Too Many Requests (Test 24)"
    );
    clearAllLoginRateLimits();
    console.log("✓ Test 24 passed.");

    console.log(
      "\n=== ALL 25 PASSWORD AUTHENTICATION & TURSO INTEGRATION TESTS PASSED ==="
    );
  } finally {
    clearAllLoginRateLimits();
    for (const r of [testRoll1, testRoll2, testRoll3]) {
      const existing = await db
        .select()
        .from(students)
        .where(eq(students.rollNumber, r))
        .get();
      if (existing) {
        await client.execute({
          sql: "DELETE FROM student_auth_metadata WHERE student_id = ?",
          args: [existing.id],
        });
        await db.delete(students).where(eq(students.id, existing.id)).execute();
      }
    }
  }
}

runAuthTests().catch((err) => {
  console.error("AUTH E2E TEST FAILED:", err);
  process.exit(1);
});
