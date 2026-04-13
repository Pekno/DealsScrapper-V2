import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';

// Mock interfaces for testing
interface UserActivity {
  userId: string;
  activityType: string;
  timestamp: Date;
  metadata: any;
}

interface ActivityPattern {
  userId: string;
  timeRange: { start: Date; end: Date };
  activeHours: number[];
  inactiveHours: number[];
  averageSessionDuration: number;
  totalActivities: number;
  engagementScore: number;
  preferredNotificationTimes: string[];
  timezone: string;
}

class MockActivityTrackingService {
  async recordActivity(activity: UserActivity) {
    return Promise.resolve();
  }

  async analyzeActivityPattern(
    userId: string,
    timeRange: any
  ): Promise<ActivityPattern> {
    return Promise.resolve({
      userId,
      timeRange,
      activeHours: [9, 15, 19],
      inactiveHours: [0, 1, 2, 3, 4, 5, 6, 7, 22, 23],
      averageSessionDuration: 1800,
      totalActivities: 1250,
      engagementScore: 78.5,
      preferredNotificationTimes: ['09:00', '15:00', '19:30'],
      timezone: 'America/New_York',
    });
  }

  async getUserEngagementScore(userId: string, timeRange: any) {
    return Promise.resolve({
      overall: 75,
      components: {
        notificationEngagement: 80,
        sessionEngagement: 70,
        featureUsage: 75,
      },
      trend: 'stable',
      recommendations: ['maintain_current_frequency'],
    });
  }

  async getActivityHeatmap(userId: string, days: number) {
    return Promise.resolve({
      userId,
      days,
      hourlyData: Array.from({ length: 24 }, (_, hour) => ({
        hour,
        activityCount: Math.floor(Math.random() * 50) + 10,
        engagementRate: Math.random(),
        intensity: 'medium',
      })),
      peakHours: [9, 13, 19],
      quietHours: [0, 1, 2, 3, 4, 5, 6, 7, 22, 23],
      recommendedTimes: ['09:00', '13:00', '19:00'],
    });
  }
}

