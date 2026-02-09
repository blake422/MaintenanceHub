import { db } from "../../db";
import { eq, and, desc } from "drizzle-orm";
import * as schema from "@shared/schema";
import type {
  ExcellenceProgress,
  InsertExcellenceProgress,
  ExcellenceDeliverable,
  InsertExcellenceDeliverable,
  ClientCompany,
  InsertClientCompany,
  InterviewSession,
  InsertInterviewSession,
} from "@shared/schema";

export const excellenceRepository = {
  // Excellence Progress operations
  async getExcellenceProgress(id: string): Promise<ExcellenceProgress | undefined> {
    const [progress] = await db
      .select()
      .from(schema.excellenceProgress)
      .where(eq(schema.excellenceProgress.id, id));
    return progress;
  },

  async getExcellenceProgressByCompany(companyId: string, clientCompanyId?: string): Promise<ExcellenceProgress | undefined> {
    const conditions = [eq(schema.excellenceProgress.companyId, companyId)];
    
    if (clientCompanyId) {
      conditions.push(eq(schema.excellenceProgress.clientCompanyId, clientCompanyId));
    } else {
      // If no clientCompanyId, look for records with null clientCompanyId (legacy/non-client progress)
      conditions.push(eq(schema.excellenceProgress.clientCompanyId, null as any));
    }
    
    const [progress] = await db
      .select()
      .from(schema.excellenceProgress)
      .where(and(...conditions));
    return progress;
  },

  async createExcellenceProgress(progressData: InsertExcellenceProgress): Promise<ExcellenceProgress> {
    const [progress] = await db
      .insert(schema.excellenceProgress)
      .values(progressData)
      .returning();
    return progress;
  },

  async updateExcellenceProgress(id: string, progressData: Partial<InsertExcellenceProgress>): Promise<ExcellenceProgress | undefined> {
    const [progress] = await db
      .update(schema.excellenceProgress)
      .set({
        ...progressData,
        updatedAt: new Date(),
      })
      .where(eq(schema.excellenceProgress.id, id))
      .returning();
    return progress;
  },

  // Excellence Deliverables operations
  async getExcellenceDeliverables(companyId: string, step?: number, clientCompanyId?: string): Promise<ExcellenceDeliverable[]> {
    const conditions = [eq(schema.excellenceDeliverables.companyId, companyId)];

    if (step !== undefined) {
      conditions.push(eq(schema.excellenceDeliverables.step, step));
    }
    
    if (clientCompanyId) {
      conditions.push(eq(schema.excellenceDeliverables.clientCompanyId, clientCompanyId));
    } else {
      conditions.push(eq(schema.excellenceDeliverables.clientCompanyId, null as any));
    }

    return await db
      .select()
      .from(schema.excellenceDeliverables)
      .where(and(...conditions))
      .orderBy(schema.excellenceDeliverables.step, schema.excellenceDeliverables.checklistItemId);
  },

  async getExcellenceDeliverable(id: string): Promise<ExcellenceDeliverable | undefined> {
    const [deliverable] = await db
      .select()
      .from(schema.excellenceDeliverables)
      .where(eq(schema.excellenceDeliverables.id, id));
    return deliverable;
  },

  async createExcellenceDeliverable(deliverableData: InsertExcellenceDeliverable): Promise<ExcellenceDeliverable> {
    const [deliverable] = await db
      .insert(schema.excellenceDeliverables)
      .values(deliverableData)
      .returning();
    return deliverable;
  },

  async updateExcellenceDeliverable(id: string, deliverableData: Partial<InsertExcellenceDeliverable>): Promise<ExcellenceDeliverable | undefined> {
    const [deliverable] = await db
      .update(schema.excellenceDeliverables)
      .set({
        ...deliverableData,
        updatedAt: new Date(),
      })
      .where(eq(schema.excellenceDeliverables.id, id))
      .returning();
    return deliverable;
  },

  async deleteExcellenceDeliverable(id: string): Promise<void> {
    await db
      .delete(schema.excellenceDeliverables)
      .where(eq(schema.excellenceDeliverables.id, id));
  },

  // Client Company operations
  async getClientCompaniesByCompany(companyId: string): Promise<ClientCompany[]> {
    return await db
      .select()
      .from(schema.clientCompanies)
      .where(eq(schema.clientCompanies.companyId, companyId))
      .orderBy(desc(schema.clientCompanies.createdAt));
  },

  async getClientCompany(id: string): Promise<ClientCompany | undefined> {
    const [clientCompany] = await db
      .select()
      .from(schema.clientCompanies)
      .where(eq(schema.clientCompanies.id, id));
    return clientCompany;
  },

  async createClientCompany(clientCompanyData: InsertClientCompany): Promise<ClientCompany> {
    const [clientCompany] = await db
      .insert(schema.clientCompanies)
      .values(clientCompanyData)
      .returning();
    return clientCompany;
  },

  async updateClientCompany(id: string, clientCompanyData: Partial<InsertClientCompany>): Promise<ClientCompany | undefined> {
    const [clientCompany] = await db
      .update(schema.clientCompanies)
      .set({
        ...clientCompanyData,
        updatedAt: new Date(),
      })
      .where(eq(schema.clientCompanies.id, id))
      .returning();
    return clientCompany;
  },

  async deleteClientCompany(id: string): Promise<void> {
    await db
      .delete(schema.clientCompanies)
      .where(eq(schema.clientCompanies.id, id));
  },

  // Interview Session operations
  async getInterviewSessionsByCompany(companyId: string): Promise<InterviewSession[]> {
    return await db
      .select()
      .from(schema.interviewSessions)
      .where(eq(schema.interviewSessions.companyId, companyId))
      .orderBy(desc(schema.interviewSessions.createdAt));
  },

  async getInterviewSessionsByClientCompany(clientCompanyId: string): Promise<InterviewSession[]> {
    return await db
      .select()
      .from(schema.interviewSessions)
      .where(eq(schema.interviewSessions.clientCompanyId, clientCompanyId))
      .orderBy(desc(schema.interviewSessions.createdAt));
  },

  async getInterviewSessionsByAssessment(assessmentDeliverableId: string): Promise<InterviewSession[]> {
    return await db
      .select()
      .from(schema.interviewSessions)
      .where(eq(schema.interviewSessions.assessmentDeliverableId, assessmentDeliverableId))
      .orderBy(desc(schema.interviewSessions.createdAt));
  },

  async getInterviewSession(id: string): Promise<InterviewSession | undefined> {
    const [session] = await db
      .select()
      .from(schema.interviewSessions)
      .where(eq(schema.interviewSessions.id, id));
    return session;
  },

  async createInterviewSession(sessionData: InsertInterviewSession): Promise<InterviewSession> {
    const [session] = await db
      .insert(schema.interviewSessions)
      .values(sessionData)
      .returning();
    return session;
  },

  async updateInterviewSession(id: string, sessionData: Partial<InsertInterviewSession>): Promise<InterviewSession | undefined> {
    const [session] = await db
      .update(schema.interviewSessions)
      .set({
        ...sessionData,
        updatedAt: new Date(),
      })
      .where(eq(schema.interviewSessions.id, id))
      .returning();
    return session;
  },

  async deleteInterviewSession(id: string): Promise<void> {
    await db
      .delete(schema.interviewSessions)
      .where(eq(schema.interviewSessions.id, id));
  },
};
