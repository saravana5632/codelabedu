import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "./schema.js";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config();

const isProduction = process.env.NODE_ENV === "production";
let dbUrl = process.env.DATABASE_URL;
const dbAuthToken = process.env.DATABASE_AUTH_TOKEN;

if (!dbUrl) {
  if (isProduction) {
    console.error("[DATABASE] ERROR: DATABASE_URL is required in production!");
    process.exit(1);
  } else {
    const dataDir = path.join(process.cwd(), "data");
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    dbUrl = "file:data/codelab.db";
  }
}

console.log(`[DATABASE] Connecting to database driver: libsql`);
console.log(`[DATABASE] DATABASE_URL exists: ${!!process.env.DATABASE_URL}`);
if (dbUrl && process.env.DATABASE_URL) {
  try {
    const parsedUrl = new URL(dbUrl.replace("libsql://", "https://"));
    console.log(`[DATABASE] Hostname: ${parsedUrl.hostname}`);
  } catch (e) {
    console.log(
      `[DATABASE] Could not parse hostname from URL (might be a local file path)`
    );
  }
}
console.log(`[DATABASE] DATABASE_AUTH_TOKEN exists: ${!!dbAuthToken}`);

export let client = createClient({
  url: dbUrl,
  ...(dbAuthToken ? { authToken: dbAuthToken } : {}),
});

export let db = drizzle(client, { schema });

export function resetLocalDbConnection() {
  if (dbUrl === "file:data/codelab.db") {
    try {
      client.close();
    } catch {}
    const dbFile = path.join(process.cwd(), "data", "codelab.db");
    for (const suffix of ["", "-wal", "-shm", "-journal"]) {
      const target = dbFile + suffix;
      if (fs.existsSync(target)) {
        fs.unlinkSync(target);
      }
    }
    client = createClient({ url: dbUrl });
    db = drizzle(client, { schema });
  }
}
