import { db } from "../../db";
import { eq } from "drizzle-orm";
import * as schema from "@shared/schema";
import type { Part, InsertPart } from "@shared/schema";

export const partsRepository = {
  async getPartsByCompany(companyId: string): Promise<Part[]> {
    return await db.select().from(schema.parts).where(eq(schema.parts.companyId, companyId));
  },

  async getPart(id: string): Promise<Part | undefined> {
    const [part] = await db.select().from(schema.parts).where(eq(schema.parts.id, id));
    return part;
  },

  async createPart(partData: InsertPart): Promise<Part> {
    const [part] = await db.insert(schema.parts).values(partData).returning();
    return part;
  },

  async updatePart(id: string, partData: Partial<InsertPart>): Promise<Part | undefined> {
    const [part] = await db
      .update(schema.parts)
      .set({ ...partData, updatedAt: new Date() })
      .where(eq(schema.parts.id, id))
      .returning();
    return part;
  },

  async deletePart(id: string): Promise<void> {
    // Delete PM required parts references first
    await db.delete(schema.pmRequiredParts).where(eq(schema.pmRequiredParts.partId, id));
    // Delete the part
    await db.delete(schema.parts).where(eq(schema.parts.id, id));
  },
};
