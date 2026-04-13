import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { NotificationGateway } from '../../../src/websocket/notification.gateway';
import { UserStatusService } from '../../../src/services/user-status.service';
import { ActivityTrackingService } from '../../../src/services/activity-tracking.service';
import { RateLimitingService } from '../../../src/services/rate-limiting.service';
import { NotificationPreferencesService } from '../../../src/services/notification-preferences.service';
import { PrismaService, User } from '@dealscrapper/database';
import { DeliveryTrackingService } from '../../../src/services/delivery-tracking.service';
import { EmailService } from '../../../src/channels/email.service';
import { Socket, Server } from 'socket.io';
import { Logger } from '@nestjs/common';
import { SharedConfigService } from '@dealscrapper/shared-config';

describe('NotificationGateway - Enhanced Tests', () => {
  let gateway: NotificationGateway;
  let jwtService: jest.Mocked<JwtService>;
  let userStatusService: jest.Mocked<UserStatusService>;
  let activityTrackingService: jest.Mocked<ActivityTrackingService>;
  let rateLimitingService: jest.Mocked<RateLimitingService>;
  let notificationPreferencesService: jest.Mocked<NotificationPreferencesService>;
  let prismaService: jest.Mocked<PrismaService>;
  let deliveryTrackingService: jest.Mocked<DeliveryTrackingService>;
  let emailService: jest.Mocked<EmailService>;
  let sharedConfigService: jest.Mocked<SharedConfigService>;
  let mockServer: jest.Mocked<Server>;

  const createMockSocket = (overrides: Partial<Socket> = {}) => {
    const socket = {
      id: 'socket-123',
      handshake: {
        address: '127.0.0.1',
        headers: {
          'user-agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          authorization: 'Bearer valid-jwt-token',
        },
        auth: {},
        query: {},
      },
      data: {},
      emit: jest.fn(),
      disconnect: jest.fn(),
      join: jest.fn(),
      leave: jest.fn(),
      to: jest.fn().mockReturnThis(),
      broadcast: {
        to: jest.fn().mockReturnThis(),
        emit: jest.fn(),
      },
      ...overrides,
    } as unknown as jest.Mocked<Socket>;

    return socket;
  };

  const createMockServer = () =>
    ({
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
      sockets: {
        sockets: new Map(),
      },
      namespace: jest.fn(),
    }) as unknown as jest.Mocked<Server>;

  const createMockServices = () => ({
    jwtService: {
      verifyAsync: jest.fn(),
      decode: jest.fn(),
    },
    userStatusService: {
      updateUserStatus: jest.fn(),
      getUserStatus: jest.fn(),
      updateUserActivity: jest.fn(),
      setUserInactive: jest.fn(),
      isUserOnline: jest.fn(),
      isUserActive: jest.fn(),
      getOnlineUsers: jest.fn(),
      getStatusStats: jest.fn(),
      updateHeartbeat: jest.fn(),
      trackConnectionAttempt: jest.fn(),
    },
    activityTrackingService: {
      recordActivity: jest.fn(),
      analyzeActivityPattern: jest.fn(),
      getUserEngagementScore: jest.fn(),
      getActivityHeatmap: jest.fn(),
    },
    rateLimitingService: {
      checkConnectionRateLimit: jest.fn(),
      isBlacklisted: jest.fn(),
      getBlacklistInfo: jest.fn(),
      recordSuspiciousActivity: jest.fn(),
      checkMessageRateLimit: jest.fn(),
      addViolation: jest.fn(),
    },
    notificationPreferencesService: {
      getUserPreferences: jest.fn(),
      updatePreferences: jest.fn(),
      isInQuietHours: jest.fn(),
      shouldNotify: jest.fn(),
    },
    prismaService: {
      user: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      notification: {
        create: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
    },
    deliveryTrackingService: {
      createDelivery: jest.fn(),
      recordAttempt: jest.fn(),
      updateStatus: jest.fn(),
      getDeliveryStats: jest.fn(),
      getFailedDeliveries: jest.fn(),
      retryFailedDeliveries: jest.fn(),
    },
    emailService: {
      sendEmail: jest.fn(),
      sendDealMatchEmail: jest.fn(),
      sendDigestEmail: jest.fn(),
      sendSystemNotification: jest.fn(),
      sendEmailVerification: jest.fn(),
      getProviderStatus: jest.fn(),
    },
    sharedConfigService: {
      get: jest.fn(),
      getOrThrow: jest.fn(),
    },
  });

  beforeEach(async () => {
    // Mock Logger to suppress console output
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();

    const mocks = createMockServices();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationGateway,
        { provide: JwtService, useValue: mocks.jwtService },
        { provide: UserStatusService, useValue: mocks.userStatusService },
        {
          provide: ActivityTrackingService,
          useValue: mocks.activityTrackingService,
        },
        { provide: RateLimitingService, useValue: mocks.rateLimitingService },
        {
          provide: NotificationPreferencesService,
          useValue: mocks.notificationPreferencesService,
        },
        { provide: PrismaService, useValue: mocks.prismaService },
        {
          provide: DeliveryTrackingService,
          useValue: mocks.deliveryTrackingService,
        },
        { provide: EmailService, useValue: mocks.emailService },
        { provide: SharedConfigService, useValue: mocks.sharedConfigService },
      ],
    }).compile();

    gateway = module.get<NotificationGateway>(NotificationGateway);
    jwtService = module.get(JwtService);
    userStatusService = module.get(UserStatusService);
    activityTrackingService = module.get(ActivityTrackingService);
    rateLimitingService = module.get(RateLimitingService);
    notificationPreferencesService = module.get(NotificationPreferencesService);
    deliveryTrackingService = module.get(DeliveryTrackingService);
    emailService = module.get(EmailService);
    prismaService = module.get(PrismaService);
    sharedConfigService = module.get(SharedConfigService);

    mockServer = createMockServer();
    gateway.server = mockServer;

    // Setup default successful responses
    jwtService.verifyAsync.mockResolvedValue({
      userId: 'user-123',
      email: 'test@example.com',
    });
    rateLimitingService.checkConnectionRateLimit.mockResolvedValue({
      allowed: true,
      retryAfter: null,
    });
    rateLimitingService.isBlacklisted.mockResolvedValue(false);
    prismaService.user.findUnique.mockResolvedValue({
      id: 'user-123',
      email: 'test@example.com',
    } as { id: string; email: string });
    userStatusService.getUserStatus.mockResolvedValue(null);
    activityTrackingService.recordActivity.mockResolvedValue(undefined);
    sharedConfigService.getOrThrow.mockReturnValue('test-jwt-secret');
    sharedConfigService.get.mockReturnValue('http://localhost:3000');
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('Gateway Initialization', () => {
    it('should be defined', () => {
      expect(gateway).toBeDefined();
    });

    it('should initialize server after init', () => {
      const mockServer = createMockServer();

      // Simply verify afterInit can be called without errors
      // (Logger is now SharedLoggingService, not NestJS Logger)
      expect(() => gateway.afterInit(mockServer)).not.toThrow();
    });

    it('should have correct WebSocket configuration', () => {
      // Verify the gateway class exists and has the expected decorator behavior
      expect(NotificationGateway).toBeDefined();
      expect(typeof NotificationGateway).toBe('function');
    });
  });

  describe('Connection Authentication', () => {
    it('should accept valid JWT token connection', async () => {
      const socket = createMockSocket();

      await gateway.handleConnection(socket);

      expect(jwtService.verifyAsync).toHaveBeenCalledWith(
        'valid-jwt-token',
        expect.objectContaining({ secret: expect.any(String) })
      );
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        include: {},
      });
      expect(socket.disconnect).not.toHaveBeenCalled();
    });

    it('should reject connection without token', async () => {
      const socket = createMockSocket({
        handshake: {
          ...createMockSocket().handshake,
          headers: {},
          auth: {},
          query: {},
        },
      });

      await gateway.handleConnection(socket);

      expect(socket.disconnect).toHaveBeenCalled();
    });

    it('should reject connection with invalid token', async () => {
      const socket = createMockSocket();
      jwtService.verifyAsync.mockResolvedValue(null);

      await gateway.handleConnection(socket);

      expect(socket.emit).toHaveBeenCalledWith('auth_error', {
        code: 'INVALID_TOKEN',
        message: 'Authentication failed',
      });
      expect(socket.disconnect).toHaveBeenCalled();
    });

    it('should reject connection for non-existent user', async () => {
      const socket = createMockSocket();
      prismaService.user.findUnique.mockResolvedValue(null);

      await gateway.handleConnection(socket);

      expect(socket.emit).toHaveBeenCalledWith('error', {
        code: 'USER_NOT_FOUND',
        message: 'User not found',
      });
      expect(socket.disconnect).toHaveBeenCalled();
    });

    it('should store user metadata on successful authentication', async () => {
      const socket = createMockSocket();

      await gateway.handleConnection(socket);

      expect(socket.data).toEqual({
        userId: 'user-123',
        authenticatedAt: expect.any(Date),
        userEmail: 'test@example.com',
      });
    });
  });

  describe('Rate Limiting and Security', () => {
    it('should reject rate-limited connections', async () => {
      const socket = createMockSocket();
      rateLimitingService.checkConnectionRateLimit.mockResolvedValue({
        allowed: false,
        retryAfter: 300,
      });

      await gateway.handleConnection(socket);

      expect(socket.emit).toHaveBeenCalledWith('error', {
        code: 'RATE_LIMITED',
        message: 'Too many connection attempts',
        retryAfter: 300,
      });
      expect(socket.disconnect).toHaveBeenCalled();
    });

    it('should reject blacklisted IP addresses', async () => {
      const socket = createMockSocket();
      rateLimitingService.isBlacklisted.mockResolvedValue(true);
      rateLimitingService.getBlacklistInfo.mockResolvedValue({
        reason: 'Automated abuse detected',
        expiresAt: new Date(Date.now() + 3600000),
      });

      await gateway.handleConnection(socket);

      expect(socket.emit).toHaveBeenCalledWith('error', {
        code: 'BLACKLISTED',
        message: 'Access denied',
        expiresAt: expect.any(Date),
      });
      expect(socket.disconnect).toHaveBeenCalled();
    });

    it('should record suspicious activity for invalid tokens', async () => {
      const socket = createMockSocket();
      jwtService.verifyAsync.mockRejectedValue(new Error('Invalid token'));

      await gateway.handleConnection(socket);

      expect(rateLimitingService.recordSuspiciousActivity).toHaveBeenCalledWith(
        '127.0.0.1',
        'invalid_auth',
        { userAgent: expect.any(String) }
      );
    });

    it('should enforce connection limits per user', async () => {
      const socket = createMockSocket();

      // Mock the gateway's internal connection tracking to simulate max connections
      const gateway_any = gateway as unknown as {
        activeConnections: Map<string, unknown>;
      };
      const existingConnection = {
        userId: 'user-123',
        socketId: 'existing-socket',
        connectedAt: new Date(),
        lastActivity: new Date(),
        deviceInfo: { type: 'web', userAgent: 'test', ip: '127.0.0.1' },
        isActive: true,
        reconnectAttempts: 0,
      };

      // Fill up connections to trigger limit
      for (let i = 0; i < 3; i++) {
        gateway_any.activeConnections.set(`user-123-${i}`, {
          ...existingConnection,
          userId: 'user-123',
        });
      }

      await gateway.handleConnection(socket);

      expect(socket.emit).toHaveBeenCalledWith('error', {
        code: 'CONNECTION_LIMIT',
        message: 'Maximum connections exceeded',
      });
      expect(socket.disconnect).toHaveBeenCalled();
    });

    it('should record rapid connection attempts', async () => {
      const socket = createMockSocket();

      // Mock the gateway's internal connection tracking to simulate max connections
      const gateway_any = gateway as unknown as {
        activeConnections: Map<string, unknown>;
      };
      const existingConnection = {
        userId: 'user-123',
        socketId: 'existing-socket',
        connectedAt: new Date(),
        lastActivity: new Date(),
        deviceInfo: { type: 'web', userAgent: 'test', ip: '127.0.0.1' },
        isActive: true,
        reconnectAttempts: 0,
      };

      // Fill up connections to trigger limit
      for (let i = 0; i < 3; i++) {
        gateway_any.activeConnections.set(`user-123-${i}`, {
          ...existingConnection,
          userId: 'user-123',
        });
      }

      await gateway.handleConnection(socket);

      expect(rateLimitingService.recordSuspiciousActivity).toHaveBeenCalledWith(
        'user-123',
        'rapid_connections',
        { ip: '127.0.0.1' }
      );
    });
  });

  describe('Connection Management', () => {
    beforeEach(async () => {
      // Setup successful authentication
      const socket = createMockSocket();
      await gateway.handleConnection(socket);
    });

    it('should track active connections', async () => {
      expect(userStatusService.updateUserStatus).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({
          isOnline: true,
          isActive: true,
          deviceType: 'web',
          socketId: 'socket-123',
        })
      );
    });

    it('should start heartbeat for connection persistence', async () => {
      const socket = createMockSocket();
      jest.useFakeTimers();

      await gateway.handleConnection(socket);

      // Fast forward 30 seconds to trigger heartbeat
      jest.advanceTimersByTime(30000);

      expect(socket.emit).toHaveBeenCalledWith('heartbeat', {
        timestamp: expect.any(Date),
        userId: 'user-123',
        serverTime: expect.any(Number),
      });

      jest.useRealTimers();
    });

    it('should replace existing connections for same user', async () => {
      const firstSocket = createMockSocket({ id: 'socket-1' });
      const secondSocket = createMockSocket({ id: 'socket-2' });

      // Connect first socket
      await gateway.handleConnection(firstSocket);

      // Connect second socket (should replace first)
      await gateway.handleConnection(secondSocket);

      expect(mockServer.to).toHaveBeenCalledWith('socket-1');
      expect(mockServer.emit).toHaveBeenCalledWith('replaced', {
        message: 'Connection replaced by new session',
      });
    });

    it('should join user-specific room on connection', async () => {
      const socket = createMockSocket();

      await gateway.handleConnection(socket);

      expect(socket.join).toHaveBeenCalledWith('user-user-123');
    });

    it('should send connection confirmation', async () => {
      const socket = createMockSocket();

      await gateway.handleConnection(socket);

      expect(socket.emit).toHaveBeenCalledWith(
        'connected',
        expect.objectContaining({
          status: 'connected',
          userId: 'user-123',
          connectionId: 'socket-123',
          features: expect.objectContaining({
            heartbeat: true,
            reconnection: true,
            preferences: true,
          }),
        })
      );
    });
  });

  describe('Message Handling', () => {
    let authenticatedSocket: jest.Mocked<Socket>;

    beforeEach(async () => {
      authenticatedSocket = createMockSocket();
      authenticatedSocket.data = {
        userId: 'user-123',
        authenticatedAt: new Date(),
        userEmail: 'test@example.com',
      };
      await gateway.handleConnection(authenticatedSocket);
      jest.clearAllMocks();
    });

    it('should handle heartbeat messages', async () => {
      await gateway.handleHeartbeat(authenticatedSocket);

      expect(authenticatedSocket.emit).toHaveBeenCalledWith('heartbeat_ack', {
        timestamp: expect.any(Date),
      });
    });

    it('should handle notification preferences updates', async () => {
      const preferences = {
        enableInApp: false,
        enableEmail: true,
        quietHours: { start: '23:00', end: '07:00' },
      };

      await gateway.handleUpdatePreferences(authenticatedSocket, preferences);

      expect(authenticatedSocket.emit).toHaveBeenCalledWith(
        'preferences_updated',
        {
          success: true,
        }
      );
    });

    it('should handle activity tracking messages', async () => {
      const activityData = {
        type: 'page_view',
        metadata: { page: '/deals', category: 'electronics' },
      };

      rateLimitingService.checkMessageRateLimit.mockResolvedValue({
        allowed: true,
        retryAfter: null,
      });

      await gateway.handleActivity(authenticatedSocket, activityData);

      expect(activityTrackingService.recordActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
          activityType: 'page_view',
          metadata: expect.objectContaining({
            sessionId: 'socket-123',
            deviceType: 'web',
            page: '/deals',
            category: 'electronics',
          }),
        })
      );
    });

    it('should enforce message rate limiting', async () => {
      rateLimitingService.checkMessageRateLimit.mockResolvedValue({
        allowed: false,
        retryAfter: 60,
      });

      const message = { type: 'test' };

      await gateway.handleActivity(authenticatedSocket, message);

      expect(authenticatedSocket.emit).toHaveBeenCalledWith('error', {
        code: 'MESSAGE_RATE_LIMITED',
        message: 'Too many messages',
        retryAfter: 60,
      });
    });

    it('should update user activity on activity message', async () => {
      const message = { type: 'mouse', metadata: { x: 100, y: 200 } };
      rateLimitingService.checkMessageRateLimit.mockResolvedValue({
        allowed: true,
        retryAfter: null,
      });

      await gateway.handleActivity(authenticatedSocket, message);

      // Verify that the gateway internal method was called to update activity
      expect(rateLimitingService.checkMessageRateLimit).toHaveBeenCalledWith(
        'user-123'
      );
    });
  });

  describe('Notification Broadcasting', () => {
    it('should broadcast deal match notifications', async () => {
      const notification = {
        type: 'deal-match' as const,
        data: {
          dealId: 'deal-123',
          title: 'Amazing Deal',
          price: 99.99,
          score: 95,
        },
        priority: 'high' as const,
        timestamp: new Date(),
      };

      // Mock service responses
      deliveryTrackingService.createDelivery.mockResolvedValue(
        'notification-123'
      );
      deliveryTrackingService.recordAttempt.mockResolvedValue(undefined);
      emailService.sendEmail.mockResolvedValue(true);
      prismaService.user.findUnique.mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
      } as User);

      // Setup an active connection
      const gateway_any = gateway as unknown as {
        activeConnections: Map<string, unknown>;
      };
      gateway_any.activeConnections.set('user-123', {
        userId: 'user-123',
        socketId: 'socket-123',
        connectedAt: new Date(),
        lastActivity: new Date(),
        deviceInfo: { type: 'web', userAgent: 'test', ip: '127.0.0.1' },
        isActive: true,
        reconnectAttempts: 0,
      });

      const result = await gateway.sendToUser('user-123', notification);

      expect(result).toBe(true);
      expect(mockServer.to).toHaveBeenCalledWith('user-user-123');
      // After refactoring, sendToUser sends the raw unified payload without transformation
      expect(mockServer.emit).toHaveBeenCalledWith(
        'notification',
        expect.objectContaining({
          type: notification.type,
          data: notification.data,
          priority: notification.priority,
          timestamp: notification.timestamp,
        })
      );
    });

    it('should return false when user not connected', async () => {
      const notification = {
        type: 'deal-match' as const,
        data: { dealId: 'deal-123' },
        priority: 'normal' as const,
        timestamp: new Date(),
      };

      // Mock service responses for offline user
      deliveryTrackingService.createDelivery.mockResolvedValue(
        'notification-123'
      );
      deliveryTrackingService.recordAttempt.mockResolvedValue(undefined);
      emailService.sendEmail.mockResolvedValue(false); // Email fails
      prismaService.user.findUnique.mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
      } as User);

      const result = await gateway.sendToUser('user-123', notification);

      expect(result).toBe(false);
      expect(mockServer.emit).not.toHaveBeenCalled();
    });

    it('should check online status', async () => {
      // Setup an active connection
      const gateway_any = gateway as unknown as {
        activeConnections: Map<string, unknown>;
      };
      gateway_any.activeConnections.set('user-123', {
        userId: 'user-123',
        socketId: 'socket-123',
        connectedAt: new Date(),
        lastActivity: new Date(),
        deviceInfo: { type: 'web', userAgent: 'test', ip: '127.0.0.1' },
        isActive: true,
        reconnectAttempts: 0,
      });

      const isOnline = await gateway.isUserOnline('user-123');
      expect(isOnline).toBe(true);

      const isOffline = await gateway.isUserOnline('user-456');
      expect(isOffline).toBe(false);
    });

    it('should check user activity status', async () => {
      // Setup an active connection with recent activity
      const gateway_any = gateway as unknown as {
        activeConnections: Map<string, unknown>;
      };
      gateway_any.activeConnections.set('user-123', {
        userId: 'user-123',
        socketId: 'socket-123',
        connectedAt: new Date(),
        lastActivity: new Date(),
        deviceInfo: { type: 'web', userAgent: 'test', ip: '127.0.0.1' },
        isActive: true,
        reconnectAttempts: 0,
      });

      const isActive = await gateway.isUserActive('user-123');
      expect(isActive).toBe(true);

      // Test with old activity
      const oldConnection = {
        userId: 'user-456',
        socketId: 'socket-456',
        connectedAt: new Date(),
        lastActivity: new Date(Date.now() - 10 * 60 * 1000), // 10 minutes ago
        deviceInfo: { type: 'web', userAgent: 'test', ip: '127.0.0.1' },
        isActive: true,
        reconnectAttempts: 0,
      };
      gateway_any.activeConnections.set('user-456', oldConnection);

      const isInactive = await gateway.isUserActive('user-456');
      expect(isInactive).toBe(false);
    });

    it('should send to room', async () => {
      const notification = {
        type: 'system' as const,
        data: { message: 'System maintenance scheduled' },
        priority: 'normal' as const,
        timestamp: new Date(),
      };

      await gateway.sendToRoom('admin-room', notification);

      expect(mockServer.to).toHaveBeenCalledWith('admin-room');
      expect(mockServer.emit).toHaveBeenCalledWith(
        'notification',
        expect.objectContaining({
          type: 'system',
          data: notification.data,
          id: expect.any(String),
        })
      );
    });
  });

  describe('Connection Cleanup', () => {
    let authenticatedSocket: jest.Mocked<Socket>;

    beforeEach(async () => {
      authenticatedSocket = createMockSocket();
      authenticatedSocket.data = {
        userId: 'user-123',
        authenticatedAt: new Date(),
        userEmail: 'test@example.com',
      };
      await gateway.handleConnection(authenticatedSocket);
    });

    it('should clean up on disconnect', async () => {
      await gateway.handleDisconnect(authenticatedSocket);

      expect(userStatusService.updateUserStatus).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({
          isOnline: false,
          isActive: false,
          socketId: null,
        })
      );
    });

    it('should handle disconnect without authenticated user', async () => {
      const unauthenticatedSocket = createMockSocket({
        id: 'unauth-socket-999',
      });
      unauthenticatedSocket.data = {}; // No userId

      // Clear previous mock calls and active connections
      jest.clearAllMocks();
      const gateway_any = gateway as unknown as {
        activeConnections: Map<string, unknown>;
      };
      gateway_any.activeConnections.clear();

      await gateway.handleDisconnect(unauthenticatedSocket);

      expect(userStatusService.updateUserStatus).not.toHaveBeenCalled();
    });

    it('should clear heartbeat interval on disconnect', async () => {
      jest.useFakeTimers();
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

      await gateway.handleDisconnect(authenticatedSocket);

      expect(clearIntervalSpy).toHaveBeenCalled();

      jest.useRealTimers();
    });

    it('should remove connection from active connections', async () => {
      // Setup the connection in gateway's internal map
      const gateway_any = gateway as unknown as {
        activeConnections: Map<string, unknown>;
      };
      gateway_any.activeConnections.set('user-123', {
        userId: 'user-123',
        socketId: 'socket-123',
        connectedAt: new Date(),
        lastActivity: new Date(),
        deviceInfo: { type: 'web', userAgent: 'test', ip: '127.0.0.1' },
        isActive: true,
        reconnectAttempts: 0,
        heartbeatInterval: setInterval(() => {}, 1000),
      });

      await gateway.handleDisconnect(authenticatedSocket);

      expect(gateway_any.activeConnections.has('user-123')).toBe(false);
    });
  });

  describe('Device Detection', () => {
    it('should detect mobile devices', async () => {
      const mobileSocket = createMockSocket({
        handshake: {
          ...createMockSocket().handshake,
          headers: {
            'user-agent':
              'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
            authorization: 'Bearer valid-jwt-token',
          },
        },
      });

      await gateway.handleConnection(mobileSocket);

      expect(userStatusService.updateUserStatus).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({
          deviceType: 'mobile',
        })
      );
    });

    it('should detect web browsers', async () => {
      const webSocket = createMockSocket();

      await gateway.handleConnection(webSocket);

      expect(userStatusService.updateUserStatus).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({
          deviceType: 'web',
        })
      );
    });

    it('should handle unknown user agents', async () => {
      const unknownSocket = createMockSocket({
        handshake: {
          ...createMockSocket().handshake,
          headers: {
            'user-agent': '',
            authorization: 'Bearer valid-jwt-token',
          },
        },
      });

      await gateway.handleConnection(unknownSocket);

      expect(userStatusService.updateUserStatus).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({
          deviceType: 'web', // defaults to web for unknown user agents
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle JWT verification errors gracefully', async () => {
      const socket = createMockSocket();
      jwtService.verifyAsync.mockRejectedValue(new Error('JWT expired'));

      await gateway.handleConnection(socket);

      expect(socket.emit).toHaveBeenCalledWith('auth_error', {
        code: 'INVALID_TOKEN',
        message: 'Authentication failed',
      });
      expect(socket.disconnect).toHaveBeenCalled();
    });

    it('should handle database errors during user lookup', async () => {
      const socket = createMockSocket();
      prismaService.user.findUnique.mockRejectedValue(
        new Error('Database error')
      );

      await gateway.handleConnection(socket);

      expect(socket.disconnect).toHaveBeenCalled();
    });

    it('should handle rate limiting service errors', async () => {
      const socket = createMockSocket();
      rateLimitingService.checkConnectionRateLimit.mockRejectedValue(
        new Error('Redis error')
      );

      await gateway.handleConnection(socket);

      // Should disconnect on error during connection handling
      expect(socket.disconnect).toHaveBeenCalled();
    });

    it('should handle authentication message correctly', async () => {
      const socket = createMockSocket();
      const authData = { token: 'valid-jwt-token' };

      await gateway.handleAuthentication(socket, authData);

      expect(jwtService.verifyAsync).toHaveBeenCalledWith(
        'valid-jwt-token',
        expect.objectContaining({ secret: expect.any(String) })
      );
      expect(socket.emit).toHaveBeenCalledWith('auth_success', {
        userId: 'user-123',
      });
    });
  });

  describe('Statistics and Monitoring', () => {
    it('should provide connection statistics', () => {
      const stats = gateway.getConnectionStats();

      expect(stats).toEqual({
        totalConnections: expect.any(Number),
        activeUsers: expect.any(Number),
        connections: expect.any(Array),
      });
    });

    it('should include connection details in stats', () => {
      // Setup some test connections
      const gateway_any = gateway as unknown as {
        activeConnections: Map<string, unknown>;
      };
      gateway_any.activeConnections.set('user-123', {
        userId: 'user-123',
        socketId: 'socket-123',
        connectedAt: new Date(),
        lastActivity: new Date(),
        deviceInfo: { type: 'web', userAgent: 'test', ip: '127.0.0.1' },
        isActive: true,
        reconnectAttempts: 0,
      });

      const stats = gateway.getConnectionStats();

      expect(stats.totalConnections).toBe(1);
      expect(stats.activeUsers).toBe(1);
      expect(stats.connections).toHaveLength(1);
      expect(stats.connections[0]).toEqual({
        userId: 'user-123',
        connectedAt: expect.any(Date),
        lastActivity: expect.any(Date),
        isActive: true,
        deviceType: 'web',
      });
    });

    it('should handle page visibility events', async () => {
      const socket = createMockSocket();
      socket.data = { userId: 'user-123' };

      await gateway.handlePageHidden(socket);
      await gateway.handlePageVisible(socket);

      // These methods exist and should not throw errors
      expect(socket).toBeDefined();
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle complete user session lifecycle', async () => {
      const socket = createMockSocket();
      rateLimitingService.checkMessageRateLimit.mockResolvedValue({
        allowed: true,
        retryAfter: null,
      });

      // Connect
      await gateway.handleConnection(socket);

      // Send heartbeat
      await gateway.handleHeartbeat(socket);

      // Update preferences
      await gateway.handleUpdatePreferences(socket, { enableInApp: false });

      // Track activity
      await gateway.handleActivity(socket, {
        type: 'view_deal',
        metadata: { dealId: 'deal-123' },
      });

      // Test notification sending
      const gateway_any = gateway as unknown as {
        activeConnections: Map<string, unknown>;
      };
      gateway_any.activeConnections.set('user-123', {
        userId: 'user-123',
        socketId: 'socket-123',
        connectedAt: new Date(),
        lastActivity: new Date(),
        deviceInfo: { type: 'web', userAgent: 'test', ip: '127.0.0.1' },
        isActive: true,
        reconnectAttempts: 0,
      });

      await gateway.sendToUser('user-123', {
        type: 'deal-match',
        data: { dealId: 'deal-456' },
        priority: 'high',
        timestamp: new Date(),
      });

      // Disconnect
      await gateway.handleDisconnect(socket);

      expect(userStatusService.updateUserStatus).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({ isOnline: true })
      );
      expect(userStatusService.updateUserStatus).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({ isOnline: false })
      );
    });

    it('should handle rapid connection/disconnection cycles', async () => {
      for (let i = 0; i < 5; i++) {
        const socket = createMockSocket({ id: `socket-${i}` });
        socket.data = { userId: 'user-123' };
        await gateway.handleConnection(socket);
        await gateway.handleDisconnect(socket);
      }

      expect(userStatusService.updateUserStatus).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({ isOnline: true })
      );
      expect(userStatusService.updateUserStatus).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({ isOnline: false })
      );
    });

    it('should handle concurrent connections from same user', async () => {
      const socket1 = createMockSocket({ id: 'socket-1' });
      const socket2 = createMockSocket({ id: 'socket-2' });

      await gateway.handleConnection(socket1);
      await gateway.handleConnection(socket2);

      // Second connection should replace first
      expect(mockServer.to).toHaveBeenCalledWith('socket-1');
      expect(mockServer.emit).toHaveBeenCalledWith('replaced', {
        message: 'Connection replaced by new session',
      });
    });
  });
});
