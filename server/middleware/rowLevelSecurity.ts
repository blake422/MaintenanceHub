import type { Request, Response, NextFunction } from "express";
import type { User } from "@shared/schema";
import { storage } from "../storage";
import { apiLogger } from "../logger";
import { calculateTrialDaysRemaining } from "./demoEnforcement";

/**
 * Extended user context attached by loadCurrentUser middleware.
 * Provides normalized access to user properties.
 */
export interface CurrentUser {
  id: string;
  companyId: string | null;
  role: "admin" | "manager" | "tech";
  platformRole?: "platform_admin" | "customer_user";
  email?: string;
  firstName?: string;
  lastName?: string;
}

/**
 * Extended Express Request with authenticated user info.
 */
export interface AuthRequest extends Request {
  /** Raw user object from Passport session */
  user?: User;
  /** Normalized user context loaded by loadCurrentUser middleware */
  currentUser?: CurrentUser;
}

/**
 * Type guard: checks if currentUser exists on request.
 * Use after loadCurrentUser middleware.
 */
export function hasCurrentUser(
  req: AuthRequest
): req is AuthRequest & { currentUser: CurrentUser } {
  return req.currentUser !== undefined;
}

/**
 * Type guard: checks if user has company access.
 * Use after requireCompany middleware for type-safe companyId access.
 */
export function hasCompanyAccess(
  req: AuthRequest
): req is AuthRequest & { currentUser: CurrentUser & { companyId: string } } {
  return req.currentUser !== undefined && req.currentUser.companyId !== null;
}

/**
 * Middleware to load current user and attach to request.
 * Normalizes user data into currentUser for consistent access.
 * Always fetches fresh user data from database to ensure up-to-date platformRole, etc.
 */
export async function loadCurrentUser(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    // Custom auth: req.user is from session, but may be stale
    const sessionUser = req.user;
    if (!sessionUser?.id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Fetch fresh user data from database to ensure up-to-date platformRole
    const freshUser = await storage.getUser(sessionUser.id);
    if (!freshUser) {
      return res.status(401).json({ message: "User not found" });
    }

    // Update req.user with fresh data for other middleware
    req.user = freshUser;

    req.currentUser = {
      id: freshUser.id,
      companyId: freshUser.companyId ?? null,
      role: freshUser.role as "admin" | "manager" | "tech",
      platformRole: freshUser.platformRole as "platform_admin" | "customer_user" | undefined,
      email: freshUser.email ?? undefined,
      firstName: freshUser.firstName ?? undefined,
      lastName: freshUser.lastName ?? undefined,
    };

    next();
  } catch (error) {
    apiLogger.error({ err: error }, "Error loading current user");
    res.status(500).json({ message: "Internal server error" });
  }
}

// Middleware to ensure user has a company assigned and demo is not expired
export async function requireCompany(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  if (!req.currentUser?.companyId) {
    return res.status(403).json({ message: "No company assigned" });
  }

  // Check demo expiration for all company-scoped routes
  try {
    const company = await storage.getCompany(req.currentUser.companyId);
    if (company?.packageType === "demo" && company.demoExpiresAt) {
      const daysRemaining = calculateTrialDaysRemaining(company.demoExpiresAt);
      if (daysRemaining < 0) {
        return res.status(403).json({
          message: "Your free trial has expired",
          code: "TRIAL_EXPIRED",
          expiresAt: company.demoExpiresAt,
          upgradeUrl: "/billing/upgrade",
          daysExpired: Math.abs(daysRemaining),
        });
      }
    }
  } catch (error) {
    // On error, allow through (fail open) - don't block legitimate users
    apiLogger.error({ err: error }, "Error checking demo expiration in requireCompany");
  }

  next();
}

