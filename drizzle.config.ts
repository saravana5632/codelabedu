import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";

dotenv.config();

const sqlHost = process.env.SQL_HOST;
const sqlDbName = process.env.SQL_DB_NAME;
const user = process.env.SQL_ADMIN_USER || process.env.SQL_USER;
const password = process.env.SQL_ADMIN_PASSWORD || process.env.SQL_PASSWORD;

let config: any = {
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  schemaFilter: ["public"],
  verbose: true,
};

if (sqlHost) {
  config.dbCredentials = {
    host: sqlHost,
    user: user,
    password: password,
    database: sqlDbName as string,
    ssl: false,
  };
} else {
  let url = process.env.DATABASE_URL!;
  if (url && url.includes('supabase.co')) {
    try {
      const urlObj = new URL(url);
      if (urlObj.password.startsWith('%5B') && urlObj.password.endsWith('%5D')) {
        urlObj.password = urlObj.password.slice(3, -3);
      }
      const hostParts = urlObj.hostname.split('.');
      if (hostParts[0] === 'db' && hostParts.length >= 3) {
        const tenantId = hostParts[1];
        urlObj.hostname = `aws-0-ap-southeast-1.pooler.supabase.com`;
        urlObj.port = '6543';
        if (urlObj.username === 'postgres') {
          urlObj.username = `postgres.${tenantId}`;
        }
        url = urlObj.toString();
      }
    } catch (e) {
      console.error("Error rewriting supabase url:", e);
    }
  }
  config.dbCredentials = { url };
}

export default defineConfig(config);
