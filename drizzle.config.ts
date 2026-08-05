import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";

dotenv.config();

const url = process.env.DATABASE_URL;

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  schemaFilter: ["public"],
  dbCredentials: url ? { url } : {
    host: process.env.SQL_HOST || "localhost",
    user: process.env.SQL_ADMIN_USER || "postgres",
    password: process.env.SQL_ADMIN_PASSWORD || "postgres",
    database: process.env.SQL_DB_NAME || "postgres",
    ssl: false,
  },
  verbose: true,
});
