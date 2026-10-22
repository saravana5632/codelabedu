import { sql } from "drizzle-orm";
import express from "express";
import path from "path";
import cors from "cors";

import { setupRoutes } from "./src/routes.js";
import { db } from "./src/db/index.js";
import { ensureTimerTables } from "./src/db/migrate.js";
import { processExpiredSessions } from "./src/controllers/timer.js";

async function startServer() {
  await ensureTimerTables();

  // Lightweight background sweep every 15s to auto-finalize expired sessions
  // even when students close or disconnect their browsers.
  setInterval(() => {
    processExpiredSessions().catch((err) =>
      console.error("[TIMER SWEEP] Interval error:", err)
    );
  }, 15000);

  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
