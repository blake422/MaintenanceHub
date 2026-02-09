import type { Request, Response, NextFunction } from "express";
import { z, type ZodSchema } from "zod";
import { apiLogger } from "../logger";

/**
 * Validation middleware for request body.
 * Parses and validates request body against a Zod schema.
 */
export function validateBody<T extends ZodSchema>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      apiLogger.warn(
        { errors: result.error.errors, path: req.path },
        "Request body validation failed"
      );
      return res.status(400).json({
        message: "Validation failed",
        errors: result.error.errors,
      });
    }
    req.body = result.data;
    next();
  };
}

/**
 * Validation middleware for URL parameters.
 * Parses and validates req.params against a Zod schema.
 */
export function validateParams<T extends ZodSchema>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      apiLogger.warn(
        { errors: result.error.errors, path: req.path, params: req.params },
        "Request params validation failed"
      );
      return res.status(400).json({
        message: "Invalid parameters",
        errors: result.error.errors,
      });
    }
    next();
  };
}

/**
 * Validation middleware for query parameters.
 * Parses and validates req.query against a Zod schema.
 */
export function validateQuery<T extends ZodSchema>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      apiLogger.warn(
        { errors: result.error.errors, path: req.path, query: req.query },
        "Request query validation failed"
      );
      return res.status(400).json({
        message: "Invalid query parameters",
        errors: result.error.errors,
      });
    }
    req.query = result.data;
    next();
  };
}

/**
 * Combined validation helper for common patterns.
 * Validates params with UUID id and optional body schema.
 */
export function validateResource<T extends ZodSchema>(bodySchema?: T) {
  const idSchema = z.object({ id: z.string().uuid() });

  return [
    validateParams(idSchema),
    ...(bodySchema ? [validateBody(bodySchema)] : []),
  ];
}
