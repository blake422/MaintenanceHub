import type { Express } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../customAuth";
import { loadCurrentUser, requireCompany, type AuthRequest } from "../middleware/rowLevelSecurity";
import { handleFileUpload, upload } from "../uploadHandlers";
import { insertWorkOrderSchema, updateWorkOrderSchema, insertWorkOrderTemplateSchema } from "@shared/schema";
import { z } from "zod";
import { apiLogger } from "../logger";

export function registerWorkOrdersRoutes(app: Express): void {
  // Get all work orders
  app.get("/api/work-orders", isAuthenticated, loadCurrentUser, requireCompany, async (req: AuthRequest, res) => {
    try {
      let workOrders;
      if (req.currentUser!.role === "tech") {
        workOrders = await storage.getWorkOrdersByUser(req.user!.claims.sub);
      } else {
        workOrders = await storage.getWorkOrdersByCompany(req.currentUser!.companyId);
      }

      res.json(workOrders);
    } catch (error) {
      apiLogger.error({ err: error }, "Error fetching work orders");
      res.status(500).json({ message: "Failed to fetch work orders" });
    }
  });

  // Create work order
  app.post("/api/work-orders", isAuthenticated, loadCurrentUser, requireCompany, async (req: AuthRequest, res) => {
    try {
      // Build work order data with server-trusted fields based on role
      let workOrderData;

      if (req.currentUser!.role === "tech") {
        // Techs create drafts: force status=draft, auto-assign to self
        workOrderData = insertWorkOrderSchema.parse({
          ...req.body,
          companyId: req.currentUser!.companyId, // Server-controlled
          createdById: req.currentUser!.id,       // Server-controlled
          submittedById: req.currentUser!.id,    // Server-controlled
          assignedToId: req.currentUser!.id,     // Server-controlled: auto-assign to self
          status: "draft",                       // Server-controlled: force draft status
        });
      } else if (req.currentUser!.role === "admin" || req.currentUser!.role === "manager") {
        // Managers/admins create approved WOs directly
        workOrderData = insertWorkOrderSchema.parse({
          ...req.body,
          companyId: req.currentUser!.companyId, // Server-controlled
          createdById: req.currentUser!.id,       // Server-controlled
        });
      } else {
        return res.status(403).json({ message: "Forbidden" });
      }

      const workOrder = await storage.createWorkOrder(workOrderData);
      res.status(201).json(workOrder);
    } catch (error) {
      apiLogger.error({ err: error }, "Error creating work order");
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid request", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create work order" });
    }
  });

  // Get single work order
  app.get("/api/work-orders/:id", isAuthenticated, loadCurrentUser, requireCompany, async (req: AuthRequest, res) => {
    try {
      const workOrderId = req.params.id;
      const workOrder = await storage.getWorkOrder(workOrderId);

      if (!workOrder) {
        return res.status(404).json({ message: "Work order not found" });
      }

      if (workOrder.companyId !== req.currentUser!.companyId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      res.json(workOrder);
    } catch (error) {
      apiLogger.error({ err: error }, "Error fetching work order");
      res.status(500).json({ message: "Failed to fetch work order" });
    }
  });

  // Update work order
  app.patch("/api/work-orders/:id", isAuthenticated, loadCurrentUser, async (req: AuthRequest, res) => {
    try {
      const workOrderId = req.params.id;

      // Validate request body
      const updateData = updateWorkOrderSchema.parse(req.body);

      const existingWorkOrder = await storage.getWorkOrder(workOrderId);
      if (!existingWorkOrder) {
        return res.status(404).json({ message: "Work order not found" });
      }

      // Check company access
      if (existingWorkOrder.companyId !== req.currentUser!.companyId && req.currentUser!.role !== "admin") {
        return res.status(403).json({ message: "Forbidden" });
      }

      // Check permissions
      const canEdit =
        req.currentUser!.role === "admin" ||
        req.currentUser!.role === "manager" ||
        (req.currentUser!.role === "tech" && existingWorkOrder.assignedToId === req.currentUser!.id);

      if (!canEdit) {
        return res.status(403).json({ message: "Forbidden" });
      }

      // SECURITY: Prevent techs from bypassing approval workflow
      if (req.currentUser!.role === "tech") {
        // Techs cannot change approval-related fields or status transitions
        const protectedFields = ["status", "submittedById", "approvedById", "approvedAt"];
        for (const field of protectedFields) {
          if (updateData.hasOwnProperty(field)) {
            return res.status(403).json({
              message: "Forbidden: Cannot modify approval workflow fields. Use submit/approve/reject endpoints."
            });
          }
        }
      }

      const workOrder = await storage.updateWorkOrder(workOrderId, updateData);
      res.json(workOrder);
    } catch (error) {
      apiLogger.error({ err: error }, "Error updating work order");
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid request", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update work order" });
    }
  });

  // Work order photo upload
  app.post("/api/work-orders/:id/photos", isAuthenticated, loadCurrentUser, upload.array("photos", 5), async (req: AuthRequest, res) => {
    try {
      const workOrderId = req.params.id;
      const files = req.files as Express.Multer.File[];

      if (!files || files.length === 0) {
        return res.status(400).json({ message: "No files provided" });
      }

      const workOrder = await storage.getWorkOrder(workOrderId);
      if (!workOrder) {
        return res.status(404).json({ message: "Work order not found" });
      }

      if (workOrder.companyId !== req.currentUser!.companyId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      // Check permissions - only assigned tech, manager, or admin can upload
      const canUpload =
        req.currentUser!.role === "admin" ||
        req.currentUser!.role === "manager" ||
        workOrder.assignedToId === req.currentUser!.id;

      if (!canUpload) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const uploadedUrls: string[] = [];
      for (const file of files) {
        const url = await handleFileUpload(file, "work-orders");
        uploadedUrls.push(url);
      }

      const existingPhotos = workOrder.photoUrls || [];
      const updatedWorkOrder = await storage.updateWorkOrder(workOrderId, {
        photoUrls: [...existingPhotos, ...uploadedUrls],
      });

      res.json(updatedWorkOrder);
    } catch (error) {
      apiLogger.error({ err: error }, "Error uploading work order photos");
      res.status(500).json({ message: "Failed to upload photos" });
    }
  });

  // Work Order Approval Workflow Routes

  // Submit draft for approval (tech only)
  app.post("/api/work-orders/:id/submit", isAuthenticated, loadCurrentUser, async (req: AuthRequest, res) => {
    try {
      const workOrderId = req.params.id;
      const workOrder = await storage.getWorkOrder(workOrderId);

      if (!workOrder) {
        return res.status(404).json({ message: "Work order not found" });
      }

      // Security: verify company access
      if (workOrder.companyId !== req.currentUser!.companyId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      // Security: only draft owner can submit
      if (workOrder.submittedById !== req.currentUser!.id) {
        return res.status(403).json({ message: "Only the creator can submit this work order" });
      }

      // State transition guard: only draft → pending_approval
      if (workOrder.status !== "draft") {
        return res.status(400).json({ message: "Only draft work orders can be submitted for approval" });
      }

      const updated = await storage.updateWorkOrder(workOrderId, {
        status: "pending_approval",
      });

      res.json(updated);
    } catch (error) {
      apiLogger.error({ err: error }, "Error submitting work order");
      res.status(500).json({ message: "Failed to submit work order" });
    }
  });

  // Approve work order (manager/admin only)
  app.post("/api/work-orders/:id/approve", isAuthenticated, loadCurrentUser, async (req: AuthRequest, res) => {
    try {
      const workOrderId = req.params.id;

      // Security: only managers/admins can approve
      if (req.currentUser!.role !== "admin" && req.currentUser!.role !== "manager") {
        return res.status(403).json({ message: "Forbidden" });
      }

      const workOrder = await storage.getWorkOrder(workOrderId);
      if (!workOrder) {
        return res.status(404).json({ message: "Work order not found" });
      }

      // Security: verify company access
      if (workOrder.companyId !== req.currentUser!.companyId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      // State transition guard: only pending_approval → open
      if (workOrder.status !== "pending_approval") {
        return res.status(400).json({ message: "Only pending work orders can be approved" });
      }

      const updated = await storage.updateWorkOrder(workOrderId, {
        status: "open",
        approvedById: req.currentUser!.id,
        approvedAt: new Date(),
      });

      res.json(updated);
    } catch (error) {
      apiLogger.error({ err: error }, "Error approving work order");
      res.status(500).json({ message: "Failed to approve work order" });
    }
  });

  // Reject work order (manager/admin only)
  app.post("/api/work-orders/:id/reject", isAuthenticated, loadCurrentUser, async (req: AuthRequest, res) => {
    try {
      const workOrderId = req.params.id;
      const { reason } = req.body; // Optional rejection reason

      // Security: only managers/admins can reject
      if (req.currentUser!.role !== "admin" && req.currentUser!.role !== "manager") {
        return res.status(403).json({ message: "Forbidden" });
      }

      const workOrder = await storage.getWorkOrder(workOrderId);
      if (!workOrder) {
        return res.status(404).json({ message: "Work order not found" });
      }

      // Security: verify company access
      if (workOrder.companyId !== req.currentUser!.companyId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      // State transition guard: only pending_approval → draft
      if (workOrder.status !== "pending_approval") {
        return res.status(400).json({ message: "Only pending work orders can be rejected" });
      }

      // Append rejection reason to notes if provided
      const updatedNotes = reason
        ? `${workOrder.notes || ""}\n\n[REJECTED by ${req.currentUser!.firstName} ${req.currentUser!.lastName}]: ${reason}`.trim()
        : workOrder.notes;

      const updated = await storage.updateWorkOrder(workOrderId, {
        status: "draft",
        notes: updatedNotes,
      });

      res.json(updated);
    } catch (error) {
      apiLogger.error({ err: error }, "Error rejecting work order");
      res.status(500).json({ message: "Failed to reject work order" });
    }
  });

  // Get pending approval work orders (manager/admin only)
  app.get("/api/work-orders/pending-approval", isAuthenticated, loadCurrentUser, requireCompany, async (req: AuthRequest, res) => {
    try {
      // Security: only managers/admins can view pending approvals
      if (req.currentUser!.role !== "admin" && req.currentUser!.role !== "manager") {
        return res.status(403).json({ message: "Forbidden" });
      }

      const workOrders = await storage.getWorkOrdersByCompany(req.currentUser!.companyId);
      const pending = workOrders.filter(wo => wo.status === "pending_approval");

      res.json(pending);
    } catch (error) {
      apiLogger.error({ err: error }, "Error fetching pending work orders");
      res.status(500).json({ message: "Failed to fetch pending work orders" });
    }
  });

  // AI-powered suggestions for corrective work orders
  app.post("/api/work-orders/:id/ai-suggestions", isAuthenticated, loadCurrentUser, requireCompany, async (req: AuthRequest, res) => {
    try {
      const workOrderId = req.params.id;

      // Fetch the work order
      const workOrder = await storage.getWorkOrder(workOrderId);
      if (!workOrder) {
        return res.status(404).json({ message: "Work order not found" });
      }

      // Verify tenant ownership
      if (workOrder.companyId !== req.currentUser!.companyId) {
        return res.status(404).json({ message: "Work order not found" });
      }

      // Only provide suggestions for corrective work orders
      if (workOrder.type !== "corrective") {
        return res.status(400).json({ message: "AI suggestions are only available for corrective work orders" });
      }

      // Check if there's a description to analyze
      if (!workOrder.description && !workOrder.title) {
        return res.status(400).json({ message: "Work order needs a description for AI analysis" });
      }

      // Get equipment info if available
      let equipmentName: string | undefined;
      let equipmentType: string | undefined;
      if (workOrder.equipmentId) {
        const equipment = await storage.getEquipment(workOrder.equipmentId);
        if (equipment) {
          equipmentName = equipment.name;
          equipmentType = equipment.type || undefined;
        }
      }

      // Generate AI suggestions
      const { getCorrectiveGuidance } = await import("../aiService");
      const description = workOrder.description || workOrder.title;
      const guidance = await getCorrectiveGuidance(description, equipmentName, equipmentType);

      res.json(guidance);
    } catch (error) {
      apiLogger.error({ err: error }, "Error generating AI suggestions");
      res.status(500).json({ message: "Failed to generate AI suggestions" });
    }
  });

  // Work Order Template routes
  app.get("/api/work-order-templates", isAuthenticated, loadCurrentUser, requireCompany, async (req: AuthRequest, res) => {
    try {
      const templates = await storage.getWorkOrderTemplatesByCompany(req.currentUser!.companyId);
      res.json(templates);
    } catch (error) {
      apiLogger.error({ err: error }, "Error fetching work order templates");
      res.status(500).json({ message: "Failed to fetch templates" });
    }
  });

  app.get("/api/work-order-templates/:id", isAuthenticated, loadCurrentUser, requireCompany, async (req: AuthRequest, res) => {
    try {
      const template = await storage.getWorkOrderTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }
      if (template.companyId !== req.currentUser!.companyId) {
        return res.status(403).json({ message: "Forbidden" });
      }
      res.json(template);
    } catch (error) {
      apiLogger.error({ err: error }, "Error fetching template");
      res.status(500).json({ message: "Failed to fetch template" });
    }
  });

  app.post("/api/work-order-templates", isAuthenticated, loadCurrentUser, requireCompany, async (req: AuthRequest, res) => {
    try {
      if (req.currentUser!.role !== "admin" && req.currentUser!.role !== "manager") {
        return res.status(403).json({ message: "Forbidden" });
      }

      const templateData = insertWorkOrderTemplateSchema.parse({
        ...req.body,
        companyId: req.currentUser!.companyId,
        createdById: req.currentUser!.id,
      });

      const template = await storage.createWorkOrderTemplate(templateData);
      res.status(201).json(template);
    } catch (error) {
      apiLogger.error({ err: error }, "Error creating template");
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid request", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create template" });
    }
  });

  app.patch("/api/work-order-templates/:id", isAuthenticated, loadCurrentUser, requireCompany, async (req: AuthRequest, res) => {
    try {
      if (req.currentUser!.role !== "admin" && req.currentUser!.role !== "manager") {
        return res.status(403).json({ message: "Forbidden" });
      }

      const template = await storage.getWorkOrderTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }
      if (template.companyId !== req.currentUser!.companyId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const updatedTemplate = await storage.updateWorkOrderTemplate(req.params.id, req.body);
      res.json(updatedTemplate);
    } catch (error) {
      apiLogger.error({ err: error }, "Error updating template");
      res.status(500).json({ message: "Failed to update template" });
    }
  });

  app.delete("/api/work-order-templates/:id", isAuthenticated, loadCurrentUser, requireCompany, async (req: AuthRequest, res) => {
    try {
      if (req.currentUser!.role !== "admin" && req.currentUser!.role !== "manager") {
        return res.status(403).json({ message: "Forbidden" });
      }

      const template = await storage.getWorkOrderTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }
      if (template.companyId !== req.currentUser!.companyId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      await storage.deleteWorkOrderTemplate(req.params.id);
      res.status(204).send();
    } catch (error) {
      apiLogger.error({ err: error }, "Error deleting template");
      res.status(500).json({ message: "Failed to delete template" });
    }
  });

  // Delete work order
  app.delete("/api/work-orders/:id", isAuthenticated, loadCurrentUser, requireCompany, async (req: AuthRequest, res) => {
    try {
      if (req.currentUser!.role !== "admin" && req.currentUser!.role !== "manager") {
        return res.status(403).json({ message: "Forbidden" });
      }

      const workOrder = await storage.getWorkOrder(req.params.id);
      if (!workOrder) {
        return res.status(404).json({ message: "Work order not found" });
      }
      if (workOrder.companyId !== req.currentUser!.companyId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      await storage.deleteWorkOrder(req.params.id);
      res.json({ message: "Work order deleted successfully" });
    } catch (error) {
      apiLogger.error({ err: error }, "Error deleting work order");
      res.status(500).json({ message: "Failed to delete work order" });
    }
  });

  // Timer routes (for work order time tracking)
  app.post("/api/timer/start", isAuthenticated, loadCurrentUser, requireCompany, async (req: AuthRequest, res) => {
    try {
      const { workOrderId } = req.body;

      if (!workOrderId) {
        return res.status(400).json({ message: "Work order ID is required" });
      }

      const result = await storage.startTimer(
        workOrderId,
        req.user!.claims.sub,
        req.currentUser!.companyId
      );

      res.json(result);
    } catch (error: any) {
      apiLogger.error({ err: error }, "Error starting timer");
      res.status(500).json({ message: error.message || "Failed to start timer" });
    }
  });

  app.post("/api/timer/pause", isAuthenticated, loadCurrentUser, async (req: AuthRequest, res) => {
    try {
      const { workOrderId, breakReason, notes } = req.body;

      if (!workOrderId || !breakReason) {
        return res.status(400).json({ message: "Work order ID and break reason are required" });
      }

      const result = await storage.pauseTimer(
        workOrderId,
        req.user!.claims.sub,
        breakReason,
        notes
      );

      res.json(result);
    } catch (error: any) {
      apiLogger.error({ err: error }, "Error pausing timer");
      res.status(500).json({ message: error.message || "Failed to pause timer" });
    }
  });

  app.post("/api/timer/resume", isAuthenticated, loadCurrentUser, async (req: AuthRequest, res) => {
    try {
      const { workOrderId } = req.body;

      if (!workOrderId) {
        return res.status(400).json({ message: "Work order ID is required" });
      }

      const result = await storage.resumeTimer(
        workOrderId,
        req.user!.claims.sub
      );

      res.json(result);
    } catch (error: any) {
      apiLogger.error({ err: error }, "Error resuming timer");
      res.status(500).json({ message: error.message || "Failed to resume timer" });
    }
  });

  app.post("/api/timer/stop", isAuthenticated, loadCurrentUser, async (req: AuthRequest, res) => {
    try {
      const { workOrderId } = req.body;

      if (!workOrderId) {
        return res.status(400).json({ message: "Work order ID is required" });
      }

      const result = await storage.stopTimer(
        workOrderId,
        req.user!.claims.sub
      );

      res.json(result);
    } catch (error: any) {
      apiLogger.error({ err: error }, "Error stopping timer");
      res.status(500).json({ message: error.message || "Failed to stop timer" });
    }
  });

  app.get("/api/timer/active", isAuthenticated, loadCurrentUser, async (req: AuthRequest, res) => {
    try {
      const activeEntry = await storage.getActiveTimeEntry(req.user!.claims.sub);
      res.json(activeEntry || null);
    } catch (error) {
      apiLogger.error({ err: error }, "Error fetching active timer");
      res.status(500).json({ message: "Failed to fetch active timer" });
    }
  });
}
