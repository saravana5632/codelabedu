const fs = require('fs');
const path = 'src/controllers/student.ts';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(/output: \`Test Case 1: \$\{testCase1Result\}, Test Case 2: \$\{testCase2Result\}\\nScore: \$\{questionMarks\}\/50\`,/, "output: finalOutputText,");

fs.writeFileSync(path, code);
