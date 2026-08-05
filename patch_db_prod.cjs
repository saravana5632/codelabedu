const fs = require('fs');
const file = 'src/db/index.ts';
let code = fs.readFileSync(file, 'utf-8');

const oldClientInit = `// Ensure data directory exists
if (!fs.existsSync('./data')) {
  fs.mkdirSync('./data', { recursive: true });
}

const dbPath = './data/codelab.db';

function getClient() {
  return createClient({ url: \`file:\${dbPath}\` });
}`;

const newClientInit = `function getClient() {
  if (process.env.DATABASE_URL) {
    return createClient({
      url: process.env.DATABASE_URL,
      authToken: process.env.DATABASE_AUTH_TOKEN
    });
  }

  // Fallback to local SQLite for development
  if (!fs.existsSync('./data')) {
    fs.mkdirSync('./data', { recursive: true });
  }
  return createClient({ url: 'file:./data/codelab.db' });
}`;

code = code.replace(oldClientInit, newClientInit);
fs.writeFileSync(file, code);

// Create or update .env.example
if (!fs.existsSync('.env.example')) {
  fs.writeFileSync('.env.example', 'DATABASE_URL=\nDATABASE_AUTH_TOKEN=\n');
} else {
  let envCode = fs.readFileSync('.env.example', 'utf-8');
  if (!envCode.includes('DATABASE_URL')) {
    envCode += '\nDATABASE_URL=\nDATABASE_AUTH_TOKEN=\n';
    fs.writeFileSync('.env.example', envCode);
  }
}
console.log("Patched DB client for production");
