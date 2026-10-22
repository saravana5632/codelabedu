import { Response } from "express";
import { db } from "../db/index.js";
import {
  tests,
  questions,
  questionTestCases,
  submissions,
  students,
  submissionStatistics,
  testAnalytics,
  testCompletions,
  assessmentTimerConfigs,
  assessmentSessions,
} from "../db/schema.js";
import { eq, desc, inArray, asc, and, ne } from "drizzle-orm";
import { AuthRequest } from "../middleware/authMiddleware.js";
import { ensureTimerTables } from "../db/migrate.js";
import { getOrCreateTimerConfig, processExpiredSessions } from "./timer.js";
import {
  FunctionConfig,
  QuestionExample,
  TestCaseRecord,
  validateFunctionConfig,
  generateAllStarterCodes,
  validateStarterCodeMap,
  normalizeTestCaseInputToJson,
  validateExpectedOutput,
  formatArgsForDisplay,
} from "../lib/leetcodeHarness.js";
import {
  getQuestionTestCasesFromDb,
  parseQuestionJsonField,
} from "../lib/codeEvaluator.js";
import {
  SETUP_REQUIRED_SENTINEL,
  sanitizeStudentRecord,
  validatePasswordPolicy,
  hashPassword,
  isPasswordSetupRequired,
} from "../lib/passwordUtils.js";
import { incrementStudentTokenVersion } from "./auth.js";

function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function hydrateAdminQuestion(q: any) {
  const testCases = await getQuestionTestCasesFromDb(q.id);
  const examples = parseQuestionJsonField<QuestionExample[]>(q.examples, []);
  const functionConfig = parseQuestionJsonField<FunctionConfig | null>(
    q.functionConfig,
    null
  );
  const starterCode = parseQuestionJsonField<Record<string, string>>(
    q.starterCode,
    {}
  );

  return {
    ...q,
    status: q.status || "published",
    topic: q.topic || "Algorithms",
    maxMarks: q.maxMarks ?? 50,
    timeLimitSeconds: q.timeLimitSeconds ?? 2.0,
    memoryLimitMb: q.memoryLimitMb ?? 128,
    examples,
    functionConfig,
    starterCode,
    testCases,
    publicTestCasesCount: testCases.filter((tc) => tc.visibility === "public")
      .length,
    privateTestCasesCount: testCases.filter((tc) => tc.visibility === "private")
      .length,
    totalTestCasesCount: testCases.length,
  };
}

// ==========================================
// STUDENT & CREDENTIAL MANAGEMENT (FACULTY / ADMIN)
// ==========================================

export const getAllStudents = async (req: AuthRequest, res: Response) => {
  try {
    await ensureTimerTables();
    const allStudents = await db
      .select()
      .from(students)
      .orderBy(asc(students.rollNumber))
      .all();
    return res.json(allStudents.map((s) => sanitizeStudentRecord(s)));
  } catch (error) {
    console.error("Get students error:", error);
    return res.status(500).json({
      message: "Error fetching students",
    });
  }
};

export const createStudent = async (req: AuthRequest, res: Response) => {
  try {
    await ensureTimerTables();
    const body = req.body || {};
    const rawRollNumber = body.rollNumber ?? body.roll_number;
    const rawName = body.name;
    const rawDepartment = body.department;
    const rawRegisterNumber = body.registerNumber ?? body.register_number;
    const rawPassword = body.password;

    const rollNumber =
      typeof rawRollNumber === "string" ? rawRollNumber.trim() : "";
    const name = typeof rawName === "string" ? rawName.trim() : "";
    const department =
      typeof rawDepartment === "string" && rawDepartment.trim()
        ? rawDepartment.trim()
        : "Computer Science and Business Systems";
    const registerNumber = Number(rawRegisterNumber);

    if (
      !rollNumber ||
      !name ||
      !department ||
      isNaN(registerNumber) ||
      registerNumber <= 0
    ) {
      return res.status(400).json({
        message:
          "Roll number, name, department, and a positive register number are required",
      });
    }

    const existing = await db
      .select()
      .from(students)
      .where(eq(students.rollNumber, rollNumber))
      .get();

    if (existing) {
      return res.status(409).json({
        message: `A student with Roll Number "${rollNumber}" already exists`,
      });
    }

    let storedPassword = "";
    if (typeof rawPassword === "string" && rawPassword.length > 0) {
      const policyCheck = validatePasswordPolicy(rawPassword, {
        rollNumber,
        name,
        registerNumber,
      });
      if (!policyCheck.valid) {
        return res.status(400).json({
          message: policyCheck.message,
        });
      }
      storedPassword = await hashPassword(rawPassword);
    } else {
      storedPassword = await hashPassword(String(registerNumber));
    }

    const created = await db
      .insert(students)
      .values({
        rollNumber,
        name,
        password: storedPassword,
        department,
        registerNumber,
      })
      .returning()
      .get();

    await incrementStudentTokenVersion(created.id, true);

    return res.status(201).json({
      message: "Student created successfully",
      student: sanitizeStudentRecord(created),
    });
  } catch (error: any) {
    console.error("Create student error:", error);
    return res.status(500).json({
      message: "Error creating student",
    });
  }
};

export const updateStudent = async (req: AuthRequest, res: Response) => {
  try {
    await ensureTimerTables();
    const studentId = Number(req.params.id);
    if (isNaN(studentId)) {
      return res.status(400).json({ message: "Invalid student ID" });
    }

    const existing = await db
      .select()
      .from(students)
      .where(eq(students.id, studentId))
      .get();

    if (!existing) {
      return res.status(404).json({ message: "Student not found" });
    }

    const body = req.body || {};
    const rollNumber =
      typeof (body.rollNumber ?? body.roll_number) === "string" &&
      (body.rollNumber ?? body.roll_number).trim()
        ? (body.rollNumber ?? body.roll_number).trim()
        : existing.rollNumber;
    const name =
      typeof body.name === "string" && body.name.trim()
        ? body.name.trim()
        : existing.name;
    const department =
      typeof body.department === "string" && body.department.trim()
        ? body.department.trim()
        : existing.department;
    const rawRegNum = body.registerNumber ?? body.register_number;
    const registerNumber =
      rawRegNum !== undefined && rawRegNum !== null && String(rawRegNum).trim() !== ""
        ? Number(rawRegNum)
        : existing.registerNumber;

    if (isNaN(registerNumber) || registerNumber <= 0) {
      return res.status(400).json({
        message: "Register number must be a positive integer",
      });
    }

    if (rollNumber !== existing.rollNumber) {
      const duplicate = await db
        .select()
        .from(students)
        .where(
          and(eq(students.rollNumber, rollNumber), ne(students.id, studentId))
        )
        .get();
      if (duplicate) {
        return res.status(409).json({
          message: `Roll Number "${rollNumber}" is already assigned to another student`,
        });
      }
    }

    const updated = await db
      .update(students)
      .set({
        rollNumber,
        name,
        department,
        registerNumber,
      })
      .where(eq(students.id, studentId))
      .returning()
      .get();

    return res.json({
      message: "Student details updated",
      student: sanitizeStudentRecord(updated),
    });
  } catch (error: any) {
    console.error("Update student error:", error);
    return res.status(500).json({
      message: "Error updating student",
    });
  }
};

