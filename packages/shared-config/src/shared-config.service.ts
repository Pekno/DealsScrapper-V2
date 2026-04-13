/**
 * @fileoverview SharedConfigService - Type-safe configuration access
 * Provides computed configurations and type-safe environment variable access
 */

import { Injectable, Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  SharedConfigOptions,
  RedisConfig,
  DatabaseConfig,
  JwtConfig,
  EmailConfig,
  BrandingConfig,
  RateLimitConfig,
  CorsConfig,
} from './interfaces/config.interface.js';
import {
  DEFAULT_REDIS_CONFIG,
  defaultRedisRetryStrategy,
} from './interfaces/config.interface.js';

/**
 * Injectable service providing type-safe configuration access and computed configurations
 * Works alongside NestJS ConfigService to provide enhanced functionality
 */
@Injectable()
export class SharedConfigService {
  private readonly logger = new Logger(SharedConfigService.name);

  constructor(
    private configService: ConfigService,
    @Inject('SHARED_CONFIG_OPTIONS') private options: SharedConfigOptions
  ) {
    this.logger.log(
      `SharedConfigService initialized for ${options.serviceName} service`
    );
  }

  // === ATOMIC GETTERS (Direct ENV vars, no fallbacks) ===

  /**
   * Get environment variable with validation based on envConfig declaration
   * - REQUIRED keys throw if not available
   * - OPTIONAL keys return undefined if not available
   * - Unknown keys throw if not available (fail-safe)
   * @param key - Environment variable key
   * @returns Environment variable value (or undefined for OPTIONAL keys)
   * @throws Error if REQUIRED variable is not available
   */
  get<T = string>(key: string): T {
    const value = this.configService.get<T>(key);
    if (value === undefined || value === null) {
      // Check if this key is declared as OPTIONAL in envConfig
      const requirement = this.options.envConfig?.[key];
      if (requirement === 'OPTIONAL') {
        return undefined as T;
      }
      throw new Error(`Configuration error: ${key} is not available`);
    }
    return value;
  }

  // === COMPUTED DATABASE CONFIG ===

  /**
   * Get complete database configuration
   * Note: Currently returns DATABASE_URL as-is, but prepared for future computed config
   * @returns Database configuration object
   */
  getDatabaseConfig(): DatabaseConfig {
    const url = this.get<string>('DATABASE_URL');

    // For now, return the URL as-is since we're not breaking down DATABASE_URL yet
    // This method is prepared for future expansion to computed database config
    return {
      url,
      host: '', // Will be computed when we implement POSTGRES_* variables
      port: 0, // Will be computed when we implement POSTGRES_* variables
      database: '', // Will be computed when we implement POSTGRES_* variables
      user: '', // Will be computed when we implement POSTGRES_* variables
    };
  }

  /**
   * Get database URL for Prisma compatibility
   * @returns Database connection URL
   */
  getDatabaseUrl(): string {
    return this.getDatabaseConfig().url;
  }

  // === COMPUTED REDIS CONFIG ===

  /**
   * Get Redis configuration object
   * @returns Redis connection configuration
   */
  getRedisConfig(): RedisConfig {
    const baseConfig: RedisConfig = {
      host: this.get<string>('REDIS_HOST'),
      port: this.get<number>('REDIS_PORT'),
      db: this.get<number>('REDIS_DB'),
      password: this.configService.get<string>('REDIS_PASSWORD'),

      // Apply defaults with environment variable overrides
      maxRetriesPerRequest:
        this.configService.get<number>('REDIS_MAX_RETRIES_PER_REQUEST') ??
        DEFAULT_REDIS_CONFIG.maxRetriesPerRequest,
      enableReadyCheck:
        this.configService.get<boolean>('REDIS_ENABLE_READY_CHECK') ??
        DEFAULT_REDIS_CONFIG.enableReadyCheck,
      enableOfflineQueue:
        this.configService.get<boolean>('REDIS_ENABLE_OFFLINE_QUEUE') ??
        DEFAULT_REDIS_CONFIG.enableOfflineQueue,
      connectTimeout:
        this.configService.get<number>('REDIS_CONNECT_TIMEOUT') ??
        DEFAULT_REDIS_CONFIG.connectTimeout,
      commandTimeout:
        this.configService.get<number>('REDIS_COMMAND_TIMEOUT') ??
        DEFAULT_REDIS_CONFIG.commandTimeout,
      keepAlive:
        this.configService.get<number>('REDIS_KEEP_ALIVE') ??
        DEFAULT_REDIS_CONFIG.keepAlive,
      maxReconnectAttempts:
        this.configService.get<number>('REDIS_MAX_RECONNECT_ATTEMPTS') ??
        DEFAULT_REDIS_CONFIG.maxReconnectAttempts,
      retryStrategy: defaultRedisRetryStrategy,
    };

    // Add TLS config if enabled
    const tlsEnabled = this.configService.get<boolean>('REDIS_TLS_ENABLED');
    if (tlsEnabled) {
      const rejectUnauthorized = this.configService.get<boolean>(
        'REDIS_TLS_REJECT_UNAUTHORIZED',
      );
      baseConfig.tls = {
        rejectUnauthorized: rejectUnauthorized ?? true,
      };
    }

    return baseConfig;
  }

