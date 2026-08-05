import express from "express";
import path from "path";
import cors from "cors";
import { createServer as createViteServer } from "vite";
import { setupRoutes } from "./src/routes.js";
import { db } from "./src/db/index.js";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // API Routes
  setupRoutes(app);

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
