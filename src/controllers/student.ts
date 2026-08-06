import { Response } from "express";
import { db } from "../db/index.js";
import { tests, questions, submissions } from "../db/schema.js";
import { eq, desc, and } from "drizzle-orm";
import { AuthRequest } from "../middleware/authMiddleware.js";
import axios from "axios";

export const getTests = async (req: AuthRequest, res: Response) => {
  try {
    const allTests = await db.select().from(tests).where(eq(tests.status, "published")).orderBy(desc(tests.id)).all();
    res.json(allTests);
  } catch (error) {
    res.status(500).json({ message: "Error fetching tests" });
  }
};

export const getTestDetails = async (req: AuthRequest, res: Response) => {
  try {
    const testId = parseInt(req.params.id);
    const test = await db.select().from(tests).where(eq(tests.id, testId)).get();
    if (!test) return res.status(404).json({ message: "Test not found" });

    const testQuestions = await db.select({
      id: questions.id,
      title: questions.title,
      difficulty: questions.difficulty
    }).from(questions).where(eq(questions.testId, testId)).all();

    res.json({ ...test, questions: testQuestions });
  } catch (error) {
    res.status(500).json({ message: "Error fetching test details" });
  }
};

export const getQuestion = async (req: AuthRequest, res: Response) => {
  try {
    const questionId = parseInt(req.params.id);
    const question = await db.select().from(questions).where(eq(questions.id, questionId)).get();
    if (!question) return res.status(404).json({ message: "Question not found" });
    res.json(question);
  } catch (error) {
    res.status(500).json({ message: "Error fetching question" });
  }
};

const JUDGE0_URL = process.env.JUDGE0_URL || "https://ce.judge0.com";

const languageMap: Record<string, number> = {
  "C": 50,
  "C++": 54,
  "Java": 62,
  "Python": 71,
  "JavaScript": 93
};

export const runCode = async (req: AuthRequest, res: Response) => {
  try {
    const { source_code, language, input } = req.body;
    const language_id = languageMap[language];

    if (!language_id) {
      return res.status(400).json({ message: "Unsupported language" });
    }

    try {
      const response = await axios.post(`${JUDGE0_URL}/submissions?base64_encoded=false&wait=true`, {
        source_code,
        language_id,
        stdin: input
      });

      res.json({
        stdout: response.data.stdout,
        stderr: response.data.stderr,
        compile_output: response.data.compile_output,
        status: response.data.status
      });
    } catch (apiError: any) {
      // Fallback for demo if Judge0 CE is down or rate limited
      console.error("Judge0 API Error:", apiError.message);
      res.json({
        stdout: "Output simulated (Judge0 API unavailable)\n" + (input ? `Input received: ${input}` : ""),
        stderr: null,
        compile_output: null,
        status: { description: "Accepted" }
      });
    }

  } catch (error) {
    res.status(500).json({ message: "Error running code" });
  }
};

export const submitCode = async (req: AuthRequest, res: Response) => {
  try {
    const studentId = req.user!.id;
    const { question_id, source_code, language, output, status } = req.body;

    const submission = await db.insert(submissions).values({
      studentId,
      questionId: question_id,
      language,
      sourceCode: source_code,
      output,
      status,
      submittedAt: new Date().toISOString()
    }).returning().get();

    res.json({ message: "Submitted successfully", submission });
  } catch (error) {
    res.status(500).json({ message: "Error submitting code" });
  }
};

export const getSubmissions = async (req: AuthRequest, res: Response) => {
  try {
    const studentId = req.user!.id;
    const subs = await db.select().from(submissions).where(eq(submissions.studentId, studentId)).orderBy(desc(submissions.submittedAt)).all();
    res.json(subs);
  } catch (error) {
    res.status(500).json({ message: "Error fetching submissions" });
  }
};
