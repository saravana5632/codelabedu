require("dotenv").config();

const { createClient } = require("@libsql/client");

const client = createClient({
  url: process.env.DATABASE_URL,
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

async function addFaculty() {
  try {
    console.log("Connecting to Turso...");

    await client.execute({
      sql: `
        INSERT INTO faculty (email, password)
        VALUES (?, ?)
      `,
      args: [
        "admin@codelab.edu",
        "password123"
      ],
    });

    console.log("Faculty account created successfully.");

    const result = await client.execute(
      "SELECT * FROM faculty"
    );

    console.log("FACULTY DATA:");
    console.log(result.rows);

  } catch (error) {
    console.error("FACULTY INSERT ERROR:");
    console.error(error);
  }
}

addFaculty();