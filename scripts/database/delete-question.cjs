// delete-question.cjs
// Deletes a question by id (and any submissions tied to it, to avoid FK issues).
//
// Usage: node delete-question.cjs <questionId>

require("dotenv").config();
const { createClient } = require("@libsql/client");

const client = createClient({
  url: process.env.DATABASE_URL || "file:data/codelab.db",
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

async function main() {
  const questionId = Number(process.argv[2]);
  if (!questionId) {
    console.error("Usage: node delete-question.cjs <questionId>");
    process.exit(1);
  }

  const q = await client.execute({
    sql: `SELECT id, title, test_id FROM questions WHERE id = ?`,
    args: [questionId],
  });

  if (q.rows.length === 0) {
    console.error(`Question #${questionId} not found.`);
    process.exit(1);
  }

  console.log(`Deleting question #${questionId} ("${q.rows[0].title}") from test #${q.rows[0].test_id}`);

  const subs = await client.execute({
    sql: `DELETE FROM submissions WHERE question_id = ?`,
    args: [questionId],
  });
  console.log(`- Removed ${subs.rowsAffected} submission(s) tied to this question`);

  await client.execute({
    sql: `DELETE FROM questions WHERE id = ?`,
    args: [questionId],
  });

  console.log("Done.");
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
