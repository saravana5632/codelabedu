import { pgTable, serial, text, integer, real } from 'drizzle-orm/pg-core';

export const students = pgTable('students', {
  id: serial('id').primaryKey(),
  rollNumber: text('roll_number').notNull().unique(),
  name: text('name').notNull(),
  dob: text('dob').notNull(),
  department: text('department'),
  year: integer('year')
});

export const faculty = pgTable('faculty', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  password: text('password').notNull()
});

export const tests = pgTable('tests', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  subject: text('subject').notNull(),
  facultyId: integer('faculty_id').references(() => faculty.id),
  duration: integer('duration').notNull(),
  startTime: text('start_time').notNull(),
  endTime: text('end_time').notNull(),
  status: text('status').default('draft').notNull()
});

export const questions = pgTable('questions', {
  id: serial('id').primaryKey(),
  testId: integer('test_id').references(() => tests.id).notNull(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  constraints: text('constraints'),
  inputFormat: text('input_format'),
  outputFormat: text('output_format'),
  sampleInput: text('sample_input'),
  sampleOutput: text('sample_output'),
  publicExplanation: text('public_explanation'),
  privateInput1: text('private_input_1'),
  privateOutput1: text('private_output_1'),
  privateInput2: text('private_input_2'),
  privateOutput2: text('private_output_2'),
  notes: text('notes'),
  difficulty: text('difficulty').default('medium'),
  functionName: text('function_name'),
  returnType: text('return_type'),
  parameters: text('parameters')
});

export const submissions = pgTable('submissions', {
  id: serial('id').primaryKey(),
  studentId: integer('student_id').references(() => students.id).notNull(),
  testId: integer('test_id').references(() => tests.id),
  questionId: integer('question_id').references(() => questions.id).notNull(),
  language: text('language').notNull(),
  sourceCode: text('source_code').notNull(),
  output: text('output'),
  status: text('status').notNull(),
  submittedAt: text('submitted_at').notNull()
});

export const testAnalytics = pgTable('test_analytics', {
  id: serial('id').primaryKey(),
  testId: integer('test_id').references(() => tests.id).notNull(),
  totalStudents: integer('total_students').default(0),
  startedCount: integer('started_count').default(0),
  submittedCount: integer('submitted_count').default(0),
  passCount: integer('pass_count').default(0),
  failCount: integer('fail_count').default(0),
  averageScore: real('average_score').default(0),
  highestScore: real('highest_score').default(0),
  lowestScore: real('lowest_score').default(0),
  averageExecutionTime: real('average_execution_time').default(0),
  createdAt: text('created_at').notNull()
});

export const testAttempts = pgTable('test_attempts', {
  id: serial('id').primaryKey(),
  studentId: integer('student_id').references(() => students.id).notNull(),
  testId: integer('test_id').references(() => tests.id).notNull(),
  status: text('status').default('in_progress').notNull(),
  startedAt: text('started_at').notNull(),
  completedAt: text('completed_at')
});

export const submissionStatistics = pgTable('submission_statistics', {
  id: serial('id').primaryKey(),
  submissionId: integer('submission_id').references(() => submissions.id).notNull(),
  executionTime: real('execution_time'),
  memoryUsed: real('memory_used'),
  compileStatus: text('compile_status'),
  runtimeStatus: text('runtime_status'),
  score: real('score').default(0)
});

export const malpracticeLogs = pgTable('malpractice_logs', {
  id: serial('id').primaryKey(),
  studentId: integer('student_id').references(() => students.id).notNull(),
  testId: integer('test_id').references(() => tests.id),
  eventType: text('event_type').notNull(),
  timestamp: text('timestamp').notNull(),
  duration: integer('duration').default(0),
  details: text('details')
});

export const studentSessions = pgTable('student_sessions', {
  id: serial('id').primaryKey(),
  studentId: integer('student_id').references(() => students.id).notNull(),
  sessionToken: text('session_token'),
  ipAddress: text('ip_address'),
  deviceInfo: text('device_info'),
  loginTime: text('login_time').notNull(),
  logoutTime: text('logout_time'),
  isActive: integer('is_active').default(1)
});

export const codeSimilarity = pgTable('code_similarity', {
  id: serial('id').primaryKey(),
  testId: integer('test_id').references(() => tests.id).notNull(),
  student1Id: integer('student_1_id').references(() => students.id).notNull(),
  student2Id: integer('student_2_id').references(() => students.id).notNull(),
  similarityPercentage: real('similarity_percentage').notNull(),
  status: text('status').notNull(),
  details: text('details'),
  createdAt: text('created_at').notNull()
});
