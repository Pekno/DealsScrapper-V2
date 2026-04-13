import { Injectable, Inject } from '@nestjs/common';
import { createServiceLogger } from '@dealscrapper/shared-logging';
import { Redis } from 'ioredis';
import { notifierLogConfig } from '../config/logging.config.js';

import { withErrorHandling, handleServiceError } from '../utils/error-handling.utils.js';
import {
  getRedisJson,
  setRedisJson,
  zaddRedisJson,
  safeJsonParse,
  scanKeys,
} from '../utils/redis-helpers.utils.js';

export interface UserStatus {
  isOnline: boolean;
  isActive: boolean;
  lastActivity: Date;
  deviceType: 'web' | 'mobile';
  socketId: string | null;
  connectionCount?: number;
  lastHeartbeat?: Date;
  userAgent?: string;
  ipAddress?: string;
}

/**
 * Raw user status data as stored in Redis (dates as ISO strings)
 */
interface RawUserStatusData {
  isOnline: boolean;
  isActive: boolean;
  lastActivity: string;
  deviceType: 'web' | 'mobile';
  socketId: string | null;
  connectionCount?: number;
  lastHeartbeat?: string;
  userAgent?: string;
  ipAddress?: string;
  updatedAt?: string;
}

@Injectable()
export class UserStatusService {
  private readonly logger = createServiceLogger(notifierLogConfig);
  private readonly USER_STATUS_TTL = 600; // 10 minutes
  private readonly ACTIVITY_DEBOUNCE = new Map<string, NodeJS.Timeout>();

  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {}

  /**
   * Deserialize Redis user status data to typed UserStatus object.
   * Handles Date conversion and optional fields.
   * @private
   */
  private deserializeUserStatus(data: string | RawUserStatusData): UserStatus {
    const status: RawUserStatusData =
      typeof data === 'string' ? (JSON.parse(data) as RawUserStatusData) : data;
    return {
      isOnline: status.isOnline,
      isActive: status.isActive,
      lastActivity: new Date(status.lastActivity),
      deviceType: status.deviceType,
      socketId: status.socketId,
      connectionCount: status.connectionCount,
      lastHeartbeat: status.lastHeartbeat
        ? new Date(status.lastHeartbeat)
        : undefined,
      userAgent: status.userAgent,
      ipAddress: status.ipAddress,
    };
  }

  async updateUserStatus(userId: string, status: UserStatus): Promise<void> {
    await withErrorHandling(
      this.logger,
      `updating user status for ${userId}`,
      async () => {
        const statusData = {
          isOnline: status.isOnline,
          isActive: status.isActive,
          lastActivity: status.lastActivity.toISOString(),
          deviceType: status.deviceType,
          socketId: status.socketId,
          connectionCount: status.connectionCount || 1,
          lastHeartbeat: status.lastHeartbeat?.toISOString(),
          userAgent: status.userAgent,
          ipAddress: status.ipAddress,
          updatedAt: new Date().toISOString(),
        };

        // Store with TTL for auto-cleanup
        await setRedisJson(
          this.redis,
          `user_status:${userId}`,
          statusData,
          this.USER_STATUS_TTL
        );

        // Publish status change for real-time updates across services
        await this.redis.publish(
          'user_status_changes',
          JSON.stringify({
            userId,
            ...statusData,
          })
        );

        this.logger.debug(
          `📊 Updated status for user ${userId}: ${status.isOnline ? 'online' : 'offline'}`
        );
      },
      { throwOnError: false }
    );
  }

  async getUserStatus(userId: string): Promise<UserStatus | null> {
    return withErrorHandling(
      this.logger,
      `getting user status for ${userId}`,
      async () => {
        const statusData = await getRedisJson<any>(
          this.redis,
          `user_status:${userId}`,
          this.logger
        );

        if (!statusData) return null;

        return this.deserializeUserStatus(statusData);
      },
      { fallbackValue: null, throwOnError: false }
    );
  }

