import { z } from "zod";
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "../constants";

// =============================================================================
// Common Schemas
// =============================================================================

/** UUID parameter validation */
export const uuidParamSchema = z.object({
  id: z.string().uuid("Invalid ID format"),
});

/** Pagination query parameters */
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
});

// =============================================================================
// Authentication Schemas
// =============================================================================

/** Login request validation */
export const loginSchema = z.object({
  email: z.string().email("Valid email required"),
  password: z.string().min(1, "Password is required"),
});

/** Registration request validation */
export const registerSchema = z.object({
  email: z.string().email("Valid email required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  accessKey: z.string().min(1, "Access key is required"),
  token: z.string().optional(),
});

/** Access key validation request */
export const validateAccessKeySchema = z.object({
  key: z.string().min(1, "Access key is required"),
});

/** Password reset request */
export const forgotPasswordSchema = z.object({
  email: z.string().email("Valid email required"),
});

/** Password reset with token */
export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

/** Set password for invitation */
export const setPasswordSchema = z.object({
  email: z.string().email("Valid email required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  token: z.string().min(1, "Invitation token is required"),
  accessKey: z.string().min(1, "Access key is required"),
});

/** Role switch request (platform admin only) */
export const switchRoleSchema = z.object({
  userId: z.string().uuid().optional(),
  role: z.enum(["admin", "manager", "tech"]),
});

// =============================================================================
// Company Schemas
// =============================================================================

/** Update company package settings */
export const updatePackageSchema = z.object({
  packageType: z.enum(["full_access", "operations", "troubleshooting", "demo"]),
  isLive: z.boolean().optional(),
  enabledModules: z.array(z.string()).optional(),
  purchasedManagerSeats: z.number().int().min(0).optional(),
  purchasedTechSeats: z.number().int().min(0).optional(),
});

// =============================================================================
// User Schemas
// =============================================================================

/** Create invitation */
export const createInvitationSchema = z.object({
  email: z.string().email("Valid email required"),
  role: z.enum(["admin", "manager", "tech"]),
  companyId: z.string().uuid().optional(),
});

/** Bulk delete users */
export const bulkDeleteUsersSchema = z.object({
  userIds: z.array(z.string().uuid()).min(1, "At least one user ID required"),
});

/** Update user */
export const updateUserSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  email: z.string().email().optional(),
  role: z.enum(["admin", "manager", "tech"]).optional(),
  companyId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().optional(),
});

// =============================================================================
// Access Key Schemas
// =============================================================================

/** Create access key */
export const createAccessKeySchema = z.object({
  notes: z.string().optional(),
  expiresAt: z.string().datetime().optional(),
});

/** Update access key */
export const updateAccessKeySchema = z.object({
  isActive: z.boolean().optional(),
  notes: z.string().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
});

// =============================================================================
// Work Order Schemas
// =============================================================================

/** Timer action (start/pause/resume/stop) */
export const timerActionSchema = z.object({
  breakReason: z.enum(["lunch", "parts_wait", "meeting", "personal", "other"]).optional(),
  notes: z.string().optional(),
});

// =============================================================================
// Downtime Schemas
// =============================================================================

/** Create downtime record */
export const createDowntimeSchema = z.object({
  equipmentId: z.string().uuid(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime().optional(),
  reason: z.string().min(1, "Reason is required"),
  notes: z.string().optional(),
});

// =============================================================================
// Training Schemas
// =============================================================================

/** Update training progress */
export const updateTrainingProgressSchema = z.object({
  moduleId: z.string().uuid(),
  progress: z.number().min(0).max(100),
  quizScore: z.number().min(0).max(100).optional(),
  completed: z.boolean().optional(),
});

// =============================================================================
// RCA Schemas
// =============================================================================

/** Create RCA record */
export const createRcaSchema = z.object({
  equipmentId: z.string().uuid().optional(),
  workOrderId: z.string().uuid().optional(),
  title: z.string().min(1, "Title is required"),
  problemStatement: z.string().min(1, "Problem statement is required"),
});

/** Suggest next why */
export const suggestWhySchema = z.object({
  rcaId: z.string().uuid(),
  currentWhys: z.array(z.string()),
});
