import { Response } from "express";
import { db } from "../db/index.js";
import {
  tests,
  questions,
  submissions,
  submissionStatistics,
  students,
  testCompletions,
  assessmentSessions,
} from "../db/schema.js";
import { eq, desc, and, asc } from "drizzle-orm";
import { AuthRequest } from "../middleware/authMiddleware.js";
import {
  getOrCreateTimerConfig,
  computeRemainingSeconds,
  evaluateAndFinalizeSubmission,
  processExpiredSessions,
} from "./timer.js";
import { ensureTimerTables } from "../db/migrate.js";
import {
  FunctionConfig,
  QuestionExample,
  TestCaseRecord,
  generateAllStarterCodes,
  formatArgsForDisplay,
} from "../lib/leetcodeHarness.js";
import {
  evaluateQuestionCode,
  executeCodeWithFallback,
  getQuestionTestCasesFromDb,
  parseQuestionJsonField,
  LANGUAGE_ID_MAP,
} from "../lib/codeEvaluator.js";

export const getTests = async (req: AuthRequest, res: Response) => {
  try {
    await ensureTimerTables();
    await processExpiredSessions();

    const studentId = req.user!.id;
    const allTests = await db
      .select()
      .from(tests)
      .where(eq(tests.status, "published"))
      .orderBy(desc(tests.id))
      .all();

    const completions = await db
      .select()
      .from(testCompletions)
      .where(eq(testCompletions.studentId, studentId))
      .all();
    const completedIds = completions.map((c) => c.testId);

    const enrichedTests = await Promise.all(
      allTests.map(async (t) => {
        const config = await getOrCreateTimerConfig(t.id);
        const session = await db
          .select()
          .from(assessmentSessions)
          .where(
            and(
              eq(assessmentSessions.studentId, studentId),
              eq(assessmentSessions.assessmentId, t.id)
            )
          )
          .orderBy(desc(assessmentSessions.id))
          .get();

        const durationMinutes = config ? config.durationMinutes : t.duration;
        const timerEnabled = config ? Boolean(config.timerEnabled) : true;

        return {
          ...t,
          duration: durationMinutes,
          durationMinutes,
          timerEnabled,
          sessionStatus: session?.status || null,
          sessionId: session?.id || null,
          startedAt: session?.startedAt || null,
          deadlineAt: session?.deadlineAt || null,
        };
      })
    );

    const available = enrichedTests.filter(
      (t) =>
        !completedIds.includes(t.id) &&
        t.sessionStatus !== "submitted" &&
        t.sessionStatus !== "expired"
    );
    const completed = enrichedTests.filter(
      (t) =>
        completedIds.includes(t.id) ||
        t.sessionStatus === "submitted" ||
        t.sessionStatus === "expired"
    );

    res.json({ available, completed });
  } catch (error) {
    console.error("[GET STUDENT TESTS] Error:", error);
    res.status(500).json({ message: "Error fetching tests" });
  }
};

