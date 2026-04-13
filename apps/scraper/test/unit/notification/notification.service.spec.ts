import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bull';
import { NotificationService } from '../../../src/notification/notification.service';
import { PrismaService } from '@dealscrapper/database';
import { Article, Filter, Match } from '@dealscrapper/database';

describe('NotificationService', () => {
  let service: NotificationService;
  let prismaService: jest.Mocked<PrismaService>;
  let externalNotificationQueue: jest.Mocked<any>;

  const mockPrismaService = {
    match: {
      update: jest.fn(),
    },
  };

  const mockQueue = {
    add: jest.fn(),
  };

  const mockMatch: Match & { filter: Filter; article: Article } = {
    id: 'match-123',
    filterId: 'filter-123',
    articleId: 'article-123',
    score: 85.5,
    notified: false,
    notifiedAt: null,
    createdAt: new Date(),
    filter: {
      id: 'filter-123',
      name: 'Test Filter',
      createdAt: new Date(),
      userId: 'user-123',
      description: 'Test filter for laptops',
      active: true,
      updatedAt: new Date(),
      filterExpression: {
        operator: 'AND',
        rules: [
          { field: 'category', operator: 'EQUALS', value: 'electronics' },
          { field: 'currentPrice', operator: '>=', value: 500 },
          { field: 'currentPrice', operator: '<=', value: 1500 },
        ],
      },
      immediateNotifications: true,
      digestFrequency: 'daily',
      maxNotificationsPerDay: 10,
      totalMatches: 0,
      matchesLast24h: 0,
      lastMatchAt: null,
    } as Filter,
    article: {
      id: 'article-123',
      externalId: 'ext-123',
      title: 'Gaming Laptop Dell',
      description: 'Gaming laptop with high specs',
      categoryId: 'cat-123',
      categoryPath: ['Informatique', 'Ordinateurs'],
      currentPrice: 999.99,
      originalPrice: 1299.99,
      discountPercentage: 25,
      discountAmount: 300,
      merchant: 'Dell',
      storeLocation: null,
      freeShipping: true,
      temperature: 150,
      commentCount: 10,
      communityVerified: true,
      publishedAt: new Date(),
      expiresAt: null,
      url: 'https://example.com/laptop',
      imageUrl: 'https://example.com/image.jpg',
      isExpired: false,
      isCoupon: false,
      siteId: 'dealabs',
      isActive: true,
      scrapedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Article,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: getQueueToken('notifications'),
          useValue: mockQueue,
        },
      ],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
    prismaService = module.get(PrismaService);
    externalNotificationQueue = module.get(getQueueToken('notifications'));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('User Deal Alerts', () => {
    it('should alert users when deals match their preferences', async () => {
      mockPrismaService.match.update.mockResolvedValue(mockMatch);

      await service.queueExternalNotification(mockMatch);

      // Business outcome: User gets notified about relevant deals
      // NOTE: merchant, temperature, discountPercentage are now in extension tables,
      // so the service returns defaults ('Unknown', undefined, undefined)
      expect(externalNotificationQueue.add).toHaveBeenCalledWith(
        'deal-match-found',
        expect.objectContaining({
          userId: 'user-123',
          dealData: expect.objectContaining({
            title: 'Gaming Laptop Dell',
            price: 999.99,
            url: 'https://example.com/laptop',
            score: 85.5,
            merchant: 'Unknown', // Extension fields not loaded
          }),
          priority: 'high',
        }),
        expect.objectContaining({
          priority: expect.any(Number),
          attempts: 3,
        })
      );
    });

    it('should prioritize exceptional deals for immediate user attention', async () => {
      const highScoreMatch = { ...mockMatch, score: 90 };
      mockPrismaService.match.update.mockResolvedValue(highScoreMatch);

      await service.queueExternalNotification(highScoreMatch);

      // Business outcome: Users get high-priority alerts for exceptional deals
      const queueCall = externalNotificationQueue.add.mock.calls[0];
      expect(queueCall[1].priority).toBe('high');
      expect(queueCall[2].priority).toBe(10);
    });

    it('should calculate correct priority for normal score', async () => {
      const normalScoreMatch = { ...mockMatch, score: 65 };
      mockPrismaService.match.update.mockResolvedValue(normalScoreMatch);

      await service.queueExternalNotification(normalScoreMatch);

      const queueCall = externalNotificationQueue.add.mock.calls[0];
      expect(queueCall[1].priority).toBe('normal');
      expect(queueCall[2].priority).toBe(5);
    });

    it('should calculate correct priority for low score', async () => {
      const lowScoreMatch = { ...mockMatch, score: 45 };
      mockPrismaService.match.update.mockResolvedValue(lowScoreMatch);

      await service.queueExternalNotification(lowScoreMatch);

      const queueCall = externalNotificationQueue.add.mock.calls[0];
      expect(queueCall[1].priority).toBe('low');
      expect(queueCall[2].priority).toBe(1);
    });

    it('should prevent duplicate notifications to avoid user annoyance', async () => {
      mockPrismaService.match.update.mockResolvedValue(mockMatch);

      await service.queueExternalNotification(mockMatch);

      // Business behavior: Track notifications to prevent spam
      expect(prismaService.match.update).toHaveBeenCalledWith({
        where: { id: 'match-123' },
        data: {
          notified: true,
          notifiedAt: expect.any(Date),
        },
      });
    });

    it('should handle database errors gracefully when marking as notified', async () => {
      mockPrismaService.match.update.mockRejectedValue(
        new Error('Database error')
      );

      // Should not throw error
      await expect(
        service.queueExternalNotification(mockMatch)
      ).resolves.toBeUndefined();

      expect(externalNotificationQueue.add).toHaveBeenCalled();
    });

    it('should handle queue errors properly', async () => {
      externalNotificationQueue.add.mockRejectedValue(new Error('Queue error'));

      await expect(
        service.queueExternalNotification(mockMatch)
      ).rejects.toThrow('Queue error');
    });

    it('should include all required notification data', async () => {
      mockPrismaService.match.update.mockResolvedValue(mockMatch);

      await service.queueExternalNotification(mockMatch);

      const queueCall = externalNotificationQueue.add.mock.calls[0];
      const notificationData = queueCall[1];

      // NOTE: Extension fields (merchant, temperature, discountPercentage) are now in
      // site-specific tables. The service returns defaults since Article doesn't include them.
      expect(notificationData).toEqual({
        matchId: 'match-123',
        userId: 'user-123',
        filterId: 'filter-123',
        dealData: {
          title: 'Gaming Laptop Dell',
          price: 999.99,
          url: 'https://example.com/laptop',
          imageUrl: 'https://example.com/image.jpg',
          score: 85.5,
          merchant: 'Unknown', // Extension field - not loaded from base Article
          temperature: undefined, // Extension field - not loaded from base Article
          discountPercentage: undefined, // Extension field - not loaded from base Article
        },
        priority: 'high',
        timestamp: expect.any(Date),
      });
    });
  });
});
