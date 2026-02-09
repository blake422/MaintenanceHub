import type { Express, Request, Response } from "express";
import { stripe } from "./index";
import { storage } from "../storage";
import { stripeLogger } from "../logger";
import Stripe from "stripe";

/**
 * Stripe Webhook Handler
 *
 * Handles payment events from Stripe to verify and activate subscriptions.
 * This is critical for payment security - companies should not get access
 * until payment is confirmed via webhook.
 *
 * Events handled:
 * - checkout.session.completed: Initial payment from checkout flow
 * - invoice.paid: Successful recurring payments
 * - customer.subscription.updated: Subscription status changes
 * - customer.subscription.deleted: Subscription cancellations
 */

export function registerStripeWebhookRoutes(app: Express): void {
  app.post("/api/webhooks/stripe", async (req: Request, res: Response) => {
    const sig = req.headers["stripe-signature"];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      stripeLogger.error({}, "STRIPE_WEBHOOK_SECRET not configured");
      return res.status(500).json({ message: "Webhook not configured" });
    }

    if (!sig) {
      stripeLogger.warn({}, "Missing stripe-signature header");
      return res.status(400).json({ message: "Missing signature" });
    }

    let event: Stripe.Event;

    try {
      // Use rawBody for signature verification
      const rawBody = (req as any).rawBody;
      if (!rawBody) {
        stripeLogger.error({}, "Raw body not available for webhook verification");
        return res.status(400).json({ message: "Raw body not available" });
      }

      event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
      stripeLogger.info({ eventType: event.type, eventId: event.id }, "Stripe webhook received");
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      stripeLogger.error({ err: error }, "Webhook signature verification failed");
      return res.status(400).json({ message: `Webhook Error: ${error.message}` });
    }

    try {
      switch (event.type) {
        case "checkout.session.completed": {
          await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
          break;
        }

        case "invoice.paid": {
          await handleInvoicePaid(event.data.object as Stripe.Invoice);
          break;
        }

        case "customer.subscription.updated": {
          await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
          break;
        }

        case "customer.subscription.deleted": {
          await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
          break;
        }

        case "invoice.payment_failed": {
          await handlePaymentFailed(event.data.object as Stripe.Invoice);
          break;
        }

        default:
          stripeLogger.debug({ eventType: event.type }, "Unhandled event type");
      }

      res.json({ received: true });
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      stripeLogger.error({ err: error, eventType: event.type }, "Error processing webhook event");
      // Return 200 to prevent Stripe from retrying - we've logged the error
      // In production, you might want to queue for retry instead
      res.json({ received: true, error: error.message });
    }
  });
}

/**
 * Handle checkout.session.completed event
 * This fires when a customer completes the Stripe Checkout flow
 */
async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const companyId = session.metadata?.companyId;
  const userId = session.metadata?.userId;

  stripeLogger.info({ companyId, userId, sessionId: session.id }, "Processing checkout.session.completed");

  if (!companyId) {
    stripeLogger.error({ sessionId: session.id }, "No companyId in session metadata");
    return;
  }

  const company = await storage.getCompany(companyId);
  if (!company) {
    stripeLogger.error({ companyId }, "Company not found for checkout session");
    return;
  }

  // Get subscription details
  const subscriptionId = session.subscription as string;
  const customerId = session.customer as string;

  if (!subscriptionId) {
    stripeLogger.error({ sessionId: session.id }, "No subscription in checkout session");
    return;
  }

  // Retrieve full subscription to get status and item details
  const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ['items.data.price'],
  });

  // Extract seat quantities and item IDs from subscription
  let managerSeats = 0;
  let techSeats = 0;
  let stripeManagerItemId: string | undefined;
  let stripeTechItemId: string | undefined;

  // Get cached price IDs to match items
  const managerPriceId = await storage.getStripeConfig("stripe_manager_price_id");
  const techPriceId = await storage.getStripeConfig("stripe_tech_price_id");

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

  // Update company with payment confirmation and item IDs
  await storage.updateCompanyStripeInfo(companyId, {
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscriptionId,
    subscriptionStatus: subscription.status,
    stripeManagerItemId,
    stripeTechItemId,
  });

  // Store purchased seat counts
  await storage.updatePurchasedSeats(companyId, managerSeats, techSeats, stripeManagerItemId, stripeTechItemId);

  // Clear any payment restriction
  await storage.setPaymentRestriction(companyId, false);

  // Mark as live and payment complete
  await storage.updateCompanyPackageSettings(companyId, {
    isLive: true,
    packageType: "full_access",
  });

  // Update onboarding stage to payment_complete
  await storage.updateCompanyOnboardingStage(companyId, "payment_complete");

  stripeLogger.info(
    { companyId, subscriptionId, status: subscription.status, managerSeats, techSeats },
    "Company activated after checkout completion"
  );
}

/**
 * Handle invoice.paid event
 * This fires for successful recurring payments
 */
