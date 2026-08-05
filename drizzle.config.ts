import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";

dotenv.config();

const url = process.env.DATABASE_URL;

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  schemaFilter: ["public"],
  dbCredentials: url && !url.includes('[YOUR-PASSWORD]') ? { url } : {
    url: 'postgresql://postgres:postgres@localhost:5432/postgres'
  },
  verbose: true,
});
