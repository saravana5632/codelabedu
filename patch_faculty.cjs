const fs = require('fs');
let content = fs.readFileSync('src/controllers/faculty.ts', 'utf8');

// Replace getTestQuestions, updateQuestion, deleteQuestion
const regex = /export const getTestQuestions[\s\S]*/;
const newContent = `export const getTestQuestions = async (req: AuthRequest, res: Response) => {
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
`;

content = content.replace(regex, newContent);
fs.writeFileSync('src/controllers/faculty.ts', content);