export const resetStudentPassword = async (req: AuthRequest, res: Response) => {
  try {
    await ensureTimerTables();
    const studentId = Number(req.params.id);
    if (isNaN(studentId)) {
      return res.status(400).json({ message: "Invalid student ID" });
    }

    const existing = await db
      .select()
      .from(students)
      .where(eq(students.id, studentId))
      .get();

    if (!existing) {
      return res.status(404).json({ message: "Student not found" });
    }

    const body = req.body || {};
    const mode = body.mode; // "require_setup" or "set_password"
    const newPassword = body.newPassword ?? body.new_password ?? body.password;

    if (mode === "require_setup") {
      const updated = await db
        .update(students)
        .set({ password: SETUP_REQUIRED_SENTINEL })
        .where(eq(students.id, studentId))
        .returning()
        .get();

      await incrementStudentTokenVersion(studentId, false);

      return res.json({
        message:
          "Student account marked for first-time password initialization. The student can set their new password using their Roll Number and Register Number.",
        student: sanitizeStudentRecord(updated),
      });
    }

    if (typeof newPassword !== "string" || !newPassword) {
      return res.status(400).json({
        message:
          "A new password is required (or specify mode: 'require_setup')",
      });
    }

    const policyCheck = validatePasswordPolicy(newPassword, {
      rollNumber: existing.rollNumber,
      name: existing.name,
      registerNumber: existing.registerNumber,
    });
    if (!policyCheck.valid) {
      return res.status(400).json({
        message: policyCheck.message,
      });
    }

    const hashed = await hashPassword(newPassword);
    const updated = await db
      .update(students)
      .set({ password: hashed })
      .where(eq(students.id, studentId))
      .returning()
      .get();

    await incrementStudentTokenVersion(studentId, true);

    return res.json({
      message: `Password updated for ${existing.name} (${existing.rollNumber})`,
      student: sanitizeStudentRecord(updated),
    });
  } catch (error: any) {
    console.error("Reset student password error:", error);
    return res.status(500).json({
      message: "Error resetting student password",
    });
  }
};

export const bulkInitializeStudentPasswords = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    await ensureTimerTables();
    const body = req.body || {};
    const mode = body.mode || "require_setup"; // "require_setup" or "set_default_pattern"
    const onlyUninitialized = body.onlyUninitialized !== false;

    const allStudents = await db.select().from(students).all();
    let updatedCount = 0;

    for (const s of allStudents) {
      if (onlyUninitialized && !isPasswordSetupRequired(s.password)) {
        continue;
      }

      if (mode === "require_setup") {
        await db
          .update(students)
          .set({ password: SETUP_REQUIRED_SENTINEL })
          .where(eq(students.id, s.id))
          .execute();
        await incrementStudentTokenVersion(s.id, false);
        updatedCount++;
      } else if (
        mode === "set_password" &&
        typeof body.password === "string" &&
        body.password.length >= 8
      ) {
        const policyCheck = validatePasswordPolicy(body.password);
        if (!policyCheck.valid) {
          return res.status(400).json({ message: policyCheck.message });
        }
        const hashed = await hashPassword(body.password);
        await db
          .update(students)
          .set({ password: hashed })
          .where(eq(students.id, s.id))
          .execute();
        await incrementStudentTokenVersion(s.id, true);
        updatedCount++;
      }
    }

    return res.json({
      message: `Updated password configuration for ${updatedCount} student(s)`,
      updatedCount,
    });
  } catch (error: any) {
    console.error("Bulk initialize student passwords error:", error);
    return res.status(500).json({
      message: "Error bulk updating student passwords",
    });
  }
};

// ==========================================
// GET FACULTY TESTS
// ==========================================

export const getFacultyTests = async (req: AuthRequest, res: Response) => {
  try {
    await ensureTimerTables();
    await processExpiredSessions();

    const facultyId = req.user!.id;

    const allTests = await db
      .select()
      .from(tests)
      .orderBy(desc(tests.id))
      .all();

    const enriched = await Promise.all(
      allTests.map(async (t) => {
        const config = await getOrCreateTimerConfig(t.id, facultyId);
        const sessions = await db
          .select({ status: assessmentSessions.status })
          .from(assessmentSessions)
          .where(eq(assessmentSessions.assessmentId, t.id))
          .all();

        const testQs = await db
          .select({ id: questions.id, status: questions.status })
          .from(questions)
          .where(eq(questions.testId, t.id))
          .all();

        const durationMinutes = config ? config.durationMinutes : t.duration;
        const timerEnabled = config ? Boolean(config.timerEnabled) : true;

        return {
          ...t,
          duration: durationMinutes,
          durationMinutes,
          timerEnabled,
          questionsCount: testQs.filter((q) => q.status !== "archived").length,
          publishedQuestionsCount: testQs.filter(
            (q) => (q.status || "published") === "published"
          ).length,
          activeSessionsCount: sessions.filter((s) => s.status === "active")
            .length,
          submittedSessionsCount: sessions.filter(
            (s) => s.status === "submitted"
          ).length,
          expiredSessionsCount: sessions.filter((s) => s.status === "expired")
            .length,
        };
      })
    );

    return res.json(enriched);
  } catch (error) {
    console.error("Get faculty tests error:", error);
    return res.status(500).json({
      message: "Error fetching tests",
    });
  }
};

// ==========================================
// CREATE TEST
// ==========================================

export const createTest = async (req: AuthRequest, res: Response) => {
  try {
    await ensureTimerTables();
    const facultyId = req.user!.id;

    const {
      title,
      subject,
      duration,
      timerEnabled = true,
      startTime,
      endTime,
    } = req.body;

    if (
      !title ||
      !subject ||
      duration === undefined ||
      !startTime ||
      !endTime
    ) {
      return res.status(400).json({
        message: "All test fields are required",
      });
    }

    const parsedDuration = Number(duration);
    if (isNaN(parsedDuration) || parsedDuration <= 0) {
      return res.status(400).json({
        message: "Duration must be a positive number of minutes",
      });
    }

    const test = await db
      .insert(tests)
      .values({
        title,
        subject,
        facultyId,
        duration: parsedDuration,
        startTime,
        endTime,
        status: "draft",
      })
      .returning()
      .get();

    await db
      .insert(assessmentTimerConfigs)
      .values({
        assessmentId: test.id,
        timerEnabled: Boolean(timerEnabled),
        durationMinutes: parsedDuration,
        gracePeriodSeconds: 15,
        autoSubmitOnExpiry: true,
        updatedAt: new Date().toISOString(),
        updatedBy: facultyId,
      })
      .onConflictDoNothing()
      .execute();

    return res.status(201).json({
      message: "Test created",
      test: {
        ...test,
        durationMinutes: parsedDuration,
        timerEnabled: Boolean(timerEnabled),
      },
    });
  } catch (error: any) {
    console.error("Create test error:", error);
    return res.status(500).json({
      message: "Error creating test",
      error: error.message,
    });
  }
};

// ==========================================
// UPDATE TEST
// ==========================================

