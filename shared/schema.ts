import { sql } from "drizzle-orm";
import { relations } from "drizzle-orm";
import {
  pgTable,
  varchar,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  index,
  pgEnum,
  real,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table - required for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);

// Enums
export const platformRoleEnum = pgEnum("platform_role", [
  "platform_admin", // C4 staff who manage the platform
  "customer_user",  // Regular customer company users
]);
export const userRoleEnum = pgEnum("user_role", ["admin", "manager", "tech"]);
export const workOrderStatusEnum = pgEnum("work_order_status", [
  "draft",           // Tech-created, needs approval
  "pending_approval", // Submitted for manager approval
  "open",
  "in_progress",
  "completed",
  "cancelled",
]);
export const workOrderPriorityEnum = pgEnum("work_order_priority", [
  "low",
  "medium",
  "high",
  "critical",
]);
export const workOrderTypeEnum = pgEnum("work_order_type", [
  "corrective",
  "preventive",
  "inspection",
]);
export const aiRecommendationTypeEnum = pgEnum("ai_recommendation_type", [
  "pm_schedule",
  "parts_order",
  "work_order",
]);
export const aiRecommendationStatusEnum = pgEnum("ai_recommendation_status", [
  "pending",
  "approved",
  "rejected",
]);
export const packageTypeEnum = pgEnum("package_type", [
  "full_access",    // $100/mo - All modules
  "operations",     // $50/mo - Operations, RCA, Troubleshooting, Planning
  "troubleshooting", // $20/mo - RCA and Troubleshooting only
  "demo",           // Free 30-day trial
]);
export const onboardingStageEnum = pgEnum("onboarding_stage", [
  "not_started",     // User just signed up
  "company_created", // Company profile created
  "plan_selected",   // Subscription plan selected
  "pending_payment", // Payment initiated but not yet confirmed by webhook
  "payment_complete",// Payment processed (or demo activated)
  "completed",       // Onboarding fully complete
]);
export const assetLevelEnum = pgEnum("asset_level", [
  "site",       // Top level - Plant/Facility
  "area",       // Area or Department within site
  "line",       // Production line or system
  "equipment",  // Individual machine or equipment
  "component",  // Sub-component of equipment
]);
export const timeEntryTypeEnum = pgEnum("time_entry_type", [
  "work",    // Active work on the task
  "break",   // Break/pause period
]);
export const breakReasonEnum = pgEnum("break_reason", [
  "lunch",        // Lunch break
  "parts_wait",   // Waiting for parts/materials
  "meeting",      // Attending meeting
  "personal",     // Personal break
  "other",        // Other reason (use notes field)
]);

// Form Archetype Enum for Path to Excellence Forms
export const formArchetypeEnum = pgEnum("form_archetype", [
  "data_table",     // Table-based data entry (equipment lists, scores)
  "calculation",    // Calculation tools with auto-computed fields
  "planning",       // Scheduling/calendar forms
  "document",       // Document templates
  "evidence",       // File upload + completion attestation
]);

