import { Injectable } from '@nestjs/common';
import { createServiceLogger } from '@dealscrapper/shared-logging';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '@dealscrapper/database';
import { notifierLogConfig } from '../config/logging.config.js';

export interface CleanupStats {
  oldNotificationsDeleted: number;
  usersProcessedForLimit: number;
  limitEnforcementDeleted: number;
  totalProcessingTimeMs: number;
}

@Injectable()
export class NotificationCleanupJob {
  private readonly logger = createServiceLogger(notifierLogConfig);

  // Cleanup rules
  private readonly READ_NOTIFICATION_RETENTION_DAYS = 30;
  private readonly UNREAD_NOTIFICATION_RETENTION_DAYS = 90; // Keep unread longer
  private readonly MAX_NOTIFICATIONS_PER_USER = 1000;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Daily cleanup job - runs at 2 AM every day
   */
  @Cron('0 2 * * *', {
    name: 'notification-cleanup',
    timeZone: 'UTC',
  })
  async runDailyCleanup(): Promise<void> {
    const startTime = Date.now();
    this.logger.log('🧹 Starting daily notification cleanup job');

    try {
      const stats = await this.performCleanup();
      const processingTime = Date.now() - startTime;

      this.logger.log(
        `✅ Cleanup completed successfully in ${processingTime}ms: ${JSON.stringify({
          oldNotificationsDeleted: stats.oldNotificationsDeleted,
          usersProcessedForLimit: stats.usersProcessedForLimit,
          limitEnforcementDeleted: stats.limitEnforcementDeleted,
          totalProcessingTimeMs: processingTime,
        })}`
      );
    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.logger.error(
        `❌ Cleanup job failed after ${processingTime}ms:`,
        error
      );
      throw error;
    }
  }

  /**
   * Manual cleanup method for testing or manual execution
   */
  async performCleanup(): Promise<CleanupStats> {
    const stats: CleanupStats = {
      oldNotificationsDeleted: 0,
      usersProcessedForLimit: 0,
      limitEnforcementDeleted: 0,
      totalProcessingTimeMs: 0,
    };

    // Step 1: Clean up old READ notifications
    const readCutoffDate = new Date();
    readCutoffDate.setDate(
      readCutoffDate.getDate() - this.READ_NOTIFICATION_RETENTION_DAYS
    );

    const oldReadDeleted = await this.prisma.notification.deleteMany({
      where: {
        isRead: true,
        readAt: {
          lt: readCutoffDate,
        },
      },
    });

    stats.oldNotificationsDeleted += oldReadDeleted.count;
    this.logger.debug(
      `🗑️ Deleted ${oldReadDeleted.count} old read notifications`
    );

    // Step 2: Clean up old UNREAD notifications (keep longer)
    const unreadCutoffDate = new Date();
    unreadCutoffDate.setDate(
      unreadCutoffDate.getDate() - this.UNREAD_NOTIFICATION_RETENTION_DAYS
    );

    const oldUnreadDeleted = await this.prisma.notification.deleteMany({
      where: {
        isRead: false,
        createdAt: {
          lt: unreadCutoffDate,
        },
      },
    });

    stats.oldNotificationsDeleted += oldUnreadDeleted.count;
    this.logger.debug(
      `🗑️ Deleted ${oldUnreadDeleted.count} very old unread notifications`
    );

    // Step 3: Enforce per-user limits
    const limitStats = await this.enforceUserLimits();
    stats.usersProcessedForLimit = limitStats.usersProcessed;
    stats.limitEnforcementDeleted = limitStats.notificationsDeleted;

    return stats;
  }

