import { db } from "../../db";
import { eq, desc } from "drizzle-orm";
import * as schema from "@shared/schema";
import type { TroubleshootingSession, InsertTroubleshootingSession } from "@shared/schema";

export const troubleshootingRepository = {
  async getTroubleshootingSessionsByCompany(companyId: string): Promise<TroubleshootingSession[]> {
    return await db.select().from(schema.troubleshootingSessions)
      .where(eq(schema.troubleshootingSessions.companyId, companyId))
      .orderBy(desc(schema.troubleshootingSessions.createdAt));
  },

  async getTroubleshootingSession(id: string): Promise<TroubleshootingSession | undefined> {
    const [session] = await db.select().from(schema.troubleshootingSessions)
      .where(eq(schema.troubleshootingSessions.id, id));
    return session;
  },

  async createTroubleshootingSession(sessionData: InsertTroubleshootingSession): Promise<TroubleshootingSession> {
    const [session] = await db.insert(schema.troubleshootingSessions).values(sessionData).returning();
    return session;
  },

  async updateTroubleshootingSession(id: string, sessionData: Partial<InsertTroubleshootingSession>): Promise<TroubleshootingSession | undefined> {
    const [session] = await db
      .update(schema.troubleshootingSessions)
      .set({ ...sessionData, updatedAt: new Date() })
      .where(eq(schema.troubleshootingSessions.id, id))
      .returning();
    return session;
  },
};
