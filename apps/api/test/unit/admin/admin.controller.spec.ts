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
import { AdminController } from '../../../src/admin/admin.controller';
import { AdminService } from '../../../src/admin/admin.service';
import { AuditLoggerService } from '../../../src/admin/audit-logger.service';
import { UserRole } from '@dealscrapper/shared-types';

describe('AdminController', () => {
  let controller: AdminController;
  let adminService: AdminService;

  const mockDashboardMetrics = {
    services: {
      api: { status: 'healthy', details: { message: 'API is operational' } },
      scraper: { status: 'healthy', details: {} },
      notifier: { status: 'healthy', details: {} },
      scheduler: { status: 'unreachable', details: { error: 'Connection refused' } },
    },
    metrics: {
      totalUsers: 42,
      totalFilters: 18,
      totalMatches: 256,
      activeSessions: 7,
    },
  };

  const mockAdminUser = {
    id: 'user-1',
    email: 'user1@test.com',
    firstName: 'John',
    lastName: 'Doe',
    role: UserRole.USER,
    emailVerified: true,
    createdAt: new Date('2025-01-01'),
    lastLoginAt: new Date('2025-06-01'),
  };

  const mockPaginatedUsers = {
    data: [mockAdminUser],
    pagination: {
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    },
  };

  const mockAdminService = {
    getDashboardMetrics: jest.fn(),
    getApiHealth: jest.fn(),
    getNotifierHealth: jest.fn(),
    getSchedulerHealth: jest.fn(),
    getMetrics: jest.fn(),
    getUsers: jest.fn(),
    updateUserRole: jest.fn(),
    deleteUser: jest.fn(),
    resetUserPassword: jest.fn(),
  };

  const mockAuditLogger = { log: jest.fn() };

  const mockAdminRequest = {
    user: { id: 'admin-user-id', email: 'admin@test.com', role: 'ADMIN' },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        {
          provide: AdminService,
          useValue: mockAdminService,
        },
        {
          provide: AuditLoggerService,
          useValue: mockAuditLogger,
        },
      ],
    }).compile();

    controller = module.get<AdminController>(AdminController);
    adminService = module.get<AdminService>(AdminService);

    jest.clearAllMocks();
  });

  describe('getDashboard', () => {
    it('should return dashboard metrics wrapped in a success response', async () => {
      mockAdminService.getDashboardMetrics.mockResolvedValue(mockDashboardMetrics);

      const result = await controller.getDashboard();

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockDashboardMetrics);
      expect(result.message).toBe('Dashboard metrics retrieved successfully');
      expect(mockAdminService.getDashboardMetrics).toHaveBeenCalledTimes(1);
    });
  });

  describe('getUsers', () => {
    it('should return paginated users with default pagination', async () => {
      mockAdminService.getUsers.mockResolvedValue(mockPaginatedUsers);

      const query = { page: 1, limit: 20 };
      const result = await controller.getUsers(query);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockPaginatedUsers);
      expect(result.message).toBe('Users retrieved successfully');
      expect(mockAdminService.getUsers).toHaveBeenCalledWith(1, 20, undefined);
    });

    it('should pass search parameter correctly to the service', async () => {
      mockAdminService.getUsers.mockResolvedValue(mockPaginatedUsers);

      const query = { page: 2, limit: 10, search: 'john' };
      const result = await controller.getUsers(query);

      expect(result.success).toBe(true);
      expect(mockAdminService.getUsers).toHaveBeenCalledWith(2, 10, 'john');
    });
  });

  describe('updateUserRole', () => {
    it('should call service with correct userId and role', async () => {
      const updatedUser = { ...mockAdminUser, role: UserRole.ADMIN };
      mockAdminService.updateUserRole.mockResolvedValue(updatedUser);

      const result = await controller.updateUserRole(
        'user-1',
        { role: UserRole.ADMIN },
        mockAdminRequest as never,
      );

      expect(result.success).toBe(true);
      expect(result.data.role).toBe(UserRole.ADMIN);
      expect(result.message).toBe('User role updated successfully');
      expect(mockAdminService.updateUserRole).toHaveBeenCalledWith(
        'user-1',
        UserRole.ADMIN,
      );
    });
  });

  describe('deleteUser', () => {
    it('should pass userId and currentUserId from the request', async () => {
      mockAdminService.deleteUser.mockResolvedValue(undefined);

      const mockRequest = {
        user: { id: 'admin-user-id', email: 'admin@test.com', role: 'ADMIN' },
      };

      const result = await controller.deleteUser(
        'user-1',
        mockRequest as never,
      );

      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
      expect(result.message).toBe('User deleted successfully');
      expect(mockAdminService.deleteUser).toHaveBeenCalledWith(
        'user-1',
        'admin-user-id',
      );
    });
  });

  describe('resetUserPassword', () => {
    it('should return null data and email-sent message when email is configured', async () => {
      mockAdminService.resetUserPassword.mockResolvedValue(null);

      const result = await controller.resetUserPassword(
        'user-1',
        mockAdminRequest as never,
      );

      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
      expect(result.message).toBe('Password reset link sent to user');
      expect(mockAdminService.resetUserPassword).toHaveBeenCalledWith('user-1');
    });

    it('should return resetUrl and manual-share message when email is not configured', async () => {
      const resetUrl = 'http://localhost:3000/auth/reset-password?token=abc123';
      mockAdminService.resetUserPassword.mockResolvedValue({ resetUrl });

      const result = await controller.resetUserPassword(
        'user-1',
        mockAdminRequest as never,
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ resetUrl });
      expect(result.message).toBe('No email provider configured — share this link with the user');
      expect(mockAdminService.resetUserPassword).toHaveBeenCalledWith('user-1');
    });
  });

  describe('getApiHealth', () => {
    it('should return API health in a success response', async () => {
      const mockHealth = { status: 'healthy', details: { message: 'API is operational' } };
      mockAdminService.getApiHealth.mockResolvedValue(mockHealth);

      const result = await controller.getApiHealth();

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockHealth);
      expect(result.message).toBe('API health retrieved successfully');
    });
  });

  describe('getNotifierHealth', () => {
    it('should return notifier health in a success response', async () => {
      const mockHealth = { status: 'healthy', details: { websocket: 'active' } };
      mockAdminService.getNotifierHealth.mockResolvedValue(mockHealth);

      const result = await controller.getNotifierHealth();

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockHealth);
      expect(result.message).toBe('Notifier health retrieved successfully');
    });
  });

  describe('getSchedulerHealth', () => {
    it('should return scheduler health with scrapers in a success response', async () => {
      const mockHealth = {
        scheduler: { status: 'healthy', details: {} },
        scrapers: [
          {
            id: 'scraper-01',
            status: 'healthy',
            endpoint: 'http://localhost:3002',
            currentLoad: 2,
            maxConcurrentJobs: 5,
            supportedJobTypes: ['scrape-category'],
            lastHeartbeat: new Date().toISOString(),
          },
        ],
      };
      mockAdminService.getSchedulerHealth.mockResolvedValue(mockHealth);

      const result = await controller.getSchedulerHealth();

      expect(result.success).toBe(true);
      expect(result.data.scheduler.status).toBe('healthy');
      expect(result.data.scrapers).toHaveLength(1);
      expect(result.message).toBe('Scheduler health retrieved successfully');
    });
  });

  describe('getMetrics', () => {
    it('should return platform metrics in a success response', async () => {
      const mockMetrics = {
        totalUsers: 42,
        totalFilters: 18,
        totalMatches: 256,
        activeSessions: 7,
      };
      mockAdminService.getMetrics.mockResolvedValue(mockMetrics);

      const result = await controller.getMetrics();

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockMetrics);
      expect(result.message).toBe('Metrics retrieved successfully');
    });
  });
});
