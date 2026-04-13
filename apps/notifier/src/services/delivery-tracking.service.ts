import { Injectable, Inject } from '@nestjs/common';
import { createServiceLogger } from '@dealscrapper/shared-logging';
import { UnifiedNotificationPayload } from '@dealscrapper/shared-types';
import { Redis } from 'ioredis';
import { PrismaService, Notification, Prisma } from '@dealscrapper/database';
import { withErrorHandling } from '../utils/error-handling.utils.js';
import { setRedisJson, getRedisJson, safeJsonParse, scanKeys } from '../utils/redis-helpers.utils.js';
import { notifierLogConfig } from '../config/logging.config.js';
import {
  serializeNotificationPayload,
  serializeNotificationMetadata,
  deserializeNotificationPayloadOrNull,
  NotificationMetadataJson,
} from '../utils/json-deserializer.utils.js';

export interface DeliveryAttempt {
  id: string;
  notificationId: string;
  channel: string;
  attemptNumber: number;
  status: 'pending' | 'delivered' | 'failed' | 'retrying';
  attemptedAt: Date;
  deliveredAt?: Date;
  failedAt?: Date;
  error?: string;
  nextRetryAt?: Date;
}

/**
 * Unified notification delivery record
 * Contains the complete notification payload that will be sent via any channel
 */
export interface NotificationDelivery {
  id: string;
  userId: string;
  type: 'deal-match' | 'system' | 'digest' | 'verification' | 'password-reset';
  priority: 'high' | 'normal' | 'low';
  notificationPayload: UnifiedNotificationPayload;
  attempts: DeliveryAttempt[];
  finalStatus: 'delivered' | 'failed' | 'pending';
  createdAt: Date;
  completedAt?: Date;
}

/**
 * NOTE: UnifiedNotificationPayload has been moved to @dealscrapper/shared-types
 *
 * This type is now shared across:
 * - Notifier service (this file)
 * - Web frontend (real-time notifications)
 * - API service (notification endpoints)
 *
 * Import it from: import { UnifiedNotificationPayload } from '@dealscrapper/shared-types';
 */

@Injectable()
export class DeliveryTrackingService {
  private readonly logger = createServiceLogger(notifierLogConfig);
  private readonly DELIVERY_TTL = 7 * 24 * 60 * 60; // 7 days

  constructor(
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
    private readonly prisma: PrismaService
  ) {}

  /**
   * Create a new notification delivery record with unified payload
   * Stores the complete notification structure in the database content field
   * @param delivery - Delivery information including the unified notification payload
   * @returns The delivery ID for tracking
   */
  async createDelivery(
    delivery: Omit<
      NotificationDelivery,
      'id' | 'attempts' | 'finalStatus' | 'createdAt'
    >
  ): Promise<string> {
    return withErrorHandling(
      this.logger,
      'creating delivery record',
      async () => {
        const deliveryId = this.generateDeliveryId();

        const fullDelivery: NotificationDelivery = {
          id: deliveryId,
          ...delivery,
          attempts: [],
          finalStatus: 'pending',
          createdAt: new Date(),
        };

        // Store in Redis for fast access
        await setRedisJson(
          this.redis,
          `delivery:${deliveryId}`,
          fullDelivery,
          this.DELIVERY_TTL
        );

        // Store in database with unified payload in content field
        await this.prisma.notification.create({
          data: {
            id: deliveryId,
            userId: delivery.userId,
            matchId: delivery.notificationPayload.matchId ?? null, // Store matchId from payload (DEAL_MATCH only)
            type: delivery.notificationPayload.type,
            subject: delivery.notificationPayload.title, // Store title in subject for backward compatibility
            content: serializeNotificationPayload(delivery.notificationPayload), // Store complete unified payload
            metadata: serializeNotificationMetadata(
              delivery.notificationPayload.filterId
                ? {
                    priority: delivery.priority,
                    notificationType: delivery.type,
                    deliveryTracking: true,
                    filterId: delivery.notificationPayload.filterId,
                    matchId: delivery.notificationPayload.matchId, // Also in metadata for backward compatibility
                  }
                : {
                    priority: delivery.priority,
                    notificationType: delivery.type,
                    deliveryTracking: true,
                  }
            ),
          },
        });

        this.logger.debug(
          `📝 Created delivery record ${deliveryId} for user ${delivery.userId} with unified payload`
        );
        return deliveryId;
      }
    );
  }

