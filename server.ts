import { sql } from "drizzle-orm";
import express from "express";
import path from "path";
import cors from "cors";

import { setupRoutes } from "./src/routes.js";
import { db } from "./src/db/index.js";

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  // Render frontend might be on a different origin in production
  app.use(cors({
    origin: process.env.FRONTEND_URL || "*",
    credentials: true
  }));
  app.use(express.json());

  app.get("/api/health", async (req, res) => {
    try {
      const result = await db.run(sql`SELECT 1`);
      res.json({ status: "ok", database: "connected" });
    } catch (error) {
      console.error("[HEALTH] Database check failed:", error);
      res.status(503).json({ status: "error", database: "disconnected" });
    }
  });

  // API Routes
  setupRoutes(app);

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    // Express 5.x uses *all or wildcard syntax, but app.get('*') usually works. Wait, for Express 5: app.get('*', ...) still works for catch-all if we use it, wait: app.get("*", ...) might be deprecated in favor of "*all". The guidelines mention: "In Express v4, use app.get('*', ...), but in Express v5, you must use app.get('*all', ...)"
    app.get("*all", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Centralized Error Handling Middleware
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("[SERVER ERROR]", err.message || err);
    res.status(err.status || 500).json({
      success: false,
      message: "Internal server error"
    });
  });

  app.listen(PORT, "0.0.0.0", (err) => { if (err) { console.error(err); process.exit(1); }
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
