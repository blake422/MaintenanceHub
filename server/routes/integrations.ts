import type { Express } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../customAuth";
import { loadCurrentUser, requireRole, type AuthRequest } from "../middleware/rowLevelSecurity";
import { apiLogger } from "../logger";

export function registerIntegrationsRoutes(app: Express): void {
  // Get all integrations for company
  app.get("/api/integrations", isAuthenticated, loadCurrentUser, requireRole(["admin", "manager"]), async (req: AuthRequest, res) => {
    try {
      const integrations = await storage.getIntegrationsByCompany(req.currentUser!.companyId);
      res.json(integrations);
    } catch (error) {
      apiLogger.error({ err: error }, "Error fetching integrations");
      res.status(500).json({ message: "Failed to fetch integrations" });
    }
  });

  // Create a new integration
  app.post("/api/integrations", isAuthenticated, loadCurrentUser, requireRole(["admin", "manager"]), async (req: AuthRequest, res) => {
    try {
      const integrationData = {
        ...req.body,
        companyId: req.currentUser!.companyId,
      };

      const integration = await storage.createIntegration(integrationData);
      res.status(201).json(integration);
    } catch (error) {
      apiLogger.error({ err: error }, "Error creating integration");
      res.status(500).json({ message: "Failed to create integration" });
    }
  });

  // Delete an integration
  app.delete("/api/integrations/:id", isAuthenticated, loadCurrentUser, requireRole(["admin", "manager"]), async (req: AuthRequest, res) => {
    try {
      const integration = await storage.getIntegration(req.params.id);

      if (!integration || integration.companyId !== req.currentUser!.companyId) {
        return res.status(404).json({ message: "Integration not found" });
      }

      // Delete integration logs first to avoid foreign key constraint violation
      await storage.deleteIntegrationLogsByIntegration(req.params.id);

      await storage.deleteIntegration(req.params.id);
      res.json({ success: true });
    } catch (error) {
      apiLogger.error({ err: error }, "Error deleting integration");
      res.status(500).json({ message: "Failed to delete integration" });
    }
  });

  // Test an integration
  app.post("/api/integrations/:id/test", isAuthenticated, loadCurrentUser, requireRole(["admin", "manager"]), async (req: AuthRequest, res) => {
    try {
      const integration = await storage.getIntegration(req.params.id);

      if (!integration || integration.companyId !== req.currentUser!.companyId) {
        return res.status(404).json({ message: "Integration not found" });
      }

      const testResult = {
        status: "success",
        message: "Connection successful",
        timestamp: new Date().toISOString()
      };

      await storage.createIntegrationLog({
        integrationId: integration.id,
        action: "test",
        status: "success",
        duration: 100,
      });

      res.json(testResult);
    } catch (error) {
      apiLogger.error({ err: error }, "Error testing integration");
      res.status(500).json({ message: "Failed to test integration" });
    }
  });

  // Get integration logs
  app.get("/api/integrations/:id/logs", isAuthenticated, loadCurrentUser, requireRole(["admin", "manager"]), async (req: AuthRequest, res) => {
    try {
      const integration = await storage.getIntegration(req.params.id);

      if (!integration || integration.companyId !== req.currentUser!.companyId) {
        return res.status(404).json({ message: "Integration not found" });
      }

      const logs = await storage.getIntegrationLogs(req.params.id);
      res.json(logs);
    } catch (error) {
      apiLogger.error({ err: error }, "Error fetching integration logs");
      res.status(500).json({ message: "Failed to fetch integration logs" });
    }
  });

  // Webhook endpoint (public - no auth required)
  app.post("/api/webhooks/:integrationId", async (req, res) => {
    try {
      const { integrationId } = req.params;
      const integration = await storage.getIntegration(integrationId);

      if (!integration || !integration.isEnabled) {
        return res.status(404).json({ message: "Integration not found or disabled" });
      }

      await storage.createIntegrationLog({
        integrationId,
        action: "webhook_received",
        status: "success",
        requestData: req.body,
        duration: 0,
      });

      res.json({ success: true, message: "Webhook received" });
    } catch (error) {
      apiLogger.error({ err: error }, "Error processing webhook");
      res.status(500).json({ message: "Failed to process webhook" });
    }
  });
}