// Middleware to require specific roles
export function requireRole(roles: ("admin" | "manager" | "tech")[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.currentUser || !roles.includes(req.currentUser.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    next();
  };
}

// Helper to verify entity belongs to user's company
export async function verifyCompanyAccess(
  entityCompanyId: string,
  userCompanyId: string | null,
  userRole: string
): Promise<boolean> {
  // Admins can access all companies
  if (userRole === "admin") {
    return true;
  }

  // Other users can only access their own company
  return entityCompanyId === userCompanyId;
}

/**
 * Middleware to require platform admin role.
 * Use for platform-wide administrative operations.
 */
export function requirePlatformAdmin(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  if (req.currentUser?.platformRole !== "platform_admin") {
    return res.status(403).json({ message: "Platform admin access required" });
  }
  next();
}

/**
 * Middleware to require manager or admin role.
 * Use for company-level management operations.
 * Platform admins are also allowed.
 */
export function requireManagerOrAdmin(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  const isPlatformAdmin = req.currentUser?.platformRole === "platform_admin";
  if (!req.currentUser || (!isPlatformAdmin && !["admin", "manager"].includes(req.currentUser.role))) {
    return res.status(403).json({ message: "Manager or admin access required" });
  }
  next();
}

/**
 * Middleware to require admin role only.
 * Use for restricted company-level operations.
 * Platform admins are also allowed.
 */
export function requireAdmin(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  const isPlatformAdmin = req.currentUser?.platformRole === "platform_admin";
  if (!req.currentUser || (!isPlatformAdmin && req.currentUser.role !== "admin")) {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
}

/**
 * Package access configuration.
 * Defines which API paths are allowed for each package type.
 */
const PACKAGE_ACCESS: Record<string, string[]> = {
  // Troubleshooting tier: Only the Troubleshooting portal
  troubleshooting: [
    '/api/troubleshooting',
    '/api/user',  // User profile and auth
    '/api/auth',
    '/api/companies', // For fetching own company info
  ],
  // Full access and operations packages have access to everything
  full_access: ['*'],
  operations: ['*'],
  demo: ['*'],  // Demo gets full access during trial
};

/**
 * Middleware to enforce package-based feature access.
 * Restricts API access based on the company's subscription tier.
 * Platform admins are exempt from package restrictions.
 */
export async function enforcePackageAccess(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  // Platform admins bypass all package restrictions
  if (req.currentUser?.platformRole === 'platform_admin') {
    return next();
  }

  // Must have a company to check package access
  if (!req.currentUser?.companyId) {
    return next();
  }

  try {
    const company = await storage.getCompany(req.currentUser.companyId);
    if (!company) {
      return next();
    }

    const packageType = company.packageType || 'demo';
    const allowedPaths = PACKAGE_ACCESS[packageType];

    // If package allows all paths, continue
    if (!allowedPaths || allowedPaths.includes('*')) {
      return next();
    }

    // Check if the current path is allowed for this package
    const currentPath = req.path;
    const isAllowed = allowedPaths.some(allowedPath => 
      currentPath.startsWith(allowedPath)
    );

    if (!isAllowed) {
      apiLogger.warn(
        { 
          companyId: company.id, 
          packageType, 
          path: currentPath,
          userId: req.currentUser.id 
        },
        "Access blocked due to package restrictions"
      );

      return res.status(403).json({
        message: "This feature is not available in your subscription plan",
        code: "PACKAGE_RESTRICTED",
        packageType,
        upgradeUrl: "/billing",
      });
    }

    next();
  } catch (error) {
    // On error, allow through (fail open) - don't block legitimate users
    apiLogger.error({ err: error }, "Error checking package access");
    next();
  }
}

/**
 * Middleware to enforce payment status.
 * Blocks write operations (POST/PUT/DELETE) when payment has failed.
 * GET requests are allowed (read-only mode).
 * Platform admins are exempt from payment restrictions.
 * Use on routes that should be restricted when payment is past due.
 */
export async function enforcePaymentStatus(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  // Allow GET requests (read-only access)
  if (req.method === "GET") {
    return next();
  }

  // Must have a company to check payment status
  if (!req.currentUser?.companyId) {
    return next();
  }

  // Platform admins are exempt from payment restrictions
  if (req.currentUser.platformRole === 'platform_admin') {
    return next();
  }

  try {
    const company = await storage.getCompany(req.currentUser.companyId);

    if (company?.paymentRestricted) {
      apiLogger.warn(
        { companyId: company.id, method: req.method, path: req.path },
        "Write operation blocked due to payment restriction"
      );

      return res.status(402).json({
        message: "Payment Required - Your subscription payment has failed. Please update your payment method to continue using the platform.",
        code: "PAYMENT_FAILED",
        upgradeUrl: "/billing",
      });
    }

    next();
  } catch (error) {
    // On error, allow through (fail open) - don't block legitimate users
    apiLogger.error({ err: error }, "Error checking payment status");
    next();
  }
}
