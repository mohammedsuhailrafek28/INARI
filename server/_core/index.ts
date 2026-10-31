import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { logger } from "./logger";
import { serveStatic, setupVite } from "./vite";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // 8 MB covers the largest accepted import (6M-character CSV text); 50 MB let anyone send far more than any import allows.
  app.use(express.json({ limit: "8mb" }));
  app.use(express.urlencoded({ limit: "8mb", extended: true }));
  app.get("/api/health", (_req, res) => {
    res.json({
      ok: true,
      service: "inari",
      mode: process.env.WEALTHVERSE_DEMO_MODE === "true" ? "demo" : "standard",
    });
  });
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  const isBuiltServer = import.meta.url.includes("/dist/") || import.meta.url.includes("\\dist\\");
  if (process.env.NODE_ENV !== "production" && !isBuiltServer) {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const isProduction = process.env.NODE_ENV === "production";
  const port = isProduction ? preferredPort : await findAvailablePort(preferredPort);
  const host = isProduction ? "0.0.0.0" : undefined;

  if (!isProduction && port !== preferredPort) {
    logger.info("Preferred port busy; using alternate port.", { preferredPort, port });
  }

  server.listen(port, host, () => {
    logger.info("Server started.", { port, host: host ?? "default" });
  });
}

startServer().catch((error) => logger.error("Server failed to start.", { error }));
