const fs = require('fs');
let code = fs.readFileSync('src/pages/faculty/TestAnalytics.tsx', 'utf8');

code = code.replace(
  /'Roll Number': s.studentId,/g,
  `'Roll Number': s.rollNumber,`
);

code = code.replace(
  /s.studentId, s.language,/g,
  `s.rollNumber, s.language,`
);

code = code.replace(
  /s\.studentId && s\.studentId\.toLowerCase\(\)\.includes/g,
  `(s.rollNumber?.toLowerCase().includes(searchTerm.toLowerCase()) || s.studentName?.toLowerCase().includes(searchTerm.toLowerCase()))`
);

code = code.replace(
  /<td className="px-6 py-4">\{sub.studentId\}<\/td>/g,
  `<td className="px-6 py-4">{sub.rollNumber} - {sub.studentName}</td>`
);

fs.writeFileSync('src/pages/faculty/TestAnalytics.tsx', code);
