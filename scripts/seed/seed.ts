import { ensureTimerTables, migrateStudentCredentials } from "../../src/db/migrate.js";

async function runSeed() {
  await ensureTimerTables();
  const summary = await migrateStudentCredentials();
  console.log("[SEED] Database migration and student credential check complete:", summary);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runSeed().catch((err) => {
    console.error("[SEED] Error:", err);
    process.exit(1);
  });
}

export { login, getMe } from "../../src/controllers/auth.js";