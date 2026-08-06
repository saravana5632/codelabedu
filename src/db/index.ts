import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema.js';
import fs from 'fs';

// Ensure data directory exists
if (!fs.existsSync('./data')) {
  fs.mkdirSync('./data');
}

const client = createClient({ url: 'file:./data/codelab.db' });
export const db = drizzle(client, { schema });
