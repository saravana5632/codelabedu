const fs = require('fs');
let code = fs.readFileSync('src/lib/judgeWrapper.ts', 'utf-8');

code = code.replace(/replaceAll\(" ", ""\)/g, 'replace(" ", "")');
code = code.replace(/replaceAll\("\^\\\\"\|\\\\"\$", ""\)/g, 'replace("\\"", "").replace("\\"", "")');
code = code.replace(/replaceAll\("\^\\\\\\"\|\\\\\\"\$", ""\)/g, 'replace("\\"", "").replace("\\"", "")');

fs.writeFileSync('src/lib/judgeWrapper.ts', code);
console.log("Patched judgeWrapper.ts!");
