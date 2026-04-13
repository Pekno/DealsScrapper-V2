import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from '../../../src/users/users.service';
import { PrismaService } from '@dealscrapper/database';

describe('UsersService - User Profile & Preference Management', () => {
  let service: UsersService;
  let prismaService: PrismaService;

  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    password: 'hashedPassword',
    role: 'USER',
    createdAt: new Date(),
    updatedAt: new Date(),
    emailVerified: false,
    emailVerifiedAt: null,
    lastLoginAt: null,
    loginAttempts: 0,
    lockedUntil: null,
    firstName: 'John',
    lastName: 'Doe',
    timezone: 'UTC',
    locale: 'en',
    emailNotifications: true,
    marketingEmails: false,
    weeklyDigest: true,
  };

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prismaService = module.get<PrismaService>(PrismaService);

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('findByEmail', () => {
    it('should enable users to access their account using their email', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.findByEmail('test@example.com');

      // User Value: Account successfully located for authentication
      expect(result.id).toBe('user-1');
      expect(result.email).toBe('test@example.com');
      expect(result.firstName).toBe('John');
      expect(result.lastName).toBe('Doe');
    });

    it('should protect against access attempts with non-existent emails', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      const result = await service.findByEmail('nonexistent@example.com');

      // User Security: No account data exposed for invalid emails
      expect(result).toBeNull();
    });
  });

  describe('findById', () => {
    it('should provide users with access to their account details', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.findById('user-1');

      // User Value: Account information available for personalization
      expect(result.id).toBe('user-1');
      expect(result.email).toBe('test@example.com');
      expect(result.emailNotifications).toBe(true);
      expect(result.weeklyDigest).toBe(true);
    });

    it('should protect against unauthorized account access', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      const result = await service.findById('nonexistent-id');

      // User Security: Invalid IDs cannot access account data
      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('should enable new users to join the platform with complete profiles', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'hashedPassword',
        firstName: 'John',
        lastName: 'Doe',
      };

      const newUser = { ...mockUser, ...userData, id: 'user-2' };
      mockPrismaService.user.create.mockResolvedValue(newUser);

      const result = await service.create(userData);

      // User Value: Account created with full personalization options
      expect(result.id).toBe('user-2');
      expect(result.email).toBe('test@example.com');
      expect(result.firstName).toBe('John');
      expect(result.lastName).toBe('Doe');

      // User Benefit: Ready to receive personalized deal notifications
    });

    it('should allow users to join quickly with essential information only', async () => {
      const userData = {
        email: 'minimal@example.com',
        password: 'hashedPassword',
      };

      const newUser = { ...mockUser, ...userData, id: 'user-3' };
      mockPrismaService.user.create.mockResolvedValue(newUser);

      const result = await service.create(userData);

      // User Convenience: Quick registration with minimum requirements
      expect(result.id).toBe('user-3');
      expect(result.email).toBe('minimal@example.com');

      // User Value: Can enhance profile later as needed
    });

    it('should prevent users from creating duplicate accounts', async () => {
      const userData = {
        email: 'existing@example.com',
        password: 'hashedPassword',
      };

      mockPrismaService.user.create.mockRejectedValue(
        new Error('Unique constraint failed on the fields: (`email`)')
      );

      // User Protection: Prevents account conflicts and maintains data integrity
      await expect(service.create(userData)).rejects.toThrow();
    });
  });

  describe('update', () => {
    it('should allow users to personalize their profile information', async () => {
      const updateData = {
        firstName: 'Updated',
        lastName: 'Name',
        timezone: 'Europe/Paris',
        locale: 'fr',
      };
      const updatedUser = { ...mockUser, ...updateData };

      mockPrismaService.user.update.mockResolvedValue(updatedUser);

      const result = await service.update('user-1', updateData);

      // User Value: Profile customized to user preferences
      expect(result.firstName).toBe('Updated');
      expect(result.lastName).toBe('Name');
      expect(result.timezone).toBe('Europe/Paris');
      expect(result.locale).toBe('fr');

      // User Benefit: Localized experience and proper name display
    });

    it('should enable users to control their notification experience', async () => {
      const updateData = {
        emailNotifications: false,
        marketingEmails: true,
        weeklyDigest: false,
      };
      const updatedUser = { ...mockUser, ...updateData };

      mockPrismaService.user.update.mockResolvedValue(updatedUser);

      const result = await service.update('user-1', updateData);

      // User Value: Notification preferences customized to user needs
      expect(result.emailNotifications).toBe(false);
      expect(result.marketingEmails).toBe(true);
      expect(result.weeklyDigest).toBe(false);

      // User Benefit: Receives only desired communications
    });

    it('should protect against updates to non-existent accounts', async () => {
      mockPrismaService.user.update.mockRejectedValue(
        new Error('Record to update not found')
      );

      // User Security: Cannot modify unauthorized accounts
      await expect(
        service.update('nonexistent-id', { email: 'new@example.com' })
      ).rejects.toThrow();
    });
  });

  describe('updateProfile', () => {
    it('should enable users to update their profile while maintaining security', async () => {
      const updateData = {
        firstName: 'Updated',
        lastName: 'Profile',
        timezone: 'America/New_York',
        locale: 'es',
      };

      const updatedUser = { ...mockUser, ...updateData };
      mockPrismaService.user.update.mockResolvedValue(updatedUser);

      const result = await service.updateProfile('user-1', updateData);

      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: updateData,
      });

      const { password, ...expectedResult } = updatedUser;
      expect(result).toEqual(expectedResult);
      expect(result).not.toHaveProperty('password');
    });

    it('should allow users to update specific profile fields as needed', async () => {
      const updateData = {
        firstName: 'PartialUpdate',
        timezone: 'Asia/Tokyo',
      };

      const updatedUser = { ...mockUser, ...updateData };
      mockPrismaService.user.update.mockResolvedValue(updatedUser);

      const result = await service.updateProfile('user-1', updateData);

      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: updateData,
      });

      const { password, ...expectedResult } = updatedUser;
      expect(result).toEqual(expectedResult);
    });
  });

  describe('updateNotificationPreferences', () => {
    it('should update notification preferences and return user without password', async () => {
      const updateData = {
        emailNotifications: false,
        marketingEmails: true,
        weeklyDigest: false,
      };

      const updatedUser = { ...mockUser, ...updateData };
      mockPrismaService.user.update.mockResolvedValue(updatedUser);

      const result = await service.updateNotificationPreferences(
        'user-1',
        updateData
      );

      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: updateData,
      });

      const { password, ...expectedResult } = updatedUser;
      expect(result).toEqual(expectedResult);
      expect(result).not.toHaveProperty('password');
    });

    it('should update partial notification preferences', async () => {
      const updateData = {
        emailNotifications: false,
      };

      const updatedUser = { ...mockUser, ...updateData };
      mockPrismaService.user.update.mockResolvedValue(updatedUser);

      const result = await service.updateNotificationPreferences(
        'user-1',
        updateData
      );

      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: updateData,
      });

      const { password, ...expectedResult } = updatedUser;
      expect(result).toEqual(expectedResult);
    });
  });

  describe('delete', () => {
    it('should delete and return user', async () => {
      mockPrismaService.user.delete.mockResolvedValue(mockUser);

      const result = await service.delete('user-1');

      expect(mockPrismaService.user.delete).toHaveBeenCalledWith({
        where: { id: 'user-1' },
      });
      expect(result).toEqual(mockUser);
    });

    it('should throw error when user not found', async () => {
      mockPrismaService.user.delete.mockRejectedValue(
        new Error('Record to delete does not exist')
      );

      await expect(service.delete('nonexistent-id')).rejects.toThrow();
    });
  });
});
