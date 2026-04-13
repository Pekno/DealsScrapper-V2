import { Logger } from '@nestjs/common';
import type { IEnhancedLogger } from '@dealscrapper/shared-logging';

/**
 * Extracts error message from unknown error type
 */
export function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Unknown error';
}

/**
 * Standardized error logging for service operations.
 * Reduces boilerplate in try-catch blocks across all services.
 *
 * @param logger - Logger instance
 * @param operation - Operation description (e.g., "recording activity for user 123")
 * @param error - Error object
 * @param context - Additional context for debugging
 *
 * @example
 * ```typescript
 * catch (error: unknown) {
 *   handleServiceError(this.logger, 'creating delivery record', error, { deliveryId });
 * }
 * ```
 */
export function handleServiceError(
  logger: Logger | IEnhancedLogger,
  operation: string,
  error: unknown,
  context?: Record<string, unknown>
): void {
  const errorMessage = extractErrorMessage(error);
  const contextStr = context ? ` | Context: ${JSON.stringify(context)}` : '';

  // Handle different logger signatures
  if ('error' in logger && typeof logger.error === 'function') {
    const errorStr = `Error ${operation}: ${errorMessage}${contextStr}`;
    // EnhancedLogger signature: error(message: string, trace?: string, context?: string)
    // NestJS Logger signature: error(message: any, ...optionalParams: any[])
    if (error instanceof Error && error.stack) {
      logger.error(errorStr, error.stack);
    } else {
      logger.error(errorStr);
    }
  }
}

/**
 * Error handler with fallback value (fail-open pattern).
 * Used when service degradation is acceptable.
 *
 * @param logger - Logger instance
 * @param operation - Operation description
 * @param error - Error object
 * @param fallbackValue - Value to return on error
 * @param context - Additional context
 * @returns The fallback value
 *
 * @example
 * ```typescript
 * catch (error: unknown) {
 *   return handleServiceErrorWithFallback(
 *     this.logger,
 *     'checking rate limit',
 *     error,
 *     { allowed: true, remaining: 100 }
 *   );
 * }
 * ```
 */
export function handleServiceErrorWithFallback<T>(
  logger: Logger | IEnhancedLogger,
  operation: string,
  error: unknown,
  fallbackValue: T,
  context?: Record<string, unknown>
): T {
  handleServiceError(logger, operation, error, context);
  return fallbackValue;
}

/**
 * Async operation wrapper with standardized error handling.
 * Reduces boilerplate in service methods by centralizing try-catch logic.
 *
 * @param logger - Logger instance
 * @param operation - Operation description
 * @param fn - Async function to execute
 * @param options - Configuration options
 * @returns Result of the async function
 * @throws Original error if throwOnError is true
 *
 * @example
 * ```typescript
 * async recordActivity(activity: UserActivity): Promise<void> {
 *   await withErrorHandling(
 *     this.logger,
 *     'recording activity',
 *     async () => {
 *       const key = `user_activity:${activity.userId}`;
 *       await this.redis.zadd(key, timestamp, JSON.stringify(activityRecord));
 *     },
 *     { context: { userId: activity.userId } }
 *   );
 * }
 * ```
 */
export async function withErrorHandling<T>(
  logger: Logger | IEnhancedLogger,
  operation: string,
  fn: () => Promise<T>,
  options?: {
    throwOnError?: boolean;
    fallbackValue?: T;
    context?: Record<string, unknown>;
  }
): Promise<T> {
  try {
    return await fn();
  } catch (error: unknown) {
    handleServiceError(logger, operation, error, options?.context);

    if (options?.throwOnError !== false) {
      throw error;
    }

    if (options?.fallbackValue !== undefined) {
      return options.fallbackValue;
    }

    // If throwOnError is false and no fallbackValue provided, return undefined
    return undefined as T;
  }
}