export const updateTest = async (req: AuthRequest, res: Response) => {
  try {
    await ensureTimerTables();
    const testId = Number(req.params.id);
    const facultyId = req.user!.id;

    const {
      title,
      subject,
      duration,
      timerEnabled,
      startTime,
      endTime,
      status,
    } = req.body;

    const existingTest = await db
      .select()
      .from(tests)
      .where(eq(tests.id, testId))
      .get();

    if (!existingTest) {
      return res.status(404).json({
        message: "Test not found",
      });
    }

    const updatedDuration =
      duration !== undefined && duration !== null && !isNaN(Number(duration))
        ? Number(duration)
        : existingTest.duration;

    const test = await db
      .update(tests)
      .set({
        title: title !== undefined ? title : existingTest.title,
        subject: subject !== undefined ? subject : existingTest.subject,
        duration: updatedDuration,
        startTime: startTime !== undefined ? startTime : existingTest.startTime,
        endTime: endTime !== undefined ? endTime : existingTest.endTime,
        status: status !== undefined ? status : existingTest.status,
      })
      .where(eq(tests.id, testId))
      .returning()
      .get();

    if (duration !== undefined || timerEnabled !== undefined) {
      const existingConfig = await getOrCreateTimerConfig(testId, facultyId);
      await db
        .update(assessmentTimerConfigs)
        .set({
          durationMinutes: updatedDuration,
          timerEnabled:
            timerEnabled !== undefined
              ? Boolean(timerEnabled)
              : existingConfig
              ? Boolean(existingConfig.timerEnabled)
              : true,
          updatedAt: new Date().toISOString(),
          updatedBy: facultyId,
        })
        .where(eq(assessmentTimerConfigs.assessmentId, testId))
        .execute();
    }

    return res.json({
      message: "Test updated",
      test,
    });
  } catch (error: any) {
    console.error("Update test error:", error);
    return res.status(500).json({
      message: "Error updating test",
      error: error.message,
    });
  }
};

// ==========================================
// VALIDATE QUESTION & TEST CASES PAYLOAD HELPER
// ==========================================

function validateAndNormalizeQuestionPayload(
  body: any,
  requireFullLeetCodeValidation: boolean
): {
  valid: boolean;
  errors: Record<string, string>;
  normalized: {
    title: string;
    slug: string;
    description: string;
    difficulty: "easy" | "medium" | "hard";
    topic: string;
    maxMarks: number;
    timeLimitSeconds: number;
    memoryLimitMb: number;
    status: "draft" | "published" | "archived";
    constraints: string | null;
    inputFormat: string | null;
    outputFormat: string | null;
    sampleInput: string | null;
    sampleOutput: string | null;
    notes: string | null;
    examples: QuestionExample[];
    functionConfig: FunctionConfig | null;
    starterCode: Record<string, string> | null;
    driverCode: Record<string, string> | null;
    testCases: TestCaseRecord[];
  };
} {
  const errors: Record<string, string> = {};

  const title = String(body.title ?? "").trim();
  const description = String(body.description ?? "").trim();
  const rawSlug = String(body.slug ?? "").trim();
  const slug = rawSlug ? slugifyTitle(rawSlug) : slugifyTitle(title);

  if (!title) {
    errors.title = "Question title is required.";
  }
  if (!description) {
    errors.description = "Problem description is required.";
  }
  if (rawSlug && !slug) {
    errors.slug =
      "Slug must contain at least one alphanumeric character.";
  }

  const rawDifficulty = String(body.difficulty || "medium").toLowerCase();
  const difficulty: "easy" | "medium" | "hard" =
    rawDifficulty === "easy" ||
    rawDifficulty === "medium" ||
    rawDifficulty === "hard"
      ? rawDifficulty
      : "medium";

  const rawStatus = String(body.status || "published").toLowerCase();
  const status: "draft" | "published" | "archived" =
    rawStatus === "draft" ||
    rawStatus === "published" ||
    rawStatus === "archived"
      ? rawStatus
      : "published";

  const topic = String(body.topic || "Algorithms").trim() || "Algorithms";
  const maxMarks =
    body.maxMarks !== undefined && body.maxMarks !== ""
      ? Number(body.maxMarks)
      : 50;
  if (isNaN(maxMarks) || maxMarks <= 0 || maxMarks > 1000) {
    errors.maxMarks = "Maximum marks must be between 1 and 1000.";
  }

  const timeLimitSeconds =
    body.timeLimitSeconds !== undefined && body.timeLimitSeconds !== ""
      ? Number(body.timeLimitSeconds)
      : 2.0;
  if (
    isNaN(timeLimitSeconds) ||
    timeLimitSeconds <= 0 ||
    timeLimitSeconds > 30
  ) {
    errors.timeLimitSeconds =
      "Execution time limit must be between 0.1 and 30 seconds.";
  }

  const memoryLimitMb =
    body.memoryLimitMb !== undefined && body.memoryLimitMb !== ""
      ? Number(body.memoryLimitMb)
      : 128;
  if (isNaN(memoryLimitMb) || memoryLimitMb < 16 || memoryLimitMb > 2048) {
    errors.memoryLimitMb = "Memory limit must be between 16 MB and 2048 MB.";
  }

  // Parse examples
  const rawExamples = parseQuestionJsonField<any[]>(body.examples, []);
  const examples: QuestionExample[] = [];
  if (Array.isArray(rawExamples)) {
    rawExamples.forEach((ex, idx) => {
      const inp = String(ex?.input ?? "").trim();
      const out = String(ex?.output ?? "").trim();
      const exp = ex?.explanation ? String(ex.explanation).trim() : undefined;
      if (inp || out) {
        if (!inp) {
          errors[`example_${idx}_input`] = `Example ${idx + 1} input is required.`;
        }
        if (!out) {
          errors[`example_${idx}_output`] = `Example ${idx + 1} output is required.`;
        }
        examples.push({ input: inp, output: out, explanation: exp });
      }
    });
  }

  // Parse functionConfig
  let functionConfig = parseQuestionJsonField<FunctionConfig | null>(
    body.functionConfig,
    null
  );
  let starterCode = parseQuestionJsonField<Record<string, string> | null>(
    body.starterCode,
    null
  );
  const driverCode = parseQuestionJsonField<Record<string, string> | null>(
    body.driverCode,
    null
  );

  if (functionConfig && typeof functionConfig === "object") {
    functionConfig = {
      className: String(functionConfig.className || "Solution").trim(),
      methodName: String(functionConfig.methodName || "").trim(),
      returnType: functionConfig.returnType,
      parameters: Array.isArray(functionConfig.parameters)
        ? functionConfig.parameters.map((p) => ({
            name: String(p?.name || "").trim(),
            type: p?.type,
          }))
        : [],
      visibility: functionConfig.visibility || "public",
      isStatic: Boolean(functionConfig.isStatic),
      enabledLanguages:
        Array.isArray(functionConfig.enabledLanguages) &&
        functionConfig.enabledLanguages.length > 0
          ? functionConfig.enabledLanguages
          : ["Java", "C++", "Python", "C"],
    };

    const sigCheck = validateFunctionConfig(functionConfig);
    if (!sigCheck.valid) {
      Object.assign(errors, sigCheck.errors);
    } else {
      const autoGenerated = generateAllStarterCodes(functionConfig);
      starterCode = {
        ...autoGenerated,
        ...(starterCode && typeof starterCode === "object" ? starterCode : {}),
      };

      // Ensure every enabled language has valid starter code
      for (const lang of functionConfig.enabledLanguages || []) {
        if (!starterCode[lang] || !starterCode[lang].trim()) {
          starterCode[lang] = autoGenerated[lang];
        }
      }

      const starterCheck = validateStarterCodeMap(starterCode, functionConfig);
      if (!starterCheck.valid) {
        Object.assign(errors, starterCheck.errors);
      }
    }
  } else if (requireFullLeetCodeValidation) {
    errors.functionConfig =
      "Class and method configuration is required to publish a LeetCode-style question.";
  }

  // Parse and validate test cases
  const rawTestCases = parseQuestionJsonField<any[]>(body.testCases, []);
  const normalizedTestCases: TestCaseRecord[] = [];
  const seenCaseNames = new Set<string>();

  if (Array.isArray(rawTestCases)) {
    rawTestCases.forEach((tc, idx) => {
      const name = String(tc?.name || `Case ${idx + 1}`).trim();
      const nameKey = name.toLowerCase();
      if (seenCaseNames.has(nameKey)) {
        errors[`testcase_${idx}_name`] = `Duplicate test case identifier "${name}".`;
      }
      seenCaseNames.add(nameKey);

      const visibility: "public" | "private" =
        tc?.visibility === "public" ? "public" : "private";
      const enabled = tc?.enabled !== false;
      const isEssential = Boolean(tc?.isEssential);
      let inputArgsStr =
        typeof tc?.inputArgs === "object"
          ? JSON.stringify(tc.inputArgs)
          : String(tc?.inputArgs ?? tc?.input ?? "").trim();
      let expectedOutputStr = String(
        tc?.expectedOutput ?? tc?.output ?? ""
      ).trim();

      if (!inputArgsStr && (!functionConfig || functionConfig.parameters.length > 0)) {
        errors[`testcase_${idx}_input`] = `Test case "${name}" input arguments are required.`;
      }
      if (!expectedOutputStr) {
        errors[`testcase_${idx}_output`] = `Test case "${name}" expected output is required.`;
      }

      if (
        functionConfig &&
        Object.keys(validateFunctionConfig(functionConfig).errors).length === 0
      ) {
        if (inputArgsStr || functionConfig.parameters.length === 0) {
          const normArgs = normalizeTestCaseInputToJson(
            inputArgsStr,
            functionConfig.parameters
          );
          if (!normArgs.valid) {
            errors[`testcase_${idx}_input`] = `Test case "${name}": ${normArgs.error}`;
          } else {
            inputArgsStr = normArgs.json;
          }
        }
        if (expectedOutputStr) {
          const normOut = validateExpectedOutput(
            expectedOutputStr,
            functionConfig.returnType
          );
          if (!normOut.valid) {
            errors[`testcase_${idx}_output`] = `Test case "${name}": ${normOut.error}`;
          } else {
            expectedOutputStr = normOut.normalized;
          }
        }
      }

      normalizedTestCases.push({
        id: tc?.id ? Number(tc.id) : undefined,
        name,
        inputArgs: inputArgsStr,
        expectedOutput: expectedOutputStr,
        visibility,
        enabled,
        isEssential,
        orderIndex: idx,
      });
    });
  }

  // If publishing a LeetCode-style question with functionConfig, verify test cases & examples
  if (
    status === "published" &&
    (requireFullLeetCodeValidation || functionConfig)
  ) {
    const enabledEvalCases = normalizedTestCases.filter((tc) => tc.enabled);
    if (enabledEvalCases.length === 0) {
      errors.testCases =
        "At least one enabled evaluation test case is required to publish a question.";
    }
    if (examples.length === 0 && !body.sampleInput) {
      errors.examples =
        "At least one example is required to publish a question.";
    }
  }

  // Populate legacy sampleInput/sampleOutput from examples[0] or public testCase[0] if not explicitly passed
  let sampleInput = body.sampleInput ? String(body.sampleInput) : null;
  let sampleOutput = body.sampleOutput ? String(body.sampleOutput) : null;
  if (!sampleInput && examples.length > 0) {
    sampleInput = examples[0].input;
    sampleOutput = examples[0].output;
  } else if (!sampleInput && normalizedTestCases.length > 0) {
    sampleInput = normalizedTestCases[0].inputArgs;
    sampleOutput = normalizedTestCases[0].expectedOutput;
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    normalized: {
      title,
      slug,
      description,
      difficulty,
      topic,
      maxMarks,
      timeLimitSeconds,
      memoryLimitMb,
      status,
      constraints: body.constraints ? String(body.constraints) : null,
      inputFormat: body.inputFormat ? String(body.inputFormat) : null,
      outputFormat: body.outputFormat ? String(body.outputFormat) : null,
      sampleInput,
      sampleOutput,
      notes: body.notes ? String(body.notes) : null,
      examples,
      functionConfig,
      starterCode,
      driverCode,
      testCases: normalizedTestCases,
    },
  };
}

