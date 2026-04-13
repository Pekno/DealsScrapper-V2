import { Injectable } from '@nestjs/common';
import { PrismaService, Notification, Prisma } from '@dealscrapper/database';
import { AbstractBaseRepository } from '@dealscrapper/shared-repository';
import type {
  PaginationOptions,
  PaginatedResult,
} from '@dealscrapper/shared-repository';

/**
 * Enhanced delivery tracking data extending notification model
 */
export interface DeliveryRecord extends Notification {
  deliveryAttempts: number;
  lastAttemptAt?: Date;
  nextRetryAt?: Date;
  deliveryStatus: 'pending' | 'delivered' | 'failed' | 'retrying';
}

/**
 * Delivery attempt tracking
 */
export interface DeliveryAttempt {
  id: string;
  notificationId: string;
  type: string;
  attemptNumber: number;
  status: 'pending' | 'delivered' | 'failed' | 'retrying';
  attemptedAt: Date;
  deliveredAt?: Date;
  failedAt?: Date;
  error?: string;
  nextRetryAt?: Date;
}

/**
 * Delivery metrics for monitoring
 */
export interface DeliveryMetrics {
  totalDeliveries: number;
  successfulDeliveries: number;
  failedDeliveries: number;
  pendingDeliveries: number;
  readDeliveries: number;
  unreadDeliveries: number;
  retryingDeliveries: number;
  averageDeliveryTime: number;
  deliverySuccessRate: number;
  byType: Record<
    string,
    {
      total: number;
      successful: number;
      failed: number;
      successRate: number;
    }
  >;
  recentFailures: Array<{
    notificationId: string;
    type: string;
    error: string;
    failedAt: Date;
  }>;
}

/**
 * Delivery tracking repository interface
 */
export interface IDeliveryTrackingRepository {
  createDeliveryRecord(
    notification: Prisma.NotificationCreateInput
  ): Promise<Notification>;
  updateDeliveryStatus(
    notificationId: string,
    status: 'delivered' | 'failed' | 'retrying',
    error?: string
  ): Promise<Notification>;
  findPendingDeliveries(type?: string): Promise<Notification[]>;
  findFailedDeliveries(maxRetries?: number): Promise<Notification[]>;
  findDeliveriesForRetry(): Promise<Notification[]>;
  getDeliveryMetrics(timeframe?: {
    start: Date;
    end: Date;
  }): Promise<DeliveryMetrics>;
  cleanupDeliveryRecords(olderThanDays: number): Promise<number>;
  getTypePerformance(type: string): Promise<{
    total: number;
    successful: number;
    failed: number;
    averageDeliveryTime: number;
    recentErrors: string[];
  }>;
  findRecentDeliveries(hours: number, type?: string): Promise<Notification[]>;
  getDeliveryTrends(days: number): Promise<
    Array<{
      date: string;
      total: number;
      successful: number;
      failed: number;
    }>
  >;
  healthCheck(): Promise<boolean>;
}

/**
 * Delivery tracking repository implementation
 * Uses the notification model with additional delivery-specific logic
 */
