const fs = require('fs');
const path = 'src/controllers/student.ts';
let code = fs.readFileSync(path, 'utf8');

// 1. Add identical code detection before the loop
const beforeLoopRegex = /const webhookUrl = process\.env\.APPS_SCRIPT_WEBHOOK_URL;/;
const duplicateCheck = `const webhookUrl = process.env.APPS_SCRIPT_WEBHOOK_URL;
    
    // Check for identical submissions
    let hasIdenticalSubmissions = false;
    if (payloadSubmissions.length === 2) {
      const code1 = (payloadSubmissions[0].source_code || "").replace(/\\s+/g, '');
      const code2 = (payloadSubmissions[1].source_code || "").replace(/\\s+/g, '');
      if (code1 === code2 && code1.length > 0) {
        hasIdenticalSubmissions = true;
      }
    }`;
code = code.replace(beforeLoopRegex, duplicateCheck);

// 2. Add validation in the loop
const scoringRegex = /const questionMarks = testCasesPassed \* 25;\s*const verdict = testCasesPassed === 2 \? "PASSED" : testCasesPassed === 1 \? "PARTIAL" : "FAILED";/;

const newScoring = `
      let validation = validateAlgorithm(source_code, question.title);
      if (hasIdenticalSubmissions) {
          validation = { isValid: false, detected: "Identical submission for both questions", required: question.title };
      }
      
      let questionMarks = testCasesPassed * 25;
      if (!validation.isValid) {
          questionMarks = 0;
      }
      
      const verdict = questionMarks === 50 ? "PASSED" : (questionMarks === 25 ? "PARTIAL" : "FAILED");
      
      const finalOutputText = \`Test Case 1: \${testCase1Result}\\nTest Case 2: \${testCase2Result}\\n\\nAlgorithm Validation: \${validation.isValid ? "PASSED" : "FAILED"}\\nRequired Algorithm: \${validation.required}\\nDetected Algorithm: \${validation.detected}\\n\\nQuestion Score: \${questionMarks}/50\`;
`;
code = code.replace(scoringRegex, newScoring);

// 3. Update the db insert to use the new output string
const dbInsertRegex = /output: \`Test Case 1: \\\$\\{testCase1Result\\}, Test Case 2: \\\$\\{testCase2Result\\}\\\\nScore: \\\$\\{questionMarks\\}\/50\`,/;
code = code.replace(dbInsertRegex, 'output: finalOutputText,');

fs.writeFileSync(path, code);
