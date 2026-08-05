import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Firebase Admin SDK
// You will need to provide the service account key JSON in your environment variables
// or path. For AI Studio, it automatically provisions Firebase if configured.

let db;
let auth;

try {
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT 
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT) 
    : undefined;

  const appConfig = serviceAccount ? { credential: cert(serviceAccount) } : undefined;
  
  const app = initializeApp(appConfig);
  db = getFirestore(app);
  auth = getAuth(app);
  
  console.log('Successfully connected to Firebase.');
} catch (error) {
  console.error('Failed to initialize Firebase:', error);
}

export { db, auth };
