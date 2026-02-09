import type { Express } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../customAuth";
import { upload } from "../uploadHandlers";
import path from "path";
import fs from "fs";
import { apiLogger } from "../logger";

export function registerExcellenceRoutes(app: Express): void {
  // Excellence Progress routes (6-Step Program)
  app.get("/api/excellence-progress", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const currentUser = await storage.getUser(userId);

      if (!currentUser?.companyId) {
        return res.status(403).json({ message: "No company assigned" });
      }

      const clientCompanyId = req.query.clientCompanyId as string | undefined;
      
      // Validate client company belongs to this tenant if provided
      if (clientCompanyId) {
        const clientCompany = await storage.getClientCompany(clientCompanyId);
        if (!clientCompany || clientCompany.companyId !== currentUser.companyId) {
          return res.status(404).json({ message: "Client company not found" });
        }
      }

      let progress = await storage.getExcellenceProgressByCompany(currentUser.companyId, clientCompanyId);

      // If no progress exists, create it with defaults
      if (!progress) {
        progress = await storage.createExcellenceProgress({
          companyId: currentUser.companyId,
          clientCompanyId: clientCompanyId || null,
          currentStep: 1,
        });
      }

      res.json(progress);
    } catch (error) {
      apiLogger.error({ err: error }, "Error fetching excellence progress");
      res.status(500).json({ message: "Failed to fetch excellence progress" });
    }
  });

  app.put("/api/excellence-progress/:id", isAuthenticated, async (req: any, res) => {
    try {
      const progressId = req.params.id;
      const userId = req.user.id;
      const currentUser = await storage.getUser(userId);

      if (!currentUser?.companyId) {
        return res.status(403).json({ message: "No company assigned" });
      }

      // Only admins and managers can update excellence progress
      if (currentUser.role !== "admin" && currentUser.role !== "manager") {
        return res.status(403).json({ message: "Only admins and managers can update progress" });
      }

      // Look up progress by ID and verify it belongs to the user's company
      const existing = await storage.getExcellenceProgress(progressId);
      if (!existing) {
        return res.status(404).json({ message: "Progress record not found" });
      }
      if (existing.companyId !== currentUser.companyId) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      
      // If progress has a clientCompanyId, verify that client also belongs to this tenant
      if (existing.clientCompanyId) {
        const clientCompany = await storage.getClientCompany(existing.clientCompanyId);
        if (!clientCompany || clientCompany.companyId !== currentUser.companyId) {
          return res.status(403).json({ message: "Unauthorized" });
        }
      }

      // Convert ISO string timestamps to Date objects for Drizzle
      const updates = { ...req.body };
      const dateFields = [
        'step1CompletedAt', 'step2CompletedAt', 'step3CompletedAt',
        'step4CompletedAt', 'step5CompletedAt', 'step6CompletedAt',
        'completedAt'
      ];

      for (const field of dateFields) {
        if (updates[field] && typeof updates[field] === 'string') {
          updates[field] = new Date(updates[field]);
        }
      }

      const updated = await storage.updateExcellenceProgress(progressId, updates);
      res.json(updated);
    } catch (error) {
      apiLogger.error({ err: error }, "Error updating excellence progress");
      res.status(500).json({ message: "Failed to update excellence progress" });
    }
  });

  // Excellence Deliverables routes (Interactive forms/templates)
  app.get("/api/excellence-deliverables", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const currentUser = await storage.getUser(userId);

      if (!currentUser?.companyId) {
        return res.status(403).json({ message: "No company assigned" });
      }

      const step = req.query.step ? parseInt(req.query.step as string) : undefined;
      const clientCompanyId = req.query.clientCompanyId as string | undefined;
      
      // Validate client company belongs to this tenant if provided
      if (clientCompanyId) {
        const clientCompany = await storage.getClientCompany(clientCompanyId);
        if (!clientCompany || clientCompany.companyId !== currentUser.companyId) {
          return res.status(404).json({ message: "Client company not found" });
        }
      }
      
      const deliverables = await storage.getExcellenceDeliverables(currentUser.companyId, step, clientCompanyId);

      res.json(deliverables);
    } catch (error) {
      apiLogger.error({ err: error }, "Error fetching excellence deliverables");
      res.status(500).json({ message: "Failed to fetch deliverables" });
    }
  });

  app.post("/api/excellence-deliverables", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const currentUser = await storage.getUser(userId);

      if (!currentUser?.companyId) {
        return res.status(403).json({ message: "No company assigned" });
      }

      // Only admins and managers can create deliverables
      if (currentUser.role !== "admin" && currentUser.role !== "manager") {
        return res.status(403).json({ message: "Only admins and managers can create deliverables" });
      }

      // Extract only the fields we need from req.body
      const { step, checklistItemId, deliverableType, title, description, payload, isComplete, completedAt, completedById, clientCompanyId } = req.body;
      
      // Validate client company belongs to this tenant if provided
      if (clientCompanyId) {
        const clientCompany = await storage.getClientCompany(clientCompanyId);
        if (!clientCompany || clientCompany.companyId !== currentUser.companyId) {
          return res.status(404).json({ message: "Client company not found" });
        }
      }

      // Ensure progress record exists for this company/client combo
      let progress = await storage.getExcellenceProgressByCompany(currentUser.companyId, clientCompanyId);
      if (!progress) {
        progress = await storage.createExcellenceProgress({ 
          companyId: currentUser.companyId,
          clientCompanyId: clientCompanyId || null,
        });
      }

      // Validate required fields
      if (typeof step !== "number" || step < 0 || step > 6) {
        return res.status(400).json({ message: "Invalid step: must be a number between 0 and 6" });
      }
      if (!checklistItemId || typeof checklistItemId !== "string") {
        return res.status(400).json({ message: "Invalid checklistItemId: must be a non-empty string" });
      }

      // Validate process_assessment payload structure if applicable
      if (deliverableType === "process_assessment" && payload) {
        if (!payload.items || !Array.isArray(payload.items)) {
          return res.status(400).json({ message: "Invalid process_assessment payload: items must be an array" });
        }
        for (const item of payload.items) {
          if (typeof item.id !== "string" || typeof item.actualScore !== "number" || typeof item.possibleScore !== "number") {
            return res.status(400).json({ message: "Invalid process_assessment item: must have id (string), actualScore (number), possibleScore (number)" });
          }
          if (item.actualScore < 0 || item.actualScore > item.possibleScore) {
            return res.status(400).json({ message: "Invalid actualScore: must be between 0 and possibleScore" });
          }
        }
      }

      const deliverable = await storage.createExcellenceDeliverable({
        progressId: progress.id,
        companyId: currentUser.companyId,
        clientCompanyId: clientCompanyId || null,
        step,
        checklistItemId,
        deliverableType,
        title,
        description,
        payload,
        isComplete,
        completedAt: completedAt ? new Date(completedAt) : undefined,
        completedById,
        lastEditedById: userId,
      });

      res.status(201).json(deliverable);
    } catch (error) {
      apiLogger.error({ err: error }, "Error creating excellence deliverable");
      res.status(500).json({ message: "Failed to create deliverable" });
    }
  });

  app.put("/api/excellence-deliverables/:id", isAuthenticated, async (req: any, res) => {
    try {
      const deliverableId = req.params.id;
      const userId = req.user.id;
      const currentUser = await storage.getUser(userId);

      if (!currentUser?.companyId) {
        return res.status(403).json({ message: "No company assigned" });
      }

      // Only admins and managers can update deliverables
      if (currentUser.role !== "admin" && currentUser.role !== "manager") {
        return res.status(403).json({ message: "Only admins and managers can update deliverables" });
      }

      // Extract only the fields we can update (no IDs, no createdAt)
      const { title, description, payload, isComplete, completedAt, completedById } = req.body;

      // Validate process_assessment payload structure if applicable
      if (payload && payload.items && Array.isArray(payload.items)) {
        for (const item of payload.items) {
          if (typeof item.id !== "string" || typeof item.actualScore !== "number" || typeof item.possibleScore !== "number") {
            return res.status(400).json({ message: "Invalid assessment item: must have id (string), actualScore (number), possibleScore (number)" });
          }
          if (item.actualScore < 0 || item.actualScore > item.possibleScore) {
            return res.status(400).json({ message: "Invalid actualScore: must be between 0 and possibleScore" });
          }
        }
      }

      const updates: any = {
        title,
        description,
        payload,
        isComplete,
        completedById,
        lastEditedById: userId,
      };

      // Convert completedAt if provided
      if (completedAt) {
        updates.completedAt = typeof completedAt === 'string' ? new Date(completedAt) : completedAt;
      }

      const updated = await storage.updateExcellenceDeliverable(deliverableId, updates);
      res.json(updated);
    } catch (error) {
      apiLogger.error({ err: error }, "Error updating excellence deliverable");
      res.status(500).json({ message: "Failed to update deliverable" });
    }
  });

  app.delete("/api/excellence-deliverables/:id", isAuthenticated, async (req: any, res) => {
    try {
      const deliverableId = req.params.id;
      const userId = req.user.id;
      const currentUser = await storage.getUser(userId);

      if (!currentUser?.companyId) {
        return res.status(403).json({ message: "No company assigned" });
      }

      // Only admins and managers can delete deliverables
      if (currentUser.role !== "admin" && currentUser.role !== "manager") {
        return res.status(403).json({ message: "Only admins and managers can delete deliverables" });
      }

      await storage.deleteExcellenceDeliverable(deliverableId);
      res.status(204).send();
    } catch (error) {
      apiLogger.error({ err: error }, "Error deleting excellence deliverable");
      res.status(500).json({ message: "Failed to delete deliverable" });
    }
  });

  // Client Company routes (for consultant-managed clients)
  app.get("/api/client-companies", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const currentUser = await storage.getUser(userId);

      if (!currentUser?.companyId) {
        return res.status(403).json({ message: "No company assigned" });
      }

      const clientCompanies = await storage.getClientCompaniesByCompany(currentUser.companyId);
      res.json(clientCompanies);
    } catch (error) {
      apiLogger.error({ err: error }, "Error fetching client companies");
      res.status(500).json({ message: "Failed to fetch client companies" });
    }
  });

  app.post("/api/client-companies", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const currentUser = await storage.getUser(userId);

      if (!currentUser?.companyId) {
        return res.status(403).json({ message: "No company assigned" });
      }

      // Only admins and managers can create client companies
      if (currentUser.role !== "admin" && currentUser.role !== "manager") {
        return res.status(403).json({ message: "Only admins and managers can create client companies" });
      }

      const { name, industry, location, contactName, contactEmail, notes } = req.body;

      if (!name) {
        return res.status(400).json({ message: "Client company name is required" });
      }

      const clientCompany = await storage.createClientCompany({
        companyId: currentUser.companyId,
        name,
        industry,
        location,
        contactName,
        contactEmail,
        notes,
        createdById: userId,
      });

      res.status(201).json(clientCompany);
    } catch (error) {
      apiLogger.error({ err: error }, "Error creating client company");
      res.status(500).json({ message: "Failed to create client company" });
    }
  });

  app.put("/api/client-companies/:id", isAuthenticated, async (req: any, res) => {
    try {
      const clientCompanyId = req.params.id;
      const userId = req.user.id;
      const currentUser = await storage.getUser(userId);

      if (!currentUser?.companyId) {
        return res.status(403).json({ message: "No company assigned" });
      }

      // Only admins and managers can update client companies
      if (currentUser.role !== "admin" && currentUser.role !== "manager") {
        return res.status(403).json({ message: "Only admins and managers can update client companies" });
      }

      // Verify the client company belongs to this tenant
      const existingClientCompany = await storage.getClientCompany(clientCompanyId);
      if (!existingClientCompany || existingClientCompany.companyId !== currentUser.companyId) {
        return res.status(404).json({ message: "Client company not found" });
      }

      const { name, industry, location, contactName, contactEmail, notes } = req.body;

      const updates: any = {};
      if (name !== undefined) updates.name = name;
      if (industry !== undefined) updates.industry = industry;
      if (location !== undefined) updates.location = location;
      if (contactName !== undefined) updates.contactName = contactName;
      if (contactEmail !== undefined) updates.contactEmail = contactEmail;
      if (notes !== undefined) updates.notes = notes;

      const updated = await storage.updateClientCompany(clientCompanyId, updates);
      res.json(updated);
    } catch (error) {
      apiLogger.error({ err: error }, "Error updating client company");
      res.status(500).json({ message: "Failed to update client company" });
    }
  });

  app.delete("/api/client-companies/:id", isAuthenticated, async (req: any, res) => {
    try {
      const clientCompanyId = req.params.id;
      const userId = req.user.id;
      const currentUser = await storage.getUser(userId);

      if (!currentUser?.companyId) {
        return res.status(403).json({ message: "No company assigned" });
      }

      // Only admins and managers can delete client companies
      if (currentUser.role !== "admin" && currentUser.role !== "manager") {
        return res.status(403).json({ message: "Only admins and managers can delete client companies" });
      }

      // Verify the client company belongs to this tenant
      const existingClientCompany = await storage.getClientCompany(clientCompanyId);
      if (!existingClientCompany || existingClientCompany.companyId !== currentUser.companyId) {
        return res.status(404).json({ message: "Client company not found" });
      }

      await storage.deleteClientCompany(clientCompanyId);
      res.status(204).send();
    } catch (error) {
      apiLogger.error({ err: error }, "Error deleting client company");
      res.status(500).json({ message: "Failed to delete client company" });
    }
  });

  // Interview Session routes
  app.get("/api/interview-sessions", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const currentUser = await storage.getUser(userId);

      if (!currentUser?.companyId) {
        return res.status(403).json({ message: "No company assigned" });
      }

      const assessmentId = req.query.assessmentId as string | undefined;
      const clientCompanyId = req.query.clientCompanyId as string | undefined;

      // Always get sessions for the current tenant, then filter if needed
      let sessions = await storage.getInterviewSessionsByCompany(currentUser.companyId);

      // Apply additional filters (these are already tenant-scoped via the company fetch)
      if (assessmentId) {
        sessions = sessions.filter(s => s.assessmentDeliverableId === assessmentId);
      } else if (clientCompanyId) {
        sessions = sessions.filter(s => s.clientCompanyId === clientCompanyId);
      }

      res.json(sessions);
    } catch (error) {
      apiLogger.error({ err: error }, "Error fetching interview sessions");
      res.status(500).json({ message: "Failed to fetch interview sessions" });
    }
  });

  app.post("/api/interview-sessions", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const currentUser = await storage.getUser(userId);

      if (!currentUser?.companyId) {
        return res.status(403).json({ message: "No company assigned" });
      }

      // Only admins and managers can create interview sessions
      if (currentUser.role !== "admin" && currentUser.role !== "manager") {
        return res.status(403).json({ message: "Only admins and managers can create interview sessions" });
      }

      const { assessmentDeliverableId, clientCompanyId, intervieweeRole, intervieweeName, intervieweeDepartment, consentGiven } = req.body;

      if (!intervieweeRole) {
        return res.status(400).json({ message: "Interviewee role is required" });
      }

      // Verify clientCompanyId belongs to this tenant if provided
      if (clientCompanyId) {
        const clientCompany = await storage.getClientCompany(clientCompanyId);
        if (!clientCompany || clientCompany.companyId !== currentUser.companyId) {
          return res.status(400).json({ message: "Invalid client company" });
        }
      }

      // Verify assessmentDeliverableId belongs to this tenant if provided
      if (assessmentDeliverableId) {
        const deliverable = await storage.getExcellenceDeliverable(assessmentDeliverableId);
        if (!deliverable || deliverable.companyId !== currentUser.companyId) {
          return res.status(400).json({ message: "Invalid assessment deliverable" });
        }
      }

      const session = await storage.createInterviewSession({
        companyId: currentUser.companyId,
        clientCompanyId: clientCompanyId || null,
        assessmentDeliverableId,
        intervieweeRole,
        intervieweeName,
        intervieweeDepartment,
        consentGiven: consentGiven || false,
        conductedById: userId,
        conductedAt: new Date(),
      });

      res.status(201).json(session);
    } catch (error) {
      apiLogger.error({ err: error }, "Error creating interview session");
      res.status(500).json({ message: "Failed to create interview session" });
    }
  });

  app.put("/api/interview-sessions/:id", isAuthenticated, async (req: any, res) => {
    try {
      const sessionId = req.params.id;
      const userId = req.user.id;
      const currentUser = await storage.getUser(userId);

      if (!currentUser?.companyId) {
        return res.status(403).json({ message: "No company assigned" });
      }

      // Only admins and managers can update interview sessions
      if (currentUser.role !== "admin" && currentUser.role !== "manager") {
        return res.status(403).json({ message: "Only admins and managers can update interview sessions" });
      }

      // Verify the session belongs to this tenant
      const existingSession = await storage.getInterviewSession(sessionId);
      if (!existingSession || existingSession.companyId !== currentUser.companyId) {
        return res.status(404).json({ message: "Interview session not found" });
      }

      const { transcript, summary, painPoints, themes, questionsAsked, duration, clientCompanyId } = req.body;

      const updates: any = {};
      if (transcript !== undefined) updates.transcript = transcript;
      if (summary !== undefined) updates.summary = summary;
      if (painPoints !== undefined) updates.painPoints = painPoints;
      if (themes !== undefined) updates.themes = themes;
      if (questionsAsked !== undefined) updates.questionsAsked = questionsAsked;
      if (duration !== undefined) updates.duration = duration;
      
      // Handle clientCompanyId reassignment
      if (clientCompanyId !== undefined) {
        if (clientCompanyId === null) {
          // Allow unassigning from a client company
          updates.clientCompanyId = null;
        } else {
          // Validate that the target client company belongs to this tenant
          const targetClientCompany = await storage.getClientCompany(clientCompanyId);
          if (!targetClientCompany || targetClientCompany.companyId !== currentUser.companyId) {
            return res.status(400).json({ message: "Invalid client company" });
          }
          updates.clientCompanyId = clientCompanyId;
        }
      }

      const updated = await storage.updateInterviewSession(sessionId, updates);
      res.json(updated);
    } catch (error) {
      apiLogger.error({ err: error }, "Error updating interview session");
      res.status(500).json({ message: "Failed to update interview session" });
    }
  });

  // Audio upload and transcription for interviews
  app.post("/api/interview-sessions/:id/audio", isAuthenticated, upload.single("audio"), async (req: any, res) => {
    try {
      const sessionId = req.params.id;
      const userId = req.user.id;
      const currentUser = await storage.getUser(userId);

      if (!currentUser?.companyId) {
        return res.status(403).json({ message: "No company assigned" });
      }

      if (!req.file) {
        return res.status(400).json({ message: "No audio file provided" });
      }

      // Get the interview session and verify tenant ownership
      const session = await storage.getInterviewSession(sessionId);
      if (!session || session.companyId !== currentUser.companyId) {
        return res.status(404).json({ message: "Interview session not found" });
      }

      // CRITICAL: Save audio to object storage FIRST before any processing
      // This ensures we never lose the recording even if transcription fails
      const { uploadFilePrivate } = await import("../objectStorage");
      const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
      
      if (!bucketId) {
        apiLogger.error("Object storage not configured - cannot save audio");
        return res.status(500).json({ message: "Audio storage not configured. Please contact support." });
      }

      const timestamp = Date.now();
      const extension = req.file.mimetype.includes('webm') ? 'webm' : 
                       req.file.mimetype.includes('mp4') ? 'mp4' :
                       req.file.mimetype.includes('wav') ? 'wav' : 'audio';
      // Store in .private directory for security - requires signed URLs to access
      const audioFileName = `.private/interviews/${currentUser.companyId}/${sessionId}-${timestamp}.${extension}`;
      
      let audioObjectKey: string;
      try {
        // Upload privately - returns just the object key, not a public URL
        audioObjectKey = await uploadFilePrivate(bucketId, audioFileName, req.file.buffer, req.file.mimetype);
        apiLogger.info({ sessionId, audioFileName }, "Interview audio saved to object storage (private)");
      } catch (uploadError: any) {
        apiLogger.error({ err: uploadError, sessionId }, "Failed to save interview audio to storage");
        return res.status(500).json({ message: "Failed to save audio file. Please try again." });
      }

      // Update session with object key immediately so it's saved even if transcription fails
      await storage.updateInterviewSession(sessionId, {
        audioObjectKey: audioObjectKey,
        duration: Math.floor(req.file.size / 16000), // Rough estimate of duration
      });

      // Now attempt transcription - if this fails, audio is already saved
      try {
        const { transcribeInterviewAudio, summarizeInterview } = await import("../aiService");

        const transcript = await transcribeInterviewAudio(req.file.buffer, req.file.mimetype);

        // Generate summary and extract pain points
        const summaryResult = await summarizeInterview(
          transcript,
          session.intervieweeRole,
          session.intervieweeName || undefined
        );

        // Update the session with transcript, summary, and pain points
        const updated = await storage.updateInterviewSession(sessionId, {
          transcript,
          summary: summaryResult.summary,
          painPoints: summaryResult.painPoints,
          themes: summaryResult.themes,
          transcribedAt: new Date(),
          summarizedAt: new Date(),
        });

        res.json(updated);
      } catch (transcriptionError: any) {
        apiLogger.error({ err: transcriptionError, sessionId }, "Transcription failed but audio was saved");
        // Audio is saved, return session with audio URL so user knows their recording is safe
        const savedSession = await storage.getInterviewSession(sessionId);
        res.status(200).json({
          ...savedSession,
          transcriptionFailed: true,
          message: "Audio saved successfully but transcription failed. You can enter the transcript manually or retry later."
        });
      }
    } catch (error: any) {
      apiLogger.error({ err: error }, "Error processing interview audio");
      res.status(500).json({ message: "Failed to process interview audio. Please try again." });
    }
  });

  // Get signed URL for audio playback (generates time-limited access URL)
  app.get("/api/interview-sessions/:id/audio-url", isAuthenticated, async (req: any, res) => {
    try {
      const sessionId = req.params.id;
      const userId = req.user.id;
      const currentUser = await storage.getUser(userId);

      if (!currentUser?.companyId) {
        return res.status(403).json({ message: "No company assigned" });
      }

      const session = await storage.getInterviewSession(sessionId);
      if (!session || session.companyId !== currentUser.companyId) {
        return res.status(404).json({ message: "Interview session not found" });
      }

      if (!session.audioObjectKey) {
        return res.status(404).json({ message: "No audio recording available for this session" });
      }

      const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
      if (!bucketId) {
        return res.status(500).json({ message: "Object storage not configured" });
      }

      // Generate a signed URL that expires in 1 hour - provides secure, time-limited access
      const { getSignedUrl } = await import("../objectStorage");
      const signedUrl = await getSignedUrl(bucketId, session.audioObjectKey, 3600);
      
      res.json({ audioUrl: signedUrl });
    } catch (error) {
      apiLogger.error({ err: error }, "Error getting audio URL");
      res.status(500).json({ message: "Failed to get audio URL" });
    }
  });

  // Retry transcription for sessions with saved audio but failed transcription
  app.post("/api/interview-sessions/:id/retry-transcription", isAuthenticated, async (req: any, res) => {
    try {
      const sessionId = req.params.id;
      const userId = req.user.id;
      const currentUser = await storage.getUser(userId);

      if (!currentUser?.companyId) {
        return res.status(403).json({ message: "No company assigned" });
      }

      if (currentUser.role !== "admin" && currentUser.role !== "manager") {
        return res.status(403).json({ message: "Only admins and managers can retry transcription" });
      }

      const session = await storage.getInterviewSession(sessionId);
      if (!session || session.companyId !== currentUser.companyId) {
        return res.status(404).json({ message: "Interview session not found" });
      }

      if (!session.audioObjectKey) {
        return res.status(400).json({ message: "No audio recording available to transcribe" });
      }

      if (session.transcript) {
        return res.status(400).json({ message: "This session already has a transcript" });
      }

      const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
      if (!bucketId) {
        return res.status(500).json({ message: "Object storage not configured" });
      }

      // Download the audio file from storage using the object key
      const { downloadFile } = await import("../objectStorage");
      const audioBuffer = await downloadFile(bucketId, session.audioObjectKey);

      // Determine mimetype from file extension
      const extension = session.audioObjectKey.split('.').pop() || 'webm';
      const mimetypes: Record<string, string> = {
        'webm': 'audio/webm',
        'mp4': 'audio/mp4',
        'wav': 'audio/wav',
        'mp3': 'audio/mpeg'
      };
      const mimetype = mimetypes[extension] || 'audio/webm';

      const { transcribeInterviewAudio, summarizeInterview } = await import("../aiService");

      const transcript = await transcribeInterviewAudio(audioBuffer, mimetype);

      const summaryResult = await summarizeInterview(
        transcript,
        session.intervieweeRole,
        session.intervieweeName || undefined
      );

      const updated = await storage.updateInterviewSession(sessionId, {
        transcript,
        summary: summaryResult.summary,
        painPoints: summaryResult.painPoints,
        themes: summaryResult.themes,
        transcribedAt: new Date(),
        summarizedAt: new Date(),
      });

      res.json(updated);
    } catch (error: any) {
      apiLogger.error({ err: error }, "Error retrying transcription");
      const message = error.message?.includes("Audio transcription is not available")
        ? error.message
        : "Failed to transcribe audio. Please try entering the transcript manually.";
      res.status(500).json({ message });
    }
  });

  // Summarize an interview that has a transcript but no summary
  app.post("/api/interview-sessions/:id/summarize", isAuthenticated, async (req: any, res) => {
    try {
      const sessionId = req.params.id;
      const userId = req.user.id;
      const currentUser = await storage.getUser(userId);

      if (!currentUser?.companyId) {
        return res.status(403).json({ message: "No company assigned" });
      }

      // Only admins and managers can summarize
      if (currentUser.role !== "admin" && currentUser.role !== "manager") {
        return res.status(403).json({ message: "Only admins and managers can summarize interviews" });
      }

      // Get the interview session and verify tenant ownership
      const session = await storage.getInterviewSession(sessionId);
      if (!session || session.companyId !== currentUser.companyId) {
        return res.status(404).json({ message: "Interview session not found" });
      }

      if (!session.transcript) {
        return res.status(400).json({ message: "Interview has no transcript to summarize" });
      }

      // Generate summary and extract pain points
      const { summarizeInterview } = await import("../aiService");

      const summaryResult = await summarizeInterview(
        session.transcript,
        session.intervieweeRole,
        session.intervieweeName || undefined
      );

      // Update the session with summary and pain points
      const updated = await storage.updateInterviewSession(sessionId, {
        summary: summaryResult.summary,
        painPoints: summaryResult.painPoints,
        themes: summaryResult.themes,
        summarizedAt: new Date(),
      });

      res.json(updated);
    } catch (error) {
      apiLogger.error({ err: error }, "Error summarizing interview");
      res.status(500).json({ message: "Failed to summarize interview" });
    }
  });

  // Generate interview rollup summary
  app.post("/api/interview-sessions/rollup", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const currentUser = await storage.getUser(userId);

      if (!currentUser?.companyId) {
        return res.status(403).json({ message: "No company assigned" });
      }

      const { assessmentId, clientCompanyId } = req.body;

      // Get all interviews for the company (tenant-scoped), then filter by assessment/client if provided
      let interviews = await storage.getInterviewSessionsByCompany(currentUser.companyId);
      if (assessmentId) {
        interviews = interviews.filter(i => i.assessmentDeliverableId === assessmentId);
      }
      if (clientCompanyId) {
        interviews = interviews.filter(i => i.clientCompanyId === clientCompanyId);
      }

      // Filter to only summarized interviews
      const summarizedInterviews = interviews.filter(i => i.summary && i.painPoints);

      if (summarizedInterviews.length === 0) {
        return res.status(400).json({ message: "No summarized interviews available for rollup" });
      }

      // Generate rollup
      const { generateInterviewRollup } = await import("../aiService");

      const rollup = await generateInterviewRollup(
        summarizedInterviews.map(i => ({
          role: i.intervieweeRole,
          name: i.intervieweeName || undefined,
          summary: i.summary || "",
          painPoints: (i.painPoints as any[]) || [],
          themes: (i.themes as string[]) || [],
        }))
      );

      res.json(rollup);
    } catch (error) {
      apiLogger.error({ err: error }, "Error generating interview rollup");
      res.status(500).json({ message: "Failed to generate interview rollup" });
    }
  });

  app.delete("/api/interview-sessions/:id", isAuthenticated, async (req: any, res) => {
    try {
      const sessionId = req.params.id;
      const userId = req.user.id;
      const currentUser = await storage.getUser(userId);

      if (!currentUser?.companyId) {
        return res.status(403).json({ message: "No company assigned" });
      }

      // Only admins and managers can delete interview sessions
      if (currentUser.role !== "admin" && currentUser.role !== "manager") {
        return res.status(403).json({ message: "Only admins and managers can delete interview sessions" });
      }

      // Verify the session belongs to this tenant
      const existingSession = await storage.getInterviewSession(sessionId);
      if (!existingSession || existingSession.companyId !== currentUser.companyId) {
        return res.status(404).json({ message: "Interview session not found" });
      }

      await storage.deleteInterviewSession(sessionId);
      res.status(204).send();
    } catch (error) {
      apiLogger.error({ err: error }, "Error deleting interview session");
      res.status(500).json({ message: "Failed to delete interview session" });
    }
  });

  // Excellence Program Resources/Documents endpoint
  app.get("/api/excellence-resources/:filename", isAuthenticated, async (req: any, res) => {
    try {
      const filename = decodeURIComponent(req.params.filename);

      // Security: sanitize filename to prevent path traversal
      const sanitizedFilename = path.basename(filename);
      const filePath = path.join(process.cwd(), "attached_assets", "path_to_excellence_docs", sanitizedFilename);

      // Check if file exists
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: "Resource not found" });
      }

      // Determine content type
      const ext = path.extname(sanitizedFilename).toLowerCase();
      const contentTypes: Record<string, string> = {
        ".pdf": "application/pdf",
        ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ".xltx": "application/vnd.openxmlformats-officedocument.spreadsheetml.template"
      };

      const contentType = contentTypes[ext] || "application/octet-stream";

      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Disposition", `attachment; filename="${sanitizedFilename}"`);

      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
    } catch (error) {
      apiLogger.error({ err: error }, "Error serving excellence resource");
      res.status(500).json({ message: "Failed to serve resource" });
    }
  });
}
