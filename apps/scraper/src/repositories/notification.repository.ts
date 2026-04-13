import { Injectable } from '@nestjs/common';
import { PrismaService, Prisma } from '@dealscrapper/database';
import type { Notification } from '@dealscrapper/database';
import { AbstractBaseRepository } from '@dealscrapper/shared-repository';
import type {
  PaginationOptions,
  PaginatedResult,
} from '@dealscrapper/shared-repository';

/**
 * Notification content for match notifications
 */
export interface MatchNotificationContent {
  matchId: string;
  filterId: string;
  dealTitle: string;
  dealPrice: number;
  dealUrl: string;
  dealScore: number;
  merchant: string;
  temperature: number;
  discountPercentage?: number;
  imageUrl?: string;
}

/**
 * Notification repository interface for scraper-specific operations
 */
export interface INotificationRepository {
  createMatchNotification(data: {
    userId: string;
    matchId: string;
    content: MatchNotificationContent;
    priority?: 'high' | 'normal' | 'low';
  }): Promise<Notification>;
  findPendingMatchNotifications(): Promise<Notification[]>;
  findNotificationsByMatch(matchId: string): Promise<Notification[]>;
  findNotificationsByUser(
    userId: string,
    limit?: number
  ): Promise<Notification[]>;
  markNotificationsSent(notificationIds: string[]): Promise<number>;
  getNotificationMetrics(): Promise<{
    totalNotifications: number;
    pendingNotifications: number;
    sentNotifications: number;
    failedNotifications: number;
    byType: Record<string, number>;
    recentActivity: Array<{
      date: string;
      sent: number;
      failed: number;
    }>;
  }>;
  cleanupOldNotifications(olderThanDays: number): Promise<number>;
  healthCheck(): Promise<boolean>;
}

/**
 * Notification repository implementation for scraper service
 * Focuses on match-based notifications and external queue integration
 */
