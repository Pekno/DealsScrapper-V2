jest.mock('@dealscrapper/shared-logging', () => ({
  createServiceLogger: () => ({
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

jest.mock('../../../src/config/logging.config', () => ({
  apiLogConfig: {
    serviceName: 'api-test',
    defaultLevel: 'info',
  },
}));

import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { getQueueToken } from '@nestjs/bull';
import { of, throwError } from 'rxjs';
import { PrismaService } from '@dealscrapper/database';
import { SharedConfigService } from '@dealscrapper/shared-config';
import { AdminService } from '../../../src/admin/admin.service';
import { UserRepository } from '../../../src/repositories/user.repository';
import { PasswordResetService } from '../../../src/auth/services/password-reset.service';

describe('AdminService', () => {
  let service: AdminService;
  let prisma: jest.Mocked<PrismaService>;
  let userRepository: jest.Mocked<UserRepository>;
  let httpService: jest.Mocked<HttpService>;
  let sharedConfigService: jest.Mocked<SharedConfigService>;
  let passwordResetService: jest.Mocked<PasswordResetService>;

  const mockUser = {
    id: 'user-1',
    email: 'user1@test.com',
    password: 'hashedPassword123',
    firstName: 'John',
    lastName: 'Doe',
    role: 'USER',
    emailVerified: true,
    emailVerifiedAt: new Date('2025-01-15'),
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-06-01'),
    lastLoginAt: new Date('2025-06-01'),
    loginAttempts: 0,
    lockedUntil: null,
    timezone: 'UTC',
    locale: 'en',
    emailNotifications: true,
    marketingEmails: false,
    weeklyDigest: true,
  };

  const mockPrismaService = {
    user: { count: jest.fn() },
    filter: { count: jest.fn() },
    match: { count: jest.fn() },
    userSession: { count: jest.fn() },
  };

  const mockUserRepository = {
    findManyPaginated: jest.fn(),
    searchUsers: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  const mockHttpService = {
    get: jest.fn(),
  };

  const mockNotificationQueue = {
    add: jest.fn().mockResolvedValue(undefined),
  };

  const mockPasswordResetService = {
    generateResetToken: jest.fn().mockReturnValue({
      token: 'mock-reset-token',
      resetUrl: 'http://localhost:3000/auth/reset-password?token=mock-reset-token',
    }),
  };

  const mockSharedConfigService = {
    get: jest.fn().mockImplementation((key: string) => {
      if (key === 'NOTIFIER_URL') return 'http://notifier:3003';
      if (key === 'SCHEDULER_URL') return 'http://scheduler:3004';
      return 'http://localhost:3004';
    }),
    getServicePort: jest.fn().mockReturnValue(3001),
    getEmailConfig: jest.fn().mockReturnValue({
      service: 'mailhog',
      transport: {},
      from: { email: 'noreply@test.com', name: 'Test' },
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: UserRepository, useValue: mockUserRepository },
        { provide: HttpService, useValue: mockHttpService },
        { provide: SharedConfigService, useValue: mockSharedConfigService },
        { provide: PasswordResetService, useValue: mockPasswordResetService },
        { provide: getQueueToken('notifications'), useValue: mockNotificationQueue },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
    prisma = module.get(PrismaService);
    userRepository = module.get(UserRepository);
    httpService = module.get(HttpService);
    sharedConfigService = module.get(SharedConfigService);
    passwordResetService = module.get(PasswordResetService);

    jest.clearAllMocks();

    // Restore default mock implementations after clearAllMocks
    mockSharedConfigService.get.mockImplementation((key: string) => {
      if (key === 'NOTIFIER_URL') return 'http://notifier:3003';
      if (key === 'SCHEDULER_URL') return 'http://scheduler:3004';
      return 'http://localhost:3004';
    });
    mockSharedConfigService.getServicePort.mockReturnValue(3001);
    mockSharedConfigService.getEmailConfig.mockReturnValue({
      service: 'mailhog',
      transport: {},
      from: { email: 'noreply@test.com', name: 'Test' },
    });
    mockPasswordResetService.generateResetToken.mockReturnValue({
      token: 'mock-reset-token',
      resetUrl: 'http://localhost:3000/auth/reset-password?token=mock-reset-token',
    });
  });

  describe('getDashboardMetrics', () => {
    it('should return combined service health and platform metrics', async () => {
      // Arrange: platform metrics
      mockPrismaService.user.count.mockResolvedValue(42);
      mockPrismaService.filter.count.mockResolvedValue(18);
      mockPrismaService.match.count.mockResolvedValue(256);
      mockPrismaService.userSession.count.mockResolvedValue(7);

      // Arrange: all remote services healthy (wrapped in StandardApiResponse)
      const healthyResponse = {
        data: { success: true, data: { status: 'healthy' }, message: 'Service is healthy' },
        status: 200,
      };
      mockHttpService.get.mockReturnValue(of(healthyResponse));

      const result = await service.getDashboardMetrics();

      expect(result.services.api.status).toBe('healthy');
      expect(result.metrics.totalUsers).toBe(42);
      expect(result.metrics.totalFilters).toBe(18);
      expect(result.metrics.totalMatches).toBe(256);
      expect(result.metrics.activeSessions).toBe(7);
    });

    it('should handle partial service failures gracefully', async () => {
      // Arrange: platform metrics
      mockPrismaService.user.count.mockResolvedValue(10);
      mockPrismaService.filter.count.mockResolvedValue(5);
      mockPrismaService.match.count.mockResolvedValue(20);
      mockPrismaService.userSession.count.mockResolvedValue(2);

      // Arrange: notifier fails, others succeed
      const healthyResponse = {
        data: { success: true, data: { status: 'healthy' }, message: 'Service is healthy' },
        status: 200,
      };
      mockHttpService.get.mockImplementation((url: string) => {
        if (url.includes('notifier')) {
          return throwError(() => new Error('Connection refused'));
        }
        return of(healthyResponse);
      });

      const result = await service.getDashboardMetrics();

      // API is always healthy (inferred)
      expect(result.services.api.status).toBe('healthy');
      // Metrics should still be returned
      expect(result.metrics.totalUsers).toBe(10);
      // The failed service should report unreachable
      expect(result.services.notifier.status).toBe('unreachable');
    });

    it('should return unreachable status when a remote service times out', async () => {
      // Arrange: platform metrics
      mockPrismaService.user.count.mockResolvedValue(1);
      mockPrismaService.filter.count.mockResolvedValue(0);
      mockPrismaService.match.count.mockResolvedValue(0);
      mockPrismaService.userSession.count.mockResolvedValue(0);

      // Arrange: all remote services time out
      mockHttpService.get.mockReturnValue(
        throwError(() => new Error('timeout of 5000ms exceeded')),
      );

      const result = await service.getDashboardMetrics();

      expect(result.services.api.status).toBe('healthy');
      expect(result.services.scraper.status).toBe('unreachable');
      expect(result.services.notifier.status).toBe('unreachable');
      expect(result.services.scheduler.status).toBe('unreachable');
      expect(result.metrics.totalUsers).toBe(1);
    });
  });

  describe('getUsers', () => {
    const mockPaginatedResult = {
      data: [mockUser],
      pagination: {
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    };

    it('should delegate to userRepository.findManyPaginated when no search is provided', async () => {
      mockUserRepository.findManyPaginated.mockResolvedValue(mockPaginatedResult);

      const result = await service.getUsers(1, 20);

      expect(mockUserRepository.findManyPaginated).toHaveBeenCalledWith(
        undefined,
        { page: 1, limit: 20 },
      );
      expect(mockUserRepository.searchUsers).not.toHaveBeenCalled();
      expect(result.data).toHaveLength(1);
    });

    it('should delegate to userRepository.searchUsers when search is provided', async () => {
      mockUserRepository.searchUsers.mockResolvedValue(mockPaginatedResult);

      const result = await service.getUsers(1, 20, 'john');

      expect(mockUserRepository.searchUsers).toHaveBeenCalledWith('john', {
        page: 1,
        limit: 20,
      });
      expect(mockUserRepository.findManyPaginated).not.toHaveBeenCalled();
      expect(result.data).toHaveLength(1);
    });

    it('should strip password from returned users', async () => {
      mockUserRepository.findManyPaginated.mockResolvedValue(mockPaginatedResult);

      const result = await service.getUsers(1, 20);

      for (const user of result.data) {
        expect(user).not.toHaveProperty('password');
        expect(user.id).toBeDefined();
        expect(user.email).toBeDefined();
      }
    });
  });

  describe('updateUserRole', () => {
    it('should update role via userRepository.update', async () => {
      const updatedUser = { ...mockUser, role: 'ADMIN' };
      mockUserRepository.update.mockResolvedValue(updatedUser);

      const result = await service.updateUserRole('user-1', 'ADMIN' as never);

      expect(mockUserRepository.update).toHaveBeenCalledWith(
        { id: 'user-1' },
        { role: 'ADMIN' },
      );
      expect(result.role).toBe('ADMIN');
    });

    it('should strip password from returned user', async () => {
      mockUserRepository.update.mockResolvedValue(mockUser);

      const result = await service.updateUserRole('user-1', 'USER' as never);

      expect(result).not.toHaveProperty('password');
      expect(result.id).toBe('user-1');
      expect(result.email).toBe('user1@test.com');
    });
  });

  describe('deleteUser', () => {
    it('should throw ForbiddenException when trying to delete self', async () => {
      await expect(
        service.deleteUser('admin-id', 'admin-id'),
      ).rejects.toThrow(ForbiddenException);

      expect(mockUserRepository.findUnique).not.toHaveBeenCalled();
      expect(mockUserRepository.delete).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when user does not exist', async () => {
      mockUserRepository.findUnique.mockResolvedValue(null);

      await expect(
        service.deleteUser('nonexistent-id', 'admin-id'),
      ).rejects.toThrow(NotFoundException);

      expect(mockUserRepository.findUnique).toHaveBeenCalledWith({
        id: 'nonexistent-id',
      });
      expect(mockUserRepository.delete).not.toHaveBeenCalled();
    });

    it('should delete user successfully when valid', async () => {
      mockUserRepository.findUnique.mockResolvedValue(mockUser);
      mockUserRepository.delete.mockResolvedValue(mockUser);

      await service.deleteUser('user-1', 'admin-id');

      expect(mockUserRepository.findUnique).toHaveBeenCalledWith({
        id: 'user-1',
      });
      expect(mockUserRepository.delete).toHaveBeenCalledWith({
        id: 'user-1',
      });
    });
  });

  describe('resetUserPassword', () => {
    it('should throw NotFoundException when user does not exist', async () => {
      mockUserRepository.findUnique.mockResolvedValue(null);

      await expect(
        service.resetUserPassword('nonexistent-id'),
      ).rejects.toThrow(NotFoundException);

      expect(mockUserRepository.findUnique).toHaveBeenCalledWith({
        id: 'nonexistent-id',
      });
    });

    describe('when email is configured', () => {
      beforeEach(() => {
        mockSharedConfigService.getEmailConfig = jest.fn().mockReturnValue({
          service: 'mailhog',
          transport: {},
          from: { email: 'noreply@test.com', name: 'Test' },
        });
      });

      it('should queue a password-reset notification with resetUrl and return null', async () => {
        mockUserRepository.findUnique.mockResolvedValue(mockUser);

        const result = await service.resetUserPassword('user-1');

        expect(mockPasswordResetService.generateResetToken).toHaveBeenCalledWith(
          'user-1',
          mockUser.email,
          '24h',
        );
        expect(mockNotificationQueue.add).toHaveBeenCalledWith(
          'password-reset',
          expect.objectContaining({
            userId: 'user-1',
            email: mockUser.email,
            resetUrl: expect.any(String),
          }),
          expect.any(Object),
        );
        expect(result).toBeNull();
      });
    });

    describe('when email is not configured (service === "none")', () => {
      beforeEach(() => {
        mockSharedConfigService.getEmailConfig = jest.fn().mockReturnValue({
          service: 'none',
          transport: {},
          from: { email: '', name: '' },
        });
      });

      it('should skip the notification queue and return the resetUrl', async () => {
        mockUserRepository.findUnique.mockResolvedValue(mockUser);

        const result = await service.resetUserPassword('user-1');

        expect(mockNotificationQueue.add).not.toHaveBeenCalled();
        expect(result).not.toBeNull();
        expect(result).toHaveProperty('resetUrl');
        expect(typeof result?.resetUrl).toBe('string');
        expect(result?.resetUrl.length).toBeGreaterThan(0);
      });
    });
  });

  describe('getApiHealth', () => {
    it('should return healthy status when the local health endpoint succeeds', async () => {
      const healthyResponse = {
        data: {
          success: true,
          data: { status: 'healthy', service: 'api', uptime: 100, version: '1.0.0' },
          message: 'Service is healthy',
        },
        status: 200,
      };
      mockHttpService.get.mockReturnValue(of(healthyResponse));
      mockSharedConfigService.getServicePort.mockReturnValue(3001);

      const result = await service.getApiHealth();

      expect(result.status).toBe('healthy');
      expect(result.details).toBeDefined();
      expect(result.details).toHaveProperty('uptime');
    });

    it('should return healthy status even when the health endpoint fails', async () => {
      mockHttpService.get.mockReturnValue(
        throwError(() => new Error('Connection refused')),
      );
      mockSharedConfigService.getServicePort.mockReturnValue(3001);

      const result = await service.getApiHealth();

      expect(result.status).toBe('healthy');
      expect(result.details).toEqual({ message: 'API is operational' });
    });
  });

  describe('getNotifierHealth', () => {
    it('should return healthy status when notifier is reachable', async () => {
      const healthyResponse = {
        data: {
          success: true,
          data: { status: 'healthy', service: 'notifier', uptime: 500 },
          message: 'Service is healthy',
        },
        status: 200,
      };
      mockHttpService.get.mockReturnValue(of(healthyResponse));

      const result = await service.getNotifierHealth();

      expect(result.status).toBe('healthy');
      expect(result.details).toHaveProperty('uptime');
    });

    it('should return unreachable status when notifier is down', async () => {
      mockHttpService.get.mockReturnValue(
        throwError(() => new Error('Connection refused')),
      );

      const result = await service.getNotifierHealth();

      expect(result.status).toBe('unreachable');
    });
  });

  describe('getSchedulerHealth', () => {
    it('should return scheduler health with scrapers array', async () => {
      const schedulerResponse = {
        data: {
          success: true,
          data: {
            status: 'healthy',
            service: 'scheduler',
            uptime: 7886,
            workers: {
              total: 1,
              available: 1,
              busy: 0,
              details: [
                {
                  id: 'scraper-01',
                  endpoint: 'http://scraper-01:3002',
                  status: 'active',
                  currentLoad: 0,
                  maxConcurrentJobs: 5,
                  supportedJobTypes: ['scrape-category'],
                  lastHeartbeat: new Date().toISOString(),
                },
              ],
            },
          },
          message: 'Service is healthy',
        },
        status: 200,
      };
      const scraperResponse = {
        data: {
          success: true,
          data: {
            status: 'healthy',
            service: 'scraper',
            puppeteerPool: {
              totalInstances: 5,
              availableInstances: 3,
              busyInstances: 2,
              queuedRequests: 0,
              utilizationPercentage: 40,
              healthStatus: 'healthy',
            },
          },
          message: 'Service is healthy',
        },
        status: 200,
      };

      mockHttpService.get.mockImplementation((url: string) => {
        if (url.includes('scheduler')) return of(schedulerResponse);
        return of(scraperResponse);
      });

      const result = await service.getSchedulerHealth();

      expect(result.scheduler.status).toBe('healthy');
      expect(result.scrapers).toHaveLength(1);
      expect(result.scrapers[0].id).toBe('scraper-01');
      expect(result.scrapers[0].status).toBe('healthy');
      expect(result.scrapers[0].browserPool).toBeDefined();
    });

    it('should return unreachable scheduler when scheduler is down', async () => {
      mockHttpService.get.mockReturnValue(
        throwError(() => new Error('Connection refused')),
      );

      const result = await service.getSchedulerHealth();

      expect(result.scheduler.status).toBe('unreachable');
      expect(result.scrapers).toHaveLength(0);
    });

    it('should handle unreachable scraper workers gracefully', async () => {
      const schedulerResponse = {
        data: {
          success: true,
          data: {
            status: 'healthy',
            service: 'scheduler',
            workers: {
              total: 1,
              available: 0,
              busy: 1,
              details: [
                {
                  id: 'scraper-01',
                  endpoint: 'http://scraper-01:3002',
                  status: 'inactive',
                  currentLoad: 0,
                  maxConcurrentJobs: 5,
                  supportedJobTypes: ['scrape-category'],
                  lastHeartbeat: new Date().toISOString(),
                },
              ],
            },
          },
          message: 'Service is healthy',
        },
        status: 200,
      };

      mockHttpService.get.mockImplementation((url: string) => {
        if (url.includes('scheduler')) return of(schedulerResponse);
        return throwError(() => new Error('Connection refused'));
      });

      const result = await service.getSchedulerHealth();

      expect(result.scheduler.status).toBe('healthy');
      expect(result.scrapers).toHaveLength(1);
      expect(result.scrapers[0].status).toBe('unreachable');
    });
  });

  describe('getMetrics', () => {
    it('should return platform metrics from the database', async () => {
      mockPrismaService.user.count.mockResolvedValue(42);
      mockPrismaService.filter.count.mockResolvedValue(18);
      mockPrismaService.match.count.mockResolvedValue(256);
      mockPrismaService.userSession.count.mockResolvedValue(7);

      const result = await service.getMetrics();

      expect(result.totalUsers).toBe(42);
      expect(result.totalFilters).toBe(18);
      expect(result.totalMatches).toBe(256);
      expect(result.activeSessions).toBe(7);
    });
  });
});
