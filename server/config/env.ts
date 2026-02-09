import { z } from "zod";

/**
 * Environment variable schema with validation.
 * Validates all required and optional environment variables at startup.
 */
const envSchema = z.object({
  // =============================================================================
  // Required - Core Infrastructure
  // =============================================================================

  /** PostgreSQL connection string */
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  /** Session encryption secret (minimum 32 characters for security) */
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters"),

  // =============================================================================
  // Optional with Defaults - Server Configuration
  // =============================================================================

  /** Node environment */
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  /** Server port */
  PORT: z.string().default("5000"),

  /** Log level for Pino logger */
  LOG_LEVEL: z
    .enum(["trace", "debug", "info", "warn", "error", "fatal"])
    .optional(),

  // =============================================================================
  // Optional - External Services (gracefully optional)
  // =============================================================================

  /** Stripe production API key */
  STRIPE_SECRET_KEY: z.string().optional(),

  /** Stripe test API key (preferred in non-production) */
  TESTING_STRIPE_SECRET_KEY: z.string().optional(),

  /** OpenAI API endpoint */
  AI_INTEGRATIONS_OPENAI_BASE_URL: z.string().url().optional(),

  /** OpenAI API key for AI features */
  AI_INTEGRATIONS_OPENAI_API_KEY: z.string().optional(),

  /** Resend API key for email sending */
  RESEND_API_KEY: z.string().optional(),

  /** Custom domain for redirects from .replit.app */
  CUSTOM_DOMAIN: z.string().optional(),

  /** Cloud storage bucket ID for file uploads */
  DEFAULT_OBJECT_STORAGE_BUCKET_ID: z.string().optional(),

  /** Replit OAuth application ID */
  REPL_ID: z.string().optional(),

  /** OpenID Connect issuer URL */
  ISSUER_URL: z.string().url().optional(),
});

/** Validated environment type */
export type Env = z.infer<typeof envSchema>;

/**
 * Validate environment variables at startup.
 * Exits the process with helpful error messages if validation fails.
 */
function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error("Environment variable validation failed:");
    console.error("");
    result.error.issues.forEach((issue) => {
      const path = issue.path.join(".");
      console.error(`  - ${path}: ${issue.message}`);
    });
    console.error("");
    console.error("Please check your .env file or environment configuration.");
    process.exit(1);
  }

  return result.data;
}

/**
 * Validated environment variables.
 * Import this instead of using process.env directly.
 */
export const env = validateEnv();

/**
 * Check if a Stripe key is available (either production or testing).
 */
export function hasStripeKey(): boolean {
  return !!(env.STRIPE_SECRET_KEY || env.TESTING_STRIPE_SECRET_KEY);
}

/**
 * Get the active Stripe secret key.
 * Prefers testing key if it starts with 'sk_'.
 */
export function getStripeSecretKey(): string | undefined {
  const testKey = env.TESTING_STRIPE_SECRET_KEY;
  if (testKey?.startsWith("sk_")) {
    return testKey;
  }
  return env.STRIPE_SECRET_KEY;
}

/**
 * Check if AI features are configured.
 */
export function hasAIConfig(): boolean {
  return !!(env.AI_INTEGRATIONS_OPENAI_API_KEY && env.AI_INTEGRATIONS_OPENAI_BASE_URL);
}

/**
 * Check if email sending is configured.
 */
export function hasEmailConfig(): boolean {
  return !!env.RESEND_API_KEY;
}

/**
 * Check if file storage is configured.
 */
export function hasStorageConfig(): boolean {
  return !!env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
}
