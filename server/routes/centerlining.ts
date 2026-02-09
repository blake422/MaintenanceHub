import type { Express } from "express";
import { isAuthenticated } from "../customAuth";
import { loadCurrentUser, type AuthRequest } from "../middleware/rowLevelSecurity";
import { storage } from "../storage";
import { centerlineRepository } from "../storage/repositories/centerlineRepository";
import { insertCenterlineTemplateSchema, insertCenterlineParameterSchema, insertCenterlineRunSchema, insertCenterlineMeasurementSchema } from "@shared/schema";
import { analyzeCenterlineReading } from "../ai/services/cilrService";
import { apiLogger } from "../logger";
import { z } from "zod";

export function registerCenterlineRoutes(app: Express): void {
  // ==================== TEMPLATE ROUTES ====================

  // Get all templates for company
  app.get("/api/centerlining/templates", isAuthenticated, loadCurrentUser, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const currentUser = await storage.getUser(userId);

      if (!currentUser?.companyId) {
        return res.status(403).json({ message: "No company assigned" });
      }

      const templates = await centerlineRepository.getTemplatesByCompany(currentUser.companyId);
      res.json(templates);
    } catch (error) {
      apiLogger.error({ err: error }, "Error fetching centerline templates");
      res.status(500).json({ message: "Failed to fetch templates" });
    }
  });

  // Get template by ID with parameters
  app.get("/api/centerlining/templates/:id", isAuthenticated, loadCurrentUser, async (req: AuthRequest, res) => {
    try {
      const template = await centerlineRepository.getTemplateById(req.params.id);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }
      const parameters = await centerlineRepository.getParametersByTemplate(req.params.id);
      res.json({ ...template, parameters });
    } catch (error) {
      apiLogger.error({ err: error }, "Error fetching template");
      res.status(500).json({ message: "Failed to fetch template" });
    }
  });

  // Create template with optional parameters
  app.post("/api/centerlining/templates", isAuthenticated, loadCurrentUser, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const currentUser = await storage.getUser(userId);

      if (!currentUser?.companyId) {
        return res.status(403).json({ message: "No company assigned" });
      }

      if (!["admin", "manager"].includes(currentUser.role || "")) {
        return res.status(403).json({ message: "Only managers and admins can create templates" });
      }

      const createSchema = z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        equipmentId: z.string().uuid().optional().nullable(),
        frequency: z.string().optional(),
        estimatedMinutes: z.number().optional(),
        parameters: z.array(z.object({
          name: z.string().min(1),
          description: z.string().optional(),
          targetValue: z.string().min(1),
          minValue: z.string().min(1),
          maxValue: z.string().min(1),
          unit: z.string().min(1),
          category: z.string().optional(),
          sortOrder: z.number().optional(),
        })).optional(),
      });

      const validated = createSchema.parse(req.body);
      const { parameters, ...templateData } = validated;

      const template = await centerlineRepository.createTemplate({
        ...templateData,
        equipmentId: templateData.equipmentId || undefined,
        companyId: currentUser.companyId,
        createdBy: userId,
      });

      // Create parameters if provided
      if (parameters && parameters.length > 0) {
        for (let i = 0; i < parameters.length; i++) {
          await centerlineRepository.createParameter({
            ...parameters[i],
            templateId: template.id,
            sortOrder: parameters[i].sortOrder ?? i,
          });
        }
      }

      const params = await centerlineRepository.getParametersByTemplate(template.id);
      res.status(201).json({ ...template, parameters: params });
    } catch (error) {
      apiLogger.error({ err: error }, "Error creating template");
      res.status(500).json({ message: "Failed to create template" });
    }
  });

  // Update template
  app.patch("/api/centerlining/templates/:id", isAuthenticated, loadCurrentUser, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const currentUser = await storage.getUser(userId);

      if (!["admin", "manager"].includes(currentUser?.role || "")) {
        return res.status(403).json({ message: "Only managers and admins can update templates" });
      }

      const template = await centerlineRepository.updateTemplate(req.params.id, req.body);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }
      res.json(template);
    } catch (error) {
      apiLogger.error({ err: error }, "Error updating template");
      res.status(500).json({ message: "Failed to update template" });
    }
  });

  // Delete template
  app.delete("/api/centerlining/templates/:id", isAuthenticated, loadCurrentUser, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const currentUser = await storage.getUser(userId);

      if (!["admin", "manager"].includes(currentUser?.role || "")) {
        return res.status(403).json({ message: "Only managers and admins can delete templates" });
      }

      const deleted = await centerlineRepository.deleteTemplate(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Template not found" });
      }
      res.json({ success: true });
    } catch (error) {
      apiLogger.error({ err: error }, "Error deleting template");
      res.status(500).json({ message: "Failed to delete template" });
    }
  });

  // ==================== PARAMETER ROUTES ====================

  // Create parameter
  app.post("/api/centerlining/templates/:templateId/parameters", isAuthenticated, loadCurrentUser, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const currentUser = await storage.getUser(userId);

      if (!["admin", "manager"].includes(currentUser?.role || "")) {
        return res.status(403).json({ message: "Only managers and admins can add parameters" });
      }

      const data = insertCenterlineParameterSchema.parse({
        ...req.body,
        templateId: req.params.templateId,
      });

      const parameter = await centerlineRepository.createParameter(data);
      res.status(201).json(parameter);
    } catch (error) {
      apiLogger.error({ err: error }, "Error creating parameter");
      res.status(500).json({ message: "Failed to create parameter" });
    }
  });

  // Update parameter
  app.patch("/api/centerlining/parameters/:id", isAuthenticated, loadCurrentUser, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const currentUser = await storage.getUser(userId);

      if (!["admin", "manager"].includes(currentUser?.role || "")) {
        return res.status(403).json({ message: "Only managers and admins can update parameters" });
      }

      const parameter = await centerlineRepository.updateParameter(req.params.id, req.body);
      if (!parameter) {
        return res.status(404).json({ message: "Parameter not found" });
      }
      res.json(parameter);
    } catch (error) {
      apiLogger.error({ err: error }, "Error updating parameter");
      res.status(500).json({ message: "Failed to update parameter" });
    }
  });

  // Delete parameter
  app.delete("/api/centerlining/parameters/:id", isAuthenticated, loadCurrentUser, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const currentUser = await storage.getUser(userId);

      if (!["admin", "manager"].includes(currentUser?.role || "")) {
        return res.status(403).json({ message: "Only managers and admins can delete parameters" });
      }

      const deleted = await centerlineRepository.deleteParameter(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Parameter not found" });
      }
      res.json({ success: true });
    } catch (error) {
      apiLogger.error({ err: error }, "Error deleting parameter");
      res.status(500).json({ message: "Failed to delete parameter" });
    }
  });

  // ==================== RUN ROUTES ====================

  // Get all runs for company
  app.get("/api/centerlining/runs", isAuthenticated, loadCurrentUser, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const currentUser = await storage.getUser(userId);

      if (!currentUser?.companyId) {
        return res.status(403).json({ message: "No company assigned" });
      }

      const runs = await centerlineRepository.getRunsByCompany(currentUser.companyId);
      res.json(runs);
    } catch (error) {
      apiLogger.error({ err: error }, "Error fetching runs");
      res.status(500).json({ message: "Failed to fetch runs" });
    }
  });

  // Get run by ID with measurements
  app.get("/api/centerlining/runs/:id", isAuthenticated, loadCurrentUser, async (req: AuthRequest, res) => {
    try {
      const run = await centerlineRepository.getRunById(req.params.id);
      if (!run) {
        return res.status(404).json({ message: "Run not found" });
      }
      const measurements = await centerlineRepository.getMeasurementsByRun(req.params.id);
      
      // Get template and parameters
      const template = await centerlineRepository.getTemplateById(run.templateId);
      const parameters = template ? await centerlineRepository.getParametersByTemplate(template.id) : [];
      
      res.json({ ...run, measurements, template, parameters });
    } catch (error) {
      apiLogger.error({ err: error }, "Error fetching run");
      res.status(500).json({ message: "Failed to fetch run" });
    }
  });

  // Start a new run
  app.post("/api/centerlining/runs", isAuthenticated, loadCurrentUser, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const currentUser = await storage.getUser(userId);

      if (!currentUser?.companyId) {
        return res.status(403).json({ message: "No company assigned" });
      }

      const template = await centerlineRepository.getTemplateById(req.body.templateId);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }

      const run = await centerlineRepository.createRun({
        templateId: req.body.templateId,
        companyId: currentUser.companyId,
        equipmentId: template.equipmentId || undefined,
        assignedTo: userId,
        status: "in_progress",
      });

      const parameters = await centerlineRepository.getParametersByTemplate(template.id);
      res.status(201).json({ ...run, template, parameters });
    } catch (error) {
      apiLogger.error({ err: error }, "Error creating run");
      res.status(500).json({ message: "Failed to create run" });
    }
  });

  // Complete a run
  app.patch("/api/centerlining/runs/:id/complete", isAuthenticated, loadCurrentUser, async (req: AuthRequest, res) => {
    try {
      const run = await centerlineRepository.updateRun(req.params.id, {
        status: "completed",
        completedAt: new Date(),
        notes: req.body.notes,
      });
      if (!run) {
        return res.status(404).json({ message: "Run not found" });
      }
      res.json(run);
    } catch (error) {
      apiLogger.error({ err: error }, "Error completing run");
      res.status(500).json({ message: "Failed to complete run" });
    }
  });

  // ==================== MEASUREMENT ROUTES ====================

  // Record a measurement
  app.post("/api/centerlining/runs/:runId/measurements", isAuthenticated, loadCurrentUser, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const { parameterId, measuredValue, notes, photoUrl } = req.body;

      // Get the run to find the template
      const run = await centerlineRepository.getRunById(req.params.runId);
      if (!run) {
        return res.status(404).json({ message: "Run not found" });
      }

      // Get parameter to validate against spec
      const parameters = await centerlineRepository.getParametersByTemplate(run.templateId);
      const parameter = parameters.find(p => p.id === parameterId);
      
      if (!parameter) {
        return res.status(404).json({ message: "Parameter not found" });
      }

      // Calculate if in spec
      const numMeasured = parseFloat(measuredValue);
      const numMin = parseFloat(parameter.minValue);
      const numMax = parseFloat(parameter.maxValue);
      const numTarget = parseFloat(parameter.targetValue);
      const isInSpec = !isNaN(numMeasured) && numMeasured >= numMin && numMeasured <= numMax;
      const deviation = !isNaN(numMeasured) && !isNaN(numTarget) 
        ? (numMeasured - numTarget).toFixed(2) 
        : null;

      // Get AI analysis for out-of-spec readings
      let aiAnalysis = null;
      let aiRecommendation = null;
      if (!isInSpec) {
        try {
          const analysis = await analyzeCenterlineReading(
            parameter.name,
            parameter.targetValue,
            parameter.minValue,
            parameter.maxValue,
            measuredValue,
            parameter.unit
          );
          aiAnalysis = analysis.analysis;
          aiRecommendation = analysis.recommendation;
        } catch (err) {
          apiLogger.error({ err }, "AI analysis failed");
        }
      }

      const measurement = await centerlineRepository.createMeasurement({
        runId: req.params.runId,
        parameterId,
        measuredValue,
        isInSpec,
        deviation,
        notes,
        photoUrl,
        aiAnalysis,
        aiRecommendation,
        measuredBy: userId,
      });

      res.status(201).json(measurement);
    } catch (error) {
      apiLogger.error({ err: error }, "Error recording measurement");
      res.status(500).json({ message: "Failed to record measurement" });
    }
  });

  // AI-powered parameter generation
  app.post("/api/centerlining/ai-generate-parameters", isAuthenticated, loadCurrentUser, async (req: AuthRequest, res) => {
    try {
      const { prompt, equipmentName } = req.body;
      
      if (!prompt) {
        return res.status(400).json({ message: "Prompt is required" });
      }

      // Use the existing AI service but request centerline-specific output
      const { generateCilrTasks } = await import("../ai/services/cilrService");
      const suggestions = await generateCilrTasks(prompt, "centerline", equipmentName);
      
      // Transform to parameter format
      const parameters = suggestions.map((s, i) => ({
        name: s.name,
        description: s.description || "",
        targetValue: s.targetValue || "0",
        minValue: s.minValue || "0",
        maxValue: s.maxValue || "0",
        unit: s.unit || "",
        category: "",
        sortOrder: i,
      }));

      res.json({ parameters });
    } catch (error) {
      apiLogger.error({ err: error }, "Error generating parameters with AI");
      res.status(500).json({ message: "Failed to generate parameters" });
    }
  });
}