export const getTestDetails = async (req: AuthRequest, res: Response) => {
  try {
    await ensureTimerTables();
    await processExpiredSessions();

    const studentId = req.user!.id;
    const testId = parseInt(req.params.id);
    const test = await db
      .select()
      .from(tests)
      .where(eq(tests.id, testId))
      .get();
    if (!test) return res.status(404).json({ message: "Test not found" });

    // Check if test is already completed
    const completion = await db
      .select()
      .from(testCompletions)
      .where(
        and(
          eq(testCompletions.studentId, studentId),
          eq(testCompletions.testId, testId)
        )
      )
      .get();
    if (completion) {
      return res.status(403).json({
        message: "You have already submitted this test.",
        completed: true,
      });
    }

    const config = await getOrCreateTimerConfig(testId);
    const durationMinutes = config ? config.durationMinutes : test.duration;
    const timerEnabled = config ? Boolean(config.timerEnabled) : true;

    const existingSession = await db
      .select()
      .from(assessmentSessions)
      .where(
        and(
          eq(assessmentSessions.studentId, studentId),
          eq(assessmentSessions.assessmentId, testId)
        )
      )
      .orderBy(desc(assessmentSessions.id))
      .get();

    if (
      existingSession &&
      (existingSession.status === "submitted" ||
        existingSession.status === "expired")
    ) {
      return res.status(403).json({
        message:
          existingSession.status === "expired"
            ? "Your assessment time has expired and your work was automatically submitted."
            : "You have already submitted this test.",
        completed: true,
        expired: existingSession.status === "expired",
      });
    }

    const allTestQuestions = await db
      .select({
        id: questions.id,
        title: questions.title,
        slug: questions.slug,
        difficulty: questions.difficulty,
        topic: questions.topic,
        maxMarks: questions.maxMarks,
        status: questions.status,
      })
      .from(questions)
      .where(eq(questions.testId, testId))
      .orderBy(asc(questions.id))
      .all();

    // Only expose published questions to students
    const publishedQuestions = allTestQuestions
      .filter((q) => !q.status || q.status === "published")
      .map(({ status, ...rest }) => rest);

    let activeSessionData = null;
    if (existingSession && existingSession.status === "active") {
      const remainingSeconds = computeRemainingSeconds(
        Boolean(existingSession.timerEnabled),
        existingSession.deadlineAt
      );
      activeSessionData = {
        sessionId: existingSession.id,
        startedAt: existingSession.startedAt,
        deadlineAt: existingSession.deadlineAt,
        timerEnabled: Boolean(existingSession.timerEnabled),
        durationMinutes: existingSession.durationMinutes,
        remainingSeconds,
        selectedQuestions: existingSession.selectedQuestions
          ? typeof existingSession.selectedQuestions === "string"
            ? JSON.parse(existingSession.selectedQuestions)
            : existingSession.selectedQuestions
          : null,
        serverTime: new Date().toISOString(),
      };
    }

    res.json({
      ...test,
      duration: durationMinutes,
      durationMinutes,
      timerEnabled,
      questions: publishedQuestions,
      activeSession: activeSessionData,
      serverTime: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[GET TEST DETAILS] Error:", error);
    res.status(500).json({ message: "Error fetching test details" });
  }
};

export const getQuestion = async (req: AuthRequest, res: Response) => {
  try {
    await ensureTimerTables();
    const questionId = parseInt(req.params.id);
    const question = await db
      .select()
      .from(questions)
      .where(eq(questions.id, questionId))
      .get();

    if (!question) {
      return res.status(404).json({ message: "Question not found" });
    }

    // Do not allow students to load draft or archived questions
    if (question.status === "draft" || question.status === "archived") {
      return res.status(404).json({
        message: "This question is not currently published.",
      });
    }

    const fnConfig = parseQuestionJsonField<FunctionConfig | null>(
      question.functionConfig,
      null
    );
    const examples = parseQuestionJsonField<QuestionExample[]>(
      question.examples,
      []
    );
    let starterCode = parseQuestionJsonField<Record<string, string>>(
      question.starterCode,
      {}
    );

    if (fnConfig && fnConfig.methodName) {
      const generated = generateAllStarterCodes(fnConfig);
      starterCode = { ...generated, ...starterCode };
    }

    const allTestCases = await getQuestionTestCasesFromDb(question.id);
    // CRITICAL: Only return enabled PUBLIC test cases to student-facing endpoint!
    const publicTestCases = allTestCases
      .filter((tc) => tc.visibility === "public" && tc.enabled !== false)
      .map((tc, idx) => ({
        id: tc.id,
        name: tc.name || `Case ${idx + 1}`,
        inputArgs: tc.inputArgs,
        formattedInput:
          fnConfig && Array.isArray(fnConfig.parameters)
            ? formatArgsForDisplay(tc.inputArgs, fnConfig.parameters)
            : tc.inputArgs,
        expectedOutput: tc.expectedOutput,
        visibility: "public",
      }));

    // Return student-safe question payload (never expose driverCode or private test cases)
    res.json({
      id: question.id,
      testId: question.testId,
      title: question.title,
      slug: question.slug,
      description: question.description,
      difficulty: question.difficulty || "medium",
      topic: question.topic || "Algorithms",
      maxMarks: question.maxMarks ?? 50,
      timeLimitSeconds: question.timeLimitSeconds ?? 2.0,
      memoryLimitMb: question.memoryLimitMb ?? 128,
      constraints: question.constraints,
      inputFormat: question.inputFormat,
      outputFormat: question.outputFormat,
      sampleInput: question.sampleInput,
      sampleOutput: question.sampleOutput,
      notes: question.notes,
      examples,
      functionConfig: fnConfig,
       enabledLanguages:
        fnConfig?.enabledLanguages && fnConfig.enabledLanguages.length > 0
          ? fnConfig.enabledLanguages
          : ["Java", "C++", "Python", "C", "JavaScript"],
      starterCode,
      publicTestCases,
    });
  } catch (error) {
    console.error("[GET STUDENT QUESTION] Error:", error);
    res.status(500).json({ message: "Error fetching question" });
  }
};

export const runCode = async (req: AuthRequest, res: Response) => {
  try {
    await ensureTimerTables();
    const studentId = req.user!.id;
    const {
      question_id,
      source_code = "",
      language = "Python",
      input,
      exampleIndex,
    } = req.body;
    const language_id = LANGUAGE_ID_MAP[language];

    if (!language_id) {
      return res.status(400).json({ message: "Unsupported language" });
    }

    if (question_id) {
      const question = await db
        .select()
        .from(questions)
        .where(eq(questions.id, Number(question_id)))
        .get();

      if (question) {
        // Server-side deadline check for the student's active session
        const session = await db
          .select()
          .from(assessmentSessions)
          .where(
            and(
              eq(assessmentSessions.studentId, studentId),
              eq(assessmentSessions.assessmentId, question.testId)
            )
          )
          .orderBy(desc(assessmentSessions.id))
          .get();

        if (session) {
          if (session.status !== "active") {
            return res.status(403).json({
              message:
                "Assessment session has already ended. Code execution is disabled.",
              expired: session.status === "expired",
            });
          }

          if (session.timerEnabled && session.deadlineAt) {
            const deadlineMs = new Date(session.deadlineAt).getTime();
            if (Date.now() > deadlineMs) {
              await evaluateAndFinalizeSubmission({
                studentId,
                assessmentId: question.testId,
                sessionId: session.id,
                finalStatus: "expired",
              });
              return res.status(403).json({
                message:
                  "Assessment time has expired. Your saved code has been automatically submitted.",
                expired: true,
              });
            }
          }

          // Persist latest code draft on run
          const existingDrafts: Record<string, any> =
            typeof session.drafts === "string"
              ? JSON.parse(session.drafts || "{}")
              : (session.drafts as any) || {};
          existingDrafts[String(question.id)] = {
            sourceCode: source_code,
            language,
            updatedAt: new Date().toISOString(),
          };
          await db
            .update(assessmentSessions)
            .set({
              drafts: existingDrafts,
              updatedAt: new Date().toISOString(),
            })
            .where(eq(assessmentSessions.id, session.id))
            .execute();
        }

        const fnConfig = parseQuestionJsonField<FunctionConfig | null>(
          question.functionConfig,
          null
        );

        // If question has functionConfig and student wants to run against public cases or custom input
        if (fnConfig && fnConfig.methodName) {
          const allDbCases = await getQuestionTestCasesFromDb(question.id);
          const publicCases = allDbCases.filter(
            (tc) => tc.visibility === "public" && tc.enabled !== false
          );
          const examples = parseQuestionJsonField<QuestionExample[]>(
            question.examples,
            []
          );

          let casesToRun: TestCaseRecord[] = [];
          if (input !== undefined && String(input).trim() !== "") {
            // Find matching expected output if input matches a public case or example
            const matchingEx = examples.find(
              (ex) => ex.input.trim() === String(input).trim()
            );
            const matchingPub = publicCases.find(
              (tc) =>
                tc.inputArgs.trim() === String(input).trim() ||
                formatArgsForDisplay(tc.inputArgs, fnConfig.parameters).trim() ===
                  String(input).trim()
            );
            casesToRun = [
              {
                name: matchingPub?.name || "Custom / Sample Input",
                inputArgs: String(input).trim(),
                expectedOutput:
                  matchingPub?.expectedOutput ||
                  matchingEx?.output ||
                  "",
                visibility: "public",
                enabled: true,
              },
            ];
          } else if (
            exampleIndex !== undefined &&
            examples[Number(exampleIndex)]
          ) {
            const ex = examples[Number(exampleIndex)];
            casesToRun = [
              {
                name: `Example ${Number(exampleIndex) + 1}`,
                inputArgs: ex.input,
                expectedOutput: ex.output,
                visibility: "public",
                enabled: true,
              },
            ];
          } else if (publicCases.length > 0) {
            casesToRun = publicCases;
          } else if (examples.length > 0) {
            casesToRun = examples.map((ex, i) => ({
              name: `Example ${i + 1}`,
              inputArgs: ex.input,
              expectedOutput: ex.output,
              visibility: "public",
              enabled: true,
            }));
          }

          if (casesToRun.length > 0) {
            try {
              const evalSummary = await evaluateQuestionCode({
                question,
                sourceCode: source_code,
                language,
                testCases: casesToRun,
                includePrivateDetails: false,
              });

              const firstCase = evalSummary.caseResults[0];
              return res.json({
                stdout: firstCase?.actualOutput ?? evalSummary.userStdout ?? "",
                stderr: evalSummary.runtimeError,
                compile_output: evalSummary.compileError,
                status: {
                  id: evalSummary.compileError
                    ? 6
                    : evalSummary.runtimeError
                    ? 11
                    : 3,
                  description: evalSummary.status,
                },
                evaluation: evalSummary,
              });
            } catch (harnessErr: any) {
              return res.json({
                stdout: "",
                stderr: harnessErr?.message || "Invalid input arguments",
                compile_output: null,
                status: { id: 11, description: "Input / Execution Error" },
              });
            }
          }
        }

        // Legacy driverCode fallback if no functionConfig
        let finalSourceCode = source_code;
        if (question.driverCode) {
          const parsed =
            typeof question.driverCode === "string"
              ? JSON.parse(question.driverCode)
              : question.driverCode;
          const driver = parsed[language] || "";
          if (driver) {
            finalSourceCode = driver.replace("{{STUDENT_CODE}}", source_code);
          }
        }

        try {
          const execData = await executeCodeWithFallback({
            sourceCode: finalSourceCode,
            language,
            stdin: input,
          });

          return res.json({
            stdout: execData.stdout,
            stderr: execData.stderr,
            compile_output: execData.compile_output,
            status: execData.status,
          });
        } catch (apiError: any) {
          console.error("Execution Error:", apiError.message);
          return res.status(503).json({
            message: "Compiler service is currently unavailable.",
          });
        }
      }
    }

    const execData = await executeCodeWithFallback({
      sourceCode: source_code,
      language,
      stdin: input,
    });

    res.json({
      stdout: execData.stdout,
      stderr: execData.stderr,
      compile_output: execData.compile_output,
      status: execData.status,
    });
  } catch (error) {
    console.error("[RUN CODE] Error:", error);
    res.status(500).json({ message: "Error running code" });
  }
};

/**
 * Evaluates a single question submission against ALL enabled test cases (public + private) on the server.
 * Never returns private test case inputs or expected outputs to the student.
 */
export const submitQuestionCode = async (req: AuthRequest, res: Response) => {
  try {
    await ensureTimerTables();
    const studentId = req.user!.id;
    const questionId = Number(req.params.id || req.body.question_id);
    const { source_code = "", language = "Python" } = req.body;

    if (!questionId || isNaN(questionId)) {
      return res.status(400).json({ message: "Valid question ID is required" });
    }

    const question = await db
      .select()
      .from(questions)
      .where(eq(questions.id, questionId))
      .get();

    if (!question) {
      return res.status(404).json({ message: "Question not found" });
    }

    // Check active session and server deadline
    const session = await db
      .select()
      .from(assessmentSessions)
      .where(
        and(
          eq(assessmentSessions.studentId, studentId),
          eq(assessmentSessions.assessmentId, question.testId)
        )
      )
      .orderBy(desc(assessmentSessions.id))
      .get();

    if (session) {
      if (session.status !== "active") {
        return res.status(403).json({
          message:
            session.status === "expired"
              ? "Assessment time has expired. Late submissions are rejected."
              : "Assessment has already been finalized.",
          expired: session.status === "expired",
        });
      }

      const config = await getOrCreateTimerConfig(question.testId);
      const gracePeriodMs = (config?.gracePeriodSeconds ?? 15) * 1000;

      if (session.timerEnabled && session.deadlineAt) {
        const deadlineMs = new Date(session.deadlineAt).getTime();
        if (Date.now() > deadlineMs + gracePeriodMs) {
          await evaluateAndFinalizeSubmission({
            studentId,
            assessmentId: question.testId,
            sessionId: session.id,
            finalStatus: "expired",
          });
          return res.status(403).json({
            message:
              "Assessment deadline has passed. Your saved code was automatically submitted.",
            expired: true,
          });
        }
      }

      // Save latest code draft in session
      const existingDrafts: Record<string, any> =
        typeof session.drafts === "string"
          ? JSON.parse(session.drafts || "{}")
          : (session.drafts as any) || {};
      existingDrafts[String(question.id)] = {
        sourceCode: source_code,
        language,
        updatedAt: new Date().toISOString(),
      };
      await db
        .update(assessmentSessions)
        .set({
          drafts: existingDrafts,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(assessmentSessions.id, session.id))
        .execute();
    }

    const allTestCases = await getQuestionTestCasesFromDb(question.id);
    const evaluation = await evaluateQuestionCode({
      question,
      sourceCode: source_code,
      language,
      testCases: allTestCases,
      includePrivateDetails: false, // Never expose private inputs/expected outputs to student
    });

    const nowIso = new Date().toISOString();
    const insertedSub = await db
      .insert(submissions)
      .values({
        studentId,
        questionId: question.id,
        language,
        sourceCode: source_code,
        output: evaluation.formattedReport,
        status: evaluation.verdict,
        submittedAt: nowIso,
      })
      .returning()
      .get();

    await db
      .insert(submissionStatistics)
      .values({
        submissionId: insertedSub.id,
        executionTime: evaluation.executionTime,
        memoryUsed: evaluation.memoryUsed,
        compileStatus: evaluation.compileError ? "ERROR" : "OK",
        runtimeStatus: evaluation.runtimeError ? "ERROR" : "OK",
        score: evaluation.score,
      })
      .execute();

    return res.json({
      message: "Solution evaluated on server",
      submissionId: insertedSub.id,
      evaluation,
    });
  } catch (error: any) {
    console.error("[SUBMIT QUESTION CODE] Error:", error);
    return res.status(500).json({
      message: error?.message || "Error evaluating submission",
    });
  }
};

export const submitCode = async (req: AuthRequest, res: Response) => {
  try {
    await ensureTimerTables();
    const studentId = req.user!.id;
    const {
      submissions: payloadSubmissions,
      sessionId,
      isAutoSubmit: topLevelAutoSubmit,
      reason,
    } = req.body;

    if (!payloadSubmissions || !Array.isArray(payloadSubmissions)) {
      return res.status(400).json({
        message: "Invalid payload format. Expected { submissions: [] }",
      });
    }

    const student = await db
      .select()
      .from(students)
      .where(eq(students.id, studentId))
      .get();
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    // Determine assessmentId from first submission question or session
    let assessmentId: number | null = null;
    for (const sub of payloadSubmissions) {
      const q = await db
        .select()
        .from(questions)
        .where(eq(questions.id, Number(sub.question_id)))
        .get();
      if (q) {
        assessmentId = q.testId;
        break;
      }
    }

    const anyAutoSubmit =
      Boolean(topLevelAutoSubmit) ||
      payloadSubmissions.some((s: any) => Boolean(s.isAutoSubmit));

    if (assessmentId) {
      const session = sessionId
        ? await db
            .select()
            .from(assessmentSessions)
            .where(
              and(
                eq(assessmentSessions.id, Number(sessionId)),
                eq(assessmentSessions.studentId, studentId)
              )
            )
            .get()
        : await db
            .select()
            .from(assessmentSessions)
            .where(
              and(
                eq(assessmentSessions.assessmentId, assessmentId),
                eq(assessmentSessions.studentId, studentId)
              )
            )
            .orderBy(desc(assessmentSessions.id))
            .get();

      if (session) {
        if (session.status !== "active") {
          if (anyAutoSubmit) {
            return res.json({
              message: "Assessment already finalized",
              status: session.status,
              alreadyFinalized: true,
            });
          }
          return res.status(403).json({
            code: "SESSION_ALREADY_CLOSED",
            expired: session.status === "expired",
            status: session.status,
            message:
              session.status === "expired"
                ? "Assessment time has expired. Late submissions are rejected."
                : "You have already submitted this assessment.",
          });
        }

        const config = await getOrCreateTimerConfig(assessmentId);
        const gracePeriodMs = (config?.gracePeriodSeconds ?? 15) * 1000;

        if (session.timerEnabled && session.deadlineAt) {
          const deadlineMs = new Date(session.deadlineAt).getTime();
          const nowMs = Date.now();

          if (!anyAutoSubmit && nowMs > deadlineMs + gracePeriodMs) {
            await evaluateAndFinalizeSubmission({
              studentId,
              assessmentId,
              sessionId: session.id,
              finalStatus: "expired",
            });
            return res.status(403).json({
              code: "DEADLINE_EXCEEDED",
              expired: true,
              status: "expired",
              message:
                "Submission rejected: Assessment deadline has passed. Your last saved draft was automatically submitted.",
            });
          }
        }

        const isExpiryAuto =
          anyAutoSubmit &&
          reason !== "malpractice" &&
          Boolean(
            session.timerEnabled &&
              session.deadlineAt &&
              Date.now() >= new Date(session.deadlineAt).getTime() - 5000
          );

        const result = await evaluateAndFinalizeSubmission({
          studentId,
          assessmentId,
          sessionId: session.id,
          submissionItems: payloadSubmissions,
          finalStatus: isExpiryAuto ? "expired" : "submitted",
          isMalpracticeAutoSubmit: reason === "malpractice",
        });

        return res.json({
          message: "Code submitted successfully",
          status: result.status,
          alreadyFinalized: result.alreadyFinalized,
          evaluations: result.evaluations,
        });
      }

      // If no session existed yet (legacy fallback), finalize via evaluateAndFinalizeSubmission
      const result = await evaluateAndFinalizeSubmission({
        studentId,
        assessmentId,
        submissionItems: payloadSubmissions,
        finalStatus:
          anyAutoSubmit && reason !== "malpractice" ? "expired" : "submitted",
        isMalpracticeAutoSubmit: reason === "malpractice",
      });

      return res.json({
        message: "Code submitted successfully",
        status: result.status,
        alreadyFinalized: result.alreadyFinalized,
        evaluations: result.evaluations,
      });
    }

    res.json({ message: "Code submitted successfully" });
  } catch (error) {
    console.error("[SUBMIT CODE] Error:", error);
    res.status(500).json({ message: "Error submitting code" });
  }
};

export const getSubmissions = async (req: AuthRequest, res: Response) => {
  try {
    const studentId = req.user!.id;
    const subs = await db
      .select()
      .from(submissions)
      .where(eq(submissions.studentId, studentId))
      .orderBy(desc(submissions.submittedAt))
      .all();
    res.json(subs);
  } catch (error) {
    res.status(500).json({ message: "Error fetching submissions" });
  }
};
