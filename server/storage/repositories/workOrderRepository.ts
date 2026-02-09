import { db } from "../../db";
import { eq, and, desc, isNull, sql } from "drizzle-orm";
import * as schema from "@shared/schema";
import type {
  WorkOrder,
  InsertWorkOrder,
  WorkOrderTemplate,
  InsertWorkOrderTemplate,
  TimeEntry,
} from "@shared/schema";

export const workOrderRepository = {
  // Work Order operations
  async getWorkOrdersByCompany(companyId: string): Promise<WorkOrder[]> {
    return await db.select().from(schema.workOrders)
      .where(eq(schema.workOrders.companyId, companyId))
      .orderBy(desc(schema.workOrders.createdAt));
  },

  async getWorkOrdersByUser(userId: string): Promise<WorkOrder[]> {
    return await db.select().from(schema.workOrders)
      .where(eq(schema.workOrders.assignedToId, userId))
      .orderBy(desc(schema.workOrders.createdAt));
  },

  async getWorkOrder(id: string): Promise<WorkOrder | undefined> {
    const [workOrder] = await db.select().from(schema.workOrders).where(eq(schema.workOrders.id, id));
    return workOrder;
  },

  async createWorkOrder(workOrderData: InsertWorkOrder): Promise<WorkOrder> {
    // Get the next work order number for this company
    const maxResult = await db
      .select({ maxNumber: sql<number>`COALESCE(MAX(${schema.workOrders.workOrderNumber}), 0)` })
      .from(schema.workOrders)
      .where(eq(schema.workOrders.companyId, workOrderData.companyId));

    const nextNumber = (maxResult[0]?.maxNumber || 0) + 1;

    const [workOrder] = await db.insert(schema.workOrders).values({
      ...workOrderData,
      workOrderNumber: nextNumber,
    }).returning();
    return workOrder;
  },

  async updateWorkOrder(id: string, workOrderData: Partial<InsertWorkOrder>): Promise<WorkOrder | undefined> {
    const [workOrder] = await db
      .update(schema.workOrders)
      .set({ ...workOrderData, updatedAt: new Date() })
      .where(eq(schema.workOrders.id, id))
      .returning();
    return workOrder;
  },

  // Work Order Template operations
  async getWorkOrderTemplatesByCompany(companyId: string): Promise<WorkOrderTemplate[]> {
    return await db
      .select()
      .from(schema.workOrderTemplates)
      .where(eq(schema.workOrderTemplates.companyId, companyId));
  },

  async getWorkOrderTemplate(id: string): Promise<WorkOrderTemplate | undefined> {
    const [template] = await db
      .select()
      .from(schema.workOrderTemplates)
      .where(eq(schema.workOrderTemplates.id, id));
    return template;
  },

  async createWorkOrderTemplate(templateData: InsertWorkOrderTemplate): Promise<WorkOrderTemplate> {
    const [template] = await db.insert(schema.workOrderTemplates).values(templateData).returning();
    return template;
  },

  async updateWorkOrderTemplate(id: string, templateData: Partial<InsertWorkOrderTemplate>): Promise<WorkOrderTemplate | undefined> {
    const [template] = await db
      .update(schema.workOrderTemplates)
      .set({ ...templateData, updatedAt: new Date() })
      .where(eq(schema.workOrderTemplates.id, id))
      .returning();
    return template;
  },

  async deleteWorkOrderTemplate(id: string): Promise<void> {
    await db.delete(schema.workOrderTemplates).where(eq(schema.workOrderTemplates.id, id));
  },

  async deleteWorkOrder(id: string): Promise<void> {
    // Delete related time entries
    await db.delete(schema.timeEntries).where(eq(schema.timeEntries.workOrderId, id));
    // Nullify references in downtime records and RCA records
    await db.update(schema.downtimeRecords).set({ workOrderId: null }).where(eq(schema.downtimeRecords.workOrderId, id));
    await db.update(schema.rcaRecords).set({ workOrderId: null }).where(eq(schema.rcaRecords.workOrderId, id));
    // Delete the work order
    await db.delete(schema.workOrders).where(eq(schema.workOrders.id, id));
  },

  // Timer lifecycle operations
  async startTimer(workOrderId: string, technicianId: string, companyId: string): Promise<{ workOrder: WorkOrder; timeEntry: TimeEntry }> {
    // Verify work order exists and belongs to correct company
    const targetWO = await db.query.workOrders.findFirst({
      where: and(
        eq(schema.workOrders.id, workOrderId),
        eq(schema.workOrders.companyId, companyId)
      ),
    });

    if (!targetWO) {
      throw new Error("Work order not found or access denied");
    }

    return await db.transaction(async (tx) => {
      // Find and close any existing open entries for this technician
      const openEntries = await tx
        .select()
        .from(schema.timeEntries)
        .where(
          and(
            eq(schema.timeEntries.userId, technicianId),
            isNull(schema.timeEntries.endTime)
          )
        );

      // Close all open entries and clear their work orders' active state
      for (const entry of openEntries) {
        await tx
          .update(schema.timeEntries)
          .set({
            endTime: sql`NOW()`,
            durationMinutes: sql`EXTRACT(EPOCH FROM (NOW() - start_time)) / 60`,
          })
          .where(eq(schema.timeEntries.id, entry.id));

        // Clear the previous work order's active timer state
        await tx
          .update(schema.workOrders)
          .set({
            activeTimeEntryId: null,
            activeTimerType: null,
            updatedAt: new Date(),
          })
          .where(eq(schema.workOrders.id, entry.workOrderId));
      }

      // Create new work entry
      const [timeEntry] = await tx
        .insert(schema.timeEntries)
        .values({
          workOrderId,
          userId: technicianId,
          companyId,
          entryType: "work",
          startTime: sql`NOW()`,
        })
        .returning();

      // Update work order with active timer state
      const [workOrder] = await tx
        .update(schema.workOrders)
        .set({
          activeTimeEntryId: timeEntry.id,
          activeTimerType: "work",
          status: "in_progress",
          updatedAt: new Date(),
        })
        .where(eq(schema.workOrders.id, workOrderId))
        .returning();

      return { workOrder, timeEntry };
    });
  },

  async pauseTimer(workOrderId: string, technicianId: string, breakReason: string, notes?: string): Promise<{ workOrder: WorkOrder; workEntry: TimeEntry; breakEntry: TimeEntry }> {
    return await db.transaction(async (tx) => {
      // Verify work order and get company ID
      const wo = await tx.query.workOrders.findFirst({
        where: eq(schema.workOrders.id, workOrderId),
      });

      if (!wo) {
        throw new Error("Work order not found");
      }

      // Close the active work entry
      const [workEntry] = await tx
        .update(schema.timeEntries)
        .set({
          endTime: sql`NOW()`,
          durationMinutes: sql`EXTRACT(EPOCH FROM (NOW() - start_time)) / 60`,
        })
        .where(
          and(
            eq(schema.timeEntries.workOrderId, workOrderId),
            eq(schema.timeEntries.userId, technicianId),
            eq(schema.timeEntries.entryType, "work"),
            isNull(schema.timeEntries.endTime)
          )
        )
        .returning();

      if (!workEntry) {
        throw new Error("No active work entry found");
      }

      // Create break entry
      const [breakEntry] = await tx
        .insert(schema.timeEntries)
        .values({
          workOrderId,
          userId: technicianId,
          companyId: wo.companyId,
          entryType: "break",
          breakReason: breakReason,
          startTime: sql`NOW()`,
        })
        .returning();

      // Update work order state
      const [workOrder] = await tx
        .update(schema.workOrders)
        .set({
          activeTimeEntryId: breakEntry.id,
          activeTimerType: "break",
          updatedAt: new Date(),
        })
        .where(eq(schema.workOrders.id, workOrderId))
        .returning();

      return { workOrder, workEntry, breakEntry };
    });
  },

  async resumeTimer(workOrderId: string, technicianId: string): Promise<{ workOrder: WorkOrder; timeEntry: TimeEntry }> {
    return await db.transaction(async (tx) => {
      // Verify work order and get company ID
      const wo = await tx.query.workOrders.findFirst({
        where: eq(schema.workOrders.id, workOrderId),
      });

      if (!wo) {
        throw new Error("Work order not found");
      }

      // Close the active break entry
      const [breakEntry] = await tx
        .update(schema.timeEntries)
        .set({
          endTime: sql`NOW()`,
          durationMinutes: sql`EXTRACT(EPOCH FROM (NOW() - start_time)) / 60`,
        })
        .where(
          and(
            eq(schema.timeEntries.workOrderId, workOrderId),
            eq(schema.timeEntries.userId, technicianId),
            eq(schema.timeEntries.entryType, "break"),
            isNull(schema.timeEntries.endTime)
          )
        )
        .returning();

      if (!breakEntry) {
        throw new Error("No active break entry found");
      }

      // Create new work entry
      const [timeEntry] = await tx
        .insert(schema.timeEntries)
        .values({
          workOrderId,
          userId: technicianId,
          companyId: wo.companyId,
          entryType: "work",
          startTime: sql`NOW()`,
        })
        .returning();

      // Update work order state
      const [workOrder] = await tx
        .update(schema.workOrders)
        .set({
          activeTimeEntryId: timeEntry.id,
          activeTimerType: "work",
          updatedAt: new Date(),
        })
        .where(eq(schema.workOrders.id, workOrderId))
        .returning();

      return { workOrder, timeEntry };
    });
  },

  async stopTimer(workOrderId: string, technicianId: string): Promise<WorkOrder> {
    return await db.transaction(async (tx) => {
      // Verify work order exists
      const wo = await tx.query.workOrders.findFirst({
        where: eq(schema.workOrders.id, workOrderId),
      });

      if (!wo) {
        throw new Error("Work order not found");
      }

      // Close any open entry
      await tx
        .update(schema.timeEntries)
        .set({
          endTime: sql`NOW()`,
          durationMinutes: sql`EXTRACT(EPOCH FROM (NOW() - start_time)) / 60`,
        })
        .where(
          and(
            eq(schema.timeEntries.workOrderId, workOrderId),
            eq(schema.timeEntries.userId, technicianId),
            isNull(schema.timeEntries.endTime)
          )
        );

      // Calculate total work time (sum of all work entries)
      const entries = await tx
        .select()
        .from(schema.timeEntries)
        .where(
          and(
            eq(schema.timeEntries.workOrderId, workOrderId),
            eq(schema.timeEntries.entryType, "work")
          )
        );

      const totalMinutes = entries.reduce((sum, entry) => sum + (entry.durationMinutes || 0), 0);

      // Update work order - clear active timer state, update total time
      const [workOrder] = await tx
        .update(schema.workOrders)
        .set({
          activeTimeEntryId: null,
          activeTimerType: null,
          totalTimeMinutes: totalMinutes,
          updatedAt: new Date(),
        })
        .where(eq(schema.workOrders.id, workOrderId))
        .returning();

      return workOrder;
    });
  },

  async getActiveTimeEntry(technicianId: string): Promise<(TimeEntry & { workOrder?: WorkOrder }) | undefined> {
    const entries = await db
      .select({
        timeEntry: schema.timeEntries,
        workOrder: schema.workOrders,
      })
      .from(schema.timeEntries)
      .leftJoin(schema.workOrders, eq(schema.timeEntries.workOrderId, schema.workOrders.id))
      .where(
        and(
          eq(schema.timeEntries.userId, technicianId),
          isNull(schema.timeEntries.endTime)
        )
      )
      .limit(1);

    if (entries.length === 0) return undefined;

    const { timeEntry, workOrder } = entries[0];
    return {
      ...timeEntry,
      workOrder: workOrder || undefined,
    };
  },

  async getTimeEntriesByWorkOrder(workOrderId: string): Promise<TimeEntry[]> {
    return await db
      .select()
      .from(schema.timeEntries)
      .where(eq(schema.timeEntries.workOrderId, workOrderId))
      .orderBy(schema.timeEntries.startTime);
  },
};
