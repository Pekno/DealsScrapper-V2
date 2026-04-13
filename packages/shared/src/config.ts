/**
 * @fileoverview Common configuration constants used across all services
 * Provides standardized timeout, retry, and batch size configurations
 */

/**
 * Common configuration constants used across all services
 * Provides consistent timing and processing configurations
 */
export const COMMON_CONFIG = {
  /**
   * Timeout configurations for various operations
   * All values in milliseconds
   */
  TIMEOUTS: {
    /** Fast operation timeout (2 seconds) */
    FAST: 2000,
    /** Quick operation timeout (3 seconds) */
    QUICK: 3000,
    /** Short timeout for health checks (5 seconds) */
    SHORT: 5000,
    /** Health check timeout (10 seconds) */
    HEALTH_CHECK: 10000,
    /** WebSocket connection timeout (15 seconds) */
    WEBSOCKET: 15000,
    /** Default operation timeout (30 seconds) */
    DEFAULT: 30000,
    /** HTTP request timeout (30 seconds) */
    HTTP: 30000,
    /** File I/O operations timeout (30 seconds) */
    FILE_IO: 30000,
    /** Database operation timeout (1 minute) */
    DATABASE: 60000,
    /** Elasticsearch operation timeout (1 minute) */
    ELASTICSEARCH: 60000,
    /** Long operation timeout (2 minutes) */
    LONG: 120000,
  },

  /**
   * Retry configurations for failed operations
   */
  RETRIES: {
    /** Maximum retry attempts for failed operations */
    MAX_ATTEMPTS: 3,
    /** Retry backoff strategy */
    BACKOFF_TYPE: 'exponential' as const,
    /** Base delay for retry backoff (1 second) */
    BASE_DELAY: 1000,
    /** Maximum delay for retry backoff (30 seconds) */
    MAX_DELAY: 30000,
    /** Maximum retry attempts for critical operations */
    MAX_ATTEMPTS_CRITICAL: 5,
    /** Maximum retry attempts for database operations */
    MAX_ATTEMPTS_DATABASE: 10,
  },

  /**
   * Batch size configurations for processing operations
   */
  BATCH_SIZES: {
    /** Default batch size for processing */
    DEFAULT: 100,
    /** Maximum batch size */
    MAX: 500,
    /** Small batch size for careful operations */
    SMALL: 50,
    /** Large batch size for bulk operations */
    LARGE: 1000,
    /** Elasticsearch bulk operation batch size */
    ELASTICSEARCH_BULK: 1000,
    /** Database bulk insert batch size */
    DATABASE_BULK: 500,
    /** Email notification batch size */
    EMAIL_BATCH: 50,
  },

  /**
   * Rate limiting configurations
   */
  RATE_LIMITS: {
    /** Default requests per minute */
    DEFAULT_RPM: 100,
    /** Strict rate limit for sensitive operations */
    STRICT_RPM: 20,
    /** Burst limit for short-term peaks */
    BURST_LIMIT: 50,
    /** Rate limit window in milliseconds (15 minutes) */
    WINDOW_MS: 15 * 60 * 1000,
    /** API rate limit for external services */
    EXTERNAL_API_RPM: 60,
  },

  /**
   * Memory and performance configurations
   */
  PERFORMANCE: {
    /** Maximum memory usage threshold (in MB) */
    MAX_MEMORY_MB: 512,
    /** Memory usage warning threshold (in MB) */
    MEMORY_WARNING_MB: 256,
    /** CPU usage warning threshold (percentage) */
    CPU_WARNING_PERCENT: 80,
    /** Maximum concurrent operations */
    MAX_CONCURRENT: 10,
  },

  /**
   * File and storage configurations
   */
  STORAGE: {
    /** Maximum file size for uploads (in MB) */
    MAX_FILE_SIZE_MB: 10,
    /** Log rotation size (in MB) */
    LOG_ROTATION_SIZE_MB: 20,
    /** Log retention days */
    LOG_RETENTION_DAYS: 14,
    /** Temporary file cleanup interval (in hours) */
    TEMP_CLEANUP_HOURS: 24,
  },
} as const;

