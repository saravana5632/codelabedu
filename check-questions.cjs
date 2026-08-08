require("dotenv").config();

const { createClient } = require("@libsql/client");

const client = createClient({
  url: process.env.DATABASE_URL,
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

async function check() {
  try {
    console.log("Connecting to Turso...\n");

    const tables = await client.execute(`
      SELECT name
      FROM sqlite_master
      WHERE type = 'table'
      ORDER BY name
    `);

    console.log("TURSO TABLES:");
    console.table(tables.rows);

    for (const table of tables.rows) {
      const tableName = table.name;

      if (
        tableName === "sqlite_sequence" ||
        tableName.startsWith("sqlite_")
      ) {
        continue;
      }

      console.log(`\n===== ${tableName} =====`);

      try {
        const result = await client.execute(
          `SELECT * FROM "${tableName}" LIMIT 10`
        );

        console.table(result.rows);
      } catch (error) {
        console.log(`Could not read ${tableName}:`, error.message);
      }
    }
  } catch (error) {
    console.error("TURSO ERROR:");
    console.error(error);
  }
}

check();