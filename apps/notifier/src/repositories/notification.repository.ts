import { Injectable } from '@nestjs/common';
import { PrismaService, Notification, Prisma } from '@dealscrapper/database';
import { AbstractBaseRepository } from '@dealscrapper/shared-repository';
import type {
  PaginationOptions,
  PaginatedResult,
} from '@dealscrapper/shared-repository';

/**
 * Notification repository interface defining all notification-specific operations
 */
export interface INotificationRepository {
  findByUserId(userId: string): Promise<Notification[]>;
  findUnsentNotifications(): Promise<Notification[]>;
  findFailedNotifications(): Promise<Notification[]>;
  findByType(type: string, userId?: string): Promise<Notification[]>;
  markAsSent(notificationId: string): Promise<Notification>;
  markAsFailed(
    notificationId: string,
    failReason: string
  ): Promise<Notification>;
  findRecentNotifications(
    userId: string,
    hours: number
  ): Promise<Notification[]>;
  getNotificationStats(userId?: string): Promise<{
    total: number;
    sent: number;
    failed: number;
    pending: number;
    read: number;
    unread: number;
    byType: Record<string, number>;
  }>;
  cleanupOldNotifications(olderThanDays: number): Promise<number>;
  findForRetry(maxAttempts?: number): Promise<Notification[]>;
  healthCheck(): Promise<boolean>;
}

/**
 * Notification repository implementation with comprehensive notification management operations
 */
