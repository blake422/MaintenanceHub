import { db } from "../../db";
import { eq } from "drizzle-orm";
import * as schema from "@shared/schema";
import type {
  PMSchedule,
  InsertPMSchedule,
  PMTask,
  InsertPMTask,
  PMRequiredPart,
  InsertPMRequiredPart,
} from "@shared/schema";

export const pmRepository = {
  // PM Schedule operations
  async getPMSchedulesByCompany(companyId: string): Promise<PMSchedule[]> {
    return await db.select().from(schema.pmSchedules).where(eq(schema.pmSchedules.companyId, companyId));
  },

  async getPMSchedule(id: string): Promise<PMSchedule | undefined> {
    const [schedule] = await db.select().from(schema.pmSchedules).where(eq(schema.pmSchedules.id, id));
    return schedule;
  },

  async createPMSchedule(scheduleData: InsertPMSchedule): Promise<PMSchedule> {
    const [schedule] = await db.insert(schema.pmSchedules).values(scheduleData).returning();
    return schedule;
  },

  async updatePMSchedule(id: string, scheduleData: Partial<InsertPMSchedule>): Promise<PMSchedule | undefined> {
    const [schedule] = await db
      .update(schema.pmSchedules)
      .set({ ...scheduleData, updatedAt: new Date() })
      .where(eq(schema.pmSchedules.id, id))
      .returning();
    return schedule;
  },

  // PM Task operations
  async getPMTasksBySchedule(scheduleId: string): Promise<PMTask[]> {
    return await db.select().from(schema.pmTasks)
      .where(eq(schema.pmTasks.pmScheduleId, scheduleId))
      .orderBy(schema.pmTasks.taskNumber);
  },

  async createPMTask(taskData: InsertPMTask): Promise<PMTask> {
    const [task] = await db.insert(schema.pmTasks).values(taskData).returning();
    return task;
  },

  // PM Required Parts operations
  async getPMRequiredPartsBySchedule(scheduleId: string): Promise<PMRequiredPart[]> {
    return await db.select().from(schema.pmRequiredParts)
      .where(eq(schema.pmRequiredParts.pmScheduleId, scheduleId));
  },

  async createPMRequiredPart(partData: InsertPMRequiredPart): Promise<PMRequiredPart> {
    const [part] = await db.insert(schema.pmRequiredParts).values(partData).returning();
    return part;
  },

  async deletePMSchedule(id: string): Promise<void> {
    // Delete related PM tasks and required parts first
    await db.delete(schema.pmTasks).where(eq(schema.pmTasks.pmScheduleId, id));
    await db.delete(schema.pmRequiredParts).where(eq(schema.pmRequiredParts.pmScheduleId, id));
    // Delete the PM schedule
    await db.delete(schema.pmSchedules).where(eq(schema.pmSchedules.id, id));
  },
};
