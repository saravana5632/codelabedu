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
    if (process.env.SQL_HOST) {
      console.log('Using Cloud SQL environment variables');
      global._postgresPool = new Pool({
        host: process.env.SQL_HOST,
        user: process.env.SQL_USER,
        password: process.env.SQL_PASSWORD,
        database: process.env.SQL_DB_NAME,
        max: 10,
        connectionTimeoutMillis: 15000,
      });
    } else {
      if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes('[YOUR-PASSWORD]')) {
         console.error("WARNING: DATABASE_URL is not set or contains placeholder password.");
      }
      let connectionString = process.env.DATABASE_URL!;
      if (connectionString && connectionString.includes('supabase.co')) {
        try {
          const urlObj = new URL(connectionString);
          if (urlObj.password.startsWith('%5B') && urlObj.password.endsWith('%5D')) {
            urlObj.password = urlObj.password.slice(3, -3);
          }
          const hostParts = urlObj.hostname.split('.');
          if (hostParts[0] === 'db' && hostParts.length >= 3) {
            const tenantId = hostParts[1];
            urlObj.hostname = `aws-0-ap-southeast-1.pooler.supabase.com`;
            urlObj.port = '6543';
            if (urlObj.username === 'postgres') {
              urlObj.username = `postgres.${tenantId}`;
            }
            connectionString = urlObj.toString();
          }
        } catch (e) {
          console.error("Error rewriting supabase url:", e);
        }
      }
      const isSupabase = connectionString && connectionString.includes('supabase');
      global._postgresPool = new Pool({
        connectionString: connectionString,
        max: 10,
        connectionTimeoutMillis: 15000,
        ssl: isSupabase ? { rejectUnauthorized: false } : undefined,
      });
    }
    
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

    /* Test seeding removed */
    
  } catch (err) {
    console.error('Error seeding initial data:', err);
  }
}

export const initPromise = process.env.DATABASE_URL ? seedInitialData() : Promise.resolve();