@Injectable()
export class NotificationRepository
  extends AbstractBaseRepository<
    Notification,
    Prisma.NotificationCreateInput,
    Prisma.NotificationUpdateInput,
    Prisma.NotificationWhereInput
  >
  implements INotificationRepository
{
  constructor(protected readonly prisma: PrismaService) {
    super(prisma);
  }

  /**
   * Implementation of abstract method - returns the Prisma model delegate
   */
  protected getModel() {
    return this.prisma.notification;
  }

  /**
   * Required fields for notification creation
   */
  protected getRequiredCreateFields(): string[] {
    return ['userId', 'type', 'channel', 'content'];
  }

  // Scraper-specific notification methods

  /**
   * Creates a match notification for external processing by the Notifier service
   * 
   * Generates a DEAL_MATCH notification when a deal matches a user's filter criteria.
   * The notification is created in pending state and will be picked up by the Notifier
   * service queue for email/WebSocket delivery.
   * 
   * @param data - Notification data containing user, match, and content information
   * @param data.userId - ID of the user who owns the matched filter
   * @param data.matchId - ID of the Match record linking deal to filter
   * @param data.content - Deal information formatted for notification template
   * @param data.priority - Notification priority level (default: 'normal')
   * @returns Promise resolving to created Notification record
   * 
   * @example
   * ```typescript
   * const notification = await repository.createMatchNotification({
   *   userId: 'user-123',
   *   matchId: 'match-456',
   *   content: {
   *     dealTitle: 'Gaming Laptop 50% off',
   *     dealPrice: 599.99,
   *     filterId: 'filter-789',
   *     filterName: 'Cheap Gaming Laptops'
   *   },
   *   priority: 'high'
   * });
   * ```
   * 
   * @remarks
   * - Notification type is set to 'DEAL_MATCH'
   * - Initial state: sent=false, failed=false
   * - Metadata includes source='scraper' for tracking
   * - Content is stored as JSON for template rendering
   */
  async createMatchNotification(data: {
    userId: string;
    matchId: string;
    content: MatchNotificationContent;
    priority?: 'high' | 'normal' | 'low';
  }): Promise<Notification> {
    const notificationData: Prisma.NotificationCreateInput = {
      user: {
        connect: { id: data.userId },
      },
      type: 'DEAL_MATCH', // Updated to match TDD specification
      subject: `New deal match: ${data.content.dealTitle}`,
      content: JSON.parse(JSON.stringify(data.content)) as Prisma.InputJsonValue,
      metadata: {
        matchId: data.matchId,
        filterId: data.content.filterId,
        priority: data.priority || 'normal',
        source: 'scraper',
        createdByService: 'scraper',
      },
      sent: false,
      failed: false,
    };

    return this.create(notificationData);
  }

  /**
   * Find pending match notifications for external queue processing
   */
  async findPendingMatchNotifications(): Promise<Notification[]> {
    return this.findMany({
      type: 'deal-match',
      sent: false,
      failed: false,
    } as Prisma.NotificationWhereInput);
  }

  /**
   * Find notifications by match ID
   */
  async findNotificationsByMatch(matchId: string): Promise<Notification[]> {
    return this.executeWithErrorHandling(
      'findNotificationsByMatch',
      () =>
        this.prisma.notification.findMany({
          where: {
            type: 'deal-match',
            metadata: {
              path: ['matchId'],
              equals: matchId,
            },
          },
          orderBy: { createdAt: 'desc' },
        }),
      { matchId }
    );
  }

  /**
   * Find recent notifications for a user
   */
  async findNotificationsByUser(
    userId: string,
    limit: number = 50
  ): Promise<Notification[]> {
    return this.executeWithErrorHandling(
      'findNotificationsByUser',
      () =>
        this.prisma.notification.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: limit,
        }),
      { userId, limit }
    );
  }

  /**
   * Mark multiple notifications as sent
   */
  async markNotificationsSent(notificationIds: string[]): Promise<number> {
    return this.executeWithErrorHandling(
      'markNotificationsSent',
      async () => {
        const result = await this.prisma.notification.updateMany({
          where: {
            id: { in: notificationIds },
          },
          data: {
            sent: true,
            sentAt: new Date(),
            failed: false,
          },
        });
        return result.count;
      },
      { notificationIds }
    );
  }

  /**
   * Get comprehensive notification metrics for monitoring
   */
  async getNotificationMetrics(): Promise<{
    totalNotifications: number;
    pendingNotifications: number;
    sentNotifications: number;
    failedNotifications: number;
    byType: Record<string, number>;
    recentActivity: Array<{
      date: string;
      sent: number;
      failed: number;
    }>;
  }> {
    return this.executeWithErrorHandling(
      'getNotificationMetrics',
      async () => {
        const [total, pending, sent, failed, typeStats] = await Promise.all([
          this.count(),
          this.count({ sent: false, failed: false }),
          this.count({ sent: true }),
          this.count({ failed: true }),
          this.prisma.notification.groupBy({
            by: ['type'],
            _count: { id: true },
          }),
        ]);

        const byType: Record<string, number> = {};
        typeStats.forEach((stat) => {
          byType[stat.type] = stat._count.id;
        });

        // Get recent activity (last 7 days)
        const recentActivity: Array<{
          date: string;
          sent: number;
          failed: number;
        }> = [];
        for (let i = 6; i >= 0; i--) {
          const date = new Date();
          date.setDate(date.getDate() - i);
          const startOfDay = new Date(date.setHours(0, 0, 0, 0));
          const endOfDay = new Date(date.setHours(23, 59, 59, 999));

          const [sentCount, failedCount] = await Promise.all([
            this.count({
              sent: true,
              sentAt: { gte: startOfDay, lte: endOfDay },
            }),
            this.count({
              failed: true,
              createdAt: { gte: startOfDay, lte: endOfDay },
            }),
          ]);

          recentActivity.push({
            date: startOfDay.toISOString().split('T')[0],
            sent: sentCount,
            failed: failedCount,
          });
        }

        return {
          totalNotifications: total,
          pendingNotifications: pending,
          sentNotifications: sent,
          failedNotifications: failed,
          byType,
          recentActivity,
        };
      },
      {}
    );
  }

  /**
   * Clean up old notifications beyond retention period
   */
  async cleanupOldNotifications(olderThanDays: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    return this.executeWithErrorHandling(
      'cleanupOldNotifications',
      async () => {
        const result = await this.prisma.notification.deleteMany({
          where: {
            createdAt: { lt: cutoffDate },
            sent: true, // Only cleanup sent notifications
          },
        });
        return result.count;
      },
      { olderThanDays }
    );
  }

  /**
   * Repository health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.count();
      return true;
    } catch {
      return false;
    }
  }
}
