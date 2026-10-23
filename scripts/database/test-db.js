import { db } from './src/db/index.js';
async function run() {
  try {
    const res = await db.select().from(require('./src/db/schema.js').students).limit(1).get();
    console.log("DB test success:", res);
  } catch(e) {
    console.error("DB test error:", e);
  }
}
run();
