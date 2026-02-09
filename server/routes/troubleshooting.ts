import type { Express } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../customAuth";
import { loadCurrentUser, requireCompany, type AuthRequest } from "../middleware/rowLevelSecurity";
import * as aiService from "../aiService";
import { insertTroubleshootingSessionSchema } from "@shared/schema";
import { z } from "zod";
import { apiLogger } from "../logger";

export function registerTroubleshootingRoutes(app: Express): void {
  // Get all troubleshooting sessions for company
  app.get("/api/troubleshooting", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const currentUser = await storage.getUser(userId);

      if (!currentUser?.companyId) {
        return res.status(403).json({ message: "No company assigned" });
      }

      const sessions = await storage.getTroubleshootingSessionsByCompany(currentUser.companyId);
      res.json(sessions);
    } catch (error) {
      apiLogger.error({ err: error }, "Error fetching troubleshooting sessions");
      res.status(500).json({ message: "Failed to fetch troubleshooting sessions" });
    }
  });

  // Get a specific troubleshooting session
  app.get("/api/troubleshooting/:id", isAuthenticated, loadCurrentUser, requireCompany, async (req: AuthRequest, res) => {
    try {
      const sessionId = req.params.id;

      const session = await storage.getTroubleshootingSession(sessionId);
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }

      // Security: Verify the session belongs to the user's company
      if (session.companyId !== req.currentUser!.companyId) {
        apiLogger.warn(
          { sessionId, sessionCompanyId: session.companyId, userCompanyId: req.currentUser!.companyId },
          "Cross-tenant access attempt on troubleshooting session"
        );
        return res.status(403).json({ message: "Forbidden" });
      }

      res.json(session);
    } catch (error) {
      apiLogger.error({ err: error }, "Error fetching troubleshooting session");
      res.status(500).json({ message: "Failed to fetch troubleshooting session" });
    }
  });

  // Create a new troubleshooting session
  app.post("/api/troubleshooting", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const currentUser = await storage.getUser(userId);

      if (!currentUser?.companyId) {
        return res.status(403).json({ message: "No company assigned" });
      }

      const sessionData = insertTroubleshootingSessionSchema.parse({
        ...req.body,
        companyId: currentUser.companyId,
        createdById: userId,
      });

      const session = await storage.createTroubleshootingSession(sessionData);
      res.status(201).json(session);
    } catch (error) {
      apiLogger.error({ err: error }, "Error creating troubleshooting session");
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid request", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create troubleshooting session" });
    }
  });

  // Update a troubleshooting session
  app.put("/api/troubleshooting/:id", isAuthenticated, loadCurrentUser, requireCompany, async (req: AuthRequest, res) => {
    try {
      const sessionId = req.params.id;

      const session = await storage.getTroubleshootingSession(sessionId);
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }

      // Security: Verify the session belongs to the user's company
      if (session.companyId !== req.currentUser!.companyId) {
        apiLogger.warn(
          { sessionId, sessionCompanyId: session.companyId, userCompanyId: req.currentUser!.companyId },
          "Cross-tenant update attempt on troubleshooting session"
        );
        return res.status(403).json({ message: "Forbidden" });
      }

      // Check if we're completing the session
      const isCompletingSession = req.body.completed === true;

      // If completing, just mark as completed
      if (isCompletingSession) {
        const updated = await storage.updateTroubleshootingSession(sessionId, {
          completed: true,
        });
        return res.json(updated);
      }

      // Check if we're advancing to a new step
      const isAdvancingStep = req.body.currentStep && req.body.currentStep !== session.currentStep;

      let updated = await storage.updateTroubleshootingSession(sessionId, req.body);

      // If advancing to a new step (and not beyond step 6), automatically initialize the AI coach
      if (isAdvancingStep && updated.currentStep <= 6) {
        const conversation = updated.aiConversation || [];

        // Extract problem summary from the conversation
        const userMessages = conversation.filter((msg: any) => msg.role === "user").map((msg: any) => msg.content);
        const problemDesc = userMessages.length > 0
          ? userMessages.slice(0, 3).join(" | ") // First few user messages as problem summary
          : "Problem being diagnosed";

        // Get initial coaching message for the new step
        const initialCoachMessage = await aiService.getTroubleshootingGuidance(
          problemDesc,
          updated.currentStep,
          conversation
        );

        // Add the AI's initial coaching question to the conversation
        conversation.push({ role: "assistant", content: initialCoachMessage });

        // Update with the new conversation
        updated = await storage.updateTroubleshootingSession(sessionId, {
          aiConversation: conversation,
        });
      }

      res.json(updated);
    } catch (error) {
      apiLogger.error({ err: error }, "Error updating troubleshooting session");
      res.status(500).json({ message: "Failed to update troubleshooting session" });
    }
  });

  // Chat with AI in troubleshooting session
  app.post("/api/troubleshooting/:id/chat", isAuthenticated, loadCurrentUser, requireCompany, async (req: AuthRequest, res) => {
    try {
      const sessionId = req.params.id;
      const { message } = req.body;

      const session = await storage.getTroubleshootingSession(sessionId);
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }

      // Security: Verify the session belongs to the user's company
      if (session.companyId !== req.currentUser!.companyId) {
        apiLogger.warn(
          { sessionId, sessionCompanyId: session.companyId, userCompanyId: req.currentUser!.companyId },
          "Cross-tenant chat attempt on troubleshooting session"
        );
        return res.status(403).json({ message: "Forbidden" });
      }

      const conversation = session.aiConversation;
      conversation.push({ role: "user", content: message });

      const aiResponse = await aiService.getTroubleshootingGuidance(
        message,
        session.currentStep,
        conversation
      );

      conversation.push({ role: "assistant", content: aiResponse });

      const updated = await storage.updateTroubleshootingSession(sessionId, {
        aiConversation: conversation,
      });

      res.json({ session: updated, aiResponse });
    } catch (error) {
      apiLogger.error({ err: error }, "Error in troubleshooting chat");
      res.status(500).json({ message: "Failed to process chat message" });
    }
  });

  // AI Recommendations routes
  app.get("/api/ai-recommendations", isAuthenticated, loadCurrentUser, requireCompany, async (req: AuthRequest, res) => {
    try {
      const companyId = req.currentUser!.companyId;
      const recommendations = await storage.getAIRecommendationsByCompany(companyId);
      res.json(recommendations);
    } catch (error) {
      apiLogger.error({ err: error }, "Error fetching AI recommendations");
      res.status(500).json({ message: "Failed to fetch AI recommendations" });
    }
  });

  app.post("/api/ai-recommendations/generate", isAuthenticated, loadCurrentUser, requireCompany, async (req: AuthRequest, res) => {
    try {
      const userId = req.currentUser!.id;
      const companyId = req.currentUser!.companyId;

      // Fetch data for analysis
      const equipment = await storage.getEquipmentByCompany(companyId);
      const parts = await storage.getPartsByCompany(companyId);
      const workOrders = await storage.getWorkOrdersByCompany(companyId);

      // Generate recommendations using AI
      const aiRecommendations = await aiService.generateMaintenanceRecommendations(
        equipment,
        parts,
        workOrders.slice(-20)
      );

      // Save recommendations to database
      const savedRecommendations = [];

      // Save PM schedule recommendations
      for (const rec of aiRecommendations.pmSchedules || []) {
        const saved = await storage.createAIRecommendation({
          companyId,
          type: "pm_schedule",
          title: rec.title,
          description: rec.description,
          confidence: rec.confidence,
          status: "pending",
          aiReasoning: rec.reasoning,
          suggestedData: rec.suggestedData,
          createdById: userId,
        });
        savedRecommendations.push(saved);
      }

      // Save parts order recommendations
      for (const rec of aiRecommendations.partsOrders || []) {
        const saved = await storage.createAIRecommendation({
          companyId,
          type: "parts_order",
          title: rec.title,
          description: rec.description,
          confidence: rec.confidence,
          status: "pending",
          aiReasoning: rec.reasoning,
          suggestedData: rec.suggestedData,
          createdById: userId,
        });
        savedRecommendations.push(saved);
      }

      // Save work order recommendations
      for (const rec of aiRecommendations.workOrders || []) {
        const saved = await storage.createAIRecommendation({
          companyId,
          type: "work_order",
          title: rec.title,
          description: rec.description,
          confidence: rec.confidence,
          status: "pending",
          aiReasoning: rec.reasoning,
          suggestedData: rec.suggestedData,
          createdById: userId,
        });
        savedRecommendations.push(saved);
      }

      res.json(savedRecommendations);
    } catch (error) {
      apiLogger.error({ err: error }, "Error generating AI recommendations");
      res.status(500).json({ message: "Failed to generate AI recommendations" });
    }
  });

  app.post("/api/ai-recommendations/:id/approve", isAuthenticated, loadCurrentUser, requireCompany, async (req: AuthRequest, res) => {
    try {
      const userId = req.currentUser!.id;
      const recommendationId = req.params.id;

      const recommendation = await storage.approveAIRecommendation(recommendationId, userId);

      if (!recommendation) {
        return res.status(404).json({ message: "Recommendation not found" });
      }

      res.json(recommendation);
    } catch (error) {
      apiLogger.error({ err: error }, "Error approving AI recommendation");
      res.status(500).json({ message: "Failed to approve recommendation" });
    }
  });

  app.post("/api/ai-recommendations/:id/reject", isAuthenticated, loadCurrentUser, requireCompany, async (req: AuthRequest, res) => {
    try {
      const userId = req.currentUser!.id;
      const recommendationId = req.params.id;
      const { reason } = req.body;

      const recommendation = await storage.rejectAIRecommendation(recommendationId, userId, reason || "");

      if (!recommendation) {
        return res.status(404).json({ message: "Recommendation not found" });
      }

      res.json(recommendation);
    } catch (error) {
      apiLogger.error({ err: error }, "Error rejecting AI recommendation");
      res.status(500).json({ message: "Failed to reject recommendation" });
    }
  });
}
