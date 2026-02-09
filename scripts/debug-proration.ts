/**
 * Debug proration preview
 * Run with: node --env-file=.env --import tsx scripts/debug-proration.ts
 */

import Stripe from "stripe";
import { db } from "../server/db";
import { companies } from "../shared/schema";
import { eq } from "drizzle-orm";
import { storage } from "../server/storage";

async function debug() {
  const stripeKey = process.env.TESTING_STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    console.error("No Stripe key");
    process.exit(1);
  }
  const stripe = new Stripe(stripeKey);

  const [company] = await db.select().from(companies).where(eq(companies.id, '30f8d96c-06b4-4d27-8cfa-4b77c87550c0'));

  console.log('=== COMPANY STATE ===');
  console.log('Subscription ID:', company.stripeSubscriptionId);
  console.log('Manager seats:', company.purchasedManagerSeats);
  console.log('Tech seats:', company.purchasedTechSeats);
  console.log('Manager Item ID:', company.stripeManagerItemId);
  console.log('Tech Item ID:', company.stripeTechItemId);

  if (!company.stripeSubscriptionId) {
    console.log('No subscription!');
    process.exit(0);
  }

  // Get subscription from Stripe
  const subscription = await stripe.subscriptions.retrieve(company.stripeSubscriptionId);
  console.log('\n=== STRIPE SUBSCRIPTION ===');
  console.log('Status:', subscription.status);
  console.log('Created:', new Date(subscription.created * 1000).toLocaleString());
  console.log('Current period start:', new Date((subscription.current_period_start || subscription.items.data[0]?.current_period_start || 0) * 1000).toLocaleString());
  console.log('Current period end:', new Date((subscription.current_period_end || subscription.items.data[0]?.current_period_end || 0) * 1000).toLocaleString());
  console.log('Items:');
  for (const item of subscription.items.data) {
    console.log('  -', item.id, ':', item.quantity, 'x', item.price.nickname || item.price.id);
  }

  // Get cached price IDs
  const managerPriceId = await storage.getStripeConfig("stripe_manager_price_id");
  const techPriceId = await storage.getStripeConfig("stripe_tech_price_id");

  console.log('\n=== PRICE IDS ===');
  console.log('Manager price:', managerPriceId);
  console.log('Tech price:', techPriceId);

  // Simulate adding 1 tech seat (0 -> 1)
  console.log('\n=== PREVIEW: Adding 1 Tech Seat ===');

  const subscriptionItems: Array<{ id?: string; price: string; quantity: number }> = [];

  // Keep manager seats the same
  if (company.stripeManagerItemId && managerPriceId) {
    subscriptionItems.push({
      id: company.stripeManagerItemId,
      price: managerPriceId,
      quantity: company.purchasedManagerSeats || 0
    });
  }

  // Add tech seat (new item since 0 -> 1)
  if (company.stripeTechItemId && techPriceId) {
    subscriptionItems.push({
      id: company.stripeTechItemId,
      price: techPriceId,
      quantity: 1
    });
  } else if (techPriceId) {
    subscriptionItems.push({
      price: techPriceId,
      quantity: 1
    });
  }

  console.log('Preview items:', JSON.stringify(subscriptionItems, null, 2));

  const preview = await stripe.invoices.createPreview({
    customer: company.stripeCustomerId!,
    subscription: company.stripeSubscriptionId,
    subscription_details: {
      items: subscriptionItems,
      proration_behavior: 'create_prorations',
    },
  });

  console.log('\n=== INVOICE PREVIEW ===');
  console.log('Amount due:', preview.amount_due / 100);
  console.log('Subtotal:', preview.subtotal / 100);
  console.log('Total:', preview.total / 100);
  console.log('\nLine items:');
  for (const line of preview.lines.data) {
    console.log('  -', line.description);
    console.log('    Amount:', line.amount / 100);
    console.log('    Proration:', line.proration);
    console.log('    Period:', new Date(line.period.start * 1000).toLocaleDateString(), '-', new Date(line.period.end * 1000).toLocaleDateString());
  }

  // Calculate what our code returns
  let prorationTotal = 0;
  let nextCycleTotal = 0;
  for (const line of preview.lines.data) {
    if (line.proration) {
      prorationTotal += line.amount / 100;
    } else {
      nextCycleTotal += line.amount / 100;
    }
  }
  console.log('\n=== OUR CALCULATION ===');
  console.log('Proration total:', prorationTotal);
  console.log('Next cycle total:', nextCycleTotal);
  console.log('Immediate charge (max 0):', Math.max(0, prorationTotal));

  process.exit(0);
}

debug().catch(e => { console.error(e); process.exit(1); });