  /**
   * Record a delivery attempt
   */
  async recordAttempt(
    deliveryId: string,
    channel: string,
    status: 'delivered' | 'failed',
    error?: string
  ): Promise<void> {
    await withErrorHandling(
      this.logger,
      'recording delivery attempt',
      async () => {
        const delivery = await this.getDelivery(deliveryId);
        if (!delivery) {
          this.logger.error(`Delivery ${deliveryId} not found`);
          return;
        }

        const attemptId = this.generateAttemptId();
        const attempt: DeliveryAttempt = {
          id: attemptId,
          notificationId: deliveryId,
          channel,
          attemptNumber: delivery.attempts.length + 1,
          status,
          attemptedAt: new Date(),
          deliveredAt: status === 'delivered' ? new Date() : undefined,
          failedAt: status === 'failed' ? new Date() : undefined,
          error,
          nextRetryAt:
            status === 'failed'
              ? this.calculateNextRetry(delivery.attempts.length + 1)
              : undefined,
        };

        delivery.attempts.push(attempt);

        // Update final status if delivered or max retries reached
        if (status === 'delivered') {
          delivery.finalStatus = 'delivered';
          delivery.completedAt = new Date();
        } else if (delivery.attempts.length >= 3) {
          delivery.finalStatus = 'failed';
          delivery.completedAt = new Date();
        }

        // Update Redis
        await setRedisJson(
          this.redis,
          `delivery:${deliveryId}`,
          delivery,
          this.DELIVERY_TTL
        );

        // Update database - preserve content field, only update delivery tracking
        // Use updateMany to gracefully handle case where record was deleted (e.g., during test cleanup)
        const updateResult = await this.prisma.notification.updateMany({
          where: { id: deliveryId },
          data: {
            sent: status === 'delivered',
            sentAt: status === 'delivered' ? new Date() : undefined,
            failed: status === 'failed' && delivery.finalStatus === 'failed',
            failReason: error,
            metadata: serializeNotificationMetadata({
              priority: delivery.priority,
              notificationType: delivery.type,
              deliveryTracking: true,
              filterId: delivery.notificationPayload?.filterId || undefined,
              deliveryAttempts: delivery.attempts.length,
              finalStatus: delivery.finalStatus,
              emailSent:
                channel === 'email' ? status === 'delivered' : null,
              websocketSent:
                channel === 'websocket' ? status === 'delivered' : null,
            }),
          },
        });

        if (updateResult.count === 0) {
          this.logger.debug(`Notification ${deliveryId} not found in database (may have been cleaned up)`);
        }

        const statusEmoji = status === 'delivered' ? '✅' : '❌';
        this.logger.log(
          `${statusEmoji} Attempt ${attempt.attemptNumber} for ${deliveryId} via ${channel}: ${status}${error ? ` (${error})` : ''}`
        );
      },
      {
        throwOnError: false
      }
    );
  }

  /**
   * Get delivery record
   */
  async getDelivery(deliveryId: string): Promise<NotificationDelivery | null> {
    return withErrorHandling(
      this.logger,
      `getting delivery ${deliveryId}`,
      async () => {
        return await getRedisJson<NotificationDelivery>(
          this.redis,
          `delivery:${deliveryId}`,
          this.logger
        );
      },
      {
        throwOnError: false,
        fallbackValue: null
      }
    );
  }

  /**
   * Get delivery statistics for a user
   */
  async getUserDeliveryStats(
    userId: string,
    hours: number = 24
  ): Promise<{
    total: number;
    delivered: number;
    failed: number;
    pending: number;
    deliveryRate: number;
  }> {
    return withErrorHandling(
      this.logger,
      `getting delivery stats for user ${userId}`,
      async () => {
        const since = new Date(Date.now() - hours * 60 * 60 * 1000);

        const notifications = await this.prisma.notification.findMany({
          where: {
            userId,
            createdAt: { gte: since },
          },
        });

        const total = notifications.length;
        const delivered = notifications.filter((n: Notification) => n.sent).length;
        const failed = notifications.filter((n: Notification) => n.failed).length;
        const pending = total - delivered - failed;
        const deliveryRate = total > 0 ? (delivered / total) * 100 : 0;

        return {
          total,
          delivered,
          failed,
          pending,
          deliveryRate: Math.round(deliveryRate * 10) / 10,
        };
      },
      {
        throwOnError: false,
        fallbackValue: { total: 0, delivered: 0, failed: 0, pending: 0, deliveryRate: 0 }
      }
    );
  }

