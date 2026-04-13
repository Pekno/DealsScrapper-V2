import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { NotificationsController } from '../../../src/notifications/notifications.controller.js';
import { NotificationsService } from '../../../src/notifications/notifications.service.js';
import { JwtAuthGuard } from '../../../src/auth/jwt-auth.guard.js';

// Mock guard that always allows access
const mockJwtAuthGuard = {
  canActivate: jest.fn().mockReturnValue(true),
};

describe('NotificationsController', () => {
  let controller: NotificationsController;
  let notificationsService: jest.Mocked<NotificationsService>;

  beforeEach(async () => {
    const mockNotificationsService = {
      getNotifications: jest.fn(),
      markAsRead: jest.fn(),
      markAllAsRead: jest.fn(),
      deleteNotification: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        { provide: NotificationsService, useValue: mockNotificationsService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockJwtAuthGuard)
      .compile();

    controller = module.get<NotificationsController>(NotificationsController);
    notificationsService = module.get(NotificationsService);

    // Suppress logger output in tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getNotifications()', () => {
    it('should return notifications for authenticated user', async () => {
      const mockResponse = {
        data: [{ type: 'deal-match', data: { dealId: 'deal-123' } }],
        totalCount: 1,
        unreadCount: 1,
        currentPage: 1,
        hasMore: false,
      };

      notificationsService.getNotifications.mockResolvedValue(mockResponse);

      // Controller uses @CurrentUser('sub') for userId, and individual @Query params
      const result = await controller.getNotifications('user-123', undefined, 1, 10);

      expect(result).toEqual(mockResponse);
      expect(notificationsService.getNotifications).toHaveBeenCalledWith('user-123', {
        read: undefined,
        page: 1,
        limit: 10,
      });
    });

    it('should pass read filter to service', async () => {
      const mockResponse = { data: [], totalCount: 0, unreadCount: 0 };
      notificationsService.getNotifications.mockResolvedValue(mockResponse);

      await controller.getNotifications('user-123', false, undefined, undefined);

      expect(notificationsService.getNotifications).toHaveBeenCalledWith('user-123', {
        read: false,
        page: undefined,
        limit: 20, // default limit
      });
    });

    it('should use default limit when not provided', async () => {
      const mockResponse = { data: [], totalCount: 0, unreadCount: 0 };
      notificationsService.getNotifications.mockResolvedValue(mockResponse);

      await controller.getNotifications('user-123', undefined, undefined, undefined);

      expect(notificationsService.getNotifications).toHaveBeenCalledWith('user-123', {
        read: undefined,
        page: undefined,
        limit: 20,
      });
    });
  });

  describe('markAsRead()', () => {
    it('should mark notification as read', async () => {
      notificationsService.markAsRead.mockResolvedValue(undefined);

      // Controller uses @Param('id') and @CurrentUser('sub')
      await controller.markAsRead('notification-123', 'user-123');

      expect(notificationsService.markAsRead).toHaveBeenCalledWith('notification-123', 'user-123');
    });

    it('should propagate service errors', async () => {
      notificationsService.markAsRead.mockRejectedValue(new Error('Not found'));

      await expect(controller.markAsRead('notification-123', 'user-123')).rejects.toThrow('Not found');
    });
  });

  describe('markAllAsRead()', () => {
    it('should mark all notifications as read and return count', async () => {
      notificationsService.markAllAsRead.mockResolvedValue(5);

      const result = await controller.markAllAsRead('user-123');

      // Controller returns success response with { count }
      expect(result).toEqual({
        success: true,
        data: { count: 5 },
        message: '5 notifications marked as read',
      });
      expect(notificationsService.markAllAsRead).toHaveBeenCalledWith('user-123');
    });

    it('should return 0 when no notifications to mark', async () => {
      notificationsService.markAllAsRead.mockResolvedValue(0);

      const result = await controller.markAllAsRead('user-123');

      expect(result).toEqual({
        success: true,
        data: { count: 0 },
        message: '0 notifications marked as read',
      });
    });
  });

  describe('deleteNotification()', () => {
    it('should delete notification', async () => {
      notificationsService.deleteNotification.mockResolvedValue(undefined);

      await controller.deleteNotification('notification-123', 'user-123');

      expect(notificationsService.deleteNotification).toHaveBeenCalledWith(
        'notification-123',
        'user-123'
      );
    });

    it('should propagate service errors', async () => {
      notificationsService.deleteNotification.mockRejectedValue(new Error('Forbidden'));

      await expect(controller.deleteNotification('notification-123', 'user-123')).rejects.toThrow(
        'Forbidden'
      );
    });
  });
});