  /**
   * Get BullMQ-compatible Redis configuration
   * BullMQ creates its own Redis connections for blocking operations and pub/sub.
   * Options like 'enableReadyCheck' and 'maxRetriesPerRequest' cause conflicts.
   * See: https://github.com/OptimalBits/bull/issues/1873
   */
  getBullMQRedisConfig(): RedisConfig {
    const baseConfig = this.getRedisConfig();

    // Return config WITHOUT BullMQ-incompatible options
    const bullmqConfig: RedisConfig = {
      host: baseConfig.host,
      port: baseConfig.port,
      db: baseConfig.db,
      password: baseConfig.password,

      // Keep BullMQ-compatible options
      connectTimeout: baseConfig.connectTimeout,
      commandTimeout: baseConfig.commandTimeout,
      keepAlive: baseConfig.keepAlive,
      retryStrategy: baseConfig.retryStrategy,
      maxReconnectAttempts: baseConfig.maxReconnectAttempts,
      reconnectOnError: baseConfig.reconnectOnError,

      // Include TLS if present
      ...(baseConfig.tls && { tls: baseConfig.tls }),

      // Explicitly omit BullMQ-incompatible options:
      // - enableReadyCheck
      // - maxRetriesPerRequest
      // - enableOfflineQueue
    };

    return bullmqConfig;
  }

  /**
   * Get Redis connection URL
   * @returns Redis connection URL string
   */
  getRedisUrl(): string {
    const config = this.getRedisConfig();
    if (config.password) {
      return `redis://:${config.password}@${config.host}:${config.port}/${config.db}`;
    }
    return `redis://${config.host}:${config.port}/${config.db}`;
  }

  // === COMPUTED JWT CONFIG ===

  /**
   * Get JWT configuration with optional refresh token support
   * @returns JWT configuration object
   */
  getJwtConfig(): JwtConfig {
    const hasRefresh = this.configService.get<string>('JWT_REFRESH_SECRET');

    const config: JwtConfig = {
      secret: this.get<string>('JWT_SECRET'),
      expiresIn: this.get<string>('JWT_EXPIRES_IN'),
    };

    if (hasRefresh) {
      config.refreshSecret = this.get<string>('JWT_REFRESH_SECRET');
      config.refreshExpiresIn = this.get<string>('JWT_REFRESH_EXPIRES_IN');
    }

    return config;
  }

  // === COMPUTED EMAIL CONFIG ===