/**
 * Type for timeout configuration keys
 */
export type TimeoutType = keyof typeof COMMON_CONFIG.TIMEOUTS;

/**
 * Type for batch size configuration keys
 */
export type BatchSizeType = keyof typeof COMMON_CONFIG.BATCH_SIZES;

/**
 * Type for retry configuration keys
 */
export type RetryType = keyof typeof COMMON_CONFIG.RETRIES;

/**
 * Type for rate limit configuration keys
 */
export type RateLimitType = keyof typeof COMMON_CONFIG.RATE_LIMITS;

/**
 * Utility function to get timeout value by type
 * @param type - Timeout type
 * @returns Timeout value in milliseconds
 */
export function getTimeout(type: TimeoutType): number {
  return COMMON_CONFIG.TIMEOUTS[type];
}

/**
 * Utility function to get batch size by type
 * @param type - Batch size type
 * @returns Batch size value
 */
export function getBatchSize(type: BatchSizeType): number {
  return COMMON_CONFIG.BATCH_SIZES[type];
}

/**
 * Utility function to get retry configuration
 * @param maxAttemptsType - Retry attempts type (optional, defaults to MAX_ATTEMPTS)
 * @returns Retry configuration object
 */
export function getRetryConfig(
  maxAttemptsType:
    | 'MAX_ATTEMPTS'
    | 'MAX_ATTEMPTS_CRITICAL'
    | 'MAX_ATTEMPTS_DATABASE' = 'MAX_ATTEMPTS'
): {
  maxAttempts: number;
  backoffType: 'exponential';
  baseDelay: number;
  maxDelay: number;
} {
  return {
    maxAttempts: COMMON_CONFIG.RETRIES[maxAttemptsType],
    backoffType: COMMON_CONFIG.RETRIES.BACKOFF_TYPE,
    baseDelay: COMMON_CONFIG.RETRIES.BASE_DELAY,
    maxDelay: COMMON_CONFIG.RETRIES.MAX_DELAY,
  };
}

/**
 * Utility function to check if memory usage is within limits
 * @param currentMemoryMB - Current memory usage in MB
 * @returns Object with status and warning flags
 */
export function checkMemoryUsage(currentMemoryMB: number): {
  withinLimit: boolean;
  isWarning: boolean;
  isCritical: boolean;
} {
  return {
    withinLimit: currentMemoryMB <= COMMON_CONFIG.PERFORMANCE.MAX_MEMORY_MB,
    isWarning: currentMemoryMB >= COMMON_CONFIG.PERFORMANCE.MEMORY_WARNING_MB,
    isCritical: currentMemoryMB >= COMMON_CONFIG.PERFORMANCE.MAX_MEMORY_MB,
  };
}

/**
 * Common environment-based configuration
 * Provides different values based on NODE_ENV
 */
export const ENV_CONFIG = {
  development: {
    logLevel: 'debug' as const,
    enableMetrics: true,
    verboseErrors: true,
    corsEnabled: true,
  },
  production: {
    logLevel: 'info' as const,
    enableMetrics: true,
    verboseErrors: false,
    corsEnabled: false,
  },
  test: {
    logLevel: 'warn' as const,
    enableMetrics: false,
    verboseErrors: true,
    corsEnabled: true,
  },
} as const;

/**
 * Get environment-specific configuration
 * @param env - Environment name (defaults to NODE_ENV)
 * @returns Environment configuration object
 */
export function getEnvConfig(env?: string) {
  const environment = (env ||
    process.env.NODE_ENV ||
    'development') as keyof typeof ENV_CONFIG;
  return ENV_CONFIG[environment] || ENV_CONFIG.development;
}
