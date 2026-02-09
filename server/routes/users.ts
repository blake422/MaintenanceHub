import type { Express } from "express";
import { storage } from "../storage";
import { db } from "../db";
import { isAuthenticated } from "../customAuth";
import {
  upsertUserSchema,
  users,
  invitations,
  accessKeys,
  passwordResetTokens,
  workOrders,
  rcaRecords,
  troubleshootingSessions,
  downtimeReports,
  trainingProgress,
  userBadges,
  certifications,
  interviewSessions,
  equipmentDocuments,
  cilrTemplates,
  cilrRuns,
  cilrTaskCompletions,
  cilrTaskMedia,
  centerlineTemplates,
  centerlineRuns,
  centerlineMeasurements,
  workOrderTemplates,
  clientCompanies,
  schematicProgress,
  timeEntries
} from "@shared/schema";
import { sendInvitationEmail } from "../emailService";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { loadCurrentUser, requireManagerOrAdmin, requireAdmin, type AuthRequest } from "../middleware/rowLevelSecurity";
import { validateBody } from "../validation/middleware";
import { createInvitationSchema, bulkDeleteUsersSchema, updateUserSchema } from "../validation/schemas";
import { apiLogger } from "../logger";

export function registerUsersRoutes(app: Express): void {
  // Get all users
  app.get("/api/users", isAuthenticated, loadCurrentUser, requireManagerOrAdmin, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const currentUser = await storage.getUser(userId);

      // Platform admins can see all users, company admins/managers see only their company
      const isPlatformAdmin = currentUser?.platformRole === "platform_admin";
      const users = isPlatformAdmin
        ? await storage.getAllUsers()
        : await storage.getUsersByCompany(currentUser!.companyId!);

      res.json(users);
    } catch (error) {
      apiLogger.error({ err: error }, "Error fetching users");
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Get available technicians with workload calculation
  app.get("/api/users/technicians/availability", isAuthenticated, loadCurrentUser, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const currentUser = await storage.getUser(userId);

      if (!currentUser?.companyId) {
        return res.status(403).json({ message: "No company assigned" });
      }

      // Get all company users
      const allUsers = await storage.getUsersByCompany(currentUser.companyId);

      // Filter for technicians
      const technicians = allUsers.filter(u => u.role === "tech");

      // Calculate workload for each technician
      const techniciansWithWorkload = await Promise.all(
        technicians.map(async (tech) => {
          const workOrders = await storage.getWorkOrdersByUser(tech.id);

          // Calculate total hours from open work orders
          const openWorkOrders = workOrders.filter(wo => wo.status === "open" || wo.status === "in_progress");
          const totalWorkloadHours = openWorkOrders.reduce((sum, wo) => {
            // Estimate 2 hours per work order if no time estimate exists
            const estimatedHours = (wo.totalTimeMinutes || 120) / 60;
            return sum + estimatedHours;
          }, 0);

          return {
            id: tech.id,
            email: tech.email,
            firstName: tech.firstName,
            lastName: tech.lastName,
            workloadHours: Math.round(totalWorkloadHours * 10) / 10, // Round to 1 decimal
            openWorkOrdersCount: openWorkOrders.length,
          };
        })
      );

      // Sort by lowest workload first
      techniciansWithWorkload.sort((a, b) => a.workloadHours - b.workloadHours);

      res.json(techniciansWithWorkload);
    } catch (error) {
      apiLogger.error({ err: error }, "Error fetching technician availability");
      res.status(500).json({ message: "Failed to fetch technician availability" });
    }
  });

  // Update user
  app.put("/api/users/:id", isAuthenticated, loadCurrentUser, requireManagerOrAdmin, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const currentUser = await storage.getUser(userId);

      const targetUserId = req.params.id;
      const targetUser = await storage.getUser(targetUserId);

      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }

      const isPlatformAdmin = currentUser?.platformRole === "platform_admin";

      // Platform admins can update any user across companies
      // Managers can only update users in their company
      // Admins can update users in their company
      if (!isPlatformAdmin) {
        if (currentUser!.role === "manager" && targetUser.companyId !== currentUser!.companyId) {
          return res.status(403).json({ message: "Forbidden" });
        }
        if (currentUser!.role === "admin" && targetUser.companyId !== currentUser!.companyId) {
          return res.status(403).json({ message: "Forbidden" });
        }
      }

      const userData = upsertUserSchema.partial().parse(req.body);

      // License enforcement: Use atomic function when assigning to a new company
      // Platform admins bypass license checks - they can move users freely
      if (userData.companyId && userData.companyId !== targetUser.companyId) {
        if (isPlatformAdmin) {
          // Platform admins bypass license checks - direct update
          const updatedUser = await storage.updateUser(targetUserId, {
            ...userData,
            companyId: userData.companyId,
          });

          // Update company's used licenses count
          const company = await storage.getCompany(userData.companyId);
          if (company) {
            const companyUsers = await storage.getUsersByCompany(userData.companyId);
            await storage.updateCompany(company.id, { usedLicenses: companyUsers.length });
          }

          return res.json(updatedUser);
        }

        // Non-platform admin: Atomic license check prevents TOCTOU race conditions
        const result = await storage.addUserToCompanyWithLicenseCheck(
          targetUserId,
          userData.companyId,
          userData
        );

        if (!result.success) {
          return res.status(403).json({
            message: "License limit reached",
            details: result.error
          });
        }

        // Update company's used licenses count
        const company = await storage.getCompany(userData.companyId);
        if (company) {
          const companyUsers = await storage.getUsersByCompany(userData.companyId);
          await storage.updateCompany(company.id, { usedLicenses: companyUsers.length });
        }

        return res.json(result.user);
      }

      // Regular update without company change
      const updatedUser = await storage.updateUser(targetUserId, userData);

      // Update company's used licenses count
      if (updatedUser && updatedUser.companyId) {
        const company = await storage.getCompany(updatedUser.companyId);
        if (company) {
          const companyUsers = await storage.getUsersByCompany(updatedUser.companyId);
          await storage.updateCompany(company.id, { usedLicenses: companyUsers.length });
        }
      }

      res.json(updatedUser);
    } catch (error) {
      apiLogger.error({ err: error }, "Error updating user");
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid request", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  // Delete user
  app.delete("/api/users/:id", isAuthenticated, loadCurrentUser, requireManagerOrAdmin, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const currentUser = await storage.getUser(userId);

      const targetUserId = req.params.id;
      const targetUser = await storage.getUser(targetUserId);

      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Prevent deleting yourself
      if (targetUserId === userId) {
        return res.status(400).json({ message: "You cannot delete your own account" });
      }

      // Managers can only delete users in their company
      // Platform admins can delete users across all companies
      const isPlatformAdmin = currentUser?.platformRole === "platform_admin";
      if (!isPlatformAdmin && currentUser!.role === "manager" && targetUser.companyId !== currentUser!.companyId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      // Clear all foreign key references before deleting user
      // Access keys
      await db.update(accessKeys).set({ usedById: null }).where(eq(accessKeys.usedById, targetUserId));
      await db.update(accessKeys).set({ createdById: null }).where(eq(accessKeys.createdById, targetUserId));

      // Delete password reset tokens (owned by user)
      await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, targetUserId));

      // Clear invitation references
      await db.update(invitations).set({ invitedBy: null }).where(eq(invitations.invitedBy, targetUserId));

      // Clear work order references
      await db.update(workOrders).set({ assignedToId: null }).where(eq(workOrders.assignedToId, targetUserId));
      await db.update(workOrders).set({ createdById: null }).where(eq(workOrders.createdById, targetUserId));
      await db.update(workOrders).set({ submittedById: null }).where(eq(workOrders.submittedById, targetUserId));
      await db.update(workOrders).set({ approvedById: null }).where(eq(workOrders.approvedById, targetUserId));

      // Clear work order template references
      await db.update(workOrderTemplates).set({ createdById: null }).where(eq(workOrderTemplates.createdById, targetUserId));

      // Clear RCA references
      await db.update(rcaRecords).set({ createdById: null }).where(eq(rcaRecords.createdById, targetUserId));

      // Clear troubleshooting session references
      await db.update(troubleshootingSessions).set({ createdById: null }).where(eq(troubleshootingSessions.createdById, targetUserId));

      // Clear downtime report references
      await db.update(downtimeReports).set({ createdById: null }).where(eq(downtimeReports.createdById, targetUserId));

      // Delete training progress (owned by user)
      await db.delete(trainingProgress).where(eq(trainingProgress.userId, targetUserId));

      // Delete user badges (owned by user)
      await db.delete(userBadges).where(eq(userBadges.userId, targetUserId));

      // Delete certifications (owned by user)
      await db.delete(certifications).where(eq(certifications.userId, targetUserId));

      // Clear client companies references
      await db.update(clientCompanies).set({ createdById: null }).where(eq(clientCompanies.createdById, targetUserId));

      // Clear interview session references
      await db.update(interviewSessions).set({ conductedById: null }).where(eq(interviewSessions.conductedById, targetUserId));

      // Clear equipment documents references
      await db.update(equipmentDocuments).set({ uploadedById: null }).where(eq(equipmentDocuments.uploadedById, targetUserId));

      // Delete schematic progress (owned by user)
      await db.delete(schematicProgress).where(eq(schematicProgress.userId, targetUserId));

      // Delete time entries (owned by user)
      await db.delete(timeEntries).where(eq(timeEntries.userId, targetUserId));

      // Clear CILR references
      await db.update(cilrTemplates).set({ createdBy: null }).where(eq(cilrTemplates.createdBy, targetUserId));
      await db.update(cilrRuns).set({ assignedTo: null }).where(eq(cilrRuns.assignedTo, targetUserId));
      await db.update(cilrTaskCompletions).set({ completedBy: null }).where(eq(cilrTaskCompletions.completedBy, targetUserId));
      await db.update(cilrTaskMedia).set({ uploadedBy: null }).where(eq(cilrTaskMedia.uploadedBy, targetUserId));

      // Clear centerline references
      await db.update(centerlineTemplates).set({ createdBy: null }).where(eq(centerlineTemplates.createdBy, targetUserId));
      await db.update(centerlineRuns).set({ assignedTo: null }).where(eq(centerlineRuns.assignedTo, targetUserId));
      await db.update(centerlineMeasurements).set({ measuredBy: null }).where(eq(centerlineMeasurements.measuredBy, targetUserId));

      // Delete the user
      await db.delete(users).where(eq(users.id, targetUserId));

      // Update company's used licenses count
      if (targetUser.companyId) {
        const company = await storage.getCompany(targetUser.companyId);
        if (company) {
          const companyUsers = await storage.getUsersByCompany(targetUser.companyId);
          await storage.updateCompany(company.id, { usedLicenses: companyUsers.length });
        }
      }

      res.json({ success: true, message: "User deleted successfully" });
    } catch (error) {
      apiLogger.error({ err: error }, "Error deleting user");
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // Bulk delete users (admin only)
  app.post("/api/users/bulk-delete", isAuthenticated, loadCurrentUser, requireAdmin, validateBody(bulkDeleteUsersSchema), async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const currentUser = await storage.getUser(userId);

      const { userIds } = req.body;

      apiLogger.debug({ userIds, count: userIds.length }, "Bulk delete request received");

      let deletedCount = 0;
      let skippedCount = 0;
      const errors: string[] = [];

      for (const targetUserId of userIds) {
        let targetUser = null;
        try {
          // Prevent deleting yourself
          if (targetUserId === userId) {
            skippedCount++;
            errors.push(`Cannot delete your own account`);
            continue;
          }

          targetUser = await storage.getUser(targetUserId);

          if (!targetUser) {
            skippedCount++;
            errors.push(`User ${targetUserId} not found`);
            continue;
          }

          // Clear all foreign key references before deleting user
          // Access keys
          await db.update(accessKeys).set({ usedById: null }).where(eq(accessKeys.usedById, targetUserId));
          await db.update(accessKeys).set({ createdById: null }).where(eq(accessKeys.createdById, targetUserId));

          // Delete password reset tokens (owned by user)
          await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, targetUserId));

          // Clear invitation references
          await db.update(invitations).set({ invitedBy: null }).where(eq(invitations.invitedBy, targetUserId));

          // Clear work order references
          await db.update(workOrders).set({ assignedToId: null }).where(eq(workOrders.assignedToId, targetUserId));
          await db.update(workOrders).set({ createdById: null }).where(eq(workOrders.createdById, targetUserId));
          await db.update(workOrders).set({ submittedById: null }).where(eq(workOrders.submittedById, targetUserId));
          await db.update(workOrders).set({ approvedById: null }).where(eq(workOrders.approvedById, targetUserId));

          // Clear work order template references
          await db.update(workOrderTemplates).set({ createdById: null }).where(eq(workOrderTemplates.createdById, targetUserId));

          // Clear RCA references
          await db.update(rcaRecords).set({ createdById: null }).where(eq(rcaRecords.createdById, targetUserId));

          // Clear troubleshooting session references
          await db.update(troubleshootingSessions).set({ createdById: null }).where(eq(troubleshootingSessions.createdById, targetUserId));

          // Clear downtime report references
          await db.update(downtimeReports).set({ createdById: null }).where(eq(downtimeReports.createdById, targetUserId));

          // Delete training progress (owned by user)
          await db.delete(trainingProgress).where(eq(trainingProgress.userId, targetUserId));

          // Delete user badges (owned by user)
          await db.delete(userBadges).where(eq(userBadges.userId, targetUserId));

          // Delete certifications (owned by user)
          await db.delete(certifications).where(eq(certifications.userId, targetUserId));

          // Clear client companies references
          await db.update(clientCompanies).set({ createdById: null }).where(eq(clientCompanies.createdById, targetUserId));

          // Clear interview session references
          await db.update(interviewSessions).set({ conductedById: null }).where(eq(interviewSessions.conductedById, targetUserId));

          // Clear equipment documents references
          await db.update(equipmentDocuments).set({ uploadedById: null }).where(eq(equipmentDocuments.uploadedById, targetUserId));

          // Delete schematic progress (owned by user)
          await db.delete(schematicProgress).where(eq(schematicProgress.userId, targetUserId));

          // Delete time entries (owned by user)
          await db.delete(timeEntries).where(eq(timeEntries.userId, targetUserId));

          // Clear CILR references
          await db.update(cilrTemplates).set({ createdBy: null }).where(eq(cilrTemplates.createdBy, targetUserId));
          await db.update(cilrRuns).set({ assignedTo: null }).where(eq(cilrRuns.assignedTo, targetUserId));
          await db.update(cilrTaskCompletions).set({ completedBy: null }).where(eq(cilrTaskCompletions.completedBy, targetUserId));
          await db.update(cilrTaskMedia).set({ uploadedBy: null }).where(eq(cilrTaskMedia.uploadedBy, targetUserId));

          // Clear centerline references
          await db.update(centerlineTemplates).set({ createdBy: null }).where(eq(centerlineTemplates.createdBy, targetUserId));
          await db.update(centerlineRuns).set({ assignedTo: null }).where(eq(centerlineRuns.assignedTo, targetUserId));
          await db.update(centerlineMeasurements).set({ measuredBy: null }).where(eq(centerlineMeasurements.measuredBy, targetUserId));

          // Delete the user
          await db.delete(users).where(eq(users.id, targetUserId));
          deletedCount++;
          apiLogger.debug({ targetUserId }, "User deleted successfully");

          // Update company's used licenses count
          if (targetUser.companyId) {
            const company = await storage.getCompany(targetUser.companyId);
            if (company) {
              const companyUsers = await storage.getUsersByCompany(targetUser.companyId);
              await storage.updateCompany(company.id, { usedLicenses: companyUsers.length });
            }
          }
        } catch (error) {
          apiLogger.warn({ err: error, targetUserId }, "Error deleting user in bulk operation");
          skippedCount++;

          let errorMessage = 'Unknown error';
          if (error instanceof Error) {
            if (error.message.includes('foreign key constraint') || error.message.includes('violates')) {
              errorMessage = 'User has associated data (work orders, etc.) and cannot be deleted';
            } else {
              errorMessage = error.message;
            }
          }
          errors.push(`${targetUser?.email || targetUserId}: ${errorMessage}`);
        }
      }

      apiLogger.info({ deletedCount, skippedCount, totalRequested: userIds.length }, "Bulk delete completed");

      res.json({
        success: true,
        deletedCount,
        skippedCount,
        totalRequested: userIds.length,
        errors: errors.length > 0 ? errors : undefined
      });
    } catch (error) {
      apiLogger.error({ err: error }, "Error bulk deleting users");
      res.status(500).json({ message: "Failed to bulk delete users" });
    }
  });

  // Invitation routes
  app.post("/api/invitations", isAuthenticated, loadCurrentUser, validateBody(createInvitationSchema), async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const currentUser = await storage.getUser(userId);

      // Platform admins can invite to any company, regular admins/managers only to their own
      const isPlatformAdmin = currentUser?.platformRole === "platform_admin";

      if (!currentUser || (!isPlatformAdmin && !currentUser.companyId) ||
          (!isPlatformAdmin && currentUser.role !== "admin" && currentUser.role !== "manager")) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const { email, role, companyId: requestedCompanyId } = req.body;

      // Determine target company
      let targetCompanyId: string;
      if (isPlatformAdmin && requestedCompanyId) {
        // Platform admin can specify any company
        const targetCompany = await storage.getCompany(requestedCompanyId);
        if (!targetCompany) {
          return res.status(400).json({ message: "Selected company not found" });
        }
        targetCompanyId = requestedCompanyId;
      } else if (currentUser.companyId) {
        // Regular admin/manager uses their own company
        targetCompanyId = currentUser.companyId;
      } else {
        return res.status(400).json({ message: "No company specified for invitation" });
      }

      // Check if user already exists
      const existingUser = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (existingUser.length > 0) {
        return res.status(400).json({ message: "User with this email already exists" });
      }

      // Check if there's already a pending invitation
      const existingInvitation = await storage.getInvitationByEmail(email);
      if (existingInvitation) {
        return res.status(400).json({ message: "Invitation already sent to this email" });
      }

      // Generate unique token
      const crypto = await import('crypto');
      const token = crypto.randomBytes(32).toString('hex');

      // Set expiration to 7 days from now
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      // Platform admins bypass seat checks
      let invitation;
      if (currentUser.platformRole === 'platform_admin') {
        // Create invitation without license check for platform admins
        invitation = await storage.createInvitation({
          companyId: targetCompanyId,
          email,
          role,
          invitedBy: userId,
          token,
          status: "pending",
          expiresAt,
        });
      } else {
        // Atomic license check prevents TOCTOU race conditions
        const result = await storage.createInvitationWithLicenseCheck(
          targetCompanyId,
          {
            companyId: targetCompanyId,
            email,
            role,
            invitedBy: userId,
            token,
            status: "pending",
            expiresAt,
          }
        );

        if (!result.success) {
          return res.status(403).json({
            message: "License limit reached",
            details: result.error
          });
        }
        invitation = result.invitation!;
      }

      const company = await storage.getCompany(targetCompanyId);

      // Send invitation email
      if (company) {
        const inviterName = `${currentUser.firstName} ${currentUser.lastName}`.trim() || currentUser.email || "A team member";
        // Use CUSTOM_DOMAIN if set, otherwise construct from request
        const baseUrl = process.env.CUSTOM_DOMAIN
          ? `https://${process.env.CUSTOM_DOMAIN}`
          : `${req.protocol}://${req.get('host')}`;
        const inviteLink = `${baseUrl}/login?token=${token}&email=${encodeURIComponent(email)}`;

        try {
          apiLogger.info({ email }, "Sending invitation email");
          const emailResult = await sendInvitationEmail({
            toEmail: email,
            inviterName,
            companyName: company.name,
            role,
            inviteLink,
          });
          if (emailResult && 'skipped' in emailResult && emailResult.skipped) {
            apiLogger.warn({ email, reason: emailResult.reason }, "Invitation email skipped - email not configured");
          } else {
            apiLogger.info({ email }, "Invitation email sent successfully");
          }
        } catch (emailError) {
          const err = emailError instanceof Error ? emailError : new Error(String(emailError));
          apiLogger.error({ err, email }, "Failed to send invitation email");
        }
      }

      res.status(201).json(invitation);
    } catch (error) {
      apiLogger.error({ err: error }, "Error creating invitation");
      res.status(500).json({ message: "Failed to create invitation" });
    }
  });

  // Get invitations
  app.get("/api/invitations", isAuthenticated, loadCurrentUser, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const currentUser = await storage.getUser(userId);

      const isPlatformAdmin = currentUser?.platformRole === "platform_admin";

      if (!currentUser || (!isPlatformAdmin && !currentUser.companyId) ||
          (!isPlatformAdmin && currentUser.role !== "admin" && currentUser.role !== "manager")) {
        return res.status(403).json({ message: "Forbidden" });
      }

      // Platform admins can optionally filter by company, or see all
      const filterCompanyId = req.query.companyId as string | undefined;

      if (isPlatformAdmin && filterCompanyId) {
        const invitations = await storage.getInvitationsByCompany(filterCompanyId);
        res.json(invitations);
      } else if (isPlatformAdmin && !filterCompanyId) {
        // Get all invitations across all companies for platform admin
        const allCompanies = await storage.getAllCompanies();
        const allInvitations: any[] = [];
        for (const company of allCompanies) {
          const companyInvitations = await storage.getInvitationsByCompany(company.id);
          allInvitations.push(...companyInvitations.map(inv => ({ ...inv, companyName: company.name })));
        }
        res.json(allInvitations);
      } else if (currentUser.companyId) {
        const invitations = await storage.getInvitationsByCompany(currentUser.companyId);
        res.json(invitations);
      } else {
        res.json([]);
      }
    } catch (error) {
      apiLogger.error({ err: error }, "Error fetching invitations");
      res.status(500).json({ message: "Failed to fetch invitations" });
    }
  });

  // Delete invitation
  app.delete("/api/invitations/:id", isAuthenticated, loadCurrentUser, requireManagerOrAdmin, async (req: AuthRequest, res) => {
    try {
      const currentUser = await storage.getUser(req.user!.id);
      const isPlatformAdmin = currentUser?.platformRole === "platform_admin";

      if (!isPlatformAdmin && !currentUser?.companyId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const invitationId = req.params.id;
      const invitation = await db.select().from(invitations).where(eq(invitations.id, invitationId)).limit(1);

      if (invitation.length === 0) {
        return res.status(404).json({ message: "Invitation not found" });
      }

      // Platform admins can delete any invitation; others only from their company
      if (!isPlatformAdmin && invitation[0].companyId !== currentUser?.companyId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      await storage.deleteInvitation(invitationId);
      res.json({ success: true });
    } catch (error) {
      apiLogger.error({ err: error }, "Error deleting invitation");
      res.status(500).json({ message: "Failed to delete invitation" });
    }
  });
}
