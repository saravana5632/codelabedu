import { ensureTimerTables } from "../../src/db/migrate.js";

async function runMigration() {
  console.log("Running Assessment Timer schema migration...");
  await ensureTimerTables();
  console.log("Migration finished successfully.");
}

runMigration().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
