import { db } from "../../db";
import { eq } from "drizzle-orm";
import * as schema from "@shared/schema";
import type {
  Schematic,
  SchematicProgress,
  InsertSchematicProgress,
} from "@shared/schema";

export const schematicRepository = {
  async getSchematicsByCompany(companyId: string): Promise<Schematic[]> {
    return await db.select().from(schema.schematics)
      .where(eq(schema.schematics.companyId, companyId));
  },

  async getSchematicProgress(userId: string): Promise<SchematicProgress[]> {
    return await db.select().from(schema.schematicProgress)
      .where(eq(schema.schematicProgress.userId, userId));
  },

  async createOrUpdateSchematicProgress(progressData: InsertSchematicProgress): Promise<SchematicProgress> {
    const [progress] = await db
      .insert(schema.schematicProgress)
      .values(progressData)
      .onConflictDoUpdate({
        target: [schema.schematicProgress.userId, schema.schematicProgress.schematicId],
        set: {
          ...progressData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return progress;
  },
};
