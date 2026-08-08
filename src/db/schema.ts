import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

export const students = sqliteTable("students", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  rollNumber: text("roll_number").notNull().unique(),
  name: text("name").notNull(),
  dob: text("dob").notNull(),
  department: text("department"),
  year: integer("year"),
  semester: integer("semester"),
});

export const faculty = sqliteTable("faculty", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  facultyId: text("faculty_id").notNull(),
  name: text("name").notNull(),
  department: text("department").notNull(),
  email: text("email"),
  password: text("password"),
});

export const tests = sqliteTable("tests", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  subject: text("subject").notNull(),
  facultyId: integer("faculty_id").references(() => faculty.id),
  duration: integer("duration").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  status: text("status", {
    enum: ["draft", "published", "completed", "archived"],
  })
    .default("draft")
    .notNull(),
});

export const questions = sqliteTable("questions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  testId: integer("test_id")
    .references(() => tests.id)
    .notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  constraints: text("constraints"),
  inputFormat: text("input_format"),
  outputFormat: text("output_format"),
  sampleInput: text("sample_input"),
  sampleOutput: text("sample_output"),
  starterCode: text("starter_code", { mode: "json" }),
  driverCode: text("driver_code", { mode: "json" }),
  notes: text("notes"),
  difficulty: text("difficulty", {
    enum: ["easy", "medium", "hard"],
  }).default("medium"),
});

export const submissions = sqliteTable("submissions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  studentId: integer("student_id")
    .references(() => students.id)
    .notNull(),
  questionId: integer("question_id")
    .references(() => questions.id)
    .notNull(),
  language: text("language").notNull(),
  sourceCode: text("source_code").notNull(),
  output: text("output"),
  status: text("status").notNull(),
  submittedAt: text("submitted_at").notNull(),
});

export const testCompletions = sqliteTable("test_completions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  studentId: integer("student_id")
    .references(() => students.id)
    .notNull(),
  testId: integer("test_id")
    .references(() => tests.id)
    .notNull(),
  completedAt: text("completed_at").notNull(),
});

export const testAnalytics = sqliteTable("test_analytics", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  testId: integer("test_id")
    .references(() => tests.id)
    .notNull(),
  totalStudents: integer("total_students").default(0),
  startedCount: integer("started_count").default(0),
  submittedCount: integer("submitted_count").default(0),
  passCount: integer("pass_count").default(0),
  failCount: integer("fail_count").default(0),
  averageScore: real("average_score").default(0),
  highestScore: real("highest_score").default(0),
  lowestScore: real("lowest_score").default(0),
  averageExecutionTime: real("average_execution_time").default(0),
  createdAt: text("created_at").notNull(),
});

export const submissionStatistics = sqliteTable("submission_statistics", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  submissionId: integer("submission_id")
    .references(() => submissions.id)
    .notNull(),
  executionTime: real("execution_time"),
  memoryUsed: real("memory_used"),
  compileStatus: text("compile_status"),
  runtimeStatus: text("runtime_status"),
  score: real("score").default(0),
});