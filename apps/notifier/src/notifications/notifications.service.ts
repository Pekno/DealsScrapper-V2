import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '@dealscrapper/database';
import { UnifiedNotificationPayload } from '@dealscrapper/shared-types';
import { NotificationRepository } from '../repositories/notification.repository.js';
import { DeliveryTrackingService } from '../services/delivery-tracking.service.js';

interface GetNotificationsOptions {
  read?: boolean;
  page?: number;
  limit?: number;
}

interface NotificationResponse {
  data: UnifiedNotificationPayload[];
  totalCount: number;
  unreadCount: number;
  currentPage?: number;
  hasMore?: boolean;
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationRepository: NotificationRepository,
    private readonly deliveryTracking: DeliveryTrackingService
  ) {}

  /**
   * Get notifications for a user with filtering and pagination
   */
  /**
   * Get notifications for a user with filtering and pagination
   * Returns notifications in unified format from the delivery tracking service
   * @param userId - User ID to get notifications for
   * @param options - Filtering and pagination options
   * @returns Notifications in unified format matching WebSocket and API structure
   */
  async getNotifications(
    userId: string,
    options: GetNotificationsOptions = {}
  ): Promise<NotificationResponse> {
    // Use DeliveryTrackingService which returns unified notification format
    return this.deliveryTracking.getNotifications(userId, options);
  }

  /**
   * Mark notification as read - ensures user can only mark their own notifications
   */
  async markAsRead(notificationId: string, userId: string): Promise<void> {
    // Verify notification belongs to user
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    if (notification.userId !== userId) {
      throw new ForbiddenException(
        'You can only mark your own notifications as read'
      );
    }

    // Mark as read
    await this.prisma.notification.update({
      where: { id: notificationId },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string): Promise<number> {
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

    return result.count;
  }

  /**
   * Delete a notification - ensures user can only delete their own notifications
   */
  async deleteNotification(
    notificationId: string,
    userId: string
  ): Promise<void> {
    // Verify notification belongs to user
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    if (notification.userId !== userId) {
      throw new ForbiddenException(
        'You can only delete your own notifications'
      );
    }

    await this.prisma.notification.delete({
      where: { id: notificationId },
    });
  }

  /**
   * Mark notification as read via tracking pixel (no auth required)
   */
  async markAsReadByPixel(notificationId: string): Promise<void> {
    // This is called by tracking pixel, so no user validation needed
    await this.prisma.notification.updateMany({
      where: {
        id: notificationId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }
}