// ==========================================
// VALIDATE SIGNATURE / GENERATE STARTER CODE ENDPOINT
// ==========================================

export const validateQuestionConfiguration = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const { functionConfig, starterCode, testCases } = req.body;
    if (!functionConfig) {
      return res.status(400).json({
        valid: false,
        errors: { functionConfig: "Function configuration is required." },
      });
    }

    const sigCheck = validateFunctionConfig(functionConfig);
    if (!sigCheck.valid) {
      return res.status(400).json({
        valid: false,
        errors: sigCheck.errors,
      });
    }

    const generatedStarterCode = generateAllStarterCodes(functionConfig);
    const effectiveStarter = {
      ...generatedStarterCode,
      ...(starterCode || {}),
    };
    const starterCheck = validateStarterCodeMap(
      effectiveStarter,
      functionConfig
    );

    const caseErrors: Record<string, string> = {};
    const casePreviews: Array<{
      name: string;
      formattedInput: string;
      expectedOutput: string;
      visibility: string;
    }> = [];

    if (Array.isArray(testCases)) {
      testCases.forEach((tc: any, idx: number) => {
        const name = tc?.name || `Case ${idx + 1}`;
        const normIn = normalizeTestCaseInputToJson(
          tc?.inputArgs ?? "",
          functionConfig.parameters
        );
        const normOut = validateExpectedOutput(
          tc?.expectedOutput ?? "",
          functionConfig.returnType
        );
        if (!normIn.valid) {
          caseErrors[`testcase_${idx}_input`] = `${name}: ${normIn.error}`;
        }
        if (!normOut.valid) {
          caseErrors[`testcase_${idx}_output`] = `${name}: ${normOut.error}`;
        }
        if (normIn.valid && normOut.valid) {
          casePreviews.push({
            name,
            formattedInput: formatArgsForDisplay(
              normIn.json,
              functionConfig.parameters
            ),
            expectedOutput: normOut.normalized,
            visibility: tc?.visibility || "private",
          });
        }
      });
    }

    const allErrors = { ...starterCheck.errors, ...caseErrors };
    return res.json({
      valid: Object.keys(allErrors).length === 0,
      errors: allErrors,
      generatedStarterCode,
      casePreviews,
    });
  } catch (error: any) {
    return res.status(500).json({
      valid: false,
      message: "Error validating question configuration",
      error: error.message,
    });
  }
};

// ==========================================
// CREATE QUESTION
// ==========================================

