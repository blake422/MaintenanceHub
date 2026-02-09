import type { Express } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../customAuth";
import { authRateLimiter } from "../middleware/rateLimiter";
import { loadCurrentUser, requirePlatformAdmin, type AuthRequest } from "../middleware/rowLevelSecurity";
import { validateBody } from "../validation/middleware";
import {
  validateAccessKeySchema,
  switchRoleSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  createAccessKeySchema,
  updateAccessKeySchema,
} from "../validation/schemas";
import { apiLogger } from "../logger";

// Helper function to generate random access key
const generateAccessKey = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed confusing characters
  let key = '';
  for (let i = 0; i < 16; i++) {
    if (i > 0 && i % 4 === 0) key += '-';
    key += chars[Math.floor(Math.random() * chars.length)];
  }
  return key;
};

export function registerAuthRoutes(app: Express): void {
  // Get current authenticated user
  app.get("/api/auth/user", isAuthenticated as any, loadCurrentUser as any, async (req: any, res) => {
    try {
      const user = req.user || req.currentUser;
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Remove sensitive fields
      const { passwordHash, ...safeUser } = user;

      // Include company information with user
      interface UserWithCompany {
        company?: {
          id: string;
          name: string;
          licenseCount: number | null;
          usedLicenses: number | null;
        };
        [key: string]: unknown;
      }
      const userWithCompany: UserWithCompany = { ...safeUser };
      if (user.companyId) {
        const company = await storage.getCompany(user.companyId);
        if (company) {
          userWithCompany.company = {
            id: company.id,
            name: company.name,
            licenseCount: company.licenseCount,
            usedLicenses: company.usedLicenses,
          };
        }
      }

      res.json(userWithCompany);
    } catch (error) {
      apiLogger.error({ err: error }, "Error fetching user");
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Role switching (platform admin only)
  app.post("/api/auth/switch-role", isAuthenticated as any, loadCurrentUser as any, requirePlatformAdmin as any, validateBody(switchRoleSchema), async (req: any, res) => {
    try {
      const { userId, role } = req.body;
      const targetUserId = userId || req.currentUser!.id;

      const user = await storage.updateUser(targetUserId, { role });
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      apiLogger.info({ adminId: req.currentUser!.id, targetUserId, newRole: role }, "Role changed by platform admin");
      res.json(user);
    } catch (error) {
      apiLogger.error({ err: error }, "Error switching role");
      res.status(500).json({ message: "Failed to switch role" });
    }
  });

  // Switch package simulation (platform admin only) - for testing tier restrictions
  app.post("/api/auth/switch-package", isAuthenticated as any, loadCurrentUser as any, requirePlatformAdmin as any, async (req: any, res) => {
    try {
      const { packageType } = req.body;
      const user = req.currentUser!;
      
      if (!user.companyId) {
        return res.status(400).json({ message: "No company assigned to simulate package" });
      }

      // Valid package types for simulation
      const validPackages = ["troubleshooting", "operations", "full_access", "demo", null];
      if (!validPackages.includes(packageType)) {
        return res.status(400).json({ message: "Invalid package type" });
      }

      // Update the company's package type for simulation
      const company = await storage.updateCompany(user.companyId, { 
        packageType: packageType || "full_access" 
      });
      
      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }

      apiLogger.info(
        { adminId: user.id, companyId: user.companyId, packageType: packageType || "full_access" }, 
        "Package simulation changed by platform admin"
      );
      
      res.json({ packageType: company.packageType });
    } catch (error) {
      apiLogger.error({ err: error }, "Error switching package simulation");
      res.status(500).json({ message: "Failed to switch package" });
    }
  });

  // Validate access key (public - no auth required)
  app.post("/api/auth/validate-access-key", authRateLimiter, validateBody(validateAccessKeySchema), async (req, res) => {
    try {
      const { key } = req.body;

      // Trim whitespace and normalize the key
      const normalizedKey = key.trim().toUpperCase();

      const accessKey = await storage.getAccessKeyByKey(normalizedKey);

      if (!accessKey) {
        return res.status(404).json({ message: "Invalid access key" });
      }

      // Check if key is active
      if (!accessKey.isActive) {
        return res.status(403).json({ message: "This access key has been revoked" });
      }

      // Check if key is already used
      if (accessKey.usedById) {
        return res.status(403).json({ message: "This access key has already been used" });
      }

      // Check if key is expired
      if (accessKey.expiresAt && new Date(accessKey.expiresAt) < new Date()) {
        return res.status(403).json({ message: "This access key has expired" });
      }

      res.json({ valid: true, message: "Access key is valid" });
    } catch (error) {
      apiLogger.error({ err: error }, "Error validating access key");
      res.status(500).json({ message: "Failed to validate access key" });
    }
  });

  // Generate new access key (platform admin only)
  app.post("/api/admin/access-keys", isAuthenticated as any, loadCurrentUser as any, requirePlatformAdmin as any, validateBody(createAccessKeySchema), async (req: any, res) => {
    try {
      const { notes, expiresAt } = req.body;
      const key = generateAccessKey();

      const accessKey = await storage.createAccessKey({
        key,
        createdById: req.currentUser!.id,
        notes: notes || null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        isActive: true,
      });

      res.json(accessKey);
    } catch (error) {
      apiLogger.error({ err: error }, "Error creating access key");
      res.status(500).json({ message: "Failed to create access key" });
    }
  });

  // List all access keys (platform admin only)
  app.get("/api/admin/access-keys", isAuthenticated as any, loadCurrentUser as any, requirePlatformAdmin as any, async (req: any, res) => {
    try {
      const accessKeys = await storage.getAllAccessKeys();
      res.json(accessKeys);
    } catch (error) {
      apiLogger.error({ err: error }, "Error fetching access keys");
      res.status(500).json({ message: "Failed to fetch access keys" });
    }
  });

  // Update access key (platform admin only)
  app.patch("/api/admin/access-keys/:id", isAuthenticated as any, loadCurrentUser as any, requirePlatformAdmin as any, validateBody(updateAccessKeySchema), async (req: any, res) => {
    try {
      const { id } = req.params;
      const { isActive, notes, expiresAt } = req.body;

      const accessKey = await storage.updateAccessKey(id, {
        isActive,
        notes,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      });

      if (!accessKey) {
        return res.status(404).json({ message: "Access key not found" });
      }

      res.json(accessKey);
    } catch (error) {
      apiLogger.error({ err: error }, "Error updating access key");
      res.status(500).json({ message: "Failed to update access key" });
    }
  });

  // Delete access key (platform admin only)
  app.delete("/api/admin/access-keys/:id", isAuthenticated, loadCurrentUser, requirePlatformAdmin, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      await storage.deleteAccessKey(id);
      res.json({ message: "Access key deleted successfully" });
    } catch (error) {
      apiLogger.error({ err: error }, "Error deleting access key");
      res.status(500).json({ message: "Failed to delete access key" });
    }
  });

  // Request access (public - no auth required)
  app.post("/api/auth/request-access", authRateLimiter, validateBody(forgotPasswordSchema), async (req, res) => {
    try {
      const { email } = req.body;

      // Check if already exists in users table first
      const userExists = await storage.getUserByEmail(email);
      if (userExists) {
        return res.status(400).json({ message: "An account with this email already exists. Please login instead." });
      }

      // Check if already exists in signup requests
      const existing = await storage.getSignupRequestByEmail(email);
      if (existing) {
        if (existing.status === "pending") {
          return res.status(400).json({ message: "You've already requested access. Please wait for approval." });
        }
        if (existing.status === "approved") {
          // If the associated access key was deleted, allow a new request
          if (existing.accessKeyId) {
            const allKeys = await storage.getAllAccessKeys();
            const keyExists = allKeys.some(k => k.id === existing.accessKeyId);
            if (!keyExists) {
              // Delete the stale request so a new one can be created
              await storage.deleteSignupRequest(existing.id);
            } else {
              return res.status(400).json({ message: "Your request has already been approved. Please check your email for the access code." });
            }
          } else {
            // No accessKeyId, so it's effectively stale
            await storage.deleteSignupRequest(existing.id);
          }
        } else {
          return res.status(400).json({ message: "A request already exists for this email address." });
        }
      }

      // Create request
      const request = await storage.createSignupRequest({
        email,
        status: "pending",
      });

      res.json({ message: "Access request submitted. An admin will review it shortly.", requestId: request.id });
    } catch (error) {
      apiLogger.error({ err: error }, "Error requesting access");
      res.status(500).json({ message: "Failed to request access" });
    }
  });

  // Forgot password - request reset link
  app.post("/api/auth/forgot-password", authRateLimiter, validateBody(forgotPasswordSchema), async (req, res) => {
    try {
      const { email } = req.body;

      const user = await storage.getUserByEmail(email);

      // Always return success to prevent email enumeration
      if (!user) {
        return res.json({ message: "If an account exists with that email, a reset link has been sent." });
      }

      // Delete any existing tokens for this user
      await storage.deleteExpiredPasswordResetTokens(user.id);

      // Generate reset token
      const { randomBytes } = await import("crypto");
      const token = randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await storage.createPasswordResetToken(user.id, token, expiresAt);

      // Build the reset link using the request host
      const protocol = req.headers['x-forwarded-proto'] || 'https';
      const host = req.headers.host || 'www.maintenancehub.org';
      const resetLink = `${protocol}://${host}/reset-password?token=${token}`;

      // Send password reset email
      const { sendPasswordResetEmail } = await import("../emailService");
      try {
        const emailResult = await sendPasswordResetEmail({
          toEmail: user.email,
          resetLink,
        });
        if (emailResult && 'skipped' in emailResult && emailResult.skipped) {
          apiLogger.warn({ email: user.email, reason: emailResult.reason }, "Password reset email skipped - email not configured");
        } else {
          apiLogger.info({ email: user.email }, "Password reset email sent");
        }
      } catch (emailError) {
        apiLogger.error({ err: emailError, email: user.email }, "Failed to send password reset email");
      }

      res.json({ message: "If an account exists with that email, a reset link has been sent." });
    } catch (error) {
      apiLogger.error({ err: error }, "Error requesting password reset");
      res.status(500).json({ message: "Failed to request password reset" });
    }
  });

  // Reset password with token
  app.post("/api/auth/reset-password", authRateLimiter, validateBody(resetPasswordSchema), async (req, res) => {
    try {
      const { token, password } = req.body;

      const resetToken = await storage.getPasswordResetToken(token);

      if (!resetToken) {
        return res.status(400).json({ message: "Invalid or expired reset link" });
      }

      if (resetToken.usedAt) {
        return res.status(400).json({ message: "This reset link has already been used" });
      }

      if (new Date() > resetToken.expiresAt) {
        return res.status(400).json({ message: "This reset link has expired" });
      }

      // Hash the new password
      const bcrypt = await import("bcrypt");
      const { SALT_ROUNDS } = await import("../constants");
      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

      // Update user's password
      await storage.updateUser(resetToken.userId, { passwordHash });

      // Mark token as used
      await storage.markPasswordResetTokenUsed(resetToken.id);

      res.json({ message: "Password has been reset successfully" });
    } catch (error) {
      apiLogger.error({ err: error }, "Error resetting password");
      res.status(500).json({ message: "Failed to reset password" });
    }
  });

  app.get("/api/admin/signup-requests", isAuthenticated as any, loadCurrentUser as any, requirePlatformAdmin as any, async (req: any, res) => {
    try {
      const requests = await storage.getPendingSignupRequests();
      res.json(requests);
    } catch (error) {
      apiLogger.error({ err: error }, "Error fetching signup requests");
      res.status(500).json({ message: "Failed to fetch signup requests" });
    }
  });

  // Approve signup request (platform admin only)
  app.post("/api/admin/signup-requests/:id/approve", isAuthenticated as any, loadCurrentUser as any, requirePlatformAdmin as any, async (req: any, res) => {
    try {
      const { id } = req.params;

      // Read the request from DB to get actual record
      const pendingRequests = await storage.getPendingSignupRequests();
      const targetRequest = pendingRequests.find(r => r.id === id);

      if (!targetRequest) {
        return res.status(404).json({ message: "Signup request not found" });
      }

      // Generate access key
      const key = generateAccessKey();
      const accessKey = await storage.createAccessKey({
        key,
        createdById: req.currentUser!.id,
        notes: `Approved for ${targetRequest.email}`,
        isActive: true,
      });

      // Update request as approved
      await storage.updateSignupRequest(id, {
        status: "approved",
        approvedAt: new Date(),
        accessKeyId: accessKey.id,
      });

      // Send access code email
      const { sendAccessCodeEmail } = await import("../emailService");
      let emailSent = false;
      try {
        const emailResult = await sendAccessCodeEmail({
          toEmail: targetRequest.email,
          accessKey: key,
        });
        if (emailResult && 'skipped' in emailResult && emailResult.skipped) {
          apiLogger.warn({ email: targetRequest.email, reason: emailResult.reason }, "Access code email skipped");
        } else {
          emailSent = true;
          apiLogger.info({ email: targetRequest.email }, "Access code email sent");
        }
      } catch (emailError) {
        apiLogger.error({ err: emailError, email: targetRequest.email }, "Failed to send access code email");
      }

      apiLogger.info({ email: targetRequest.email, accessKey: key }, "Access code generated for signup request");

      const message = emailSent
        ? `Request approved! Access code sent to ${targetRequest.email}`
        : `Request approved! Access code: ${key} (email not configured - please share manually)`;
      res.json({ message, accessKey: key });
    } catch (error) {
      apiLogger.error({ err: error }, "Error approving signup request");
      res.status(500).json({ message: "Failed to approve request" });
    }
  });
}
