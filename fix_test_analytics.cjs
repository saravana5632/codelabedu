const fs = require('fs');
let code = fs.readFileSync('src/pages/faculty/TestAnalytics.tsx', 'utf8');

code = code.replace(
  /\.filter\(\(s:any\) => \(s\.rollNumber\?\.toLowerCase\(\)\.includes\(searchTerm\.toLowerCase\(\)\) \|\| s\.studentName\?\.toLowerCase\(\)\.includes\(searchTerm\.toLowerCase\(\)\)\)\(searchTerm\.toLowerCase\(\)\)\)/,
  `.filter((s:any) => s.rollNumber?.toLowerCase().includes(searchTerm.toLowerCase()) || s.studentName?.toLowerCase().includes(searchTerm.toLowerCase()))`
);

fs.writeFileSync('src/pages/faculty/TestAnalytics.tsx', code);
