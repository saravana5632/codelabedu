const fs = require('fs');
const path = 'src/pages/CodingPage.tsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  /alert\(\`Assessment Submitted Successfully\\n\\nYour assessment has been finalized.\`\);\n\s*navigate\("\/student"\);/,
  `const user = JSON.parse(localStorage.getItem("user") || "{}");
      sessionStorage.removeItem(\`selectedQuestions_\${user.id}_\${testId}\`);
      sessionStorage.setItem(\`submitted_test_\${user.id}_\${testId}\`, "true");
      alert(\`Assessment Submitted Successfully\\n\\nYour assessment has been finalized.\`);
      navigate("/student", { replace: true });`
);

fs.writeFileSync(path, code);