@Injectable()
export class NotificationRepository
  extends AbstractBaseRepository<
    Notification,
    Prisma.NotificationCreateInput,
    Prisma.NotificationUpdateInput,
    Prisma.NotificationWhereUniqueInput
  >
  implements INotificationRepository
{
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  /**
   * Get the Prisma model delegate for notifications
   */
  protected getModel() {
    return this.prisma.notification;
  }

  /**
   * Find notification by unique identifier
   */
  async findUnique(
    where: Prisma.NotificationWhereUniqueInput
  ): Promise<Notification | null> {
    return this.executeWithErrorHandling(
      'findUnique',
      () => this.prisma.notification.findUnique({ where }),
      { where }
    );
  }

  /**
   * Find multiple notifications with optional filtering
   */
  async findMany(
    where?: Prisma.NotificationWhereInput
  ): Promise<Notification[]> {
    return this.executeWithErrorHandling(
      'findMany',
      () =>
        this.prisma.notification.findMany({
          where,
          orderBy: { createdAt: 'desc' },
        }),
      { where }
    );
  }

  /**
   * Find notifications with pagination support
   */
  async findManyPaginated(
    where?: Prisma.NotificationWhereInput,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<Notification>> {
    this.validatePagination(pagination);

    const page = pagination?.page || 1;
    const limit = Math.min(pagination?.limit || 50, 200); // Cap limit at 200
    const skip = pagination?.offset || (page - 1) * limit;

    const [notifications, total] = await Promise.all([
      this.executeWithErrorHandling(
        'findManyPaginated',
        () =>
          this.prisma.notification.findMany({
            where,
            skip,
            take: limit,
            orderBy: { createdAt: 'desc' },
            // Use include for proper typing instead of select
            include: {
              // Include related data if needed
            },
          }),
        { where, pagination }
      ),
      this.count(where),
    ]);

    return {
      data: notifications,
      pagination: this.calculatePaginationMetadata(total, pagination),
    };
  }

  /**
   * Count notifications matching criteria
   */
  async count(where?: Prisma.NotificationWhereInput): Promise<number> {
    return this.executeWithErrorHandling(
      'count',
      () => this.prisma.notification.count({ where }),
      { where }
    );
  }

  /**
   * Create a new notification
   */
  async create(data: Prisma.NotificationCreateInput): Promise<Notification> {
    // Extract userId from either direct field or user relation
    const userId =
      'userId' in data
        ? data.userId
        : data.user && 'connect' in data.user
          ? data.user.connect?.id
          : undefined;

    this.validateRequiredFields(data as Record<string, unknown>, [
      'type',
      'channel',
      'content',
    ]);

    // Additional validation for notification-specific fields
    if (typeof userId !== 'string' || userId.trim().length === 0) {
      throw new Error('userId must be a non-empty string');
    }

    if (typeof data.type !== 'string' || data.type.trim().length === 0) {
      throw new Error('type must be a non-empty string');
    }

    return this.executeWithErrorHandling(
      'create',
      () =>
        this.prisma.notification.create({
          data: {
            ...data,
            createdAt: new Date(),
          },
          // Use include for proper typing
          include: {
            // Include relations if needed
          },
        }),
      { data }
    );
  }

  /**
   * Create multiple notifications in a transaction
   */
  async createMany(
    data: Prisma.NotificationCreateInput[]
  ): Promise<Notification[]> {
    return this.executeWithErrorHandling(
      'createMany',
      async () => {
        const notifications: Notification[] = [];
        for (const notificationData of data) {
          const notification = await this.create(notificationData);
          notifications.push(notification);
        }
        return notifications;
      },
      { count: data.length }
    );
  }

  /**
   * Update an existing notification
   */
  async update(
    where: Prisma.NotificationWhereUniqueInput,
    data: Prisma.NotificationUpdateInput
  ): Promise<Notification> {
    return this.executeWithErrorHandling(
      'update',
      () => this.prisma.notification.update({ where, data }),
      { where, data }
    );
  }

  /**
   * Update multiple notifications matching criteria
   */
  async updateMany(
    where: Prisma.NotificationWhereInput,
    data: Prisma.NotificationUpdateInput
  ): Promise<number> {
    const result = await this.executeWithErrorHandling(
      'updateMany',
      () => this.prisma.notification.updateMany({ where, data }),
      { where, data }
    );
    return result.count;
  }

  /**
   * Delete a notification
   */
  async delete(
    where: Prisma.NotificationWhereUniqueInput
  ): Promise<Notification> {
    return this.executeWithErrorHandling(
      'delete',
      () => this.prisma.notification.delete({ where }),
      { where }
    );
  }

  /**
   * Delete multiple notifications matching criteria
   */
  async deleteMany(where: Prisma.NotificationWhereInput): Promise<number> {
    const result = await this.executeWithErrorHandling(
      'deleteMany',
      () => this.prisma.notification.deleteMany({ where }),
      { where }
    );
    return result.count;
  }

  /**
   * Create or update a notification (upsert operation)
   */
  async upsert(
    where: Prisma.NotificationWhereUniqueInput,
    create: Prisma.NotificationCreateInput,
    update: Prisma.NotificationUpdateInput
  ): Promise<Notification> {
    return this.executeWithErrorHandling(
      'upsert',
      () => this.prisma.notification.upsert({ where, create, update }),
      { where, create, update }
    );
  }

  /**
   * Check if a notification exists
   */
  async exists(where: Prisma.NotificationWhereUniqueInput): Promise<boolean> {
    const notification = await this.findUnique(where);
    return notification !== null;
  }

  // Notification-specific methods

  /**
   * Find all notifications for a specific user
   */
  async findByUserId(userId: string): Promise<Notification[]> {
    return this.findMany({ userId });
  }

  /**
   * Find all unsent notifications
   */
  async findUnsentNotifications(): Promise<Notification[]> {
    return this.findMany({
      sent: false,
      failed: false,
    });
  }

  /**
   * Find all failed notifications
   */
  async findFailedNotifications(): Promise<Notification[]> {
    return this.findMany({ failed: true });
  }

  /**
   * Find notifications by type, optionally filtered by user
   */
  async findByType(type: string, userId?: string): Promise<Notification[]> {
    const where: Prisma.NotificationWhereInput = { type };
    if (userId) {
      where.userId = userId;
    }
    return this.findMany(where);
  }

  /**
   * Mark notification as sent
   */
  async markAsSent(notificationId: string): Promise<Notification> {
    return this.update(
      { id: notificationId },
      {
        sent: true,
        sentAt: new Date(),
        failed: false,
        failReason: null,
      }
    );
  }

  /**
   * Mark notification as failed with reason
   */
  async markAsFailed(
    notificationId: string,
    failReason: string
  ): Promise<Notification> {
    return this.update(
      { id: notificationId },
      {
        failed: true,
        failReason,
        sent: false,
      }
    );
  }

  /**
   * Find recent notifications for a user within specified hours
   */
  async findRecentNotifications(
    userId: string,
    hours: number
  ): Promise<Notification[]> {
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - hours);

    return this.findMany({
      userId,
      createdAt: {
        gte: cutoffDate,
      },
    });
  }

  /**
   * Get comprehensive notification statistics
   */
  async getNotificationStats(userId?: string): Promise<{
    total: number;
    sent: number;
    failed: number;
    pending: number;
    read: number;
    unread: number;
    byType: Record<string, number>;
  }> {
    return this.executeWithErrorHandling(
      'getNotificationStats',
      async () => {
        const baseWhere: Prisma.NotificationWhereInput = userId
          ? { userId }
          : {};

        const [total, sent, failed, pending, read, unread, typeStats] =
          await Promise.all([
            this.count(baseWhere),
            this.count({ ...baseWhere, sent: true }),
            this.count({ ...baseWhere, failed: true }),
            this.count({ ...baseWhere, sent: false, failed: false }),
            this.count({ ...baseWhere, isRead: true }),
            this.count({ ...baseWhere, isRead: false }),
            this.prisma.notification.groupBy({
              by: ['type'],
              _count: { id: true },
              where: baseWhere,
            }),
          ]);

        const byType: Record<string, number> = {};
        typeStats.forEach((stat) => {
          byType[stat.type] = stat._count?.id || 0;
        });

        return {
          total,
          sent,
          failed,
          pending,
          read,
          unread,
          byType,
        };
      },
      { userId }
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
            createdAt: {
              lt: cutoffDate,
            },
            sent: true, // Only delete sent notifications
          },
        });
        return result.count;
      },
      { olderThanDays, cutoffDate }
    );
  }

  /**
   * Find notifications eligible for retry
   */
  async findForRetry(maxAttempts: number = 3): Promise<Notification[]> {
    // Note: This is a simplified version as the current schema doesn't have attempt tracking
    // In a real implementation, you'd want to add attempt tracking fields
    return this.findMany({
      failed: true,
      sentAt: null,
      // Add attempt count logic when schema supports it
    });
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
