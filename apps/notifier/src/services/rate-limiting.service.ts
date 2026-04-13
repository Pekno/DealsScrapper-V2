import { Injectable, Inject } from '@nestjs/common';
import { createServiceLogger } from '@dealscrapper/shared-logging';
import { Redis } from 'ioredis';
import { notifierLogConfig } from '../config/logging.config.js';
import { withErrorHandling } from '../utils/error-handling.utils.js';
import { setRedisJson, getRedisJson, scanKeys } from '../utils/redis-helpers.utils.js';

export interface RateLimitRule {
  key: string;
  limit: number;
  windowSize: number; // in seconds
  blockDuration?: number; // in seconds, defaults to windowSize
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: Date;
  retryAfter?: number; // seconds until next attempt allowed
}

export interface AbuseDetectionConfig {
  suspiciousThreshold: number;
  blacklistThreshold: number;
  monitoringWindow: number; // in seconds
  patterns: {
    rapidConnections: { limit: number; window: number };
    excessiveMessages: { limit: number; window: number };
    invalidTokenAttempts: { limit: number; window: number };
    geolocationChanges: { limit: number; window: number };
  };
}

@Injectable()
export class RateLimitingService {
  private readonly logger = createServiceLogger(notifierLogConfig);

  private readonly defaultConfig: AbuseDetectionConfig = {
    suspiciousThreshold: 3,
    blacklistThreshold: 5,
    monitoringWindow: 3600, // 1 hour
    patterns: {
      rapidConnections: { limit: 10, window: 60 }, // 10 connections per minute
      excessiveMessages: { limit: 100, window: 60 }, // 100 messages per minute
      invalidTokenAttempts: { limit: 5, window: 300 }, // 5 invalid tokens per 5 minutes
      geolocationChanges: { limit: 3, window: 3600 }, // 3 location changes per hour
    },
  };

  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {}

  async checkRateLimit(rule: RateLimitRule): Promise<RateLimitResult> {
    return withErrorHandling(
      this.logger,
      `checking rate limit for ${rule.key}`,
      async () => {
        // Sanitize key to prevent injection
        const sanitizedKey = this.sanitizeKey(rule.key);
        const key = `rate_limit:${sanitizedKey}`;
        const now = Date.now();
        const windowStart = now - rule.windowSize * 1000;

        // Validate rule parameters
        if (!this.isValidRule(rule)) {
          this.logger.warn(
            `Invalid rate limit rule provided: ${JSON.stringify(rule)}`
          );
          return {
            allowed: false,
            remaining: 0,
            resetTime: new Date(now + 60 * 1000), // 1 minute default
            retryAfter: 60,
          };
        }

        // Remove expired entries
        await this.redis.zremrangebyscore(key, 0, windowStart);

        // Count current requests in window
        const currentCount = await this.redis.zcard(key);

        if (currentCount >= rule.limit) {
          const resetTime = new Date(now + rule.windowSize * 1000);
          const blockDuration = rule.blockDuration || rule.windowSize;

          return {
            allowed: false,
            remaining: 0,
            resetTime,
            retryAfter: blockDuration,
          };
        }

        // Add current request with entropy to prevent collisions
        const requestId = `${now}-${this.generateSecureRandomId()}`;
        await this.redis.zadd(key, now, requestId);
        await this.redis.expire(key, rule.windowSize * 2); // Double window for cleanup

        const resetTime = new Date(now + rule.windowSize * 1000);

        return {
          allowed: true,
          remaining: rule.limit - currentCount - 1,
          resetTime,
        };
      },
      {
        throwOnError: false,
        fallbackValue: {
          allowed: true, // Fail open - allow request if Redis is down
          remaining: rule.limit,
          resetTime: new Date(Date.now() + rule.windowSize * 1000),
        }
      }
    );
  }

  async checkConnectionRateLimit(identifier: string): Promise<RateLimitResult> {
    return this.checkRateLimit({
      key: `connection:${identifier}`,
      limit: this.defaultConfig.patterns.rapidConnections.limit,
      windowSize: this.defaultConfig.patterns.rapidConnections.window,
      blockDuration: 300, // 5 minutes block
    });
  }

