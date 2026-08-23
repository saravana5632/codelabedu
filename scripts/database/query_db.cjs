const { createClient } = require('@libsql/client');
const client = createClient({ url: 'file:/tmp/codelab.db' });
async function run() {
  const rs = await client.execute("SELECT * FROM faculty");
  console.log("Faculty:", rs.rows);
  const rs2 = await client.execute("SELECT * FROM students LIMIT 1");
  console.log("Student:", rs2.rows);
}
run();
