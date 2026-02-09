import { db } from "../../db";
import { eq, desc, and, sql } from "drizzle-orm";
import {
  cilrTemplates,
  cilrTemplateTasks,
  cilrRuns,
  cilrTaskCompletions,
  cilrTaskMedia,
  CilrTemplate,
  InsertCilrTemplate,
  CilrTemplateTask,
  InsertCilrTemplateTask,
  CilrRun,
  InsertCilrRun,
  CilrTaskCompletion,
  InsertCilrTaskCompletion,
  CilrTaskMedia,
  InsertCilrTaskMedia,
} from "@shared/schema";

// Template operations
export async function getCilrTemplatesByCompany(companyId: string): Promise<CilrTemplate[]> {
  return await db
    .select()
    .from(cilrTemplates)
    .where(eq(cilrTemplates.companyId, companyId))
    .orderBy(desc(cilrTemplates.createdAt));
}

export async function getCilrTemplate(id: string): Promise<CilrTemplate | undefined> {
  const [template] = await db
    .select()
    .from(cilrTemplates)
    .where(eq(cilrTemplates.id, id));
  return template;
}

export async function createCilrTemplate(template: InsertCilrTemplate): Promise<CilrTemplate> {
  const [created] = await db.insert(cilrTemplates).values(template).returning();
  return created;
}

export async function updateCilrTemplate(
  id: string,
  updates: Partial<InsertCilrTemplate>
): Promise<CilrTemplate | undefined> {
  const [updated] = await db
    .update(cilrTemplates)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(cilrTemplates.id, id))
    .returning();
  return updated;
}

export async function deleteCilrTemplate(id: string): Promise<void> {
  await db.delete(cilrTemplates).where(eq(cilrTemplates.id, id));
}

// Template Task operations
export async function getCilrTemplateTasksByTemplate(templateId: string): Promise<CilrTemplateTask[]> {
  return await db
    .select()
    .from(cilrTemplateTasks)
    .where(eq(cilrTemplateTasks.templateId, templateId))
    .orderBy(cilrTemplateTasks.sortOrder);
}

export async function getCilrTemplateTask(id: string): Promise<CilrTemplateTask | undefined> {
  const [task] = await db
    .select()
    .from(cilrTemplateTasks)
    .where(eq(cilrTemplateTasks.id, id));
  return task;
}

export async function createCilrTemplateTask(task: InsertCilrTemplateTask): Promise<CilrTemplateTask> {
  const [created] = await db.insert(cilrTemplateTasks).values(task).returning();
  return created;
}

export async function updateCilrTemplateTask(
  id: string,
  updates: Partial<InsertCilrTemplateTask>
): Promise<CilrTemplateTask | undefined> {
  const [updated] = await db
    .update(cilrTemplateTasks)
    .set(updates)
    .where(eq(cilrTemplateTasks.id, id))
    .returning();
  return updated;
}

export async function deleteCilrTemplateTask(id: string): Promise<void> {
  await db.delete(cilrTemplateTasks).where(eq(cilrTemplateTasks.id, id));
}

// Run operations
export async function getCilrRunsByCompany(companyId: string): Promise<CilrRun[]> {
  return await db
    .select()
    .from(cilrRuns)
    .where(eq(cilrRuns.companyId, companyId))
    .orderBy(desc(cilrRuns.createdAt));
}

export async function getCilrRunsByEquipment(equipmentId: string): Promise<CilrRun[]> {
  return await db
    .select()
    .from(cilrRuns)
    .where(eq(cilrRuns.equipmentId, equipmentId))
    .orderBy(desc(cilrRuns.createdAt));
}

export async function getCilrRunsByUser(userId: string): Promise<CilrRun[]> {
  return await db
    .select()
    .from(cilrRuns)
    .where(eq(cilrRuns.assignedTo, userId))
    .orderBy(desc(cilrRuns.createdAt));
}

export async function getCilrRun(id: string): Promise<CilrRun | undefined> {
  const [run] = await db
    .select()
    .from(cilrRuns)
    .where(eq(cilrRuns.id, id));
  return run;
}

export async function createCilrRun(run: InsertCilrRun): Promise<CilrRun> {
  const [created] = await db.insert(cilrRuns).values(run).returning();
  return created;
}

export async function updateCilrRun(
  id: string,
  updates: Partial<InsertCilrRun>
): Promise<CilrRun | undefined> {
  const [updated] = await db
    .update(cilrRuns)
    .set(updates)
    .where(eq(cilrRuns.id, id))
    .returning();
  return updated;
}

export async function completeCilrRun(id: string): Promise<CilrRun | undefined> {
  const [updated] = await db
    .update(cilrRuns)
    .set({ status: "completed", completedAt: new Date() })
    .where(eq(cilrRuns.id, id))
    .returning();
  return updated;
}

// Task Completion operations
export async function getCilrTaskCompletionsByRun(runId: string): Promise<CilrTaskCompletion[]> {
  return await db
    .select()
    .from(cilrTaskCompletions)
    .where(eq(cilrTaskCompletions.runId, runId));
}

