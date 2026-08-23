require("dotenv").config();

const { createClient } = require("@libsql/client");

const db = createClient({
  url: process.env.DATABASE_URL,
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

async function createTables() {
  try {
    console.log("Connecting to Turso...");

    // =========================
    // TESTS
    // =========================
    await db.execute(`
      CREATE TABLE IF NOT EXISTS tests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        subject TEXT NOT NULL,
        faculty_id INTEGER,
        duration INTEGER NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'draft',
        FOREIGN KEY (faculty_id) REFERENCES faculty(id)
      )
    `);

    console.log("tests table ready.");

    // =========================
    // QUESTIONS
    // =========================
    await db.execute(`
      CREATE TABLE IF NOT EXISTS questions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        test_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        constraints TEXT,
        input_format TEXT,
        output_format TEXT,
        sample_input TEXT,
        sample_output TEXT,
        starter_code TEXT,
        driver_code TEXT,
        notes TEXT,
        difficulty TEXT DEFAULT 'medium',
        FOREIGN KEY (test_id) REFERENCES tests(id)
      )
    `);

    console.log("questions table ready.");

    // =========================
    // SUBMISSIONS
    // =========================
    await db.execute(`
      CREATE TABLE IF NOT EXISTS submissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER NOT NULL,
        question_id INTEGER NOT NULL,
        language TEXT NOT NULL,
        source_code TEXT NOT NULL,
        output TEXT,
        status TEXT NOT NULL,
        submitted_at TEXT NOT NULL,
        FOREIGN KEY (student_id) REFERENCES students(id),
        FOREIGN KEY (question_id) REFERENCES questions(id)
      )
    `);

    console.log("submissions table ready.");

    // =========================
    // TEST COMPLETIONS
    // =========================
    await db.execute(`
      CREATE TABLE IF NOT EXISTS test_completions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER NOT NULL,
        test_id INTEGER NOT NULL,
        completed_at TEXT NOT NULL,
        FOREIGN KEY (student_id) REFERENCES students(id),
        FOREIGN KEY (test_id) REFERENCES tests(id)
      )
    `);

    console.log("test_completions table ready.");

    // =========================
    // TEST ANALYTICS
    // =========================
    await db.execute(`
      CREATE TABLE IF NOT EXISTS test_analytics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        test_id INTEGER NOT NULL,
        total_students INTEGER DEFAULT 0,
        started_count INTEGER DEFAULT 0,
        submitted_count INTEGER DEFAULT 0,
        pass_count INTEGER DEFAULT 0,
        fail_count INTEGER DEFAULT 0,
        average_score REAL DEFAULT 0,
        highest_score REAL DEFAULT 0,
        lowest_score REAL DEFAULT 0,
        average_execution_time REAL DEFAULT 0,
        created_at TEXT NOT NULL,
        FOREIGN KEY (test_id) REFERENCES tests(id)
      )
    `);

    console.log("test_analytics table ready.");

    // =========================
    // SUBMISSION STATISTICS
    // =========================
    await db.execute(`
      CREATE TABLE IF NOT EXISTS submission_statistics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        submission_id INTEGER NOT NULL,
        execution_time REAL,
        memory_used REAL,
        compile_status TEXT,
        runtime_status TEXT,
        score REAL DEFAULT 0,
        FOREIGN KEY (submission_id) REFERENCES submissions(id)
      )
    `);

    console.log("submission_statistics table ready.");

    console.log("\nAll tables created successfully.");

    // =========================
    // SHOW TABLES
    // =========================
    const result = await db.execute(`
      SELECT name
      FROM sqlite_master
      WHERE type = 'table'
      ORDER BY name
    `);

    console.log("\nTURSO TABLES:");
    console.table(result.rows);

  } catch (error) {
    console.error("\nDATABASE ERROR:");
    console.error(error);
    process.exit(1);
  }
}

createTables();