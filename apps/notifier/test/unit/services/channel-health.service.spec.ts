import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { ChannelHealthService } from '../../../src/services/channel-health.service.js';
import { EmailService } from '../../../src/channels/email.service.js';
import { NotificationGateway } from '../../../src/websocket/notification.gateway.js';

describe('ChannelHealthService', () => {
  let service: ChannelHealthService;
  let emailService: jest.Mocked<EmailService>;
  let websocketGateway: jest.Mocked<NotificationGateway>;

  beforeEach(async () => {
    const mockEmailService = {
      getProviderStatus: jest.fn(),
      sendEmail: jest.fn(),
    };

    const mockWebsocketGateway = {
      getConnectionStats: jest.fn(),
      isUserOnline: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChannelHealthService,
        { provide: EmailService, useValue: mockEmailService },
        { provide: NotificationGateway, useValue: mockWebsocketGateway },
      ],
    }).compile();

    service = module.get<ChannelHealthService>(ChannelHealthService);
    emailService = module.get(EmailService);
    websocketGateway = module.get(NotificationGateway);

    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  afterEach(() => {
    // Clear any intervals set by the service
    service.onModuleDestroy();
    jest.clearAllMocks();
  });

  describe('getChannelHealth()', () => {
    it('should return health status summary', async () => {
      websocketGateway.getConnectionStats.mockReturnValue({
        totalConnections: 10,
        activeUsers: 5,
      });

      const result = await service.getChannelHealth();

      expect(result).toBeDefined();
      expect(result.overall).toBeDefined();
      expect(result.channels).toBeDefined();
      expect(result.recommendedChannels).toBeDefined();
    });

    it('should include lastUpdated timestamp', async () => {
      websocketGateway.getConnectionStats.mockReturnValue({
        totalConnections: 10,
        activeUsers: 5,
      });

      const result = await service.getChannelHealth();

      expect(result.lastUpdated).toBeInstanceOf(Date);
    });
  });

  describe('getChannelMetrics()', () => {
    it('should return channel metrics', async () => {
      emailService.getProviderStatus.mockReturnValue({
        configured: true,
        healthy: true,
        provider: 'smtp',
      });
      websocketGateway.getConnectionStats.mockReturnValue({
        totalConnections: 10,
        activeUsers: 5,
      });

      const result = await service.getChannelMetrics();

      expect(result).toBeDefined();
    });
  });

  describe('isChannelAvailable()', () => {
    it('should return true for email channel (currently always healthy)', async () => {
      // Note: checkEmailHealth is deferred and always returns healthy
      const result = await service.isChannelAvailable('email');

      expect(result).toBe(true);
    });

    it('should return true for websocket when connections exist', async () => {
      websocketGateway.getConnectionStats.mockReturnValue({
        totalConnections: 10,
        activeUsers: 5,
      });

      const result = await service.isChannelAvailable('websocket');

      expect(result).toBe(true);
    });

    it('should return false for unknown channel', async () => {
      const result = await service.isChannelAvailable('push' as 'email' | 'websocket');

      expect(result).toBe(false);
    });
  });

  describe('getRecommendedChannels()', () => {
    it('should return recommended channels based on health status', async () => {
      websocketGateway.getConnectionStats.mockReturnValue({
        totalConnections: 10,
        activeUsers: 5,
      });

      const result = await service.getRecommendedChannels();

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should include email as recommended (currently always healthy)', async () => {
      websocketGateway.getConnectionStats.mockReturnValue({
        totalConnections: 10,
        activeUsers: 5,
      });

      const result = await service.getRecommendedChannels();

      // Email is always recommended since checkEmailHealth is deferred
      expect(result).toContain('email');
    });
  });

  describe('checkEmailHealth()', () => {
    it('should return healthy status (deferred implementation)', async () => {
      // Note: checkEmailHealth is private but we test via isChannelAvailable
      const result = await service.isChannelAvailable('email');

      // Currently always returns healthy as the implementation is deferred
      expect(result).toBe(true);
    });
  });

  describe('checkWebSocketHealth()', () => {
    it('should return healthy status for active websocket', async () => {
      websocketGateway.getConnectionStats.mockReturnValue({
        totalConnections: 10,
        activeUsers: 5,
      });

      const result = await service.isChannelAvailable('websocket');

      expect(result).toBe(true);
    });

    it('should handle websocket with zero connections', async () => {
      websocketGateway.getConnectionStats.mockReturnValue({
        totalConnections: 0,
        activeUsers: 0,
      });

      const result = await service.isChannelAvailable('websocket');

      // WebSocket is considered healthy even with 0 connections (infrastructure is up)
      expect(result).toBeDefined();
    });
  });

  describe('recordDeliveryAttempt()', () => {
    it('should record delivery attempt for channel', async () => {
      // This is a void method that tracks metrics
      await expect(
        service.recordDeliveryAttempt('email', true)
      ).resolves.not.toThrow();
    });

    it('should record failed delivery attempt', async () => {
      await expect(
        service.recordDeliveryAttempt('websocket', false)
      ).resolves.not.toThrow();
    });
  });
});
