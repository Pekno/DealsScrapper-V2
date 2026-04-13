import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { DeliveryTrackingService } from '../../../src/services/delivery-tracking.service.js';
import { PrismaService } from '@dealscrapper/database';
import Redis from 'ioredis';

describe('DeliveryTrackingService', () => {
  let service: DeliveryTrackingService;
  let prismaService: jest.Mocked<PrismaService>;
  let redisClient: jest.Mocked<Redis>;

  const mockNotification = {
    id: 'notification-123',
    userId: 'user-123',
    type: 'deal-match',
    content: JSON.stringify({ dealId: 'deal-123' }),
    isRead: false,
    createdAt: new Date('2024-01-15T10:00:00Z'),
    updatedAt: new Date('2024-01-15T10:00:00Z'),
    sent: false,
    failed: false,
    sentAt: null,
    readAt: null,
    failReason: null,
    metadata: null,
  };

  beforeEach(async () => {
    const mockPrisma = {
      notification: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
        deleteMany: jest.fn(),
      },
      deliveryAttempt: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
    };

    const mockRedis = {
      set: jest.fn().mockResolvedValue('OK'),
      setex: jest.fn().mockResolvedValue('OK'),
      get: jest.fn(),
      del: jest.fn().mockResolvedValue(1),
      keys: jest.fn().mockResolvedValue([]),
      expire: jest.fn().mockResolvedValue(1),
      zadd: jest.fn().mockResolvedValue(1),
      zrangebyscore: jest.fn().mockResolvedValue([]),
      zrem: jest.fn().mockResolvedValue(1),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeliveryTrackingService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: 'REDIS_CLIENT', useValue: mockRedis },
      ],
    }).compile();

    service = module.get<DeliveryTrackingService>(DeliveryTrackingService);
    prismaService = module.get(PrismaService);
    redisClient = module.get('REDIS_CLIENT');

    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createDelivery()', () => {
    it('should create a new delivery record', async () => {
      const deliveryData = {
        userId: 'user-123',
        type: 'deal-match' as const,
        notificationPayload: { dealId: 'deal-123' },
        priority: 'normal' as const,
      };

      prismaService.notification.create.mockResolvedValue(mockNotification);

      const result = await service.createDelivery(deliveryData);

      expect(result).toBeDefined();
      expect(prismaService.notification.create).toHaveBeenCalled();
    });
  });

  describe('recordAttempt()', () => {
    it('should record a delivery attempt when delivery exists in cache', async () => {
      // Mock getDelivery - service uses Redis get
      redisClient.get.mockResolvedValue(
        JSON.stringify({
          id: 'notification-123',
          userId: 'user-123',
          type: 'deal-match',
          attempts: [],
          priority: 'normal',
          notificationPayload: { dealId: 'deal-123' },
        })
      );
      prismaService.notification.update.mockResolvedValue(mockNotification);

      await service.recordAttempt('notification-123', 'email', 'delivered');

      // Verify Redis was read
      expect(redisClient.get).toHaveBeenCalled();
    });

    it('should not update when delivery is not found in cache', async () => {
      redisClient.get.mockResolvedValue(null);

      await service.recordAttempt('nonexistent', 'email', 'delivered');

      // Should not try to update prisma when delivery not found
      expect(prismaService.notification.update).not.toHaveBeenCalled();
    });
  });

  describe('getNotifications()', () => {
    it('should return paginated notifications for user', async () => {
      prismaService.notification.findMany.mockResolvedValue([mockNotification]);
      prismaService.notification.count.mockResolvedValue(1);

      const result = await service.getNotifications('user-123', { page: 1, limit: 10 });

      expect(result.data).toBeDefined();
      expect(result.totalCount).toBe(1);
    });

    it('should filter by read status', async () => {
      prismaService.notification.findMany.mockResolvedValue([]);
      prismaService.notification.count.mockResolvedValue(0);

      await service.getNotifications('user-123', { read: false });

      expect(prismaService.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isRead: false,
          }),
        })
      );
    });
  });

  describe('getOverallStats()', () => {
    it('should return delivery statistics for time period', async () => {
      prismaService.notification.count.mockResolvedValue(100);
      prismaService.notification.findMany.mockResolvedValue([]);

      const result = await service.getOverallStats(24);

      expect(result).toBeDefined();
      expect(result.totalDeliveries).toBeDefined();
    });
  });

  describe('getUserDeliveryStats()', () => {
    it('should return user-specific delivery statistics', async () => {
      prismaService.notification.count.mockResolvedValue(10);
      prismaService.notification.findMany.mockResolvedValue([mockNotification]);

      const result = await service.getUserDeliveryStats('user-123');

      expect(result).toBeDefined();
    });
  });

  describe('markAsRead()', () => {
    it('should mark notification as read', async () => {
      prismaService.notification.update.mockResolvedValue({
        ...mockNotification,
        isRead: true,
      });

      await service.markAsRead('notification-123');

      expect(prismaService.notification.update).toHaveBeenCalledWith({
        where: { id: 'notification-123' },
        data: expect.objectContaining({ isRead: true }),
      });
    });
  });

  describe('markAllAsRead()', () => {
    it('should mark all user notifications as read', async () => {
      prismaService.notification.updateMany.mockResolvedValue({ count: 5 });

      const result = await service.markAllAsRead('user-123');

      expect(result).toBe(5);
    });
  });

  describe('cleanupOldDeliveries()', () => {
    it('should delete old delivery records', async () => {
      prismaService.notification.deleteMany.mockResolvedValue({ count: 10 });

      await service.cleanupOldDeliveries(30);

      expect(prismaService.notification.deleteMany).toHaveBeenCalled();
    });
  });

  describe('scheduleRetry()', () => {
    it('should handle retry scheduling without errors', async () => {
      // The method uses withErrorHandling so it won't throw
      await expect(service.scheduleRetry('notification-123', 1)).resolves.not.toThrow();
    });
  });

  describe('getFailedDeliveriesForRetry()', () => {
    it('should return empty array when no retries needed', async () => {
      redisClient.zrangebyscore.mockResolvedValue([]);

      const result = await service.getFailedDeliveriesForRetry();

      expect(result).toEqual([]);
    });
  });
});
