const fs = require('fs');
let code = fs.readFileSync('src/controllers/student.ts', 'utf-8');

const wrapperContent = fs.readFileSync('verifiedWrapper.java', 'utf-8');

let startIdx = code.indexOf('class Main {');
let endIdx = code.indexOf('`', startIdx);

if (startIdx !== -1 && endIdx !== -1) {
    let replaced = code.substring(0, startIdx) + wrapperContent + code.substring(endIdx);
    fs.writeFileSync('src/controllers/student.ts', replaced);
    console.log("Successfully replaced Java wrapper in student.ts!");
} else {
    console.log("Could not find bounds! start: " + startIdx + ", end: " + endIdx);
}
