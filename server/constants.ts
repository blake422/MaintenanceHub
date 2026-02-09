/**
 * Application constants - centralized configuration values
 *
 * These constants replace magic numbers scattered throughout the codebase
 * to improve maintainability and make configuration changes easier.
 */

// =============================================================================
// Authentication
// =============================================================================

/** Number of bcrypt salt rounds for password hashing */
export const SALT_ROUNDS = 10;

/** Session time-to-live in milliseconds (1 week) */
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Password reset token expiry in milliseconds (1 hour) */
export const PASSWORD_RESET_EXPIRY_MS = 60 * 60 * 1000;

/** Invitation expiry in days */
export const INVITATION_EXPIRY_DAYS = 7;

// =============================================================================
// Rate Limiting
// =============================================================================

/** Rate limit window for auth endpoints in milliseconds (1 minute) */
export const AUTH_RATE_LIMIT_WINDOW_MS = 60 * 1000;

/** Maximum auth requests per window per IP */
export const AUTH_RATE_LIMIT_MAX_REQUESTS = 5;

// =============================================================================
// Database
// =============================================================================

/** Maximum connections in pool for production */
export const DB_POOL_SIZE_PROD = 20;

/** Maximum connections in pool for development */
export const DB_POOL_SIZE_DEV = 5;

/** Idle timeout for database connections in milliseconds */
export const DB_IDLE_TIMEOUT_MS = 30000;

/** Connection timeout in milliseconds */
export const DB_CONNECTION_TIMEOUT_MS = 10000;

// =============================================================================
// Billing
// =============================================================================

/** Demo trial period in days */
export const DEMO_EXPIRY_DAYS = 30;

/** Manager seat price in cents ($100) */
export const MANAGER_PRICE_CENTS = 10000;

/** Tech seat price in cents ($50) */
export const TECH_PRICE_CENTS = 5000;

/** Troubleshooting tier price in cents ($20) */
export const TROUBLESHOOTING_PRICE_CENTS = 2000;

// =============================================================================
// Pagination
// =============================================================================

/** Default page size for paginated results */
export const DEFAULT_PAGE_SIZE = 20;

/** Maximum allowed page size */
export const MAX_PAGE_SIZE = 100;

// =============================================================================
// File Upload
// =============================================================================

/** Maximum photos per work order upload */
export const MAX_PHOTOS_PER_UPLOAD = 5;

/** Maximum request body size */
export const BODY_SIZE_LIMIT = '50mb';

// =============================================================================
// Work Orders
// =============================================================================

/** Default work order estimate in minutes (2 hours) */
export const DEFAULT_WO_ESTIMATE_MINUTES = 120;

/** Rounding multiplier for workload calculations */
export const WORKLOAD_ROUNDING_MULTIPLIER = 10;
