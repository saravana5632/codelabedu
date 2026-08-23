require("dotenv").config();

const { createClient } = require("@libsql/client");

const client = createClient({
    url: process.env.DATABASE_URL,
    authToken: process.env.DATABASE_AUTH_TOKEN
});

async function check() {
    try {
        const result = await client.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        );

        console.log("TURSO TABLES:");
        console.log(result.rows);
    } catch (error) {
        console.error("TURSO ERROR:");
        console.error(error);
    }
}

check();