  /**
   * Get failed deliveries that need retry
   */
  async getFailedDeliveriesForRetry(): Promise<NotificationDelivery[]> {
    return withErrorHandling(
      this.logger,
      'getting failed deliveries for retry',
      async () => {
        const pattern = 'delivery:*';
        // Use SCAN instead of KEYS to prevent blocking Redis in production
        const keys = await scanKeys(this.redis, pattern);
        const failedDeliveries: NotificationDelivery[] = [];

        if (keys.length === 0) return failedDeliveries;

        const deliveries = await this.redis.mget(keys);
        const now = new Date();

        for (const deliveryData of deliveries) {
          if (!deliveryData) continue;

          try {
            const delivery = JSON.parse(deliveryData) as NotificationDelivery;

            // Check if delivery needs retry
            if (
              delivery.finalStatus === 'pending' &&
              delivery.attempts.length > 0
            ) {
              const lastAttempt = delivery.attempts[delivery.attempts.length - 1];

              if (
                lastAttempt.status === 'failed' &&
                lastAttempt.nextRetryAt &&
                new Date(lastAttempt.nextRetryAt) <= now
              ) {
                failedDeliveries.push(delivery);
              }
            }
          } catch (parseError) {
            this.logger.error('Error parsing delivery data:', parseError);
          }
        }

        return failedDeliveries;
      },
      {
        throwOnError: false,
        fallbackValue: []
      }
    );
  }

  /**
   * Schedule a retry for a failed delivery
   */
  async scheduleRetry(
    deliveryId: string,
    delayMinutes: number = 0
  ): Promise<void> {
    await withErrorHandling(
      this.logger,
      `scheduling retry for ${deliveryId}`,
      async () => {
        const delivery = await this.getDelivery(deliveryId);
        if (!delivery) return;

        const retryAt = new Date(Date.now() + delayMinutes * 60 * 1000);

        await this.redis.setex(
          `retry:${deliveryId}`,
          60 * 60, // 1 hour TTL
          retryAt.toISOString()
        );

        this.logger.debug(
          `🔄 Scheduled retry for ${deliveryId} at ${retryAt.toISOString()}`
        );
      },
      {
        throwOnError: false
      }
    );
  }

  /**
   * Get overall delivery statistics
   */
  async getOverallStats(hours: number = 24): Promise<{
    totalDeliveries: number;
    successfulDeliveries: number;
    failedDeliveries: number;
    averageDeliveryRate: number;
    typeBreakdown: Record<string, { total: number; successful: number }>;
  }> {
    return withErrorHandling(
      this.logger,
      'getting overall delivery stats',
      async () => {
        const since = new Date(Date.now() - hours * 60 * 60 * 1000);

        const notifications = await this.prisma.notification.findMany({
          where: {
            createdAt: { gte: since },
          },
        });

        const totalDeliveries = notifications.length;
        const successfulDeliveries = notifications.filter(
          (n: Notification) => n.sent
        ).length;
        const failedDeliveries = notifications.filter(
          (n: Notification) => n.failed
        ).length;
        const averageDeliveryRate =
          totalDeliveries > 0
            ? (successfulDeliveries / totalDeliveries) * 100
            : 0;

        // Type breakdown
        const typeBreakdown: Record<
          string,
          { total: number; successful: number }
        > = {};

        for (const notification of notifications) {
          const type = notification.type || 'unknown';
          if (!typeBreakdown[type]) {
            typeBreakdown[type] = { total: 0, successful: 0 };
          }
          typeBreakdown[type].total++;
          if (notification.sent) {
            typeBreakdown[type].successful++;
          }
        }

        return {
          totalDeliveries,
          successfulDeliveries,
          failedDeliveries,
          averageDeliveryRate: Math.round(averageDeliveryRate * 10) / 10,
          typeBreakdown,
        };
      },
      {
        throwOnError: false,
        fallbackValue: {
          totalDeliveries: 0,
          successfulDeliveries: 0,
          failedDeliveries: 0,
          averageDeliveryRate: 0,
          typeBreakdown: {},
        }
      }
    );
  }

