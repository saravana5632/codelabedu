const fs = require('fs');
let content = fs.readFileSync('src/controllers/analytics.ts', 'utf8');

// Undo the allSubs reassignment
content = content.replace(/allSubs = aggregatedSubs as any; \/\/ Re-assign for remaining usages/, '');

// Replace allSubs with aggregatedSubs where appropriate
content = content.replace(/allSubs\.forEach\(s => {\n\s+if \(s\.score <= 20\)/g, 'aggregatedSubs.forEach(s => {\n      if (s.score <= 20)');

content = content.replace(/submissions: allSubs,/g, 'submissions: aggregatedSubs,');

fs.writeFileSync('src/controllers/analytics.ts', content);