export async function getCilrTaskCompletion(id: string): Promise<CilrTaskCompletion | undefined> {
  const [completion] = await db
    .select()
    .from(cilrTaskCompletions)
    .where(eq(cilrTaskCompletions.id, id));
  return completion;
}

export async function createOrUpdateCilrTaskCompletion(
  completion: InsertCilrTaskCompletion
): Promise<CilrTaskCompletion> {
  // Check if completion already exists for this run and task
  const [existing] = await db
    .select()
    .from(cilrTaskCompletions)
    .where(
      and(
        eq(cilrTaskCompletions.runId, completion.runId),
        eq(cilrTaskCompletions.taskId, completion.taskId)
      )
    );

  if (existing) {
    const [updated] = await db
      .update(cilrTaskCompletions)
      .set({
        ...completion,
        completedAt: completion.isCompleted ? new Date() : null,
      })
      .where(eq(cilrTaskCompletions.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await db.insert(cilrTaskCompletions).values(completion).returning();
  return created;
}

// Media operations
export async function getCilrTaskMediaByCompletion(completionId: string): Promise<CilrTaskMedia[]> {
  return await db
    .select()
    .from(cilrTaskMedia)
    .where(eq(cilrTaskMedia.completionId, completionId))
    .orderBy(desc(cilrTaskMedia.uploadedAt));
}

export async function getCilrTaskMediaByRun(runId: string): Promise<CilrTaskMedia[]> {
  return await db
    .select()
    .from(cilrTaskMedia)
    .where(eq(cilrTaskMedia.runId, runId))
    .orderBy(desc(cilrTaskMedia.uploadedAt));
}

export async function createCilrTaskMedia(media: InsertCilrTaskMedia): Promise<CilrTaskMedia> {
  const [created] = await db.insert(cilrTaskMedia).values(media).returning();
  return created;
}

export async function deleteCilrTaskMedia(id: string): Promise<void> {
  await db.delete(cilrTaskMedia).where(eq(cilrTaskMedia.id, id));
}

// Consolidated run details with all related data
export interface CilrRunDetails {
  run: CilrRun;
  template: CilrTemplate | null;
  tasks: CilrTemplateTask[];
  completions: (CilrTaskCompletion & { media: CilrTaskMedia[] })[];
}

export async function getCilrRunDetails(runId: string): Promise<CilrRunDetails | null> {
  const run = await getCilrRun(runId);
  if (!run) return null;

  const templateResult = await getCilrTemplate(run.templateId);
  const template = templateResult ?? null;
  const tasks = template ? await getCilrTemplateTasksByTemplate(template.id) : [];
  const completions = await getCilrTaskCompletionsByRun(run.id);
  const allMedia = await getCilrTaskMediaByRun(run.id);

  const completionsWithMedia = completions.map(c => ({
    ...c,
    media: allMedia.filter(m => m.completionId === c.id),
  }));

  return {
    run,
    template,
    tasks,
    completions: completionsWithMedia,
  };
}

export async function getCilrRunDetailsList(
  companyId: string,
  filters?: { status?: string; startDate?: Date; endDate?: Date; equipmentId?: string; templateId?: string }
): Promise<CilrRunDetails[]> {
  let runs = await getCilrRunsByCompany(companyId);

  if (filters?.status) {
    runs = runs.filter(r => r.status === filters.status);
  }
  if (filters?.startDate) {
    runs = runs.filter(r => r.completedAt && new Date(r.completedAt) >= filters.startDate!);
  }
  if (filters?.endDate) {
    runs = runs.filter(r => r.completedAt && new Date(r.completedAt) <= filters.endDate!);
  }
  if (filters?.equipmentId) {
    runs = runs.filter(r => r.equipmentId === filters.equipmentId);
  }
  if (filters?.templateId) {
    runs = runs.filter(r => r.templateId === filters.templateId);
  }

  const results: CilrRunDetails[] = [];
  for (const run of runs) {
    const details = await getCilrRunDetails(run.id);
    if (details) {
      results.push(details);
    }
  }

  return results;
}

// Export all functions as a repository object
export const cilrRepository = {
  getCilrTemplatesByCompany,
  getCilrTemplate,
  createCilrTemplate,
  updateCilrTemplate,
  deleteCilrTemplate,
  getCilrTemplateTasksByTemplate,
  getCilrTemplateTask,
  createCilrTemplateTask,
  updateCilrTemplateTask,
  deleteCilrTemplateTask,
  getCilrRunsByCompany,
  getCilrRunsByEquipment,
  getCilrRunsByUser,
  getCilrRun,
  createCilrRun,
  updateCilrRun,
  completeCilrRun,
  getCilrTaskCompletionsByRun,
  getCilrTaskCompletion,
  createOrUpdateCilrTaskCompletion,
  getCilrTaskMediaByCompletion,
  getCilrTaskMediaByRun,
  createCilrTaskMedia,
  deleteCilrTaskMedia,
  getCilrRunDetails,
  getCilrRunDetailsList,
};
