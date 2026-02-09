import type { Express } from "express";
import { randomUUID } from "crypto";
import { storage } from "../storage";
import { isAuthenticated } from "../customAuth";
import { stripe } from "./index";
import { MANAGER_PRICE_CENTS, TECH_PRICE_CENTS, TROUBLESHOOTING_PRICE_CENTS } from "../constants";
import { loadCurrentUser, requireAdmin, type AuthRequest } from "../middleware/rowLevelSecurity";
import { stripeLogger } from "../logger";

/**
 * Guard function to check if Stripe is configured
 * Returns false and sends 503 response if Stripe is not available
 */
function requireStripe(res: any): boolean {
  if (!stripe) {
    res.status(503).json({
      message: "Billing is not configured. Please add STRIPE_SECRET_KEY to enable billing features."
    });
    return false;
  }
  return true;
}

/**
 * Get or create Stripe product and price IDs
 * Caches IDs in database to avoid creating duplicates on every request
 */
async function getOrCreateStripePrices(): Promise<{
  productId: string;
  managerPriceId: string;
  techPriceId: string;
  troubleshootingPriceId: string;
}> {
  // Check cache first
  let productId = await storage.getStripeConfig("stripe_product_id");
  let managerPriceId = await storage.getStripeConfig("stripe_manager_price_id");
  let techPriceId = await storage.getStripeConfig("stripe_tech_price_id");
  let troubleshootingPriceId = await storage.getStripeConfig("stripe_troubleshooting_price_id");

  // Create product if not cached
  if (!productId) {
    stripeLogger.info({}, "Creating new Stripe product (not cached)");
    const product = await stripe.products.create(
      {
        name: "MaintenanceHub",
        description: "Industrial maintenance management platform - per-user billing",
      },
      { idempotencyKey: `product-create-${randomUUID()}` }
    );
    productId = product.id;
    await storage.setStripeConfig("stripe_product_id", productId);
    stripeLogger.info({ productId }, "Stripe product created and cached");
  }

  // Create manager price if not cached
  if (!managerPriceId) {
    stripeLogger.info({}, "Creating new Stripe manager price (not cached)");
    const price = await stripe.prices.create(
      {
        product: productId,
        currency: "usd",
        recurring: { interval: "month" },
        unit_amount: MANAGER_PRICE_CENTS,
        nickname: "Manager/Admin License",
      },
      { idempotencyKey: `manager-price-create-${randomUUID()}` }
    );
    managerPriceId = price.id;
    await storage.setStripeConfig("stripe_manager_price_id", managerPriceId);
    stripeLogger.info({ managerPriceId }, "Manager price created and cached");
  }

  // Create tech price if not cached
  if (!techPriceId) {
    stripeLogger.info({}, "Creating new Stripe tech price (not cached)");
    const price = await stripe.prices.create(
      {
        product: productId,
        currency: "usd",
        recurring: { interval: "month" },
        unit_amount: TECH_PRICE_CENTS,
        nickname: "Technician License",
      },
      { idempotencyKey: `tech-price-create-${randomUUID()}` }
    );
    techPriceId = price.id;
    await storage.setStripeConfig("stripe_tech_price_id", techPriceId);
    stripeLogger.info({ techPriceId }, "Tech price created and cached");
  }

  // Create troubleshooting price if not cached
  if (!troubleshootingPriceId) {
    stripeLogger.info({}, "Creating new Stripe troubleshooting price (not cached)");
    const price = await stripe.prices.create(
      {
        product: productId,
        currency: "usd",
        recurring: { interval: "month" },
        unit_amount: TROUBLESHOOTING_PRICE_CENTS,
        nickname: "Troubleshooting License",
      },
      { idempotencyKey: `troubleshooting-price-create-${randomUUID()}` }
    );
    troubleshootingPriceId = price.id;
    await storage.setStripeConfig("stripe_troubleshooting_price_id", troubleshootingPriceId);
    stripeLogger.info({ troubleshootingPriceId }, "Troubleshooting price created and cached");
  }

  return { productId, managerPriceId, techPriceId, troubleshootingPriceId };
}

/**
 * Sync subscription item IDs from Stripe to database
 * This fixes cases where subscription items were recreated in Stripe
 * but the database still has old item IDs
 */
async function syncSubscriptionItemIds(companyId: string, subscriptionId: string): Promise<{
  managerItemId: string | null;
  techItemId: string | null;
}> {
  const subscription = await stripe!.subscriptions.retrieve(subscriptionId);
  
  const managerPriceId = await storage.getStripeConfig("stripe_manager_price_id");
  const techPriceId = await storage.getStripeConfig("stripe_tech_price_id");
  
  let managerItemId: string | null = null;
  let techItemId: string | null = null;
  
  for (const item of subscription.items.data) {
    if (item.price.id === managerPriceId) {
      managerItemId = item.id;
    } else if (item.price.id === techPriceId) {
      techItemId = item.id;
    }
  }
  
  // Update database with correct item IDs - use null to clear stale IDs
  // We need to update directly since updateCompanyStripeInfo ignores undefined
  const { db } = await import("../db");
  const { companies } = await import("@shared/schema");
  const { eq } = await import("drizzle-orm");
  
  await db
    .update(companies)
    .set({
      stripeManagerItemId: managerItemId,
      stripeTechItemId: techItemId,
      updatedAt: new Date(),
    })
    .where(eq(companies.id, companyId));
  
  stripeLogger.info({
    companyId,
    subscriptionId,
    managerItemId,
    techItemId,
  }, "Synced subscription item IDs from Stripe");
  
  return { managerItemId, techItemId };
}

