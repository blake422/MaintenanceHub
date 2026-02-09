/**
 * Check user account state
 * Run with: node --env-file=.env --import tsx scripts/check-user.ts
 */

import { db } from "../server/db";
import { users, companies } from "../shared/schema";
import { eq } from "drizzle-orm";

async function main() {
  const email = "alimdarmenov@gmail.com";

  console.log(`\nChecking account: ${email}\n`);
  console.log("=".repeat(60));

  // Get user
  const [user] = await db.select().from(users).where(eq(users.email, email));

  if (!user) {
    console.log("USER NOT FOUND!");
    process.exit(1);
  }

  console.log("\n📧 USER:");
  console.log({
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    platformRole: user.platformRole,
    companyId: user.companyId,
    hasPassword: !!user.passwordHash,
  });

  // Get company if exists
  if (user.companyId) {
    const [company] = await db.select().from(companies).where(eq(companies.id, user.companyId));

    if (company) {
      console.log("\n🏢 COMPANY:");
      console.log({
        id: company.id,
        name: company.name,
        packageType: company.packageType,
        isLive: company.isLive,
        onboardingCompleted: company.onboardingCompleted,
        onboardingStage: company.onboardingStage,
        subscriptionStatus: company.subscriptionStatus,
        stripeSubscriptionId: company.stripeSubscriptionId ? "EXISTS" : null,
        stripeCustomerId: company.stripeCustomerId ? "EXISTS" : null,
        purchasedManagerSeats: company.purchasedManagerSeats,
        purchasedTechSeats: company.purchasedTechSeats,
        paymentRestricted: company.paymentRestricted,
        demoExpiresAt: company.demoExpiresAt,
      });

      // Check routing logic
      console.log("\n🔀 ROUTING ANALYSIS:");
      const needsOnboarding = !user.companyId || !company.onboardingCompleted;
      console.log(`  user.companyId: ${user.companyId ? "SET" : "NULL"}`);
      console.log(`  company.onboardingCompleted: ${company.onboardingCompleted}`);
      console.log(`  needsOnboarding = ${needsOnboarding}`);
      console.log(`  → User should route to: ${needsOnboarding ? "/onboarding" : "/"}`);
    } else {
      console.log("\n❌ Company ID set but company not found!");
    }
  } else {
    console.log("\n⚠️ No company assigned to user");
    console.log("→ User should route to: /onboarding");
  }

  console.log("\n" + "=".repeat(60));
  process.exit(0);
}

main().catch(console.error);
