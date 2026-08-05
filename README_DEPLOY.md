# Production Deployment Guide
Your application is fully prepared for production deployment.

## Deployment Steps
1. **Build**: The platform will run `npm install` and `npm run build`. This generates the optimized client application and a bundled server in the `dist/` directory.
2. **Start**: The platform will run `npm start` which executes `node dist/server.cjs`, running the full-stack app on port 3000.

## Database (PostgreSQL)
The application is configured to use PostgreSQL (e.g., via Supabase, Neon, or Railway).
1. Create a PostgreSQL database (e.g., on Supabase).
2. Obtain your Database connection string (URL).
3. Add the following environment variable to your deployment platform:
   - `DATABASE_URL`

The backend will automatically use `DATABASE_URL` to connect to your PostgreSQL database.
