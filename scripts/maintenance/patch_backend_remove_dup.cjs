const fs = require('fs');
const path = 'src/controllers/student.ts';
let code = fs.readFileSync(path, 'utf8');

const dupRegex = /let hasIdenticalSubmissions = false;[\s\S]*?hasIdenticalSubmissions = true;\s*\}\s*\}/;
code = code.replace(dupRegex, '');

const overrideRegex = /if \(hasIdenticalSubmissions\) \{\s*validation = \{ isValid: false, detected: "Identical submission for both questions", required: question\.title \};\s*\}/;
code = code.replace(overrideRegex, '');

fs.writeFileSync(path, code);
