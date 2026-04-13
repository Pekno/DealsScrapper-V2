import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { NotificationsService } from '../../../src/notifications/notifications.service.js';
import { PrismaService } from '@dealscrapper/database';
import { NotificationRepository } from '../../../src/repositories/notification.repository.js';
import { DeliveryTrackingService } from '../../../src/services/delivery-tracking.service.js';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prismaService: jest.Mocked<PrismaService>;
  let notificationRepository: jest.Mocked<NotificationRepository>;
  let deliveryTrackingService: jest.Mocked<DeliveryTrackingService>;

  const mockNotification = {
    id: 'notification-123',
    userId: 'user-123',
    type: 'deal-match',
    isRead: false,
    readAt: null,
    createdAt: new Date('2024-01-15T10:00:00Z'),
  };

  beforeEach(async () => {
    const mockPrisma = {
      notification: {
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        delete: jest.fn(),
      },
    };

    const mockNotificationRepo = {
      create: jest.fn(),
      findByUserId: jest.fn(),
      findById: jest.fn(),
    };

    const mockDeliveryTracking = {
      getNotifications: jest.fn(),
      createDelivery: jest.fn(),
      recordAttempt: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NotificationRepository, useValue: mockNotificationRepo },
        { provide: DeliveryTrackingService, useValue: mockDeliveryTracking },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    prismaService = module.get(PrismaService);
    notificationRepository = module.get(NotificationRepository);
    deliveryTrackingService = module.get(DeliveryTrackingService);
  });

  describe('getNotifications()', () => {
    it('should return notifications for a user', async () => {
      const mockResponse = {
        data: [
          {
            type: 'deal-match' as const,
            data: { dealId: 'deal-123' },
            priority: 'normal' as const,
            timestamp: new Date(),
          },
        ],
        totalCount: 1,
        unreadCount: 1,
        currentPage: 1,
        hasMore: false,
      };

      deliveryTrackingService.getNotifications.mockResolvedValue(mockResponse);

      const result = await service.getNotifications('user-123', { page: 1, limit: 10 });

      expect(result).toEqual(mockResponse);
      expect(deliveryTrackingService.getNotifications).toHaveBeenCalledWith('user-123', { page: 1, limit: 10 });
    });

    it('should handle empty notifications', async () => {
      const mockResponse = {
        data: [],
        totalCount: 0,
        unreadCount: 0,
        currentPage: 1,
        hasMore: false,
      };

      deliveryTrackingService.getNotifications.mockResolvedValue(mockResponse);

      const result = await service.getNotifications('user-123');

      expect(result.data).toHaveLength(0);
      expect(result.totalCount).toBe(0);
    });

    it('should filter by read status', async () => {
      const mockResponse = {
        data: [],
        totalCount: 0,
        unreadCount: 0,
      };

      deliveryTrackingService.getNotifications.mockResolvedValue(mockResponse);

      await service.getNotifications('user-123', { read: false });

      expect(deliveryTrackingService.getNotifications).toHaveBeenCalledWith('user-123', { read: false });
    });
  });

  describe('markAsRead()', () => {
    it('should mark notification as read for the owner', async () => {
      prismaService.notification.findUnique.mockResolvedValue(mockNotification);
      prismaService.notification.update.mockResolvedValue({ ...mockNotification, isRead: true });

      await service.markAsRead('notification-123', 'user-123');

      expect(prismaService.notification.update).toHaveBeenCalledWith({
        where: { id: 'notification-123' },
        data: {
          isRead: true,
          readAt: expect.any(Date),
        },
      });
    });

    it('should throw NotFoundException when notification does not exist', async () => {
      prismaService.notification.findUnique.mockResolvedValue(null);

      await expect(service.markAsRead('nonexistent', 'user-123')).rejects.toThrow(
        NotFoundException
      );
    });

    it('should throw ForbiddenException when user does not own notification', async () => {
      prismaService.notification.findUnique.mockResolvedValue({
        ...mockNotification,
        userId: 'other-user',
      });

      await expect(service.markAsRead('notification-123', 'user-123')).rejects.toThrow(
        ForbiddenException
      );
    });
  });

  describe('markAllAsRead()', () => {
    it('should mark all unread notifications as read', async () => {
      prismaService.notification.updateMany.mockResolvedValue({ count: 5 });

      const result = await service.markAllAsRead('user-123');

      expect(result).toBe(5);
      expect(prismaService.notification.updateMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-123',
          isRead: false,
        },
        data: {
          isRead: true,
          readAt: expect.any(Date),
        },
      });
    });

    it('should return 0 when no unread notifications exist', async () => {
      prismaService.notification.updateMany.mockResolvedValue({ count: 0 });

      const result = await service.markAllAsRead('user-123');

      expect(result).toBe(0);
    });
  });

  describe('deleteNotification()', () => {
    it('should delete notification for the owner', async () => {
      prismaService.notification.findUnique.mockResolvedValue(mockNotification);
      prismaService.notification.delete.mockResolvedValue(mockNotification);

      await service.deleteNotification('notification-123', 'user-123');

      expect(prismaService.notification.delete).toHaveBeenCalledWith({
        where: { id: 'notification-123' },
      });
    });

    it('should throw NotFoundException when notification does not exist', async () => {
      prismaService.notification.findUnique.mockResolvedValue(null);

      await expect(service.deleteNotification('nonexistent', 'user-123')).rejects.toThrow(
        NotFoundException
      );
    });

    it('should throw ForbiddenException when user does not own notification', async () => {
      prismaService.notification.findUnique.mockResolvedValue({
        ...mockNotification,
        userId: 'other-user',
      });

      await expect(service.deleteNotification('notification-123', 'user-123')).rejects.toThrow(
        ForbiddenException
      );
    });
  });

  describe('markAsReadByPixel()', () => {
    it('should mark notification as read without user validation', async () => {
      prismaService.notification.updateMany.mockResolvedValue({ count: 1 });

      await service.markAsReadByPixel('notification-123');

      expect(prismaService.notification.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'notification-123',
          isRead: false,
        },
        data: {
          isRead: true,
          readAt: expect.any(Date),
        },
      });
    });

    it('should handle already-read notification gracefully', async () => {
      prismaService.notification.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.markAsReadByPixel('notification-123')).resolves.not.toThrow();
    });
  });
});