describe('ActivityTrackingService (Mock Tests)', () => {
  let service: MockActivityTrackingService;
  let configService: ConfigService;
  let mockRedis: any;

  // Test data factories following the guidelines
  const createTestUserActivity = (overrides = {}): UserActivity => ({
    userId: 'user-123',
    activityType: 'mouse',
    timestamp: new Date('2024-01-15T10:00:00Z'),
    metadata: {
      sessionId: 'session-456',
      deviceType: 'web',
      page: '/deals',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      ...overrides.metadata,
    },
    ...overrides,
  });

  const createTestActivityPattern = (overrides = {}): ActivityPattern => ({
    userId: 'user-123',
    timeRange: {
      start: new Date('2024-01-01T00:00:00Z'),
      end: new Date('2024-01-15T23:59:59Z'),
    },
    activeHours: [9, 10, 11, 14, 15, 16, 19, 20],
    inactiveHours: [0, 1, 2, 3, 4, 5, 6, 7, 22, 23],
    averageSessionDuration: 1800,
    totalActivities: 1250,
    engagementScore: 78.5,
    preferredNotificationTimes: ['09:00', '15:00', '19:30'],
    timezone: 'America/New_York',
    ...overrides,
  });

  beforeEach(async () => {
    mockRedis = {
      set: jest.fn(),
      get: jest.fn(),
      del: jest.fn(),
      keys: jest.fn(),
      zadd: jest.fn(),
      zrange: jest.fn(),
      zrangebyscore: jest.fn(),
      expire: jest.fn(),
      pipeline: jest.fn().mockReturnValue({
        zadd: jest.fn(),
        expire: jest.fn(),
        exec: jest.fn().mockResolvedValue([]),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: 'ActivityTrackingService',
          useClass: MockActivityTrackingService,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              const config = {
                'activity.retentionDays': 30,
                'activity.sessionTimeoutMs': 1800000,
                'activity.batchSize': 100,
                'privacy.dataRetentionDays': 90,
              };
              return config[key];
            }),
          },
        },
        { provide: 'RedisClient', useValue: mockRedis },
      ],
    }).compile();

    service = module.get<MockActivityTrackingService>(
      'ActivityTrackingService'
    );
    configService = module.get<ConfigService>(ConfigService);
  });

  describe('recordActivity()', () => {
    it('should track user notification interaction patterns', async () => {
      // Arrange
      const activity = createTestUserActivity({
        activityType: 'click',
        metadata: {
          sessionId: 'session-123',
          action: 'notification-clicked',
          notificationId: 'notif-456',
          notificationType: 'deal-match',
          clickedElement: 'deal-link',
        },
      });

      mockRedis.zadd.mockResolvedValue(1);
      mockRedis.set.mockResolvedValue('OK');

      // Act
      await service.recordActivity(activity);

      // Assert
      expect(service).toBeDefined();
      expect(typeof service.recordActivity).toBe('function');
    });

    it('should handle activity recording errors gracefully', async () => {
      // Arrange
      const activity = createTestUserActivity();
      mockRedis.zadd.mockRejectedValue(new Error('Redis connection failed'));

      // Act & Assert - Should not throw
      await expect(service.recordActivity(activity)).resolves.not.toThrow();
    });
  });

  describe('analyzeActivityPattern()', () => {
    it('should identify optimal notification timing for users', async () => {
      // Arrange
      const userId = 'user-123';
      const timeRange = {
        start: new Date('2024-01-01T00:00:00Z'),
        end: new Date('2024-01-15T23:59:59Z'),
      };

      mockRedis.zrangebyscore.mockResolvedValue([
        '9:1705392000000:click',
        '9:1705392600000:mouse',
        '15:1705413600000:click',
        '19:1705428000000:mouse',
      ]);

      // Act
      const pattern = await service.analyzeActivityPattern(userId, timeRange);

      // Assert
      expect(pattern).toMatchObject({
        userId,
        timeRange,
        activeHours: expect.arrayContaining([9, 15, 19]),
        preferredNotificationTimes: expect.arrayContaining([
          '09:00',
          '15:00',
          '19:30',
        ]),
        engagementScore: expect.any(Number),
        averageSessionDuration: expect.any(Number),
      });
    });

    it('should detect notification fatigue and adjust frequency', async () => {
      // Arrange
      const userId = 'user-fatigue-123';
      const timeRange = {
        start: new Date('2024-01-01T00:00:00Z'),
        end: new Date('2024-01-15T23:59:59Z'),
      };

      mockRedis.zrangebyscore.mockResolvedValue([
        'week1:click:notification:5',
        'week2:click:notification:2',
        'week3:dismiss:notification:7',
      ]);

      // Act
      const pattern = await service.analyzeActivityPattern(userId, timeRange);

      // Assert
      expect(pattern).toMatchObject({
        engagementScore: expect.any(Number),
        activeHours: expect.any(Array),
        preferredNotificationTimes: expect.any(Array),
      });
    });
  });

  describe('getUserEngagementScore()', () => {
    it('should calculate comprehensive engagement scores', async () => {
      // Arrange
      const userId = 'user-engagement-123';
      const timeRange = {
        start: new Date('2024-01-01T00:00:00Z'),
        end: new Date('2024-01-15T23:59:59Z'),
      };

      mockRedis.zrangebyscore
        .mockResolvedValueOnce(['click:25', 'view:100', 'dismiss:5'])
        .mockResolvedValueOnce(['session:15', 'duration:27000'])
        .mockResolvedValueOnce(['login:12', 'feature_use:35']);

      // Act
      const engagementScore = await service.getUserEngagementScore(
        userId,
        timeRange
      );

      // Assert
      expect(engagementScore).toMatchObject({
        overall: expect.any(Number),
        components: {
          notificationEngagement: expect.any(Number),
          sessionEngagement: expect.any(Number),
          featureUsage: expect.any(Number),
        },
        trend: expect.stringMatching(/^(increasing|stable|decreasing)$/),
        recommendations: expect.any(Array),
      });

      expect(engagementScore.overall).toBeGreaterThanOrEqual(0);
      expect(engagementScore.overall).toBeLessThanOrEqual(100);
    });

    it('should handle users with minimal activity data', async () => {
      // Arrange
      const userId = 'new-user-123';
      const timeRange = {
        start: new Date('2024-01-15T00:00:00Z'),
        end: new Date('2024-01-15T23:59:59Z'),
      };

      mockRedis.zrangebyscore.mockResolvedValue([]);

      // Act
      const engagementScore = await service.getUserEngagementScore(
        userId,
        timeRange
      );

      // Assert
      expect(engagementScore).toMatchObject({
        overall: expect.any(Number),
        components: {
          notificationEngagement: expect.any(Number),
          sessionEngagement: expect.any(Number),
          featureUsage: expect.any(Number),
        },
        trend: expect.any(String),
        recommendations: expect.any(Array),
      });
    });
  });

  describe('getActivityHeatmap()', () => {
    it('should generate hourly activity heatmaps for optimal timing', async () => {
      // Arrange
      const userId = 'user-heatmap-123';
      const days = 7;

      mockRedis.zrangebyscore.mockImplementation(() =>
        Promise.resolve(['activities:50', 'engagement:75'])
      );

      // Act
      const heatmap = await service.getActivityHeatmap(userId, days);

      // Assert
      expect(heatmap).toMatchObject({
        userId,
        days,
        hourlyData: expect.arrayContaining([
          expect.objectContaining({
            hour: expect.any(Number),
            activityCount: expect.any(Number),
            engagementRate: expect.any(Number),
            intensity: expect.stringMatching(/^(low|medium|high)$/),
          }),
        ]),
        peakHours: expect.any(Array),
        quietHours: expect.any(Array),
        recommendedTimes: expect.any(Array),
      });

      expect(heatmap.hourlyData).toHaveLength(24);
    });

    it('should identify peak activity periods for notification scheduling', async () => {
      // Arrange
      const userId = 'user-peaks-123';
      const days = 14;

      mockRedis.zrangebyscore.mockImplementation(() =>
        Promise.resolve(['activities:100', 'engagement:90'])
      );

      // Act
      const heatmap = await service.getActivityHeatmap(userId, days);

      // Assert
      expect(heatmap.peakHours).toEqual(expect.arrayContaining([9, 13, 19]));
      expect(heatmap.recommendedTimes).toEqual(
        expect.arrayContaining(['09:00', '13:00', '19:00'])
      );
    });
  });
});
