import type { Express } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../customAuth";
import { loadCurrentUser, requireCompany, requireRole, type AuthRequest } from "../middleware/rowLevelSecurity";
import { upload } from "../uploadHandlers";
import * as aiService from "../aiService";
import { insertPMScheduleSchema } from "@shared/schema";
import { z } from "zod";
import { apiLogger } from "../logger";

export function registerPmSchedulesRoutes(app: Express): void {
  // Get all PM schedules for company
  app.get("/api/pm-schedules", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const currentUser = await storage.getUser(userId);

      if (!currentUser?.companyId) {
        return res.status(403).json({ message: "No company assigned" });
      }

      const schedules = await storage.getPMSchedulesByCompany(currentUser.companyId);
      res.json(schedules);
    } catch (error) {
      apiLogger.error({ err: error }, "Error fetching PM schedules");
      res.status(500).json({ message: "Failed to fetch PM schedules" });
    }
  });

  // Create a new PM schedule
  app.post("/api/pm-schedules", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const currentUser = await storage.getUser(userId);

      if (!currentUser?.companyId) {
        return res.status(403).json({ message: "No company assigned" });
      }

      if (currentUser.role !== "admin" && currentUser.role !== "manager") {
        return res.status(403).json({ message: "Forbidden" });
      }

      const body = { ...req.body };
      if (body.nextDueDate && typeof body.nextDueDate === 'string') {
        body.nextDueDate = new Date(body.nextDueDate);
      }
      if (body.lastCompletedDate && typeof body.lastCompletedDate === 'string') {
        body.lastCompletedDate = new Date(body.lastCompletedDate);
      }

      const scheduleData = insertPMScheduleSchema.parse({
        ...body,
        companyId: currentUser.companyId,
      });

      const schedule = await storage.createPMSchedule(scheduleData);
      res.status(201).json(schedule);
    } catch (error) {
      apiLogger.error({ err: error }, "Error creating PM schedule");
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid request", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create PM schedule" });
    }
  });

  // Update a PM schedule
  app.patch("/api/pm-schedules/:id", isAuthenticated, loadCurrentUser, requireRole(["admin", "manager"]), async (req: any, res) => {
    try {
      const { id } = req.params;
      const schedule = await storage.getPMSchedule(id);

      if (!schedule) {
        return res.status(404).json({ message: "PM schedule not found" });
      }

      if (schedule.companyId !== (req as any).currentUser!.companyId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      // Validate request body - only allow specific fields
      const updateSchema = z.object({
        frequencyDays: z.number().int().positive().optional(),
        name: z.string().optional(),
        description: z.string().optional(),
        instructions: z.string().optional(),
        measurements: z.string().optional(),
      });

      const validatedData = updateSchema.parse(req.body);

      // If frequency changed, recalculate next due date
      if (validatedData.frequencyDays && validatedData.frequencyDays !== schedule.frequencyDays) {
        const today = new Date();
        const nextDue = new Date(today);
        nextDue.setDate(nextDue.getDate() + validatedData.frequencyDays);
        (validatedData as any).nextDueDate = nextDue;
      }

      const updated = await storage.updatePMSchedule(id, validatedData);
      res.json(updated);
    } catch (error) {
      apiLogger.error({ err: error }, "Error updating PM schedule");
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid request", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update PM schedule" });
    }
  });

  // Delete a PM schedule
  app.delete("/api/pm-schedules/:id", isAuthenticated, loadCurrentUser, requireRole(["admin", "manager"]), async (req: any, res) => {
    try {
      const { id } = req.params;
      const schedule = await storage.getPMSchedule(id);

      if (!schedule) {
        return res.status(404).json({ message: "PM schedule not found" });
      }

      if (schedule.companyId !== (req as any).currentUser!.companyId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      await storage.deletePMSchedule(id);
      res.json({ message: "PM schedule deleted successfully" });
    } catch (error) {
      apiLogger.error({ err: error }, "Error deleting PM schedule");
      res.status(500).json({ message: "Failed to delete PM schedule" });
    }
  });

  // Complete a PM schedule
  app.post("/api/pm-schedules/:id/complete", isAuthenticated, loadCurrentUser, requireCompany, async (req: any, res) => {
    try {
      const { id } = req.params;
      const schedule = await storage.getPMSchedule(id);

      if (!schedule) {
        return res.status(404).json({ message: "PM schedule not found" });
      }

      if (schedule.companyId !== (req as any).currentUser!.companyId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const today = new Date();
      const nextDue = new Date(today);
      nextDue.setDate(nextDue.getDate() + (schedule.frequencyDays || 30));

      const updated = await storage.updatePMSchedule(id, {
        lastCompletedDate: today,
        nextDueDate: nextDue,
      });

      res.json(updated);
    } catch (error) {
      apiLogger.error({ err: error }, "Error completing PM schedule");
      res.status(500).json({ message: "Failed to complete PM schedule" });
    }
  });

  // Get PM tasks for a specific schedule
  app.get("/api/pm-schedules/:id/tasks", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const currentUser = await storage.getUser(userId);

      if (!currentUser?.companyId) {
        return res.status(403).json({ message: "No company assigned" });
      }

      const schedule = await storage.getPMSchedule(req.params.id);
      if (!schedule || schedule.companyId !== currentUser.companyId) {
        return res.status(404).json({ message: "PM schedule not found" });
      }

      const tasks = await storage.getPMTasksBySchedule(req.params.id);
      res.json(tasks);
    } catch (error) {
      apiLogger.error({ err: error }, "Error fetching PM tasks");
      res.status(500).json({ message: "Failed to fetch PM tasks" });
    }
  });

  // Get required parts for a specific PM schedule
  app.get("/api/pm-schedules/:id/required-parts", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const currentUser = await storage.getUser(userId);

      if (!currentUser?.companyId) {
        return res.status(403).json({ message: "No company assigned" });
      }

      const schedule = await storage.getPMSchedule(req.params.id);
      if (!schedule || schedule.companyId !== currentUser.companyId) {
        return res.status(404).json({ message: "PM schedule not found" });
      }

      const requiredParts = await storage.getPMRequiredPartsBySchedule(req.params.id);
      res.json(requiredParts);
    } catch (error) {
      apiLogger.error({ err: error }, "Error fetching PM required parts");
      res.status(500).json({ message: "Failed to fetch PM required parts" });
    }
  });

  // PM Import from file
  app.post("/api/pm-schedules/import", isAuthenticated, loadCurrentUser, requireRole(["admin", "manager"]), upload.single("file"), async (req: any, res) => {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ message: "No file provided" });
      }

      const { extractEquipmentData } = await import('../aiService');
      const extracted = await extractEquipmentData(file.buffer, file.originalname, file.mimetype);

      res.json({
        pmSchedules: extracted.pmSchedules,
        equipment: extracted.equipment,
        fileName: file.originalname,
        totalRecords: extracted.pmSchedules.length,
      });
    } catch (error) {
      apiLogger.error({ err: error }, "Error importing PM schedules");
      res.status(500).json({ message: "Failed to import PM schedules" });
    }
  });

  // Analyze equipment manual PDF
  app.post("/api/analyze-manual", isAuthenticated, loadCurrentUser, requireCompany, upload.single("file"), async (req: any, res) => {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ message: "No file provided" });
      }

      // Extract text from PDF
      const pdfParse = (await import("pdf-parse")).default;
      const pdfData = await (pdfParse as any)(file.buffer);
      const pdfText = pdfData.text;

      if (!pdfText || pdfText.trim().length === 0) {
        return res.status(400).json({ message: "Could not extract text from PDF. Please ensure the PDF contains readable text." });
      }

      // Analyze with AI
      const { analyzePDFManual } = await import('../aiService');
      const result = await analyzePDFManual(pdfText);

      res.json({
        success: true,
        fileName: file.originalname,
        parts: result.parts || [],
        pmSchedules: result.pmSchedules || [],
      });
    } catch (error) {
      apiLogger.error({ err: error }, "Error analyzing equipment manual");
      res.status(500).json({ message: "Failed to analyze equipment manual" });
    }
  });

  // Optimize PM schedules with AI
  app.post("/api/pm-schedules/optimize", isAuthenticated, loadCurrentUser, requireRole(["admin", "manager"]), async (req: any, res) => {
    try {
      const { pmScheduleIds } = req.body;

      if (!pmScheduleIds || !Array.isArray(pmScheduleIds)) {
        return res.status(400).json({ message: "Invalid request - pmScheduleIds array required" });
      }

      const schedules = await Promise.all(
        pmScheduleIds.map(id => storage.getPMSchedule(id))
      );

      const validSchedules = schedules.filter(s => s && s.companyId === req.currentUser!.companyId);

      if (validSchedules.length === 0) {
        return res.status(404).json({ message: "No valid PM schedules found" });
      }

      const optimizations = await aiService.optimizePMSchedules(validSchedules);

      apiLogger.debug({ optimizationsCount: optimizations.length, firstItem: optimizations[0] }, "Returning PM schedule optimizations");

      res.json({ optimizations });
    } catch (error) {
      apiLogger.error({ err: error }, "Error optimizing PM schedules");
      res.status(500).json({ message: "Failed to optimize PM schedules" });
    }
  });

  // Bulk create PM schedules
  app.post("/api/pm-schedules/bulk-create", isAuthenticated, loadCurrentUser, requireRole(["admin", "manager"]), async (req: any, res) => {
    try {
      const { schedules } = req.body;

      if (!schedules || !Array.isArray(schedules)) {
        return res.status(400).json({ message: "Invalid request - schedules array required" });
      }

      const savedSchedules = [];

      for (const schedule of schedules) {
        const pmData = {
          ...schedule,
          companyId: req.currentUser!.companyId,
          nextDueDate: schedule.nextDueDate
            ? new Date(schedule.nextDueDate)
            : new Date(Date.now() + (schedule.frequencyDays || 30) * 24 * 60 * 60 * 1000),
        };

        const saved = await storage.createPMSchedule(pmData);
        savedSchedules.push(saved);
      }

      res.json({
        message: "PM schedules created successfully",
        count: savedSchedules.length,
        schedules: savedSchedules
      });
    } catch (error) {
      apiLogger.error({ err: error }, "Error bulk creating PM schedules");
      res.status(500).json({ message: "Failed to create PM schedules" });
    }
  });

  // Bulk update PM schedules
  app.post("/api/pm-schedules/bulk-update", isAuthenticated, loadCurrentUser, requireRole(["admin", "manager"]), async (req: any, res) => {
    try {
      const { updates } = req.body;

      if (!updates || !Array.isArray(updates)) {
        return res.status(400).json({ message: "Invalid request - updates array required" });
      }

      const results = [];
      for (const update of updates) {
        try {
          const schedule = await storage.getPMSchedule(update.id);
          if (schedule && schedule.companyId === req.currentUser!.companyId) {
            const updated = await storage.updatePMSchedule(update.id, update.data);
            results.push(updated);
          }
        } catch (error) {
          apiLogger.error({ err: error, pmScheduleId: update.id }, "Error updating PM schedule");
        }
      }

      res.json({ updated: results.length, schedules: results });
    } catch (error) {
      apiLogger.error({ err: error }, "Error bulk updating PM schedules");
      res.status(500).json({ message: "Failed to bulk update PM schedules" });
    }
  });
}
