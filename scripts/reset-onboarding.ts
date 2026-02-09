/**
 * Fully reset user onboarding state for testing
 * This removes the user's company association so they can go through onboarding from scratch
 */
import { db } from "../server/db";
import { users, companies } from "../shared/schema";
import { eq } from "drizzle-orm";

async function main() {
  const email = process.argv[2] || "ulika2404@gmail.com";

  console.log(`\nFully resetting onboarding for: ${email}\n`);

  // Get user
  const [user] = await db.select().from(users).where(eq(users.email, email));

  if (!user) {
    console.log("USER NOT FOUND!");
    process.exit(1);
  }

  console.log("Found user:", user.id, user.email);
  console.log("Current companyId:", user.companyId);

  if (!user.companyId) {
    console.log("User has no company - already ready for onboarding");
    process.exit(0);
  }

  // Remove user's company association
  await db.update(users)
    .set({ companyId: null })
    .where(eq(users.id, user.id));

  console.log("\n✅ Removed company association from user");
  console.log("User can now go through full onboarding flow from scratch");

  process.exit(0);
}

main().catch(console.error);
