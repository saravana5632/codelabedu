import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import dotenv from 'dotenv';

dotenv.config();

let db: FirebaseFirestore.Firestore;

if (!getApps().length) {
  const projectId = process.env.FIREBASE_PROJECT_ID || 'directed-osprey-wk91c';
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  const appConfig = clientEmail && privateKey 
    ? { credential: cert({ projectId, clientEmail, privateKey }) }
    : { projectId };

  const app = initializeApp(appConfig);
  db = getFirestore(app, 'ai-studio-codearena-0cb21e6c-9e40-47da-a8d9-62d6501c4c4e');
  console.log('Firebase Admin initialized for Firestore.');
} else {
  const app = getApps()[0];
  db = getFirestore(app, 'ai-studio-codearena-0cb21e6c-9e40-47da-a8d9-62d6501c4c4e');
}

export { db };

// Student interface
export interface Student {
  id?: string;
  name: string;
  email: string;
  rollNumber: string;
  department: string;
  year: number;
  dob?: string;
  createdAt?: any;
  updatedAt?: any;
}

// Students CRUD
export const studentsDb = {
  async getAll(): Promise<Student[]> {
    const snapshot = await db.collection('students').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student));
  },
  
  async getById(id: string): Promise<Student | null> {
    const doc = await db.collection('students').doc(id).get();
    return doc.exists ? ({ id: doc.id, ...doc.data() } as Student) : null;
  },

  async create(studentData: Omit<Student, 'id'>): Promise<Student> {
    const docRef = await db.collection('students').add({
       ...studentData,
       createdAt: FieldValue.serverTimestamp(),
       updatedAt: FieldValue.serverTimestamp()
    });
    return { id: docRef.id, ...studentData };
  },

  async update(id: string, studentData: Partial<Student>): Promise<Student | null> {
    await db.collection('students').doc(id).update({
      ...studentData,
      updatedAt: FieldValue.serverTimestamp()
    });
    return this.getById(id);
  },

  async delete(id: string): Promise<boolean> {
    await db.collection('students').doc(id).delete();
    return true;
  }
};

// Test configuration interface
export interface TestConfig {
  id?: string;
  title: string;
  subject: string;
  facultyId: number | string;
  duration: number;
  startTime: string;
  endTime: string;
  status: string;
  createdAt?: any;
  updatedAt?: any;
}

// Tests CRUD
export const testsDb = {
  async getAll(): Promise<TestConfig[]> {
    const snapshot = await db.collection('tests').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TestConfig));
  },

  async getById(id: string): Promise<TestConfig | null> {
    const doc = await db.collection('tests').doc(id).get();
    return doc.exists ? ({ id: doc.id, ...doc.data() } as TestConfig) : null;
  },

  async create(testData: Omit<TestConfig, 'id'>): Promise<TestConfig> {
    const docRef = await db.collection('tests').add({
        ...testData,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
    });
    return { id: docRef.id, ...testData };
  },

  async update(id: string, testData: Partial<TestConfig>): Promise<TestConfig | null> {
    await db.collection('tests').doc(id).update({
      ...testData,
      updatedAt: FieldValue.serverTimestamp()
    });
    return this.getById(id);
  },

  async delete(id: string): Promise<boolean> {
    await db.collection('tests').doc(id).delete();
    return true;
  }
};
