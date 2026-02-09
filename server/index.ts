// Import env first to validate environment variables at startup
import { env } from "./config/env";

import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { apiLogger, logStartup, logStartupError } from "./logger";

const app = express();

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}
app.use(express.json({
  limit: '50mb',
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));

// Redirect all traffic from .replit.app to custom domain
app.use((req, res, next) => {
  const host = req.get("host") || "";

  // If custom domain is set and request is coming from .replit.app, redirect
  if (env.CUSTOM_DOMAIN && host.includes(".replit.app")) {
    const protocol = req.secure || req.get("x-forwarded-proto") === "https" ? "https" : "http";
    return res.redirect(301, `${protocol}://${env.CUSTOM_DOMAIN}${req.originalUrl}`);
  }

  next();
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  try {
    logStartup("Initializing MaintenanceHub server...");
    logStartup("Server configuration", {
      environment: env.NODE_ENV,
      port: env.PORT
    });

    const server = await registerRoutes(app);
    logStartup("Routes registered successfully");

    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      // Log the error instead of throwing (which causes unhandled rejection)
      apiLogger.error({ err, status, message }, "Request error");
      res.status(status).json({ message });
    });

    // importantly only setup vite in development and after
    // setting up all the other routes so the catch-all route
    // doesn't interfere with the other routes
    if (app.get("env") === "development") {
      logStartup("Setting up Vite development server...");
      await setupVite(app, server);
      logStartup("Vite setup complete");
    } else {
      logStartup("Serving static production build...");
      serveStatic(app);
      logStartup("Static files configured");
    }

    // ALWAYS serve the app on the port specified in the environment variable PORT
    // Other ports are firewalled. Default to 5000 if not specified.
    // this serves both the API and the client.
    // It is the only port that is not firewalled.
    const port = parseInt(env.PORT, 10);

    logStartup("Starting server...", { port });

    server.listen(port, () => {
      logStartup("Server successfully started", { port });
      log(`serving on port ${port}`);
    });

    // Handle server errors
    server.on("error", (error: NodeJS.ErrnoException) => {
      logStartupError("Server error", error);
      if (error.code === "EADDRINUSE") {
        logStartupError(`Port ${port} is already in use`, error);
      }
      process.exit(1);
    });

  } catch (error) {
    logStartupError("Failed to initialize server", error);
    process.exit(1);
  }
})();