export const createQuestion = async (req: AuthRequest, res: Response) => {
  try {
    await ensureTimerTables();
    const { testId } = req.body;

    if (!testId) {
      return res.status(400).json({
        message: "testId is required",
        errors: { testId: "Please select an assessment / test." },
      });
    }

    const test = await db
      .select()
      .from(tests)
      .where(eq(tests.id, Number(testId)))
      .get();

    if (!test) {
      return res.status(404).json({
        message: "Test not found or unauthorized",
      });
    }

    const hasLeetCodePayload = Boolean(
      req.body.functionConfig || req.body.examples || req.body.testCases
    );
    const validation = validateAndNormalizeQuestionPayload(
      req.body,
      hasLeetCodePayload && req.body.status === "published"
    );

    if (!validation.valid) {
      const firstError = Object.values(validation.errors)[0];
      return res.status(400).json({
        message: firstError || "Question validation failed.",
        errors: validation.errors,
      });
    }

    const norm = validation.normalized;

    // Check slug uniqueness if explicit slug was provided
    if (req.body.slug) {
      const existingSlug = await db
        .select({ id: questions.id })
        .from(questions)
        .where(eq(questions.slug, norm.slug))
        .get();
      if (existingSlug) {
        return res.status(400).json({
          message: `A question with slug "${norm.slug}" already exists.`,
          errors: { slug: `Slug "${norm.slug}" is already in use.` },
        });
      }
    } else {
      // Ensure auto-generated slug is unique
      const existingSlug = await db
        .select({ id: questions.id })
        .from(questions)
        .where(eq(questions.slug, norm.slug))
        .get();
      if (existingSlug) {
        norm.slug = `${norm.slug}-${Date.now().toString().slice(-5)}`;
      }
    }

    // If no testCases were passed but sampleInput/sampleOutput exist (e.g. legacy test scripts), seed default test cases
    let casesToInsert = norm.testCases;
    if (
      casesToInsert.length === 0 &&
      (norm.sampleInput || norm.sampleOutput) &&
      !norm.functionConfig
    ) {
      casesToInsert = [
        {
          name: "Sample Case 1",
          inputArgs: norm.sampleInput || "",
          expectedOutput: norm.sampleOutput || "",
          visibility: "public",
          enabled: true,
          isEssential: false,
          orderIndex: 0,
        },
        {
          name: "Evaluation Case 2",
          inputArgs: norm.sampleInput || "",
          expectedOutput: norm.sampleOutput || "",
          visibility: "private",
          enabled: true,
          isEssential: true,
          orderIndex: 1,
        },
      ];
    }

    const nowIso = new Date().toISOString();

    const insertedQuestion = await db
      .insert(questions)
      .values({
        testId: Number(testId),
        title: norm.title,
        slug: norm.slug,
        description: norm.description,
        topic: norm.topic,
        maxMarks: norm.maxMarks,
        timeLimitSeconds: norm.timeLimitSeconds,
        memoryLimitMb: norm.memoryLimitMb,
        status: norm.status,
        examples: norm.examples,
        functionConfig: norm.functionConfig,
        constraints: norm.constraints,
        inputFormat: norm.inputFormat,
        outputFormat: norm.outputFormat,
        sampleInput: norm.sampleInput,
        sampleOutput: norm.sampleOutput,
        starterCode: norm.starterCode,
        driverCode: norm.driverCode,
        notes: norm.notes,
        difficulty: norm.difficulty,
        createdAt: nowIso,
        updatedAt: nowIso,
      })
      .returning()
      .get();

    if (casesToInsert.length > 0) {
      await db.insert(questionTestCases).values(
        casesToInsert.map((tc, i) => ({
          questionId: insertedQuestion.id,
          name: tc.name || `Case ${i + 1}`,
          inputArgs: tc.inputArgs,
          expectedOutput: tc.expectedOutput,
          visibility: tc.visibility,
          enabled: tc.enabled,
          isEssential: Boolean(tc.isEssential),
          orderIndex: i,
          createdAt: nowIso,
          updatedAt: nowIso,
        }))
      );
    }

    const fullQuestion = await hydrateAdminQuestion(insertedQuestion);

    return res.status(201).json({
      message: "Question saved successfully",
      question: fullQuestion,
    });
  } catch (error: any) {
    console.error("Create question error:", error);
    return res.status(500).json({
      message: "Error adding question",
      error: error.message,
    });
  }
};

// ==========================================
// GET ALL QUESTIONS (ADMIN / FACULTY)
// ==========================================

export const getAllAdminQuestions = async (req: AuthRequest, res: Response) => {
  try {
    await ensureTimerTables();
    const { testId, status, difficulty } = req.query;

    const allTests = await db.select().from(tests).all();
    const testMap = new Map(allTests.map((t) => [t.id, t]));

    let allQs = await db
      .select()
      .from(questions)
      .orderBy(desc(questions.id))
      .all();

    if (testId) {
      allQs = allQs.filter((q) => q.testId === Number(testId));
    }
    if (status && status !== "all") {
      allQs = allQs.filter((q) => (q.status || "published") === status);
    }
    if (difficulty && difficulty !== "all") {
      allQs = allQs.filter((q) => q.difficulty === difficulty);
    }

    const hydrated = await Promise.all(
      allQs.map(async (q) => {
        const h = await hydrateAdminQuestion(q);
        const parentTest = testMap.get(q.testId);
        return {
          ...h,
          testTitle: parentTest?.title || `Test #${q.testId}`,
          testStatus: parentTest?.status || "draft",
        };
      })
    );

    return res.json(hydrated);
  } catch (error: any) {
    console.error("Get all admin questions error:", error);
    return res.status(500).json({
      message: "Error fetching questions",
      error: error.message,
    });
  }
};

// ==========================================
// GET SINGLE QUESTION FOR ADMIN EDITING
// ==========================================

export const getAdminQuestionById = async (req: AuthRequest, res: Response) => {
  try {
    await ensureTimerTables();
    const questionId = Number(req.params.id);
    if (!questionId || isNaN(questionId)) {
      return res.status(400).json({ message: "Invalid question ID" });
    }

    const q = await db
      .select()
      .from(questions)
      .where(eq(questions.id, questionId))
      .get();

    if (!q) {
      return res.status(404).json({ message: "Question not found" });
    }

    const hydrated = await hydrateAdminQuestion(q);
    return res.json(hydrated);
  } catch (error: any) {
    console.error("Get admin question error:", error);
    return res.status(500).json({
      message: "Error fetching question details",
      error: error.message,
    });
  }
};

// ==========================================
// UPDATE QUESTION (METADATA, EXAMPLES, SIGNATURE, STARTER CODE, TEST CASES)
// ==========================================

