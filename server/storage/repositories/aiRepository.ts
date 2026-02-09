import { db } from "../../db";
import { eq, desc } from "drizzle-orm";
import * as schema from "@shared/schema";
import type { AIRecommendation, InsertAIRecommendation } from "@shared/schema";

export const aiRepository = {
  async getAIRecommendationsByCompany(companyId: string): Promise<AIRecommendation[]> {
    return await db.select().from(schema.aiRecommendations)
      .where(eq(schema.aiRecommendations.companyId, companyId))
      .orderBy(desc(schema.aiRecommendations.createdAt));
  },

  async getAIRecommendation(id: string): Promise<AIRecommendation | undefined> {
    const [recommendation] = await db.select().from(schema.aiRecommendations)
      .where(eq(schema.aiRecommendations.id, id));
    return recommendation;
  },

  async createAIRecommendation(recommendationData: InsertAIRecommendation): Promise<AIRecommendation> {
    const [recommendation] = await db
      .insert(schema.aiRecommendations)
      .values(recommendationData)
      .returning();
    return recommendation;
  },

  async updateAIRecommendation(id: string, recommendationData: Partial<InsertAIRecommendation>): Promise<AIRecommendation | undefined> {
    const [recommendation] = await db
      .update(schema.aiRecommendations)
      .set({
        ...recommendationData,
        updatedAt: new Date(),
      })
      .where(eq(schema.aiRecommendations.id, id))
      .returning();
    return recommendation;
  },

  async approveAIRecommendation(id: string, userId: string): Promise<AIRecommendation | undefined> {
    const [recommendation] = await db
      .update(schema.aiRecommendations)
      .set({
        status: "approved",
        approvedById: userId,
        approvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.aiRecommendations.id, id))
      .returning();
    return recommendation;
  },

  async rejectAIRecommendation(id: string, userId: string, reason: string): Promise<AIRecommendation | undefined> {
    const [recommendation] = await db
      .update(schema.aiRecommendations)
      .set({
        status: "rejected",
        rejectedById: userId,
        rejectedAt: new Date(),
        rejectionReason: reason,
        updatedAt: new Date(),
      })
      .where(eq(schema.aiRecommendations.id, id))
      .returning();
    return recommendation;
  },
};
