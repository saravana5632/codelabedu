import { Response } from "express";
import { db } from "../db/index.js";
import {
  tests,
  questions,
  submissions,
  students,
  submissionStatistics,
  testAnalytics
} from "../db/schema.js";
import { eq, desc, inArray, and } from "drizzle-orm";
import { AuthRequest } from "../middleware/authMiddleware.js";

// ==========================================
// GET ALL STUDENTS
// ==========================================

export const getAllStudents = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const allStudents = await db
      .select()
      .from(students)
      .all();

    return res.json(allStudents);
  } catch (error) {
    console.error("Get students error:", error);

    return res.status(500).json({
      message: "Error fetching students"
    });
  }
};

// ==========================================
// GET FACULTY TESTS
// ==========================================

export const getFacultyTests = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const facultyId = req.user!.id;

    const allTests = await db
      .select()
      .from(tests)
      .where(eq(tests.facultyId, facultyId))
      .orderBy(desc(tests.id))
      .all();

    return res.json(allTests);
  } catch (error) {
    console.error("Get faculty tests error:", error);

    return res.status(500).json({
      message: "Error fetching tests"
    });
  }
};

// ==========================================
// CREATE TEST
// ==========================================

export const createTest = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const facultyId = req.user!.id;

    const {
      title,
      subject,
      duration,
      startTime,
      endTime
    } = req.body;

    if (
      !title ||
      !subject ||
      duration === undefined ||
      !startTime ||
      !endTime
    ) {
      return res.status(400).json({
        message: "All test fields are required"
      });
    }

    const test = await db
      .insert(tests)
      .values({
        title,
        subject,
        facultyId,
        duration: Number(duration),
        startTime,
        endTime,
        status: "draft"
      })
      .returning()
      .get();

    console.log("[TEST CREATED]", test);

    return res.status(201).json({
      message: "Test created",
      test
    });
  } catch (error: any) {
    console.error("Create test error:", error);

    return res.status(500).json({
      message: "Error creating test",
      error: error.message
    });
  }
};

// ==========================================
// UPDATE TEST
// ==========================================

export const updateTest = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const testId = Number(req.params.id);
    const facultyId = req.user!.id;

    const {
      title,
      subject,
      duration,
      startTime,
      endTime,
      status
    } = req.body;

    const existingTest = await db
      .select()
      .from(tests)
      .where(
        and(
          eq(tests.id, testId),
          eq(tests.facultyId, facultyId)
        )
      )
      .get();

    if (!existingTest) {
      return res.status(404).json({
        message: "Test not found"
      });
    }

    const test = await db
      .update(tests)
      .set({
        title,
        subject,
        duration: Number(duration),
        startTime,
        endTime,
        status
      })
      .where(eq(tests.id, testId))
      .returning()
      .get();

    return res.json({
      message: "Test updated",
      test
    });
  } catch (error: any) {
    console.error("Update test error:", error);

    return res.status(500).json({
      message: "Error updating test",
      error: error.message
    });
  }
};

// ==========================================
// CREATE QUESTION
// ==========================================

export const createQuestion = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const facultyId = req.user!.id;

    const {
      testId,
      title,
      description,
      constraints,
      inputFormat,
      outputFormat,
      sampleInput,
      sampleOutput,
      starterCode,
      driverCode,
      notes,
      difficulty
    } = req.body;

    if (!testId || !title || !description) {
      return res.status(400).json({
        message: "testId, title and description are required"
      });
    }

    // Make sure the test belongs to this faculty
    const test = await db
      .select()
      .from(tests)
      .where(
        and(
          eq(tests.id, Number(testId)),
          eq(tests.facultyId, facultyId)
        )
      )
      .get();

    if (!test) {
      return res.status(404).json({
        message: "Test not found or unauthorized"
      });
    }

    const question = await db
      .insert(questions)
      .values({
        testId: Number(testId),
        title,
        description,
        constraints: constraints || null,
        inputFormat: inputFormat || null,
        outputFormat: outputFormat || null,
        sampleInput: sampleInput || null,
        sampleOutput: sampleOutput || null,
        starterCode: starterCode || null,
        driverCode: driverCode || null,
        notes: notes || null,
        difficulty: difficulty || "medium"
      })
      .returning()
      .get();

    console.log("[QUESTION CREATED]", question);

    return res.status(201).json({
      message: "Question added",
      question
    });
  } catch (error: any) {
    console.error("Create question error:", error);

    return res.status(500).json({
      message: "Error adding question",
      error: error.message
    });
  }
};

// ==========================================
// GET QUESTIONS FOR A TEST
// ==========================================

export const getTestQuestions = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const testId = Number(req.params.id);
    const facultyId = req.user!.id;

    if (!testId) {
      return res.status(400).json({
        message: "Invalid test ID"
      });
    }

    // Verify test belongs to faculty
    const test = await db
      .select()
      .from(tests)
      .where(
        and(
          eq(tests.id, testId),
          eq(tests.facultyId, facultyId)
        )
      )
      .get();

    if (!test) {
      return res.status(404).json({
        message: "Test not found or unauthorized"
      });
    }

    const testQuestions = await db
      .select()
      .from(questions)
      .where(eq(questions.testId, testId))
      .orderBy(questions.id)
      .all();

    console.log(
      `[QUESTIONS] Test ${testId}: ${testQuestions.length} questions`
    );

    return res.json(testQuestions);
  } catch (error: any) {
    console.error("Get questions error:", error);

    return res.status(500).json({
      message: "Error fetching questions",
      error: error.message
    });
  }
};