@Injectable()
export class DeliveryTrackingRepository
  extends AbstractBaseRepository<
    Notification,
    Prisma.NotificationCreateInput,
    Prisma.NotificationUpdateInput,
    Prisma.NotificationWhereUniqueInput
  >
  implements IDeliveryTrackingRepository
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

  async findManyPaginated(
    where?: Prisma.NotificationWhereInput,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<Notification>> {
    throw new Error(
      'Pagination not implemented for delivery tracking - use notification repository instead'
    );
  }

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
    this.validateRequiredFields(data as Record<string, unknown>, [
      'userId',
      'type',
      'channel',
      'content',
    ]);

    return this.executeWithErrorHandling(
      'create',
      () => this.prisma.notification.create({ data }),
      { data }
    );
  }

  async createMany(
    data: Prisma.NotificationCreateInput[]
  ): Promise<Notification[]> {
    throw new Error(
      'Bulk creation not implemented for delivery tracking - use notification repository instead'
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

  async updateMany(
    where: Prisma.NotificationWhereInput,
    data: Prisma.NotificationUpdateInput
  ): Promise<number> {
    throw new Error(
      'Bulk updates not implemented for delivery tracking - use notification repository instead'
    );
  }

  async delete(
    where: Prisma.NotificationWhereUniqueInput
  ): Promise<Notification> {
    throw new Error(
      'Deletion not implemented for delivery tracking - use notification repository instead'
    );
  }

  async deleteMany(where: Prisma.NotificationWhereInput): Promise<number> {
    throw new Error(
      'Bulk deletion not implemented for delivery tracking - use notification repository instead'
    );
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

  // Delivery tracking specific methods

  /**
   * Create a new delivery record
   */
  async createDeliveryRecord(
    notification: Prisma.NotificationCreateInput
  ): Promise<Notification> {
    // Add delivery-specific metadata
    const deliveryData = {
      ...notification,
      metadata: {
        ...(notification.metadata as object),
        deliveryAttempts: 0,
        deliveryStatus: 'pending',
        createdForDelivery: true,
      },
    };

    return this.create(deliveryData);
  }

  /**
   * Update delivery status with tracking information
   */
  async updateDeliveryStatus(
    notificationId: string,
    status: 'delivered' | 'failed' | 'retrying',
    error?: string
  ): Promise<Notification> {
    const currentNotification = await this.findUnique({ id: notificationId });

    if (!currentNotification) {
      throw new Error(`Notification ${notificationId} not found`);
    }

    const currentMetadata = (currentNotification.metadata as Record<string, unknown>) || {};
    const deliveryAttempts = ((currentMetadata.deliveryAttempts as number) || 0) + 1;

    const updateData: Prisma.NotificationUpdateInput = {
      metadata: {
        ...currentMetadata,
        deliveryAttempts,
        deliveryStatus: status,
        lastAttemptAt: new Date(),
      },
    };

    if (status === 'delivered') {
      updateData.sent = true;
      updateData.sentAt = new Date();
      updateData.failed = false;
      updateData.failReason = null;
    } else if (status === 'failed') {
      updateData.failed = true;
      updateData.failReason = error || 'Delivery failed';
      updateData.sent = false;
    } else if (status === 'retrying') {
      // Calculate next retry time (exponential backoff)
      const retryDelay = Math.min(
        1000 * Math.pow(2, deliveryAttempts - 1),
        60000
      ); // Cap at 1 minute
      const nextRetryAt = new Date(Date.now() + retryDelay);

      (updateData.metadata as Record<string, unknown>).nextRetryAt = nextRetryAt;
      updateData.failed = false;
      updateData.sent = false;
    }

    return this.update({ id: notificationId }, updateData);
  }

  /**
   * Find pending deliveries, optionally filtered by type
   */
  async findPendingDeliveries(type?: string): Promise<Notification[]> {
    const where: Prisma.NotificationWhereInput = {
      sent: false,
      failed: false,
    };

    if (type) {
      where.type = type;
    }

    return this.findMany(where);
  }

  /**
   * Find failed deliveries that haven't exceeded max retries
   */
  async findFailedDeliveries(maxRetries: number = 3): Promise<Notification[]> {
    // Note: This is simplified since metadata querying in Prisma is complex
    // In a real implementation, you'd want dedicated columns for delivery tracking
    return this.findMany({
      failed: true,
      sent: false,
    });
  }

  /**
   * Find deliveries ready for retry
   */
  async findDeliveriesForRetry(): Promise<Notification[]> {
    // Simplified implementation - in reality you'd check nextRetryAt timestamp
    return this.findMany({
      failed: true,
      sent: false,
      // Would add: metadata.nextRetryAt <= now AND deliveryAttempts < maxRetries
    });
  }

  /**
   * Get comprehensive delivery metrics
   */
  async getDeliveryMetrics(timeframe?: {
    start: Date;
    end: Date;
  }): Promise<DeliveryMetrics> {
    return this.executeWithErrorHandling(
      'getDeliveryMetrics',
      async () => {
        const where: Prisma.NotificationWhereInput = {};

        if (timeframe) {
          where.createdAt = {
            gte: timeframe.start,
            lte: timeframe.end,
          };
        }

        const [total, successful, failed, pending, read, unread, typeStats] =
          await Promise.all([
            this.count(where),
            this.count({ ...where, sent: true }),
            this.count({ ...where, failed: true }),
            this.count({ ...where, sent: false, failed: false }),
            this.count({ ...where, isRead: true }),
            this.count({ ...where, isRead: false }),
            this.prisma.notification.groupBy({
              by: ['type'],
              _count: { id: true },
              where,
            }),
          ]);

        // Get type-specific metrics
        const byType: Record<string, {
          total: number;
          successful: number;
          failed: number;
          successRate: number;
        }> = {};
        for (const typeStat of typeStats) {
          const typeWhere = { ...where, type: typeStat.type };
          const [typeTotal, typeSuccessful, typeFailed] = await Promise.all([
            this.count(typeWhere),
            this.count({ ...typeWhere, sent: true }),
            this.count({ ...typeWhere, failed: true }),
          ]);

          byType[typeStat.type] = {
            total: typeTotal,
            successful: typeSuccessful,
            failed: typeFailed,
            successRate: typeTotal > 0 ? (typeSuccessful / typeTotal) * 100 : 0,
          };
        }

        // Get recent failures for debugging
        const recentFailures = await this.prisma.notification.findMany({
          where: {
            ...where,
            failed: true,
          },
          include: {},
          orderBy: { createdAt: 'desc' },
          take: 10,
        });

        const retrying = 0; // Would calculate from metadata in real implementation
        const averageDeliveryTime = 0; // Would calculate from sentAt - createdAt

        return {
          totalDeliveries: total,
          successfulDeliveries: successful,
          failedDeliveries: failed,
          pendingDeliveries: pending,
          readDeliveries: read,
          unreadDeliveries: unread,
          retryingDeliveries: retrying,
          averageDeliveryTime,
          deliverySuccessRate: total > 0 ? (successful / total) * 100 : 0,
          byType,
          recentFailures: recentFailures.map((f) => ({
            notificationId: f.id,
            type: f.type,
            error: f.failReason || 'Unknown error',
            failedAt: f.createdAt,
          })),
        };
      },
      { timeframe }
    );
  }

  /**
   * Clean up old delivery records
   */
  async cleanupDeliveryRecords(olderThanDays: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    return this.executeWithErrorHandling(
      'cleanupDeliveryRecords',
      async () => {
        const result = await this.prisma.notification.deleteMany({
          where: {
            createdAt: { lt: cutoffDate },
            sent: true, // Only cleanup successfully delivered notifications
          },
        });
        return result.count;
      },
      { olderThanDays }
    );
  }

  /**
   * Get performance metrics for a specific type
   */
  async getTypePerformance(type: string): Promise<{
    total: number;
    successful: number;
    failed: number;
    averageDeliveryTime: number;
    recentErrors: string[];
  }> {
    return this.executeWithErrorHandling(
      'getTypePerformance',
      async () => {
        const where = { type };

        const [total, successful, failed, recentFailedNotifications] =
          await Promise.all([
            this.count(where),
            this.count({ ...where, sent: true }),
            this.count({ ...where, failed: true }),
            this.prisma.notification.findMany({
              where: { ...where, failed: true },
              include: {},
              orderBy: { createdAt: 'desc' },
              take: 5,
            }),
          ]);

        const recentErrors = recentFailedNotifications
          .map((n) => n.failReason)
          .filter((reason) => reason !== null) as string[];

        return {
          total,
          successful,
          failed,
          averageDeliveryTime: 0, // Would calculate from delivery timestamps
          recentErrors,
        };
      },
      { type }
    );
  }

  /**
   * Find recent deliveries within specified hours
   */
  async findRecentDeliveries(
    hours: number,
    type?: string
  ): Promise<Notification[]> {
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - hours);

    const where: Prisma.NotificationWhereInput = {
      createdAt: { gte: cutoffDate },
    };

    if (type) {
      where.type = type;
    }

    return this.findMany(where);
  }

  /**
   * Get delivery trends over specified number of days
   */
  async getDeliveryTrends(days: number): Promise<
    Array<{
      date: string;
      total: number;
      successful: number;
      failed: number;
    }>
  > {
    return this.executeWithErrorHandling(
      'getDeliveryTrends',
      async () => {
        // This is a simplified implementation
        // In production, you'd want to use proper date grouping
        const trends: Array<{
          date: string;
          total: number;
          successful: number;
          failed: number;
        }> = [];

        for (let i = days - 1; i >= 0; i--) {
          const date = new Date();
          date.setDate(date.getDate() - i);
          const startOfDay = new Date(date.setHours(0, 0, 0, 0));
          const endOfDay = new Date(date.setHours(23, 59, 59, 999));

          const where = {
            createdAt: {
              gte: startOfDay,
              lte: endOfDay,
            },
          };

          const [total, successful, failed] = await Promise.all([
            this.count(where),
            this.count({ ...where, sent: true }),
            this.count({ ...where, failed: true }),
          ]);

          trends.push({
            date: startOfDay.toISOString().split('T')[0],
            total,
            successful,
            failed,
          });
        }

        return trends;
      },
      { days }
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
