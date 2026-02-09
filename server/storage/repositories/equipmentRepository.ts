import { db } from "../../db";
import { eq, desc } from "drizzle-orm";
import * as schema from "@shared/schema";
import type {
  Equipment,
  InsertEquipment,
  EquipmentDocument,
  InsertEquipmentDocument,
} from "@shared/schema";

export const equipmentRepository = {
  // Equipment operations
  async getEquipmentByCompany(companyId: string): Promise<Equipment[]> {
    return await db.select().from(schema.equipment).where(eq(schema.equipment.companyId, companyId));
  },

  async getEquipment(id: string): Promise<Equipment | undefined> {
    const [equipment] = await db.select().from(schema.equipment).where(eq(schema.equipment.id, id));
    return equipment;
  },

  async createEquipment(equipmentData: InsertEquipment): Promise<Equipment> {
    const [equipment] = await db.insert(schema.equipment).values(equipmentData).returning();
    return equipment;
  },

  async updateEquipment(id: string, equipmentData: Partial<InsertEquipment>): Promise<Equipment | undefined> {
    const [equipment] = await db
      .update(schema.equipment)
      .set({ ...equipmentData, updatedAt: new Date() })
      .where(eq(schema.equipment.id, id))
      .returning();
    return equipment;
  },

  // Equipment Document operations
  async getEquipmentDocumentsByEquipment(equipmentId: string): Promise<EquipmentDocument[]> {
    return db
      .select()
      .from(schema.equipmentDocuments)
      .where(eq(schema.equipmentDocuments.equipmentId, equipmentId))
      .orderBy(desc(schema.equipmentDocuments.createdAt));
  },

  async getEquipmentDocument(id: string): Promise<EquipmentDocument | undefined> {
    const [document] = await db
      .select()
      .from(schema.equipmentDocuments)
      .where(eq(schema.equipmentDocuments.id, id))
      .limit(1);
    return document;
  },

  async createEquipmentDocument(documentData: InsertEquipmentDocument): Promise<EquipmentDocument> {
    const [document] = await db.insert(schema.equipmentDocuments).values(documentData).returning();
    return document;
  },

  async deleteEquipmentDocument(id: string): Promise<void> {
    await db.delete(schema.equipmentDocuments).where(eq(schema.equipmentDocuments.id, id));
  },

  async deleteEquipment(id: string): Promise<void> {
    // Delete related records first (cascade)
    await db.delete(schema.equipmentDocuments).where(eq(schema.equipmentDocuments.equipmentId, id));
    await db.delete(schema.pmSchedules).where(eq(schema.pmSchedules.equipmentId, id));
    await db.delete(schema.schematics).where(eq(schema.schematics.equipmentId, id));
    await db.delete(schema.aiRecommendations).where(eq(schema.aiRecommendations.equipmentId, id));
    // Nullify references in work orders, downtime reports, RCA records, troubleshooting sessions
    await db.update(schema.workOrders).set({ equipmentId: null }).where(eq(schema.workOrders.equipmentId, id));
    await db.update(schema.downtimeRecords).set({ equipmentId: null }).where(eq(schema.downtimeRecords.equipmentId, id));
    await db.update(schema.rcaRecords).set({ equipmentId: null }).where(eq(schema.rcaRecords.equipmentId, id));
    await db.update(schema.troubleshootingSessions).set({ equipmentId: null }).where(eq(schema.troubleshootingSessions.equipmentId, id));
    // Nullify parent equipment references
    await db.update(schema.equipment).set({ parentEquipmentId: null }).where(eq(schema.equipment.parentEquipmentId, id));
    // Delete the equipment
    await db.delete(schema.equipment).where(eq(schema.equipment.id, id));
  },
};
