require("dotenv").config();

const { createClient } = require("@libsql/client");

const client = createClient({
    url: process.env.DATABASE_URL,
    authToken: process.env.DATABASE_AUTH_TOKEN
});

async function setup() {
    try {
        console.log("Connecting to Turso...");

        await client.execute(`
            CREATE TABLE IF NOT EXISTS students (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                roll_number TEXT NOT NULL UNIQUE,
                name TEXT NOT NULL,
                dob TEXT NOT NULL,
                department TEXT NOT NULL,
                year TEXT NOT NULL,
                semester TEXT NOT NULL
            )
        `);

        console.log("students table created.");

        await client.execute(`
            CREATE TABLE IF NOT EXISTS faculty (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                faculty_id TEXT NOT NULL UNIQUE,
                name TEXT NOT NULL,
                department TEXT NOT NULL
            )
        `);

        console.log("faculty table created.");

        console.log("Turso database setup completed.");

    } catch (error) {
        console.error("DATABASE ERROR:");
        console.error(error);
    }
}

setup();