async function handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
  const customerId = invoice.customer as string;
  const subscriptionId = invoice.subscription as string;

  stripeLogger.info({ customerId, subscriptionId, invoiceId: invoice.id }, "Processing invoice.paid");

  if (!subscriptionId) {
    stripeLogger.debug({ invoiceId: invoice.id }, "Invoice not associated with subscription");
    return;
  }

  // Find company by Stripe customer ID
  const company = await storage.getCompanyByStripeCustomerId(customerId);
  if (!company) {
    stripeLogger.warn({ customerId }, "No company found for Stripe customer");
    return;
  }

  // Update subscription status to active (in case it was past_due)
  await storage.updateCompanyStripeInfo(company.id, {
    subscriptionStatus: "active",
  });

  // Clear payment restriction since payment succeeded
  await storage.setPaymentRestriction(company.id, false);

  stripeLogger.info({ companyId: company.id }, "Subscription renewed successfully, payment restriction cleared");
}

/**
 * Handle customer.subscription.updated event
 * This fires when subscription status changes (e.g., active → past_due)
 */
async function handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
  const customerId = subscription.customer as string;

  stripeLogger.info(
    { customerId, subscriptionId: subscription.id, status: subscription.status },
    "Processing subscription.updated"
  );

  const company = await storage.getCompanyByStripeCustomerId(customerId);
  if (!company) {
    stripeLogger.warn({ customerId }, "No company found for subscription update");
    return;
  }

  // Sync seat counts from subscription items
  let managerSeats = 0;
  let techSeats = 0;
  let stripeManagerItemId: string | undefined;
  let stripeTechItemId: string | undefined;

  const managerPriceId = await storage.getStripeConfig("stripe_manager_price_id");
  const techPriceId = await storage.getStripeConfig("stripe_tech_price_id");

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

  // Update subscription status and item IDs
  await storage.updateCompanyStripeInfo(company.id, {
    subscriptionStatus: subscription.status,
    stripeManagerItemId,
    stripeTechItemId,
  });

  // Sync purchased seat counts
  await storage.updatePurchasedSeats(company.id, managerSeats, techSeats, stripeManagerItemId, stripeTechItemId);

  // If subscription goes to active, clear payment restriction and mark company as live
  if (subscription.status === "active") {
    await storage.setPaymentRestriction(company.id, false);
    if (!company.isLive) {
      await storage.updateCompanyPackageSettings(company.id, {
        isLive: true,
      });
      stripeLogger.info({ companyId: company.id }, "Company marked as live after subscription became active");
    }
  }

  // If subscription is past_due or unpaid, we might want to restrict access
  if (subscription.status === "past_due" || subscription.status === "unpaid") {
    stripeLogger.warn({ companyId: company.id, status: subscription.status }, "Subscription payment issue");
    // Note: Not automatically blocking access - allow grace period
    // Could add logic here to send notification emails
  }

  stripeLogger.info({ companyId: company.id, status: subscription.status, managerSeats, techSeats }, "Subscription status updated");
}

/**
 * Handle customer.subscription.deleted event
 * This fires when a subscription is cancelled
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
  const customerId = subscription.customer as string;

  stripeLogger.info({ customerId, subscriptionId: subscription.id }, "Processing subscription.deleted");

  const company = await storage.getCompanyByStripeCustomerId(customerId);
  if (!company) {
    stripeLogger.warn({ customerId }, "No company found for subscription deletion");
    return;
  }

  // Clear subscription info and mark as not live
  await storage.updateCompanyStripeInfo(company.id, {
    stripeSubscriptionId: undefined,
    subscriptionStatus: "canceled",
    stripeManagerItemId: undefined,
    stripeTechItemId: undefined,
  });

  // Clear purchased seats
  await storage.updatePurchasedSeats(company.id, 0, 0);

  // Restrict access
  await storage.setPaymentRestriction(company.id, true);

  await storage.updateCompanyPackageSettings(company.id, {
    isLive: false,
    packageType: "demo",
  });

  stripeLogger.info({ companyId: company.id }, "Subscription cancelled, company reverted to demo and seats cleared");
}

/**
 * Handle invoice.payment_failed event
 * This fires when a payment attempt fails
 */
async function handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  const customerId = invoice.customer as string;

  stripeLogger.warn({ customerId, invoiceId: invoice.id }, "Processing invoice.payment_failed");

  const company = await storage.getCompanyByStripeCustomerId(customerId);
  if (!company) {
    stripeLogger.warn({ customerId }, "No company found for failed payment");
    return;
  }

  // Update status to reflect payment failure
  await storage.updateCompanyStripeInfo(company.id, {
    subscriptionStatus: "past_due",
  });

  // IMMEDIATELY restrict access when payment fails
  await storage.setPaymentRestriction(company.id, true);

  stripeLogger.warn(
    { companyId: company.id, invoiceId: invoice.id },
    "Payment failed for company - marked as past_due and access restricted"
  );

  // TODO: Send notification email to company admin about failed payment
}