export const updateQuestion = async (req: AuthRequest, res: Response) => {
  try {
    await ensureTimerTables();
    const questionId = Number(req.params.id);
    if (!questionId || isNaN(questionId)) {
      return res.status(400).json({ message: "Invalid question ID" });
    }

    const existing = await db
      .select()
      .from(questions)
      .where(eq(questions.id, questionId))
      .get();

    if (!existing) {
      return res.status(404).json({ message: "Question not found" });
    }

    const existingCases = await getQuestionTestCasesFromDb(questionId);

    const mergedBody = {
      testId: req.body.testId ?? existing.testId,
      title: req.body.title ?? existing.title,
      slug: req.body.slug ?? existing.slug,
      description: req.body.description ?? existing.description,
      difficulty: req.body.difficulty ?? existing.difficulty,
      topic: req.body.topic ?? existing.topic,
      maxMarks: req.body.maxMarks ?? existing.maxMarks,
      timeLimitSeconds: req.body.timeLimitSeconds ?? existing.timeLimitSeconds,
      memoryLimitMb: req.body.memoryLimitMb ?? existing.memoryLimitMb,
      status: req.body.status ?? existing.status ?? "published",
      constraints:
        req.body.constraints !== undefined
          ? req.body.constraints
          : existing.constraints,
      inputFormat:
        req.body.inputFormat !== undefined
          ? req.body.inputFormat
          : existing.inputFormat,
      outputFormat:
        req.body.outputFormat !== undefined
          ? req.body.outputFormat
          : existing.outputFormat,
      sampleInput:
        req.body.sampleInput !== undefined
          ? req.body.sampleInput
          : existing.sampleInput,
      sampleOutput:
        req.body.sampleOutput !== undefined
          ? req.body.sampleOutput
          : existing.sampleOutput,
      notes: req.body.notes !== undefined ? req.body.notes : existing.notes,
      examples:
        req.body.examples !== undefined ? req.body.examples : existing.examples,
      functionConfig:
        req.body.functionConfig !== undefined
          ? req.body.functionConfig
          : existing.functionConfig,
      starterCode:
        req.body.starterCode !== undefined
          ? req.body.starterCode
          : existing.starterCode,
      driverCode:
        req.body.driverCode !== undefined
          ? req.body.driverCode
          : existing.driverCode,
      testCases:
        req.body.testCases !== undefined ? req.body.testCases : existingCases,
    };

    const validation = validateAndNormalizeQuestionPayload(
      mergedBody,
      mergedBody.status === "published" && Boolean(mergedBody.functionConfig)
    );

    if (!validation.valid) {
      const firstError = Object.values(validation.errors)[0];
      return res.status(400).json({
        message: firstError || "Validation failed.",
        errors: validation.errors,
      });
    }

    const norm = validation.normalized;

    // Check slug uniqueness excluding current question
    if (norm.slug) {
      const duplicateSlug = await db
        .select({ id: questions.id })
        .from(questions)
        .where(and(eq(questions.slug, norm.slug), ne(questions.id, questionId)))
        .get();
      if (duplicateSlug) {
        return res.status(400).json({
          message: `Another question already uses slug "${norm.slug}".`,
          errors: { slug: `Slug "${norm.slug}" is already taken.` },
        });
      }
    }

    const nowIso = new Date().toISOString();

    const updated = await db
      .update(questions)
      .set({
        testId: Number(mergedBody.testId),
        title: norm.title,
        slug: norm.slug,
        description: norm.description,
        difficulty: norm.difficulty,
        topic: norm.topic,
        maxMarks: norm.maxMarks,
        timeLimitSeconds: norm.timeLimitSeconds,
        memoryLimitMb: norm.memoryLimitMb,
        status: norm.status,
        constraints: norm.constraints,
        inputFormat: norm.inputFormat,
        outputFormat: norm.outputFormat,
        sampleInput: norm.sampleInput,
        sampleOutput: norm.sampleOutput,
        notes: norm.notes,
        examples: norm.examples,
        functionConfig: norm.functionConfig,
        starterCode: norm.starterCode,
        driverCode: norm.driverCode,
        updatedAt: nowIso,
      })
      .where(eq(questions.id, questionId))
      .returning()
      .get();

    if (req.body.testCases !== undefined) {
      await db
        .delete(questionTestCases)
        .where(eq(questionTestCases.questionId, questionId))
        .execute();

      if (norm.testCases.length > 0) {
        await db.insert(questionTestCases).values(
          norm.testCases.map((tc, i) => ({
            questionId,
            name: tc.name || `Case ${i + 1}`,
            inputArgs: tc.inputArgs,
            expectedOutput: tc.expectedOutput,
            visibility: tc.visibility,
            enabled: tc.enabled,
            isEssential: Boolean(tc.isEssential),
            orderIndex: i,
            createdAt: nowIso,
            updatedAt: nowIso,
          }))
        );
      }
    }

    const fullQuestion = await hydrateAdminQuestion(updated);
    return res.json({
      message: "Question updated successfully",
      question: fullQuestion,
    });
  } catch (error: any) {
    console.error("Update question error:", error);
    return res.status(500).json({
      message: "Error updating question",
      error: error.message,
    });
  }
};

// ==========================================
// PUBLISH / ARCHIVE / DRAFT QUESTION STATUS
// ==========================================