  async checkMessageRateLimit(userId: string): Promise<RateLimitResult> {
    return this.checkRateLimit({
      key: `messages:${userId}`,
      limit: this.defaultConfig.patterns.excessiveMessages.limit,
      windowSize: this.defaultConfig.patterns.excessiveMessages.window,
      blockDuration: 60, // 1 minute block
    });
  }

  async checkAuthRateLimit(identifier: string): Promise<RateLimitResult> {
    return this.checkRateLimit({
      key: `auth_fail:${identifier}`,
      limit: this.defaultConfig.patterns.invalidTokenAttempts.limit,
      windowSize: this.defaultConfig.patterns.invalidTokenAttempts.window,
      blockDuration: 600, // 10 minutes block
    });
  }

  async recordSuspiciousActivity(
    identifier: string,
    activityType:
      | 'rapid_connections'
      | 'excessive_messages'
      | 'invalid_auth'
      | 'geo_anomaly',
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await withErrorHandling(
      this.logger,
      `recording suspicious activity for ${identifier}`,
      async () => {
        // Sanitize identifier to prevent injection
        const sanitizedIdentifier = this.sanitizeKey(identifier);
        const key = `suspicious:${sanitizedIdentifier}`;
        const now = Date.now();

        // Sanitize and limit metadata to prevent memory exhaustion
        const sanitizedMetadata = this.sanitizeMetadata(metadata || {});

        const activity = {
          type: activityType,
          timestamp: now,
          metadata: sanitizedMetadata,
        };

        // Use a secure JSON serialization that handles circular references
        const activityJson = this.safeStringify(activity);

        await this.redis.zadd(key, now, activityJson);
        await this.redis.expire(key, this.defaultConfig.monitoringWindow);

        // Check if user should be flagged
        await this.evaluateAbuseScore(sanitizedIdentifier);
      },
      {
        throwOnError: false
      }
    );
  }

  async getAbuseScore(identifier: string): Promise<{
    score: number;
    level: 'clean' | 'suspicious' | 'blacklisted';
    activities: Array<{ type: string; timestamp: Date; metadata: Record<string, unknown> }>;
  }> {
    return withErrorHandling(
      this.logger,
      `getting abuse score for ${identifier}`,
      async () => {
        const key = `suspicious:${identifier}`;
        const windowStart =
          Date.now() - this.defaultConfig.monitoringWindow * 1000;

        // Get activities in monitoring window
        const activities = await this.redis.zrangebyscore(
          key,
          windowStart,
          '+inf',
          'WITHSCORES'
        );

        const parsedActivities = [];
        let score = 0;

        for (let i = 0; i < activities.length; i += 2) {
          try {
            const activity = JSON.parse(activities[i]);
            const timestamp = parseInt(activities[i + 1]);

            parsedActivities.push({
              type: activity.type,
              timestamp: new Date(timestamp),
              metadata: activity.metadata,
            });

            // Calculate score based on activity type
            switch (activity.type) {
              case 'rapid_connections':
                score += 2;
                break;
              case 'excessive_messages':
                score += 1;
                break;
              case 'invalid_auth':
                score += 3;
                break;
              case 'geo_anomaly':
                score += 2;
                break;
            }
          } catch (parseError) {
            this.logger.error('Error parsing suspicious activity:', parseError);
          }
        }

        // Determine level
        let level: 'clean' | 'suspicious' | 'blacklisted' = 'clean';
        if (score >= this.defaultConfig.blacklistThreshold) {
          level = 'blacklisted';
        } else if (score >= this.defaultConfig.suspiciousThreshold) {
          level = 'suspicious';
        }

        return {
          score,
          level,
          activities: parsedActivities,
        };
      },
      {
        throwOnError: false,
        fallbackValue: {
          score: 0,
          level: 'clean',
          activities: [],
        }
      }
    );
  }

  async isBlacklisted(identifier: string): Promise<boolean> {
    return withErrorHandling(
      this.logger,
      `checking blacklist for ${identifier}`,
      async () => {
        const blacklistKey = `blacklist:${identifier}`;
        const ttl = await this.redis.ttl(blacklistKey);
        return ttl > 0;
      },
      {
        throwOnError: false,
        fallbackValue: false // Fail open - allow if Redis check fails
      }
    );
  }

