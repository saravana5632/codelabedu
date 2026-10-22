import { sql, count, eq } from "drizzle-orm";
import { db, client, resetLocalDbConnection } from "./index.js";
import {
  students,
  studentAuthMetadata,
  faculty,
  tests,
  questions,
  questionTestCases,
  assessmentTimerConfigs,
} from "./schema.js";
import {
  FunctionConfig,
  generateAllStarterCodes,
} from "../lib/leetcodeHarness.js";
import {
  SETUP_REQUIRED_SENTINEL,
  isBcryptHash,
  isDobPattern,
  hashPassword,
  deriveRegisterNumberFromRoll,
} from "../lib/passwordUtils.js";

let migrationCompleted = false;

const INITIAL_STUDENTS = [
  { rollNumber: "2024PECCB290", name: "LALU PRASAD B.P", registerNumber: 211424244290 },
  { rollNumber: "2024PECCB291", name: "LOGANATH.T", registerNumber: 211424244291 },
  { rollNumber: "2024PECCB292", name: "LOKANADHAM S", registerNumber: 211424244292 },
  { rollNumber: "2024PECCB293", name: "LOKESH.M", registerNumber: 211424244293 },
  { rollNumber: "2024PECCB295", name: "LOKESHWARAN K", registerNumber: 211424244295 },
  { rollNumber: "2024PECCB296", name: "MANOJ R", registerNumber: 211424244296 },
  { rollNumber: "2024PECCB297", name: "MANOJ KRISHNA K S", registerNumber: 211424244297 },
  { rollNumber: "2024PECCB298", name: "MATHESH J", registerNumber: 211424244298 },
  { rollNumber: "2024PECCB299", name: "MOHAMED AASEEF.M", registerNumber: 211424244299 },
  { rollNumber: "2024PECCB300", name: "MOHITH HARIHARAN V", registerNumber: 211424244300 },
  { rollNumber: "2024PECCB301", name: "NARASIMHA CHOWDARY V.C", registerNumber: 211424244301 },
  { rollNumber: "2024PECCB302", name: "NARESH.R", registerNumber: 211424244302 },
  { rollNumber: "2024PECCB303", name: "NAREN M", registerNumber: 211424244303 },
  { rollNumber: "2024PECCB304", name: "NIHAL.B", registerNumber: 211424244304 },
  { rollNumber: "2024PECCB305", name: "NIKHIL S", registerNumber: 211424244305 },
  { rollNumber: "2024PECCB306", name: "NITHEESH KUMAR K R", registerNumber: 211424244306 },
  { rollNumber: "2024PECCB307", name: "NITHISH KUMAR G", registerNumber: 211424244307 },
  { rollNumber: "2024PECCB309", name: "PAVAN K", registerNumber: 211424244309 },
  { rollNumber: "2024PECCB310", name: "PRAVIN KUMAR.A", registerNumber: 211424244310 },
  { rollNumber: "2024PECCB311", name: "PRABHA.K", registerNumber: 211424244311 },
  { rollNumber: "2024PECCB312", name: "RAGURAMAN S", registerNumber: 211424244312 },
  { rollNumber: "2024PECCB313", name: "RAHUL KAUSHIK .L", registerNumber: 211424244313 },
  { rollNumber: "2024PECCB314", name: "RAJARAJAN N", registerNumber: 211424244314 },
  { rollNumber: "2024PECCB316", name: "RITHICK MURUGAN", registerNumber: 211424244316 },
  { rollNumber: "2024PECCB317", name: "ROHITH J", registerNumber: 211424244317 },
  { rollNumber: "2024PECCB318", name: "ROHITH SARAVANAN", registerNumber: 211424244318 },
  { rollNumber: "2024PECCB319", name: "ROHITH.V.K", registerNumber: 211424244319 },
  { rollNumber: "2024PECCB320", name: "RUBEN HALL JASTER.F", registerNumber: 211424244320 },
  { rollNumber: "2024PECCB321", name: "SABARISH J", registerNumber: 211424244321 },
  { rollNumber: "2024PECCB322", name: "SABARISH R", registerNumber: 211424244322 },
  { rollNumber: "2024PECCB323", name: "SACHIN A", registerNumber: 211424244323 },
  { rollNumber: "2024PECCB324", name: "SAIKRISHNAN S", registerNumber: 211424244324 },
  { rollNumber: "2024PECCB325", name: "SAMUEL T", registerNumber: 211424244325 },
  { rollNumber: "2024PECCB326", name: "SANJAI R", registerNumber: 211424244326 },
  { rollNumber: "2024PECCB327", name: "SANTHOSH B", registerNumber: 211424244327 },
  { rollNumber: "2024PECCB328", name: "S SARANAESWAR", registerNumber: 211424244328 },
  { rollNumber: "2024PECCB329", name: "SARAN KUMAR U", registerNumber: 211424244329 },
  { rollNumber: "2024PECCB330", name: "SARAVANAKUMAR G", registerNumber: 211424244330 },
  { rollNumber: "2024PECCB331", name: "SENGAN S", registerNumber: 211424244331 },
  { rollNumber: "2024PECCB332", name: "SHAFEEQ S", registerNumber: 211424244332 },
  { rollNumber: "2024PECCB333", name: "SHARAN M", registerNumber: 211424244333 },
  { rollNumber: "2024PECCB334", name: "SHASHANK S", dob: undefined, registerNumber: 211424244334 },
  { rollNumber: "2024PECCB335", name: "SHESHANANTHAN G", registerNumber: 211424244335 },
  { rollNumber: "2024PECCB336", name: "SIDDHARTH M", registerNumber: 211424244336 },
  { rollNumber: "2024PECCB337", name: "SRIKESH R", registerNumber: 211424244337 },
  { rollNumber: "2024PECCB338", name: "SURIYA M", registerNumber: 211424244338 },
  { rollNumber: "2024PECCB339", name: "SURIYA PRAKASH BS", registerNumber: 211424244339 },
  { rollNumber: "2024PECCB340", name: "SURYA R M", registerNumber: 211424244340 },
  { rollNumber: "2024PECCB341", name: "TAMILSELVAN M", registerNumber: 211424244341 },
  { rollNumber: "2024PECCB342", name: "TARUN.H", registerNumber: 211424244342 },
  { rollNumber: "2024PECCB343", name: "THARUN KALATHI V", registerNumber: 211424244343 },
  { rollNumber: "2024PECCB344", name: "THARUN.S", registerNumber: 211424244344 },
  { rollNumber: "2024PECCB345", name: "VENKATA HANUMA PHANI DATTA BHASKARUNI", registerNumber: 211424244345 },
  { rollNumber: "2024PECCB346", name: "VEMULA LAKSHMI NARAYANA", registerNumber: 211424244346 },
  { rollNumber: "2024PECCB347", name: "VIGNESH R", registerNumber: 211424244347 },
  { rollNumber: "2024PECCB348", name: "VIJAYAGOVINDH J", registerNumber: 211424244348 },
  { rollNumber: "2024PECCB349", name: "VINESH S", registerNumber: 211424244349 },
  { rollNumber: "2024PECCB350", name: "YAKESH SHARMA.P", registerNumber: 211424244350 },
  { rollNumber: "2024PECCB351", name: "YOGAPRADEEP", registerNumber: 211424244351 },
  { rollNumber: "2024PECCB352", name: "YUVARAJ M", registerNumber: 211424244352 },
];