export const updateQuestionStatus = async (req: AuthRequest, res: Response) => {
  try {
    await ensureTimerTables();
    const questionId = Number(req.params.id);
    const { status } = req.body;

    if (!["draft", "published", "archived"].includes(status)) {
      return res.status(400).json({
        message: "Invalid status. Expected draft, published, or archived.",
      });
    }

    const existing = await db
      .select()
      .from(questions)
      .where(eq(questions.id, questionId))
      .get();

    if (!existing) {
      return res.status(404).json({ message: "Question not found" });
    }

    if (status === "published") {
      const existingCases = await getQuestionTestCasesFromDb(questionId);
      const check = validateAndNormalizeQuestionPayload(
        {
          ...existing,
          status: "published",
          testCases: existingCases,
        },
        Boolean(existing.functionConfig)
      );

      if (!check.valid) {
        return res.status(400).json({
          message:
            Object.values(check.errors)[0] ||
            "Cannot publish question until all validation checks pass.",
          errors: check.errors,
        });
      }
    }

    const updated = await db
      .update(questions)
      .set({
        status,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(questions.id, questionId))
      .returning()
      .get();

    const hydrated = await hydrateAdminQuestion(updated);
    return res.json({
      message: `Question ${status} successfully`,
      question: hydrated,
    });
  } catch (error: any) {
    console.error("Update question status error:", error);
    return res.status(500).json({
      message: "Error updating question status",
      error: error.message,
    });
  }
};

// ==========================================
// DELETE OR ARCHIVE QUESTION
// ==========================================

export const deleteQuestion = async (req: AuthRequest, res: Response) => {
  try {
    await ensureTimerTables();
    const questionId = Number(req.params.id);
    const action = req.body?.action || req.query?.action;

    const existing = await db
      .select()
      .from(questions)
      .where(eq(questions.id, questionId))
      .get();

    if (!existing) {
      return res.status(404).json({ message: "Question not found" });
    }

    const subs = await db
      .select({ id: submissions.id })
      .from(submissions)
      .where(eq(submissions.questionId, questionId))
      .limit(1)
      .all();

    // Preserve historical submissions if they exist unless explicit permanent delete
    if (subs.length > 0 && action !== "force_delete") {
      const archived = await db
        .update(questions)
        .set({
          status: "archived",
          updatedAt: new Date().toISOString(),
        })
        .where(eq(questions.id, questionId))
        .returning()
        .get();
      return res.json({
        message:
          "Question has student submissions and was archived to preserve submission history.",
        archived: true,
        question: await hydrateAdminQuestion(archived),
      });
    }

    await db
      .delete(questionTestCases)
      .where(eq(questionTestCases.questionId, questionId))
      .execute();
    await db.delete(questions).where(eq(questions.id, questionId)).execute();

    return res.json({
      message: "Question deleted successfully",
      deleted: true,
    });
  } catch (error: any) {
    console.error("Delete question error:", error);
    return res.status(500).json({
      message: "Error deleting question",
      error: error.message,
    });
  }
};

// ==========================================
// INDIVIDUAL TEST CASE MANAGEMENT ENDPOINTS
// ==========================================

export const getQuestionTestCases = async (req: AuthRequest, res: Response) => {
  try {
    await ensureTimerTables();
    const questionId = Number(req.params.id);
    const cases = await getQuestionTestCasesFromDb(questionId);
    return res.json(cases);
  } catch (error: any) {
    return res.status(500).json({
      message: "Error fetching test cases",
      error: error.message,
    });
  }
};

export const addQuestionTestCase = async (req: AuthRequest, res: Response) => {
  try {
    await ensureTimerTables();
    const questionId = Number(req.params.id);
    const q = await db
      .select()
      .from(questions)
      .where(eq(questions.id, questionId))
      .get();

    if (!q) {
      return res.status(404).json({ message: "Question not found" });
    }

    const fnConfig = parseQuestionJsonField<FunctionConfig | null>(
      q.functionConfig,
      null
    );
    const existingCases = await getQuestionTestCasesFromDb(questionId);

    const name = String(
      req.body.name || `Case ${existingCases.length + 1}`
    ).trim();
    if (
      existingCases.some((c) => c.name.toLowerCase() === name.toLowerCase())
    ) {
      return res.status(400).json({
        message: `Test case with identifier "${name}" already exists.`,
      });
    }

    let inputArgs =
      typeof req.body.inputArgs === "object"
        ? JSON.stringify(req.body.inputArgs)
        : String(req.body.inputArgs ?? "").trim();
    let expectedOutput = String(req.body.expectedOutput ?? "").trim();

    if (fnConfig && Array.isArray(fnConfig.parameters)) {
      const normIn = normalizeTestCaseInputToJson(
        inputArgs,
        fnConfig.parameters
      );
      if (!normIn.valid) {
        return res.status(400).json({ message: normIn.error });
      }
      inputArgs = normIn.json;

      const normOut = validateExpectedOutput(
        expectedOutput,
        fnConfig.returnType
      );
      if (!normOut.valid) {
        return res.status(400).json({ message: normOut.error });
      }
      expectedOutput = normOut.normalized;
    }

    const nowIso = new Date().toISOString();
    const inserted = await db
      .insert(questionTestCases)
      .values({
        questionId,
        name,
        inputArgs,
        expectedOutput,
        visibility: req.body.visibility === "public" ? "public" : "private",
        enabled: req.body.enabled !== false,
        isEssential: Boolean(req.body.isEssential),
        orderIndex: existingCases.length,
        createdAt: nowIso,
        updatedAt: nowIso,
      })
      .returning()
      .get();

    return res.status(201).json({
      message: "Test case added",
      testCase: inserted,
    });
  } catch (error: any) {
    return res.status(500).json({
      message: "Error adding test case",
      error: error.message,
    });
  }
};

export const updateQuestionTestCase = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    await ensureTimerTables();
    const questionId = Number(req.params.id);
    const tcId = Number(req.params.tcId);

    const q = await db
      .select()
      .from(questions)
      .where(eq(questions.id, questionId))
      .get();
    if (!q) return res.status(404).json({ message: "Question not found" });

    const existingTc = await db
      .select()
      .from(questionTestCases)
      .where(
        and(
          eq(questionTestCases.id, tcId),
          eq(questionTestCases.questionId, questionId)
        )
      )
      .get();
    if (!existingTc)
      return res.status(404).json({ message: "Test case not found" });

    const fnConfig = parseQuestionJsonField<FunctionConfig | null>(
      q.functionConfig,
      null
    );

    const name =
      req.body.name !== undefined
        ? String(req.body.name).trim()
        : existingTc.name;
    let inputArgs =
      req.body.inputArgs !== undefined
        ? typeof req.body.inputArgs === "object"
          ? JSON.stringify(req.body.inputArgs)
          : String(req.body.inputArgs).trim()
        : existingTc.inputArgs;
    let expectedOutput =
      req.body.expectedOutput !== undefined
        ? String(req.body.expectedOutput).trim()
        : existingTc.expectedOutput;

    if (fnConfig && Array.isArray(fnConfig.parameters)) {
      const normIn = normalizeTestCaseInputToJson(
        inputArgs,
        fnConfig.parameters
      );
      if (!normIn.valid) {
        return res.status(400).json({ message: normIn.error });
      }
      inputArgs = normIn.json;

      const normOut = validateExpectedOutput(
        expectedOutput,
        fnConfig.returnType
      );
      if (!normOut.valid) {
        return res.status(400).json({ message: normOut.error });
      }
      expectedOutput = normOut.normalized;
    }

    const updated = await db
      .update(questionTestCases)
      .set({
        name,
        inputArgs,
        expectedOutput,
        visibility:
          req.body.visibility !== undefined
            ? req.body.visibility === "public"
              ? "public"
              : "private"
            : existingTc.visibility,
        enabled:
          req.body.enabled !== undefined
            ? Boolean(req.body.enabled)
            : Boolean(existingTc.enabled),
        isEssential:
          req.body.isEssential !== undefined
            ? Boolean(req.body.isEssential)
            : Boolean(existingTc.isEssential),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(questionTestCases.id, tcId))
      .returning()
      .get();

    return res.json({
      message: "Test case updated",
      testCase: updated,
    });
  } catch (error: any) {
    return res.status(500).json({
      message: "Error updating test case",
      error: error.message,
    });
  }
};

export const deleteQuestionTestCase = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    await ensureTimerTables();
    const questionId = Number(req.params.id);
    const tcId = Number(req.params.tcId);

    await db
      .delete(questionTestCases)
      .where(
        and(
          eq(questionTestCases.id, tcId),
          eq(questionTestCases.questionId, questionId)
        )
      )
      .execute();

    return res.json({ message: "Test case deleted" });
  } catch (error: any) {
    return res.status(500).json({
      message: "Error deleting test case",
      error: error.message,
    });
  }
};

export const reorderQuestionTestCases = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    await ensureTimerTables();
    const questionId = Number(req.params.id);
    const { orderedIds } = req.body;

    if (!Array.isArray(orderedIds)) {
      return res
        .status(400)
        .json({ message: "orderedIds array is required" });
    }

    const nowIso = new Date().toISOString();
    for (let i = 0; i < orderedIds.length; i++) {
      await db
        .update(questionTestCases)
        .set({ orderIndex: i, updatedAt: nowIso })
        .where(
          and(
            eq(questionTestCases.id, Number(orderedIds[i])),
            eq(questionTestCases.questionId, questionId)
          )
        )
        .execute();
    }

    const cases = await getQuestionTestCasesFromDb(questionId);
    return res.json({
      message: "Test cases reordered",
      testCases: cases,
    });
  } catch (error: any) {
    return res.status(500).json({
      message: "Error reordering test cases",
      error: error.message,
    });
  }
};

// ==========================================
// GET QUESTIONS FOR A TEST
// ==========================================

export const getTestQuestions = async (req: AuthRequest, res: Response) => {
  try {
    await ensureTimerTables();
    const testId = Number(req.params.id);

    if (!testId) {
      return res.status(400).json({
        message: "Invalid test ID",
      });
    }

    const test = await db
      .select()
      .from(tests)
      .where(eq(tests.id, testId))
      .get();

    if (!test) {
      return res.status(404).json({
        message: "Test not found or unauthorized",
      });
    }

    const testQuestions = await db
      .select()
      .from(questions)
      .where(eq(questions.testId, testId))
      .orderBy(asc(questions.id))
      .all();

    const hydrated = await Promise.all(
      testQuestions.map((q) => hydrateAdminQuestion(q))
    );

    return res.json(hydrated);
  } catch (error: any) {
    console.error("Get questions error:", error);
    return res.status(500).json({
      message: "Error fetching questions",
      error: error.message,
    });
  }
};

// ==========================================
// CHECK TEST SUBMISSIONS
// ==========================================

export const checkTestSubmissions = async (req: AuthRequest, res: Response) => {
  try {
    const testId = Number(req.params.id);

    const testQs = await db
      .select({ id: questions.id })
      .from(questions)
      .where(eq(questions.testId, testId))
      .all();

    const qIds = testQs.map((q) => q.id);

    if (qIds.length === 0) {
      return res.json({
        hasSubmissions: false,
      });
    }

    const subs = await db
      .select({ id: submissions.id })
      .from(submissions)
      .where(inArray(submissions.questionId, qIds))
      .limit(1)
      .all();

    return res.json({
      hasSubmissions: subs.length > 0,
    });
  } catch (error) {
    console.error("Check submissions error:", error);
    return res.status(500).json({
      message: "Error checking submissions",
    });
  }
};

