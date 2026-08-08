import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema.js';
import dotenv from 'dotenv';
dotenv.config();

const dbUrl = process.env.DATABASE_URL || 'file:data/codelab.db';
const dbAuthToken = process.env.DATABASE_AUTH_TOKEN;

const client = createClient({
  url: dbUrl,
  ...(dbAuthToken ? { authToken: dbAuthToken } : {})
});

export const db = drizzle(client, { schema });
