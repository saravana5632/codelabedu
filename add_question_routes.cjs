const fs = require('fs');
let content = fs.readFileSync('src/routes.ts', 'utf8');

const importOld = `createQuestion, checkTestSubmissions`;
const importNew = `createQuestion, updateQuestion, deleteQuestion, getTestQuestions, checkTestSubmissions`;
content = content.replace(importOld, importNew);

const routesOld = `app.post("/api/faculty/questions", authMiddleware, roleMiddleware("faculty"), createQuestion);`;
const routesNew = `app.get("/api/faculty/tests/:id/questions", authMiddleware, roleMiddleware("faculty"), getTestQuestions);
  app.post("/api/faculty/questions", authMiddleware, roleMiddleware("faculty"), createQuestion);
  app.put("/api/faculty/questions/:id", authMiddleware, roleMiddleware("faculty"), updateQuestion);
  app.delete("/api/faculty/questions/:id", authMiddleware, roleMiddleware("faculty"), deleteQuestion);`;
content = content.replace(routesOld, routesNew);

fs.writeFileSync('src/routes.ts', content);