  /**
   * Cleanup old delivery records
   */
  async cleanupOldDeliveries(): Promise<void> {
    await withErrorHandling(
      this.logger,
      'cleaning up old deliveries',
      async () => {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        // Cleanup database records
        const deleted = await this.prisma.notification.deleteMany({
          where: {
            createdAt: { lt: sevenDaysAgo },
          },
        });

        this.logger.debug(`🧹 Cleaned up ${deleted.count} old delivery records`);
      },
      {
        throwOnError: false
      }
    );
  }

  private generateDeliveryId(): string {
    return `delivery_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateAttemptId(): string {
    return `attempt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private calculateNextRetry(attemptNumber: number): Date {
    // Exponential backoff: 1min, 5min, 15min
    const delays = [1, 5, 15];
    const delayMinutes = delays[Math.min(attemptNumber - 1, delays.length - 1)];
    return new Date(Date.now() + delayMinutes * 60 * 1000);
  }

  /**
   * Get notifications for a user with unified payload format
   * Returns notifications with content field containing the complete payload
   * @param userId - User ID to get notifications for
   * @param options - Filtering and pagination options
   * @returns Notifications in unified format matching WebSocket structure
   */
  async getNotifications(
    userId: string,
    options: {
      read?: boolean;
      page?: number;
      limit?: number;
    } = {}
  ): Promise<{
    data: UnifiedNotificationPayload[];
    totalCount: number;
    unreadCount: number;
    currentPage?: number;
    hasMore?: boolean;
  }> {
    return withErrorHandling(
      this.logger,
      `getting notifications for user ${userId}`,
      async () => {
        const { read, page, limit = 20 } = options;

        // Build where clause
        const where: Record<string, unknown> = { userId };
        if (read !== undefined) {
          where.isRead = read;
        }

        // Get total count and unread count
        const [totalCount, unreadCount] = await Promise.all([
          this.prisma.notification.count({ where }),
          this.prisma.notification.count({
            where: { userId, isRead: false },
          }),
        ]);

        // Build query with pagination if requested
        const query: Prisma.NotificationFindManyArgs = {
          where,
          orderBy: { createdAt: 'desc' as const },
          take: limit,
        };

        if (page !== undefined) {
          query.skip = (page - 1) * limit;
        }

        const notifications = await this.prisma.notification.findMany(query);

        // Transform to unified format - content field already has the payload
        const unifiedNotifications: UnifiedNotificationPayload[] = notifications
          .map((notification) => {
            const payload = deserializeNotificationPayloadOrNull(
              notification.content,
              (error) => this.logger.warn(`Failed to deserialize notification ${notification.id}: ${error}`)
            );
            if (!payload) return null;
            return {
              ...payload,
              read: notification.isRead,
            };
          })
          .filter((n): n is UnifiedNotificationPayload => n !== null);

        const result = {
          data: unifiedNotifications,
          totalCount,
          unreadCount,
          ...(page !== undefined && {
            currentPage: page,
            hasMore: page * limit < totalCount,
          }),
        };

        return result;
      },
      {
        throwOnError: false,
        fallbackValue: {
          data: [],
          totalCount: 0,
          unreadCount: 0,
        }
      }
    );
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string): Promise<void> {
    return withErrorHandling(
      this.logger,
      `marking notification ${notificationId} as read`,
      async () => {
        await this.prisma.notification.update({
          where: { id: notificationId },
          data: {
            isRead: true,
            readAt: new Date(),
          },
        });

        this.logger.debug(`📖 Marked notification ${notificationId} as read`);
      }
    );
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string): Promise<number> {
    return withErrorHandling(
      this.logger,
      `marking all notifications as read for user ${userId}`,
      async () => {
        const result = await this.prisma.notification.updateMany({
          where: {
            userId,
            isRead: false,
          },
          data: {
            isRead: true,
            readAt: new Date(),
          },
        });

        this.logger.debug(
          `📖 Marked ${result.count} notifications as read for user ${userId}`
        );
        return result.count;
      }
    );
  }

  /**
   * Delete a notification
   */
  async deleteNotification(
    notificationId: string,
    userId: string
  ): Promise<void> {
    return withErrorHandling(
      this.logger,
      `deleting notification ${notificationId}`,
      async () => {
        await this.prisma.notification.delete({
          where: {
            id: notificationId,
            userId, // Ensure user can only delete their own notifications
          },
        });

        this.logger.debug(
          `🗑️ Deleted notification ${notificationId} for user ${userId}`
        );
      }
    );
  }

}
