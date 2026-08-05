require('dotenv').config();
const { Pool } = require('pg');
let url = process.env.DATABASE_URL;
if (url) {
  url = url.replace(/\[|\]/g, '');
}
const pool = new Pool({
  connectionString: url,
  ssl: { rejectUnauthorized: false }
});
pool.query('SELECT 1', (err, res) => {
  if (err) console.error(err);
  else console.log('Connected!');
  process.exit();
});
