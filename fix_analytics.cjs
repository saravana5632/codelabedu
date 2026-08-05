const fs = require('fs');
let content = fs.readFileSync('src/controllers/analytics.ts', 'utf8');

const regex = /\/\/ Stats\n[\s\S]*?(?=\/\/ Language Usage)/;
const replacement = `// Aggregate by student
    const studentAggregates: Record<number, any> = {};
    allSubs.forEach(s => {
      if (!studentAggregates[s.studentId]) {
        studentAggregates[s.studentId] = {
          studentId: s.studentId,
          studentRoll: s.studentRoll,
          studentName: s.studentName,
          score: 0,
          execTimeMs: 0,
          submittedAt: s.submittedAt // latest
        };
      }
      studentAggregates[s.studentId].score += s.score;
      studentAggregates[s.studentId].execTimeMs += (s.execTimeMs || 0);
      if (new Date(s.submittedAt) > new Date(studentAggregates[s.studentId].submittedAt)) {
        studentAggregates[s.studentId].submittedAt = s.submittedAt;
      }
    });

    const aggregatedSubs = Object.values(studentAggregates);
    const submittedCount = aggregatedSubs.length;
    const uniqueStudents = submittedCount;
    // We consider "pass" if they got > 0 on the whole assessment
    const passCount = aggregatedSubs.filter(s => s.score > 0).length;
    const failCount = submittedCount - passCount;

    let totalScore = 0;
    let highestScore = 0;
    let lowestScore = submittedCount > 0 ? 100 * qIds.length : 0;
    let totalExecTime = 0;

    aggregatedSubs.forEach(s => {
      totalScore += s.score;
      highestScore = Math.max(highestScore, s.score);
      lowestScore = Math.min(lowestScore, s.score);
      if (s.execTimeMs) totalExecTime += s.execTimeMs;
    });

    const avgScore = submittedCount > 0 ? Math.round(totalScore / submittedCount) : 0;
    if (submittedCount === 0) {
      lowestScore = 0;
    }
    const avgExecTime = submittedCount > 0 ? Math.round(totalExecTime / submittedCount) : 0;

    allSubs = aggregatedSubs as any; // Re-assign for remaining usages

    `;

content = content.replace(regex, replacement);
fs.writeFileSync('src/controllers/analytics.ts', content);
