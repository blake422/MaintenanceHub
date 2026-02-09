import type { Express } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../customAuth";
import { loadCurrentUser, requireCompany, requireManagerOrAdmin, type AuthRequest } from "../middleware/rowLevelSecurity";
import { upload, handleFileUpload } from "../uploadHandlers";
import * as aiService from "../aiService";
import { parseImportFile } from "../equipmentImportParsers";
import { insertEquipmentSchema, insertPartSchema, insertPMScheduleSchema } from "@shared/schema";
import { z } from "zod";
import QRCode from "qrcode";
import { apiLogger } from "../logger";

// Schema for PM tasks (inline since it may not be exported)
const insertPMTaskSchema = z.object({
  pmScheduleId: z.string(),
  taskNumber: z.number(),
  description: z.string(),
  estimatedMinutes: z.number().optional(),
});

// Schema for PM required parts
const insertPMRequiredPartSchema = z.object({
  pmScheduleId: z.string(),
  partId: z.string().optional(),
  partName: z.string().optional(),
  quantity: z.number(),
});

export function registerEquipmentRoutes(app: Express): void {
  // Get all equipment for company
  app.get("/api/equipment", isAuthenticated, loadCurrentUser, requireCompany, async (req: AuthRequest, res) => {
    try {
      const equipment = await storage.getEquipmentByCompany(req.currentUser!.companyId);
      res.json(equipment);
    } catch (error) {
      apiLogger.error({ err: error }, "Error fetching equipment");
      res.status(500).json({ message: "Failed to fetch equipment" });
    }
  });

  // Get equipment as hierarchy tree
  app.get("/api/equipment/hierarchy", isAuthenticated, loadCurrentUser, requireCompany, async (req: AuthRequest, res) => {
    try {
      const allEquipment = await storage.getEquipmentByCompany(req.currentUser!.companyId);

      // Build hierarchy tree structure
      const equipmentMap = new Map();
      const rootNodes: any[] = [];

      // First pass: create map of all equipment
      allEquipment.forEach(eq => {
        equipmentMap.set(eq.id, { ...eq, children: [] });
      });

      // Second pass: build tree by linking parents and children
      allEquipment.forEach(eq => {
        const node = equipmentMap.get(eq.id);
        if (eq.parentEquipmentId) {
          const parent = equipmentMap.get(eq.parentEquipmentId);
          if (parent) {
            parent.children.push(node);
          } else {
            // Parent not found, treat as root
            rootNodes.push(node);
          }
        } else {
          // No parent, this is a root node
          rootNodes.push(node);
        }
      });

      res.json(rootNodes);
    } catch (error) {
      apiLogger.error({ err: error }, "Error fetching equipment hierarchy");
      res.status(500).json({ message: "Failed to fetch equipment hierarchy" });
    }
  });

  // Get a specific equipment
  app.get("/api/equipment/:id", isAuthenticated, loadCurrentUser, requireCompany, async (req: AuthRequest, res) => {
    try {
      const equipmentId = req.params.id;
      const equipment = await storage.getEquipment(equipmentId);

      if (!equipment) {
        return res.status(404).json({ message: "Equipment not found" });
      }

      if (equipment.companyId !== req.currentUser!.companyId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      res.json(equipment);
    } catch (error) {
      apiLogger.error({ err: error }, "Error fetching equipment");
      res.status(500).json({ message: "Failed to fetch equipment" });
    }
  });

  // Create new equipment
  app.post("/api/equipment", isAuthenticated, loadCurrentUser, requireCompany, requireManagerOrAdmin, async (req: AuthRequest, res) => {
    try {
      const equipmentData = insertEquipmentSchema.parse({
        ...req.body,
        companyId: req.currentUser!.companyId,
      });

      const equipment = await storage.createEquipment(equipmentData);

      // Generate QR code
      if (equipment.id) {
        const qrCodeData = await QRCode.toDataURL(equipment.id);
        await storage.updateEquipment(equipment.id, { qrCode: qrCodeData });
      }

      res.status(201).json(equipment);
    } catch (error) {
      apiLogger.error({ err: error }, "Error creating equipment");
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid request", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create equipment" });
    }
  });

  // Equipment import from file during onboarding
  // Requires manager or admin role - technicians should not be able to import equipment
  app.post("/api/equipment/import-onboarding", isAuthenticated, loadCurrentUser, requireCompany, requireManagerOrAdmin, upload.single("file"), async (req: AuthRequest, res) => {
    try {
      const currentUser = req.currentUser!;

      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const fileName = req.file.originalname;
      const fileMimeType = req.file.mimetype;

      apiLogger.info({ fileName, fileMimeType }, "Importing equipment from file");

      // Use AI extraction that extracts equipment, PM schedules, AND parts
      const extractedData = await aiService.extractEquipmentData(req.file.buffer, fileName, fileMimeType);

      apiLogger.info({ equipmentCount: extractedData.equipment.length, pmSchedulesCount: extractedData.pmSchedules.length, partsCount: extractedData.parts.length }, "AI extracted data from file");

      // Create equipment records first (needed for PM schedule foreign keys)
      const equipmentNameToId = new Map<string, string>();
      const createdEquipment = [];
      for (const equipmentData of extractedData.equipment) {
        const equipment = await storage.createEquipment({
          ...equipmentData,
          companyId: currentUser.companyId,
        });

        // Generate QR code
        if (equipment.id) {
          const qrCodeData = await QRCode.toDataURL(equipment.id);
          await storage.updateEquipment(equipment.id, { qrCode: qrCodeData });
          equipmentNameToId.set(equipmentData.name, equipment.id);
        }

        createdEquipment.push(equipment);
      }

      // Create parts (with duplicate detection)
      const companyParts = await storage.getPartsByCompany(currentUser.companyId);
      const partNumbersSet = new Set(companyParts.map(p => p.partNumber.toLowerCase()));
      const createdParts = [];
      for (const partData of extractedData.parts) {
        if (!partNumbersSet.has(partData.partNumber.toLowerCase())) {
          const part = await storage.createPart({
            ...partData,
            companyId: currentUser.companyId,
          });
          createdParts.push(part);
          partNumbersSet.add(partData.partNumber.toLowerCase());
        }
      }

      // Create PM schedules
      const createdPMSchedules = [];
      for (const pmData of extractedData.pmSchedules) {
        const equipmentId = equipmentNameToId.get(pmData.equipmentName);
        if (!equipmentId) {
          apiLogger.warn({ pmScheduleName: pmData.name, equipmentName: pmData.equipmentName }, "PM schedule references unknown equipment, skipping");
          continue;
        }

        const pmSchedule = await storage.createPMSchedule({
          companyId: currentUser.companyId,
          equipmentId,
          name: pmData.name,
          description: pmData.description || '',
          frequencyDays: pmData.frequencyDays || 30,
          nextDueDate: new Date(Date.now() + (pmData.frequencyDays || 30) * 24 * 60 * 60 * 1000),
          measurements: '',
          instructions: '',
        });

        // Create PM tasks
        if (pmData.tasks && pmData.tasks.length > 0) {
          for (const taskData of pmData.tasks) {
            await storage.createPMTask({
              pmScheduleId: pmSchedule.id,
              taskNumber: taskData.taskNumber,
              description: taskData.description,
              estimatedMinutes: taskData.estimatedMinutes,
            });
          }
        }

        // Create PM required parts
        if (pmData.requiredParts && pmData.requiredParts.length > 0) {
          for (const partData of pmData.requiredParts) {
            await storage.createPMRequiredPart({
              pmScheduleId: pmSchedule.id,
              partName: partData.partName,
              quantity: partData.quantity,
            });
          }
        }

        createdPMSchedules.push(pmSchedule);
      }

      apiLogger.info({ equipmentCount: createdEquipment.length, pmSchedulesCount: createdPMSchedules.length, partsCount: createdParts.length }, "Created records from import");

      // Save the uploaded document to object storage and link it to all created equipment
      if (createdEquipment.length > 0) {
        try {
          const documentUrl = await handleFileUpload(req.file, "equipment-documents");

          // Create equipment document record for each equipment
          for (const equipment of createdEquipment) {
            await storage.createEquipmentDocument({
              equipmentId: equipment.id,
              companyId: currentUser.companyId,
              fileName: req.file.originalname,
              fileUrl: documentUrl,
              fileType: req.file.mimetype,
              fileSize: req.file.size,
              uploadedById: currentUser.id,
            });
          }

          apiLogger.info({ fileName: req.file.originalname, equipmentCount: createdEquipment.length }, "Saved uploaded document to equipment library");
        } catch (docError) {
          apiLogger.error({ err: docError }, "Error saving equipment document");
          // Don't fail the entire import if document upload fails
        }
      }

      res.json({
        success: true,
        count: createdEquipment.length,
        equipment: createdEquipment,
        pmSchedules: createdPMSchedules,
        parts: createdParts,
      });
    } catch (error) {
      apiLogger.error({ err: error }, "Error importing equipment");
      res.status(500).json({ message: "Failed to import equipment" });
    }
  });

  // Equipment photo upload
  app.post("/api/equipment/:id/photos", isAuthenticated, loadCurrentUser, requireCompany, upload.array("photos", 5), async (req: AuthRequest, res) => {
    try {
      const equipmentId = req.params.id;
      const files = req.files as Express.Multer.File[];

      if (!files || files.length === 0) {
        return res.status(400).json({ message: "No files provided" });
      }

      const equipment = await storage.getEquipment(equipmentId);
      if (!equipment) {
        return res.status(404).json({ message: "Equipment not found" });
      }

      if (equipment.companyId !== req.currentUser!.companyId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const uploadedUrls: string[] = [];
      for (const file of files) {
        const url = await handleFileUpload(file, "equipment");
        uploadedUrls.push(url);
      }

      const existingPhotos = equipment.photoUrls || [];
      const updatedEquipment = await storage.updateEquipment(equipmentId, {
        photoUrls: [...existingPhotos, ...uploadedUrls],
      });

      res.json(updatedEquipment);
    } catch (error) {
      apiLogger.error({ err: error }, "Error uploading equipment photos");
      res.status(500).json({ message: "Failed to upload photos" });
    }
  });

  // Equipment manual upload
  app.post("/api/equipment/:id/manual", isAuthenticated, loadCurrentUser, requireCompany, upload.single("manual"), async (req: AuthRequest, res) => {
    try {
      const equipmentId = req.params.id;
      const file = req.file;

      if (!file) {
        return res.status(400).json({ message: "No file provided" });
      }

      const equipment = await storage.getEquipment(equipmentId);
      if (!equipment) {
        return res.status(404).json({ message: "Equipment not found" });
      }

      if (equipment.companyId !== req.currentUser!.companyId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const url = await handleFileUpload(file, "manuals");
      const updatedEquipment = await storage.updateEquipment(equipmentId, {
        manualUrl: url,
      });

      res.json(updatedEquipment);
    } catch (error) {
      apiLogger.error({ err: error }, "Error uploading equipment manual");
      res.status(500).json({ message: "Failed to upload manual" });
    }
  });

  // Equipment Documents Library routes
  app.get("/api/equipment/:id/documents", isAuthenticated, loadCurrentUser, requireCompany, async (req: AuthRequest, res) => {
    try {
      const equipmentId = req.params.id;
      const equipment = await storage.getEquipment(equipmentId);

      if (!equipment) {
        return res.status(404).json({ message: "Equipment not found" });
      }

      if (equipment.companyId !== req.currentUser!.companyId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const documents = await storage.getEquipmentDocumentsByEquipment(equipmentId);
      res.json(documents);
    } catch (error) {
      apiLogger.error({ err: error }, "Error fetching equipment documents");
      res.status(500).json({ message: "Failed to fetch documents" });
    }
  });

  app.post("/api/equipment/:id/documents", isAuthenticated, loadCurrentUser, requireCompany, upload.single("document"), async (req: AuthRequest, res) => {
    try {
      const equipmentId = req.params.id;
      const file = req.file;

      if (!file) {
        return res.status(400).json({ message: "No file provided" });
      }

      const equipment = await storage.getEquipment(equipmentId);
      if (!equipment) {
        return res.status(404).json({ message: "Equipment not found" });
      }

      if (equipment.companyId !== req.currentUser!.companyId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const fileUrl = await handleFileUpload(file, "equipment-documents");
      const document = await storage.createEquipmentDocument({
        equipmentId,
        companyId: req.currentUser!.companyId,
        fileName: file.originalname,
        fileUrl,
        fileType: file.mimetype,
        fileSize: file.size,
        uploadedById: req.currentUser!.id,
      });

      res.json(document);
    } catch (error) {
      apiLogger.error({ err: error }, "Error uploading equipment document");
      res.status(500).json({ message: "Failed to upload document" });
    }
  });

  app.delete("/api/equipment/documents/:id", isAuthenticated, loadCurrentUser, requireCompany, async (req: AuthRequest, res) => {
    try {
      const documentId = req.params.id;
      const document = await storage.getEquipmentDocument(documentId);

      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      if (document.companyId !== req.currentUser!.companyId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      await storage.deleteEquipmentDocument(documentId);
      res.json({ message: "Document deleted successfully" });
    } catch (error) {
      apiLogger.error({ err: error }, "Error deleting equipment document");
      res.status(500).json({ message: "Failed to delete document" });
    }
  });

  // Delete equipment
  app.delete("/api/equipment/:id", isAuthenticated, loadCurrentUser, requireCompany, requireManagerOrAdmin, async (req: AuthRequest, res) => {
    try {
      const equipmentId = req.params.id;
      const equipment = await storage.getEquipment(equipmentId);

      if (!equipment) {
        return res.status(404).json({ message: "Equipment not found" });
      }

      if (equipment.companyId !== req.currentUser!.companyId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      await storage.deleteEquipment(equipmentId);
      res.json({ message: "Equipment deleted successfully" });
    } catch (error) {
      apiLogger.error({ err: error }, "Error deleting equipment");
      res.status(500).json({ message: "Failed to delete equipment" });
    }
  });

  // Equipment import parse route
  app.post("/api/equipment/import/parse", isAuthenticated, loadCurrentUser, requireCompany, requireManagerOrAdmin, upload.single("file"), async (req: AuthRequest, res) => {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ message: "No file provided" });
      }

      const result = await parseImportFile(file);
      res.json(result);
    } catch (error) {
      apiLogger.error({ err: error }, "Error parsing import file");
      res.status(500).json({ message: "Failed to parse file", error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  // Equipment import confirm route
  app.post("/api/equipment/import/confirm", isAuthenticated, loadCurrentUser, requireCompany, requireManagerOrAdmin, async (req: AuthRequest, res) => {
    try {
      const { equipment = [], pmSchedules = [], parts = [] } = req.body;

      const createdEquipment: any[] = [];
      const createdPMs: any[] = [];
      const createdParts: any[] = [];
      const errors: any[] = [];

      // 1. Create equipment first
      const equipmentMap = new Map<string, string>(); // equipmentName -> equipmentId

      // Bulk import - skip QR code generation for speed (can be generated on-demand)
      apiLogger.info({ equipmentCount: equipment.length }, "Starting bulk import of equipment items");
      const batchSize = 50;
      for (let i = 0; i < equipment.length; i += batchSize) {
        const batch = equipment.slice(i, i + batchSize);
        apiLogger.debug({ batchNumber: Math.floor(i / batchSize) + 1, totalBatches: Math.ceil(equipment.length / batchSize) }, "Processing import batch");

        await Promise.all(batch.map(async (eq: any) => {
          try {
            const equipmentData = insertEquipmentSchema.parse({
              ...eq,
              companyId: req.currentUser!.companyId,
            });

            const created = await storage.createEquipment(equipmentData);
            createdEquipment.push(created);
            equipmentMap.set(eq.name, created.id);
          } catch (error) {
            apiLogger.error({ err: error, equipmentName: eq.name }, "Error creating equipment during import");
            errors.push({
              equipment: eq.name,
              error: error instanceof Error ? error.message : "Unknown error",
            });
          }
        }));
      }
      apiLogger.info({ createdCount: createdEquipment.length, errorCount: errors.length }, "Import completed");

      // 2. Create spare parts (check for duplicates)
      const partMap = new Map<string, string>(); // partName -> partId

      for (const part of parts) {
        try {
          // Check if part already exists in company inventory
          const existingParts = await storage.getPartsByCompany(req.currentUser!.companyId);
          const duplicate = existingParts.find(p =>
            p.partNumber === part.partNumber ||
            (p.name.toLowerCase() === part.name.toLowerCase() && p.machineType === part.machineType)
          );

          if (duplicate) {
            partMap.set(part.name, duplicate.id);
            continue; // Skip duplicate parts
          }

          const partData = insertPartSchema.parse({
            ...part,
            companyId: req.currentUser!.companyId,
            stockLevel: part.stockLevel || 0,
            minStockLevel: part.minStockLevel || 0,
          });

          const created = await storage.createPart(partData);
          createdParts.push(created);
          partMap.set(part.name, created.id);
        } catch (error) {
          apiLogger.error({ err: error, partName: part.name }, "Error creating part during import");
          errors.push({
            part: part.name,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }

      // 3. Create PM schedules with tasks and required parts
      for (const pm of pmSchedules) {
        try {
          // Find the equipment ID for this PM
          const equipmentId = equipmentMap.get(pm.equipmentName);
          if (!equipmentId) {
            errors.push({
              pm: pm.name,
              error: `Equipment not found: ${pm.equipmentName}`,
            });
            continue;
          }

          // Calculate next due date
          const nextDueDate = new Date();
          nextDueDate.setDate(nextDueDate.getDate() + pm.frequencyDays);

          // Create PM schedule
          const pmData = insertPMScheduleSchema.parse({
            companyId: req.currentUser!.companyId,
            equipmentId,
            name: pm.name,
            description: pm.description,
            frequencyDays: pm.frequencyDays,
            nextDueDate,
          });

          const createdPM = await storage.createPMSchedule(pmData);
          createdPMs.push(createdPM);

          // Create PM tasks
          if (pm.tasks && Array.isArray(pm.tasks)) {
            for (let i = 0; i < pm.tasks.length; i++) {
              const task = pm.tasks[i];
              // Handle both string and object formats from AI
              const taskDescription = typeof task === 'string' ? task : (task.description || String(task));
              const taskNumber = typeof task === 'object' && task.taskNumber ? task.taskNumber : i + 1;
              const estimatedMinutes = typeof task === 'object' && task.estimatedMinutes ? task.estimatedMinutes : undefined;

              const taskData = insertPMTaskSchema.parse({
                pmScheduleId: createdPM.id,
                taskNumber,
                description: taskDescription,
                estimatedMinutes,
              });
              await storage.createPMTask(taskData);
            }
          }

          // Link required parts to PM
          if (pm.requiredParts && Array.isArray(pm.requiredParts)) {
            for (const requiredPart of pm.requiredParts) {
              // Handle both string and object formats from AI
              const partName = typeof requiredPart === 'string' ? requiredPart : (requiredPart.partName || requiredPart.name || String(requiredPart));
              const quantity = typeof requiredPart === 'object' && requiredPart.quantity ? requiredPart.quantity : 1;

              const partId = partMap.get(partName);
              if (partId) {
                const requiredPartData = insertPMRequiredPartSchema.parse({
                  pmScheduleId: createdPM.id,
                  partId,
                  quantity,
                });
                await storage.createPMRequiredPart(requiredPartData);
              }
            }
          }
        } catch (error) {
          apiLogger.error({ err: error, pmName: pm.name }, "Error creating PM schedule during import");
          errors.push({
            pm: pm.name,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }

      res.json({
        equipment: createdEquipment,
        pmSchedules: createdPMs,
        parts: createdParts,
        errors,
        summary: {
          equipmentCreated: createdEquipment.length,
          pmSchedulesCreated: createdPMs.length,
          partsCreated: createdParts.length,
          totalErrors: errors.length,
        },
      });
    } catch (error) {
      apiLogger.error({ err: error }, "Error importing equipment");
      res.status(500).json({ message: "Failed to import equipment" });
    }
  });
}
