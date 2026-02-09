import { db } from "../../db";
import { eq, desc } from "drizzle-orm";
import * as schema from "@shared/schema";
import type {
  TrainingModule,
  InsertTrainingModule,
  TrainingProgress,
  InsertTrainingProgress,
  Badge,
  UserBadge,
  InsertUserBadge,
  Certification,
  InsertCertification,
} from "@shared/schema";

export const trainingRepository = {
  // Training Module operations
  async getTrainingModulesByCompany(companyId: string): Promise<TrainingModule[]> {
    return await db.select().from(schema.trainingModules)
      .where(eq(schema.trainingModules.companyId, companyId))
      .orderBy(desc(schema.trainingModules.createdAt));
  },

  async getTrainingModule(id: string): Promise<TrainingModule | undefined> {
    const [module] = await db.select().from(schema.trainingModules)
      .where(eq(schema.trainingModules.id, id));
    return module;
  },

  async createTrainingModule(moduleData: InsertTrainingModule): Promise<TrainingModule> {
    const [module] = await db.insert(schema.trainingModules).values(moduleData).returning();
    return module;
  },

  async updateTrainingModule(id: string, updates: Partial<InsertTrainingModule>): Promise<TrainingModule | undefined> {
    const [module] = await db.update(schema.trainingModules)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.trainingModules.id, id))
      .returning();
    return module;
  },

  // Training Progress operations
  async getTrainingProgressByUser(userId: string): Promise<TrainingProgress[]> {
    return await db.select().from(schema.trainingProgress)
      .where(eq(schema.trainingProgress.userId, userId));
  },

  async createOrUpdateTrainingProgress(progressData: InsertTrainingProgress): Promise<TrainingProgress> {
    const [progress] = await db
      .insert(schema.trainingProgress)
      .values(progressData)
      .onConflictDoUpdate({
        target: [schema.trainingProgress.userId, schema.trainingProgress.moduleId],
        set: {
          ...progressData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return progress;
  },

  // Badge operations
  async getAllBadges(): Promise<Badge[]> {
    return await db.select().from(schema.badges);
  },

  async getUserBadges(userId: string): Promise<UserBadge[]> {
    return await db.select().from(schema.userBadges)
      .where(eq(schema.userBadges.userId, userId));
  },

  async awardBadge(userBadgeData: InsertUserBadge): Promise<UserBadge> {
    const [userBadge] = await db.insert(schema.userBadges).values(userBadgeData).returning();
    return userBadge;
  },

  // Certification operations
  async getUserCertifications(userId: string): Promise<Certification[]> {
    return await db.select().from(schema.certifications)
      .where(eq(schema.certifications.userId, userId));
  },

  async createCertification(certData: InsertCertification): Promise<Certification> {
    const [cert] = await db.insert(schema.certifications).values(certData).returning();
    return cert;
  },
};
