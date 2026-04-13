/**
 * @fileoverview Shared utility functions used across all services
 * Contains common operations for error handling, delays, and data processing
 */

/**
 * Safely extracts error message from unknown error types
 * Provides consistent error message extraction across all services
 * @param error Unknown error object
 * @returns Human-readable error message
 */
export function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message);
  }
  return 'Unknown error occurred';
}

/**
 * Safely stringifies object for logging purposes
 * Handles circular references and undefined values gracefully
 * @param obj Object to stringify
 * @returns JSON string or fallback representation
 */
export function safeStringify(obj: unknown): string {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return String(obj);
  }
}

/**
 * Delays execution for specified milliseconds
 * Useful for rate limiting and respectful scraping
 * @param ms Milliseconds to delay
 * @returns Promise that resolves after delay
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retries an async operation with exponential backoff
 * Common pattern used across multiple services for resilient operations
 * @param fn Function to retry
 * @param maxAttempts Maximum number of attempts
 * @param baseDelay Base delay in milliseconds
 * @returns Promise resolving to function result
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  baseDelay = 1000
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === maxAttempts) break;

      const delayMs = baseDelay * Math.pow(2, attempt - 1);
      await delay(delayMs);
    }
  }

  throw lastError;
}
