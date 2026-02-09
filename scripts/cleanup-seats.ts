/**
 * Cleanup script: Reset purchased seats for companies without active subscriptions
 *
 * This fixes data where seats were saved to the database before the fix that
 * prevents saving seats without an active subscription.
 *
 * Run with: npx tsx scripts/cleanup-seats.ts
 */

import { db } from "../server/db";
import { companies } from "../shared/schema";
import { sql, isNull, or, notInArray } from "drizzle-orm";

async function main() {
  console.log("Starting seat cleanup...\n");

  // Find companies with seats but no active subscription
  const affectedCompanies = await db
    .select({
      id: companies.id,
      name: companies.name,
      purchasedManagerSeats: companies.purchasedManagerSeats,
      purchasedTechSeats: companies.purchasedTechSeats,
      stripeSubscriptionId: companies.stripeSubscriptionId,
      subscriptionStatus: companies.subscriptionStatus,
    })
    .from(companies)
    .where(
      sql`(${companies.purchasedManagerSeats} > 0 OR ${companies.purchasedTechSeats} > 0)
          AND (${companies.stripeSubscriptionId} IS NULL
               OR ${companies.subscriptionStatus} NOT IN ('active', 'trialing'))`
    );

  if (affectedCompanies.length === 0) {
    console.log("No companies found with seats but no active subscription. Nothing to clean up.");
    process.exit(0);
  }

  console.log(`Found ${affectedCompanies.length} company(ies) with seats but no active subscription:\n`);

  for (const company of affectedCompanies) {
    console.log(`- ${company.name} (ID: ${company.id})`);
    console.log(`  Manager seats: ${company.purchasedManagerSeats}, Tech seats: ${company.purchasedTechSeats}`);
    console.log(`  Subscription: ${company.stripeSubscriptionId || 'none'}, Status: ${company.subscriptionStatus || 'none'}`);
    console.log();
  }

  // Reset the seats
  console.log("Resetting seats to 0...\n");

  const result = await db
    .update(companies)
    .set({
      purchasedManagerSeats: 0,
      purchasedTechSeats: 0,
      updatedAt: new Date(),
    })
    .where(
      sql`(${companies.purchasedManagerSeats} > 0 OR ${companies.purchasedTechSeats} > 0)
          AND (${companies.stripeSubscriptionId} IS NULL
               OR ${companies.subscriptionStatus} NOT IN ('active', 'trialing'))`
    )
    .returning({ id: companies.id, name: companies.name });

  console.log(`Successfully reset seats for ${result.length} company(ies):`);
  for (const company of result) {
    console.log(`- ${company.name}`);
  }

  console.log("\nCleanup complete!");
  process.exit(0);
}

main().catch((error) => {
  console.error("Error during cleanup:", error);
  process.exit(1);
});