async function safeAddColumn(tableName: string, columnDef: string) {
  try {
    await db.run(sql.raw(`ALTER TABLE ${tableName} ADD COLUMN ${columnDef}`));
  } catch (err: any) {
    // Column already exists; ignore
  }
}

export interface StudentCredentialMigrationSummary {
  totalInspected: number;
  alreadyHashedCount: number;
  plaintextHashedCount: number;
  markedSetupRequiredCount: number;
}

export async function migrateStudentCredentials(): Promise<StudentCredentialMigrationSummary> {
  // 1. Inspect existing columns on students table
  const tableInfoRes = await client.execute("PRAGMA table_info(students)");
  const colNames = new Set(tableInfoRes.rows.map((r: any) => String(r.name)));

  if (!colNames.has("password")) {
    await safeAddColumn(
      "students",
      `password TEXT NOT NULL DEFAULT '${SETUP_REQUIRED_SENTINEL}'`
    );
  }
  if (!colNames.has("department")) {
    await safeAddColumn(
      "students",
      "department TEXT NOT NULL DEFAULT 'Computer Science and Business Systems'"
    );
  }
  if (!colNames.has("register_number")) {
    await safeAddColumn(
      "students",
      "register_number INTEGER NOT NULL DEFAULT 0"
    );
  }

  // If the table is an older local SQLite table that still has a NOT NULL `dob` column,
  // migrate the table structure in-place while preserving all IDs and foreign key relationships
  // so that new inserts using the 6-column Turso schema succeed cleanly.
  const hasLegacyDobCol = tableInfoRes.rows.some(
    (r: any) => String(r.name) === "dob"
  );
  if (hasLegacyDobCol) {
    const existingRowsRes = await client.execute(
      "SELECT id, roll_number, name, password, department, register_number, dob FROM students"
    );
    await client.execute("PRAGMA foreign_keys = OFF");
    try {
      await client.execute(`
        CREATE TABLE IF NOT EXISTS students_turso_mig (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          roll_number TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL,
          password TEXT NOT NULL,
          department TEXT NOT NULL,
          register_number INTEGER NOT NULL
        )
      `);
      for (const r of existingRowsRes.rows) {
        const id = Number(r.id);
        const rollNumber = String(r.roll_number || "").trim();
        const name = String(r.name || "").trim();
        const dept =
          String(r.department || "").trim() ||
          "Computer Science and Business Systems";
        const regNum =
          Number(r.register_number) > 0
            ? Number(r.register_number)
            : deriveRegisterNumberFromRoll(rollNumber, id);
        let pwd = r.password ? String(r.password) : SETUP_REQUIRED_SENTINEL;
        if (r.dob && pwd === String(r.dob)) {
          pwd = SETUP_REQUIRED_SENTINEL;
        }
        await client.execute({
          sql: `INSERT OR REPLACE INTO students_turso_mig (id, roll_number, name, password, department, register_number) VALUES (?, ?, ?, ?, ?, ?)`,
          args: [id, rollNumber, name, pwd, dept, regNum],
        });
      }
      await client.execute("DROP TABLE students");
      await client.execute(
        "ALTER TABLE students_turso_mig RENAME TO students"
      );
    } finally {
      await client.execute("PRAGMA foreign_keys = ON");
    }
  }

  // Ensure unique index on roll_number
  await db.run(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_students_roll_number
    ON students (roll_number)
  `);

  // Inspect and normalize all existing student rows without changing IDs
  const allRows = await db.select().from(students).all();
  let alreadyHashedCount = 0;
  let plaintextHashedCount = 0;
  let markedSetupRequiredCount = 0;

  for (const row of allRows) {
    const rawPwd = row.password ? String(row.password) : "";
    const trimmedPwd = rawPwd.trim();
    const cleanDept =
      row.department && String(row.department).trim()
        ? String(row.department).trim()
        : "Computer Science and Business Systems";
    const cleanRegNum =
      typeof row.registerNumber === "number" && row.registerNumber > 0
        ? row.registerNumber
        : deriveRegisterNumberFromRoll(row.rollNumber, row.id);

    let nextPassword = row.password;
    let needsUpdate =
      cleanDept !== row.department || cleanRegNum !== row.registerNumber;

    if (isBcryptHash(trimmedPwd)) {
      // Case A: Already securely hashed in database
      alreadyHashedCount++;
    } else if (
      !trimmedPwd ||
      trimmedPwd === SETUP_REQUIRED_SENTINEL ||
      trimmedPwd.startsWith("__REQUIRES_") ||
      trimmedPwd === "UNINITIALIZED"
    ) {
      // Fallback for uninitialized local rows: hash their register_number as default password
      nextPassword = await hashPassword(String(cleanRegNum));
      plaintextHashedCount++;
      needsUpdate = true;
    } else {
      // Case B: Password already stored in students.password in the database -> hash in-place with bcrypt
      nextPassword = await hashPassword(rawPwd);
      plaintextHashedCount++;
      needsUpdate = true;
    }

    if (needsUpdate) {
      await db
        .update(students)
        .set({
          password: nextPassword,
          department: cleanDept,
          registerNumber: cleanRegNum,
        })
        .where(eq(students.id, row.id))
        .execute();
    }
  }

  return {
    totalInspected: allRows.length,
    alreadyHashedCount,
    plaintextHashedCount,
    markedSetupRequiredCount,
  };
}

async function createAllTables() {
  if (!process.env.DATABASE_URL) {
    await db.run(sql`PRAGMA journal_mode = WAL`);
    await db.run(sql`PRAGMA busy_timeout = 5000`);
  }

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      roll_number TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      password TEXT NOT NULL,
      department TEXT NOT NULL,
      register_number INTEGER NOT NULL
    )
  `);

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS student_auth_metadata (
      student_id INTEGER PRIMARY KEY REFERENCES students(id),
      token_version INTEGER NOT NULL DEFAULT 1,
      password_initialized_at TEXT,
      password_updated_at TEXT,
      reset_code_hash TEXT,
      reset_code_expires_at TEXT
    )
  `);

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS faculty (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      faculty_id TEXT NOT NULL,
      name TEXT NOT NULL,
      department TEXT NOT NULL,
      email TEXT,
      password TEXT
    )
  `);

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS tests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      subject TEXT NOT NULL,
      faculty_id INTEGER REFERENCES faculty(id),
      duration INTEGER NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft'
    )
  `);

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      test_id INTEGER NOT NULL REFERENCES tests(id),
      title TEXT NOT NULL,
      slug TEXT,
      description TEXT NOT NULL,
      topic TEXT DEFAULT 'Algorithms',
      max_marks INTEGER DEFAULT 50,
      time_limit_seconds REAL DEFAULT 2.0,
      memory_limit_mb INTEGER DEFAULT 128,
      status TEXT DEFAULT 'published',
      examples TEXT,
      function_config TEXT,
      constraints TEXT,
      input_format TEXT,
      output_format TEXT,
      sample_input TEXT,
      sample_output TEXT,
      starter_code TEXT,
      driver_code TEXT,
      notes TEXT,
      difficulty TEXT DEFAULT 'medium',
      created_at TEXT,
      updated_at TEXT
    )
  `);

  // Safe migrations for existing questions table
  await safeAddColumn("questions", "slug TEXT");
  await safeAddColumn("questions", "topic TEXT DEFAULT 'Algorithms'");
  await safeAddColumn("questions", "max_marks INTEGER DEFAULT 50");
  await safeAddColumn("questions", "time_limit_seconds REAL DEFAULT 2.0");
  await safeAddColumn("questions", "memory_limit_mb INTEGER DEFAULT 128");
  await safeAddColumn("questions", "status TEXT DEFAULT 'published'");
  await safeAddColumn("questions", "examples TEXT");
  await safeAddColumn("questions", "function_config TEXT");
  await safeAddColumn("questions", "created_at TEXT");
  await safeAddColumn("questions", "updated_at TEXT");

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS question_test_cases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question_id INTEGER NOT NULL REFERENCES questions(id),
      name TEXT NOT NULL,
      input_args TEXT NOT NULL,
      expected_output TEXT NOT NULL,
      visibility TEXT NOT NULL DEFAULT 'private',
      enabled INTEGER NOT NULL DEFAULT 1,
      is_essential INTEGER NOT NULL DEFAULT 0,
      order_index INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  await db.run(sql`
    CREATE INDEX IF NOT EXISTS idx_question_test_cases_qid
    ON question_test_cases (question_id, order_index)
  `);

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL REFERENCES students(id),
      question_id INTEGER NOT NULL REFERENCES questions(id),
      language TEXT NOT NULL,
      source_code TEXT NOT NULL,
      output TEXT,
      status TEXT NOT NULL,
      submitted_at TEXT NOT NULL
    )
  `);

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS test_completions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL REFERENCES students(id),
      test_id INTEGER NOT NULL REFERENCES tests(id),
      completed_at TEXT NOT NULL
    )
  `);

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS test_analytics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      test_id INTEGER NOT NULL REFERENCES tests(id),
      total_students INTEGER DEFAULT 0,
      started_count INTEGER DEFAULT 0,
      submitted_count INTEGER DEFAULT 0,
      pass_count INTEGER DEFAULT 0,
      fail_count INTEGER DEFAULT 0,
      average_score REAL DEFAULT 0,
      highest_score REAL DEFAULT 0,
      lowest_score REAL DEFAULT 0,
      average_execution_time REAL DEFAULT 0,
      created_at TEXT NOT NULL
    )
  `);

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS submission_statistics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      submission_id INTEGER NOT NULL REFERENCES submissions(id),
      execution_time REAL,
      memory_used REAL,
      compile_status TEXT,
      runtime_status TEXT,
      score REAL DEFAULT 0
    )
  `);

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS assessment_timer_configs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      assessment_id INTEGER NOT NULL UNIQUE REFERENCES tests(id),
      timer_enabled INTEGER NOT NULL DEFAULT 1,
      duration_minutes INTEGER NOT NULL DEFAULT 60,
      grace_period_seconds INTEGER NOT NULL DEFAULT 15,
      auto_submit_on_expiry INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL,
      updated_by INTEGER REFERENCES faculty(id)
    )
  `);

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS assessment_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL REFERENCES students(id),
      assessment_id INTEGER NOT NULL REFERENCES tests(id),
      timer_enabled INTEGER NOT NULL DEFAULT 1,
      duration_minutes INTEGER NOT NULL,
      started_at TEXT NOT NULL,
      deadline_at TEXT,
      submitted_at TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      selected_questions TEXT,
      drafts TEXT,
      updated_at TEXT NOT NULL
    )
  `);

  await db.run(sql`
    CREATE INDEX IF NOT EXISTS idx_assessment_sessions_student_test
    ON assessment_sessions (student_id, assessment_id)
  `);

  await db.run(sql`
    CREATE INDEX IF NOT EXISTS idx_assessment_sessions_status_deadline
    ON assessment_sessions (status, timer_enabled, deadline_at)
  `);
}

