import type { Express } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../customAuth";
import { loadCurrentUser, requireCompany, type AuthRequest } from "../middleware/rowLevelSecurity";
import * as aiService from "../aiService";
import { insertRCASchema } from "@shared/schema";
import { z } from "zod";
import { apiLogger } from "../logger";

export function registerRcaRoutes(app: Express): void {
  // Get all RCA records for company with pagination
  app.get("/api/rca", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const currentUser = await storage.getUser(userId);

      if (!currentUser?.companyId) {
        return res.status(403).json({ message: "No company assigned" });
      }

      // Get query parameters for pagination and filtering
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 20;
      const search = req.query.search as string || "";

      const records = await storage.getRCARecordsByCompany(currentUser.companyId);

      // Filter by search term
      let filteredRecords = records;
      if (search) {
        filteredRecords = records.filter(rca =>
          rca.problemStatement.toLowerCase().includes(search.toLowerCase()) ||
          (rca.rootCauses || []).some((rc: string) => rc.toLowerCase().includes(search.toLowerCase()))
        );
      }

      // Calculate statistics
      const now = new Date();
      const stats = {
        total: records.length,
        thisMonth: records.filter(r => {
          const createdDate = new Date(r.createdAt!);
          return createdDate.getMonth() === now.getMonth() && createdDate.getFullYear() === now.getFullYear();
        }).length,
        withCorrectiveActions: records.filter(r => (r.correctiveActions || []).length > 0).length,
      };

      // Paginate
      const startIndex = (page - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const paginatedRecords = filteredRecords.slice(startIndex, endIndex);

      res.json({
        records: paginatedRecords,
        pagination: {
          page,
          pageSize,
          total: filteredRecords.length,
          totalPages: Math.ceil(filteredRecords.length / pageSize),
        },
        stats,
      });
    } catch (error) {
      apiLogger.error({ err: error }, "Error fetching RCA records");
      res.status(500).json({ message: "Failed to fetch RCA records" });
    }
  });

  // Create a new RCA record
  app.post("/api/rca", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const currentUser = await storage.getUser(userId);

      if (!currentUser?.companyId) {
        return res.status(403).json({ message: "No company assigned" });
      }

      const recordData = insertRCASchema.parse({
        ...req.body,
        companyId: currentUser.companyId,
        createdById: userId,
      });

      const record = await storage.createRCARecord(recordData);
      res.status(201).json(record);
    } catch (error) {
      apiLogger.error({ err: error }, "Error creating RCA record");
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid request", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create RCA record" });
    }
  });

  // Get a specific RCA record
  app.get("/api/rca/:id", isAuthenticated, loadCurrentUser, requireCompany, async (req: AuthRequest, res) => {
    try {
      const rcaId = req.params.id;
      const rca = await storage.getRCARecord(rcaId);

      if (!rca) {
        return res.status(404).json({ message: "RCA record not found" });
      }

      if (rca.companyId !== req.currentUser!.companyId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      res.json(rca);
    } catch (error) {
      apiLogger.error({ err: error }, "Error fetching RCA record");
      res.status(500).json({ message: "Failed to fetch RCA record" });
    }
  });

  // C4 Powered Why suggestion for RCA
  app.post("/api/rca/suggest-why", isAuthenticated, async (req: any, res) => {
    try {
      const { problemStatement, previousWhys, whyLevel } = req.body;

      if (!problemStatement) {
        return res.status(400).json({ message: "Problem statement is required" });
      }

      const suggestion = await aiService.suggestNextWhy(problemStatement, previousWhys || [], whyLevel || 1);

      res.json({ suggestion });
    } catch (error) {
      apiLogger.error({ err: error }, "Error generating Why suggestion");
      res.status(500).json({ message: "Failed to generate suggestion" });
    }
  });

  // Analyze RCA with AI
  app.post("/api/rca/:id/analyze", isAuthenticated, loadCurrentUser, requireCompany, async (req: AuthRequest, res) => {
    try {
      const rcaId = req.params.id;
      const record = await storage.getRCARecord(rcaId);

      if (!record) {
        return res.status(404).json({ message: "RCA record not found" });
      }

      // Security: Verify the RCA record belongs to the user's company
      if (record.companyId !== req.currentUser!.companyId) {
        apiLogger.warn(
          { rcaId, rcaCompanyId: record.companyId, userCompanyId: req.currentUser!.companyId },
          "Cross-tenant analyze attempt on RCA record"
        );
        return res.status(403).json({ message: "Forbidden" });
      }

      const aiInsights = await aiService.analyzeRootCause(
        record.problemStatement,
        record.fiveWhys
      );

      const updated = await storage.updateRCARecord(rcaId, { aiInsights });
      res.json(updated);
    } catch (error) {
      apiLogger.error({ err: error }, "Error analyzing RCA");
      res.status(500).json({ message: "Failed to analyze RCA" });
    }
  });
}