  /**
   * Enforce per-user notification limits (keep newest 1000 per user)
   */
  private async enforceUserLimits(): Promise<{
    usersProcessed: number;
    notificationsDeleted: number;
  }> {
    // Find users with excess notifications
    const usersWithExcess = await this.prisma.$queryRaw<
      { userId: string; count: bigint }[]
    >`
      SELECT "userId", COUNT(*) as count 
      FROM notifications 
      GROUP BY "userId" 
      HAVING COUNT(*) > ${this.MAX_NOTIFICATIONS_PER_USER}
    `;

    let totalDeleted = 0;

    for (const user of usersWithExcess) {
      const userId = user.userId;
      const excessCount = Number(user.count) - this.MAX_NOTIFICATIONS_PER_USER;

      if (excessCount > 0) {
        // Delete oldest notifications for this user (keep newest 1000)
        const oldestNotifications = await this.prisma.notification.findMany({
          where: { userId },
          orderBy: { createdAt: 'asc' },
          take: excessCount,
        });

        const idsToDelete = oldestNotifications.map((n) => n.id);

        if (idsToDelete.length > 0) {
          const deleted = await this.prisma.notification.deleteMany({
            where: {
              id: { in: idsToDelete },
            },
          });

          totalDeleted += deleted.count;
          this.logger.debug(
            `👤 Deleted ${deleted.count} excess notifications for user ${userId} (had ${user.count}, kept ${this.MAX_NOTIFICATIONS_PER_USER})`
          );
        }
      }
    }

    this.logger.debug(
      `📊 Processed ${usersWithExcess.length} users with excess notifications, deleted ${totalDeleted} total`
    );

    return {
      usersProcessed: usersWithExcess.length,
      notificationsDeleted: totalDeleted,
    };
  }

  /**
   * Get cleanup statistics without performing cleanup
   */
  async getCleanupPreview(): Promise<{
    oldReadNotifications: number;
    oldUnreadNotifications: number;
    usersExceedingLimit: number;
    totalNotificationsToDelete: number;
  }> {
    // Count old read notifications
    const readCutoffDate = new Date();
    readCutoffDate.setDate(
      readCutoffDate.getDate() - this.READ_NOTIFICATION_RETENTION_DAYS
    );

    const oldReadCount = await this.prisma.notification.count({
      where: {
        isRead: true,
        readAt: {
          lt: readCutoffDate,
        },
      },
    });

    // Count old unread notifications
    const unreadCutoffDate = new Date();
    unreadCutoffDate.setDate(
      unreadCutoffDate.getDate() - this.UNREAD_NOTIFICATION_RETENTION_DAYS
    );

    const oldUnreadCount = await this.prisma.notification.count({
      where: {
        isRead: false,
        createdAt: {
          lt: unreadCutoffDate,
        },
      },
    });

    // Count users exceeding limit
    const usersWithExcess = await this.prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count
      FROM (
        SELECT "userId" 
        FROM notifications 
        GROUP BY "userId" 
        HAVING COUNT(*) > ${this.MAX_NOTIFICATIONS_PER_USER}
      ) as excess_users
    `;

    const usersExceedingLimit = Number(usersWithExcess[0]?.count || 0);

    return {
      oldReadNotifications: oldReadCount,
      oldUnreadNotifications: oldUnreadCount,
      usersExceedingLimit,
      totalNotificationsToDelete: oldReadCount + oldUnreadCount,
    };
  }

  /**
   * Get current system statistics
   */
  async getSystemStats(): Promise<{
    totalNotifications: number;
    totalUsers: number;
    avgNotificationsPerUser: number;
    oldestNotification: Date | null;
    newestNotification: Date | null;
  }> {
    const [
      totalNotifications,
      totalUsers,
      oldestNotification,
      newestNotification,
    ] = await Promise.all([
      this.prisma.notification.count(),
      this.prisma.notification
        .groupBy({
          by: ['userId'],
          _count: true,
        })
        .then((groups) => groups.length),
      this.prisma.notification
        .findFirst({
          orderBy: { createdAt: 'asc' },
        })
        .then((n) => n?.createdAt || null),
      this.prisma.notification
        .findFirst({
          orderBy: { createdAt: 'desc' },
        })
        .then((n) => n?.createdAt || null),
    ]);

    return {
      totalNotifications,
      totalUsers,
      avgNotificationsPerUser:
        totalUsers > 0 ? Math.round(totalNotifications / totalUsers) : 0,
      oldestNotification,
      newestNotification,
    };
  }
}