async function backfillSeededQuestionsLeetCodeData() {
  const allQs = await db.select().from(questions).all();
  const nowIso = new Date().toISOString();

  for (const q of allQs) {
    const existingCases = await db
      .select()
      .from(questionTestCases)
      .where(eq(questionTestCases.questionId, q.id))
      .all();

    const titleLower = q.title.toLowerCase();
    let fnConfig: FunctionConfig | null = q.functionConfig
      ? typeof q.functionConfig === "string"
        ? JSON.parse(q.functionConfig)
        : (q.functionConfig as FunctionConfig)
      : null;

    let examples = q.examples
      ? typeof q.examples === "string"
        ? JSON.parse(q.examples)
        : (q.examples as any[])
      : null;

    if (!fnConfig) {
      if (titleLower.includes("binary search")) {
        fnConfig = {
          className: "Solution",
          methodName: "search",
          returnType: "int",
          parameters: [
            { name: "nums", type: "int[]" },
            { name: "target", type: "int" },
          ],
          visibility: "public",
          isStatic: false,
          enabledLanguages: ["Java", "C++", "Python", "C", "JavaScript"],
        };
        if (!examples || examples.length === 0) {
          examples = [
            {
              input: "nums = [-1,0,3,5,9,12], target = 9",
              output: "4",
              explanation: "9 exists in nums and its index is 4.",
            },
            {
              input: "nums = [-1,0,3,5,9,12], target = 2",
              output: "-1",
              explanation: "2 does not exist in nums so return -1.",
            },
          ];
        }
      } else if (
        titleLower.includes("merge sort") ||
        titleLower.includes("quick sort")
      ) {
        fnConfig = {
          className: "Solution",
          methodName: "sortArray",
          returnType: "int[]",
          parameters: [{ name: "nums", type: "int[]" }],
          visibility: "public",
          isStatic: false,
          enabledLanguages: ["Java", "C++", "Python", "C", "JavaScript"],
        };
        if (!examples || examples.length === 0) {
          examples = [
            {
              input: "nums = [5,2,3,1]",
              output: "[1,2,3,5]",
              explanation:
                "After sorting the array, the positions of some numbers are not changed (for example, 2 and 3), while the positions of other numbers are changed (for example, 1 and 5).",
            },
            {
              input: "nums = [5,1,1,2,0,0]",
              output: "[0,0,1,1,2,5]",
              explanation: "Note that the values of nums are not necessarily unique.",
            },
          ];
        }
      }
    }

    if (fnConfig) {
      const slug =
        q.slug ||
        q.title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "") + `-${q.id}`;
      const generatedStarter = generateAllStarterCodes(fnConfig);
      const currentStarter = q.starterCode
        ? typeof q.starterCode === "string"
          ? JSON.parse(q.starterCode)
          : (q.starterCode as Record<string, string>)
        : {};
      const mergedStarter = { ...generatedStarter, ...currentStarter };

      await db
        .update(questions)
        .set({
          slug,
          topic: q.topic || "Sorting & Searching",
          maxMarks: q.maxMarks || 50,
          timeLimitSeconds: q.timeLimitSeconds || 2.0,
          memoryLimitMb: q.memoryLimitMb || 128,
          status: (q.status as any) || "published",
          examples: examples || [],
          functionConfig: fnConfig,
          starterCode: mergedStarter,
          createdAt: q.createdAt || nowIso,
          updatedAt: q.updatedAt || nowIso,
        })
        .where(eq(questions.id, q.id))
        .execute();

      if (existingCases.length < 4) {
        if (existingCases.length > 0) {
          await db
            .delete(questionTestCases)
            .where(eq(questionTestCases.questionId, q.id))
            .execute();
        }
        if (titleLower.includes("binary search")) {
          await db.insert(questionTestCases).values([
            {
              questionId: q.id,
              name: "Example Case 1",
              inputArgs: JSON.stringify({ args: [[-1, 0, 3, 5, 9, 12], 9] }),
              expectedOutput: "4",
              visibility: "public",
              enabled: true,
              isEssential: false,
              orderIndex: 0,
              createdAt: nowIso,
              updatedAt: nowIso,
            },
            {
              questionId: q.id,
              name: "Example Case 2",
              inputArgs: JSON.stringify({ args: [[-1, 0, 3, 5, 9, 12], 2] }),
              expectedOutput: "-1",
              visibility: "public",
              enabled: true,
              isEssential: false,
              orderIndex: 1,
              createdAt: nowIso,
              updatedAt: nowIso,
            },
            {
              questionId: q.id,
              name: "Private Single Element Found",
              inputArgs: JSON.stringify({ args: [[5], 5] }),
              expectedOutput: "0",
              visibility: "private",
              enabled: true,
              isEssential: true,
              orderIndex: 2,
              createdAt: nowIso,
              updatedAt: nowIso,
            },
            {
              questionId: q.id,
              name: "Private Boundary Element",
              inputArgs: JSON.stringify({ args: [[-10, -5, 0, 7, 14, 21], -10] }),
              expectedOutput: "0",
              visibility: "private",
              enabled: true,
              isEssential: true,
              orderIndex: 3,
              createdAt: nowIso,
              updatedAt: nowIso,
            },
          ]);
        } else if (
          titleLower.includes("merge sort") ||
          titleLower.includes("quick sort")
        ) {
          await db.insert(questionTestCases).values([
            {
              questionId: q.id,
              name: "Example Case 1",
              inputArgs: JSON.stringify({ args: [[5, 2, 3, 1]] }),
              expectedOutput: "[1,2,3,5]",
              visibility: "public",
              enabled: true,
              isEssential: false,
              orderIndex: 0,
              createdAt: nowIso,
              updatedAt: nowIso,
            },
            {
              questionId: q.id,
              name: "Example Case 2",
              inputArgs: JSON.stringify({ args: [[5, 1, 1, 2, 0, 0]] }),
              expectedOutput: "[0,0,1,1,2,5]",
              visibility: "public",
              enabled: true,
              isEssential: false,
              orderIndex: 1,
              createdAt: nowIso,
              updatedAt: nowIso,
            },
            {
              questionId: q.id,
              name: "Private Negative & Reverse Sorted",
              inputArgs: JSON.stringify({ args: [[9, 4, -1, -7, 0, 2]] }),
              expectedOutput: "[-7,-1,0,2,4,9]",
              visibility: "private",
              enabled: true,
              isEssential: true,
              orderIndex: 2,
              createdAt: nowIso,
              updatedAt: nowIso,
            },
            {
              questionId: q.id,
              name: "Private Single Element",
              inputArgs: JSON.stringify({ args: [[42]] }),
              expectedOutput: "[42]",
              visibility: "private",
              enabled: true,
              isEssential: true,
              orderIndex: 3,
              createdAt: nowIso,
              updatedAt: nowIso,
            },
          ]);
        }
      }
    }
  }
}

