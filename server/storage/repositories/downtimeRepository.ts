import { db } from "../../db";
import { eq, desc } from "drizzle-orm";
import * as schema from "@shared/schema";
import type {
  DowntimeRecord,
  InsertDowntimeRecord,
  DowntimeReport,
  InsertDowntimeReport,
} from "@shared/schema";

export const downtimeRepository = {
  // Downtime Record operations
  async getDowntimeRecordsByCompany(companyId: string): Promise<DowntimeRecord[]> {
    return await db.select().from(schema.downtimeRecords)
      .where(eq(schema.downtimeRecords.companyId, companyId))
      .orderBy(desc(schema.downtimeRecords.startTime));
  },

  async createDowntimeRecord(recordData: InsertDowntimeRecord): Promise<DowntimeRecord> {
    const [record] = await db.insert(schema.downtimeRecords).values(recordData).returning();
    return record;
  },

  // Downtime Report operations
  async getDowntimeReportsByCompany(companyId: string): Promise<DowntimeReport[]> {
    return await db.select().from(schema.downtimeReports)
      .where(eq(schema.downtimeReports.companyId, companyId))
      .orderBy(desc(schema.downtimeReports.createdAt));
  },

  async getDowntimeReportById(id: string): Promise<DowntimeReport | undefined> {
    const [report] = await db.select().from(schema.downtimeReports)
      .where(eq(schema.downtimeReports.id, id));
    return report;
  },

  async createDowntimeReport(reportData: InsertDowntimeReport): Promise<DowntimeReport> {
    const [report] = await db.insert(schema.downtimeReports).values(reportData).returning();
    return report;
  },

  async updateDowntimeReport(id: string, reportData: Partial<InsertDowntimeReport>): Promise<DowntimeReport | undefined> {
    const [report] = await db
      .update(schema.downtimeReports)
      .set({ ...reportData, updatedAt: new Date() })
      .where(eq(schema.downtimeReports.id, id))
      .returning();
    return report;
  },

  async deleteDowntimeReport(id: string): Promise<void> {
    await db.delete(schema.downtimeReports).where(eq(schema.downtimeReports.id, id));
  },
};
