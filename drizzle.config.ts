import { defineConfig } from "drizzle-kit";
import dotenv from "dotenv";

dotenv.config();

const url = process.env.DATABASE_URL!;

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  schemaFilter: ["public"],
  dbCredentials: { url },
  verbose: true,
});
