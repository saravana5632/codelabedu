// @ts-nocheck
import { Response } from "express";
import { db } from "../db/index.js";
import { tests, questions, submissions, testAttempts } from "../db/schema.js";
import { generateWrapperCode } from "../lib/judgeWrapper.js";
import { eq, desc, and } from "drizzle-orm";
import { AuthRequest } from "../middleware/authMiddleware.js";
import axios from "axios";

export const getTests = async (req: AuthRequest, res: Response) => {
  try {
    const studentId = req.user?.id;
    const allTests = await db.select().from(tests).where(eq(tests.status, "published")).orderBy(desc(tests.id)).all();
    
    if (studentId) {
      const attempts = await db.select()
      .from(testAttempts)
      .where(and(eq(testAttempts.studentId, studentId), eq(testAttempts.status, 'completed')))
      .all();

      const completedTestIds = new Set(attempts.map(a => a.testId));
      
      const availableTests = allTests.filter(t => !completedTestIds.has(t.id));
      return res.json(availableTests);
    }

    res.json(allTests);
  } catch (error) {
    console.error("Error fetching tests", error);
    res.status(500).json({ message: "Error fetching tests" });
  }
};

function seedShuffle<T>(array: T[], seed: number): T[] {
  const result = [...array];
  let m = result.length, t, i;
  let currentSeed = seed;
  while (m) {
    currentSeed = (currentSeed * 9301 + 49297) % 233280;
    const rnd = currentSeed / 233280;
    i = Math.floor(rnd * m);
    m--;
    t = result[m];
    result[m] = result[i];
    result[i] = t;
  }
  return result;
}

