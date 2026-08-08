require("dotenv").config();

const { createClient } = require("@libsql/client");

const client = createClient({
  url: process.env.DATABASE_URL,
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

async function check() {
  try {
    const students = await client.execute(
      "SELECT COUNT(*) AS count FROM students"
    );

    const faculty = await client.execute(
      "SELECT COUNT(*) AS count FROM faculty"
    );

    console.log("STUDENTS:", students.rows);
    console.log("FACULTY:", faculty.rows);

    const facultyData = await client.execute(
      "SELECT * FROM faculty"
    );

    console.log("FACULTY DATA:", facultyData.rows);
  } catch (error) {
    console.error("ERROR:", error);
  }
}

check();