async function seedDefaultDataIfNeeded() {
  await migrateStudentCredentials();

  const studentCountObj = await db.select({ count: count() }).from(students).get();
  if ((studentCountObj?.count || 0) === 0) {
    for (const s of INITIAL_STUDENTS) {
      const defaultHashedPassword = await hashPassword(String(s.registerNumber));
      await db
        .insert(students)
        .values({
          rollNumber: s.rollNumber,
          name: s.name,
          password: defaultHashedPassword,
          department: "Computer Science and Business Systems",
          registerNumber: s.registerNumber,
        })
        .onConflictDoNothing()
        .execute();
    }
    console.log(`[DATABASE] Seeded ${INITIAL_STUDENTS.length} students.`);
  }

  let fac = await db.select().from(faculty).limit(1).get();
  if (!fac) {
    fac = await db
      .insert(faculty)
      .values({
        facultyId: "FAC001",
        name: "Admin Faculty",
        department: "Computer Science and Business Systems",
        email: "admin@codelab.edu",
        password: "password123",
      })
      .returning()
      .get();
    console.log("[DATABASE] Seeded default faculty account (admin@codelab.edu).");
  }

  const testCountObj = await db.select({ count: count() }).from(tests).get();
  if ((testCountObj?.count || 0) === 0) {
    const now = new Date();
    const end = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const defaultTest = await db
      .insert(tests)
      .values({
        title: "Sorting and Searching Algorithms",
        subject: "Data Structures and Algorithms",
        facultyId: fac.id,
        duration: 45,
        startTime: now.toISOString(),
        endTime: end.toISOString(),
        status: "published",
      })
      .returning()
      .get();

    await db
      .insert(assessmentTimerConfigs)
      .values({
        assessmentId: defaultTest.id,
        timerEnabled: true,
        durationMinutes: 45,
        gracePeriodSeconds: 15,
        autoSubmitOnExpiry: true,
        updatedAt: now.toISOString(),
        updatedBy: fac.id,
      })
      .onConflictDoNothing()
      .execute();

    await db.insert(questions).values([
      {
        testId: defaultTest.id,
        title: "Binary Search",
        slug: "binary-search",
        topic: "Searching",
        maxMarks: 50,
        timeLimitSeconds: 2.0,
        memoryLimitMb: 128,
        status: "published",
        description:
          "Given an array of integers `nums` which is sorted in ascending order, and an integer `target`, write a function to search `target` in `nums`. If `target` exists, then return its index. Otherwise, return `-1`.\n\nYou must write an algorithm with `O(log n)` runtime complexity.",
        constraints:
          "- 1 <= nums.length <= 10^4\n- -10^4 < nums[i], target < 10^4\n- All the integers in nums are unique.\n- nums is sorted in ascending order.",
        inputFormat:
          "The first line contains the array of integers, space-separated.\nThe second line contains the target integer.",
        outputFormat:
          "Return the index of the target integer. If it doesn't exist, return -1.",
        sampleInput: "-1 0 3 5 9 12\n9",
        sampleOutput: "4",
        difficulty: "easy",
      },
      {
        testId: defaultTest.id,
        title: "Merge Sort",
        slug: "merge-sort",
        topic: "Sorting",
        maxMarks: 50,
        timeLimitSeconds: 2.0,
        memoryLimitMb: 128,
        status: "published",
        description:
          "Given an array of integers `nums`, sort the array in ascending order using the **Merge Sort** algorithm and return it.\n\nYou must solve the problem without using any built-in sort functions in `O(n log n)` time complexity.",
        constraints:
          "- 1 <= nums.length <= 5 * 10^4\n- -5 * 10^4 <= nums[i] <= 5 * 10^4",
        inputFormat:
          "A single line containing the array of integers, space-separated.",
        outputFormat:
          "A single line containing the sorted array of integers, space-separated.",
        sampleInput: "5 2 3 1",
        sampleOutput: "1 2 3 5",
        difficulty: "medium",
      },
      {
        testId: defaultTest.id,
        title: "Sort an Array (Quick Sort)",
        slug: "sort-an-array-quick-sort",
        topic: "Sorting",
        maxMarks: 50,
        timeLimitSeconds: 2.0,
        memoryLimitMb: 128,
        status: "published",
        description:
          "Given an array of integers `nums`, sort the array in ascending order and return it.\n\nYou must implement **Quick Sort** (not a built-in sort) with average `O(n log n)` time complexity.",
        constraints:
          "- 1 <= nums.length <= 5 * 10^4\n- -5 * 10^4 <= nums[i] <= 5 * 10^4",
        inputFormat:
          "A single line containing the array of integers, space-separated.",
        outputFormat:
          "A single line containing the sorted array of integers, space-separated.",
        sampleInput: "5 2 3 1",
        sampleOutput: "1 2 3 5",
        difficulty: "medium",
      },
    ]);
    console.log("[DATABASE] Seeded default DSA test and questions.");
  }

  await backfillSeededQuestionsLeetCodeData();

  await db.run(sql`
    INSERT OR IGNORE INTO assessment_timer_configs (
      assessment_id,
      timer_enabled,
      duration_minutes,
      grace_period_seconds,
      auto_submit_on_expiry,
      updated_at,
      updated_by
    )
    SELECT
      id,
      1,
      CASE WHEN duration > 0 THEN duration ELSE 60 END,
      15,
      1,
      datetime('now'),
      faculty_id
    FROM tests
  `);
}

export async function ensureTimerTables() {
  if (migrationCompleted) return;
  try {
    await createAllTables();
    await seedDefaultDataIfNeeded();
    migrationCompleted = true;
    console.log("[DATABASE] Assessment timer & LeetCode question tables verified.");
  } catch (err: any) {
    const errMsg = String(err?.cause?.message || err?.message || "");
    if (errMsg.includes("SQLITE_CORRUPT") || errMsg.includes("malformed")) {
      console.warn(
        "[DATABASE] Detected malformed local SQLite file. Auto-repairing and seeding..."
      );
      resetLocalDbConnection();
      await createAllTables();
      await seedDefaultDataIfNeeded();
      migrationCompleted = true;
      console.log("[DATABASE] Auto-repair and seeding completed.");
    } else {
      console.error("[DATABASE] Error ensuring tables:", err);
    }
  }
}