export const getTestDetails = async (req: AuthRequest, res: Response) => {
  try {
    const testId = parseInt(req.params.id);
    const studentId = req.user?.id || 1;
    const test = await db.select().from(tests).where(eq(tests.id, testId)).get();
    if (!test) return res.status(404).json({ message: "Test not found" });

    // Check if attempt exists, if not create one
    let attempt = await db.select().from(testAttempts)
      .where(and(eq(testAttempts.studentId, studentId), eq(testAttempts.testId, testId)))
      .get();
      
    if (!attempt) {
      attempt = await db.insert(testAttempts).values({
        studentId,
        testId,
        status: 'in_progress',
        startedAt: new Date().toISOString()
      }).returning().get();
    }

    const testQuestions = await db.select().from(questions).where(eq(questions.testId, testId)).all();

    // Randomize question order based on student ID + test ID seed
    const randomizedQuestions = seedShuffle(testQuestions, studentId * 100 + testId);

    // Also get existing submissions for this test
    const existingSubmissions = await db.select()
      .from(submissions)
      .where(and(
         eq(submissions.studentId, studentId),
         eq(submissions.testId, testId)
      ))
      .all();

    res.json({ ...test, attempt, questions: randomizedQuestions, submissions: existingSubmissions });
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

function prepareExecutableCode(sourceCode: string, language: string): string {
  if (!sourceCode) return sourceCode;

  if (language === "Python") {
    if (sourceCode.includes("class Solution") && !sourceCode.includes("__main__") && !sourceCode.includes("input(")) {
      return `${sourceCode}

import sys, json, ast

if __name__ == '__main__':
    raw_input = sys.stdin.read().strip()
    if raw_input:
        lines = [l.strip() for l in raw_input.splitlines() if l.strip()]
        try:
            sol = Solution()
            methods = [m for m in dir(sol) if not m.startswith('_') and callable(getattr(sol, m))]
            if methods:
                method = getattr(sol, methods[0])
                args = []
                for l in lines:
                    try:
                        args.append(json.loads(l))
                    except:
                        try:
                            args.append(ast.literal_eval(l))
                        except:
                            args.append(l)
                res = method(*args)
                if res is not None:
                    if isinstance(res, (list, dict, bool)):
                        print(json.dumps(res, separators=(",", ":")))
                    else:
                        print(res)
        except Exception as e:
            print(f"Driver Error: {e}", file=sys.stderr)
`;
    }
  } else if (language === "JavaScript") {
    if (sourceCode.includes("class Solution") && !sourceCode.includes("fs.readFileSync") && !sourceCode.includes("readline") && !sourceCode.includes("process.stdin")) {
      return `${sourceCode}

if (typeof process !== 'undefined') {
  const fs = require('fs');
  const raw = fs.readFileSync(0, 'utf-8').trim();
  if (raw) {
    const lines = raw.split('\\n').map(l => l.trim()).filter(Boolean);
    try {
      const sol = new Solution();
      const proto = Object.getPrototypeOf(sol);
      const methods = Object.getOwnPropertyNames(proto).filter(m => m !== 'constructor' && typeof sol[m] === 'function');
      if (methods.length > 0) {
        const fn = sol[methods[0]];
        const args = lines.map(l => {
          try { return JSON.parse(l); } catch(e) { return l; }
        });
        const res = fn.apply(sol, args);
        if (res !== undefined) {
          console.log(typeof res === 'object' ? JSON.stringify(res) : res);
        }
      }
    } catch(e) {
      console.error(e);
    }
  }
}
`;
    }
  } else if (language === "Java") {
    if (sourceCode.includes("class Solution") && !sourceCode.includes("public static void main")) {
      return `${sourceCode}


class Main {
    public static void main(String[] args) {
        try {
            java.util.Scanner sc = new java.util.Scanner(System.in);
            java.util.List<String> lines = new java.util.ArrayList<>();
            while (sc.hasNextLine()) {
                String line = sc.nextLine().trim();
                if (!line.isEmpty()) lines.add(line);
            }
            if (lines.isEmpty()) return;
            Solution sol = new Solution();
            java.lang.reflect.Method[] methods = Solution.class.getDeclaredMethods();
            if (methods.length > 0) {
                java.lang.reflect.Method m = methods[0];
                Class<?>[] paramTypes = m.getParameterTypes();
                java.lang.reflect.Type[] genTypes = m.getGenericParameterTypes();
                Object[] invokeArgs = new Object[paramTypes.length];
                for (int i = 0; i < paramTypes.length && i < lines.size(); i++) {
                    invokeArgs[i] = parseValue(lines.get(i), paramTypes[i], genTypes[i]);
                }
                Object res = m.invoke(sol, invokeArgs);
                printResult(res);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
    
    private static Object parseValue(String val, Class<?> pt, java.lang.reflect.Type gt) {
        if (pt == int.class || pt == Integer.class) return Integer.parseInt(val);
        if (pt == long.class || pt == Long.class) return Long.parseLong(val);
        if (pt == double.class || pt == Double.class) return Double.parseDouble(val);
        if (pt == float.class || pt == Float.class) return Float.parseFloat(val);
        if (pt == boolean.class || pt == Boolean.class) return Boolean.parseBoolean(val);
        if (pt == char.class || pt == Character.class) {
            return val.replace("\\"", "").replace("'", "").charAt(0);
        }
        if (pt == String.class) {
            if (val.length() >= 2 && val.startsWith("\\"") && val.endsWith("\\"")) {
                return val.substring(1, val.length() - 1);
            }
            return val;
        }
        if (pt.isArray()) {
            Class<?> comp = pt.getComponentType();
            if (comp.isArray()) { 
                String s = val.trim();
                if (s.length() >= 2 && s.startsWith("[") && s.endsWith("]")) {
                    s = s.substring(1, s.length() - 1);
                }
                if (s.isEmpty()) return java.lang.reflect.Array.newInstance(comp, 0);
                java.util.List<String> rows = new java.util.ArrayList<>();
                int depth = 0;
                StringBuilder sb = new StringBuilder();
                for (char c : s.toCharArray()) {
                    if (depth == 0 && c == ',') continue;
                    if (c == '[') depth++;
                    else if (c == ']') depth--;
                    sb.append(c);
                    if (depth == 0 && c == ']') {
                        rows.add(sb.toString());
                        sb.setLength(0);
                    }
                }
                Object arr = java.lang.reflect.Array.newInstance(comp, rows.size());
                for (int i = 0; i < rows.size(); i++) {
                    java.lang.reflect.Array.set(arr, i, parseValue(rows.get(i), comp, comp));
                }
                return arr;
            } else {
                String s = val.trim();
                if (s.length() >= 2 && s.startsWith("[") && s.endsWith("]")) {
                    s = s.substring(1, s.length() - 1);
                }
                if (s.isEmpty()) return java.lang.reflect.Array.newInstance(comp, 0);
                java.util.List<String> parts = new java.util.ArrayList<>();
                boolean inQuote = false;
                StringBuilder sb = new StringBuilder();
                for (char c : s.toCharArray()) {
                    if (c == '"') inQuote = !inQuote;
                    if (c == ',' && !inQuote) {
                        parts.add(sb.toString());
                        sb.setLength(0);
                    } else {
                        sb.append(c);
                    }
                }
                parts.add(sb.toString());
                
                Object arr = java.lang.reflect.Array.newInstance(comp, parts.size());
                for (int i = 0; i < parts.size(); i++) {
                    java.lang.reflect.Array.set(arr, i, parseValue(parts.get(i).trim(), comp, comp));
                }
                return arr;
            }
        }
        if (pt == java.util.List.class) {
            Class<?> comp = String.class;
            if (gt instanceof java.lang.reflect.ParameterizedType) {
                java.lang.reflect.Type tArg = ((java.lang.reflect.ParameterizedType)gt).getActualTypeArguments()[0];
                if (tArg == Integer.class) comp = Integer.class;
                else if (tArg == String.class) comp = String.class;
            }
            String s = val.trim();
            if (s.length() >= 2 && s.startsWith("[") && s.endsWith("]")) {
                s = s.substring(1, s.length() - 1);
            }
            java.util.List<Object> list = new java.util.ArrayList<>();
            if (s.isEmpty()) return list;
            
            java.util.List<String> parts = new java.util.ArrayList<>();
            boolean inQuote = false;
            StringBuilder sb = new StringBuilder();
            for (char c : s.toCharArray()) {
                if (c == '"') inQuote = !inQuote;
                if (c == ',' && !inQuote) {
                    parts.add(sb.toString());
                    sb.setLength(0);
                } else {
                    sb.append(c);
                }
            }
            parts.add(sb.toString());
            
            for (String part : parts) {
                list.add(parseValue(part.trim(), comp, comp));
            }
            return list;
        }
        return val;
    }
    
    private static void printResult(Object res) {
        if (res == null) {
            System.out.println("null");
        } else if (res.getClass().isArray()) {
            if (res.getClass().getComponentType().isArray()) {
                System.out.println(java.util.Arrays.deepToString((Object[]) res).replace(" ", ""));
            } else {
                Class<?> comp = res.getClass().getComponentType();
                if (comp == int.class) System.out.println(java.util.Arrays.toString((int[])res).replace(" ", ""));
                else if (comp == long.class) System.out.println(java.util.Arrays.toString((long[])res).replace(" ", ""));
                else if (comp == double.class) System.out.println(java.util.Arrays.toString((double[])res).replace(" ", ""));
                else if (comp == float.class) System.out.println(java.util.Arrays.toString((float[])res).replace(" ", ""));
                else if (comp == boolean.class) System.out.println(java.util.Arrays.toString((boolean[])res).replace(" ", ""));
                else if (comp == char.class) System.out.println(java.util.Arrays.toString((char[])res).replace(" ", ""));
                else {
                    Object[] arr = (Object[]) res;
                    System.out.print("[");
                    for (int i = 0; i < arr.length; i++) {
                        if (arr[i] instanceof String) System.out.print("\\"" + arr[i] + "\\"");
                        else System.out.print(arr[i]);
                        if (i < arr.length - 1) System.out.print(",");
                    }
                    System.out.println("]");
                }
            }
        } else if (res instanceof java.util.List) {
            java.util.List<?> list = (java.util.List<?>) res;
            System.out.print("[");
            for (int i = 0; i < list.size(); i++) {
                Object item = list.get(i);
                if (item instanceof String) System.out.print("\\"" + item + "\\"");
                else System.out.print(item);
                if (i < list.size() - 1) System.out.print(",");
            }
            System.out.println("]");
        } else {
            System.out.println(res);
        }
    }
}

`;
    }
  }

  return sourceCode;
}

export const runCode = async (req: AuthRequest, res: Response) => {
  try {
    const { question_id, source_code, language } = req.body;
    const language_id = languageMap[language];
    if (!language_id) {
      return res.status(400).json({ message: "Unsupported language" });
    }

    const question = await db.select().from(questions).where(eq(questions.id, question_id)).get();
    if (!question) {
      return res.status(404).json({ message: "Question not found" });
    }

    let finalCode = source_code;
    if (language === 'C++' || language === 'C') {
        const meta = {
            name: question.functionName || "solution",
            returnType: question.returnType || "int",
            params: typeof question.parameters === 'string' ? JSON.parse(question.parameters) : (question.parameters || [])
        };
        finalCode = generateWrapperCode(meta as any, source_code, language);
    } else {
        finalCode = prepareExecutableCode(source_code, language);
    }

    try {
      const response = await axios.post(`${JUDGE0_URL}/submissions?base64_encoded=false&wait=true`, {
        source_code: finalCode,
        language_id,
        stdin: question.sampleInput
      });

      const actualOutput = response.data.stdout ? response.data.stdout.trim() : "";
      const expectedOutput = question.sampleOutput ? question.sampleOutput.trim() : "";
      const isAccepted = actualOutput === expectedOutput && response.data.status?.id === 3;

      res.json({
        stdout: response.data.stdout,
        stderr: response.data.stderr,
        compile_output: response.data.compile_output,
        status: response.data.status,
        expected_output: question.sampleOutput,
        passed: isAccepted
      });
    } catch (apiError: any) {
      console.error("Judge0 API Error:", apiError.message);
      res.json({
        stdout: null,
        stderr: "Error connecting to compiler service.",
        compile_output: null,
        status: { description: "Error" },
        passed: false
      });
    }
  } catch (error) {
    res.status(500).json({ message: "Error running code" });
  }
};

export const submitCode = async (req: AuthRequest, res: Response) => {
  try {
    const studentId = req.user!.id;
    const { question_id, source_code, language } = req.body;
    
    const language_id = languageMap[language];
    if (!language_id) {
      return res.status(400).json({ message: "Unsupported language" });
    }

    const question = await db.select().from(questions).where(eq(questions.id, question_id)).get();
    if (!question) {
      return res.status(404).json({ message: "Question not found" });
    }

    let finalCode = source_code;
    if (language === 'C++' || language === 'C') {
        const meta = {
            name: question.functionName || "solution",
            returnType: question.returnType || "int",
            params: typeof question.parameters === 'string' ? JSON.parse(question.parameters) : (question.parameters || [])
        };
        finalCode = generateWrapperCode(meta as any, source_code, language);
    } else {
        finalCode = prepareExecutableCode(source_code, language);
    }

    const testCases = [
      { input: question.sampleInput, expected: question.sampleOutput },
      { input: question.privateInput1, expected: question.privateOutput1 },
      { input: question.privateInput2, expected: question.privateOutput2 }
    ].filter(tc => tc.input !== null && tc.expected !== null);

    let finalStatus = "Accepted";
    
    for (const tc of testCases) {
      try {
        const response = await axios.post(`${JUDGE0_URL}/submissions?base64_encoded=false&wait=true`, {
          source_code: finalCode,
          language_id,
          stdin: tc.input
        });

        const statusId = response.data.status?.id;
        
        if (statusId !== 3) {
          finalStatus = response.data.status?.description || "Error";
          break;
        }

        const actualOutput = response.data.stdout ? response.data.stdout.trim() : "";
        const expectedOutput = tc.expected ? tc.expected.trim() : "";

        if (actualOutput !== expectedOutput) {
          finalStatus = "Wrong Answer";
          break;
        }
      } catch (e) {
        finalStatus = "Compilation Error";
        break;
      }
    }

    const submission = await db.insert(submissions).values({
      studentId,
      testId: question.testId,
      questionId: question_id,
      language,
      sourceCode: source_code,
      output: finalStatus,
      status: finalStatus,
      submittedAt: new Date().toISOString()
    }).returning().get();

    res.json({ message: "Submitted successfully", submission, finalStatus });
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

export const finishTest = async (req: AuthRequest, res: Response) => {
  try {
    const testId = parseInt(req.params.id);
    const studentId = req.user?.id;
    if (!studentId) return res.status(401).json({ message: "Unauthorized" });
    
    await db.update(testAttempts)
      .set({ status: "completed", completedAt: new Date().toISOString() })
      .where(and(eq(testAttempts.studentId, studentId), eq(testAttempts.testId, testId)))
      .execute();

    res.json({ message: "Assessment completed successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error finishing test" });
  }
};