// Stripe Configuration Cache - Store product/price IDs to avoid recreating
export const stripeConfig = pgTable("stripe_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: varchar("key", { length: 100 }).notNull().unique(),
  value: varchar("value", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type StripeConfig = typeof stripeConfig.$inferSelect;

// Companies Table - Multi-tenant support
export const companies = pgTable("companies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  licenseCount: integer("license_count").default(0), // Number of licenses purchased
  usedLicenses: integer("used_licenses").default(0), // Number of active users
  packageType: packageTypeEnum("package_type").default("demo"), // Subscription package
  isLive: boolean("is_live").default(false), // true = live, false = demo
  demoExpiresAt: timestamp("demo_expires_at"), // Demo expiration date (30 days from creation)
  enabledModules: jsonb("enabled_modules").$type<string[]>().default([]), // Enabled module names
  stripeCustomerId: varchar("stripe_customer_id"), // Stripe customer ID for billing
  stripeSubscriptionId: varchar("stripe_subscription_id"), // Stripe subscription ID
  stripeManagerItemId: varchar("stripe_manager_item_id"), // Stripe subscription item ID for manager seats
  stripeTechItemId: varchar("stripe_tech_item_id"), // Stripe subscription item ID for tech seats
  subscriptionStatus: varchar("subscription_status"), // active, past_due, canceled, trialing
  purchasedManagerSeats: integer("purchased_manager_seats").default(0), // Pre-purchased manager/admin seats
  purchasedTechSeats: integer("purchased_tech_seats").default(0), // Pre-purchased technician seats
  paymentRestricted: boolean("payment_restricted").default(false), // True when payment failed - restricts write access
  onboardingCompleted: boolean("onboarding_completed").default(false),
  onboardingStage: onboardingStageEnum("onboarding_stage").default("not_started"), // Track onboarding progress
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertCompanySchema = createInsertSchema(companies).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type Company = typeof companies.$inferSelect;

// Form Definitions Table - Store dynamic form schemas for Path to Excellence
export const formDefinitions = pgTable("form_definitions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  formType: varchar("form_type", { length: 100 }).notNull().unique(), // e.g., "failure_history", "mtbf_calculator"
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  archetype: formArchetypeEnum("archetype").notNull(),
  schema: jsonb("schema").notNull(), // JSON schema defining fields, tables, calculations
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertFormDefinitionSchema = createInsertSchema(formDefinitions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertFormDefinition = z.infer<typeof insertFormDefinitionSchema>;
export type FormDefinition = typeof formDefinitions.$inferSelect;

// TypeScript types for Form Schema (stored in JSONB)
export interface FormFieldDefinition {
  id: string;
  label: string;
  type: "text" | "number" | "date" | "select" | "checkbox" | "textarea" | "file";
  placeholder?: string;
  required?: boolean;
  options?: { value: string; label: string }[]; // For select fields
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
  };
}

export interface FormTableColumn extends FormFieldDefinition {
  width?: string; // Tailwind width class
  calculated?: string; // Formula name for auto-calculated fields
}

export interface FormCalculation {
  id: string;
  formula: string; // Formula name (registered in calculation registry)
  inputs: string[]; // Field IDs used in calculation
  output: string; // Field ID to store result
}

export interface DataTableSchema {
  columns: FormTableColumn[];
  allowAdd: boolean;
  allowDelete: boolean;
  calculations?: FormCalculation[];
}

export interface CalculationSchema extends DataTableSchema {
  // Inherits from DataTableSchema but emphasizes calculations
  displaySummary?: {
    label: string;
    aggregation: "sum" | "avg" | "count" | "min" | "max";
    fields: string[];
  }[];
}

export interface PlanningSchema {
  fields: FormFieldDefinition[];
  calendarConfig?: {
    type: "weekly" | "monthly" | "daily";
    eventFields: string[]; // Which fields map to calendar events
  };
}

export interface DocumentSchema {
  template: string; // Template HTML/Markdown
  fields: FormFieldDefinition[]; // Fields to fill in template
  downloadFormat: "pdf" | "docx" | "md";
}

export interface EvidenceSchema {
  completionFields: FormFieldDefinition[];
  fileUpload: {
    accept: string; // MIME types
    maxFiles: number;
    maxSizeMB: number;
  };
}

export type FormSchema = 
  | { archetype: "data_table"; config: DataTableSchema }
  | { archetype: "calculation"; config: CalculationSchema }
  | { archetype: "planning"; config: PlanningSchema }
  | { archetype: "document"; config: DocumentSchema }
  | { archetype: "evidence"; config: EvidenceSchema };

// Users Table - Extended for custom auth
export const users = pgTable("users", {
  id: varchar("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }),
  firstName: varchar("first_name", { length: 255 }),
  lastName: varchar("last_name", { length: 255 }),
  profileImageUrl: varchar("profile_image_url", { length: 500 }),
  companyId: varchar("company_id").references(() => companies.id),
  role: userRoleEnum("role").default("tech"),
  department: varchar("department", { length: 255 }),
  platformRole: platformRoleEnum("platform_role").default("customer_user"),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("IDX_users_company").on(table.companyId),
  index("IDX_users_email").on(table.email),
]);

export const upsertUserSchema = createInsertSchema(users).omit({
  createdAt: true,
  updatedAt: true,
});
export type UpsertUser = z.infer<typeof upsertUserSchema>;
export type User = typeof users.$inferSelect;

// Access Keys Table - Admin-generated keys required for signup
export const accessKeys = pgTable("access_keys", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: varchar("key", { length: 50 }).notNull().unique(),
  createdById: varchar("created_by_id")
    .references(() => users.id),
  usedById: varchar("used_by_id").references(() => users.id),
  usedAt: timestamp("used_at"),
  expiresAt: timestamp("expires_at"),
  isActive: boolean("is_active").default(true),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAccessKeySchema = createInsertSchema(accessKeys).omit({
  id: true,
  createdAt: true,
  usedAt: true,
  usedById: true,
});
export type InsertAccessKey = z.infer<typeof insertAccessKeySchema>;
export type AccessKey = typeof accessKeys.$inferSelect;

// Signup Requests Table - Users requesting access
export const signupRequests = pgTable("signup_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email", { length: 255 }).notNull().unique(),
  status: varchar("status", { length: 50 }).default("pending"), // pending, approved, rejected
  accessKeyId: varchar("access_key_id").references(() => accessKeys.id),
  rejectedReason: text("rejected_reason"),
  createdAt: timestamp("created_at").defaultNow(),
  approvedAt: timestamp("approved_at"),
  rejectedAt: timestamp("rejected_at"),
});

export const insertSignupRequestSchema = createInsertSchema(signupRequests).omit({
  id: true,
  createdAt: true,
  approvedAt: true,
  rejectedAt: true,
  accessKeyId: true,
});
export type InsertSignupRequest = z.infer<typeof insertSignupRequestSchema>;
export type SignupRequest = typeof signupRequests.$inferSelect;

// Password Reset Tokens Table - For forgot password functionality
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id),
  token: varchar("token", { length: 255 }).notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;

// Invitations Table
export const invitations = pgTable("invitations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id")
    .notNull()
    .references(() => companies.id),
  email: varchar("email", { length: 255 }).notNull(),
  role: userRoleEnum("role").default("tech"),
  invitedBy: varchar("invited_by")
    .references(() => users.id),
  token: varchar("token", { length: 255 }).notNull().unique(),
  status: varchar("status", { length: 50 }).default("pending"),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("IDX_invitations_email").on(table.email),
  index("IDX_invitations_company").on(table.companyId),
]);

export const insertInvitationSchema = createInsertSchema(invitations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertInvitation = z.infer<typeof insertInvitationSchema>;
export type Invitation = typeof invitations.$inferSelect;

// Equipment Table
export const equipment = pgTable("equipment", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id")
    .notNull()
    .references(() => companies.id),
  name: varchar("name", { length: 255 }).notNull(),
  assetTag: varchar("asset_tag", { length: 100 }),
  equipmentType: varchar("equipment_type", { length: 255 }),
  description: text("description"),
  manufacturer: varchar("manufacturer", { length: 255 }),
  model: varchar("model", { length: 255 }),
  serialNumber: varchar("serial_number", { length: 255 }),
  location: varchar("location", { length: 255 }),
  parentEquipmentId: varchar("parent_equipment_id").references(
    (): AnyPgColumn => equipment.id
  ),
  hierarchyPath: text("hierarchy_path"),
  assetLevel: assetLevelEnum("asset_level").default("equipment"),
  level: assetLevelEnum("level").default("equipment"),
  category: varchar("category", { length: 100 }),
  criticalityScore: integer("criticality_score"),
  commissionedDate: timestamp("commissioned_date"),
  warrantyExpiryDate: timestamp("warranty_expiry_date"),
  status: varchar("status", { length: 50 }).default("active"),
  notes: text("notes"),
  manualUrl: text("manual_url"),
  qrCode: text("qr_code"),
  photoUrls: jsonb("photo_urls").$type<string[]>().default([]),
  imageUrl: varchar("image_url", { length: 500 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("IDX_equipment_company").on(table.companyId),
  index("IDX_equipment_parent").on(table.parentEquipmentId),
  index("IDX_equipment_asset_tag").on(table.assetTag),
]);

export const insertEquipmentSchema = createInsertSchema(equipment).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertEquipment = z.infer<typeof insertEquipmentSchema>;
export type Equipment = typeof equipment.$inferSelect;

// Parts/Inventory Table
export const parts = pgTable("parts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id")
    .notNull()
    .references(() => companies.id),
  partNumber: varchar("part_number", { length: 100 }).notNull(),
  name: varchar("name", { length: 255 }),
  description: text("description"),
  machineType: varchar("machine_type", { length: 255 }),
  stockLevel: integer("stock_level").default(0),
  minStockLevel: integer("min_stock_level").default(0),
  unitCost: real("unit_cost"),
  location: varchar("location", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("IDX_parts_company").on(table.companyId),
  index("IDX_parts_part_number").on(table.partNumber),
]);

export const insertPartSchema = createInsertSchema(parts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertPart = z.infer<typeof insertPartSchema>;
export type Part = typeof parts.$inferSelect;

// Work Orders Table
export const workOrders = pgTable("work_orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  workOrderNumber: integer("work_order_number").notNull(),
  companyId: varchar("company_id")
    .notNull()
    .references(() => companies.id),
  equipmentId: varchar("equipment_id").references(() => equipment.id),
  assignedToId: varchar("assigned_to_id").references(() => users.id),
  createdById: varchar("created_by_id")
    .references(() => users.id),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  status: workOrderStatusEnum("status").default("draft"),
  priority: workOrderPriorityEnum("priority").default("medium"),
  type: workOrderTypeEnum("type").default("corrective"),
  dueDate: timestamp("due_date"),
  completedAt: timestamp("completed_at"),
  notes: text("notes"),
  photoUrls: jsonb("photo_urls").$type<string[]>().default([]),
  measurements: jsonb("measurements").$type<Record<string, any>>(),
  partsUsed: jsonb("parts_used").$type<{ partId: string; quantity: number }[]>().default([]),
  totalTimeMinutes: real("total_time_minutes"),
  timerStartedAt: timestamp("timer_started_at"),
  rcaId: varchar("rca_id").references(() => rcaRecords.id),
  activeTimeEntryId: varchar("active_time_entry_id").references(() => timeEntries.id),
  activeTimerType: timeEntryTypeEnum("active_timer_type"),
  submittedById: varchar("submitted_by_id").references(() => users.id),
  approvedById: varchar("approved_by_id").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("IDX_work_orders_company").on(table.companyId),
  index("IDX_work_orders_equipment").on(table.equipmentId),
  index("IDX_work_orders_assigned_to").on(table.assignedToId),
  index("IDX_work_orders_status").on(table.status),
  index("IDX_work_orders_due_date").on(table.dueDate),
]);

export const insertWorkOrderSchema = createInsertSchema(workOrders).omit({
  id: true,
  workOrderNumber: true,
  createdAt: true,
  updatedAt: true,
});
export const updateWorkOrderSchema = insertWorkOrderSchema.partial();
export type InsertWorkOrder = z.infer<typeof insertWorkOrderSchema>;
export type UpdateWorkOrder = z.infer<typeof updateWorkOrderSchema>;
export type WorkOrder = typeof workOrders.$inferSelect;

// Work Order Templates
export const workOrderTemplates = pgTable("work_order_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id")
    .notNull()
    .references(() => companies.id),
  name: varchar("name", { length: 255 }),
  titlePattern: varchar("title_pattern", { length: 255 }),
  descriptionTemplate: text("description_template"),
  defaultType: workOrderTypeEnum("default_type").default("preventive"),
  defaultPriority: workOrderPriorityEnum("default_priority").default("medium"),
  defaultDuration: integer("default_duration"),
  requiredParts: jsonb("required_parts").$type<{ partId: string; quantity: number }[]>().default([]),
  isSystemTemplate: boolean("is_system_template").default(false),
  createdById: varchar("created_by_id")
    .references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertWorkOrderTemplateSchema = createInsertSchema(workOrderTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertWorkOrderTemplate = z.infer<typeof insertWorkOrderTemplateSchema>;
export type WorkOrderTemplate = typeof workOrderTemplates.$inferSelect;

// PM Schedules Table
export const pmSchedules = pgTable("pm_schedules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id")
    .notNull()
    .references(() => companies.id),
  equipmentId: varchar("equipment_id")
    .references(() => equipment.id),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  frequencyDays: integer("frequency_days"),
  lastCompletedDate: timestamp("last_completed_date"),
  nextDueDate: timestamp("next_due_date"),
  measurements: text("measurements"),
  instructions: text("instructions"),
  optimizationSuggestions: jsonb("optimization_suggestions").$type<any>(),
  aiAnalysis: jsonb("ai_analysis").$type<any>(),
  importedFrom: varchar("imported_from", { length: 255 }),
  lastOptimized: timestamp("last_optimized"),
  isOptimized: boolean("is_optimized").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertPMScheduleSchema = createInsertSchema(pmSchedules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertPMSchedule = z.infer<typeof insertPMScheduleSchema>;
export type PMSchedule = typeof pmSchedules.$inferSelect;

// Downtime Records Table
export const downtimeRecords = pgTable("downtime_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id")
    .notNull()
    .references(() => companies.id),
  equipmentId: varchar("equipment_id")
    .notNull()
    .references(() => equipment.id),
  workOrderId: varchar("work_order_id").references(() => workOrders.id),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time"),
  durationMinutes: integer("duration_minutes"),
  category: varchar("category", { length: 100 }),
  rootCause: text("root_cause"),
  impact: text("impact"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("IDX_downtime_records_company").on(table.companyId),
  index("IDX_downtime_records_equipment").on(table.equipmentId),
  index("IDX_downtime_records_start_time").on(table.startTime),
]);

export const insertDowntimeRecordSchema = createInsertSchema(downtimeRecords).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertDowntimeRecord = z.infer<typeof insertDowntimeRecordSchema>;
export type DowntimeRecord = typeof downtimeRecords.$inferSelect;

// Downtime Reports Table
export const downtimeReports = pgTable("downtime_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id")
    .notNull()
    .references(() => companies.id),
  createdById: varchar("created_by_id").references(() => users.id),
  fileName: varchar("file_name", { length: 255 }),
  fileType: varchar("file_type", { length: 50 }),
  recordCount: integer("record_count"),
  totalDowntimeHours: real("total_downtime_hours"),
  analysisData: jsonb("analysis_data").$type<{
    summary: {
      totalDowntimeHours: number;
      mostAffectedEquipment: string;
      primaryCauses: string[];
      criticalFindings: string;
    };
    segments?: {
      safety?: {
        downtimeHours?: number;
        severity?: string;
        executiveSummary?: string;
        keyMetrics?: { label: string; value: string }[];
        findings?: { title: string; description?: string; severity?: string; impact?: string; affectedEquipment?: string[] }[];
        rootCauses?: string[];
        recommendations?: { priority: string; action: string; expectedImpact?: string; timeframe?: string }[];
        kpis?: { metric: string; current: string; target: string; gap: string }[];
      };
      quality?: {
        downtimeHours?: number;
        severity?: string;
        executiveSummary?: string;
        keyMetrics?: { label: string; value: string }[];
        findings?: { title: string; description?: string; severity?: string; impact?: string; affectedEquipment?: string[] }[];
        rootCauses?: string[];
        recommendations?: { priority: string; action: string; expectedImpact?: string; timeframe?: string }[];
        kpis?: { metric: string; current: string; target: string; gap: string }[];
      };
      operations?: {
        downtimeHours?: number;
        severity?: string;
        executiveSummary?: string;
        keyMetrics?: { label: string; value: string }[];
        findings?: { title: string; description?: string; severity?: string; impact?: string; affectedEquipment?: string[] }[];
        rootCauses?: string[];
        recommendations?: { priority: string; action: string; expectedImpact?: string; timeframe?: string }[];
        kpis?: { metric: string; current: string; target: string; gap: string }[];
      };
      maintenance?: {
        downtimeHours?: number;
        severity?: string;
        executiveSummary?: string;
        keyMetrics?: { label: string; value: string }[];
        findings?: { title: string; description?: string; severity?: string; impact?: string; affectedEquipment?: string[] }[];
        rootCauses?: string[];
        recommendations?: { priority: string; action: string; expectedImpact?: string; timeframe?: string }[];
        kpis?: { metric: string; current: string; target: string; gap: string }[];
      };
    };
    patterns: { title: string; description: string; severity: string; affectedEquipment: string[]; frequency: string }[];
    rootCauseAnalysis: { cause: string; category: string; frequency: string; impact: string }[];
    recommendations: { priority: string; action: string; expectedImpact: string; timeframe: string }[];
    preventiveMeasures: { measure: string; equipment: string[]; frequency: string }[];
  }>(),
  archived: boolean("archived").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertDowntimeReportSchema = createInsertSchema(downtimeReports).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertDowntimeReport = z.infer<typeof insertDowntimeReportSchema>;
export type DowntimeReport = typeof downtimeReports.$inferSelect;

// RCA (Root Cause Analysis) Records Table
export const rcaRecords = pgTable("rca_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id")
    .notNull()
    .references(() => companies.id),
  equipmentId: varchar("equipment_id").references(() => equipment.id),
  workOrderId: varchar("work_order_id").references(() => workOrders.id),
  createdById: varchar("created_by_id")
    .references(() => users.id),
  problemStatement: text("problem_statement").notNull(),
  fiveWhys: jsonb("five_whys").$type<{ question: string; answer: string }[]>().default([]),
  fishboneDiagram: jsonb("fishbone_diagram").$type<Record<string, string[]>>(),
  rootCauses: jsonb("root_causes").$type<string[]>().default([]),
  correctiveActions: jsonb("corrective_actions").$type<{ action: string; owner: string; dueDate: string; status: string }[]>().default([]),
  aiInsights: text("ai_insights"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertRCASchema = createInsertSchema(rcaRecords).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertRCA = z.infer<typeof insertRCASchema>;
export type RCARecord = typeof rcaRecords.$inferSelect;

// Troubleshooting Sessions Table
export const troubleshootingSessions = pgTable("troubleshooting_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id")
    .notNull()
    .references(() => companies.id),
  equipmentId: varchar("equipment_id").references(() => equipment.id),
  createdById: varchar("created_by_id")
    .references(() => users.id),
  currentStep: integer("current_step").default(1),
  step1Data: jsonb("step1_data").$type<any>(),
  step2Data: jsonb("step2_data").$type<any>(),
  step3Data: jsonb("step3_data").$type<any>(),
  step4Data: jsonb("step4_data").$type<any>(),
  step5Data: jsonb("step5_data").$type<any>(),
  step6Data: jsonb("step6_data").$type<any>(),
  aiConversation: jsonb("ai_conversation").$type<{ role: string; content: string }[]>().default([]),
  completed: boolean("completed").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertTroubleshootingSessionSchema = createInsertSchema(troubleshootingSessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertTroubleshootingSession = z.infer<typeof insertTroubleshootingSessionSchema>;
export type TroubleshootingSession = typeof troubleshootingSessions.$inferSelect;

// Video provider enum for training modules
export const videoProviderEnum = pgEnum("video_provider", ["youtube", "vimeo", "direct"]);

// Training Modules Table
export const trainingModules = pgTable("training_modules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id")
    .notNull()
    .references(() => companies.id),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  content: text("content"),
  durationMinutes: integer("duration_minutes"),
  quiz: jsonb("quiz").$type<{ question: string; options: string[]; correctAnswer: number }[]>().default([]),
  passingScore: integer("passing_score").default(80),
  points: integer("points").default(0),
  coverImage: varchar("cover_image", { length: 500 }),
  videoUrl: varchar("video_url", { length: 1000 }),
  videoProvider: videoProviderEnum("video_provider"),
  videoDurationSeconds: integer("video_duration_seconds"),
  videoThumbnail: varchar("video_thumbnail", { length: 1000 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertTrainingModuleSchema = createInsertSchema(trainingModules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertTrainingModule = z.infer<typeof insertTrainingModuleSchema>;
export type TrainingModule = typeof trainingModules.$inferSelect;

// Training Progress Table
export const trainingProgress = pgTable("training_progress", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id")
    .references(() => users.id),
  moduleId: varchar("module_id")
    .references(() => trainingModules.id),
  completed: boolean("completed").default(false),
  score: integer("score"),
  attempts: integer("attempts").default(0),
  pointsEarned: integer("points_earned").default(0),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertTrainingProgressSchema = createInsertSchema(trainingProgress).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertTrainingProgress = z.infer<typeof insertTrainingProgressSchema>;
export type TrainingProgress = typeof trainingProgress.$inferSelect;

// Badges Table
export const badges = pgTable("badges", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  iconUrl: varchar("icon_url", { length: 500 }),
  criteria: text("criteria"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertBadgeSchema = createInsertSchema(badges).omit({
  id: true,
  createdAt: true,
});
export type InsertBadge = z.infer<typeof insertBadgeSchema>;
export type Badge = typeof badges.$inferSelect;

// User Badges Table
export const userBadges = pgTable("user_badges", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id")
    .references(() => users.id),
  badgeId: varchar("badge_id")
    .references(() => badges.id),
  awardedAt: timestamp("awarded_at").defaultNow(),
});

export const insertUserBadgeSchema = createInsertSchema(userBadges).omit({
  id: true,
  awardedAt: true,
});
export type InsertUserBadge = z.infer<typeof insertUserBadgeSchema>;
export type UserBadge = typeof userBadges.$inferSelect;

// Certifications Table
export const certifications = pgTable("certifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id")
    .references(() => users.id),
  certificateName: varchar("certificate_name", { length: 255 }),
  issuedBy: varchar("issued_by", { length: 255 }),
  issuedDate: timestamp("issued_date"),
  expiryDate: timestamp("expiry_date"),
  certificateUrl: varchar("certificate_url", { length: 500 }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCertificationSchema = createInsertSchema(certifications).omit({
  id: true,
  createdAt: true,
});
export type InsertCertification = z.infer<typeof insertCertificationSchema>;
export type Certification = typeof certifications.$inferSelect;

// Client Companies Table - For consultant-managed client organizations (separate from platform companies)
// Note: Defined before excellenceProgress so it can be referenced
export const clientCompanies = pgTable("client_companies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id")
    .notNull()
    .references(() => companies.id), // The MaintenanceHub customer who owns this client
  name: varchar("name", { length: 255 }).notNull(),
  industry: varchar("industry", { length: 100 }),
  location: varchar("location", { length: 255 }),
  contactName: varchar("contact_name", { length: 255 }),
  contactEmail: varchar("contact_email", { length: 255 }),
  notes: text("notes"),
  createdById: varchar("created_by_id")
    .references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertClientCompanySchema = createInsertSchema(clientCompanies).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertClientCompany = z.infer<typeof insertClientCompanySchema>;
export type ClientCompany = typeof clientCompanies.$inferSelect;

// Excellence Progress Table - Comprehensive 6-step maintenance excellence tracking
export const excellenceProgress = pgTable("excellence_progress", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id")
    .notNull()
    .references(() => companies.id),
  clientCompanyId: varchar("client_company_id")
    .references(() => clientCompanies.id), // Links to specific client for segregated progress
  currentStep: integer("current_step").default(1),
  step1Completed: boolean("step1_completed").default(false),
  step1CompletedAt: timestamp("step1_completed_at"),
  step1Notes: text("step1_notes"),
  step1Checklist: jsonb("step1_checklist").$type<Record<string, boolean>>().default({}),
  step1Progress: integer("step1_progress").default(0),
  step1Deliverables: jsonb("step1_deliverables").$type<string[]>().default([]),
  step2Completed: boolean("step2_completed").default(false),
  step2CompletedAt: timestamp("step2_completed_at"),
  step2Notes: text("step2_notes"),
  step2Checklist: jsonb("step2_checklist").$type<Record<string, boolean>>().default({}),
  step2Progress: integer("step2_progress").default(0),
  step2Deliverables: jsonb("step2_deliverables").$type<string[]>().default([]),
  step3Completed: boolean("step3_completed").default(false),
  step3CompletedAt: timestamp("step3_completed_at"),
  step3Notes: text("step3_notes"),
  step3Checklist: jsonb("step3_checklist").$type<Record<string, boolean>>().default({}),
  step3Progress: integer("step3_progress").default(0),
  step3Deliverables: jsonb("step3_deliverables").$type<string[]>().default([]),
  step4Completed: boolean("step4_completed").default(false),
  step4CompletedAt: timestamp("step4_completed_at"),
  step4Notes: text("step4_notes"),
  step4Checklist: jsonb("step4_checklist").$type<Record<string, boolean>>().default({}),
  step4Progress: integer("step4_progress").default(0),
  step4Deliverables: jsonb("step4_deliverables").$type<string[]>().default([]),
  step5Completed: boolean("step5_completed").default(false),
  step5CompletedAt: timestamp("step5_completed_at"),
  step5Notes: text("step5_notes"),
  step5Checklist: jsonb("step5_checklist").$type<Record<string, boolean>>().default({}),
  step5Progress: integer("step5_progress").default(0),
  step5Deliverables: jsonb("step5_deliverables").$type<string[]>().default([]),
  step6Completed: boolean("step6_completed").default(false),
  step6CompletedAt: timestamp("step6_completed_at"),
  step6Notes: text("step6_notes"),
  step6Checklist: jsonb("step6_checklist").$type<Record<string, boolean>>().default({}),
  step6Progress: integer("step6_progress").default(0),
  step6Deliverables: jsonb("step6_deliverables").$type<string[]>().default([]),
  startedAt: timestamp("started_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertExcellenceProgressSchema = createInsertSchema(excellenceProgress).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertExcellenceProgress = z.infer<typeof insertExcellenceProgressSchema>;
export type ExcellenceProgress = typeof excellenceProgress.$inferSelect;

// Excellence Deliverables Table
export const excellenceDeliverables = pgTable("excellence_deliverables", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  progressId: varchar("progress_id").references(() => excellenceProgress.id),
  companyId: varchar("company_id")
    .notNull()
    .references(() => companies.id),
  clientCompanyId: varchar("client_company_id")
    .references(() => clientCompanies.id), // Links to specific client for segregated deliverables
  step: integer("step").notNull(),
  checklistItemId: varchar("checklist_item_id", { length: 100 }).notNull(),
  deliverableType: varchar("deliverable_type", { length: 100 }),
  title: varchar("title", { length: 255 }),
  description: text("description"),
  payload: jsonb("payload"),
  isComplete: boolean("is_complete").default(false),
  completedAt: timestamp("completed_at"),
  completedById: varchar("completed_by_id").references(() => users.id),
  lastEditedById: varchar("last_edited_by_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertExcellenceDeliverableSchema = createInsertSchema(excellenceDeliverables).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertExcellenceDeliverable = z.infer<typeof insertExcellenceDeliverableSchema>;
export type ExcellenceDeliverable = typeof excellenceDeliverables.$inferSelect;

// Interview Role Enum
export const interviewRoleEnum = pgEnum("interview_role", [
  "technician",
  "supervisor",
  "manager",
  "planner",
  "storeroom",
  "operations",
  "other",
]);

// Interview Sessions Table - For assessment interviews with voice recording
export const interviewSessions = pgTable("interview_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id")
    .notNull()
    .references(() => companies.id),
  clientCompanyId: varchar("client_company_id")
    .references(() => clientCompanies.id), // Links to consultant's client company
  assessmentDeliverableId: varchar("assessment_deliverable_id")
    .references(() => excellenceDeliverables.id), // Links to the process assessment
  intervieweeRole: interviewRoleEnum("interviewee_role").notNull(),
  intervieweeName: varchar("interviewee_name", { length: 255 }),
  intervieweeDepartment: varchar("interviewee_department", { length: 255 }),
  consentGiven: boolean("consent_given").default(false),
  audioObjectKey: varchar("audio_object_key", { length: 500 }), // Object storage key for audio
  transcript: text("transcript"), // Full interview transcript
  summary: text("summary"), // AI-generated summary
  painPoints: jsonb("pain_points").$type<{
    theme: string;
    severity: "critical" | "major" | "minor";
    quote: string;
    suggestedActions: string[];
  }[]>().default([]),
  themes: jsonb("themes").$type<string[]>().default([]),
  questionsAsked: jsonb("questions_asked").$type<string[]>().default([]),
  duration: integer("duration"), // Duration in seconds
  conductedById: varchar("conducted_by_id")
    .references(() => users.id),
  conductedAt: timestamp("conducted_at"),
  transcribedAt: timestamp("transcribed_at"),
  summarizedAt: timestamp("summarized_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertInterviewSessionSchema = createInsertSchema(interviewSessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertInterviewSession = z.infer<typeof insertInterviewSessionSchema>;
export type InterviewSession = typeof interviewSessions.$inferSelect;

// Schematics Table - Equipment diagrams and parts identification
export const schematics = pgTable("schematics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id")
    .notNull()
    .references(() => companies.id),
  equipmentId: varchar("equipment_id")
    .references(() => equipment.id),
  name: varchar("name", { length: 255 }).notNull(),
  imageUrl: varchar("image_url", { length: 500 }),
  parts: jsonb("parts").$type<{ id: string; name: string; x: number; y: number }[]>().default([]),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertSchematicSchema = createInsertSchema(schematics).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertSchematic = z.infer<typeof insertSchematicSchema>;
export type Schematic = typeof schematics.$inferSelect;

// Schematic Progress Table
export const schematicProgress = pgTable("schematic_progress", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  schematicId: varchar("schematic_id")
    .references(() => schematics.id),
  userId: varchar("user_id")
    .references(() => users.id),
  completedSteps: jsonb("completed_steps").$type<string[]>().default([]),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertSchematicProgressSchema = createInsertSchema(schematicProgress).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertSchematicProgress = z.infer<typeof insertSchematicProgressSchema>;
export type SchematicProgress = typeof schematicProgress.$inferSelect;

// AI Recommendations Table
export const aiRecommendations = pgTable("ai_recommendations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id")
    .notNull()
    .references(() => companies.id),
  equipmentId: varchar("equipment_id").references(() => equipment.id),
  recommendationType: varchar("recommendation_type", { length: 100 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  priority: varchar("priority", { length: 50 }),
  estimatedImpact: text("estimated_impact"),
  status: varchar("status", { length: 50 }).default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAIRecommendationSchema = createInsertSchema(aiRecommendations).omit({
  id: true,
  createdAt: true,
});
export type InsertAIRecommendation = z.infer<typeof insertAIRecommendationSchema>;
export type AIRecommendation = typeof aiRecommendations.$inferSelect;

// Equipment Documents Table
export const equipmentDocuments = pgTable("equipment_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  equipmentId: varchar("equipment_id")
    .notNull()
    .references(() => equipment.id),
  companyId: varchar("company_id")
    .notNull()
    .references(() => companies.id),
  title: varchar("title", { length: 255 }).notNull(),
  documentType: varchar("document_type", { length: 100 }),
  fileUrl: varchar("file_url", { length: 500 }).notNull(),
  uploadedById: varchar("uploaded_by_id")
    .references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertEquipmentDocumentSchema = createInsertSchema(equipmentDocuments).omit({
  id: true,
  createdAt: true,
});
export type InsertEquipmentDocument = z.infer<typeof insertEquipmentDocumentSchema>;
export type EquipmentDocument = typeof equipmentDocuments.$inferSelect;

// Time Entries Table
export const timeEntries = pgTable("time_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  workOrderId: varchar("work_order_id")
    .notNull()
    .references(() => workOrders.id),
  userId: varchar("user_id")
    .references(() => users.id),
  companyId: varchar("company_id")
    .references(() => companies.id),
  entryType: varchar("entry_type", { length: 20 }).default("work"),
  breakReason: varchar("break_reason", { length: 50 }),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time"),
  durationMinutes: integer("duration_minutes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertTimeEntrySchema = createInsertSchema(timeEntries).omit({
  id: true,
  createdAt: true,
});
export type InsertTimeEntry = z.infer<typeof insertTimeEntrySchema>;
export type TimeEntry = typeof timeEntries.$inferSelect;

// Integrations Table
export const integrations = pgTable("integrations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id")
    .notNull()
    .references(() => companies.id),
  name: varchar("name", { length: 255 }).notNull(),
  type: varchar("type", { length: 100 }).notNull(),
  description: text("description"),
  status: varchar("status", { length: 50 }).default("active"),
  config: jsonb("config").$type<Record<string, any>>(),
  apiKey: text("api_key"),
  webhookUrl: text("webhook_url"),
  webhookSecret: text("webhook_secret"),
  lastSyncAt: timestamp("last_sync_at"),
  lastSyncStatus: varchar("last_sync_status", { length: 50 }),
  syncFrequencyMinutes: integer("sync_frequency_minutes"),
  isEnabled: boolean("is_enabled").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertIntegrationSchema = createInsertSchema(integrations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertIntegration = z.infer<typeof insertIntegrationSchema>;
export type Integration = typeof integrations.$inferSelect;

// Integration Logs Table
export const integrationLogs = pgTable("integration_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  integrationId: varchar("integration_id")
    .notNull()
    .references(() => integrations.id),
  action: varchar("action", { length: 100 }).notNull(),
  status: varchar("status", { length: 50 }).notNull(),
  details: jsonb("details"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertIntegrationLogSchema = createInsertSchema(integrationLogs).omit({
  id: true,
  createdAt: true,
});
export type InsertIntegrationLog = z.infer<typeof insertIntegrationLogSchema>;
export type IntegrationLog = typeof integrationLogs.$inferSelect;

// PM Tasks Table
export const pmTasks = pgTable("pm_tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  pmScheduleId: varchar("pm_schedule_id")
    .notNull()
    .references(() => pmSchedules.id),
  taskNumber: integer("task_number").notNull(),
  description: text("description").notNull(),
  estimatedMinutes: integer("estimated_minutes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertPMTaskSchema = createInsertSchema(pmTasks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertPMTask = z.infer<typeof insertPMTaskSchema>;
export type PMTask = typeof pmTasks.$inferSelect;

// PM Required Parts Table
export const pmRequiredParts = pgTable("pm_required_parts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  pmScheduleId: varchar("pm_schedule_id")
    .notNull()
    .references(() => pmSchedules.id),
  partId: varchar("part_id")
    .notNull()
    .references(() => parts.id),
  quantity: integer("quantity").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertPMRequiredPartSchema = createInsertSchema(pmRequiredParts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertPMRequiredPart = z.infer<typeof insertPMRequiredPartSchema>;
export type PMRequiredPart = typeof pmRequiredParts.$inferSelect;

// Type aliases for backwards compatibility
export type RCA = RCARecord;

// Breakdown Analysis Types for Downtime 5 Whys & Fishbone
export const fiveWhyStepSchema = z.object({
  step: z.number(),
  question: z.string(),
  answer: z.string(),
  confidence: z.enum(['high', 'medium', 'low']).optional(),
  evidence: z.string().optional(),
});
export type FiveWhyStep = z.infer<typeof fiveWhyStepSchema>;

export const fishboneCauseSchema = z.object({
  factor: z.string(),
  description: z.string(),
  likelihood: z.enum(['high', 'medium', 'low']).optional(),
});
export type FishboneCause = z.infer<typeof fishboneCauseSchema>;

export const raciSchema = z.object({
  responsible: z.string(),
  accountable: z.string(),
  consulted: z.string(),
  informed: z.string(),
}).optional();

export const actionItemSchema = z.object({
  title: z.string(),
  description: z.string(),
  priority: z.enum(['immediate', 'short-term', 'medium-term', 'long-term']),
  ownerRole: z.string(),
  timeline: z.string(),
  successMetric: z.string(),
  estimatedCost: z.string().optional(),
  resources: z.string().optional(),
  implementationSteps: z.array(z.string()).optional(),
  raci: raciSchema,
});
export type ActionItem = z.infer<typeof actionItemSchema>;

export const preventiveMeasureSchema = z.object({
  measure: z.string(),
  frequency: z.string(),
  responsibility: z.string(),
});
export type PreventiveMeasure = z.infer<typeof preventiveMeasureSchema>;

export const rootCauseSchema = z.object({
  statement: z.string(),
  category: z.enum(['man', 'machine', 'method', 'material', 'environment', 'measurement']),
  confidence: z.enum(['high', 'medium', 'low']),
  validationSteps: z.array(z.string()).optional(),
});
export type RootCause = z.infer<typeof rootCauseSchema>;

export const verificationEvidenceSchema = z.object({
  observation: z.string(),
  measuredValue: z.string(),
  specificationRange: z.string(),
  deviation: z.string(),
  inspectionMethod: z.string(),
  standardReference: z.string(),
});
export type VerificationEvidence = z.infer<typeof verificationEvidenceSchema>;

export const permanentCountermeasureSchema = z.object({
  action: z.string(),
  specification: z.string(),
  verificationMethod: z.string(),
  standardReference: z.string(),
  partNumber: z.string().optional(),
  torqueSpec: z.string().optional(),
});
export type PermanentCountermeasure = z.infer<typeof permanentCountermeasureSchema>;

export const costBenefitAnalysisSchema = z.object({
  implementationCost: z.string(),
  annualSavings: z.string(),
  paybackPeriod: z.string(),
  riskReduction: z.string(),
});
export type CostBenefitAnalysis = z.infer<typeof costBenefitAnalysisSchema>;

export const breakdownAnalysisSchema = z.object({
  findingTitle: z.string(),
  segment: z.string(),
  executiveSummary: z.string(),
  verificationEvidence: z.array(verificationEvidenceSchema).optional(),
  permanentCountermeasures: z.array(permanentCountermeasureSchema).optional(),
  technicianValidationSteps: z.array(z.string()).optional(),
  fiveWhys: z.array(fiveWhyStepSchema),
  fishbone: z.object({
    man: z.array(fishboneCauseSchema),
    machine: z.array(fishboneCauseSchema),
    method: z.array(fishboneCauseSchema),
    material: z.array(fishboneCauseSchema),
    environment: z.array(fishboneCauseSchema),
    measurement: z.array(fishboneCauseSchema),
  }),
  rootCause: rootCauseSchema,
  actionPlan: z.array(actionItemSchema),
  preventiveMeasures: z.array(preventiveMeasureSchema),
  risks: z.array(z.string()),
  assumptions: z.array(z.string()),
  costBenefitAnalysis: costBenefitAnalysisSchema.optional(),
});
export type BreakdownAnalysis = z.infer<typeof breakdownAnalysisSchema>;

export const breakdownAnalysisRequestSchema = z.object({
  finding: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    value: z.string().optional(),
    cause: z.string().optional(),
  }),
  segment: z.string(),
});
export type BreakdownAnalysisRequest = z.infer<typeof breakdownAnalysisRequestSchema>;

// ==================== CILR & CENTERLINING SYSTEM ====================

// CILR Template Type Enum
export const cilrTemplateTypeEnum = pgEnum("cilr_template_type", [
  "cilr",        // Clean, Inspect, Lubricate, Repair
  "centerline",  // Machine parameter settings
]);

// CILR Task Type Enum
export const cilrTaskTypeEnum = pgEnum("cilr_task_type", [
  "clean",
  "inspect",
  "lubricate",
  "repair",
  "measure",     // For centerlining measurements
  "verify",      // For centerlining verifications
]);

// CILR Run Status Enum
export const cilrRunStatusEnum = pgEnum("cilr_run_status", [
  "in_progress",
  "completed",
  "cancelled",
]);

// CILR Templates - Reusable template definitions
export const cilrTemplates = pgTable("cilr_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => companies.id),
  equipmentId: varchar("equipment_id").references(() => equipment.id),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  templateType: cilrTemplateTypeEnum("template_type").default("cilr"),
  frequency: varchar("frequency", { length: 100 }), // daily, weekly, shift, etc.
  estimatedMinutes: integer("estimated_minutes"),
  isActive: boolean("is_active").default(true),
  version: integer("version").default(1),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("IDX_cilr_templates_company").on(table.companyId),
  index("IDX_cilr_templates_equipment").on(table.equipmentId),
]);

export const insertCilrTemplateSchema = createInsertSchema(cilrTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertCilrTemplate = z.infer<typeof insertCilrTemplateSchema>;
export type CilrTemplate = typeof cilrTemplates.$inferSelect;

// CILR Template Tasks - Individual tasks within a template
export const cilrTemplateTasks = pgTable("cilr_template_tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  templateId: varchar("template_id").notNull().references(() => cilrTemplates.id, { onDelete: "cascade" }),
  taskType: cilrTaskTypeEnum("task_type").default("inspect"),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  instructions: text("instructions"),
  photoRequired: boolean("photo_required").default(false),
  sortOrder: integer("sort_order").default(0),
  // For centerlining tasks
  targetValue: varchar("target_value", { length: 100 }),
  minValue: varchar("min_value", { length: 100 }),
  maxValue: varchar("max_value", { length: 100 }),
  unit: varchar("unit", { length: 50 }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("IDX_cilr_template_tasks_template").on(table.templateId),
]);

export const insertCilrTemplateTaskSchema = createInsertSchema(cilrTemplateTasks).omit({
  id: true,
  createdAt: true,
});
export type InsertCilrTemplateTask = z.infer<typeof insertCilrTemplateTaskSchema>;
export type CilrTemplateTask = typeof cilrTemplateTasks.$inferSelect;

// CILR Runs - Execution instances of a template
export const cilrRuns = pgTable("cilr_runs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  templateId: varchar("template_id").notNull().references(() => cilrTemplates.id),
  companyId: varchar("company_id").notNull().references(() => companies.id),
  equipmentId: varchar("equipment_id").references(() => equipment.id),
  assignedTo: varchar("assigned_to").references(() => users.id),
  status: cilrRunStatusEnum("status").default("in_progress"),
  startedAt: timestamp("started_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("IDX_cilr_runs_company").on(table.companyId),
  index("IDX_cilr_runs_template").on(table.templateId),
  index("IDX_cilr_runs_equipment").on(table.equipmentId),
  index("IDX_cilr_runs_assigned").on(table.assignedTo),
  index("IDX_cilr_runs_status").on(table.status),
]);

export const insertCilrRunSchema = createInsertSchema(cilrRuns).omit({
  id: true,
  createdAt: true,
});
export type InsertCilrRun = z.infer<typeof insertCilrRunSchema>;
export type CilrRun = typeof cilrRuns.$inferSelect;

// CILR Task Completions - Individual task completion records
export const cilrTaskCompletions = pgTable("cilr_task_completions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  runId: varchar("run_id").notNull().references(() => cilrRuns.id, { onDelete: "cascade" }),
  taskId: varchar("task_id").notNull().references(() => cilrTemplateTasks.id),
  completedBy: varchar("completed_by").references(() => users.id),
  completedAt: timestamp("completed_at").defaultNow(),
  isCompleted: boolean("is_completed").default(false),
  // For centerlining - actual measured value
  measuredValue: varchar("measured_value", { length: 100 }),
  isInSpec: boolean("is_in_spec"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("IDX_cilr_task_completions_run").on(table.runId),
  index("IDX_cilr_task_completions_task").on(table.taskId),
]);

export const insertCilrTaskCompletionSchema = createInsertSchema(cilrTaskCompletions).omit({
  id: true,
  createdAt: true,
});
export type InsertCilrTaskCompletion = z.infer<typeof insertCilrTaskCompletionSchema>;
export type CilrTaskCompletion = typeof cilrTaskCompletions.$inferSelect;

// CILR Task Media - Photos and attachments for task completions
export const cilrTaskMedia = pgTable("cilr_task_media", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  completionId: varchar("completion_id").notNull().references(() => cilrTaskCompletions.id, { onDelete: "cascade" }),
  runId: varchar("run_id").notNull().references(() => cilrRuns.id, { onDelete: "cascade" }),
  mediaUrl: varchar("media_url", { length: 1000 }).notNull(),
  thumbnailUrl: varchar("thumbnail_url", { length: 1000 }),
  mediaType: varchar("media_type", { length: 50 }).default("image"),
  fileName: varchar("file_name", { length: 255 }),
  fileSize: integer("file_size"),
  uploadedBy: varchar("uploaded_by").references(() => users.id),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("IDX_cilr_task_media_completion").on(table.completionId),
  index("IDX_cilr_task_media_run").on(table.runId),
]);

export const insertCilrTaskMediaSchema = createInsertSchema(cilrTaskMedia).omit({
  id: true,
  createdAt: true,
});
export type InsertCilrTaskMedia = z.infer<typeof insertCilrTaskMediaSchema>;
export type CilrTaskMedia = typeof cilrTaskMedia.$inferSelect;

// ==================== CENTERLINING SYSTEM (INDEPENDENT) ====================

// Centerline Run Status Enum
export const centerlineRunStatusEnum = pgEnum("centerline_run_status", [
  "in_progress",
  "completed",
  "cancelled",
]);

// Centerline Templates - Equipment parameter spec sheets
export const centerlineTemplates = pgTable("centerline_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  equipmentId: varchar("equipment_id").references(() => equipment.id),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  frequency: varchar("frequency", { length: 50 }).default("daily"),
  estimatedMinutes: integer("estimated_minutes").default(15),
  isActive: boolean("is_active").default(true),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("IDX_centerline_templates_company").on(table.companyId),
  index("IDX_centerline_templates_equipment").on(table.equipmentId),
]);

export const insertCenterlineTemplateSchema = createInsertSchema(centerlineTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertCenterlineTemplate = z.infer<typeof insertCenterlineTemplateSchema>;
export type CenterlineTemplate = typeof centerlineTemplates.$inferSelect;

// Centerline Parameters - Individual measurement specs within a template
export const centerlineParameters = pgTable("centerline_parameters", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  templateId: varchar("template_id").notNull().references(() => centerlineTemplates.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  targetValue: varchar("target_value", { length: 100 }).notNull(),
  minValue: varchar("min_value", { length: 100 }).notNull(),
  maxValue: varchar("max_value", { length: 100 }).notNull(),
  unit: varchar("unit", { length: 50 }).notNull(),
  category: varchar("category", { length: 100 }),
  sortOrder: integer("sort_order").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("IDX_centerline_parameters_template").on(table.templateId),
]);

export const insertCenterlineParameterSchema = createInsertSchema(centerlineParameters).omit({
  id: true,
  createdAt: true,
});
export type InsertCenterlineParameter = z.infer<typeof insertCenterlineParameterSchema>;
export type CenterlineParameter = typeof centerlineParameters.$inferSelect;

// Centerline Runs - Execution instances of a template
export const centerlineRuns = pgTable("centerline_runs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  templateId: varchar("template_id").notNull().references(() => centerlineTemplates.id),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  equipmentId: varchar("equipment_id").references(() => equipment.id),
  assignedTo: varchar("assigned_to").references(() => users.id),
  status: centerlineRunStatusEnum("status").default("in_progress"),
  startedAt: timestamp("started_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("IDX_centerline_runs_company").on(table.companyId),
  index("IDX_centerline_runs_template").on(table.templateId),
  index("IDX_centerline_runs_equipment").on(table.equipmentId),
  index("IDX_centerline_runs_status").on(table.status),
]);

export const insertCenterlineRunSchema = createInsertSchema(centerlineRuns).omit({
  id: true,
  createdAt: true,
});
export type InsertCenterlineRun = z.infer<typeof insertCenterlineRunSchema>;
export type CenterlineRun = typeof centerlineRuns.$inferSelect;

// Centerline Measurements - Individual parameter readings
export const centerlineMeasurements = pgTable("centerline_measurements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  runId: varchar("run_id").notNull().references(() => centerlineRuns.id, { onDelete: "cascade" }),
  parameterId: varchar("parameter_id").notNull().references(() => centerlineParameters.id),
  measuredValue: varchar("measured_value", { length: 100 }).notNull(),
  isInSpec: boolean("is_in_spec").notNull(),
  deviation: varchar("deviation", { length: 100 }),
  notes: text("notes"),
  photoUrl: varchar("photo_url", { length: 1000 }),
  aiAnalysis: text("ai_analysis"),
  aiRecommendation: text("ai_recommendation"),
  measuredBy: varchar("measured_by").references(() => users.id),
  measuredAt: timestamp("measured_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("IDX_centerline_measurements_run").on(table.runId),
  index("IDX_centerline_measurements_parameter").on(table.parameterId),
  index("IDX_centerline_measurements_in_spec").on(table.isInSpec),
]);

export const insertCenterlineMeasurementSchema = createInsertSchema(centerlineMeasurements).omit({
  id: true,
  createdAt: true,
});
export type InsertCenterlineMeasurement = z.infer<typeof insertCenterlineMeasurementSchema>;
export type CenterlineMeasurement = typeof centerlineMeasurements.$inferSelect;
