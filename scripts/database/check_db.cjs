const { createClient } = require('@libsql/client');
const client = createClient({ url: 'file:data/codelab.db' });
async function run() {
  try {
    const rs = await client.execute("SELECT name FROM sqlite_master WHERE type='table'");
    console.log(rs.rows);
  } catch (e) {
    console.error(e);
  }
}
run();
