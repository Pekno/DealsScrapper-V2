/**
 * @fileoverview Configuration interfaces for SharedConfigModule
 * Defines types for configuration options and computed configuration objects
 */

/**
 * Configuration options for SharedConfigModule
 */
export interface SharedConfigOptions {
  /** Name of the service using this configuration */
  serviceName: string;
  /** Environment variable configuration mapping */
  envConfig: Record<string, 'REQUIRED' | 'OPTIONAL'>;
}

/**
 * Redis connection configuration
 */
export interface RedisConfig {
  // Basic connection
  /** Redis server host */
  host: string;
  /** Redis server port */
  port: number;
  /** Redis database number */
  db: number;
  /** Redis password (optional) */
  password?: string;

  // Connection pool & performance
  /** Maximum number of retries per command (default: 3) */
  maxRetriesPerRequest?: number;
  /** Check connection readiness before using (default: true) */
  enableReadyCheck?: boolean;
  /** Queue commands when disconnected (default: true) */
  enableOfflineQueue?: boolean;

  // Timeouts
  /** Connection timeout in milliseconds (default: 10000) */
  connectTimeout?: number;
  /** Command timeout in milliseconds (default: 5000) */
  commandTimeout?: number;

  // Reconnection strategy
  /** Custom retry strategy function - returns delay in ms or null to stop */
  retryStrategy?: (times: number) => number | null;
  /** Maximum reconnection attempts (default: unlimited) */
  maxReconnectAttempts?: number;
  /** Function to determine if reconnection should happen on specific errors */
  reconnectOnError?: (err: Error) => boolean;

  // Keep-alive
  /** Keep-alive interval in milliseconds (default: 30000) */
  keepAlive?: number;

  // TLS/SSL (for production)
  /** TLS/SSL configuration for secure connections */
  tls?: {
    /** Reject unauthorized certificates (default: true) */
    rejectUnauthorized?: boolean;
    /** CA certificate string */
    ca?: string;
    /** Client certificate string */
    cert?: string;
    /** Client key string */
    key?: string;
  };
}

/**
 * Default Redis connection pool configuration
 * Optimized for production use with resilience and performance
 */
export const DEFAULT_REDIS_CONFIG: Partial<RedisConfig> = {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  enableOfflineQueue: true,
  connectTimeout: 10000, // 10 seconds
  commandTimeout: 5000, // 5 seconds
  keepAlive: 30000, // 30 seconds
  maxReconnectAttempts: 20, // Retry 20 times before giving up
};

/**
 * Default retry strategy with exponential backoff
 * Caps at 3 seconds, gives up after maxReconnectAttempts
 * @param times - Number of retry attempts
 * @returns Delay in milliseconds, or null to stop retrying
 */
export const defaultRedisRetryStrategy = (times: number): number | null => {
  if (times > 20) {
    // Give up after 20 attempts
    return null;
  }
  // Exponential backoff: min(times * 50, 3000)
  return Math.min(times * 50, 3000);
};

/**
 * Database connection configuration
 */
export interface DatabaseConfig {
  /** Full database connection URL */
  url: string;
  /** Database server host */
  host: string;
  /** Database server port */
  port: number;
  /** Database name */
  database: string;
  /** Database username */
  user: string;
}

/**
 * JWT authentication configuration
 */
export interface JwtConfig {
  /** JWT signing secret */
  secret: string;
  /** JWT token expiration time */
  expiresIn: string;
  /** JWT refresh token secret (optional) */
  refreshSecret?: string;
  /** JWT refresh token expiration time (optional) */
  refreshExpiresIn?: string;
}

/**
 * Email service configuration
 */
export interface EmailConfig {
  /** Email service type — 'none' means email is disabled */
  service: 'gmail' | 'smtp' | 'mailhog' | 'resend' | 'none';
  /** Nodemailer transport configuration */
  transport: Record<string, unknown>;
  /** Email sender information */
  from: {
    /** Sender email address */
    email: string;
    /** Sender display name */
    name: string;
  };
}

/**
 * Application branding configuration
 */
export interface BrandingConfig {
  /** Application name */
  appName: string;
  /** Primary brand color (hex code) */
  primaryColor: string;
  /** Support email address */
  supportEmail: string;
  /** Brand logo URL (optional) */
  logoUrl?: string;
  /** Base URL for unsubscribe links (optional) */
  unsubscribeUrl?: string;
}

/**
 * Rate limiting configuration
 */
export interface RateLimitConfig {
  /** Time window in milliseconds */
  windowMs: number;
  /** Maximum requests per window */
  maxRequests: number;
  /** Whether rate limiting is enabled (defaults to true) */
  enabled?: boolean;
}

/**
 * CORS configuration
 */
export interface CorsConfig {
  /** Allowed origins */
  origins: string[];
}
