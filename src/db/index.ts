import "dotenv/config";
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { PgSelectBase, PgInsertBase, PgUpdateBase, PgDeleteBase } from 'drizzle-orm/pg-core';
import { count } from 'drizzle-orm';
import * as schema from './schema.js';
console.log("DATABASE_URL:", process.env.DATABASE_URL?.substring(0, 35));
// Polyfill .all(), .get(), and .run() for PostgreSQL Drizzle query promises
[PgSelectBase, PgInsertBase, PgUpdateBase, PgDeleteBase].forEach((cls) => {
  if (cls && cls.prototype) {
    if (!(cls.prototype as any).all) {
      (cls.prototype as any).all = function () {
        return this.then((res: any) => res);
      };
    }
    if (!(cls.prototype as any).get) {
      (cls.prototype as any).get = function () {
        return this.then((res: any) => (Array.isArray(res) ? res[0] : res));
      };
    }
    if (!(cls.prototype as any).run) {
      (cls.prototype as any).run = function () {
        return this.then((res: any) => res);
      };
    }
  }
});

declare global {
  var _postgresPool: Pool | undefined;
}

export const createPool = () => {
  if (!global._postgresPool) {
    if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes('[YOUR-PASSWORD]')) {
       console.error("WARNING: DATABASE_URL is not set or contains placeholder password.");
    }
    const connectionString = process.env.DATABASE_URL!;
    const isSupabase = connectionString && connectionString.includes('supabase');
    global._postgresPool = new Pool({
      connectionString: connectionString,
      max: 10,
      connectionTimeoutMillis: 15000,
      ssl: isSupabase ? { rejectUnauthorized: false } : undefined,
    });
    
    global._postgresPool.on('error', (err) => {
      console.error('Unexpected error on idle SQL pool client:', err);
    });
  }
  return global._postgresPool;
};

const pool = createPool();

export const db = drizzle(pool, { schema });

const defaultStudentData = `2024PECCB290,LALU PRASAD B.P,18-04-2007
2024PECCB291,LOGANATH.T,19-07-2006
2024PECCB292,LOKANADHAM S,22-06-2006
2024PECCB293,LOKESH.M,12-09-2006
2024PECCB295,LOKESHWARAN K,30-12-2006
2024PECCB296,MANOJ R,23-05-2007
2024PECCB297,MANOJ KRISHNA K S,07-01-2007
2024PECCB298,MATHESH J,07-01-2007
2024PECCB299,MOHAMED AASEEF.M,09-08-2006
2024PECCB300,MOHITH HARIHARAN V,28-10-2005
2024PECCB301,NARASIMHA CHOWDARY V.C,23-07-2006
2024PECCB302,NARESH.R,05-02-2005
2024PECCB303,NAREN M,12-03-2007
2024PECCB304,NIHAL.B,27-09-2006
2024PECCB305,NIKHIL S,18-08-2006
2024PECCB306,NITHEESH KUMAR K R,19-12-2006
2024PECCB307,NITHISH KUMAR G,28-09-2006
2024PECCB309,PAVAN K,15-02-2006
2024PECCB310,PRAVIN KUMAR.A,29-03-2007
2024PECCB311,PRABHA.K,28-01-2006
2024PECCB312,RAGURAMAN S,04-07-2006
2024PECCB313,RAHUL KAUSHIK .L,13-03-2006
2024PECCB314,RAJARAJAN N,19-08-2006
2024PECCB316,RITHICK MURUGAN,24-9-2006
2024PECCB317,ROHITH J,16-12-2006
2024PECCB318,ROHITH SARAVANAN,05-04-2007
2024PECCB319,ROHITH.V.K,01-04-2007
2024PECCB320,RUBEN HALL JASTER.F,14-10-2005
2024PECCB321,SABARISH J,02-11-2006
2024PECCB322,SABARISH R,08-10-2007
2024PECCB323,SACHIN A,30-01-2007
2024PECCB324,SAIKRISHNAN S,11-12-2005
2024PECCB325,SAMUEL T,03-02-2007
2024PECCB326,SANJAI R,29-08-2005
2024PECCB327,SANTHOSH B,23-09-2006
2024PECCB328,S SARANAESWAR,09-09-2006
2024PECCB329,SARAN KUMAR U,17-06-2006
2024PECCB330,SARAVANAKUMAR G,15-07-2006
2024PECCB331,SENGAN S,25-08-2006
2024PECCB332,SHAFEEQ S,11-02-2007
2024PECCB333,SHARAN M,08-12-2006
2024PECCB334,SHASHANK S,05-10-2006
2024PECCB335,SHESHANANTHAN G,15-07-2006
2024PECCB336,SIDDHARTH M,21-03-2007
2024PECCB337,SRIKESH R,16-09-2006
2024PECCB338,SURIYA M,25-04-2007
2024PECCB339,SURIYA PRAKASH BS,21-06-2006
2024PECCB340,SURYA R M,02-12-2006
2024PECCB341,TAMILSELVAN M,08-04-2007
2024PECCB342,TARUN.H,08-09-2006
2024PECCB343,THARUN KALATHI V,24-11-2006
2024PECCB344,THARUN.S,18-03-2006
2024PECCB345,VENKATA HANUMA PHANI DATTA BHASKARUNI,08-05-2007
2024PECCB346,VEMULA LAKSHMI NARAYANA,06-03-2005
2024PECCB347,VIGNESH R,24-02-2007
2024PECCB348,VIJAYAGOVINDH J,17-08-2006
2024PECCB349,VINESH S,24-03-2007
2024PECCB350,YAKESH SHARMA.P,05-05-2007
2024PECCB351,YOGAPRADEEP,23-11-2006
2024PECCB352,YUVARAJ M,23-11-2006`;

