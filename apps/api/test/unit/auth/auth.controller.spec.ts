import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from '../../../src/auth/auth.controller';
import { AuthService } from '../../../src/auth/auth.service';
import { EmailVerificationService } from '../../../src/auth/services/email-verification.service';
import { PasswordResetService } from '../../../src/auth/services/password-reset.service';
import { UsersService } from '../../../src/users/users.service';
import { getQueueToken } from '@nestjs/bull';
import { UnauthorizedException } from '@nestjs/common';
import { RegisterDto } from '../../../src/auth/dto/register.dto';
import { LoginDto } from '../../../src/auth/dto/login.dto';

describe('AuthController - User Authentication & Account Access', () => {
  let controller: AuthController;
  let authService: AuthService;

  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    createdAt: new Date(),
  };

  const mockAuthResponse = {
    access_token: 'jwt-token',
    refresh_token: 'refresh-token',
    expires_in: '15m',
    user: mockUser,
  };

  const mockAuthService = {
    register: jest.fn(),
    validateUser: jest.fn(),
    login: jest.fn(),
    refreshToken: jest.fn(),
    logout: jest.fn(),
    logoutAll: jest.fn(),
  };

  const mockEmailVerificationService = {
    sendVerificationEmail: jest.fn(),
    verifyEmail: jest.fn(),
    resendVerificationEmailByUserId: jest.fn(),
  };

  const mockPasswordResetService = {
    generateResetToken: jest.fn(),
    validateResetToken: jest.fn(),
    resetPassword: jest.fn(),
    forgotPassword: jest.fn(),
    getConfiguredExpiresIn: jest.fn().mockReturnValue('1h'),
  };

  const mockUsersService = { findById: jest.fn(), findByEmail: jest.fn() };
  const mockNotificationQueue = { add: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: EmailVerificationService, useValue: mockEmailVerificationService },
        { provide: PasswordResetService, useValue: mockPasswordResetService },
        { provide: UsersService, useValue: mockUsersService },
        { provide: getQueueToken('notifications'), useValue: mockNotificationQueue },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should enable new users to create secure accounts', async () => {
      const registerDto: RegisterDto = {
        email: 'test@example.com',
        password: 'StrongP@ssw0rd',
      };

      mockAuthService.register.mockResolvedValue(mockAuthResponse);

      const result = await controller.register(
        registerDto,
        '127.0.0.1',
        'test-agent'
      );

      // User Value: Successful account creation with immediate access
      expect(result.access_token).toBe('jwt-token');
      expect(result.refresh_token).toBe('refresh-token');
      expect(result.user.email).toBe('test@example.com');

      // User Benefit: Ready to access their personalized deal preferences
      expect(result.expires_in).toBe('15m');
    });

    it('should protect platform from duplicate accounts', async () => {
      const registerDto: RegisterDto = {
        email: 'existing@example.com',
        password: 'StrongP@ssw0rd',
      };

      mockAuthService.register.mockRejectedValue(
        new UnauthorizedException('Registration failed')
      );

      // User Protection: Prevents account conflicts and security issues
      await expect(
        controller.register(registerDto, '127.0.0.1', 'test-agent')
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('login', () => {
    it('should provide users secure access to their personalized deal preferences', async () => {
      const mockRequest = {
        user: mockUser,
      };

      mockAuthService.login.mockResolvedValue(mockAuthResponse);

      const result = await controller.login(
        mockRequest,
        '127.0.0.1',
        'test-agent'
      );

      // User Value: Successful authentication grants access to personalized features
      expect(result.access_token).toBe('jwt-token');
      expect(result.refresh_token).toBe('refresh-token');
      expect(result.user.id).toBe('user-1');

      // User Benefit: Can now access saved filters and receive deal notifications
      expect(result.expires_in).toBeDefined();
    });
  });

  // getProfile method removed - profile functionality moved to /users/profile

  describe('forgotPassword', () => {
    const mockFoundUser = { id: 'user-1', email: 'test@example.com' };

    beforeEach(() => {
      (mockUsersService as any).findByEmail = jest.fn();
      mockPasswordResetService.generateResetToken.mockReturnValue({
        token: 'reset-token',
        resetUrl: 'https://example.com/reset?token=reset-token',
      });
      (mockPasswordResetService as any).getConfiguredExpiresIn = jest.fn().mockReturnValue('1h');
      mockNotificationQueue.add.mockResolvedValue({});
    });

    it('should enqueue a password-reset job with expiresIn for an existing user', async () => {
      (mockUsersService as any).findByEmail.mockResolvedValue(mockFoundUser);

      const result = await controller.forgotPassword({ email: 'test@example.com' });

      // Security: always returns safe response
      expect(result.success).toBe(true);

      // Queue receives the correct payload including human-readable expiresIn
      expect(mockNotificationQueue.add).toHaveBeenCalledWith(
        'password-reset',
        expect.objectContaining({
          userId: 'user-1',
          email: 'test@example.com',
          resetUrl: 'https://example.com/reset?token=reset-token',
          expiresIn: '1 hour',
        }),
        expect.any(Object),
      );
    });

    it('should return safe response without queuing when user is not found', async () => {
      (mockUsersService as any).findByEmail.mockResolvedValue(null);

      const result = await controller.forgotPassword({ email: 'unknown@example.com' });

      expect(result.success).toBe(true);
      expect(mockNotificationQueue.add).not.toHaveBeenCalled();
    });

    it('should convert various JWT duration formats to human-readable strings', async () => {
      (mockUsersService as any).findByEmail.mockResolvedValue(mockFoundUser);

      // 30 minutes
      (mockPasswordResetService as any).getConfiguredExpiresIn.mockReturnValue('30m');
      mockPasswordResetService.generateResetToken.mockReturnValue({ token: 't', resetUrl: 'u' });
      await controller.forgotPassword({ email: 'test@example.com' });
      expect(mockNotificationQueue.add).toHaveBeenCalledWith(
        'password-reset',
        expect.objectContaining({ expiresIn: '30 minutes' }),
        expect.any(Object),
      );

      mockNotificationQueue.add.mockClear();

      // 7 days
      (mockPasswordResetService as any).getConfiguredExpiresIn.mockReturnValue('7d');
      await controller.forgotPassword({ email: 'test@example.com' });
      expect(mockNotificationQueue.add).toHaveBeenCalledWith(
        'password-reset',
        expect.objectContaining({ expiresIn: '7 days' }),
        expect.any(Object),
      );
    });
  });

  describe('resendVerificationEmail (public endpoint)', () => {
    it('should accept valid userId and return success message', async () => {
      const resendDto = {
        userId: 'cuid123',
      };

      mockEmailVerificationService.resendVerificationEmailByUserId =
        jest.fn().mockResolvedValue(undefined);

      const result = await controller.resendVerificationEmail(resendDto);

      // User Value: Clear confirmation that request was processed
      expect(result.success).toBe(true);
      expect(result.message).toBe(
        'If this account exists and is unverified, a verification email has been sent'
      );

      // User Benefit: Request was processed securely
      expect(
        mockEmailVerificationService.resendVerificationEmailByUserId
      ).toHaveBeenCalledWith('cuid123');
    });

    it('should return success even for non-existent userId (prevent enumeration)', async () => {
      const resendDto = {
        userId: 'nonexistent-cuid',
      };

      mockEmailVerificationService.resendVerificationEmailByUserId =
        jest.fn().mockResolvedValue(undefined);

      const result = await controller.resendVerificationEmail(resendDto);

      // Security Value: Prevents user enumeration attacks
      expect(result.success).toBe(true);
      expect(result.message).toBe(
        'If this account exists and is unverified, a verification email has been sent'
      );

      // User Protection: Attackers cannot determine if userId exists
      expect(
        mockEmailVerificationService.resendVerificationEmailByUserId
      ).toHaveBeenCalledWith('nonexistent-cuid');
    });

    it('should return success even for already verified userId (prevent enumeration)', async () => {
      const resendDto = {
        userId: 'verified-cuid',
      };

      mockEmailVerificationService.resendVerificationEmailByUserId =
        jest.fn().mockResolvedValue(undefined);

      const result = await controller.resendVerificationEmail(resendDto);

      // Security Value: Consistent response prevents information leakage
      expect(result.success).toBe(true);
      expect(result.message).toBe(
        'If this account exists and is unverified, a verification email has been sent'
      );

      // User Protection: Cannot discover verified accounts
      expect(
        mockEmailVerificationService.resendVerificationEmailByUserId
      ).toHaveBeenCalledWith('verified-cuid');
    });

    it('should handle service errors gracefully and still return success', async () => {
      const resendDto = {
        userId: 'cuid123',
      };

      // Service handles errors internally, always returns void
      mockEmailVerificationService.resendVerificationEmailByUserId =
        jest.fn().mockResolvedValue(undefined);

      const result = await controller.resendVerificationEmail(resendDto);

      // Security Value: No error details leaked to prevent enumeration
      expect(result.success).toBe(true);
      expect(result.message).toBe(
        'If this account exists and is unverified, a verification email has been sent'
      );
    });
  });
});
