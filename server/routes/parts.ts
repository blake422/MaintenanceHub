import type { Express } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../customAuth";
import { loadCurrentUser, requireCompany, type AuthRequest } from "../middleware/rowLevelSecurity";
import { upload } from "../uploadHandlers";
import * as aiService from "../aiService";
import { insertPartSchema } from "@shared/schema";
import { z } from "zod";
import { apiLogger } from "../logger";

export function registerPartsRoutes(app: Express): void {
  // Get all parts for company
  app.get("/api/parts", isAuthenticated, loadCurrentUser, requireCompany, async (req: AuthRequest, res) => {
    try {
      const parts = await storage.getPartsByCompany(req.currentUser!.companyId);
      res.json(parts);
    } catch (error) {
      apiLogger.error({ err: error }, "Error fetching parts");
      res.status(500).json({ message: "Failed to fetch parts" });
    }
  });

  // Create a new part
  app.post("/api/parts", isAuthenticated, loadCurrentUser, requireCompany, async (req: AuthRequest, res) => {
    try {
      if (req.currentUser!.role !== "admin" && req.currentUser!.role !== "manager") {
        return res.status(403).json({ message: "Forbidden" });
      }

      const partData = insertPartSchema.parse({
        ...req.body,
        companyId: req.currentUser!.companyId,
      });

      const part = await storage.createPart(partData);
      res.status(201).json(part);
    } catch (error) {
      apiLogger.error({ err: error }, "Error creating part");
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid request", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create part" });
    }
  });

  // Get a specific part
  app.get("/api/parts/:id", isAuthenticated, loadCurrentUser, requireCompany, async (req: AuthRequest, res) => {
    try {
      const partId = req.params.id;
      const part = await storage.getPart(partId);

      if (!part) {
        return res.status(404).json({ message: "Part not found" });
      }

      if (part.companyId !== req.currentUser!.companyId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      res.json(part);
    } catch (error) {
      apiLogger.error({ err: error }, "Error fetching part");
      res.status(500).json({ message: "Failed to fetch part" });
    }
  });

  // Image search for parts (AI-powered)
  app.post("/api/parts/search-by-image", isAuthenticated, loadCurrentUser, requireCompany, upload.single('image'), async (req: AuthRequest, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No image provided" });
      }

      // Validate file type (images only)
      const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/heic', 'image/webp'];
      if (!allowedMimeTypes.includes(req.file.mimetype)) {
        return res.status(400).json({ message: "Invalid file type. Please upload an image (JPEG, PNG, HEIC, or WebP)" });
      }

      // Validate file size (max 20MB)
      const maxSize = 20 * 1024 * 1024; // 20MB
      if (req.file.size > maxSize) {
        return res.status(400).json({ message: "File too large. Maximum size is 20MB" });
      }

      // Convert image to base64
      const base64Image = req.file.buffer.toString('base64');
      const mimeType = req.file.mimetype;

      // Use OpenAI Vision API to identify the part
      const identification = await aiService.identifyPartFromImage(base64Image, mimeType);

      // Validate AI response structure
      if (!identification || !identification.description || !identification.partType || !Array.isArray(identification.specifications)) {
        apiLogger.error({ identification }, "Invalid AI response structure");
        return res.status(500).json({ message: "Failed to identify part. AI response was invalid." });
      }

      // Get all parts from company's inventory
      const allParts = await storage.getPartsByCompany(req.currentUser!.companyId);

      // Match the identified part to inventory using fuzzy matching
      const matchedParts = aiService.matchPartsToInventory(identification, allParts);

      // Generate purchase links for web suppliers
      const purchaseLinks = aiService.generatePurchaseLinks(identification);

      apiLogger.info({ partType: identification.partType, matchedCount: matchedParts.length, avgConfidence: matchedParts.length > 0 ? (matchedParts.reduce((sum: number, p: any) => sum + p.confidence, 0) / matchedParts.length * 100).toFixed(1) : 0 }, "Image search completed");

      res.json({
        identification: identification.description,
        partType: identification.partType,
        specifications: identification.specifications,
        technicalDetails: identification.technicalDetails,
        manufacturers: identification.manufacturers || [],
        searchKeywords: identification.searchKeywords || [],
        // Web search results are PRIMARY - shown first
        webSearchResults: purchaseLinks,
        // Inventory matches are SECONDARY - optional
        inventoryMatches: matchedParts,
      });
    } catch (error) {
      apiLogger.error({ err: error }, "Error searching parts by image");
      res.status(500).json({ message: "Failed to identify part from image" });
    }
  });

  // Delete a part
  app.delete("/api/parts/:id", isAuthenticated, loadCurrentUser, requireCompany, async (req: AuthRequest, res) => {
    try {
      if (req.currentUser!.role !== "admin" && req.currentUser!.role !== "manager") {
        return res.status(403).json({ message: "Forbidden" });
      }

      const partId = req.params.id;
      const part = await storage.getPart(partId);

      if (!part) {
        return res.status(404).json({ message: "Part not found" });
      }

      if (part.companyId !== req.currentUser!.companyId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      await storage.deletePart(partId);
      res.json({ message: "Part deleted successfully" });
    } catch (error) {
      apiLogger.error({ err: error }, "Error deleting part");
      res.status(500).json({ message: "Failed to delete part" });
    }
  });
}
