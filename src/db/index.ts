import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema.js';
import fs from 'fs';

// Ensure data directory exists
if (!fs.existsSync('./data')) {
  fs.mkdirSync('./data');
}

const client = createClient({ url: 'file:./data/codelab.db' });

// Auto-create malpractice and session tables if they do not exist
async function initDb() {
  try {
    await client.execute(`
      CREATE TABLE IF NOT EXISTS malpractice_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER NOT NULL,
        test_id INTEGER,
        event_type TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        duration INTEGER DEFAULT 0,
        details TEXT
      )
    `);
    await client.execute(`
      CREATE TABLE IF NOT EXISTS student_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER NOT NULL,
        session_token TEXT,
        ip_address TEXT,
        device_info TEXT,
        login_time TEXT NOT NULL,
        logout_time TEXT,
        is_active INTEGER DEFAULT 1
      )
    `);
    await client.execute(`
      CREATE TABLE IF NOT EXISTS code_similarity (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        test_id INTEGER NOT NULL,
        student_1_id INTEGER NOT NULL,
        student_2_id INTEGER NOT NULL,
        similarity_percentage REAL NOT NULL,
        status TEXT NOT NULL,
        details TEXT,
        created_at TEXT NOT NULL
      )
    `);
  } catch (err) {
    console.error("Failed initializing database tables:", err);
  }
}
initDb();

export const db = drizzle(client, { schema });

