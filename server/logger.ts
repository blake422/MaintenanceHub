import pino from "pino";
import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";

/**
 * Application logger configuration.
 * Uses Pino for high-performance structured logging.
 */
export const logger = pino({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === "production" ? "info" : "debug"),
  transport: process.env.NODE_ENV !== "production" ? {
    target: "pino-pretty",
    options: {
      colorize: true,
      translateTime: "SYS:standard",
      ignore: "pid,hostname",
    },
  } : undefined,
  base: {
    service: "maintenance-hub",
    env: process.env.NODE_ENV,
  },
});

// Child loggers for different modules
export const dbLogger = logger.child({ module: "database" });
export const authLogger = logger.child({ module: "auth" });
export const apiLogger = logger.child({ module: "api" });
export const aiLogger = logger.child({ module: "ai" });
export const emailLogger = logger.child({ module: "email" });
export const stripeLogger = logger.child({ module: "stripe" });
export const importLogger = logger.child({ module: "import" });

// Extended request type for logging
interface LoggableRequest extends Request {
  requestId?: string;
  log?: pino.Logger;
}

/**
 * Request logging middleware.
 * Attaches a request ID and child logger to each request.
 */
export function requestLogger() {
  return (req: LoggableRequest, res: Response, next: NextFunction) => {
    const requestId = (req.headers["x-request-id"] as string) || randomUUID();
    req.requestId = requestId;
    req.log = logger.child({
      requestId,
      path: req.path,
      method: req.method,
    });

    const start = Date.now();
    res.on("finish", () => {
      const duration = Date.now() - start;
      const logData = {
        statusCode: res.statusCode,
        duration,
        userAgent: req.get("user-agent"),
      };

      if (res.statusCode >= 500) {
        req.log?.error(logData, "Request failed");
      } else if (res.statusCode >= 400) {
        req.log?.warn(logData, "Request error");
      } else if (req.path.startsWith("/api")) {
        req.log?.info(logData, "Request completed");
      }
    });

    next();
  };
}

/**
 * Startup logger for server initialization.
 */
export const startupLogger = logger.child({ module: "startup" });

/**
 * Log a startup event with consistent formatting.
 */
export function logStartup(message: string, data?: Record<string, unknown>) {
  startupLogger.info(data || {}, message);
}

/**
 * Log a startup error with consistent formatting.
 */
export function logStartupError(message: string, error: unknown) {
  const err = error instanceof Error ? error : new Error(String(error));
  startupLogger.error({ err }, message);
}
