const fs = require('fs');
let content = fs.readFileSync('src/pages/faculty/TestManagement.tsx', 'utf8');

content = content.replace(
  /\{testQuestions\.length > 0 && \(/,
  ''
);

content = content.replace(
  /<\/div>\n              <\/div>\n            \)}/,
  '</div>\n              </div>'
);

fs.writeFileSync('src/pages/faculty/TestManagement.tsx', content);
