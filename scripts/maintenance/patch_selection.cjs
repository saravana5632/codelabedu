const fs = require('fs');
const path = 'src/pages/TestSelectionPage.tsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  /const existingSelection = sessionStorage\.getItem\(\`selectedQuestions_\$\{user\.id\}_\$\{testId\}\`\);/,
  `const isSubmitted = sessionStorage.getItem(\`submitted_test_\${user.id}_\${testId}\`);
    if (isSubmitted === "true") {
      alert("You have already submitted this assessment.");
      navigate("/student", { replace: true });
      return;
    }
    const existingSelection = sessionStorage.getItem(\`selectedQuestions_\${user.id}_\${testId}\`);`
);

fs.writeFileSync(path, code);