export async function seedInitialData() {
  try {
    const studentRes = await (db.select({ count: count() }).from(schema.students) as any).get();
    if (Number(studentRes?.count || 0) === 0) {
      const lines = defaultStudentData.split('\n').map((l) => l.trim()).filter(Boolean);
      for (const line of lines) {
        const [rollNumber, name, dob] = line.split(',');
        if (rollNumber && name && dob) {
          await db
            .insert(schema.students)
            .values({
              rollNumber,
              name,
              dob,
              department: 'CSBS',
              year: 3,
            });
        }
      }
      console.log('Seeded initial student dataset.');
    }

    const facultyRes = await (db.select({ count: count() }).from(schema.faculty) as any).get();
    let facId = 1;
    if (Number(facultyRes?.count || 0) === 0) {
      const [fac] = await db
        .insert(schema.faculty)
        .values({
          name: 'Test Faculty',
          email: 'faculty@codelab.edu',
          password: 'faculty123',
        })
        .returning();
      if (fac) facId = fac.id;
      console.log('Seeded default faculty user.');
    } else {
      const existingFac = await (db.select({ id: schema.faculty.id }).from(schema.faculty) as any).get();
      if (existingFac) facId = existingFac.id;
    }

    const testRes = await (db.select({ count: count() }).from(schema.tests) as any).get();
    if (Number(testRes?.count || 0) === 0) {
      const now = new Date();
      const future = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

      const [newTest] = await db
        .insert(schema.tests)
        .values({
          title: 'DESIGN AND ANALYSIS OF COMPUTER ALGORITHM',
          subject: '23CB1501',
          facultyId: facId,
          duration: 60,
          startTime: now.toISOString(),
          endTime: future.toISOString(),
          status: 'published',
        })
        .returning();

      const testId = newTest ? newTest.id : 1;

      // Seed Questions
      await db.insert(schema.questions).values([
        {
          testId,
          title: 'Binary Search',
          description:
            'Given an array of integers nums which is sorted in ascending order, and an integer target, write a function to search target in nums. If target exists, then return its index. Otherwise, return -1.',
          constraints:
            '1 <= nums.length <= 10^4\n-10^4 < nums[i], target < 10^4\nAll the integers in nums are unique.\nnums is sorted in ascending order.',
          inputFormat: '[-1,0,3,5,9,12]\n9',
          outputFormat: '4',
          sampleInput: '[-1,0,3,5,9,12]\n9',
          sampleOutput: '4',
          publicExplanation: '9 exists in nums and its index is 4',
          privateInput1: '[-1,0,3,5,9,12]\n2',
          privateOutput1: '-1',
          privateInput2: '[5]\n5',
          privateOutput2: '0',
          difficulty: 'easy',
          functionName: 'search',
          returnType: 'int',
          parameters: JSON.stringify([
            { name: 'nums', type: 'int[]' },
            { name: 'target', type: 'int' },
          ]),
        },
        {
          testId,
          title: 'Merge Sort',
          description:
            'Given an array of integers nums, sort the array in ascending order using the Merge Sort algorithm and return it.',
          constraints: '1 <= nums.length <= 5 * 10^4\n-5 * 10^4 <= nums[i] <= 5 * 10^4',
          inputFormat: '[5,2,3,1]',
          outputFormat: '[1,2,3,5]',
          sampleInput: '[5,2,3,1]',
          sampleOutput: '[1,2,3,5]',
          publicExplanation: 'After sorting the array, the elements are in ascending order.',
          privateInput1: '[5,1,1,2,0,0]',
          privateOutput1: '[0,0,1,1,2,5]',
          privateInput2: '[1]',
          privateOutput2: '[1]',
          difficulty: 'medium',
          functionName: 'sortArray',
          returnType: 'int[]',
          parameters: JSON.stringify([{ name: 'nums', type: 'int[]' }]),
        },
        {
          testId,
          title: 'Quick Sort',
          description:
            'Given an array of integers nums, sort the array in ascending order using the Quick Sort algorithm and return it.',
          constraints: '1 <= nums.length <= 5 * 10^4\n-5 * 10^4 <= nums[i] <= 5 * 10^4',
          inputFormat: '[5,2,3,1]',
          outputFormat: '[1,2,3,5]',
          sampleInput: '[5,2,3,1]',
          sampleOutput: '[1,2,3,5]',
          publicExplanation: 'After sorting the array, the elements are in ascending order.',
          privateInput1: '[5,1,1,2,0,0]',
          privateOutput1: '[0,0,1,1,2,5]',
          privateInput2: '[1]',
          privateOutput2: '[1]',
          difficulty: 'medium',
          functionName: 'sortArray',
          returnType: 'int[]',
          parameters: JSON.stringify([{ name: 'nums', type: 'int[]' }]),
        },
        {
          testId,
          title: 'Matrix Multiplication',
          description:
            'Given two 2D integer arrays mat1 and mat2, return the product of the two matrices.',
          constraints:
            '1 <= mat1.length, mat2[0].length <= 50\n1 <= mat1[0].length == mat2.length <= 50\n-100 <= mat1[i][j], mat2[i][j] <= 100',
          inputFormat: '[[1,2],[3,4]]\n[[5,6],[7,8]]',
          outputFormat: '[[19,22],[43,50]]',
          sampleInput: '[[1,2],[3,4]]\n[[5,6],[7,8]]',
          sampleOutput: '[[19,22],[43,50]]',
          publicExplanation: 'Matrix multiplication of a 2x2 with a 2x2.',
          privateInput1: '[[1,0],[0,1]]\n[[5,6],[7,8]]',
          privateOutput1: '[[5,6],[7,8]]',
          privateInput2: '[[1,2,3]]\n[[1],[2],[3]]',
          privateOutput2: '[[14]]',
          difficulty: 'hard',
          functionName: 'multiply',
          returnType: 'int[][]',
          parameters: JSON.stringify([
            { name: 'mat1', type: 'int[][]' },
            { name: 'mat2', type: 'int[][]' },
          ]),
        },
      ]);
      console.log('Seeded default test and questions.');
    }
  } catch (err) {
    console.error('Error seeding initial data:', err);
  }
}

export const initPromise = process.env.DATABASE_URL ? seedInitialData() : Promise.resolve();
