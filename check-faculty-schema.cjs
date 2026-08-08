require("dotenv").config();

const { createClient } = require("@libsql/client");

const client = createClient({
  url: process.env.DATABASE_URL,
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

async function checkSchema() {
  try {
    const result = await client.execute(
      "PRAGMA table_info(faculty)"
    );

    console.log("FACULTY TABLE STRUCTURE:");
    console.table(result.rows);
  } catch (error) {
    console.error("ERROR:");
    console.error(error);
  }
}

checkSchema();