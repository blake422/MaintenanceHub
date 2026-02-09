/**
 * Sync Stripe subscription seat data to database
 * Run with: node --env-file=.env --import tsx scripts/sync-stripe-seats.ts
 */

import { db } from "../server/db";
import { companies } from "../shared/schema";
import { eq } from "drizzle-orm";
import Stripe from "stripe";

async function main() {
  const stripeKey = process.env.TESTING_STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    console.error('No Stripe key found. Set STRIPE_SECRET_KEY or TESTING_STRIPE_SECRET_KEY');
    process.exit(1);
  }
  const stripe = new Stripe(stripeKey);

  // Get company with subscription
  const [company] = await db.select().from(companies).where(eq(companies.id, '30f8d96c-06b4-4d27-8cfa-4b77c87550c0'));

  console.log('Company:', company.name);
  console.log('Stripe Subscription ID:', company.stripeSubscriptionId);

  if (!company.stripeSubscriptionId) {
    console.log('No subscription ID found');
    process.exit(1);
  }

  // Get subscription from Stripe
  const subscription = await stripe.subscriptions.retrieve(company.stripeSubscriptionId);
  console.log('\nSubscription Status:', subscription.status);
  console.log('Items:');

  let managerSeats = 0;
  let techSeats = 0;
  let stripeManagerItemId: string | null = null;
  let stripeTechItemId: string | null = null;

  for (const item of subscription.items.data) {
    const price = await stripe.prices.retrieve(item.price.id);
    const nickname = price.nickname?.toLowerCase() || '';
    console.log('  -', price.nickname, ':', item.quantity, 'seats (item:', item.id, ')');

    if (nickname.includes('manager') || nickname.includes('admin')) {
      managerSeats = item.quantity || 0;
      stripeManagerItemId = item.id;
    } else if (nickname.includes('tech')) {
      techSeats = item.quantity || 0;
      stripeTechItemId = item.id;
    }
  }

  console.log('\nSyncing to database:');
  console.log('  Manager seats:', managerSeats);
  console.log('  Tech seats:', techSeats);

  await db.update(companies)
    .set({
      purchasedManagerSeats: managerSeats,
      purchasedTechSeats: techSeats,
      stripeManagerItemId: stripeManagerItemId,
      stripeTechItemId: stripeTechItemId,
      subscriptionStatus: subscription.status,
    })
    .where(eq(companies.id, company.id));

  console.log('\nSync complete!');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
