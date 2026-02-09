import { db } from "../../db";
import { eq, desc } from "drizzle-orm";
import * as schema from "@shared/schema";
import type { RCA, InsertRCA } from "@shared/schema";

export const rcaRepository = {
  async getRCARecordsByCompany(companyId: string): Promise<RCA[]> {
    return await db.select().from(schema.rcaRecords)
      .where(eq(schema.rcaRecords.companyId, companyId))
      .orderBy(desc(schema.rcaRecords.createdAt));
  },

  async getRCARecord(id: string): Promise<RCA | undefined> {
    const [record] = await db.select().from(schema.rcaRecords).where(eq(schema.rcaRecords.id, id));
    return record;
  },

  async createRCARecord(recordData: InsertRCA): Promise<RCA> {
    const [record] = await db.insert(schema.rcaRecords).values(recordData).returning();
    return record;
  },

  async updateRCARecord(id: string, recordData: Partial<InsertRCA>): Promise<RCA | undefined> {
    const [record] = await db
      .update(schema.rcaRecords)
      .set({ ...recordData, updatedAt: new Date() })
      .where(eq(schema.rcaRecords.id, id))
      .returning();
    return record;
  },
};
