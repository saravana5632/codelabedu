require("dotenv").config();

const { createClient } = require("@libsql/client");

const client = createClient({
    url: process.env.DATABASE_URL,
    authToken: process.env.DATABASE_AUTH_TOKEN
});

async function check() {
    try {
        const result = await client.execute(
            "SELECT * FROM students"
        );

        console.log("STUDENT DATA:");
        console.log(result.rows);
    } catch (error) {
        console.error("DATABASE ERROR:");
        console.error(error);
    }
}

check();