import pRetry from "p-retry";

// Helper to check if error is rate limit
export function isRateLimitError(error: any): boolean {
  const errorMsg = error?.message || String(error);
  return (
    errorMsg.includes("429") ||
    errorMsg.includes("RATELIMIT_EXCEEDED") ||
    errorMsg.toLowerCase().includes("quota") ||
    errorMsg.toLowerCase().includes("rate limit")
  );
}

// Default retry configuration for AI calls
export const defaultRetryConfig = {
  retries: 7,
  minTimeout: 2000,
  maxTimeout: 128000,
  factor: 2,
};

// Shorter retry configuration for less critical calls
export const shortRetryConfig = {
  retries: 3,
  minTimeout: 2000,
  maxTimeout: 16000,
  factor: 2,
};

// Minimal retry configuration
export const minimalRetryConfig = {
  retries: 2,
  minTimeout: 2000,
  maxTimeout: 8000,
  factor: 2,
};

// Re-export pRetry for convenience
export { pRetry };
