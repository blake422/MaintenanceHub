import type { Express } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../customAuth";
import { uploadFile } from "../objectStorage";
import * as aiService from "../aiService";
import { insertTrainingProgressSchema } from "@shared/schema";
import { z } from "zod";
import { jsPDF } from "jspdf";
import { seedTrainingModules } from "../seedTraining";
import { loadCurrentUser, type AuthRequest } from "../middleware/rowLevelSecurity";
import { apiLogger, aiLogger } from "../logger";

export function registerTrainingRoutes(app: Express): void {
  // Get all training modules for company
  app.get("/api/training/modules", isAuthenticated, loadCurrentUser, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const currentUser = await storage.getUser(userId);

      if (!currentUser?.companyId) {
        return res.status(403).json({ message: "No company assigned" });
      }

      let modules = await storage.getTrainingModulesByCompany(currentUser.companyId);

      // Auto-seed training modules if none exist for this company
      if (modules.length === 0) {
        apiLogger.info({ companyId: currentUser.companyId }, "No training modules found, auto-seeding");
        const result = await seedTrainingModules(currentUser.companyId);
        modules = result.modules;
      }

      res.json(modules);
    } catch (error) {
      apiLogger.error({ err: error }, "Error fetching training modules");
      res.status(500).json({ message: "Failed to fetch training modules" });
    }
  });

  // Get a specific training module
  app.get("/api/training/modules/:id", isAuthenticated, loadCurrentUser, async (req: AuthRequest, res) => {
    try {
      const moduleId = req.params.id;
      const module = await storage.getTrainingModule(moduleId);

      if (!module) {
        return res.status(404).json({ message: "Module not found" });
      }

      res.json(module);
    } catch (error) {
      apiLogger.error({ err: error }, "Error fetching training module");
      res.status(500).json({ message: "Failed to fetch training module" });
    }
  });

  // Update a training module (admin/manager only)
  app.patch("/api/training/modules/:id", isAuthenticated, loadCurrentUser, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const currentUser = await storage.getUser(userId);

      if (!currentUser?.companyId) {
        return res.status(403).json({ message: "No company assigned" });
      }

      const isPlatformAdmin = currentUser.platformRole === "platform_admin";
      if (!isPlatformAdmin && !["admin", "manager"].includes(currentUser.role || "")) {
        return res.status(403).json({ message: "Only admins and managers can update training modules" });
      }

      const moduleId = req.params.id;
      const module = await storage.getTrainingModule(moduleId);

      if (!module) {
        return res.status(404).json({ message: "Module not found" });
      }

      if (module.companyId !== currentUser.companyId && !isPlatformAdmin) {
        return res.status(403).json({ message: "Not authorized to update this module" });
      }

      const updateSchema = z.object({
        title: z.string().optional(),
        description: z.string().nullable().optional(),
        content: z.string().nullable().optional(),
        durationMinutes: z.number().nullable().optional(),
        passingScore: z.number().nullable().optional(),
        points: z.number().nullable().optional(),
        coverImage: z.string().nullable().optional(),
        videoUrl: z.string().nullable().optional(),
        videoProvider: z.enum(["youtube", "vimeo", "direct"]).nullable().optional(),
        videoDurationSeconds: z.number().nullable().optional(),
        videoThumbnail: z.string().nullable().optional(),
      });

      const updates = updateSchema.parse(req.body);

      const updatedModule = await storage.updateTrainingModule(moduleId, updates);

      apiLogger.info({ moduleId, updates: Object.keys(updates) }, "Training module updated");
      res.json(updatedModule);
    } catch (error) {
      apiLogger.error({ err: error }, "Error updating training module");
      res.status(500).json({ message: "Failed to update training module" });
    }
  });

  // Get training progress for user
  app.get("/api/training/progress", isAuthenticated, loadCurrentUser, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const progress = await storage.getTrainingProgressByUser(userId);
      res.json(progress);
    } catch (error) {
      apiLogger.error({ err: error }, "Error fetching training progress");
      res.status(500).json({ message: "Failed to fetch training progress" });
    }
  });

  // Save training progress
  app.post("/api/training/progress", isAuthenticated, loadCurrentUser, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;

      const progressData = insertTrainingProgressSchema.parse({
        ...req.body,
        userId,
      });

      const progress = await storage.createOrUpdateTrainingProgress(progressData);

      // Generate certificate if module is completed with passing score
      if (progressData.completed && progressData.score && progressData.score >= 70) {
        try {
          const user = await storage.getUser(userId);
          const module = await storage.getTrainingModule(progressData.moduleId);

          if (user && module) {
            // Generate certificate PDF
            const doc = new jsPDF({
              orientation: 'landscape',
              unit: 'mm',
              format: 'a4'
            });

            // Certificate design
            doc.setFontSize(40);
            doc.setFont('times', 'bold');
            doc.text('C4 University', 148.5, 40, { align: 'center' });

            doc.setFontSize(20);
            doc.setFont('times', 'normal');
            doc.text('Certificate of Completion', 148.5, 60, { align: 'center' });

            doc.setFontSize(14);
            doc.text('This is to certify that', 148.5, 80, { align: 'center' });

            doc.setFontSize(24);
            doc.setFont('times', 'bold');
            const userName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email;
            doc.text(userName, 148.5, 100, { align: 'center' });

            doc.setFontSize(14);
            doc.setFont('times', 'normal');
            doc.text('has successfully completed', 148.5, 115, { align: 'center' });

            doc.setFontSize(18);
            doc.setFont('times', 'bold');
            doc.text(module.title, 148.5, 130, { align: 'center' });

            doc.setFontSize(12);
            doc.setFont('times', 'normal');
            const completionDate = new Date().toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            });
            doc.text(`Completed on ${completionDate}`, 148.5, 145, { align: 'center' });
            doc.text(`Score: ${progressData.score}%`, 148.5, 155, { align: 'center' });

            // Generate PDF buffer
            const pdfBuffer = Buffer.from(doc.output('arraybuffer'));

            // Upload to object storage
            const bucketName = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
            if (!bucketName) {
              throw new Error('Object storage not configured');
            }
            const fileName = `training/certificate-${userId}-${progressData.moduleId}-${Date.now()}.pdf`;
            const pdfUrl = await uploadFile(bucketName, fileName, pdfBuffer, 'application/pdf');

            // Save certification record
            await storage.createCertification({
              userId,
              name: `${module.title} - C4 University`,
              description: `Completed with ${progressData.score}% score`,
              pdfUrl,
            });

            apiLogger.info({ userId, moduleTitle: module.title }, "Certificate generated");
          }
        } catch (certError) {
          apiLogger.error({ err: certError }, "Error generating certificate");
          // Don't fail the progress save if certificate generation fails
        }
      }

      res.status(201).json(progress);
    } catch (error) {
      apiLogger.error({ err: error }, "Error saving training progress");
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid request", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to save training progress" });
    }
  });

  // Generate AI downtime scenario for training
  app.post("/api/training/generate-scenario", isAuthenticated, loadCurrentUser, async (req: AuthRequest, res) => {
    try {
      const { moduleTitle, moduleTopic } = req.body;

      if (!moduleTitle || !moduleTopic) {
        return res.status(400).json({ message: "Module title and topic required" });
      }

      const scenario = await aiService.generateDowntimeScenario(moduleTitle, moduleTopic);
      res.json(scenario);
    } catch (error) {
      aiLogger.error({ err: error }, "Error generating scenario");
      res.status(500).json({ message: "Failed to generate scenario" });
    }
  });

  // Generate AI quiz questions for training
  app.post("/api/training/generate-quiz", isAuthenticated, loadCurrentUser, async (req: AuthRequest, res) => {
    try {
      const { moduleTitle, moduleTopic, count = 5 } = req.body;

      if (!moduleTitle || !moduleTopic) {
        return res.status(400).json({ message: "Module title and topic required" });
      }

      const questions = await aiService.generateQuizQuestions(moduleTitle, moduleTopic, count);
      res.json(questions);
    } catch (error) {
      aiLogger.error({ err: error }, "Error generating quiz questions");
      res.status(500).json({ message: "Failed to generate quiz questions" });
    }
  });

  // Generate AI case study for training
  app.post("/api/training/generate-case-study", isAuthenticated, loadCurrentUser, async (req: AuthRequest, res) => {
    try {
      const { topic, difficultyLevel = "intermediate" } = req.body;

      if (!topic) {
        return res.status(400).json({ message: "Topic required" });
      }

      const caseStudy = await aiService.generateTrainingCaseStudy(topic, difficultyLevel);
      res.json(caseStudy);
    } catch (error) {
      aiLogger.error({ err: error }, "Error generating case study");
      res.status(500).json({ message: "Failed to generate case study" });
    }
  });

  // Seed training modules (admin only)
  app.post("/api/admin/seed-training", isAuthenticated, loadCurrentUser, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const currentUser = await storage.getUser(userId);

      if (currentUser?.role !== "admin" || !currentUser.companyId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const result = await seedTrainingModules(currentUser.companyId);

      res.json({
        success: true,
        modulesCreated: result.modules.length,
        schematicsCreated: result.schematics.length
      });
    } catch (error) {
      apiLogger.error({ err: error }, "Error seeding training");
      res.status(500).json({ message: "Failed to seed training modules" });
    }
  });

  // Badge routes
  app.get("/api/badges", isAuthenticated, loadCurrentUser, async (req: AuthRequest, res) => {
    try {
      const badges = await storage.getAllBadges();
      res.json(badges);
    } catch (error) {
      apiLogger.error({ err: error }, "Error fetching badges");
      res.status(500).json({ message: "Failed to fetch badges" });
    }
  });

  app.get("/api/badges/user", isAuthenticated, loadCurrentUser, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const userBadges = await storage.getUserBadges(userId);
      res.json(userBadges);
    } catch (error) {
      apiLogger.error({ err: error }, "Error fetching user badges");
      res.status(500).json({ message: "Failed to fetch user badges" });
    }
  });

  // Certifications routes
  app.get("/api/certifications", isAuthenticated, loadCurrentUser, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const certifications = await storage.getUserCertifications(userId);
      res.json(certifications);
    } catch (error) {
      apiLogger.error({ err: error }, "Error fetching certifications");
      res.status(500).json({ message: "Failed to fetch certifications" });
    }
  });
}
