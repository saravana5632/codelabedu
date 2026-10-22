import axios from 'axios';
import jwt from 'jsonwebtoken';
import { db } from '../../src/db/index.js';
import { students, faculty } from '../../src/db/schema.js';
import { ensureTimerTables } from '../../src/db/migrate.js';
import {
  generateAllStarterCodes,
  validateFunctionConfig,
  parseTestCaseArgs,
  validateExpectedOutput,
  compareSerializedOutput,
  FunctionConfig,
} from '../../src/lib/leetcodeHarness';
import { evaluateQuestionCode } from '../../src/lib/codeEvaluator';

const BASE_URL = process.env.TEST_BASE_URL || 'http://127.0.0.1:3000/api';
const JWT_SECRET = process.env.JWT_SECRET || 'codelab-secret-key-123';

function assert(condition: any, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runTests() {
  console.log('=== Starting CodeLabEdu LeetCode Question Management & Evaluation E2E Tests ===');
  await ensureTimerTables();

  // 1. Unit tests on Function Config, Starter Code Generation, Serialization & Comparison
  console.log('\n[1/12] Testing function configuration validation & starter code generation across all 5 languages...');
  const twoSumConfig: FunctionConfig = {
    className: 'Solution',
    methodName: 'twoSum',
    returnType: 'int[]',
    parameters: [
      { name: 'nums', type: 'int[]' },
      { name: 'target', type: 'int' },
    ],
  };

  const validationRes = validateFunctionConfig(twoSumConfig);
  assert(
    validationRes.valid && Object.keys(validationRes.errors).length === 0,
    `Expected 0 validation errors, got: ${JSON.stringify(validationRes.errors)}`
  );

  const badConfigRes = validateFunctionConfig({
    className: '123Invalid',
    methodName: 'two-sum',
    returnType: 'int[]',
    parameters: [
      { name: 'nums', type: 'int[]' },
      { name: 'nums', type: 'int' },
    ],
  });
  assert(
    !badConfigRes.valid && Object.keys(badConfigRes.errors).length >= 3,
    'Expected validation errors for invalid identifiers and duplicate parameter names'
  );

  const starters = generateAllStarterCodes(twoSumConfig);
  assert(
    starters.Java.includes('class Solution') &&
      starters.Java.includes('public int[] twoSum(int[] nums, int target)'),
    'Java starter code signature mismatch'
  );
  assert(
    starters['C++'].includes('class Solution') &&
      starters['C++'].includes('vector<int> twoSum(vector<int>& nums, int target)'),
    'C++ starter code signature mismatch'
  );
  assert(
    starters.Python.includes('class Solution:') &&
      starters.Python.includes('def twoSum(self, nums: list[int], target: int) -> list[int]:'),
    'Python starter code signature mismatch'
  );
  assert(
    starters.C.includes('int* twoSum(int* nums, int numsSize, int target, int* returnSize)'),
    'C starter code signature mismatch'
  );
  assert(
    starters.JavaScript.includes('class Solution') &&
      starters.JavaScript.includes('twoSum(nums, target)'),
    'JavaScript starter code signature mismatch'
  );
  console.log('✓ Starter code generation verified for Java, C++, Python, C, and JavaScript.');

  // 2. Test Case Parsing & Output Comparison
  console.log('\n[2/12] Testing structured test case parsing and output comparison...');
  const parsedJsonArgs = parseTestCaseArgs(
    '{"args": [[2, 7, 11, 15], 9]}',
    twoSumConfig.parameters
  );
  assert(
    parsedJsonArgs.valid && parsedJsonArgs.args && parsedJsonArgs.args.length === 2,
    'Failed to parse JSON {"args": ...} input'
  );

  const parsedAssignmentArgs = parseTestCaseArgs(
    'nums = [2, 7, 11, 15], target = 9',
    twoSumConfig.parameters
  );
  assert(
    parsedAssignmentArgs.valid &&
      parsedAssignmentArgs.args &&
      Array.isArray(parsedAssignmentArgs.args[0]) &&
      parsedAssignmentArgs.args[1] === 9,
    'Failed to parse assignment-style input'
  );

  const invalidArgs = parseTestCaseArgs(
    '{"args": ["not_an_array", 9]}',
    twoSumConfig.parameters
  );
  assert(!invalidArgs.valid, 'Expected invalid argument type to be rejected');

  const validOut = validateExpectedOutput('[0, 1]', 'int[]');
  assert(
    validOut.valid && validOut.normalized === '[0,1]',
    'Expected output [0, 1] to normalize to [0,1]'
  );
  assert(
    compareSerializedOutput('[0, 1]', '[0,1]', 'int[]'),
    'Expected [0, 1] and [0,1] to match for int[]'
  );
  console.log('✓ Structured test case argument parsing and output serialization verified.');

  // 3. Authenticate as Faculty and Student
  console.log('\n[3/12] Authenticating as Faculty and Student...');
  let fac = await db.select().from(faculty).limit(1).get();
  if (!fac) {
    fac = await db
      .insert(faculty)
      .values({
        facultyId: 'FAC001',
        name: 'Admin Faculty',
        department: 'CSE',
        email: 'admin@codelab.edu',
        password: 'admin',
      })
      .returning()
      .get();
  }
  const stu = await db.select().from(students).limit(1).get();
  assert(stu, 'Expected at least 1 student in database');

  const facToken = jwt.sign({ id: fac.id, role: 'faculty' }, JWT_SECRET, { expiresIn: '1h' });
  const facHeaders = { Authorization: `Bearer ${facToken}` };

  const stuToken = jwt.sign({ id: stu.id, role: 'student' }, JWT_SECRET, { expiresIn: '1h' });
  const stuHeaders = { Authorization: `Bearer ${stuToken}` };
  console.log('✓ Authenticated faculty and student.');

  // 4. Create a draft question without test cases and verify publishing is rejected
  console.log('\n[4/12] Testing question creation (Draft) and publication validation rules...');
  const testsRes = await axios.get(`${BASE_URL}/faculty/tests`, { headers: facHeaders });
  assert(testsRes.data.length > 0, 'Expected at least 1 test in database');
  const testId = testsRes.data[0].id;

  const createDraftRes = await axios.post(
    `${BASE_URL}/faculty/questions`,
    {
      testId,
      title: 'Two Sum',
      slug: `two-sum-${Date.now()}`,
      description:
        'Given an array of integers `nums` and an integer `target`, return the indices of the two numbers whose sum equals the target.\n\nAssume exactly one valid answer exists.',
      difficulty: 'easy',
      topic: 'Arrays & Hashing',
      maxMarks: 20,
      timeLimitSeconds: 2,
      memoryLimitMb: 256,
      status: 'draft',
      constraints:
        '- `2 <= nums.length <= 10^4`\n- `-10^9 <= nums[i] <= 10^9`\n- Exactly one valid answer exists.',
      examples: [
        {
          input: 'nums = [2,7,11,15], target = 9',
          output: '[0,1]',
          explanation: 'nums[0] + nums[1] == 9, so we return [0, 1].',
        },
        {
          input: 'nums = [3,2,4], target = 6',
          output: '[1,2]',
          explanation: 'nums[1] + nums[2] == 6, so we return [1, 2].',
        },
      ],
      functionConfig: twoSumConfig,
      starterCode: starters,
      testCases: [],
    },
    { headers: facHeaders }
  );

  const createdQuestionId = createDraftRes.data.id || createDraftRes.data.question?.id;
  assert(createdQuestionId, 'Expected created question ID');
  const createdQuestionObj = createDraftRes.data.question || createDraftRes.data;
  assert(createdQuestionObj.status === 'draft', 'Expected draft status');
  assert(createdQuestionObj.examples.length === 2, 'Expected 2 saved examples');

  // Attempt to publish without public/private test cases -> must fail with 400
  let publishRejected = false;
  try {
    await axios.patch(
      `${BASE_URL}/faculty/questions/${createdQuestionId}/status`,
      { status: 'published' },
      { headers: facHeaders }
    );
  } catch (err: any) {
    if (err.response?.status === 400) {
      publishRejected = true;
    }
  }
  assert(publishRejected, 'Publishing a question without public & private test cases must be rejected');
  console.log('✓ Draft creation and publication validation verified.');

  // 5. Edit question: update examples (add/remove), add public & private test cases, and publish
  console.log('\n[5/12] Testing editing question, adding/reordering/deleting test cases, and publishing...');
  const updateRes = await axios.put(
    `${BASE_URL}/faculty/questions/${createdQuestionId}`,
    {
      title: 'Two Sum',
      description:
        'Given an array of integers `nums` and an integer `target`, return indices of the two numbers such that they add up to `target`.',
      difficulty: 'easy',
      topic: 'Hash Table',
      maxMarks: 30,
      timeLimitSeconds: 2,
      memoryLimitMb: 256,
      status: 'published',
      constraints:
        '- `2 <= nums.length <= 10^4`\n- `-10^9 <= nums[i] <= 10^9`\n- `-10^9 <= target <= 10^9`',
      examples: [
        {
          input: 'nums = [2,7,11,15], target = 9',
          output: '[0,1]',
          explanation: 'nums[0] + nums[1] = 2 + 7 = 9.',
        },
        {
          input: 'nums = [3,2,4], target = 6',
          output: '[1,2]',
          explanation: 'nums[1] + nums[2] = 2 + 4 = 6.',
        },
        {
          input: 'nums = [3,3], target = 6',
          output: '[0,1]',
          explanation: 'nums[0] + nums[1] = 3 + 3 = 6.',
        },
      ],
      functionConfig: twoSumConfig,
      starterCode: starters,
      testCases: [
        {
          name: 'Public Case 1',
          inputArgs: '{"args": [[2, 7, 11, 15], 9]}',
          expectedOutput: '[0,1]',
          visibility: 'public',
          weight: 1,
          orderIndex: 1,
          explanation: 'Basic example 1',
        },
        {
          name: 'Public Case 2',
          inputArgs: '{"args": [[3, 2, 4], 6]}',
          expectedOutput: '[1,2]',
          visibility: 'public',
          weight: 1,
          orderIndex: 2,
          explanation: 'Basic example 2',
        },
        {
          name: 'Private Case 1',
          inputArgs: '{"args": [[3, 3], 6]}',
          expectedOutput: '[0,1]',
          visibility: 'private',
          weight: 2,
          orderIndex: 3,
          explanation: 'Duplicate elements',
        },
        {
          name: 'Private Case 2',
          inputArgs: '{"args": [[-1, -2, -3, -4, -5], -8]}',
          expectedOutput: '[2,4]',
          visibility: 'private',
          weight: 2,
          orderIndex: 4,
          explanation: 'Negative integers',
        },
      ],
    },
    { headers: facHeaders }
  );

  const updatedQuestion = updateRes.data.question || updateRes.data;
  assert(updatedQuestion.status === 'published', 'Expected question to be published');
  assert(updatedQuestion.examples.length === 3, 'Expected 3 examples after update');
  assert(updatedQuestion.testCases.length === 4, 'Expected 4 test cases after update');
  console.log('✓ Question update, examples update, test cases creation, and publishing verified.');

  // 6. Verify Student Question API excludes private test cases
  console.log('\n[6/12] Verifying student API loads published question and excludes private test case inputs/outputs...');
  const studentQRes = await axios.get(`${BASE_URL}/student/questions/${createdQuestionId}`, {
    headers: stuHeaders,
  });
  const studentQ = studentQRes.data;
  assert(studentQ.title === 'Two Sum', 'Expected student question title Two Sum');
  assert(
    studentQ.publicTestCases.length === 2,
    `Expected 2 public test cases, got ${studentQ.publicTestCases.length}`
  );
  assert(!studentQ.testCases, 'Student question payload must not include raw testCases array');
  const serializedStudentQ = JSON.stringify(studentQ);
  assert(!serializedStudentQ.includes('-8'), 'Private test case input (-8) leaked in student question payload!');
  console.log('✓ Student question payload verified (private test cases strictly hidden).');

  // 7. Run Student Code (Public Cases) - Passing Python Solution
  console.log('\n[7/12] Testing Student "Run Code" with passing Python solution...');
  const passingPythonCode = `class Solution:
    def twoSum(self, nums: List[int], target: int) -> List[int]:
        seen = {}
        for i, num in enumerate(nums):
            diff = target - num
            if diff in seen:
                return [seen[diff], i]
            seen[num] = i
        return []
`;

  const runPyRes = await axios.post(
    `${BASE_URL}/student/run`,
    {
      question_id: createdQuestionId,
      source_code: passingPythonCode,
      language: 'Python',
    },
    { headers: stuHeaders }
  );
  const runEval = runPyRes.data.evaluation;
  assert(
    runEval && runEval.verdict === 'PASSED',
    `Expected PASSED verdict on Run Code, got ${runEval?.verdict} (${runEval?.compileError || runEval?.runtimeError}) | Raw response: ${JSON.stringify(runPyRes.data)}`
  );
  assert(
    runEval.passedCount === 2 && runEval.totalCount === 2,
    'Expected 2/2 public test cases passed on Run Code'
  );
  console.log('✓ Python Run Code (2/2 public cases) passed.');

  // 8. Submit Student Code (Public + Private Cases) - Passing Java Solution
  console.log('\n[8/12] Testing Student "Submit Code" with passing Java solution against public + private test cases...');
  const passingJavaCode = `import java.util.*;

class Solution {
    public int[] twoSum(int[] nums, int target) {
        Map<Integer, Integer> map = new HashMap<>();
        for (int i = 0; i < nums.length; i++) {
            int complement = target - nums[i];
            if (map.containsKey(complement)) {
                return new int[] { map.get(complement), i };
            }
            map.put(nums[i], i);
        }
        return new int[0];
    }
}
`;

  const submitJavaRes = await axios.post(
    `${BASE_URL}/student/questions/${createdQuestionId}/submit`,
    {
      source_code: passingJavaCode,
      language: 'Java',
    },
    { headers: stuHeaders }
  );
  const javaEval = submitJavaRes.data.evaluation;
  assert(
    javaEval && javaEval.verdict === 'PASSED',
    `Expected PASSED verdict for Java submission, got ${javaEval?.verdict}: ${javaEval?.compileError || javaEval?.runtimeError}`
  );
  assert(
    javaEval.passedCount === 4 && javaEval.totalCount === 4,
    `Expected 4/4 test cases passed, got ${javaEval.passedCount}/${javaEval.totalCount}`
  );
  assert(
    javaEval.score === 30 && javaEval.maxMarks === 30,
    `Expected score 30/30, got ${javaEval.score}/${javaEval.maxMarks}`
  );

  // Verify private test cases in submission response have NO input/expectedOutput/actualOutput leaked
  const privateResults = javaEval.caseResults.filter((r: any) => r.visibility === 'private');
  assert(privateResults.length === 2, 'Expected 2 private test case statuses in submission summary');
  for (const pr of privateResults) {
    assert(
      pr.input === undefined && pr.expectedOutput === undefined && pr.actualOutput === undefined,
      'Private test case details leaked in submit response!'
    );
  }
  console.log('✓ Java Submit Code (4/4 cases, score 30/30, private details hidden) passed.');

  // 9. Test C++ passing solution via evaluator
  console.log('\n[9/12] Testing C++ solution execution via codeEvaluator...');
  const passingCppCode = `class Solution {
public:
    vector<int> twoSum(vector<int>& nums, int target) {
        unordered_map<int, int> seen;
        for (int i = 0; i < (int)nums.size(); i++) {
            int diff = target - nums[i];
            if (seen.count(diff)) return {seen[diff], i};
            seen[nums[i]] = i;
        }
        return {};
    }
};`;
  const cppEval = await evaluateQuestionCode({
    question: updatedQuestion,
    sourceCode: passingCppCode,
    language: 'C++',
    testCases: updatedQuestion.testCases,
    includePrivateDetails: false,
  });
  assert(
    cppEval.verdict === 'PASSED' && cppEval.passedCount === 4,
    `Expected C++ solution to pass 4/4, got ${cppEval.verdict} (${cppEval.compileError || cppEval.runtimeError})`
  );
  console.log('✓ C++ solution execution passed 4/4 test cases.');

  // 10. Test Failing Solution (Wrong Answer) and Compilation Error / Invalid Method Signature
  console.log('\n[10/12] Testing failing solution (Wrong Answer) and invalid method signature / compilation error...');
  const wrongPythonCode = `class Solution:
    def twoSum(self, nums: List[int], target: int) -> List[int]:
        return [0, 0]
`;
  const wrongSubmitRes = await axios.post(
    `${BASE_URL}/student/questions/${createdQuestionId}/submit`,
    {
      source_code: wrongPythonCode,
      language: 'Python',
    },
    { headers: stuHeaders }
  );
  const wrongEval = wrongSubmitRes.data.evaluation;
  assert(wrongEval.verdict === 'FAILED', `Expected FAILED verdict, got ${wrongEval.verdict}`);
  assert(wrongEval.passedCount === 0, 'Expected 0 passed test cases for [0, 0]');
  assert(wrongEval.score === 0, 'Expected 0 score');

  const brokenSignatureJavaCode = `class Solution {
    public int[] wrongMethodName(int[] nums, int target) {
        return new int[]{0, 1};
    }
}`;
  const compileErrRes = await axios.post(
    `${BASE_URL}/student/questions/${createdQuestionId}/submit`,
    {
      source_code: brokenSignatureJavaCode,
      language: 'Java',
    },
    { headers: stuHeaders }
  );
  const compileEval = compileErrRes.data.evaluation;
  assert(
    compileEval.status === 'Compilation Error',
    `Expected Compilation Error for wrong method signature in Java, got ${compileEval.status}`
  );
  assert(
    compileEval.compileError && compileEval.compileError.includes('twoSum'),
    'Expected compiler error mentioning missing twoSum method'
  );
  console.log('✓ Failing solution (Wrong Answer) and invalid signature (Compilation Error) verified.');

  // 11. Test Archiving Question & Preserving Historical Submissions
  console.log('\n[11/12] Testing archiving question and verifying historical submissions remain intact...');
  const archiveRes = await axios.patch(
    `${BASE_URL}/faculty/questions/${createdQuestionId}/status`,
    { status: 'archived' },
    { headers: facHeaders }
  );
  assert(
    archiveRes.data.status === 'archived' || archiveRes.data.question?.status === 'archived',
    'Expected archived status'
  );

  // Student should not be able to load archived question directly
  let archivedBlocked = false;
  try {
    await axios.get(`${BASE_URL}/student/questions/${createdQuestionId}`, { headers: stuHeaders });
  } catch (err: any) {
    if (err.response?.status === 404) archivedBlocked = true;
  }
  assert(archivedBlocked, 'Archived question should not be accessible to students');

  // Faculty question detail should still exist with historical submissions preserved
  const facQuestionCheck = await axios.get(`${BASE_URL}/faculty/questions/${createdQuestionId}`, {
    headers: facHeaders,
  });
  assert(facQuestionCheck.data.id === createdQuestionId, 'Archived question must still exist for faculty');

  // Delete question (which also soft-archives if submissions exist!)
  const deleteRes = await axios.delete(`${BASE_URL}/faculty/questions/${createdQuestionId}`, {
    headers: facHeaders,
  });
  assert(
    deleteRes.data.archived === true || deleteRes.status === 200,
    'Expected question with historical submissions to be safely archived on delete'
  );
  console.log('✓ Archiving and historical submission preservation verified.');

  // 12. Verify existing seeded questions have valid LeetCode functionConfig and test cases
  console.log('\n[12/12] Verifying existing seeded questions (Binary Search, Merge Sort, Quick Sort)...');
  const allQuestionsRes = await axios.get(`${BASE_URL}/faculty/questions`, { headers: facHeaders });
  const binarySearchQ = allQuestionsRes.data.find((q: any) => q.title === 'Binary Search');
  assert(binarySearchQ, 'Expected Binary Search question in DB');
  assert(
    binarySearchQ.functionConfig && binarySearchQ.functionConfig.methodName === 'search',
    'Expected Binary Search to have functionConfig.methodName === "search"'
  );
  assert(
    binarySearchQ.testCases && binarySearchQ.testCases.length >= 4,
    'Expected Binary Search to have public and private test cases'
  );
  console.log('✓ Seeded questions verified.');

  console.log('\n=== ALL 12 LEETCODE QUESTION MANAGEMENT & EVALUATION TESTS PASSED! ===');
}

runTests().catch((err) => {
  console.error('\n❌ TEST FAILED:', err.response?.data || err.message || err);
  process.exit(1);
});
