import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { NotificationPreferencesService } from '../../../src/services/notification-preferences.service.js';
import { PrismaService } from '@dealscrapper/database';

describe('NotificationPreferencesService', () => {
  let service: NotificationPreferencesService;
  let prismaService: jest.Mocked<PrismaService>;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    emailVerified: true,
    name: 'Test User',
    password: 'hashed',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockPrisma = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationPreferencesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<NotificationPreferencesService>(NotificationPreferencesService);
    prismaService = module.get(PrismaService);

    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserPreferences()', () => {
    it('should return user preferences when user exists', async () => {
      prismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.getUserPreferences('user-123');

      expect(result).toBeDefined();
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-123' },
      });
    });

    it('should return null when user not found', async () => {
      prismaService.user.findUnique.mockResolvedValue(null);

      const result = await service.getUserPreferences('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('updateUserPreferences()', () => {
    it('should update user preferences without errors', async () => {
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      prismaService.user.update.mockResolvedValue(mockUser);

      const updates = { email: false };

      // Method returns void, so just verify it doesn't throw
      await expect(service.updateUserPreferences('user-123', updates)).resolves.not.toThrow();
      expect(prismaService.user.update).toHaveBeenCalled();
    });

    it('should return undefined when user not found', async () => {
      prismaService.user.findUnique.mockResolvedValue(null);

      const result = await service.updateUserPreferences('nonexistent', { email: false });

      // Method returns void
      expect(result).toBeUndefined();
    });
  });

  describe('shouldSendNotification()', () => {
    it('should allow notification when all conditions are met', async () => {
      prismaService.user.findUnique.mockResolvedValue(mockUser);

      const context = {
        userId: 'user-123',
        notificationType: 'deal-match' as const,
        priority: 'normal' as const,
        score: 80,
        dealData: { title: 'Test Deal', price: 100, merchant: 'Store', category: 'Electronics' },
        userActivity: { isOnline: true, isActive: true, lastActivity: new Date(), deviceType: 'web' as const },
      };

      const result = await service.shouldSendNotification(context);

      expect(result).toBeDefined();
      expect(result.allowed).toBeDefined();
      expect(result.channels).toBeDefined();
    });

    it('should return not allowed for non-existent user', async () => {
      prismaService.user.findUnique.mockResolvedValue(null);

      const context = {
        userId: 'nonexistent',
        notificationType: 'deal-match' as const,
        priority: 'normal' as const,
        userActivity: { isOnline: true, isActive: true, lastActivity: new Date(), deviceType: 'web' as const },
      };

      const result = await service.shouldSendNotification(context);

      expect(result.allowed).toBe(false);
    });

    it('should include channels when user is online', async () => {
      prismaService.user.findUnique.mockResolvedValue(mockUser);

      const context = {
        userId: 'user-123',
        notificationType: 'deal-match' as const,
        priority: 'normal' as const,
        userActivity: { isOnline: true, isActive: true, lastActivity: new Date(), deviceType: 'web' as const },
      };

      const result = await service.shouldSendNotification(context);

      expect(result.allowed).toBe(true);
      expect(result.channels).toBeDefined();
      expect(Array.isArray(result.channels)).toBe(true);
    });

    it('should include email channel when user is offline and email is verified', async () => {
      prismaService.user.findUnique.mockResolvedValue(mockUser);

      const context = {
        userId: 'user-123',
        notificationType: 'deal-match' as const,
        priority: 'normal' as const,
        userActivity: { isOnline: false, isActive: false, lastActivity: new Date(), deviceType: 'web' as const },
      };

      const result = await service.shouldSendNotification(context);

      expect(result.allowed).toBe(true);
      // Email should be included since user has verified email
      expect(result.channels).toContain('email');
    });
  });

  describe('recordNotificationSent()', () => {
    it('should record notification sent for user', async () => {
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      prismaService.user.update.mockResolvedValue(mockUser);

      // Method takes 3 params: userId, notificationType, channel
      await expect(
        service.recordNotificationSent('user-123', 'deal-match', 'email')
      ).resolves.not.toThrow();
    });
  });
});