// ==========================================
// DELETE / ARCHIVE TEST
// ==========================================

export const deleteTest = async (req: AuthRequest, res: Response) => {
  try {
    await ensureTimerTables();
    const testId = Number(req.params.id);
    const { action } = req.body;

    const test = await db
      .select()
      .from(tests)
      .where(eq(tests.id, testId))
      .get();

    if (!test) {
      return res.status(404).json({
        message: "Test not found",
      });
    }

    if (action === "archive") {
      await db
        .update(tests)
        .set({
          status: "archived",
        })
        .where(eq(tests.id, testId))
        .execute();

      return res.json({
        message: "Test archived successfully",
      });
    }

    if (action === "delete") {
      const testQuestions = await db
        .select({ id: questions.id })
        .from(questions)
        .where(eq(questions.testId, testId))
        .all();

      const qIds = testQuestions.map((q) => q.id);

      if (qIds.length > 0) {
        const subs = await db
          .select({ id: submissions.id })
          .from(submissions)
          .where(inArray(submissions.questionId, qIds))
          .all();

        const subIds = subs.map((s) => s.id);

        if (subIds.length > 0) {
          await db
            .delete(submissionStatistics)
            .where(inArray(submissionStatistics.submissionId, subIds))
            .execute();

          await db
            .delete(submissions)
            .where(inArray(submissions.questionId, qIds))
            .execute();
        }

        await db
          .delete(questionTestCases)
          .where(inArray(questionTestCases.questionId, qIds))
          .execute();

        await db
          .delete(questions)
          .where(eq(questions.testId, testId))
          .execute();
      }

      await db
        .delete(assessmentSessions)
        .where(eq(assessmentSessions.assessmentId, testId))
        .execute();

      await db
        .delete(assessmentTimerConfigs)
        .where(eq(assessmentTimerConfigs.assessmentId, testId))
        .execute();

      await db
        .delete(testCompletions)
        .where(eq(testCompletions.testId, testId))
        .execute();

      await db
        .delete(testAnalytics)
        .where(eq(testAnalytics.testId, testId))
        .execute();

      await db.delete(tests).where(eq(tests.id, testId)).execute();

      return res.json({
        message: "Test permanently deleted",
      });
    }

    return res.status(400).json({
      message: "Invalid action",
    });
  } catch (error: any) {
    console.error("Delete test error:", error);
    return res.status(500).json({
      message: "Error deleting test",
      error: error.message,
    });
  }
};

// ==========================================
// DUPLICATE TEST
// ==========================================

export const duplicateTest = async (req: AuthRequest, res: Response) => {
  try {
    await ensureTimerTables();
    const testId = Number(req.params.id);
    const facultyId = req.user!.id;

    const originalTest = await db
      .select()
      .from(tests)
      .where(eq(tests.id, testId))
      .get();

    if (!originalTest) {
      return res.status(404).json({
        message: "Test not found",
      });
    }

    const originalConfig = await getOrCreateTimerConfig(testId, facultyId);
    const durationMinutes = originalConfig
      ? originalConfig.durationMinutes
      : originalTest.duration;

    const nowIso = new Date().toISOString();

    const newTest = await db
      .insert(tests)
      .values({
        title: originalTest.title + " (Copy)",
        subject: originalTest.subject,
        facultyId,
        duration: durationMinutes,
        startTime: originalTest.startTime,
        endTime: originalTest.endTime,
        status: "draft",
      })
      .returning()
      .get();

    await db
      .insert(assessmentTimerConfigs)
      .values({
        assessmentId: newTest.id,
        timerEnabled: originalConfig
          ? Boolean(originalConfig.timerEnabled)
          : true,
        durationMinutes,
        gracePeriodSeconds: originalConfig?.gracePeriodSeconds ?? 15,
        autoSubmitOnExpiry: originalConfig
          ? Boolean(originalConfig.autoSubmitOnExpiry)
          : true,
        updatedAt: nowIso,
        updatedBy: facultyId,
      })
      .onConflictDoNothing()
      .execute();

    const originalQuestions = await db
      .select()
      .from(questions)
      .where(eq(questions.testId, testId))
      .all();

    for (const q of originalQuestions) {
      const newQ = await db
        .insert(questions)
        .values({
          testId: newTest.id,
          title: q.title,
          slug: q.slug ? `${q.slug}-copy-${Date.now().toString().slice(-4)}` : null,
          description: q.description,
          topic: q.topic,
          maxMarks: q.maxMarks,
          timeLimitSeconds: q.timeLimitSeconds,
          memoryLimitMb: q.memoryLimitMb,
          status: q.status,
          examples: q.examples,
          functionConfig: q.functionConfig,
          constraints: q.constraints,
          inputFormat: q.inputFormat,
          outputFormat: q.outputFormat,
          sampleInput: q.sampleInput,
          sampleOutput: q.sampleOutput,
          starterCode: q.starterCode,
          driverCode: q.driverCode,
          notes: q.notes,
          difficulty: q.difficulty,
          createdAt: nowIso,
          updatedAt: nowIso,
        })
        .returning()
        .get();

      const origCases = await getQuestionTestCasesFromDb(q.id);
      if (origCases.length > 0) {
        await db.insert(questionTestCases).values(
          origCases.map((tc, idx) => ({
            questionId: newQ.id,
            name: tc.name,
            inputArgs: tc.inputArgs,
            expectedOutput: tc.expectedOutput,
            visibility: tc.visibility,
            enabled: tc.enabled,
            isEssential: Boolean(tc.isEssential),
            orderIndex: idx,
            createdAt: nowIso,
            updatedAt: nowIso,
          }))
        );
      }
    }

    return res.status(201).json({
      message: "Test duplicated",
      test: newTest,
    });
  } catch (error: any) {
    console.error("Duplicate test error:", error);
    return res.status(500).json({
      message: "Error duplicating test",
      error: error.message,
    });
  }
};

// ==========================================
// GET TEST RESULTS
// ==========================================

export const getTestResults = async (req: AuthRequest, res: Response) => {
  try {
    await ensureTimerTables();
    await processExpiredSessions();

    const testId = Number(req.params.testId);

    const testQuestions = await db
      .select({
        id: questions.id,
      })
      .from(questions)
      .where(eq(questions.testId, testId))
      .all();

    const questionIds = testQuestions.map((q) => q.id);

    if (questionIds.length === 0) {
      return res.json([]);
    }

    const allSubmissions = await db
      .select({
        id: submissions.id,
        language: submissions.language,
        status: submissions.status,
        submittedAt: submissions.submittedAt,
        sourceCode: submissions.sourceCode,
        output: submissions.output,
        questionId: submissions.questionId,
        studentName: students.name,
        studentRoll: students.rollNumber,
      })
      .from(submissions)
      .innerJoin(students, eq(submissions.studentId, students.id))
      .all();

    const testSubmissions = allSubmissions.filter((sub) =>
      questionIds.includes(sub.questionId)
    );

    return res.json(testSubmissions);
  } catch (error) {
    console.error("Result error:", error);
    return res.status(500).json({
      message: "Error fetching results",
    });
  }
};