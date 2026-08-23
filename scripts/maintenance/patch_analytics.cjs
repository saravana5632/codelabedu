const fs = require('fs');
let code = fs.readFileSync('src/controllers/analytics.ts', 'utf8');

code = code.replace(
  /const rawSubs = await db\.select\(\{\s+id: submissions\.id,\s+studentId: submissions\.studentId,\s+language: submissions\.language,\s+status: submissions\.status,\s+submittedAt: submissions\.submittedAt\s+\}\)\.from\(submissions\)\.where\(inArray\(submissions\.questionId, qIds\)\)\.all\(\);/,
  `const rawSubs = await db.select({
      id: submissions.id,
      studentId: submissions.studentId,
      language: submissions.language,
      status: submissions.status,
      submittedAt: submissions.submittedAt,
      rollNumber: students.rollNumber,
      studentName: students.name
    }).from(submissions)
      .innerJoin(students, eq(submissions.studentId, students.id))
      .where(inArray(submissions.questionId, qIds)).all();`
);

fs.writeFileSync('src/controllers/analytics.ts', code);