  async addToBlacklist(
    identifier: string,
    duration: number = 3600,
    reason?: string
  ): Promise<void> {
    await withErrorHandling(
      this.logger,
      `adding ${identifier} to blacklist`,
      async () => {
        const key = `blacklist:${identifier}`;
        const data = {
          timestamp: Date.now(),
          reason: reason || 'Abuse detected',
          duration,
        };

        await setRedisJson(this.redis, key, data, duration);

        this.logger.warn(
          `🚫 Added ${identifier} to blacklist for ${duration} seconds (${reason})`
        );
      },
      {
        throwOnError: false
      }
    );
  }

  async removeFromBlacklist(identifier: string): Promise<void> {
    await withErrorHandling(
      this.logger,
      `removing ${identifier} from blacklist`,
      async () => {
        await this.redis.del(`blacklist:${identifier}`);
        this.logger.log(`✅ Removed ${identifier} from blacklist`);
      },
      {
        throwOnError: false
      }
    );
  }

  async getBlacklistInfo(identifier: string): Promise<{
    isBlacklisted: boolean;
    reason?: string;
    addedAt?: Date;
    expiresAt?: Date;
  }> {
    try {
      const key = `blacklist:${identifier}`;
      const data = await this.redis.get(key);

      if (!data) {
        return { isBlacklisted: false };
      }

      const blacklistData = JSON.parse(data);
      const ttl = await this.redis.ttl(key);

      return {
        isBlacklisted: true,
        reason: blacklistData.reason,
        addedAt: new Date(blacklistData.timestamp),
        expiresAt: new Date(Date.now() + ttl * 1000),
      };
    } catch (error) {
      this.logger.error(
        `Error getting blacklist info for ${identifier}:`,
        error
      );
      return { isBlacklisted: false };
    }
  }

  async getGlobalStats(): Promise<{
    activeRateLimits: number;
    blacklistedUsers: number;
    suspiciousUsers: number;
    topAbusers: Array<{
      identifier: string;
      score: number;
      activities: number;
    }>;
  }> {
    try {
      // Count active rate limits - Use SCAN instead of KEYS to prevent blocking Redis
      const rateLimitKeys = await scanKeys(this.redis, 'rate_limit:*');
      const activeRateLimits = rateLimitKeys.length;

      // Count blacklisted users - Use SCAN instead of KEYS to prevent blocking Redis
      const blacklistKeys = await scanKeys(this.redis, 'blacklist:*');
      const blacklistedUsers = blacklistKeys.length;

      // Count suspicious users and get top abusers - Use SCAN instead of KEYS to prevent blocking Redis
      const suspiciousKeys = await scanKeys(this.redis, 'suspicious:*');
      const topAbusers = [];
      let suspiciousUsers = 0;

      for (const key of suspiciousKeys.slice(0, 100)) {
        // Limit to prevent performance issues
        const identifier = key.replace('suspicious:', '');
        const abuseInfo = await this.getAbuseScore(identifier);

        if (
          abuseInfo.level === 'suspicious' ||
          abuseInfo.level === 'blacklisted'
        ) {
          suspiciousUsers++;

          if (abuseInfo.score > 0) {
            topAbusers.push({
              identifier,
              score: abuseInfo.score,
              activities: abuseInfo.activities.length,
            });
          }
        }
      }

      // Sort top abusers by score
      topAbusers.sort((a, b) => b.score - a.score);

      return {
        activeRateLimits,
        blacklistedUsers,
        suspiciousUsers,
        topAbusers: topAbusers.slice(0, 10), // Top 10
      };
    } catch (error) {
      this.logger.error('Error getting global stats:', error);
      return {
        activeRateLimits: 0,
        blacklistedUsers: 0,
        suspiciousUsers: 0,
        topAbusers: [],
      };
    }
  }

