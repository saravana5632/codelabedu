import { Response } from "express";
import { db } from "../db/index.js";
import { tests, questions, submissions, students, submissionStatistics, testAnalytics, malpracticeLogs, codeSimilarity } from "../db/schema.js";
import { eq, desc, inArray } from "drizzle-orm";
import { AuthRequest } from "../middleware/authMiddleware.js";

export const getAllStudents = async (req: AuthRequest, res: Response) => {
  try {
    const allStudents = await db.select().from(students).all();
    res.json(allStudents);
  } catch (error) {
    res.status(500).json({ message: "Error fetching students" });
  }
};

export const importStudents = async (req: AuthRequest, res: Response) => {
  try {
    const { studentsData } = req.body;
    if (!studentsData || !Array.isArray(studentsData)) {
      return res.status(400).json({ message: "Invalid data format" });
    }

    let importedCount = 0;
    for (const s of studentsData) {
      if (s.rollNumber && s.name && s.dob) {
        // Upsert or insert if not exists
        const existing = await db.select().from(students).where(eq(students.rollNumber, s.rollNumber)).get();
        if (!existing) {
          await db.insert(students).values({
            rollNumber: s.rollNumber,
            name: s.name,
            dob: s.dob,
            department: s.department || "Computer Science",
            year: s.year || 1
          }).run();
          importedCount++;
        } else {
          // If already exists, optionally update DOB, but let's just update
          await db.update(students).set({
            name: s.name,
            dob: s.dob,
            department: s.department || "Computer Science",
            year: s.year || 1
          }).where(eq(students.rollNumber, s.rollNumber)).run();
          importedCount++;
        }
      }
    }

    res.json({ message: `Successfully imported ${importedCount} students`, count: importedCount });
  } catch (error) {
    console.error("Import error:", error);
    res.status(500).json({ message: "Error importing students" });
  }
};

export const getFacultyTests = async (req: AuthRequest, res: Response) => {
  try {
    const facultyId = req.user!.id;
    const allTests = await db.select().from(tests).where(eq(tests.facultyId, facultyId)).orderBy(desc(tests.id)).all();
    res.json(allTests);
  } catch (error) {
    res.status(500).json({ message: "Error fetching tests" });
  }
};

export const createTest = async (req: AuthRequest, res: Response) => {
  try {
    const facultyId = req.user!.id;
    const { title, subject, duration, startTime, endTime } = req.body;

    const test = await db.insert(tests).values({
      title,
      subject,
      facultyId,
      duration,
      startTime,
      endTime,
      status: "draft"
    }).returning().get();

    res.json({ message: "Test created", test });
  } catch (error) {
    res.status(500).json({ message: "Error creating test" });
  }
};

export const updateTest = async (req: AuthRequest, res: Response) => {
  try {
    const testId = parseInt(req.params.id);
    const { title, subject, duration, startTime, endTime, status } = req.body;

    const test = await db.update(tests).set({
      title,
      subject,
      duration,
      startTime,
      endTime,
      status
    }).where(eq(tests.id, testId)).returning().get();

    res.json({ message: "Test updated", test });
  } catch (error) {
    res.status(500).json({ message: "Error updating test" });
  }
};

export const checkTestSubmissions = async (req: AuthRequest, res: Response) => {
  try {
    const testId = parseInt(req.params.id);
    const testQs = await db.select({ id: questions.id }).from(questions).where(eq(questions.testId, testId)).all();
    const qIds = testQs.map(q => q.id);
    if (qIds.length === 0) return res.json({ hasSubmissions: false });
    
    const subs = await db.select({ id: submissions.id }).from(submissions).where(inArray(submissions.questionId, qIds)).limit(1).all();
    res.json({ hasSubmissions: subs.length > 0 });
  } catch (error) {
    res.status(500).json({ message: "Error checking submissions" });
  }
};