// ==========================================
// CHECK TEST SUBMISSIONS
// ==========================================

export const checkTestSubmissions = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const testId = Number(req.params.id);

    const testQs = await db
      .select({ id: questions.id })
      .from(questions)
      .where(eq(questions.testId, testId))
      .all();

    const qIds = testQs.map(q => q.id);

    if (qIds.length === 0) {
      return res.json({
        hasSubmissions: false
      });
    }

    const subs = await db
      .select({ id: submissions.id })
      .from(submissions)
      .where(inArray(submissions.questionId, qIds))
      .limit(1)
      .all();

    return res.json({
      hasSubmissions: subs.length > 0
    });
  } catch (error) {
    console.error("Check submissions error:", error);

    return res.status(500).json({
      message: "Error checking submissions"
    });
  }
};

// ==========================================
// DELETE / ARCHIVE TEST
// ==========================================

export const deleteTest = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const testId = Number(req.params.id);
    const facultyId = req.user!.id;
    const { action } = req.body;

    const test = await db
      .select()
      .from(tests)
      .where(
        and(
          eq(tests.id, testId),
          eq(tests.facultyId, facultyId)
        )
      )
      .get();

    if (!test) {
      return res.status(404).json({
        message: "Test not found"
      });
    }

    if (action === "archive") {
      await db
        .update(tests)
        .set({
          status: "archived"
        })
        .where(eq(tests.id, testId))
        .execute();

      return res.json({
        message: "Test archived successfully"
      });
    }

    if (action === "delete") {
      const testQuestions = await db
        .select({ id: questions.id })
        .from(questions)
        .where(eq(questions.testId, testId))
        .all();

      const qIds = testQuestions.map(q => q.id);

      if (qIds.length > 0) {
        const subs = await db
          .select({ id: submissions.id })
          .from(submissions)
          .where(inArray(submissions.questionId, qIds))
          .all();

        const subIds = subs.map(s => s.id);

        if (subIds.length > 0) {
          await db
            .delete(submissionStatistics)
            .where(
              inArray(
                submissionStatistics.submissionId,
                subIds
              )
            )
            .execute();

          await db
            .delete(submissions)
            .where(
              inArray(submissions.questionId, qIds)
            )
            .execute();
        }

        await db
          .delete(questions)
          .where(eq(questions.testId, testId))
          .execute();
      }

      await db
        .delete(testAnalytics)
        .where(eq(testAnalytics.testId, testId))
        .execute();

      await db
        .delete(tests)
        .where(eq(tests.id, testId))
        .execute();

      return res.json({
        message: "Test permanently deleted"
      });
    }

    return res.status(400).json({
      message: "Invalid action"
    });
  } catch (error: any) {
    console.error("Delete test error:", error);

    return res.status(500).json({
      message: "Error deleting test",
      error: error.message
    });
  }
};

// ==========================================
// DUPLICATE TEST
// ==========================================

export const duplicateTest = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const testId = Number(req.params.id);
    const facultyId = req.user!.id;

    const originalTest = await db
      .select()
      .from(tests)
      .where(eq(tests.id, testId))
      .get();

    if (!originalTest) {
      return res.status(404).json({
        message: "Test not found"
      });
    }

    const newTest = await db
      .insert(tests)
      .values({
        title: originalTest.title + " (Copy)",
        subject: originalTest.subject,
        facultyId,
        duration: originalTest.duration,
        startTime: originalTest.startTime,
        endTime: originalTest.endTime,
        status: "draft"
      })
      .returning()
      .get();

    const originalQuestions = await db
      .select()
      .from(questions)
      .where(eq(questions.testId, testId))
      .all();

    for (const q of originalQuestions) {
      await db
        .insert(questions)
        .values({
          testId: newTest.id,
          title: q.title,
          description: q.description,
          constraints: q.constraints,
          inputFormat: q.inputFormat,
          outputFormat: q.outputFormat,
          sampleInput: q.sampleInput,
          sampleOutput: q.sampleOutput,
          starterCode: q.starterCode,
          driverCode: q.driverCode,
          notes: q.notes,
          difficulty: q.difficulty
        })
        .execute();
    }

    return res.status(201).json({
      message: "Test duplicated",
      test: newTest
    });
  } catch (error: any) {
    console.error("Duplicate test error:", error);

    return res.status(500).json({
      message: "Error duplicating test",
      error: error.message
    });
  }
};

// ==========================================
// GET TEST RESULTS
// ==========================================

export const getTestResults = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const testId = Number(req.params.testId);

    const testQuestions = await db
      .select({
        id: questions.id
      })
      .from(questions)
      .where(eq(questions.testId, testId))
      .all();

    const questionIds = testQuestions.map(q => q.id);

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
        questionId: submissions.questionId,
        studentName: students.name,
        studentRoll: students.rollNumber
      })
      .from(submissions)
      .innerJoin(
        students,
        eq(submissions.studentId, students.id)
      )
      .all();

    const testSubmissions = allSubmissions.filter(
      sub => questionIds.includes(sub.questionId)
    );

    return res.json(testSubmissions);
  } catch (error) {
    console.error("Result error:", error);

    return res.status(500).json({
      message: "Error fetching results"
    });
  }
};