  async getUserStatuses(userIds: string[]): Promise<Map<string, UserStatus>> {
    return withErrorHandling(
      this.logger,
      'getting multiple user statuses',
      async () => {
        const pipeline = this.redis.pipeline();
        userIds.forEach((userId) => {
          pipeline.get(`user_status:${userId}`);
        });

        const results = await pipeline.exec();
        const statuses = new Map<string, UserStatus>();

        results?.forEach((result, index) => {
          if (result[1]) {
            try {
              const userStatus = this.deserializeUserStatus(result[1] as string);
              statuses.set(userIds[index], userStatus);
            } catch (error) {
              this.logger.error(`Error deserializing status for user ${userIds[index]}:`, error);
            }
          }
        });

        return statuses;
      },
      { fallbackValue: new Map(), throwOnError: false }
    );
  }

  async updateUserActivity(userId: string): Promise<void> {
    // Debounce activity updates to avoid Redis spam
    const existingTimeout = this.ACTIVITY_DEBOUNCE.get(userId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    const timeout = setTimeout(async () => {
      await withErrorHandling(
        this.logger,
        `updating activity for user ${userId}`,
        async () => {
          await this.redis.setex(
            `user_activity:${userId}`,
            300, // 5 minutes TTL
            Date.now().toString()
          );
          this.ACTIVITY_DEBOUNCE.delete(userId);
        },
        { throwOnError: false }
      );
    }, 1000); // 1 second debounce

    this.ACTIVITY_DEBOUNCE.set(userId, timeout);
  }

  async setUserInactive(userId: string): Promise<void> {
    try {
      const currentStatus = await this.getUserStatus(userId);
      if (currentStatus) {
        await this.updateUserStatus(userId, {
          ...currentStatus,
          isActive: false,
        });
      }
    } catch (error) {
      this.logger.error(`Error setting user ${userId} inactive:`, error);
    }
  }

  async isUserOnline(userId: string): Promise<boolean> {
    const status = await this.getUserStatus(userId);
    return status?.isOnline ?? false;
  }

  async isUserActive(userId: string): Promise<boolean> {
    const status = await this.getUserStatus(userId);
    if (!status) return false;

    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    return status.isActive && status.lastActivity > fiveMinutesAgo;
  }

  async getOnlineUsers(): Promise<string[]> {
    try {
      const pattern = 'user_status:*';
      // Use SCAN instead of KEYS to prevent blocking Redis in production
      const keys = await scanKeys(this.redis, pattern);
      const onlineUsers: string[] = [];

      if (keys.length === 0) return onlineUsers;

      const statuses = await this.redis.mget(keys);

      statuses.forEach((statusData, index) => {
        if (statusData) {
          try {
            const status = this.deserializeUserStatus(statusData);
            if (status.isOnline) {
              const userId = keys[index].replace('user_status:', '');
              onlineUsers.push(userId);
            }
          } catch (parseError) {
            this.logger.error(`Error parsing status data:`, parseError);
          }
        }
      });

      return onlineUsers;
    } catch (error) {
      this.logger.error('Error getting online users:', error);
      return [];
    }
  }

  async getStatusStats(): Promise<{
    totalOnline: number;
    totalActive: number;
    deviceBreakdown: Record<string, number>;
  }> {
    try {
      const onlineUsers = await this.getOnlineUsers();
      const userIds = onlineUsers;
      const statuses = await this.getUserStatuses(userIds);

      let totalActive = 0;
      const deviceBreakdown: Record<string, number> = {};

      for (const status of statuses.values()) {
        if (status.isActive) totalActive++;

        const device = status.deviceType || 'unknown';
        deviceBreakdown[device] = (deviceBreakdown[device] || 0) + 1;
      }

      return {
        totalOnline: onlineUsers.length,
        totalActive,
        deviceBreakdown,
      };
    } catch (error) {
      this.logger.error('Error getting status stats:', error);
      return {
        totalOnline: 0,
        totalActive: 0,
        deviceBreakdown: {},
      };
    }
  }

  async updateHeartbeat(userId: string): Promise<void> {
    try {
      const currentStatus = await this.getUserStatus(userId);
      if (currentStatus) {
        await this.updateUserStatus(userId, {
          ...currentStatus,
          lastHeartbeat: new Date(),
          lastActivity: new Date(),
        });
      }
    } catch (error) {
      this.logger.error(`Error updating heartbeat for user ${userId}:`, error);
    }
  }

  async trackConnectionAttempt(
    userId: string,
    success: boolean
  ): Promise<void> {
    await withErrorHandling(
      this.logger,
      `tracking connection attempt for user ${userId}`,
      async () => {
        const key = `user_connections:${userId}`;
        const now = Date.now();

        // Store connection attempt with timestamp
        await zaddRedisJson(
          this.redis,
          key,
          now,
          { success, timestamp: now }
        );

        // Keep only last 24 hours of attempts
        const dayAgo = now - 24 * 60 * 60 * 1000;
        await this.redis.zremrangebyscore(key, 0, dayAgo);

        // Set expiration
        await this.redis.expire(key, 86400); // 24 hours
      },
      { throwOnError: false }
    );
  }

  async getConnectionHistory(userId: string): Promise<{
    totalAttempts: number;
    successfulConnections: number;
    failedAttempts: number;
    lastConnection?: Date;
  }> {
    try {
      const key = `user_connections:${userId}`;
      const attempts = await this.redis.zrange(key, 0, -1, 'WITHSCORES');

      let totalAttempts = 0;
      let successfulConnections = 0;
      let failedAttempts = 0;
      let lastConnection: Date | undefined;

      for (let i = 0; i < attempts.length; i += 2) {
        const attempt = attempts[i];
        const timestamp = parseInt(attempts[i + 1]);

        totalAttempts++;

        if (attempt.startsWith('success')) {
          successfulConnections++;
          if (!lastConnection || timestamp > lastConnection.getTime()) {
            lastConnection = new Date(timestamp);
          }
        } else {
          failedAttempts++;
        }
      }

      return {
        totalAttempts,
        successfulConnections,
        failedAttempts,
        lastConnection,
      };
    } catch (error) {
      this.logger.error(
        `Error getting connection history for user ${userId}:`,
        error
      );
      return {
        totalAttempts: 0,
        successfulConnections: 0,
        failedAttempts: 0,
      };
    }
  }

  async cleanupExpiredStatuses(): Promise<void> {
    try {
      const pattern = 'user_status:*';
      // Use SCAN instead of KEYS to prevent blocking Redis in production
      const keys = await scanKeys(this.redis, pattern);

      for (const key of keys) {
        const ttl = await this.redis.ttl(key);
        if (ttl === -1) {
          // Key has no expiration, set one
          await this.redis.expire(key, this.USER_STATUS_TTL);
        }
      }

      this.logger.debug(`🧹 Cleaned up ${keys.length} user status keys`);
    } catch (error) {
      this.logger.error('Error cleaning up expired statuses:', error);
    }
  }

  async getDetailedStats(): Promise<{
    totalOnline: number;
    totalActive: number;
    deviceBreakdown: Record<string, number>;
    connectionHealth: {
      averageHeartbeatDelay: number;
      staleConnections: number;
    };
  }> {
    try {
      const basicStats = await this.getStatusStats();
      const onlineUsers = await this.getOnlineUsers();
      const statuses = await this.getUserStatuses(onlineUsers);

      let totalHeartbeatDelay = 0;
      let heartbeatCount = 0;
      let staleConnections = 0;
      const now = new Date();

      for (const status of statuses.values()) {
        if (status.lastHeartbeat) {
          const delay = now.getTime() - status.lastHeartbeat.getTime();
          totalHeartbeatDelay += delay;
          heartbeatCount++;

          // Consider connection stale if no heartbeat for 2+ minutes
          if (delay > 2 * 60 * 1000) {
            staleConnections++;
          }
        }
      }

      return {
        ...basicStats,
        connectionHealth: {
          averageHeartbeatDelay:
            heartbeatCount > 0 ? totalHeartbeatDelay / heartbeatCount : 0,
          staleConnections,
        },
      };
    } catch (error) {
      this.logger.error('Error getting detailed stats:', error);
      return {
        totalOnline: 0,
        totalActive: 0,
        deviceBreakdown: {},
        connectionHealth: {
          averageHeartbeatDelay: 0,
          staleConnections: 0,
        },
      };
    }
  }
}
