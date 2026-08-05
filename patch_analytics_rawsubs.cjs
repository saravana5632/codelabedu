const fs = require('fs');
let content = fs.readFileSync('src/controllers/analytics.ts', 'utf8');

const rawSubsOld = `const rawSubs = await db.select({
      id: submissions.id,
      studentId: submissions.studentId,
      language: submissions.language,
      status: submissions.status,
      submittedAt: submissions.submittedAt
    }).from(submissions).where(inArray(submissions.questionId, qIds)).all();`;

const rawSubsNew = `const rawSubs = await db.select({
      id: submissions.id,
      studentId: submissions.studentId,
      language: submissions.language,
      status: submissions.status,
      submittedAt: submissions.submittedAt,
      studentName: students.name,
      studentRoll: students.rollNumber
    }).from(submissions)
      .innerJoin(students, eq(submissions.studentId, students.id))
      .where(inArray(submissions.questionId, qIds)).all();`;

content = content.replace(rawSubsOld, rawSubsNew);
fs.writeFileSync('src/controllers/analytics.ts', content);