export function registerBillingRoutes(app: Express): void {
  // Create subscription/payment intent
  app.post('/api/subscription/create-payment-intent', isAuthenticated as any, loadCurrentUser as any, requireAdmin as any, async (req: any, res) => {
    if (!requireStripe(res)) return;
    try {
      const userId = req.user?.id || req.currentUser?.id;
      const currentUser = await storage.getUser(userId);

      if (!currentUser || !currentUser.companyId) {
        return res.status(400).json({ message: "Must be part of a company to manage billing" });
      }

      const company = await storage.getCompany(currentUser.companyId);
      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }

      // Check if subscription already exists
      if (company.stripeSubscriptionId) {
        const subscription = await stripe.subscriptions.retrieve(company.stripeSubscriptionId);

        // If subscription is incomplete_expired, cancel it and create a new one
        if (subscription.status === 'incomplete_expired') {
          stripeLogger.info({ subscriptionId: subscription.id }, "Clearing incomplete_expired subscription");
          await storage.updateCompanyStripeInfo(company.id, {
            stripeSubscriptionId: undefined,
            subscriptionStatus: undefined,
          });
          // Fall through to create new subscription
        }
        // If subscription is incomplete, try to get the payment intent
        else if (subscription.status === 'incomplete') {
          const latestInvoice = subscription.latest_invoice;
          if (latestInvoice && typeof latestInvoice === 'object' && 'payment_intent' in latestInvoice) {
            const paymentIntent = latestInvoice.payment_intent;
            if (paymentIntent && typeof paymentIntent === 'object' && 'client_secret' in paymentIntent) {
              stripeLogger.info({ subscriptionId: subscription.id }, "Returning existing incomplete subscription");
              return res.json({
                subscriptionId: subscription.id,
                clientSecret: paymentIntent.client_secret,
                status: subscription.status,
              });
            }
          }
          // If we can't get the client secret, cancel and recreate
          stripeLogger.info({ subscriptionId: subscription.id }, "Incomplete subscription has no valid payment intent, canceling");
          try {
            await stripe.subscriptions.cancel(subscription.id);
          } catch (cancelErr) {
            stripeLogger.warn({ err: cancelErr }, "Failed to cancel incomplete subscription");
          }
          await storage.updateCompanyStripeInfo(company.id, {
            stripeSubscriptionId: undefined,
            subscriptionStatus: undefined,
          });
          // Fall through to create new subscription
        }
        // If subscription is active/trialing, return success
        else if (subscription.status === 'active' || subscription.status === 'trialing') {
          return res.json({
            subscriptionId: subscription.id,
            status: subscription.status,
            message: "Subscription already active",
          });
        }
        // For canceled subscriptions, clear and recreate
        else if (subscription.status === 'canceled') {
          await storage.updateCompanyStripeInfo(company.id, {
            stripeSubscriptionId: undefined,
            subscriptionStatus: undefined,
          });
          // Fall through to create new subscription
        }
        // For other statuses (past_due, unpaid), try to get payment intent
        else {
          const latestInvoice = subscription.latest_invoice;
          if (latestInvoice && typeof latestInvoice === 'object' && 'payment_intent' in latestInvoice) {
            const paymentIntent = latestInvoice.payment_intent;
            if (paymentIntent && typeof paymentIntent === 'object' && 'client_secret' in paymentIntent) {
              return res.json({
                subscriptionId: subscription.id,
                clientSecret: paymentIntent.client_secret,
                status: subscription.status,
              });
            }
          }
        }
      }

      // Create new Stripe customer if needed
      let customerId = company.stripeCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: currentUser.email || undefined,
          name: company.name,
          metadata: {
            companyId: company.id,
          },
        });

        customerId = customer.id;
        await storage.updateCompanyStripeInfo(company.id, {
          stripeCustomerId: customerId,
        });
      }

      // Get seat counts from storage
      const seatCounts = await storage.getCompanySeatCounts(company.id);

      if (seatCounts.totalSeats < 1) {
        return res.status(400).json({ message: "Company must have at least 1 user to create subscription" });
      }

      // Get cached prices (creates them if they don't exist)
      const { managerPriceId, techPriceId } = await getOrCreateStripePrices();

      // Build subscription items based on seat counts
      const subscriptionItems = [];
      if (seatCounts.managerSeats > 0) {
        subscriptionItems.push({
          price: managerPriceId,
          quantity: seatCounts.managerSeats,
        });
      }
      if (seatCounts.techSeats > 0) {
        subscriptionItems.push({
          price: techPriceId,
          quantity: seatCounts.techSeats,
        });
      }

      // Create subscription using cached prices with idempotency key
      const idempotencyKey = `subscription-${company.id}-${Date.now()}`;
      const subscription = await stripe.subscriptions.create(
        {
          customer: customerId,
          items: subscriptionItems,
          payment_behavior: 'default_incomplete',
          payment_settings: {
            save_default_payment_method: 'on_subscription',
          },
          expand: ['latest_invoice.payment_intent'],
          metadata: {
            companyId: company.id,
            userId: userId,
          },
        },
        { idempotencyKey }
      );

      // Save subscription info
      await storage.updateCompanyStripeInfo(company.id, {
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscription.id,
        subscriptionStatus: subscription.status,
      });

      // Update purchased seats based on subscription
      await storage.updateCompanyLicenses(company.id, {
        purchasedManagerSeats: seatCounts.managerSeats,
        purchasedTechSeats: seatCounts.techSeats,
      });

      const latestInvoice = subscription.latest_invoice;
      const paymentIntent = latestInvoice && typeof latestInvoice === 'object' && 'payment_intent' in latestInvoice
        ? latestInvoice.payment_intent
        : null;
      const clientSecret = paymentIntent && typeof paymentIntent === 'object' && 'client_secret' in paymentIntent
        ? paymentIntent.client_secret
        : null;

      // Log details to help debug payment form issues
      stripeLogger.info({
        subscriptionId: subscription.id,
        subscriptionStatus: subscription.status,
        hasLatestInvoice: !!latestInvoice,
        latestInvoiceType: latestInvoice ? typeof latestInvoice : 'null',
        hasPaymentIntent: !!paymentIntent,
        hasClientSecret: !!clientSecret,
      }, "Subscription created - returning client secret details");

      if (!clientSecret) {
        stripeLogger.warn({
          subscriptionId: subscription.id,
          subscriptionStatus: subscription.status,
        }, "No client secret available - user may not see payment form");
      }

      res.json({
        subscriptionId: subscription.id,
        clientSecret,
        status: subscription.status,
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      stripeLogger.error({ err }, "Error creating subscription");
      res.status(500).json({ message: "Failed to create subscription. Please try again or contact support." });
    }
  });

  // Get subscription status
  app.get('/api/subscription/status', isAuthenticated as any, loadCurrentUser as any, async (req: any, res) => {
    if (!requireStripe(res)) return;
    try {
      const userId = req.user?.id || req.currentUser?.id;
      const currentUser = await storage.getUser(userId);

      if (!currentUser || !currentUser.companyId) {
        return res.status(400).json({ message: "Must be part of a company" });
      }

      const company = await storage.getCompany(currentUser.companyId);
      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }

      // Get actual seat counts for per-user billing
      const seatCounts = await storage.getCompanySeatCounts(currentUser.companyId);
      const totalSeats = seatCounts.totalSeats;

      if (!company.stripeSubscriptionId) {
        return res.json({
          hasSubscription: false,
          licenseCount: totalSeats,
          usedLicenses: totalSeats,
        });
      }

      const subscription = await stripe.subscriptions.retrieve(company.stripeSubscriptionId);

      // Clear incomplete/expired subscriptions so user can start fresh
      if (subscription.status === 'incomplete_expired' || subscription.status === 'canceled') {
        await storage.updateCompanyStripeInfo(currentUser.companyId, {
          stripeSubscriptionId: undefined,
          subscriptionStatus: undefined,
        });

        return res.json({
          hasSubscription: false,
          licenseCount: totalSeats,
          usedLicenses: totalSeats,
        });
      }

      // Get current_period_end from subscription items (flexible billing mode)
      const periodEnd = subscription.current_period_end ??
        subscription.items.data[0]?.current_period_end;

      res.json({
        hasSubscription: true,
        status: subscription.status,
        licenseCount: totalSeats,
        usedLicenses: totalSeats,
        currentPeriodEnd: periodEnd,
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      stripeLogger.error({ err }, "Error fetching subscription status");
      res.status(500).json({ message: "Failed to fetch subscription status. Please try again." });
    }
  });

  // Get seat-based billing summary
  app.get('/api/billing/seat-summary', isAuthenticated as any, loadCurrentUser as any, async (req: any, res) => {
    try {
      const userId = req.user?.id || req.currentUser?.id;
      const currentUser = await storage.getUser(userId);

      if (!currentUser || !currentUser.companyId) {
        return res.status(400).json({ message: "Must be part of a company" });
      }

      const company = await storage.getCompany(currentUser.companyId);
      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }

      // Get seat counts by role
      const seatCounts = await storage.getCompanySeatCounts(currentUser.companyId);

      // Calculate monthly cost based on role-based pricing
      const managerPriceDollars = MANAGER_PRICE_CENTS / 100;
      const techPriceDollars = TECH_PRICE_CENTS / 100;
      const monthlyCost = (seatCounts.managerSeats * managerPriceDollars) + (seatCounts.techSeats * techPriceDollars);

      res.json({
        techSeats: seatCounts.techSeats,
        techPrice: techPriceDollars,
        managerSeats: seatCounts.managerSeats,
        managerPrice: managerPriceDollars,
        totalSeats: seatCounts.totalSeats,
        monthlyCost,
        isDemo: !company.isLive,
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      stripeLogger.error({ err }, "Error fetching seat summary");
      res.status(500).json({ message: "Failed to fetch seat information. Please try again." });
    }
  });

  // Create Stripe Checkout Session for billing setup
  app.post('/api/billing/create-checkout', isAuthenticated as any, async (req: any, res) => {
    if (!requireStripe(res)) return;
    try {
      const { companyId, licenseCount, managerSeats, techSeats, successUrl, cancelUrl } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ message: "Unauthorized - No user session" });
      }

      const currentUser = await storage.getUser(userId);
      if (!currentUser) {
        return res.status(401).json({ message: "User not found in database" });
      }

      // Use user's company if not specified
      const targetCompanyId = companyId || currentUser.companyId;
      if (!targetCompanyId) {
        return res.status(400).json({ message: "No company specified" });
      }

      const company = await storage.getCompany(targetCompanyId);
      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }

      // Check if user is platform admin or belongs to the company
      if (currentUser.platformRole !== 'platform_admin' && currentUser.companyId !== targetCompanyId) {
        stripeLogger.warn({
          userId,
          userCompanyId: currentUser.companyId,
          requestedCompanyId: targetCompanyId
        }, "Unauthorized checkout attempt - company mismatch");
        return res.status(403).json({ message: "Unauthorized - company mismatch" });
      }

      // Get cached prices (creates them if they don't exist)
      const { managerPriceId, techPriceId } = await getOrCreateStripePrices();

      // Use environment variable for canonical domain, fallback to origin header
      const canonicalDomain = process.env.CUSTOM_DOMAIN
        ? `https://${process.env.CUSTOM_DOMAIN}`
        : req.headers.origin;

      // Determine seat counts - use new seat-based params or fall back to legacy licenseCount
      const finalManagerSeats = managerSeats ?? licenseCount ?? 1;
      const finalTechSeats = techSeats ?? 0;

      // Require at least 1 manager seat - every company needs an admin to manage it
      if (finalManagerSeats < 1) {
        return res.status(400).json({
          message: "At least 1 Manager/Admin seat is required to manage your company",
          code: "MIN_MANAGER_SEAT_REQUIRED",
        });
      }

      // Build line items based on seat counts
      const lineItems: Array<{ price: string; quantity: number }> = [];
      lineItems.push({ price: managerPriceId, quantity: finalManagerSeats });
      if (finalTechSeats > 0) {
        lineItems.push({ price: techPriceId, quantity: finalTechSeats });
      }

      // Determine redirect URLs - use custom URLs if provided, otherwise default to billing page
      const finalSuccessUrl = successUrl
        ? `${canonicalDomain}${successUrl}${successUrl.includes('?') ? '&' : '?'}session_id={CHECKOUT_SESSION_ID}`
        : `${canonicalDomain}/billing?success=true&session_id={CHECKOUT_SESSION_ID}`;
      const finalCancelUrl = cancelUrl
        ? `${canonicalDomain}${cancelUrl}`
        : `${canonicalDomain}/billing?canceled=true`;

      const checkoutIdempotencyKey = `checkout-${targetCompanyId}-${Date.now()}`;
      const session = await stripe.checkout.sessions.create(
        {
          payment_method_types: ['card'],
          line_items: lineItems,
          mode: 'subscription',
          success_url: finalSuccessUrl,
          cancel_url: finalCancelUrl,
          customer_email: currentUser.email,
          metadata: {
            companyId: targetCompanyId,
            userId,
            managerSeats: finalManagerSeats.toString(),
            techSeats: finalTechSeats.toString(),
          },
        },
        { idempotencyKey: checkoutIdempotencyKey }
      );

      res.json({ url: session.url });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      stripeLogger.error({ err }, "Error creating checkout session");
      res.status(500).json({ message: "Failed to start checkout. Please try again or contact support." });
    }
  });

  // Get seat breakdown for billing management
  app.get('/api/billing/seats', isAuthenticated as any, loadCurrentUser as any, async (req: any, res) => {
    if (!requireStripe(res)) return;
    try {
      const userId = req.user?.id || req.currentUser?.id;
      const currentUser = await storage.getUser(userId);

      if (!currentUser || !currentUser.companyId) {
        return res.status(400).json({ message: "Must be part of a company" });
      }

      const company = await storage.getCompany(currentUser.companyId);
      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }

      // Platform admins get unlimited seats and no billing restrictions
      if (currentUser.platformRole === 'platform_admin') {
        const seatBreakdown = await storage.getSeatBreakdown(currentUser.companyId);
        return res.json({
          purchased: { manager: 999, tech: 999 },
          used: seatBreakdown.used,
          pending: seatBreakdown.pending,
          available: { manager: 999 - seatBreakdown.used.manager - seatBreakdown.pending.manager, tech: 999 - seatBreakdown.used.tech - seatBreakdown.pending.tech },
          managerPriceDollars: MANAGER_PRICE_CENTS / 100,
          techPriceDollars: TECH_PRICE_CENTS / 100,
          troubleshootingPriceDollars: TROUBLESHOOTING_PRICE_CENTS / 100,
          hasSubscription: true, // Treat as having subscription
          subscriptionStatus: 'active',
          paymentRestricted: false,
          isPlatformAdmin: true,
        });
      }

      const seatBreakdown = await storage.getSeatBreakdown(currentUser.companyId);

      // Get subscription details from Stripe if we have an active subscription
      let currentPeriodEnd: number | undefined;
      let cancelAtPeriodEnd = false;
      if (company.stripeSubscriptionId) {
        try {
          const subscription = await stripe.subscriptions.retrieve(company.stripeSubscriptionId);
          // Get current_period_end from subscription or items (flexible billing mode)
          currentPeriodEnd = subscription.current_period_end ??
            subscription.items.data[0]?.current_period_end;
          // Stripe uses either cancel_at_period_end (boolean) or cancel_at (timestamp)
          cancelAtPeriodEnd = subscription.cancel_at_period_end || !!subscription.cancel_at;
        } catch (e) {
          // Subscription might not exist anymore
        }
      }

      res.json({
        ...seatBreakdown,
        managerPriceDollars: MANAGER_PRICE_CENTS / 100,
        techPriceDollars: TECH_PRICE_CENTS / 100,
        troubleshootingPriceDollars: TROUBLESHOOTING_PRICE_CENTS / 100,
        hasSubscription: !!company.stripeSubscriptionId && company.subscriptionStatus === 'active',
        subscriptionStatus: company.subscriptionStatus,
        paymentRestricted: company.paymentRestricted || false,
        stripeManagerItemId: company.stripeManagerItemId,
        stripeTechItemId: company.stripeTechItemId,
        currentPeriodEnd,
        cancelAtPeriodEnd,
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      stripeLogger.error({ err }, "Error fetching seat breakdown");
      res.status(500).json({ message: "Failed to fetch seat information. Please try again." });
    }
  });

  // Update purchased seats (with Stripe proration)
  app.post('/api/billing/update-seats', isAuthenticated as any, loadCurrentUser as any, requireAdmin as any, async (req: any, res) => {
    if (!requireStripe(res)) return;
    try {
      const { managerSeats, techSeats } = req.body;
      const userId = req.user?.id || req.currentUser?.id;
      const currentUser = await storage.getUser(userId);

      if (!currentUser || !currentUser.companyId) {
        return res.status(400).json({ message: "Must be part of a company" });
      }

      const company = await storage.getCompany(currentUser.companyId);
      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }

      // Validate seat counts
      if (typeof managerSeats !== 'number' || typeof techSeats !== 'number') {
        return res.status(400).json({ message: "Invalid seat counts" });
      }

      if (managerSeats < 0 || techSeats < 0) {
        return res.status(400).json({ message: "Seat counts cannot be negative" });
      }

      // Require at least 1 manager seat - every company needs an admin to manage it
      if (managerSeats < 1) {
        return res.status(400).json({
          message: "At least 1 Manager/Admin seat is required to manage your company",
          code: "MIN_MANAGER_SEAT_REQUIRED",
        });
      }

      // Check that we're not reducing below current usage
      const seatBreakdown = await storage.getSeatBreakdown(currentUser.companyId);
      const minManagerSeats = seatBreakdown.used.manager + seatBreakdown.pending.manager;
      const minTechSeats = seatBreakdown.used.tech + seatBreakdown.pending.tech;

      if (managerSeats < minManagerSeats) {
        return res.status(400).json({
          message: `Cannot reduce manager seats below ${minManagerSeats} (${seatBreakdown.used.manager} active + ${seatBreakdown.pending.manager} pending)`,
          minRequired: minManagerSeats,
        });
      }

      if (techSeats < minTechSeats) {
        return res.status(400).json({
          message: `Cannot reduce tech seats below ${minTechSeats} (${seatBreakdown.used.tech} active + ${seatBreakdown.pending.tech} pending)`,
          minRequired: minTechSeats,
        });
      }

      // Check if company has an active subscription
      const hasActiveSubscription = company.stripeSubscriptionId &&
        (company.subscriptionStatus === 'active' || company.subscriptionStatus === 'trialing');

      if (!hasActiveSubscription) {
        // If there's a stuck incomplete subscription, clear it
        if (company.stripeSubscriptionId && company.subscriptionStatus === 'incomplete') {
          await storage.updateCompanyStripeInfo(currentUser.companyId, {
            stripeSubscriptionId: undefined,
            subscriptionStatus: undefined,
          });
        }

        // DON'T save seats to database without active subscription
        // Return preview info and require checkout to activate
        const estimatedMonthly = (managerSeats * MANAGER_PRICE_CENTS / 100) + (techSeats * TECH_PRICE_CENTS / 100);

        return res.json({
          success: false,
          requiresCheckout: true,
          message: "Please complete billing setup to activate seats",
          previewSeats: { manager: managerSeats, tech: techSeats },
          estimatedMonthly,
        });
      }

      // Check if subscription is set to cancel - block seat changes
      // Stripe uses either cancel_at_period_end (boolean) or cancel_at (timestamp)
      const subscription = await stripe.subscriptions.retrieve(company.stripeSubscriptionId);
      if (subscription.cancel_at_period_end || subscription.cancel_at) {
        return res.status(400).json({
          message: "Cannot modify seats while subscription is set to cancel. Reactivate your subscription first via Manage Billing.",
          code: "SUBSCRIPTION_CANCELING",
        });
      }

      // Determine if this is an upgrade or downgrade
      const currentTotalSeats = (company.purchasedManagerSeats || 0) + (company.purchasedTechSeats || 0);
      const newTotalSeats = managerSeats + techSeats;
      const isUpgrade = newTotalSeats > currentTotalSeats;

      // Get or create Stripe prices
      const { managerPriceId, techPriceId } = await getOrCreateStripePrices();

      // Build subscription items update
      const subscriptionItems: Array<{ id?: string; price: string; quantity: number; deleted?: boolean }> = [];

      // Handle manager seats
      if (company.stripeManagerItemId) {
        if (managerSeats > 0) {
          subscriptionItems.push({
            id: company.stripeManagerItemId,
            price: managerPriceId,
            quantity: managerSeats,
          });
        } else {
          subscriptionItems.push({
            id: company.stripeManagerItemId,
            deleted: true,
            price: managerPriceId,
            quantity: 0,
          });
        }
      } else if (managerSeats > 0) {
        subscriptionItems.push({
          price: managerPriceId,
          quantity: managerSeats,
        });
      }

      // Handle tech seats
      if (company.stripeTechItemId) {
        if (techSeats > 0) {
          subscriptionItems.push({
            id: company.stripeTechItemId,
            price: techPriceId,
            quantity: techSeats,
          });
        } else {
          subscriptionItems.push({
            id: company.stripeTechItemId,
            deleted: true,
            price: techPriceId,
            quantity: 0,
          });
        }
      } else if (techSeats > 0) {
        subscriptionItems.push({
          price: techPriceId,
          quantity: techSeats,
        });
      }

      if (subscriptionItems.length === 0) {
        return res.status(400).json({ message: "Must have at least one seat" });
      }

      // Update Stripe subscription with proration
      // - Upgrades: 'always_invoice' - charge immediately for new seats
      // - Downgrades: 'none' - no credit, they paid for the month, change takes effect immediately
      let updatedSubscription;
      try {
        updatedSubscription = await stripe.subscriptions.update(company.stripeSubscriptionId, {
          items: subscriptionItems,
          proration_behavior: isUpgrade ? 'always_invoice' : 'none',
        });
      } catch (stripeError: any) {
        // Handle payment failure during subscription update
        if (stripeError.type === 'StripeCardError' || stripeError.code === 'card_declined') {
          stripeLogger.warn({
            companyId: currentUser.companyId,
            error: stripeError.message,
          }, "Payment failed during seat update");
          return res.status(402).json({
            message: "Payment failed. Please update your payment method and try again.",
            code: "PAYMENT_FAILED",
          });
        }
        throw stripeError; // Re-throw other errors
      }

      // Check if there's a pending invoice that failed to pay
      if (updatedSubscription.pending_update) {
        stripeLogger.warn({
          companyId: currentUser.companyId,
          pendingUpdate: updatedSubscription.pending_update,
        }, "Subscription has pending update - payment may have failed");
      }

      // Extract the new item IDs from the updated subscription
      let newManagerItemId: string | undefined;
      let newTechItemId: string | undefined;

      for (const item of updatedSubscription.items.data) {
        if (item.price.id === managerPriceId) {
          newManagerItemId = item.id;
        } else if (item.price.id === techPriceId) {
          newTechItemId = item.id;
        }
      }

      // Update database with new seat counts and item IDs
      await storage.updatePurchasedSeats(
        currentUser.companyId,
        managerSeats,
        techSeats,
        newManagerItemId,
        newTechItemId
      );

      stripeLogger.info({
        companyId: currentUser.companyId,
        managerSeats,
        techSeats,
        subscriptionId: company.stripeSubscriptionId,
      }, "Seats updated successfully");

      res.json({
        success: true,
        message: "Seats updated and payment processed successfully",
        managerSeats,
        techSeats,
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      stripeLogger.error({ err }, "Error updating seats");
      res.status(500).json({ message: "Failed to update seats. Please try again or contact support." });
    }
  });

  // Preview cost of seat change
  app.post('/api/billing/preview-seat-change', isAuthenticated as any, loadCurrentUser as any, requireAdmin as any, async (req: any, res) => {
    if (!requireStripe(res)) return;
    try {
      const { managerSeats, techSeats } = req.body;
      const userId = req.user?.id || req.currentUser?.id;
      const currentUser = await storage.getUser(userId);

      if (!currentUser || !currentUser.companyId) {
        return res.status(400).json({ message: "Must be part of a company" });
      }

      let company = await storage.getCompany(currentUser.companyId);
      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }

      if (!company.stripeSubscriptionId) {
        // No subscription yet - just calculate the monthly cost
        const monthlyCost = (managerSeats * MANAGER_PRICE_CENTS / 100) + (techSeats * TECH_PRICE_CENTS / 100);
        return res.json({
          immediateCharge: 0,
          newMonthlyTotal: monthlyCost,
          prorationDetails: null,
        });
      }

      // Get cached prices
      const { managerPriceId, techPriceId } = await getOrCreateStripePrices();

      // Helper function to build subscription items with current company data
      const buildSubscriptionItems = (comp: typeof company) => {
        const items: Array<{ id?: string; price: string; quantity: number; deleted?: boolean }> = [];

        if (comp.stripeManagerItemId) {
          if (managerSeats > 0) {
            items.push({ id: comp.stripeManagerItemId, price: managerPriceId, quantity: managerSeats });
          } else {
            items.push({ id: comp.stripeManagerItemId, deleted: true, price: managerPriceId, quantity: 0 });
          }
        } else if (managerSeats > 0) {
          items.push({ price: managerPriceId, quantity: managerSeats });
        }

        if (comp.stripeTechItemId) {
          if (techSeats > 0) {
            items.push({ id: comp.stripeTechItemId, price: techPriceId, quantity: techSeats });
          } else {
            items.push({ id: comp.stripeTechItemId, deleted: true, price: techPriceId, quantity: 0 });
          }
        } else if (techSeats > 0) {
          items.push({ price: techPriceId, quantity: techSeats });
        }

        return items;
      };

      // Build preview items
      let subscriptionItems = buildSubscriptionItems(company);

      // Get current subscription to determine billing period
      const subscription = await stripe.subscriptions.retrieve(company.stripeSubscriptionId);
      const currentPeriodEnd = subscription.current_period_end ??
        subscription.items.data[0]?.current_period_end ?? 0;

      // Create invoice preview with auto-recovery for stale subscription item IDs
      let preview;
      try {
        preview = await stripe.invoices.createPreview({
          customer: company.stripeCustomerId!,
          subscription: company.stripeSubscriptionId,
          subscription_details: {
            items: subscriptionItems,
            proration_behavior: 'create_prorations',
          },
        });
      } catch (previewError: any) {
        // Check if error is due to invalid subscription item ID
        if (previewError?.type === 'StripeInvalidRequestError' && 
            previewError?.message?.includes('subscription item')) {
          stripeLogger.warn({
            companyId: company.id,
            subscriptionId: company.stripeSubscriptionId,
          }, "Subscription item IDs out of sync, auto-syncing from Stripe");
          
          // Sync subscription item IDs from Stripe
          const { managerItemId, techItemId } = await syncSubscriptionItemIds(
            company.id,
            company.stripeSubscriptionId
          );
          
          // Reload company with updated item IDs
          company = await storage.getCompany(currentUser.companyId);
          if (!company) {
            return res.status(404).json({ message: "Company not found" });
          }
          
          // Rebuild subscription items with synced IDs
          subscriptionItems = buildSubscriptionItems(company);
          
          // Retry the preview
          preview = await stripe.invoices.createPreview({
            customer: company.stripeCustomerId!,
            subscription: company.stripeSubscriptionId,
            subscription_details: {
              items: subscriptionItems,
              proration_behavior: 'create_prorations',
            },
          });
        } else {
          throw previewError;
        }
      }

      // Calculate new monthly total
      const newMonthlyTotal = (managerSeats * MANAGER_PRICE_CENTS / 100) + (techSeats * TECH_PRICE_CENTS / 100);

      // Separate proration line items from regular subscription charges
      // Prorations are the immediate charges for mid-cycle changes
      // Regular line items are the next billing cycle charges
      //
      // Detection: A line item is a proration if:
      // 1. line.proration === true (explicit proration flag), OR
      // 2. line.type === 'invoiceitem' (one-time items added for prorations), OR
      // 3. The line item's period ends at or before the current billing period end
      //    (meaning it's for the current partial period, not the next full cycle)
      let prorationTotal = 0;
      let nextCycleTotal = 0;
      const prorationLines: Array<{ description: string | null; amount: number }> = [];
      const nextCycleLines: Array<{ description: string | null; amount: number }> = [];

      for (const line of preview.lines.data) {
        const amountDollars = (line.amount || 0) / 100;

        // Check if this is a proration (mid-cycle charge/credit)
        const isProration =
          line.proration === true ||
          line.type === 'invoiceitem' ||
          (line.period?.end && line.period.end <= currentPeriodEnd);

        if (isProration) {
          prorationTotal += amountDollars;
          prorationLines.push({
            description: line.description,
            amount: amountDollars,
          });
        } else {
          nextCycleTotal += amountDollars;
          nextCycleLines.push({
            description: line.description,
            amount: amountDollars,
          });
        }
      }

      // The immediate charge is only the proration amount (if positive)
      // Negative proration means credit (downgrade) - no immediate charge
      const immediateCharge = Math.max(0, prorationTotal);

      res.json({
        immediateCharge,
        newMonthlyTotal,
        prorationDetails: {
          prorationTotal,
          nextCycleTotal,
          prorationLines,
          nextCycleLines,
          // Keep total invoice info for reference
          invoiceSubtotal: (preview.subtotal || 0) / 100,
          invoiceTotal: (preview.total || 0) / 100,
        },
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      stripeLogger.error({ err }, "Error previewing seat change");
      res.status(500).json({ message: "Failed to preview cost. Please try again." });
    }
  });

  // Sync subscription from Stripe (for after checkout when webhooks may be delayed)
  app.post('/api/billing/sync-subscription', isAuthenticated as any, loadCurrentUser as any, async (req: any, res) => {
    if (!requireStripe(res)) return;
    try {
      const userId = req.user?.id || req.currentUser?.id;
      const currentUser = await storage.getUser(userId);

      if (!currentUser || !currentUser.companyId) {
        return res.status(400).json({ message: "Must be part of a company" });
      }

      const company = await storage.getCompany(currentUser.companyId);
      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }

      // If we have a session_id from checkout, retrieve the session
      const { sessionId } = req.body;

      if (sessionId) {
        // Get session from Stripe
        const session = await stripe.checkout.sessions.retrieve(sessionId, {
          expand: ['subscription'],
        });

        if (session.payment_status === 'paid' && session.subscription) {
          const subscription = typeof session.subscription === 'string'
            ? await stripe.subscriptions.retrieve(session.subscription)
            : session.subscription;

          // Get price IDs to match items
          const managerPriceId = await storage.getStripeConfig("stripe_manager_price_id");
          const techPriceId = await storage.getStripeConfig("stripe_tech_price_id");

          let managerSeats = 0;
          let techSeats = 0;
          let stripeManagerItemId: string | undefined;
          let stripeTechItemId: string | undefined;

          for (const item of subscription.items.data) {
            const priceId = typeof item.price === 'string' ? item.price : item.price.id;
            if (priceId === managerPriceId) {
              managerSeats = item.quantity || 0;
              stripeManagerItemId = item.id;
            } else if (priceId === techPriceId) {
              techSeats = item.quantity || 0;
              stripeTechItemId = item.id;
            }
          }

          // Update company
          await storage.updateCompanyStripeInfo(currentUser.companyId, {
            stripeCustomerId: session.customer as string,
            stripeSubscriptionId: subscription.id,
            subscriptionStatus: subscription.status,
            stripeManagerItemId,
            stripeTechItemId,
          });

          await storage.updatePurchasedSeats(currentUser.companyId, managerSeats, techSeats, stripeManagerItemId, stripeTechItemId);
          await storage.setPaymentRestriction(currentUser.companyId, false);
          await storage.updateCompanyPackageSettings(currentUser.companyId, {
            isLive: true,
            packageType: "full_access",
          });
          // Mark onboarding as complete since they've paid
          await storage.completeOnboarding(currentUser.companyId);

          stripeLogger.info({
            companyId: currentUser.companyId,
            managerSeats,
            techSeats,
            subscriptionStatus: subscription.status,
          }, "Subscription synced from checkout session");

          return res.json({
            success: true,
            synced: true,
            managerSeats,
            techSeats,
            subscriptionStatus: subscription.status,
          });
        }
      }

      // Fallback: check if company has a subscription ID and sync from that
      if (company.stripeSubscriptionId) {
        const subscription = await stripe.subscriptions.retrieve(company.stripeSubscriptionId);

        const managerPriceId = await storage.getStripeConfig("stripe_manager_price_id");
        const techPriceId = await storage.getStripeConfig("stripe_tech_price_id");

        let managerSeats = 0;
        let techSeats = 0;
        let stripeManagerItemId: string | undefined;
        let stripeTechItemId: string | undefined;

        for (const item of subscription.items.data) {
          const priceId = typeof item.price === 'string' ? item.price : item.price.id;
          if (priceId === managerPriceId) {
            managerSeats = item.quantity || 0;
            stripeManagerItemId = item.id;
          } else if (priceId === techPriceId) {
            techSeats = item.quantity || 0;
            stripeTechItemId = item.id;
          }
        }

        await storage.updateCompanyStripeInfo(currentUser.companyId, {
          subscriptionStatus: subscription.status,
          stripeManagerItemId,
          stripeTechItemId,
        });

        await storage.updatePurchasedSeats(currentUser.companyId, managerSeats, techSeats, stripeManagerItemId, stripeTechItemId);

        if (subscription.status === 'active') {
          await storage.setPaymentRestriction(currentUser.companyId, false);
          await storage.updateCompanyPackageSettings(currentUser.companyId, {
            isLive: true,
          });
        }

        return res.json({
          success: true,
          synced: true,
          managerSeats,
          techSeats,
          subscriptionStatus: subscription.status,
        });
      }

      res.json({ success: true, synced: false, message: "No subscription to sync" });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      stripeLogger.error({ err }, "Error syncing subscription");
      res.status(500).json({ message: "Failed to sync subscription" });
    }
  });

  // Open Stripe billing portal (manage subscription, cancel, update payment)
  app.post('/api/billing/manage', isAuthenticated as any, loadCurrentUser as any, requireAdmin as any, async (req: any, res) => {
    if (!requireStripe(res)) return;
    try {
      const userId = req.user?.id || req.currentUser?.id;
      const currentUser = await storage.getUser(userId);

      if (!currentUser || !currentUser.companyId) {
        return res.status(400).json({ message: "Must be part of a company" });
      }

      const company = await storage.getCompany(currentUser.companyId);
      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }

      if (!company.stripeCustomerId) {
        return res.status(400).json({ message: "No billing account found. Please set up billing first." });
      }

      const canonicalDomain = process.env.CUSTOM_DOMAIN
        ? `https://${process.env.CUSTOM_DOMAIN}`
        : req.headers.origin;

      const portalSession = await stripe.billingPortal.sessions.create({
        customer: company.stripeCustomerId,
        return_url: `${canonicalDomain}/billing`,
      });

      res.json({ url: portalSession.url });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      stripeLogger.error({ err }, "Error creating billing portal session");
      res.status(500).json({ message: "Failed to open billing portal. Please try again." });
    }
  });

  // Retry payment (create new payment session for failed payments)
  app.post('/api/billing/retry-payment', isAuthenticated as any, loadCurrentUser as any, requireAdmin as any, async (req: any, res) => {
    if (!requireStripe(res)) return;
    try {
      const userId = req.user?.id || req.currentUser?.id;
      const currentUser = await storage.getUser(userId);

      if (!currentUser || !currentUser.companyId) {
        return res.status(400).json({ message: "Must be part of a company" });
      }

      const company = await storage.getCompany(currentUser.companyId);
      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }

      if (!company.stripeCustomerId) {
        return res.status(400).json({ message: "No billing account found" });
      }

      // Get the customer's portal URL for managing payment methods
      const canonicalDomain = process.env.CUSTOM_DOMAIN
        ? `https://${process.env.CUSTOM_DOMAIN}`
        : req.headers.origin;

      const portalSession = await stripe.billingPortal.sessions.create({
        customer: company.stripeCustomerId,
        return_url: `${canonicalDomain}/billing`,
      });

      res.json({ url: portalSession.url });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      stripeLogger.error({ err }, "Error creating payment retry session");
      res.status(500).json({ message: "Failed to create payment session. Please try again." });
    }
  });
}