  async cleanupExpiredEntries(): Promise<void> {
    await withErrorHandling(
      this.logger,
      'cleaning up expired rate limit entries',
      async () => {
        const patterns = ['rate_limit:*', 'suspicious:*'];
        let cleanedCount = 0;

        for (const pattern of patterns) {
          // Use SCAN instead of KEYS to prevent blocking Redis in production
          const keys = await scanKeys(this.redis, pattern);

          for (const key of keys) {
            const ttl = await this.redis.ttl(key);

            // Remove keys with no TTL or that have expired
            if (ttl === -1) {
              // Set a TTL for keys without one
              await this.redis.expire(key, 3600);
            } else if (ttl === -2) {
              // Key has expired, remove it
              await this.redis.del(key);
              cleanedCount++;
            }
          }
        }

        if (cleanedCount > 0) {
          this.logger.debug(
            `🧹 Cleaned up ${cleanedCount} expired rate limit entries`
          );
        }
      },
      {
        throwOnError: false
      }
    );
  }

  // Private helper methods

  /**
   * Sanitizes Redis key to prevent injection attacks
   * @param key - Raw key input
   * @returns Sanitized key safe for Redis operations
   */
  private sanitizeKey(key: string): string {
    if (typeof key !== 'string') {
      return 'invalid';
    }

    // Remove dangerous characters and limit length
    return key.replace(/[^a-zA-Z0-9:._-]/g, '_').substring(0, 250); // Limit key length
  }

  /**
   * Validates rate limit rule parameters
   * @param rule - Rate limit rule to validate
   * @returns Boolean indicating if rule is valid
   */
  private isValidRule(rule: RateLimitRule): boolean {
    return (
      typeof rule.key === 'string' &&
      rule.key.length > 0 &&
      rule.key.length <= 500 &&
      typeof rule.limit === 'number' &&
      rule.limit > 0 &&
      rule.limit <= 10000 && // Reasonable upper limit
      typeof rule.windowSize === 'number' &&
      rule.windowSize > 0 &&
      rule.windowSize <= 86400 && // Max 24 hours
      (!rule.blockDuration ||
        (rule.blockDuration > 0 && rule.blockDuration <= 86400))
    );
  }

  /**
   * Generates secure random ID for request tracking
   * @returns Random ID string
   */
  private generateSecureRandomId(): string {
    const chars =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 16; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Sanitizes metadata to prevent memory exhaustion and injection
   * @param metadata - Raw metadata object
   * @returns Sanitized metadata
   */
  private sanitizeMetadata(
    metadata: Record<string, unknown>
  ): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};
    let keyCount = 0;
    const maxKeys = 20;
    const maxStringLength = 500;

    for (const [key, value] of Object.entries(metadata)) {
      if (keyCount >= maxKeys) break;

      // Sanitize key
      const sanitizedKey = this.sanitizeKey(key).substring(0, 50);
      if (!sanitizedKey) continue;

      // Sanitize value based on type
      if (typeof value === 'string') {
        sanitized[sanitizedKey] = value.substring(0, maxStringLength);
      } else if (typeof value === 'number' && isFinite(value)) {
        sanitized[sanitizedKey] = value;
      } else if (typeof value === 'boolean') {
        sanitized[sanitizedKey] = value;
      } else if (value === null || value === undefined) {
        sanitized[sanitizedKey] = value;
      } else {
        // Convert other types to string with length limit
        sanitized[sanitizedKey] = String(value).substring(0, maxStringLength);
      }

      keyCount++;
    }

    return sanitized;
  }

  /**
   * Safe JSON stringify that handles circular references
   * @param obj - Object to stringify
   * @returns JSON string
   */
  private safeStringify(obj: unknown): string {
    const seen = new Set();
    return JSON.stringify(obj, (key, val) => {
      if (val !== null && typeof val === 'object') {
        if (seen.has(val)) {
          return '[Circular]';
        }
        seen.add(val);
      }
      return val;
    });
  }

  private async evaluateAbuseScore(identifier: string): Promise<void> {
    try {
      const abuseInfo = await this.getAbuseScore(identifier);

      if (abuseInfo.level === 'blacklisted') {
        // Auto-blacklist for high abuse scores
        await this.addToBlacklist(
          identifier,
          3600, // 1 hour
          `Auto-blacklisted: score ${abuseInfo.score}`
        );
      } else if (abuseInfo.level === 'suspicious') {
        this.logger.warn(
          `⚠️ User ${identifier} flagged as suspicious (score: ${abuseInfo.score})`
        );
      }
    } catch (error) {
      this.logger.error(
        `Error evaluating abuse score for ${identifier}:`,
        error
      );
    }
  }
}