  /**
   * Get email configuration with automatic provider detection
   * Automatically determines email provider and returns appropriate config
   * @returns Email configuration object
   */
  getEmailConfig(): EmailConfig {
    const emailProvider = this.configService.get<string>('EMAIL_PROVIDER');

    if (emailProvider === 'resend') {
      return {
        service: 'resend',
        transport: {
          apiKey: this.get<string>('RESEND_API_KEY'),
        },
        from: {
          email: this.get<string>('FROM_EMAIL'),
          name: this.get<string>('FROM_NAME'),
        },
      };
    }

    if (emailProvider === 'gmail') {
      return {
        service: 'gmail',
        transport: {
          service: 'gmail',
          auth: {
            type: 'OAuth2',
            user: this.get<string>('GMAIL_USER_EMAIL'),
            clientId: this.get<string>('GMAIL_CLIENT_ID'),
            clientSecret: this.get<string>('GMAIL_CLIENT_SECRET'),
            refreshToken: this.get<string>('GMAIL_REFRESH_TOKEN'),
          },
        },
        from: {
          email: this.get<string>('FROM_EMAIL'),
          name: this.get<string>('FROM_NAME'),
        },
      };
    }

    if (emailProvider === 'mailhog') {
      return {
        service: 'mailhog',
        transport: {
          host: this.configService.get<string>('EMAIL_HOST') ?? 'localhost',
          port: this.get<number>('EMAIL_PORT'),
          ignoreTLS: true,
        },
        from: {
          email: this.get<string>('FROM_EMAIL'),
          name: this.get<string>('FROM_NAME'),
        },
      };
    }

    // No EMAIL_PROVIDER set — email is disabled (silent no-op)
    if (!emailProvider) {
      return {
        service: 'none',
        transport: {},
        from: { email: '', name: '' },
      };
    }

    throw new Error(
      `Invalid EMAIL_PROVIDER: '${emailProvider}'.` +
      ` Set EMAIL_PROVIDER to 'gmail', 'resend', or 'mailhog', or leave it unset to disable email.`,
    );
  }

  // === COMPUTED BRANDING CONFIG ===

  /**
   * Get application branding configuration
   * @returns Branding configuration object with required and optional branding elements
   */
  getBrandingConfig(): BrandingConfig {
    return {
      appName: this.get<string>('APP_NAME'),
      primaryColor: this.get<string>('BRAND_PRIMARY_COLOR'),
      supportEmail: this.get<string>('SUPPORT_EMAIL'),
      logoUrl: this.configService.get<string>('BRAND_LOGO_URL'), // Optional
      unsubscribeUrl: this.configService.get<string>('UNSUBSCRIBE_BASE_URL'), // Optional
    };
  }

  // === COMPUTED RATE LIMITING CONFIG ===

  /**
   * Get rate limiting configuration
   * @returns Rate limiting configuration object
   */
  getRateLimitConfig(): RateLimitConfig {
    // Disable rate limiting for test environment unless explicitly testing rate limits
    const enabled = !(
      process.env.NODE_ENV === 'test' && !process.env.TEST_RATE_LIMITING
    );

    return {
      windowMs: this.get<number>('RATE_LIMIT_WINDOW_MS'),
      maxRequests: this.get<number>('RATE_LIMIT_MAX_REQUESTS'),
      enabled,
    };
  }

  // === COMPUTED CORS CONFIG ===

  /**
   * Get CORS configuration
   * @returns CORS configuration object with allowed origins
   */
  getCorsConfig(): CorsConfig {
    const corsOrigin = this.get<string>('CORS_ORIGIN');
    return {
      origins: corsOrigin.split(',').map((origin) => origin.trim()),
    };
  }

  // === SERVICE UTILITIES ===

  /**
   * Get the port for the current service
   * @returns Service port number
   */
  getServicePort(): number {
    const serviceName = this.options.serviceName.toLowerCase();
    const portMap: Record<string, string> = {
      api: 'PORT',
      scraper: 'SCRAPER_PORT',
      notifier: 'NOTIFIER_PORT',
      scheduler: 'SCHEDULER_PORT',
    };

    const portKey = portMap[serviceName];
    if (!portKey) {
      throw new Error(`Unknown service: ${serviceName}`);
    }

    return this.get<number>(portKey);
  }

  /**
   * Check if running in test mode
   * @returns True if NODE_ENV is 'test'
   */
  isTestMode(): boolean {
    return this.get<string>('NODE_ENV') === 'test';
  }

  /**
   * Check if running in development mode
   * @returns True if NODE_ENV is 'development'
   */
  isDevelopmentMode(): boolean {
    return this.get<string>('NODE_ENV') === 'development';
  }

  /**
   * Check if running in production mode
   * @returns True if NODE_ENV is 'production'
   */
  isProductionMode(): boolean {
    return this.get<string>('NODE_ENV') === 'production';
  }
}
