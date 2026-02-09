import { db } from "../../db";
import { eq, and, desc } from "drizzle-orm";
import {
  centerlineTemplates,
  centerlineParameters,
  centerlineRuns,
  centerlineMeasurements,
  InsertCenterlineTemplate,
  InsertCenterlineParameter,
  InsertCenterlineRun,
  InsertCenterlineMeasurement,
  CenterlineTemplate,
  CenterlineParameter,
  CenterlineRun,
  CenterlineMeasurement,
} from "@shared/schema";

export const centerlineRepository = {
  // Template operations
  async createTemplate(data: InsertCenterlineTemplate): Promise<CenterlineTemplate> {
    const [template] = await db.insert(centerlineTemplates).values(data).returning();
    return template;
  },

  async getTemplateById(id: string): Promise<CenterlineTemplate | undefined> {
    const [template] = await db.select().from(centerlineTemplates).where(eq(centerlineTemplates.id, id));
    return template;
  },

  async getTemplatesByCompany(companyId: string): Promise<CenterlineTemplate[]> {
    return db.select().from(centerlineTemplates)
      .where(eq(centerlineTemplates.companyId, companyId))
      .orderBy(desc(centerlineTemplates.createdAt));
  },

  async updateTemplate(id: string, data: Partial<InsertCenterlineTemplate>): Promise<CenterlineTemplate | undefined> {
    const [template] = await db.update(centerlineTemplates)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(centerlineTemplates.id, id))
      .returning();
    return template;
  },

  async deleteTemplate(id: string): Promise<boolean> {
    const result = await db.delete(centerlineTemplates).where(eq(centerlineTemplates.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  },

  // Parameter operations
  async createParameter(data: InsertCenterlineParameter): Promise<CenterlineParameter> {
    const [param] = await db.insert(centerlineParameters).values(data).returning();
    return param;
  },

  async getParametersByTemplate(templateId: string): Promise<CenterlineParameter[]> {
    return db.select().from(centerlineParameters)
      .where(eq(centerlineParameters.templateId, templateId))
      .orderBy(centerlineParameters.sortOrder);
  },

  async updateParameter(id: string, data: Partial<InsertCenterlineParameter>): Promise<CenterlineParameter | undefined> {
    const [param] = await db.update(centerlineParameters)
      .set(data)
      .where(eq(centerlineParameters.id, id))
      .returning();
    return param;
  },

  async deleteParameter(id: string): Promise<boolean> {
    const result = await db.delete(centerlineParameters).where(eq(centerlineParameters.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  },

  // Run operations
  async createRun(data: InsertCenterlineRun): Promise<CenterlineRun> {
    const [run] = await db.insert(centerlineRuns).values(data).returning();
    return run;
  },

  async getRunById(id: string): Promise<CenterlineRun | undefined> {
    const [run] = await db.select().from(centerlineRuns).where(eq(centerlineRuns.id, id));
    return run;
  },

  async getRunsByCompany(companyId: string): Promise<CenterlineRun[]> {
    return db.select().from(centerlineRuns)
      .where(eq(centerlineRuns.companyId, companyId))
      .orderBy(desc(centerlineRuns.createdAt));
  },

  async updateRun(id: string, data: Partial<InsertCenterlineRun>): Promise<CenterlineRun | undefined> {
    const [run] = await db.update(centerlineRuns)
      .set(data)
      .where(eq(centerlineRuns.id, id))
      .returning();
    return run;
  },

  // Measurement operations
  async createMeasurement(data: InsertCenterlineMeasurement): Promise<CenterlineMeasurement> {
    const [measurement] = await db.insert(centerlineMeasurements).values(data).returning();
    return measurement;
  },

  async getMeasurementsByRun(runId: string): Promise<CenterlineMeasurement[]> {
    return db.select().from(centerlineMeasurements)
      .where(eq(centerlineMeasurements.runId, runId));
  },

  async updateMeasurement(id: string, data: Partial<InsertCenterlineMeasurement>): Promise<CenterlineMeasurement | undefined> {
    const [measurement] = await db.update(centerlineMeasurements)
      .set(data)
      .where(eq(centerlineMeasurements.id, id))
      .returning();
    return measurement;
  },
};
