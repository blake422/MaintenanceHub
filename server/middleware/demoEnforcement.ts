import type { Response, NextFunction } from "express";
import { storage } from "../storage";
import { apiLogger } from "../logger";
import type { AuthRequest } from "./rowLevelSecurity";

/**
 * Demo Expiration Enforcement Middleware
 *
 * Checks if the user's company is on an expired trial/demo and blocks access.
 * Returns 403 with upgrade instructions if trial has expired.
 *
 * Apply this middleware AFTER loadCurrentUser and requireCompany on routes
 * that should be blocked for expired demos.
 *
 * Usage:
 *   app.get("/api/protected", isAuthenticated, loadCurrentUser, requireCompany, enforceDemoExpiration, handler)
 */
export async function enforceDemoExpiration(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Skip if no user or company (let other middleware handle this)
    if (!req.currentUser?.companyId) {
      return next();
    }

    const company = await storage.getCompany(req.currentUser.companyId);
    if (!company) {
      return next();
    }

    // Only check demo companies
    if (company.packageType !== "demo") {
      return next();
    }

    // Check if demo has expired
    if (company.demoExpiresAt) {
      const now = new Date();
      const expiresAt = new Date(company.demoExpiresAt);

      if (now > expiresAt) {
        apiLogger.warn(
          {
            companyId: company.id,
            companyName: company.name,
            demoExpiresAt: company.demoExpiresAt,
            userId: req.currentUser.id,
          },
          "Access blocked - trial expired"
        );

        res.status(403).json({
          message: "Your free trial has expired",
          code: "TRIAL_EXPIRED",
          expiresAt: company.demoExpiresAt,
          upgradeUrl: "/billing/upgrade",
          daysExpired: Math.floor((now.getTime() - expiresAt.getTime()) / (1000 * 60 * 60 * 24)),
        });
        return;
      }
    }

    // Demo is still valid, continue
    next();
  } catch (error) {
    apiLogger.error({ err: error }, "Error in demo enforcement middleware");
    // On error, allow through (fail open) - don't block legitimate users
    next();
  }
}

/**
 * Calculate days remaining in trial
 * Returns negative number if expired
 */
export function calculateTrialDaysRemaining(demoExpiresAt: Date | string | null): number {
  if (!demoExpiresAt) {
    return 0;
  }

  const now = new Date();
  const expiresAt = new Date(demoExpiresAt);
  const diffMs = expiresAt.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Get demo status for a company
 * Useful for including in API responses
 */
export async function getDemoStatus(companyId: string): Promise<{
  isDemo: boolean;
  expiresAt: Date | null;
  daysRemaining: number;
  isExpired: boolean;
} | null> {
  const company = await storage.getCompany(companyId);
  if (!company) {
    return null;
  }

  if (company.packageType !== "demo") {
    return {
      isDemo: false,
      expiresAt: null,
      daysRemaining: 0,
      isExpired: false,
    };
  }

  const daysRemaining = calculateTrialDaysRemaining(company.demoExpiresAt);

  return {
    isDemo: true,
    expiresAt: company.demoExpiresAt,
    daysRemaining,
    isExpired: daysRemaining < 0,
  };
}
