import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

let db: any = null;
try {
  const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    const app = initializeApp(config);
    db = getFirestore(app, config.firestoreDatabaseId);
  }
} catch (error) {
  console.error("Failed to initialize Firebase backend:", error);
}

export { db };
