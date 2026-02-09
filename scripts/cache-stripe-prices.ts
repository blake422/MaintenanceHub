/**
 * Cache Stripe product and price IDs for billing
 * Run with: node --env-file=.env --import tsx scripts/cache-stripe-prices.ts
 */

import Stripe from "stripe";
import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function main() {
  const stripeKey = process.env.TESTING_STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    console.error('No Stripe key found');
    process.exit(1);
  }

  const stripe = new Stripe(stripeKey);

  // Get the product
  const products = await stripe.products.list({ limit: 10 });
  const product = products.data.find(p => p.name === 'MaintenanceHub');

  if (!product) {
    console.log('No MaintenanceHub product found');
    process.exit(1);
  }

  console.log('Product:', product.id);

  // Get prices for this product
  const prices = await stripe.prices.list({ product: product.id, limit: 10 });

  let managerPriceId: string | undefined;
  let techPriceId: string | undefined;

  for (const price of prices.data) {
    console.log('Price:', price.id, '-', price.nickname);
    if (price.nickname?.toLowerCase().includes('manager')) {
      managerPriceId = price.id;
    } else if (price.nickname?.toLowerCase().includes('tech')) {
      techPriceId = price.id;
    }
  }

  console.log('\nCaching to database...');

  // Insert/update configs
  const configs: Array<[string, string | undefined]> = [
    ['stripe_product_id', product.id],
    ['stripe_manager_price_id', managerPriceId],
    ['stripe_tech_price_id', techPriceId],
  ];

  for (const [key, value] of configs) {
    if (!value) continue;
    await db.execute(sql`
      INSERT INTO stripe_config (key, value) VALUES (${key}, ${value})
      ON CONFLICT (key) DO UPDATE SET value = ${value}, updated_at = NOW()
    `);
    console.log('  Cached:', key, '=', value);
  }

  console.log('\nDone!');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
