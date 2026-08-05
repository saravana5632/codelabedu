# Production Deployment Guide

Your application is fully prepared for production deployment (e.g., on Google Cloud Run, Render, Railway).

## Deployment Steps

1. **Build**: The platform will run `npm install` and `npm run build`. This generates the optimized client application and a bundled server in the `dist/` directory.
2. **Start**: The platform will run `npm start` which executes `node dist/server.cjs`, running the full-stack app on port 3000.

## Database (LibSQL/Turso)

By default, the application runs on a local SQLite file (\`./data/codelab.db\`). In serverless environments, local files are ephemeral. 

To use a persistent database:
1. Create a free database on [Turso](https://turso.tech).
2. Obtain your Database URL and Auth Token.
3. Add the following environment variables to your deployment platform:
   - \`DATABASE_URL\`
   - \`DATABASE_AUTH_TOKEN\`

The backend will automatically detect these variables and connect to the remote database instead of the local file.
