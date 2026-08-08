require("dotenv").config();

const { createClient } = require("@libsql/client");

const client = createClient({
  url: process.env.DATABASE_URL,
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

async function fixFacultyTable() {
  try {
    console.log("Connecting to Turso...");

    await client.execute(`
      ALTER TABLE faculty ADD COLUMN email TEXT
    `);

    console.log("Added email column.");
  } catch (error) {
    if (error.message.includes("duplicate column")) {
      console.log("email column already exists.");
    } else {
      console.error("Email column error:", error.message);
    }
  }

  try {
    await client.execute(`
      ALTER TABLE faculty ADD COLUMN password TEXT
    `);

    console.log("Added password column.");
  } catch (error) {
    if (error.message.includes("duplicate column")) {
      console.log("password column already exists.");
    } else {
      console.error("Password column error:", error.message);
    }
  }

  try {
    await client.execute({
      sql: `
        INSERT INTO faculty
        (faculty_id, name, department, email, password)
        VALUES (?, ?, ?, ?, ?)
      `,
      args: [
        "FAC001",
        "Admin",
        "Computer Science",
        "admin@codelab.edu",
        "password123"
      ],
    });

    console.log("Faculty account created successfully.");
  } catch (error) {
    console.error("Faculty insert error:", error.message);
  }

  const result = await client.execute(
    "SELECT * FROM faculty"
  );

  console.log("FACULTY DATA:");
  console.table(result.rows);
}

fixFacultyTable();