import type { Express } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../customAuth";
import { loadCurrentUser, type AuthRequest } from "../middleware/rowLevelSecurity";
import { apiLogger } from "../logger";

export function registerSchematicsRoutes(app: Express): void {
  // Get all schematics for company
  app.get("/api/schematics", isAuthenticated, loadCurrentUser, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const currentUser = await storage.getUser(userId);

      if (!currentUser?.companyId) {
        return res.status(403).json({ message: "No company assigned" });
      }

      const schematics = await storage.getSchematicsByCompany(currentUser.companyId);
      res.json(schematics);
    } catch (error) {
      apiLogger.error({ err: error }, "Error fetching schematics");
      res.status(500).json({ message: "Failed to fetch schematics" });
    }
  });

  // Get schematic progress for user
  app.get("/api/schematics/progress", isAuthenticated, loadCurrentUser, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const progress = await storage.getSchematicProgress(userId);
      res.json(progress);
    } catch (error) {
      apiLogger.error({ err: error }, "Error fetching schematic progress");
      res.status(500).json({ message: "Failed to fetch schematic progress" });
    }
  });

  // Save schematic progress
  app.post("/api/schematics/progress", isAuthenticated, loadCurrentUser, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const progressData = {
        ...req.body,
        userId,
      };

      const progress = await storage.createOrUpdateSchematicProgress(progressData);
      res.status(201).json(progress);
    } catch (error) {
      apiLogger.error({ err: error }, "Error saving schematic progress");
      res.status(500).json({ message: "Failed to save schematic progress" });
    }
  });
}
