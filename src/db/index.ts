import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema.js';
import dotenv from 'dotenv';
dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';
let dbUrl = process.env.DATABASE_URL;
const dbAuthToken = process.env.DATABASE_AUTH_TOKEN;

if (!dbUrl) {
  if (isProduction) {
    console.error("[DATABASE] ERROR: DATABASE_URL is required in production!");
    process.exit(1);
  } else {
    dbUrl = 'file:data/codelab.db';
  }
}

console.log(`[DATABASE] Connecting to database driver: libsql`);
console.log(`[DATABASE] DATABASE_URL exists: ${!!process.env.DATABASE_URL}`);
if (dbUrl) {
  try {
    const parsedUrl = new URL(dbUrl.replace('libsql://', 'https://'));
    console.log(`[DATABASE] Hostname: ${parsedUrl.hostname}`);
  } catch (e) {
    // If it's a file: URL, URL parsing might fail or be different, just ignore
    console.log(`[DATABASE] Could not parse hostname from URL (might be a local file path)`);
  }
}
console.log(`[DATABASE] DATABASE_AUTH_TOKEN exists: ${!!dbAuthToken}`);

export const client = createClient({
  url: dbUrl,
  ...(dbAuthToken ? { authToken: dbAuthToken } : {})
});

export const db = drizzle(client, { schema });
