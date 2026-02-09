import { db } from "../../db";
import { eq, desc } from "drizzle-orm";
import * as schema from "@shared/schema";
import type {
  Integration,
  InsertIntegration,
  IntegrationLog,
  InsertIntegrationLog,
} from "@shared/schema";

export const integrationRepository = {
  // Integration operations
  async getIntegrationsByCompany(companyId: string): Promise<Integration[]> {
    return await db
      .select()
      .from(schema.integrations)
      .where(eq(schema.integrations.companyId, companyId))
      .orderBy(desc(schema.integrations.createdAt));
  },

  async getIntegration(id: string): Promise<Integration | undefined> {
    const [integration] = await db
      .select()
      .from(schema.integrations)
      .where(eq(schema.integrations.id, id));
    return integration;
  },

  async createIntegration(integrationData: InsertIntegration): Promise<Integration> {
    const [integration] = await db
      .insert(schema.integrations)
      .values(integrationData)
      .returning();
    return integration;
  },

  async updateIntegration(id: string, integrationData: Partial<InsertIntegration>): Promise<Integration | undefined> {
    const [integration] = await db
      .update(schema.integrations)
      .set({
        ...integrationData,
        updatedAt: new Date(),
      })
      .where(eq(schema.integrations.id, id))
      .returning();
    return integration;
  },

  async deleteIntegration(id: string): Promise<void> {
    await db
      .delete(schema.integrations)
      .where(eq(schema.integrations.id, id));
  },

  // Integration Log operations
  async getIntegrationLogs(integrationId: string): Promise<IntegrationLog[]> {
    return await db
      .select()
      .from(schema.integrationLogs)
      .where(eq(schema.integrationLogs.integrationId, integrationId))
      .orderBy(desc(schema.integrationLogs.createdAt))
      .limit(100);
  },

  async createIntegrationLog(logData: InsertIntegrationLog): Promise<IntegrationLog> {
    const [log] = await db
      .insert(schema.integrationLogs)
      .values(logData)
      .returning();
    return log;
  },

  async deleteIntegrationLogsByIntegration(integrationId: string): Promise<void> {
    await db
      .delete(schema.integrationLogs)
      .where(eq(schema.integrationLogs.integrationId, integrationId));
  },
};
