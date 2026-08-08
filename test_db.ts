import { db } from "./src/db/index.js";
import { students } from "./src/db/schema.js";
import { eq } from "drizzle-orm";

async function test() {
  try {
    const student = await db.select().from(students).where(eq(students.id, 1)).get();
    console.log(student);
  } catch (err) {
    console.error(err);
  }
}
test();
