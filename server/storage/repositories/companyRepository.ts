import { db } from "../../db";
import { eq, desc, inArray } from "drizzle-orm";
import * as schema from "@shared/schema";
import type { Company, InsertCompany } from "@shared/schema";

export const companyRepository = {
  async getAllCompanies(): Promise<Company[]> {
    return await db.select().from(schema.companies).orderBy(desc(schema.companies.createdAt));
  },

  async getCompany(id: string): Promise<Company | undefined> {
    const [company] = await db.select().from(schema.companies).where(eq(schema.companies.id, id));
    return company;
  },

  async createCompany(companyData: InsertCompany): Promise<Company> {
    const [company] = await db.insert(schema.companies).values(companyData).returning();
    return company;
  },

  async updateCompany(id: string, companyData: Partial<InsertCompany>): Promise<Company | undefined> {
    const [company] = await db
      .update(schema.companies)
      .set({ ...companyData, updatedAt: new Date() })
      .where(eq(schema.companies.id, id))
      .returning();
    return company;
  },

  async deleteCompany(id: string): Promise<void> {
    // Delete all related records in the correct order to avoid FK constraint violations
    // Start with the most dependent tables and work backwards

    // Get all users for this company first (needed for cascading)
    const companyUsers = await db.select().from(schema.users).where(eq(schema.users.companyId, id));
    const userIds = companyUsers.map(u => u.id);

    // Delete user-related records for ALL users in the company
    if (userIds.length > 0) {
      await db.delete(schema.schematicProgress).where(inArray(schema.schematicProgress.userId, userIds));
      await db.delete(schema.trainingProgress).where(inArray(schema.trainingProgress.userId, userIds));
      await db.delete(schema.userBadges).where(inArray(schema.userBadges.userId, userIds));
      await db.delete(schema.certifications).where(inArray(schema.certifications.userId, userIds));
    }

    // Delete company-related records
    await db.delete(schema.troubleshootingSessions).where(eq(schema.troubleshootingSessions.companyId, id));
    await db.delete(schema.rcaRecords).where(eq(schema.rcaRecords.companyId, id));
    await db.delete(schema.downtimeReports).where(eq(schema.downtimeReports.companyId, id));
    await db.delete(schema.downtimeRecords).where(eq(schema.downtimeRecords.companyId, id));
    await db.delete(schema.pmSchedules).where(eq(schema.pmSchedules.companyId, id));
    await db.delete(schema.workOrders).where(eq(schema.workOrders.companyId, id));
    await db.delete(schema.parts).where(eq(schema.parts.companyId, id));
    await db.delete(schema.equipment).where(eq(schema.equipment.companyId, id));
    await db.delete(schema.trainingModules).where(eq(schema.trainingModules.companyId, id));
    await db.delete(schema.schematics).where(eq(schema.schematics.companyId, id));
    await db.delete(schema.users).where(eq(schema.users.companyId, id));

    // Finally delete the company itself
    await db.delete(schema.companies).where(eq(schema.companies.id, id));
  },

  async completeOnboarding(companyId: string): Promise<void> {
    await db
      .update(schema.companies)
      .set({ onboardingCompleted: true })
      .where(eq(schema.companies.id, companyId));
  },

  async updateCompanyStripeInfo(companyId: string, stripeInfo: {
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    subscriptionStatus?: string;
    stripeManagerItemId?: string;
    stripeTechItemId?: string;
  }): Promise<void> {
    await db
      .update(schema.companies)
      .set({ ...stripeInfo, updatedAt: new Date() })
      .where(eq(schema.companies.id, companyId));
  },

  async updateCompanyLicenses(companyId: string, licenses: { purchasedManagerSeats: number; purchasedTechSeats: number }): Promise<void> {
    await db
      .update(schema.companies)
      .set({ 
        purchasedManagerSeats: licenses.purchasedManagerSeats, 
        purchasedTechSeats: licenses.purchasedTechSeats, 
        updatedAt: new Date() 
      })
      .where(eq(schema.companies.id, companyId));
  },

  async updateCompanyPackageSettings(companyId: string, settings: { packageType?: "full_access" | "operations" | "troubleshooting" | "demo"; isLive?: boolean; demoExpiresAt?: Date | null; enabledModules?: string[]; purchasedManagerSeats?: number; purchasedTechSeats?: number }): Promise<void> {
    await db
      .update(schema.companies)
      .set({ ...settings, updatedAt: new Date() })
      .where(eq(schema.companies.id, companyId));
  },

  async getCompanySeatCounts(companyId: string): Promise<{ techSeats: number; managerSeats: number; totalSeats: number }> {
    const users = await db.select().from(schema.users).where(eq(schema.users.companyId, companyId)).orderBy(desc(schema.users.createdAt));

    const techSeats = users.filter(u => u.role === 'tech').length;
    const managerSeats = users.filter(u => u.role === 'admin' || u.role === 'manager').length;
    const totalSeats = techSeats + managerSeats;

    return { techSeats, managerSeats, totalSeats };
  },

  async getCompanyByStripeCustomerId(stripeCustomerId: string): Promise<Company | undefined> {
    const [company] = await db
      .select()
      .from(schema.companies)
      .where(eq(schema.companies.stripeCustomerId, stripeCustomerId));
    return company;
  },

  async updateCompanyOnboardingStage(
    companyId: string,
    stage: "not_started" | "company_created" | "plan_selected" | "payment_complete" | "completed"
  ): Promise<void> {
    await db
      .update(schema.companies)
      .set({ onboardingStage: stage, updatedAt: new Date() })
      .where(eq(schema.companies.id, companyId));
  },

  // Seat-based billing methods
  async updatePurchasedSeats(
    companyId: string,
    managerSeats: number,
    techSeats: number,
    stripeManagerItemId?: string,
    stripeTechItemId?: string
  ): Promise<void> {
    const updateData: Record<string, any> = {
      purchasedManagerSeats: managerSeats,
      purchasedTechSeats: techSeats,
      updatedAt: new Date(),
    };
    if (stripeManagerItemId) updateData.stripeManagerItemId = stripeManagerItemId;
    if (stripeTechItemId) updateData.stripeTechItemId = stripeTechItemId;

    await db
      .update(schema.companies)
      .set(updateData)
      .where(eq(schema.companies.id, companyId));
  },

  async getSeatBreakdown(companyId: string): Promise<{
    purchased: { manager: number; tech: number };
    used: { manager: number; tech: number };
    pending: { manager: number; tech: number };
    available: { manager: number; tech: number };
  }> {
    const company = await db.select().from(schema.companies).where(eq(schema.companies.id, companyId));
    if (!company[0]) {
      return {
        purchased: { manager: 0, tech: 0 },
        used: { manager: 0, tech: 0 },
        pending: { manager: 0, tech: 0 },
        available: { manager: 0, tech: 0 },
      };
    }

    // Get all users in the company (all users with companyId set are considered "active")
    const users = await db.select().from(schema.users).where(eq(schema.users.companyId, companyId));

    // Count users by role - all users with a companyId are considered active/used seats
    const usedManager = users.filter(u => u.role === 'admin' || u.role === 'manager').length;
    const usedTech = users.filter(u => u.role === 'tech').length;

    // Get pending invitations
    const invitations = await db.select().from(schema.invitations).where(eq(schema.invitations.companyId, companyId));
    const pendingInvitations = invitations.filter(i => i.status === 'pending');

    const pendingManager = pendingInvitations.filter(i => i.role === 'admin' || i.role === 'manager').length;
    const pendingTech = pendingInvitations.filter(i => i.role === 'tech').length;

    // Use role-specific seats for all companies (demo and paid)
    const purchasedManager = company[0].purchasedManagerSeats || 0;
    const purchasedTech = company[0].purchasedTechSeats || 0;

    return {
      purchased: { manager: purchasedManager, tech: purchasedTech },
      used: { manager: usedManager, tech: usedTech },
      pending: { manager: pendingManager, tech: pendingTech },
      available: {
        manager: Math.max(0, purchasedManager - usedManager - pendingManager),
        tech: Math.max(0, purchasedTech - usedTech - pendingTech),
      },
    };
  },

  async setPaymentRestriction(companyId: string, restricted: boolean): Promise<void> {
    await db
      .update(schema.companies)
      .set({ paymentRestricted: restricted, updatedAt: new Date() })
      .where(eq(schema.companies.id, companyId));
  },

  // Stripe config cache methods
  async getStripeConfig(key: string): Promise<string | undefined> {
    const [config] = await db
      .select()
      .from(schema.stripeConfig)
      .where(eq(schema.stripeConfig.key, key));
    return config?.value;
  },

  async setStripeConfig(key: string, value: string): Promise<void> {
    // Upsert - insert or update if exists
    await db
      .insert(schema.stripeConfig)
      .values({ key, value })
      .onConflictDoUpdate({
        target: schema.stripeConfig.key,
        set: { value, updatedAt: new Date() },
      });
  },
};