export const deleteTest = async (req: AuthRequest, res: Response) => {
  try {
    const testId = parseInt(req.params.id);
    const { action } = req.body; // 'archive' or 'delete'

    const testQuestions = await db.select({ id: questions.id }).from(questions).where(eq(questions.testId, testId)).all();
    const qIds = testQuestions.map(q => q.id);

    // SQLite doesn't natively support easy nested deletes in a single command via drizzile-orm yet without extra code,
    // so we handle it based on action.
    if (action === 'archive') {
      await db.update(tests).set({ status: 'archived' }).where(eq(tests.id, testId)).execute();
      return res.json({ message: "Test archived successfully" });
    }

    if (action === 'delete') {
      if (qIds.length > 0) {
        // Find if any submissions exist
        const subs = await db.select({ id: submissions.id }).from(submissions).where(inArray(submissions.questionId, qIds)).all();
        const subIds = subs.map(s => s.id);
        
        if (subIds.length > 0) {
          await db.delete(submissionStatistics).where(inArray(submissionStatistics.submissionId, subIds)).execute();
          await db.delete(submissions).where(inArray(submissions.questionId, qIds)).execute();
        }
        await db.delete(questions).where(eq(questions.testId, testId)).execute();
      }
      
      const analytics = await db.select({ id: testAnalytics.id }).from(testAnalytics).where(eq(testAnalytics.testId, testId)).all();
      if (analytics.length > 0) {
        await db.delete(testAnalytics).where(eq(testAnalytics.testId, testId)).execute();
      }
      
      await db.delete(malpracticeLogs).where(eq(malpracticeLogs.testId, testId)).execute();
      await db.delete(codeSimilarity).where(eq(codeSimilarity.testId, testId)).execute();

      await db.delete(tests).where(eq(tests.id, testId)).execute();
      return res.json({ message: "Test permanently deleted" });
    }

    res.status(400).json({ message: "Invalid action" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting test" });
  }
};

export const duplicateTest = async (req: AuthRequest, res: Response) => {
  try {
    const testId = parseInt(req.params.id);
    const facultyId = req.user!.id;

    const originalTest = await db.select().from(tests).where(eq(tests.id, testId)).get();
    if (!originalTest) return res.status(404).json({ message: "Test not found" });

    const newTest = await db.insert(tests).values({
      title: originalTest.title + " (Copy)",
      subject: originalTest.subject,
      facultyId,
      duration: originalTest.duration,
      startTime: originalTest.startTime,
      endTime: originalTest.endTime,
      status: "draft"
    }).returning().get();

    const originalQuestions = await db.select().from(questions).where(eq(questions.testId, testId)).all();
    for (const q of originalQuestions) {
      await db.insert(questions).values({
        testId: newTest.id,
        title: q.title,
        description: q.description,
        constraints: q.constraints,
        inputFormat: q.inputFormat,
        outputFormat: q.outputFormat,
        sampleInput: q.sampleInput,
        sampleOutput: q.sampleOutput,
        notes: q.notes,
        difficulty: q.difficulty
      }).execute();
    }

    res.json({ message: "Test duplicated", test: newTest });
  } catch (error) {
    res.status(500).json({ message: "Error duplicating test" });
  }
};

export const createQuestion = async (req: AuthRequest, res: Response) => {
  try {
    const { testId, title, description, constraints, inputFormat, outputFormat, sampleInput, sampleOutput, publicExplanation, privateInput1, privateOutput1, privateInput2, privateOutput2, difficulty, functionName, returnType, parameters } = req.body;

    const question = await db.insert(questions).values({
      testId,
      title,
      description,
      constraints,
      inputFormat,
      outputFormat,
      sampleInput,
      sampleOutput,
      publicExplanation,
      privateInput1,
      privateOutput1,
      privateInput2,
      privateOutput2,
      difficulty,
      functionName,
      returnType,
      parameters
    }).returning().get();

    res.json({ message: "Question added", question });
  } catch (error) {
    res.status(500).json({ message: "Error adding question" });
  }
};

export const getTestResults = async (req: AuthRequest, res: Response) => {
  try {
    const testId = parseInt(req.params.testId);
    
    // Get all questions for the test
    const testQuestions = await db.select({ id: questions.id }).from(questions).where(eq(questions.testId, testId)).all();
    const questionIds = testQuestions.map(q => q.id);

    if (questionIds.length === 0) {
      return res.json([]);
    }

    // Since SQLite driver doesn't support 'inArray' in some older drizzle versions cleanly without setup, let's fetch all and filter
    const allSubmissions = await db.select({
      id: submissions.id,
      language: submissions.language,
      status: submissions.status,
      submittedAt: submissions.submittedAt,
      sourceCode: submissions.sourceCode,
      questionId: submissions.questionId,
      studentName: students.name,
      studentRoll: students.rollNumber
    }).from(submissions)
      .innerJoin(students, eq(submissions.studentId, students.id))
      .all();

    const testSubmissions = allSubmissions.filter(sub => questionIds.includes(sub.questionId));

    res.json(testSubmissions);
  } catch (error) {
    console.error("Result error:", error);
    res.status(500).json({ message: "Error fetching results" });
  }
};

export const getTestQuestions = async (req: AuthRequest, res: Response) => {
  try {
    const testId = parseInt(req.params.id);
    const testQs = await db.select().from(questions).where(eq(questions.testId, testId)).all();
    res.json(testQs);
  } catch (error) {
    res.status(500).json({ message: "Error fetching test questions" });
  }
};

export const updateQuestion = async (req: AuthRequest, res: Response) => {
  try {
    const questionId = parseInt(req.params.id);
    const { title, description, constraints, inputFormat, outputFormat, sampleInput, sampleOutput, publicExplanation, difficulty, functionName, returnType, parameters, privateInput1, privateOutput1, privateInput2, privateOutput2 } = req.body;
    
    if (!title) return res.status(400).json({ message: "Title is required" });

    const existing = await db.select().from(questions).where(eq(questions.id, questionId)).get();
    if (!existing) return res.status(404).json({ message: "Question not found" });

    const updated = await db.update(questions).set({
      title, description, constraints, inputFormat, outputFormat, sampleInput, sampleOutput, publicExplanation, difficulty, functionName, returnType, parameters, privateInput1, privateOutput1, privateInput2, privateOutput2
    }).where(eq(questions.id, questionId)).returning().get();
    
    res.json({ message: "Question updated successfully", question: updated });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error updating question" });
  }
};

export const deleteQuestion = async (req: AuthRequest, res: Response) => {
  try {
    const questionId = parseInt(req.params.id);
    
    const question = await db.select().from(questions).where(eq(questions.id, questionId)).get();
    if (!question) return res.status(404).json({ message: "Question not found" });

    const test = await db.select().from(tests).where(eq(tests.id, question.testId)).get();
    
    const subs = await db.select({ id: submissions.id }).from(submissions).where(eq(submissions.questionId, questionId)).all();
    
    if (test?.status !== 'draft' && subs.length > 0) {
      return res.status(409).json({ message: "Cannot delete question after students have submitted." });
    }
    
    await db.delete(questions).where(eq(questions.id, questionId)).execute();
    res.json({ message: "Question deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error deleting question" });
  }
};
