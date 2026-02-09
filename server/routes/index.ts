import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupCustomAuth as setupAuth } from "../customAuth";
import { pool } from "../db";
import Stripe from "stripe";
import { stripeLogger } from "../logger";
import { enforcePaymentStatus, enforcePackageAccess, loadCurrentUser, type AuthRequest } from "../middleware/rowLevelSecurity";
import { isAuthenticated } from "../customAuth";

// Import all route modules
import { registerSchematicsRoutes } from "./schematics";
import { registerPartsRoutes } from "./parts";
import { registerRcaRoutes } from "./rca";
import { registerIntegrationsRoutes } from "./integrations";
import { registerPmSchedulesRoutes } from "./pmSchedules";
import { registerDowntimeRoutes } from "./downtime";
import { registerTrainingRoutes } from "./training";
import { registerTroubleshootingRoutes } from "./troubleshooting";
import { registerExcellenceRoutes } from "./excellence";
import { registerEquipmentRoutes } from "./equipment";
import { registerWorkOrdersRoutes } from "./workOrders";
import { registerCompaniesRoutes } from "./companies";
import { registerUsersRoutes } from "./users";
import { registerBillingRoutes } from "./billing";
import { registerAuthRoutes } from "./auth";
import { registerStripeWebhookRoutes } from "./stripeWebhook";
import { registerCilrRoutes } from "./cilr";
import { registerCenterlineRoutes } from "./centerlining";

// Initialize Stripe - blueprint reference: javascript_stripe
// Stripe is optional - app will run without it, billing features disabled
function initializeStripe(): Stripe | undefined {
  let stripeSecretKey = process.env.TESTING_STRIPE_SECRET_KEY;
  stripeLogger.debug({ keyPrefix: stripeSecretKey?.substring(0, 7) }, "TESTING_STRIPE_SECRET_KEY prefix");
  if (!stripeSecretKey || (!stripeSecretKey.startsWith('sk_') && !stripeSecretKey.startsWith('sk_test_'))) {
    stripeLogger.debug({}, "Using STRIPE_SECRET_KEY instead");
    stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    stripeLogger.debug({ keyPrefix: stripeSecretKey?.substring(0, 7) }, "STRIPE_SECRET_KEY prefix");
  }
  if (!stripeSecretKey) {
    stripeLogger.warn({}, "Stripe not configured - billing features will be disabled. Add STRIPE_SECRET_KEY to enable.");
    return undefined;
  }
  stripeLogger.info({ keyPrefix: stripeSecretKey.substring(0, 7) }, "Stripe initialized");
  return new Stripe(stripeSecretKey, {
    apiVersion: "2025-10-29.clover",
  });
}

export const stripe: Stripe | undefined = initializeStripe();

export async function registerRoutes(app: Express): Promise<Server> {
  // Health check endpoints (no auth required)
  app.get('/health', (_req, res) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  app.get('/ready', async (_req, res) => {
    try {
      // Check database connectivity
      await pool.query('SELECT 1');
      res.json({
        status: 'ready',
        timestamp: new Date().toISOString(),
        checks: {
          database: 'connected',
        },
      });
    } catch (error) {
      res.status(503).json({
        status: 'not ready',
        timestamp: new Date().toISOString(),
        checks: {
          database: 'disconnected',
        },
      });
    }
  });

  // Auth middleware
  await setupAuth(app);

  // Register Stripe webhook early (uses rawBody for signature verification)
  // Must be before payment enforcement middleware
  registerStripeWebhookRoutes(app);

  // Auth routes need to be available for login/logout/password reset
  registerAuthRoutes(app);

  // Billing routes need to be available for payment retry
  registerBillingRoutes(app);

  // Global payment enforcement middleware for all other API routes
  // This allows read-only access but blocks writes when payment has failed
  // Excludes: webhooks (registered above), auth routes, billing routes
  app.use('/api', async (req, res, next) => {
    // Skip payment enforcement for routes that were already registered above
    const exemptPaths = [
      '/api/webhooks',
      '/api/auth',
      '/api/login',
      '/api/logout',
      '/api/password-reset',
      '/api/signup',
      '/api/billing',
      '/api/subscription',
    ];

    // Check if path starts with any exempt path
    if (exemptPaths.some(exempt => req.path.startsWith(exempt))) {
      return next();
    }

    // For authenticated routes, load current user and enforce payment status
    if (!(req as any).user) {
      return next(); // Not authenticated yet, let route handler deal with it
    }

    // Load current user for payment and package access checks
    await loadCurrentUser(req as AuthRequest, res, () => {
      // First check payment status, then package access
      enforcePaymentStatus(req as AuthRequest, res, () => {
        enforcePackageAccess(req as AuthRequest, res, next);
      });
    });
  });

  // Register remaining route modules (subject to payment enforcement)
  registerUsersRoutes(app);
  registerCompaniesRoutes(app);
  registerEquipmentRoutes(app);
  registerWorkOrdersRoutes(app);
  registerPartsRoutes(app);
  registerPmSchedulesRoutes(app);
  registerIntegrationsRoutes(app);
  registerDowntimeRoutes(app);
  registerRcaRoutes(app);
  registerExcellenceRoutes(app);
  registerTrainingRoutes(app);
  registerTroubleshootingRoutes(app);
  registerSchematicsRoutes(app);
  registerCilrRoutes(app);
  registerCenterlineRoutes(app);

  const httpServer = createServer(app);
  return httpServer;
}
