import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { NotificationProcessor } from '../../../src/processors/notification.processor.js';
import { NotificationGateway } from '../../../src/websocket/notification.gateway.js';
import { UserStatusService } from '../../../src/services/user-status.service.js';
import { NotificationPreferencesService } from '../../../src/services/notification-preferences.service.js';
import { DeliveryTrackingService } from '../../../src/services/delivery-tracking.service.js';
import { EmailService } from '../../../src/channels/email.service.js';
import { TemplateService } from '../../../src/templates/template.service.js';
import { ChannelHealthService } from '../../../src/services/channel-health.service.js';
import { PrismaService } from '@dealscrapper/database';

describe('NotificationProcessor', () => {
  let processor: NotificationProcessor;
  let websocketGateway: jest.Mocked<NotificationGateway>;
  let preferencesService: jest.Mocked<NotificationPreferencesService>;
  let deliveryTracking: jest.Mocked<DeliveryTrackingService>;
  let emailService: jest.Mocked<EmailService>;
  let prismaService: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const mockGateway = {
      sendToUser: jest.fn().mockResolvedValue(true),
      isUserOnline: jest.fn().mockReturnValue(true),
      getConnectionStats: jest.fn().mockReturnValue({ totalConnections: 10, activeUsers: 5 }),
    };

    const mockUserStatusService = {
      getUserStatus: jest.fn().mockResolvedValue({ isOnline: true, isActive: true }),
      isUserActive: jest.fn().mockReturnValue(true),
      updateUserStatus: jest.fn(),
    };

    const mockPreferencesService = {
      getUserPreferences: jest.fn().mockResolvedValue({ email: true, inApp: true }),
      shouldSendNotification: jest.fn().mockResolvedValue({ allowed: true, channels: ['websocket', 'email'] }),
      selectNotificationChannels: jest.fn().mockResolvedValue(['websocket', 'email']),
      recordNotificationSent: jest.fn().mockResolvedValue(undefined),
    };

    const mockDeliveryTracking = {
      createDelivery: jest.fn().mockResolvedValue('delivery-123'),
      recordAttempt: jest.fn().mockResolvedValue(undefined),
      scheduleRetry: jest.fn().mockResolvedValue(undefined),
      getDelivery: jest.fn().mockResolvedValue({ id: 'delivery-123', attempts: [] }),
    };

    const mockEmailService = {
      sendEmail: jest.fn().mockResolvedValue(true),
      sendPasswordReset: jest.fn().mockResolvedValue(true),
      getProviderStatus: jest.fn().mockReturnValue({ configured: true, healthy: true }),
    };

    const mockTemplateService = {
      render: jest.fn().mockReturnValue('<html>Email</html>'),
      getTemplate: jest.fn().mockReturnValue({ subject: 'Test', body: 'Test body' }),
    };

    const mockChannelHealth = {
      isChannelAvailable: jest.fn().mockResolvedValue(true),
      getRecommendedChannels: jest.fn().mockResolvedValue(['email', 'websocket']),
      getChannelHealth: jest.fn().mockResolvedValue({ overall: 'healthy' }),
    };

    const mockPrisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'user-123',
          email: 'test@example.com',
          emailVerified: true,
          name: 'Test User',
        }),
      },
      filter: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'filter-123',
          name: 'Test Filter',
        }),
      },
      notification: {
        create: jest.fn().mockResolvedValue({ id: 'notification-123' }),
        update: jest.fn().mockResolvedValue({ id: 'notification-123' }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationProcessor,
        { provide: NotificationGateway, useValue: mockGateway },
        { provide: UserStatusService, useValue: mockUserStatusService },
        { provide: NotificationPreferencesService, useValue: mockPreferencesService },
        { provide: DeliveryTrackingService, useValue: mockDeliveryTracking },
        { provide: EmailService, useValue: mockEmailService },
        { provide: TemplateService, useValue: mockTemplateService },
        { provide: ChannelHealthService, useValue: mockChannelHealth },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    processor = module.get<NotificationProcessor>(NotificationProcessor);
    websocketGateway = module.get(NotificationGateway);
    preferencesService = module.get(NotificationPreferencesService);
    deliveryTracking = module.get(DeliveryTrackingService);
    emailService = module.get(EmailService);
    prismaService = module.get(PrismaService);

    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Processor Initialization', () => {
    it('should be defined', () => {
      expect(processor).toBeDefined();
    });

    it('should have all required dependencies injected', () => {
      expect(websocketGateway).toBeDefined();
      expect(preferencesService).toBeDefined();
      expect(deliveryTracking).toBeDefined();
      expect(emailService).toBeDefined();
      expect(prismaService).toBeDefined();
    });
  });

  describe('handleDealMatch()', () => {
    const mockJob = {
      id: 'job-123',
      data: {
        userId: 'user-123',
        filterId: 'filter-123',
        matchId: 'match-123',
        priority: 'normal',
        dealData: {
          id: 'article-123',
          title: 'Great Deal',
          price: 99.99,
          originalPrice: 149.99,
          discount: 33,
          merchant: 'Store',
          url: 'https://example.com/deal',
          imageUrl: 'https://example.com/image.jpg',
          score: 85,
        },
      },
      attemptsMade: 0,
      opts: {},
    };

    it('should check if notification should be sent', async () => {
      await processor.handleDealMatch(mockJob as any);

      expect(preferencesService.shouldSendNotification).toHaveBeenCalled();
    });

    it('should create delivery tracking when notification is allowed', async () => {
      preferencesService.shouldSendNotification.mockResolvedValue({
        allowed: true,
        channels: ['websocket'],
      });

      await processor.handleDealMatch(mockJob as any);

      expect(deliveryTracking.createDelivery).toHaveBeenCalled();
    });

    it('should not send when notification is not allowed', async () => {
      preferencesService.shouldSendNotification.mockResolvedValue({
        allowed: false,
        reason: 'quiet_hours',
        channels: [],
      });

      await processor.handleDealMatch(mockJob as any);

      // Should not send via any channel
      expect(websocketGateway.sendToUser).not.toHaveBeenCalled();
    });
  });

  describe('handlePasswordReset()', () => {
    const mockPasswordResetJob = {
      id: 'job-pw-reset-1',
      data: {
        userId: 'user-123',
        email: 'test@example.com',
        resetUrl: 'https://dealscrapper.com/auth/reset-password?token=abc123',
        timestamp: new Date(),
      },
      attemptsMade: 0,
      opts: {},
    };

    it('should create delivery tracking for password reset', async () => {
      // Arrange
      emailService.sendPasswordReset = jest.fn().mockResolvedValue(true);

      // Act
      await processor.handlePasswordReset(mockPasswordResetJob as any);

      // Assert
      expect(deliveryTracking.createDelivery).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
          type: 'password-reset',
          priority: 'high',
        })
      );
    });

    it('should call sendPasswordReset with correct arguments', async () => {
      // Arrange
      emailService.sendPasswordReset = jest.fn().mockResolvedValue(true);

      // Act
      await processor.handlePasswordReset(mockPasswordResetJob as any);

      // Assert
      expect(emailService.sendPasswordReset).toHaveBeenCalledWith(
        'test@example.com',
        'https://dealscrapper.com/auth/reset-password?token=abc123',
        'user-123',
        undefined
      );
    });

    it('should record delivery attempt on success', async () => {
      // Arrange
      emailService.sendPasswordReset = jest.fn().mockResolvedValue(true);

      // Act
      await processor.handlePasswordReset(mockPasswordResetJob as any);

      // Assert
      expect(deliveryTracking.recordAttempt).toHaveBeenCalledWith(
        'delivery-123',
        'email',
        'delivered',
        undefined
      );
    });

    it('should schedule retry when all attempts fail', async () => {
      // Arrange — mock sendPasswordReset to always return false (all 3 attempts fail)
      emailService.sendPasswordReset = jest.fn().mockResolvedValue(false);
      // Patch setTimeout so exponential backoff resolves immediately
      jest.spyOn(global, 'setTimeout').mockImplementation((fn: TimerHandler) => {
        if (typeof fn === 'function') fn();
        return 0 as unknown as ReturnType<typeof setTimeout>;
      });

      // Act & Assert
      await expect(processor.handlePasswordReset(mockPasswordResetJob as any)).rejects.toThrow(
        'Password reset email delivery failed after 3 attempts'
      );
      expect(deliveryTracking.scheduleRetry).toHaveBeenCalledWith('delivery-123', 60);

      jest.restoreAllMocks();
    }, 15000);
  });

  describe('handleSystemNotification()', () => {
    const mockSystemJob = {
      id: 'job-456',
      data: {
        userId: 'user-123',
        subject: 'System Alert',
        message: 'Important system message',
        priority: 'high',
        type: 'info',
      },
      attemptsMade: 0,
      opts: {},
    };

    it('should process system notification and create delivery', async () => {
      await processor.handleSystemNotification(mockSystemJob as any);

      // System notifications skip preference check and create delivery directly
      expect(deliveryTracking.createDelivery).toHaveBeenCalled();
    });

    it('should send via websocket when user is online', async () => {
      await processor.handleSystemNotification(mockSystemJob as any);

      expect(websocketGateway.sendToUser).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle user not found gracefully', async () => {
      prismaService.user.findUnique.mockResolvedValue(null);

      const mockJob = {
        id: 'job-789',
        data: {
          userId: 'nonexistent',
          filterId: 'filter-123',
          matchId: 'match-456',
          priority: 'normal',
          dealData: { id: 'article-123', title: 'Deal', price: 50, merchant: 'Store', score: 70 },
        },
        attemptsMade: 0,
        opts: {},
      };

      // Should not throw, just log warning
      await expect(processor.handleDealMatch(mockJob as any)).resolves.not.toThrow();
    });

    it('should handle websocket send failure gracefully', async () => {
      websocketGateway.sendToUser.mockResolvedValue(false);
      preferencesService.shouldSendNotification.mockResolvedValue({
        allowed: true,
        channels: ['websocket'],
      });

      const mockJob = {
        id: 'job-101',
        data: {
          userId: 'user-123',
          filterId: 'filter-123',
          matchId: 'match-789',
          priority: 'normal',
          dealData: { id: 'article-123', title: 'Deal', price: 50, merchant: 'Store', score: 70 },
        },
        attemptsMade: 0,
        opts: {},
      };

      await expect(processor.handleDealMatch(mockJob as any)).resolves.not.toThrow();
    });
  });
});
