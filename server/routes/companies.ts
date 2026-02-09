import type { Express } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../customAuth";
import { insertCompanySchema } from "@shared/schema";
import { z } from "zod";
import { DEMO_EXPIRY_DAYS } from "../constants";
import { loadCurrentUser, requireAdmin, requirePlatformAdmin, type AuthRequest } from "../middleware/rowLevelSecurity";
import { validateBody } from "../validation/middleware";
import { updatePackageSchema } from "../validation/schemas";
import { apiLogger } from "../logger";
import { seedDefaultCilrTemplates } from "../seedCilrDefaults";

export function registerCompaniesRoutes(app: Express): void {
  // Get all companies (platform admin only)
  app.get("/api/companies", isAuthenticated, loadCurrentUser, requirePlatformAdmin, async (req: AuthRequest, res) => {
    try {
      const companies = await storage.getAllCompanies();
      res.json(companies);
    } catch (error) {
      apiLogger.error({ err: error }, "Error fetching companies");
      res.status(500).json({ message: "Failed to fetch companies" });
    }
  });

  // Get single company
  app.get("/api/companies/:id", isAuthenticated, loadCurrentUser, async (req: AuthRequest, res) => {
    try {
      const companyId = req.params.id;
      
      // Platform admins can access any company
      const isPlatformAdmin = req.currentUser?.platformRole === "platform_admin";

      // Users can only fetch their own company info (unless platform admin)
      if (!isPlatformAdmin && req.currentUser?.companyId !== companyId && req.currentUser?.role !== "admin") {
        return res.status(403).json({ message: "Forbidden" });
      }

      const company = await storage.getCompany(companyId);
      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }

      res.json(company);
    } catch (error) {
      apiLogger.error({ err: error }, "Error fetching company");
      res.status(500).json({ message: "Failed to fetch company" });
    }
  });

  // Update company package settings (admin only)
  app.put("/api/companies/:id/package", isAuthenticated, loadCurrentUser, requireAdmin, validateBody(updatePackageSchema), async (req: AuthRequest, res) => {
    try {
      const companyId = req.params.id;
      const { packageType, isLive, enabledModules, purchasedManagerSeats, purchasedTechSeats } = req.body;

      const company = await storage.getCompany(companyId);
      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }

      // Calculate demo expiration if switching to demo
      let demoExpiresAt = company.demoExpiresAt;
      if (packageType === "demo" && isLive === false && !company.demoExpiresAt) {
        const expirationDate = new Date();
        expirationDate.setDate(expirationDate.getDate() + DEMO_EXPIRY_DAYS);
        demoExpiresAt = expirationDate;
      } else if (isLive === true || packageType !== "demo") {
        // Clear demo expiration if going live or using paid package
        demoExpiresAt = null;
      }

      await storage.updateCompanyPackageSettings(companyId, {
        packageType,
        isLive,
        demoExpiresAt,
        enabledModules,
        purchasedManagerSeats,
        purchasedTechSeats,
      });

      const updatedCompany = await storage.getCompany(companyId);
      res.json(updatedCompany);
    } catch (error) {
      apiLogger.error({ err: error }, "Error updating company package");
      res.status(500).json({ message: "Failed to update company package" });
    }
  });

  // Delete company (admin only)
  app.delete("/api/companies/:id", isAuthenticated, loadCurrentUser, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const companyId = req.params.id;

      // Prevent deleting your own company
      if (req.currentUser!.companyId === companyId) {
        return res.status(400).json({ message: "Cannot delete your own company" });
      }

      const company = await storage.getCompany(companyId);

      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }

      await storage.deleteCompany(companyId);
      res.json({ message: "Company deleted successfully" });
    } catch (error) {
      apiLogger.error({ err: error }, "Error deleting company");
      res.status(500).json({ message: "Failed to delete company" });
    }
  });

  // Create company
  app.post("/api/companies", isAuthenticated, loadCurrentUser, async (req: AuthRequest, res) => {
    try {
      // Allow admin users or users without a company (onboarding) to create companies
      if (req.currentUser?.role !== "admin" && req.currentUser?.companyId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      let companyData = insertCompanySchema.parse(req.body);

      // Determine if this is a trial signup based on packageType
      // If no packageType specified or packageType is "demo", treat as trial
      const isTrial = !companyData.packageType || companyData.packageType === "demo";

      if (isTrial) {
        // Initialize trial with proper demo settings
        const expirationDate = new Date();
        expirationDate.setDate(expirationDate.getDate() + DEMO_EXPIRY_DAYS);

        companyData = {
          ...companyData,
          packageType: "demo",
          isLive: false,
          demoExpiresAt: expirationDate,
          purchasedManagerSeats: 2, // Admin uses 1 + can invite 1 more manager
          purchasedTechSeats: 1,    // Can invite 1 technician
          onboardingStage: "payment_complete", // Trials skip payment
        };

        apiLogger.info(
          { demoExpiresAt: expirationDate, purchasedManagerSeats: 2, purchasedTechSeats: 1 },
          "Creating trial company with demo settings"
        );
      } else {
        // Paid tier: set to pending_payment until webhook confirms
        companyData = {
          ...companyData,
          isLive: false,
          onboardingStage: "pending_payment",
        };

        apiLogger.info(
          { packageType: companyData.packageType },
          "Creating paid company with pending_payment status"
        );
      }

      // Security: Force onboardingCompleted to false to prevent bypass
      // Users must complete the full onboarding wizard
      const finalCompanyData = {
        ...companyData,
        onboardingCompleted: false,
      };

      // Debug logging to verify demoExpiresAt is being passed correctly
      apiLogger.info(
        {
          demoExpiresAt: finalCompanyData.demoExpiresAt,
          demoExpiresAtType: finalCompanyData.demoExpiresAt ? typeof finalCompanyData.demoExpiresAt : 'undefined',
          demoExpiresAtIsDate: finalCompanyData.demoExpiresAt instanceof Date,
          packageType: finalCompanyData.packageType,
          isTrial,
        },
        "Final company data before storage.createCompany"
      );

      const company = await storage.createCompany(finalCompanyData);

      // Verify the returned company has the correct values
      apiLogger.info(
        {
          companyId: company.id,
          demoExpiresAt: company.demoExpiresAt,
          packageType: company.packageType,
        },
        "Company created - verifying demoExpiresAt was saved"
      );

      // If this is a new user creating their first company, assign them to it as admin
      if (!req.currentUser?.companyId) {
        await storage.updateUser(req.currentUser!.id, {
          companyId: company.id,
          role: "admin",
        });
        
        // Seed default CILR templates for the new company
        try {
          await seedDefaultCilrTemplates(company.id, req.currentUser!.id);
          apiLogger.info({ companyId: company.id }, "Seeded default CILR templates for new company");
        } catch (seedError) {
          apiLogger.error({ err: seedError, companyId: company.id }, "Failed to seed default CILR templates");
        }
      }

      res.status(201).json(company);
    } catch (error) {
      apiLogger.error({ err: error }, "Error creating company");
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid request", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create company" });
    }
  });

  // Complete onboarding
  app.post("/api/onboarding/complete", isAuthenticated, loadCurrentUser, async (req: AuthRequest, res) => {
    try {
      if (!req.currentUser?.companyId) {
        return res.status(400).json({ message: "Cannot complete onboarding without a company" });
      }

      const company = await storage.getCompany(req.currentUser.companyId);
      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }

      // Payment verification based on package type
      if (company.packageType === "demo") {
        // Trial: must have demoExpiresAt set (indicates trial was properly initialized)
        if (!company.demoExpiresAt) {
          apiLogger.warn({ companyId: company.id }, "Trial company missing demoExpiresAt");
          return res.status(400).json({
            message: "Trial not properly initialized",
            code: "TRIAL_NOT_INITIALIZED",
          });
        }
        // Trials can complete immediately - they don't need payment
      } else {
        // Paid tier: must have active subscription confirmed by webhook
        // Check onboarding stage - if still pending_payment, payment hasn't been verified
        if (company.onboardingStage === "pending_payment" || company.onboardingStage === "plan_selected") {
          apiLogger.warn({ companyId: company.id, stage: company.onboardingStage }, "Payment not yet verified");
          return res.status(402).json({
            message: "Payment required to complete onboarding",
            code: "PAYMENT_PENDING",
          });
        }

        // Also verify subscription status from Stripe
        const activeStatuses = ["active", "trialing"];
        if (!company.subscriptionStatus || !activeStatuses.includes(company.subscriptionStatus)) {
          apiLogger.warn(
            { companyId: company.id, status: company.subscriptionStatus },
            "Subscription not active"
          );
          return res.status(402).json({
            message: "Active subscription required",
            code: "SUBSCRIPTION_INACTIVE",
            subscriptionStatus: company.subscriptionStatus,
          });
        }
      }

      await storage.completeOnboarding(req.currentUser.companyId);

      // Also update onboarding stage to completed
      await storage.updateCompanyOnboardingStage(req.currentUser.companyId, "completed");

      res.json({ success: true });
    } catch (error) {
      apiLogger.error({ err: error }, "Error completing onboarding");
      res.status(500).json({ message: "Failed to complete onboarding" });
    }
  });

  // Platform admin: manually set purchased licenses for any company
  app.put("/api/companies/:id/licenses", isAuthenticated, loadCurrentUser, requirePlatformAdmin, async (req: AuthRequest, res) => {
    try {
      const companyId = req.params.id;
      const { purchasedManagerSeats, purchasedTechSeats } = req.body;

      const company = await storage.getCompany(companyId);
      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }

      // Validate inputs
      if (typeof purchasedManagerSeats !== 'number' || purchasedManagerSeats < 0) {
        return res.status(400).json({ message: "Invalid manager seats value" });
      }
      if (typeof purchasedTechSeats !== 'number' || purchasedTechSeats < 0) {
        return res.status(400).json({ message: "Invalid tech seats value" });
      }

      // Update the company's purchased seats
      await storage.updateCompanyLicenses(companyId, {
        purchasedManagerSeats,
        purchasedTechSeats,
      });

      apiLogger.info(
        { companyId, purchasedManagerSeats, purchasedTechSeats, adminId: req.currentUser?.id },
        "Platform admin manually set company licenses"
      );

      const updatedCompany = await storage.getCompany(companyId);
      res.json(updatedCompany);
    } catch (error) {
      apiLogger.error({ err: error }, "Error updating company licenses");
      res.status(500).json({ message: "Failed to update company licenses" });
    }
  });
}
