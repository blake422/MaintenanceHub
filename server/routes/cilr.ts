import type { Express } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../customAuth";
import { uploadFile } from "../objectStorage";
import { insertCilrTemplateSchema, insertCilrTemplateTaskSchema, insertCilrRunSchema, insertCilrTaskCompletionSchema, insertCilrTaskMediaSchema } from "@shared/schema";
import { z } from "zod";
import multer from "multer";
import { loadCurrentUser, type AuthRequest } from "../middleware/rowLevelSecurity";
import { apiLogger } from "../logger";
import { seedDefaultCilrTemplates } from "../seedCilrDefaults";
import { generateCilrTasks, getCilrTaskGuidance, analyzeCenterlineReading } from "../ai/services/cilrService";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

export function registerCilrRoutes(app: Express): void {
  // ==================== TEMPLATES ====================

  app.get("/api/cilr/templates", isAuthenticated, loadCurrentUser, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const currentUser = await storage.getUser(userId);

      if (!currentUser?.companyId) {
        return res.status(403).json({ message: "No company assigned" });
      }

      const templates = await storage.getCilrTemplatesByCompany(currentUser.companyId);
      res.json(templates);
    } catch (error) {
      apiLogger.error({ err: error }, "Error fetching CILR templates");
      res.status(500).json({ message: "Failed to fetch templates" });
    }
  });

  app.get("/api/cilr/templates/:id", isAuthenticated, loadCurrentUser, async (req: AuthRequest, res) => {
    try {
      const template = await storage.getCilrTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }

      const tasks = await storage.getCilrTemplateTasksByTemplate(template.id);
      res.json({ ...template, tasks });
    } catch (error) {
      apiLogger.error({ err: error }, "Error fetching CILR template");
      res.status(500).json({ message: "Failed to fetch template" });
    }
  });

  app.post("/api/cilr/templates", isAuthenticated, loadCurrentUser, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const currentUser = await storage.getUser(userId);

      if (!currentUser?.companyId) {
        return res.status(403).json({ message: "No company assigned" });
      }

      if (!["admin", "manager"].includes(currentUser.role || "")) {
        return res.status(403).json({ message: "Only admins and managers can create templates" });
      }

      const createSchema = z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        templateType: z.enum(["cilr", "centerline"]).default("cilr"),
        equipmentId: z.string().uuid().optional(),
        frequency: z.string().optional(),
        estimatedMinutes: z.number().optional(),
        tasks: z.array(z.object({
          taskType: z.enum(["clean", "inspect", "lubricate", "repair", "measure", "verify"]).default("inspect"),
          name: z.string().min(1),
          description: z.string().optional(),
          instructions: z.string().optional(),
          targetValue: z.string().optional(),
          minValue: z.string().optional(),
          maxValue: z.string().optional(),
          unit: z.string().optional(),
          photoRequired: z.boolean().default(false),
          sortOrder: z.number().default(0),
        })).optional(),
      });

      const data = createSchema.parse(req.body);
      const { tasks, ...templateData } = data;

      const template = await storage.createCilrTemplate({
        ...templateData,
        companyId: currentUser.companyId,
        createdBy: userId,
      });

      if (tasks && tasks.length > 0) {
        for (const task of tasks) {
          await storage.createCilrTemplateTask({
            ...task,
            templateId: template.id,
          });
        }
      }

      const createdTasks = await storage.getCilrTemplateTasksByTemplate(template.id);
      apiLogger.info({ templateId: template.id, taskCount: createdTasks.length }, "CILR template created");
      res.status(201).json({ ...template, tasks: createdTasks });
    } catch (error) {
      apiLogger.error({ err: error }, "Error creating CILR template");
      res.status(500).json({ message: "Failed to create template" });
    }
  });

  app.patch("/api/cilr/templates/:id", isAuthenticated, loadCurrentUser, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const currentUser = await storage.getUser(userId);

      if (!["admin", "manager"].includes(currentUser?.role || "")) {
        return res.status(403).json({ message: "Only admins and managers can update templates" });
      }

      const template = await storage.getCilrTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }

      if (template.companyId !== currentUser?.companyId) {
        return res.status(403).json({ message: "Not authorized to update this template" });
      }

      const updateSchema = z.object({
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        templateType: z.enum(["cilr", "centerline"]).optional(),
        isActive: z.boolean().optional(),
        frequency: z.string().optional(),
        estimatedMinutes: z.number().optional(),
      });

      const updates = updateSchema.parse(req.body);
      const updatedTemplate = await storage.updateCilrTemplate(req.params.id, updates);

      res.json(updatedTemplate);
    } catch (error) {
      apiLogger.error({ err: error }, "Error updating CILR template");
      res.status(500).json({ message: "Failed to update template" });
    }
  });

  app.delete("/api/cilr/templates/:id", isAuthenticated, loadCurrentUser, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const currentUser = await storage.getUser(userId);

      if (!["admin", "manager"].includes(currentUser?.role || "")) {
        return res.status(403).json({ message: "Only admins and managers can delete templates" });
      }

      const template = await storage.getCilrTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }

      if (template.companyId !== currentUser?.companyId) {
        return res.status(403).json({ message: "Not authorized to delete this template" });
      }

      await storage.deleteCilrTemplate(req.params.id);
      res.status(204).send();
    } catch (error) {
      apiLogger.error({ err: error }, "Error deleting CILR template");
      res.status(500).json({ message: "Failed to delete template" });
    }
  });

  // ==================== TEMPLATE TASKS ====================

  app.post("/api/cilr/templates/:templateId/tasks", isAuthenticated, loadCurrentUser, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const currentUser = await storage.getUser(userId);

      if (!["admin", "manager"].includes(currentUser?.role || "")) {
        return res.status(403).json({ message: "Only admins and managers can add tasks" });
      }

      const template = await storage.getCilrTemplate(req.params.templateId);
      if (!template || template.companyId !== currentUser?.companyId) {
        return res.status(404).json({ message: "Template not found" });
      }

      const taskSchema = z.object({
        name: z.string().min(1),
        taskType: z.enum(["clean", "inspect", "lubricate", "repair", "measure", "verify"]).default("inspect"),
        description: z.string().optional(),
        instructions: z.string().optional(),
        photoRequired: z.boolean().default(false),
        sortOrder: z.number().default(0),
        targetValue: z.string().optional(),
        minValue: z.string().optional(),
        maxValue: z.string().optional(),
        unit: z.string().optional(),
      });

      const data = taskSchema.parse(req.body);

      const task = await storage.createCilrTemplateTask({
        ...data,
        templateId: template.id,
      });

      res.status(201).json(task);
    } catch (error) {
      apiLogger.error({ err: error }, "Error creating CILR template task");
      res.status(500).json({ message: "Failed to create task" });
    }
  });

  // Simple task creation endpoint (accepts templateId in body)
  app.post("/api/cilr/tasks", isAuthenticated, loadCurrentUser, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const currentUser = await storage.getUser(userId);

      if (!["admin", "manager"].includes(currentUser?.role || "")) {
        return res.status(403).json({ message: "Only admins and managers can add tasks" });
      }

      const taskSchema = z.object({
        templateId: z.string().uuid(),
        name: z.string().min(1),
        taskType: z.enum(["clean", "inspect", "lubricate", "repair", "measure", "verify"]).default("inspect"),
        description: z.string().optional(),
        instructions: z.string().optional(),
        photoRequired: z.boolean().default(false),
        sortOrder: z.number().default(0),
        targetValue: z.string().optional(),
        minValue: z.string().optional(),
        maxValue: z.string().optional(),
        unit: z.string().optional(),
      });

      const data = taskSchema.parse(req.body);

      const template = await storage.getCilrTemplate(data.templateId);
      if (!template || template.companyId !== currentUser?.companyId) {
        return res.status(404).json({ message: "Template not found" });
      }

      const task = await storage.createCilrTemplateTask(data);

      res.status(201).json(task);
    } catch (error) {
      apiLogger.error({ err: error }, "Error creating CILR task");
      res.status(500).json({ message: "Failed to create task" });
    }
  });

  app.patch("/api/cilr/tasks/:id", isAuthenticated, loadCurrentUser, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const currentUser = await storage.getUser(userId);

      if (!["admin", "manager"].includes(currentUser?.role || "")) {
        return res.status(403).json({ message: "Only admins and managers can update tasks" });
      }

      const updateSchema = z.object({
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        instructions: z.string().optional(),
        taskType: z.enum(["clean", "inspect", "lubricate", "repair", "measure", "verify"]).optional(),
        targetValue: z.string().optional(),
        minValue: z.string().optional(),
        maxValue: z.string().optional(),
        unit: z.string().optional(),
        photoRequired: z.boolean().optional(),
        sortOrder: z.number().optional(),
      });

      const updates = updateSchema.parse(req.body);
      const task = await storage.updateCilrTemplateTask(req.params.id, updates);

      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }

      res.json(task);
    } catch (error) {
      apiLogger.error({ err: error }, "Error updating CILR task");
      res.status(500).json({ message: "Failed to update task" });
    }
  });

  app.delete("/api/cilr/tasks/:id", isAuthenticated, loadCurrentUser, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const currentUser = await storage.getUser(userId);

      if (!["admin", "manager"].includes(currentUser?.role || "")) {
        return res.status(403).json({ message: "Only admins and managers can delete tasks" });
      }

      await storage.deleteCilrTemplateTask(req.params.id);
      res.status(204).send();
    } catch (error) {
      apiLogger.error({ err: error }, "Error deleting CILR task");
      res.status(500).json({ message: "Failed to delete task" });
    }
  });

  // ==================== RUNS ====================

  app.get("/api/cilr/runs", isAuthenticated, loadCurrentUser, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const currentUser = await storage.getUser(userId);

      if (!currentUser?.companyId) {
        return res.status(403).json({ message: "No company assigned" });
      }

      const { status, equipmentId, userId: filterUserId } = req.query;
      let runs = await storage.getCilrRunsByCompany(currentUser.companyId);

      if (status) {
        runs = runs.filter(r => r.status === status);
      }
      if (equipmentId) {
        runs = runs.filter(r => r.equipmentId === equipmentId);
      }
      if (filterUserId) {
        runs = runs.filter(r => r.assignedTo === filterUserId);
      }

      res.json(runs);
    } catch (error) {
      apiLogger.error({ err: error }, "Error fetching CILR runs");
      res.status(500).json({ message: "Failed to fetch runs" });
    }
  });

  app.get("/api/cilr/runs/my", isAuthenticated, loadCurrentUser, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const runs = await storage.getCilrRunsByUser(userId);
      res.json(runs);
    } catch (error) {
      apiLogger.error({ err: error }, "Error fetching my CILR runs");
      res.status(500).json({ message: "Failed to fetch runs" });
    }
  });

  app.get("/api/cilr/runs/:id", isAuthenticated, loadCurrentUser, async (req: AuthRequest, res) => {
    try {
      const runDetails = await storage.getCilrRunDetails(req.params.id);
      if (!runDetails) {
        return res.status(404).json({ message: "Run not found" });
      }

      res.json({
        ...runDetails.run,
        template: runDetails.template,
        tasks: runDetails.tasks,
        completions: runDetails.completions,
      });
    } catch (error) {
      apiLogger.error({ err: error }, "Error fetching CILR run");
      res.status(500).json({ message: "Failed to fetch run" });
    }
  });

  app.post("/api/cilr/runs", isAuthenticated, loadCurrentUser, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const currentUser = await storage.getUser(userId);

      if (!currentUser?.companyId) {
        return res.status(403).json({ message: "No company assigned" });
      }

      const createSchema = z.object({
        templateId: z.string().uuid(),
        equipmentId: z.string().uuid().optional(),
        notes: z.string().optional(),
      });

      const data = createSchema.parse(req.body);
      const template = await storage.getCilrTemplate(data.templateId);

      if (!template || template.companyId !== currentUser.companyId) {
        return res.status(404).json({ message: "Template not found" });
      }

      if (!template.isActive) {
        return res.status(400).json({ message: "Template is not active" });
      }

      const run = await storage.createCilrRun({
        templateId: data.templateId,
        equipmentId: data.equipmentId || template.equipmentId,
        companyId: currentUser.companyId,
        assignedTo: userId,
        startedAt: new Date(),
        status: "in_progress",
        notes: data.notes,
      });

      apiLogger.info({ runId: run.id, templateId: template.id }, "CILR run started");
      res.status(201).json(run);
    } catch (error) {
      apiLogger.error({ err: error }, "Error creating CILR run");
      res.status(500).json({ message: "Failed to start run" });
    }
  });

  app.patch("/api/cilr/runs/:id", isAuthenticated, loadCurrentUser, async (req: AuthRequest, res) => {
    try {
      const run = await storage.getCilrRun(req.params.id);
      if (!run) {
        return res.status(404).json({ message: "Run not found" });
      }

      const updateSchema = z.object({
        notes: z.string().optional(),
        status: z.enum(["in_progress", "completed", "cancelled"]).optional(),
      });

      const updates = updateSchema.parse(req.body);
      const updatedRun = await storage.updateCilrRun(req.params.id, updates);

      res.json(updatedRun);
    } catch (error) {
      apiLogger.error({ err: error }, "Error updating CILR run");
      res.status(500).json({ message: "Failed to update run" });
    }
  });

  app.post("/api/cilr/runs/:id/complete", isAuthenticated, loadCurrentUser, async (req: AuthRequest, res) => {
    try {
      const run = await storage.getCilrRun(req.params.id);
      if (!run) {
        return res.status(404).json({ message: "Run not found" });
      }

      if (run.status !== "in_progress") {
        return res.status(400).json({ message: "Run is not in progress" });
      }

      const template = await storage.getCilrTemplate(run.templateId);
      const tasks = template ? await storage.getCilrTemplateTasksByTemplate(template.id) : [];
      const completions = await storage.getCilrTaskCompletionsByRun(run.id);

      const requiredPhotoTasks = tasks.filter(t => t.photoRequired);
      const allMedia = await storage.getCilrTaskMediaByRun(run.id);

      for (const task of requiredPhotoTasks) {
        const completion = completions.find(c => c.taskId === task.id);
        if (!completion) {
          return res.status(400).json({ message: `Required task "${task.name}" not completed` });
        }
        const hasPhoto = allMedia.some(m => m.completionId === completion.id);
        if (!hasPhoto) {
          return res.status(400).json({ message: `Required photo missing for task "${task.name}"` });
        }
      }

      const completedRun = await storage.completeCilrRun(req.params.id);
      apiLogger.info({ runId: run.id }, "CILR run completed");
      res.json(completedRun);
    } catch (error) {
      apiLogger.error({ err: error }, "Error completing CILR run");
      res.status(500).json({ message: "Failed to complete run" });
    }
  });

  // ==================== TASK COMPLETIONS ====================

  app.post("/api/cilr/runs/:runId/completions", isAuthenticated, loadCurrentUser, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const run = await storage.getCilrRun(req.params.runId);

      if (!run) {
        return res.status(404).json({ message: "Run not found" });
      }

      if (run.status !== "in_progress") {
        return res.status(400).json({ message: "Run is not in progress" });
      }

      const completionSchema = z.object({
        taskId: z.string().uuid(),
        isCompleted: z.boolean().default(true),
        measuredValue: z.string().optional(),
        notes: z.string().optional(),
      });

      const data = completionSchema.parse(req.body);

      const completion = await storage.createOrUpdateCilrTaskCompletion({
        runId: run.id,
        taskId: data.taskId,
        completedBy: userId,
        completedAt: new Date(),
        isCompleted: data.isCompleted,
        measuredValue: data.measuredValue,
        notes: data.notes,
      });

      res.status(201).json(completion);
    } catch (error) {
      apiLogger.error({ err: error }, "Error creating task completion");
      res.status(500).json({ message: "Failed to save completion" });
    }
  });

  // ==================== MEDIA / PHOTO UPLOADS ====================

  app.post("/api/cilr/completions/:completionId/media", isAuthenticated, loadCurrentUser, upload.single("file"), async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const completion = await storage.getCilrTaskCompletion(req.params.completionId);

      if (!completion) {
        return res.status(404).json({ message: "Completion not found" });
      }

      const file = req.file;
      if (!file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const run = await storage.getCilrRun(completion.runId);
      if (!run || run.status !== "in_progress") {
        return res.status(400).json({ message: "Run is not in progress" });
      }

      const fileName = `cilr/${run.companyId}/${run.id}/${completion.id}/${Date.now()}_${file.originalname}`;
      const publicUrl = await uploadFile(file.buffer, fileName, file.mimetype);

      const media = await storage.createCilrTaskMedia({
        completionId: completion.id,
        runId: run.id,
        mediaType: file.mimetype.startsWith("image/") ? "image" : "document",
        fileName: file.originalname,
        mediaUrl: publicUrl,
        fileSize: file.size,
        uploadedBy: userId,
      });

      apiLogger.info({ mediaId: media.id, completionId: completion.id }, "CILR media uploaded");
      res.status(201).json(media);
    } catch (error) {
      apiLogger.error({ err: error }, "Error uploading CILR media");
      res.status(500).json({ message: "Failed to upload media" });
    }
  });

  app.delete("/api/cilr/media/:id", isAuthenticated, loadCurrentUser, async (req: AuthRequest, res) => {
    try {
      await storage.deleteCilrTaskMedia(req.params.id);
      res.status(204).send();
    } catch (error) {
      apiLogger.error({ err: error }, "Error deleting CILR media");
      res.status(500).json({ message: "Failed to delete media" });
    }
  });

  // ==================== SEED DEFAULT TEMPLATES ====================

  app.post("/api/cilr/seed-defaults", isAuthenticated, loadCurrentUser, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const currentUser = await storage.getUser(userId);

      if (!currentUser?.companyId) {
        return res.status(403).json({ message: "No company assigned" });
      }

      if (!["admin", "manager"].includes(currentUser.role || "")) {
        return res.status(403).json({ message: "Only admins and managers can seed templates" });
      }

      await seedDefaultCilrTemplates(currentUser.companyId, userId);
      
      const templates = await storage.getCilrTemplatesByCompany(currentUser.companyId);
      apiLogger.info({ companyId: currentUser.companyId }, "Seeded default CILR templates");
      res.json({ message: "Default templates created", templates });
    } catch (error) {
      apiLogger.error({ err: error }, "Error seeding CILR templates");
      res.status(500).json({ message: "Failed to seed templates" });
    }
  });

  // ==================== QA EXPORT ====================

  app.get("/api/cilr/export", isAuthenticated, loadCurrentUser, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const currentUser = await storage.getUser(userId);

      if (!currentUser?.companyId) {
        return res.status(403).json({ message: "No company assigned" });
      }

      if (!["admin", "manager"].includes(currentUser.role || "")) {
        return res.status(403).json({ message: "Only admins and managers can export records" });
      }

      const { startDate, endDate, equipmentId, templateId, format } = req.query;

      let runs = await storage.getCilrRunsByCompany(currentUser.companyId);
      runs = runs.filter(r => r.status === "completed");

      if (startDate) {
        runs = runs.filter(r => r.completedAt && new Date(r.completedAt) >= new Date(startDate as string));
      }
      if (endDate) {
        runs = runs.filter(r => r.completedAt && new Date(r.completedAt) <= new Date(endDate as string));
      }
      if (equipmentId) {
        runs = runs.filter(r => r.equipmentId === equipmentId);
      }
      if (templateId) {
        runs = runs.filter(r => r.templateId === templateId);
      }

      const exportData = await Promise.all(runs.map(async (run) => {
        const template = await storage.getCilrTemplate(run.templateId);
        const equipment = run.equipmentId ? await storage.getEquipment(run.equipmentId) : null;
        const completions = await storage.getCilrTaskCompletionsByRun(run.id);
        const allMedia = await storage.getCilrTaskMediaByRun(run.id);
        const assignedUser = run.assignedTo ? await storage.getUser(run.assignedTo) : null;

        return {
          runId: run.id,
          templateName: template?.name,
          templateType: template?.templateType,
          equipmentName: equipment?.name,
          equipmentCode: equipment?.assetNumber,
          completedBy: assignedUser?.email,
          startedAt: run.startedAt,
          completedAt: run.completedAt,
          notes: run.notes,
          completions: await Promise.all(completions.map(async (c) => {
            const task = await storage.getCilrTemplateTask(c.taskId);
            const media = allMedia.filter(m => m.completionId === c.id);
            return {
              taskName: task?.name,
              taskType: task?.taskType,
              targetValue: task?.targetValue,
              measuredValue: c.measuredValue,
              minValue: task?.minValue,
              maxValue: task?.maxValue,
              isCompleted: c.isCompleted,
              isInSpec: c.isInSpec,
              notes: c.notes,
              completedAt: c.completedAt,
              photos: media.map(m => ({
                fileName: m.fileName,
                url: m.mediaUrl,
                uploadedAt: m.uploadedAt,
              })),
            };
          })),
        };
      }));

      if (format === "csv") {
        const csvRows = ["Run ID,Template,Type,Equipment,Completed By,Started,Completed,Task,Task Type,Target,Measured,Min,Max,In Spec,Completed,Notes,Photo URLs"];
        for (const run of exportData) {
          for (const c of run.completions) {
            csvRows.push([
              run.runId,
              run.templateName,
              run.templateType,
              run.equipmentName,
              run.completedBy,
              run.startedAt,
              run.completedAt,
              c.taskName,
              c.taskType,
              c.targetValue,
              c.measuredValue,
              c.minValue,
              c.maxValue,
              c.isInSpec,
              c.isCompleted,
              c.notes,
              c.photos.map(p => p.url).join("; "),
            ].map(v => `"${(v || "").toString().replace(/"/g, '""')}"`).join(","));
          }
        }
        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", `attachment; filename="cilr-export-${Date.now()}.csv"`);
        return res.send(csvRows.join("\n"));
      }

      res.json(exportData);
    } catch (error) {
      apiLogger.error({ err: error }, "Error exporting CILR records");
      res.status(500).json({ message: "Failed to export records" });
    }
  });

  // ==================== AI GUIDANCE ====================

  app.post("/api/cilr/ai-guidance", isAuthenticated, loadCurrentUser, async (req: AuthRequest, res) => {
    try {
      const { taskType, taskName, description, instructions, equipmentName } = req.body;

      try {
        const guidance = await getCilrTaskGuidance(
          taskType || "inspect",
          taskName || "Task",
          description,
          instructions,
          equipmentName
        );
        res.json(guidance);
      } catch (aiError) {
        apiLogger.warn({ err: aiError }, "AI guidance failed, using fallback");
        const fallbackGuidance = {
          suggestion: `For ${taskType || "this"} task "${taskName}", follow standard procedures and safety guidelines.`,
          safetyTips: [
            "Wear appropriate PPE",
            "Ensure equipment is safe to work on",
            "Follow lockout/tagout procedures when required",
            "Report any hazards immediately"
          ],
          commonIssues: [
            "Missing or incomplete documentation",
            "Equipment not properly prepared"
          ],
          bestPractices: [
            "Document all findings with photos",
            "Follow manufacturer specifications",
            "Complete all required steps before moving on",
            "Ask for help if unsure"
          ]
        };
        res.json(fallbackGuidance);
      }
    } catch (error) {
      apiLogger.error({ err: error }, "Error getting AI guidance");
      res.status(500).json({ message: "Failed to get guidance" });
    }
  });

  // ==================== AI TASK GENERATION ====================

  app.post("/api/cilr/ai-generate-tasks", isAuthenticated, loadCurrentUser, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const currentUser = await storage.getUser(userId);

      if (!["admin", "manager"].includes(currentUser?.role || "")) {
        return res.status(403).json({ message: "Only admins and managers can generate tasks" });
      }

      const schema = z.object({
        prompt: z.string().min(5, "Please provide a more detailed description"),
        templateType: z.enum(["cilr", "centerline"]).default("cilr"),
        equipmentContext: z.string().optional(),
      });

      const { prompt, templateType, equipmentContext } = schema.parse(req.body);

      try {
        const tasks = await generateCilrTasks(prompt, templateType, equipmentContext);
        apiLogger.info({ taskCount: tasks.length, templateType }, "AI generated CILR tasks");
        res.json({ tasks });
      } catch (aiError) {
        apiLogger.error({ err: aiError }, "AI task generation failed");
        res.status(500).json({ message: "AI task generation temporarily unavailable. Please try again or create tasks manually." });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      apiLogger.error({ err: error }, "Error generating AI tasks");
      res.status(500).json({ message: "Failed to generate tasks" });
    }
  });

  // ==================== CENTERLINE ANALYSIS ====================

  app.post("/api/cilr/analyze-reading", isAuthenticated, loadCurrentUser, async (req: AuthRequest, res) => {
    try {
      const schema = z.object({
        taskName: z.string(),
        targetValue: z.string(),
        minValue: z.string(),
        maxValue: z.string(),
        measuredValue: z.string(),
        unit: z.string().default(""),
      });

      const data = schema.parse(req.body);
      const analysis = await analyzeCenterlineReading(
        data.taskName,
        data.targetValue,
        data.minValue,
        data.maxValue,
        data.measuredValue,
        data.unit
      );

      res.json(analysis);
    } catch (error) {
      apiLogger.error({ err: error }, "Error analyzing centerline reading");
      res.status(500).json({ message: "Failed to analyze reading" });
    }
  });
}
