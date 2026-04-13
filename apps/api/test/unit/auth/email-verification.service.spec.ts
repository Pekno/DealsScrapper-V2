import { Test, TestingModule } from '@nestjs/testing';
import { EmailVerificationService } from '../../../src/auth/services/email-verification.service';
import { JwtService } from '@nestjs/jwt';
import { SharedConfigService } from '@dealscrapper/shared-config';
import { UsersService } from '../../../src/users/users.service';
import { Queue } from 'bull';
import { getQueueToken } from '@nestjs/bull';
import { BadRequestException } from '@nestjs/common';

describe('EmailVerificationService - Public Resend Functionality', () => {
  let service: EmailVerificationService;
  let usersService: UsersService;
  let notificationQueue: Queue;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    emailVerified: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockVerifiedUser = {
    ...mockUser,
    emailVerified: true,
  };

  const mockJwtService = {
    sign: jest.fn().mockReturnValue('mock-jwt-token'),
    verify: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config: Record<string, string> = {
        EMAIL_VERIFICATION_SECRET: 'test-secret',
        EMAIL_VERIFICATION_EXPIRES_IN: '24h',
        WEB_APP_URL: 'http://localhost:3000',
      };
      return config[key];
    }),
  };

  const mockUsersService = {
    findById: jest.fn(),
    findByEmail: jest.fn(),
    verifyEmail: jest.fn(),
  };

  const mockNotificationQueue = {
    add: jest.fn().mockResolvedValue({ id: 'job-123' }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailVerificationService,
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: SharedConfigService,
          useValue: mockConfigService,
        },
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
        {
          provide: getQueueToken('notifications'),
          useValue: mockNotificationQueue,
        },
      ],
    }).compile();

    service = module.get<EmailVerificationService>(EmailVerificationService);
    usersService = module.get<UsersService>(UsersService);
    notificationQueue = module.get<Queue>(getQueueToken('notifications'));

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('resendVerificationEmailByUserId', () => {
    it('should send verification email for existing unverified user', async () => {
      // Arrange: Unverified user exists
      mockUsersService.findById.mockResolvedValue(mockUser);

      // Mock sendVerificationEmail to avoid internal implementation details
      const sendVerificationEmailSpy = jest
        .spyOn(service, 'sendVerificationEmail')
        .mockResolvedValue(undefined);

      // Act: Request resend
      await service.resendVerificationEmailByUserId(mockUser.id);

      // Assert: Email sending was triggered
      expect(mockUsersService.findById).toHaveBeenCalledWith(mockUser.id);
      expect(sendVerificationEmailSpy).toHaveBeenCalledWith(
        mockUser.id,
        mockUser.email
      );
    });

    it('should not send email for already verified user (prevent enumeration)', async () => {
      // Arrange: Verified user exists
      mockUsersService.findById.mockResolvedValue(mockVerifiedUser);

      // Act: Request resend
      await service.resendVerificationEmailByUserId(mockVerifiedUser.id);

      // Assert: No email queued, no error thrown
      expect(mockUsersService.findById).toHaveBeenCalledWith(
        mockVerifiedUser.id
      );
      expect(mockNotificationQueue.add).not.toHaveBeenCalled();

      // User Protection: Method completes successfully without revealing verification status
    });

    it('should not send email for non-existent user (prevent enumeration)', async () => {
      // Arrange: User does not exist
      mockUsersService.findById.mockResolvedValue(null);

      // Act: Request resend
      await service.resendVerificationEmailByUserId('nonexistent-id');

      // Assert: No email queued, no error thrown
      expect(mockUsersService.findById).toHaveBeenCalledWith('nonexistent-id');
      expect(mockNotificationQueue.add).not.toHaveBeenCalled();

      // Security Protection: Attackers cannot determine if userId exists
    });

    it('should handle errors gracefully without throwing (prevent enumeration)', async () => {
      // Arrange: Service error occurs
      mockUsersService.findById.mockRejectedValue(
        new Error('Database connection failed')
      );

      // Act & Assert: Should not throw, completes silently
      await expect(
        service.resendVerificationEmailByUserId('test-id')
      ).resolves.not.toThrow();

      // Security Protection: No error details leaked to prevent enumeration
      expect(mockUsersService.findById).toHaveBeenCalledWith('test-id');
      expect(mockNotificationQueue.add).not.toHaveBeenCalled();
    });

    it('should handle queue errors gracefully without throwing', async () => {
      // Arrange: User exists but queue fails
      mockUsersService.findById.mockResolvedValue(mockUser);
      mockNotificationQueue.add.mockRejectedValue(
        new Error('Queue connection failed')
      );

      // Act & Assert: Should not throw, completes silently
      await expect(
        service.resendVerificationEmailByUserId(mockUser.id)
      ).resolves.not.toThrow();

      // Security Protection: Errors are logged but not exposed
      expect(mockUsersService.findById).toHaveBeenCalledWith(mockUser.id);
    });

    it('should not call sendVerificationEmail for verified user', async () => {
      // Arrange: Mock the sendVerificationEmail method
      mockUsersService.findById.mockResolvedValue(mockVerifiedUser);
      const sendVerificationEmailSpy = jest.spyOn(
        service,
        'sendVerificationEmail'
      );

      // Act: Request resend
      await service.resendVerificationEmailByUserId(mockVerifiedUser.id);

      // Assert: Internal method not called for verified user
      expect(sendVerificationEmailSpy).not.toHaveBeenCalled();
    });

    it('should not call sendVerificationEmail for non-existent user', async () => {
      // Arrange: Mock the sendVerificationEmail method
      mockUsersService.findById.mockResolvedValue(null);
      const sendVerificationEmailSpy = jest.spyOn(
        service,
        'sendVerificationEmail'
      );

      // Act: Request resend
      await service.resendVerificationEmailByUserId('nonexistent-id');

      // Assert: Internal method not called for non-existent user
      expect(sendVerificationEmailSpy).not.toHaveBeenCalled();
    });
  });

  describe('existing functionality - sendVerificationEmail', () => {
    it('should throw error when user not found (authenticated context)', async () => {
      // Arrange: User does not exist
      mockUsersService.findById.mockResolvedValue(null);

      // Act & Assert: Should throw BadRequestException
      await expect(
        service.sendVerificationEmail('nonexistent-id', 'test@example.com')
      ).rejects.toThrow(BadRequestException);

      // Note: This is different from public endpoint which never throws
    });

    it('should throw error when email mismatch (authenticated context)', async () => {
      // Arrange: User exists but email doesn't match
      mockUsersService.findById.mockResolvedValue({
        ...mockUser,
        email: 'different@example.com',
      });

      // Act & Assert: Should throw BadRequestException
      await expect(
        service.sendVerificationEmail(mockUser.id, 'test@example.com')
      ).rejects.toThrow(BadRequestException);
    });

    it('should skip sending if email already verified (authenticated context)', async () => {
      // Arrange: User is already verified
      mockUsersService.findById.mockResolvedValue(mockVerifiedUser);

      // Act: Request send
      await service.sendVerificationEmail(
        mockVerifiedUser.id,
        mockVerifiedUser.email
      );

      // Assert: No email queued
      expect(mockNotificationQueue.add).not.toHaveBeenCalled();
    });
  });
});
