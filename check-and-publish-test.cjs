// check-and-publish-test.cjs
//
// Shows all tests with their status, and publishes one if you pass an id.
//
// Usage:
//   node check-and-publish-test.cjs            -> lists all tests + status
//   node check-and-publish-test.cjs <testId>   -> sets that test's status to "published"

require("dotenv").config();
const { createClient } = require("@libsql/client");

const client = createClient({
  url: process.env.DATABASE_URL || "file:data/codelab.db",
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

async function main() {
  const testId = process.argv[2] ? Number(process.argv[2]) : null;

  if (!testId) {
    const all = await client.execute(`SELECT id, title, status, start_time, end_time, duration, faculty_id FROM tests ORDER BY id`);
    console.log("All tests:");
    console.table(all.rows);

    const q = await client.execute(`SELECT id, test_id, title FROM questions ORDER BY id`);
    console.log("\nAll questions:");
    console.table(q.rows);

    console.log('\nTo publish a test, run: node check-and-publish-test.cjs <testId>');
    return;
  }

  const check = await client.execute({ sql: `SELECT id, title, status FROM tests WHERE id = ?`, args: [testId] });
  if (check.rows.length === 0) {
    console.error(`Test #${testId} not found.`);
    process.exit(1);
  }

  console.log(`Test #${testId} ("${check.rows[0].title}") current status: ${check.rows[0].status}`);

  await client.execute({
    sql: `UPDATE tests SET status = 'published' WHERE id = ?`,
    args: [testId],
  });

  console.log(`Test #${testId} is now published.`);
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
