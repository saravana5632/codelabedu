const fs = require('fs');
const path = 'src/pages/CodingPage.tsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  /alert\("Test automatically submitted due to excessive malpractice violations."\);\n\s*navigate\("\/student"\);/,
  `const user = JSON.parse(localStorage.getItem("user") || "{}");
      sessionStorage.removeItem(\`selectedQuestions_\${user.id}_\${testId}\`);
      sessionStorage.setItem(\`submitted_test_\${user.id}_\${testId}\`, "true");
      alert("Test automatically submitted due to excessive malpractice violations.");
      navigate("/student", { replace: true });`
);

fs.writeFileSync(path, code);
