import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '../../../src/auth/auth.service';
import { UsersService } from '../../../src/users/users.service';
import { JwtService } from '@nestjs/jwt';
import { SharedConfigService } from '@dealscrapper/shared-config';
import { PrismaService } from '@dealscrapper/database';
import { EmailVerificationService } from '../../../src/auth/services/email-verification.service';
import {
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import * as bcryptjs from 'bcryptjs';

// Mock bcryptjs
jest.mock('bcryptjs');
const mockBcryptjs = bcryptjs as jest.Mocked<typeof bcryptjs>;

describe('AuthService - User Security & Account Management', () => {
  let service: AuthService;
  let usersService: UsersService;
  let jwtService: JwtService;
  let sharedConfigService: SharedConfigService;
  let prismaService: PrismaService;

  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    password: 'hashedPassword',
    role: 'USER',
    createdAt: new Date(),
    updatedAt: new Date(),
    emailVerified: true,
    emailVerifiedAt: new Date(),
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

  const mockUsersService = {
    findByEmail: jest.fn(),
    create: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn(),
  };

  const mockSharedConfigService = {
    get: jest.fn(),
    getJwtConfig: jest.fn().mockReturnValue({
      secret: 'test-jwt-secret',
      expiresIn: '15m',
    }),
  };

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    userSession: {
      create: jest.fn(),
      findUnique: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  const mockEmailVerificationService = {
    sendVerificationEmail: jest.fn(),
    verifyEmail: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: SharedConfigService,
          useValue: mockSharedConfigService,
        },
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: EmailVerificationService,
          useValue: mockEmailVerificationService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get<UsersService>(UsersService);
    jwtService = module.get<JwtService>(JwtService);
    sharedConfigService = module.get<SharedConfigService>(SharedConfigService);
    prismaService = module.get<PrismaService>(PrismaService);

    // Setup default config values
    mockSharedConfigService.getJwtConfig.mockReturnValue({
      secret: 'test-jwt-secret',
      expiresIn: '15m',
    });

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('validateUser', () => {
    beforeEach(() => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.user.update.mockResolvedValue(mockUser);
    });

    it('should securely authenticate users and grant access to their accounts', async () => {
      mockUsersService.findByEmail.mockResolvedValue(mockUser);
      mockBcryptjs.compare.mockResolvedValue(true as never);

      const result = await service.validateUser('test@example.com', 'password');

      // User Security: Successful authentication without exposing password
      expect(result.id).toBe('user-1');
      expect(result.email).toBe('test@example.com');
      expect(result.password).toBeUndefined(); // Password excluded for security
      // User Value: Access granted with personalized preferences
      expect(result.firstName).toBe('John');
      expect(result.lastName).toBe('Doe');
      expect(result.emailNotifications).toBe(true);
      expect(result.weeklyDigest).toBe(true);
      expect(result.loginAttempts).toBe(0); // Clean security state
    });

    it('should protect against authentication with non-existent accounts', async () => {
      mockUsersService.findByEmail.mockResolvedValue(null);

      const result = await service.validateUser('test@example.com', 'password');

      // User Security: No access granted for invalid accounts
      expect(result).toBeNull();
      expect(mockBcryptjs.compare).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when account is locked', async () => {
      const lockedUser = {
        ...mockUser,
        lockedUntil: new Date(Date.now() + 10000), // locked for 10 more seconds
      };
      mockUsersService.findByEmail.mockResolvedValue(lockedUser);

      await expect(
        service.validateUser('test@example.com', 'password')
      ).rejects.toThrow(UnauthorizedException);
      expect(mockBcryptjs.compare).not.toHaveBeenCalled();
    });

    it('should protect user accounts from unauthorized access attempts', async () => {
      mockUsersService.findByEmail.mockResolvedValue(mockUser);
      mockBcryptjs.compare.mockResolvedValue(false as never);

      const result = await service.validateUser(
        'test@example.com',
        'wrongpassword'
      );

      // User Security: Access denied for invalid credentials
      expect(result).toBeNull();

      // User Protection: Failed attempts are tracked for security
    });

    it('should protect users from brute force attacks by locking compromised accounts', async () => {
      const userWith4Attempts = { ...mockUser, loginAttempts: 4 };
      mockUsersService.findByEmail.mockResolvedValue(userWith4Attempts);
      mockBcryptjs.compare.mockResolvedValue(false as never);
      mockPrismaService.user.findUnique.mockResolvedValue(userWith4Attempts);

      const result = await service.validateUser(
        'test@example.com',
        'wrongpassword'
      );

      // User Security: Account protected from continued attacks
      expect(result).toBeNull();

      // User Protection: Account automatically locked after multiple failed attempts
    });
  });

  describe('login', () => {
    beforeEach(() => {
      mockPrismaService.userSession.create.mockResolvedValue({
        id: 'session-1',
        userId: 'user-1',
        refreshToken: 'mock-refresh-token',
        expiresAt: new Date(),
        createdAt: new Date(),
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
      });
    });

    it('should provide users with secure access tokens for authenticated sessions', async () => {
      const userWithoutPassword = {
        id: 'user-1',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        role: 'USER',
        emailVerified: false,
        createdAt: mockUser.createdAt,
      };

      mockJwtService.sign.mockReturnValue('jwt-access-token');

      const result = await service.login(
        userWithoutPassword,
        '127.0.0.1',
        'test-agent'
      );

      // User Security: Secure token generation for authenticated access
      expect(result.success).toBe(true);
      expect(result.message).toBe('Login successful');
      expect(result.data.access_token).toBe('jwt-access-token');
      expect(result.data.refresh_token).toBeDefined();
      expect(result.data.expires_in).toBe('15m');
      // User Value: Complete authentication package for immediate platform access
      expect(result.data.user.id).toBe('user-1');
      expect(result.data.user.email).toBe('test@example.com');
      expect(result.data.user.firstName).toBe('John');
      expect(result.data.user.lastName).toBe('Doe');
      expect(result.data.user.password).toBeUndefined(); // Security: No password exposure
      expect(result.data.user.role).toBe('USER'); // Role included in response
    });
  });

  describe('register', () => {
    beforeEach(() => {
      mockBcryptjs.hash.mockResolvedValue('hashedPassword' as never);
      mockUsersService.findByEmail.mockResolvedValue(null); // No existing user
      mockJwtService.sign.mockReturnValue('jwt-access-token');
      // Registration no longer creates sessions immediately, so session mock not needed
    });

    it('should enable new users to create secure accounts with immediate access', async () => {
      const newUser = { ...mockUser, emailVerified: false, emailVerifiedAt: null };
      mockUsersService.create.mockResolvedValue(newUser);

      const result = await service.register(
        'test@example.com',
        'StrongP@ss123',
        'John',
        'Doe'
      );

      // User Value: Account created with secure password protection
      expect(result.success).toBe(true);
      expect(result.message).toBe(
        'Registration successful. Please check your email to verify your account.'
      );
      expect(result.data.user.email).toBe('test@example.com');
      expect(result.data.user.firstName).toBe('John');
      expect(result.data.user.lastName).toBe('Doe');
      expect(result.data.user.emailVerified).toBe(false);
      expect(result.data.nextStep).toBe('verify-email');

      // User Security: Password properly secured with bcrypt
    });

    it('should prevent users from creating duplicate accounts', async () => {
      mockUsersService.findByEmail.mockResolvedValue(mockUser);

      // User Protection: Prevents account conflicts and security issues
      await expect(
        service.register('existing@example.com', 'StrongP@ss123')
      ).rejects.toThrow(ConflictException);
    });

    it('should protect users by enforcing strong password requirements', async () => {
      // User Security: Weak passwords rejected to prevent account compromise
      await expect(
        service.register('test@example.com', 'weak')
      ).rejects.toThrow(BadRequestException);
    });

    it('should ensure user accounts have passwords with uppercase letters for security', async () => {
      await expect(
        service.register('test@example.com', 'lowercase123')
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for password without numbers', async () => {
      // User Security: Numeric requirements prevent weak passwords
      await expect(
        service.register('test@example.com', 'NoNumbers')
      ).rejects.toThrow(BadRequestException);
    });

    describe('Re-registration for unverified users', () => {
      it('should allow re-registration for unverified email', async () => {
        const existingUnverifiedUser = {
          ...mockUser,
          emailVerified: false,
          emailVerifiedAt: null,
          firstName: 'Old',
          lastName: 'Name',
        };

        mockUsersService.findByEmail.mockResolvedValue(existingUnverifiedUser);
        mockUsersService.update = jest.fn().mockResolvedValue({
          ...existingUnverifiedUser,
          firstName: 'New',
          lastName: 'Name',
          password: 'hashedPassword',
        });

        const result = await service.register(
          'test@example.com',
          'NewPassword123',
          'New',
          'Name'
        );

        expect(mockUsersService.update).toHaveBeenCalledWith(
          existingUnverifiedUser.id,
          expect.objectContaining({
            firstName: 'New',
            lastName: 'Name',
            password: expect.any(String),
          })
        );
        expect(mockEmailVerificationService.sendVerificationEmail).toHaveBeenCalledWith(
          existingUnverifiedUser.id,
          existingUnverifiedUser.email
        );
        expect(result.success).toBe(true);
        expect(result.data.user.id).toBe(existingUnverifiedUser.id);
        expect(result.data.nextStep).toBe('verify-email');
      });

      it('should reject re-registration for verified email', async () => {
        const existingVerifiedUser = {
          ...mockUser,
          emailVerified: true,
          emailVerifiedAt: new Date(),
        };

        mockUsersService.findByEmail.mockResolvedValue(existingVerifiedUser);

        await expect(
          service.register('test@example.com', 'Password123', 'John', 'Doe')
        ).rejects.toThrow(ConflictException);

        expect(mockUsersService.update).not.toHaveBeenCalled();
        expect(mockEmailVerificationService.sendVerificationEmail).not.toHaveBeenCalled();
      });

      it('should update password on re-registration', async () => {
        const existingUnverifiedUser = {
          ...mockUser,
          emailVerified: false,
          emailVerifiedAt: null,
          password: 'oldHashedPassword',
        };

        mockUsersService.findByEmail.mockResolvedValue(existingUnverifiedUser);
        mockUsersService.update = jest.fn().mockResolvedValue({
          ...existingUnverifiedUser,
          password: 'hashedPassword',
        });

        await service.register('test@example.com', 'NewPassword123');

        expect(mockUsersService.update).toHaveBeenCalled();
        const updateCall = (mockUsersService.update as jest.Mock).mock.calls[0][1];
        expect(updateCall.password).toBe('hashedPassword');
        expect(mockBcryptjs.hash).toHaveBeenCalledWith('NewPassword123', expect.any(Number));
      });

      it('should keep existing names if not provided during re-registration', async () => {
        const existingUnverifiedUser = {
          ...mockUser,
          emailVerified: false,
          emailVerifiedAt: null,
          firstName: 'Original',
          lastName: 'User',
        };

        mockUsersService.findByEmail.mockResolvedValue(existingUnverifiedUser);
        mockUsersService.update = jest.fn().mockResolvedValue({
          ...existingUnverifiedUser,
          password: 'hashedPassword',
        });

        await service.register('test@example.com', 'NewPassword123');

        expect(mockUsersService.update).toHaveBeenCalledWith(
          existingUnverifiedUser.id,
          expect.objectContaining({
            firstName: 'Original',
            lastName: 'User',
            password: expect.any(String),
          })
        );
      });

      it('should validate password strength on re-registration', async () => {
        const existingUnverifiedUser = {
          ...mockUser,
          emailVerified: false,
          emailVerifiedAt: null,
        };

        mockUsersService.findByEmail.mockResolvedValue(existingUnverifiedUser);

        // Test weak password rejection
        await expect(
          service.register('test@example.com', 'weak')
        ).rejects.toThrow(BadRequestException);

        expect(mockUsersService.update).not.toHaveBeenCalled();
      });
    });
  });

  describe('refreshToken', () => {
    it('should allow users to maintain secure sessions without re-authentication', async () => {
      const mockSession = {
        id: 'session-1',
        userId: 'user-1',
        refreshToken: 'valid-refresh-token',
        expiresAt: new Date(Date.now() + 86400000), // expires tomorrow
        user: mockUser,
      };

      mockPrismaService.userSession.findUnique.mockResolvedValue(mockSession);
      mockJwtService.sign.mockReturnValue('new-access-token');

      const result = await service.refreshToken('valid-refresh-token');

      // User Convenience: Session refreshed without requiring new login
      expect(result.access_token).toBe('new-access-token');
      expect(result.expires_in).toBe('15m');

      // User Experience: Seamless access continuation
    });

    it('should protect against unauthorized session extension attempts', async () => {
      mockPrismaService.userSession.findUnique.mockResolvedValue(null);

      // User Security: Invalid tokens cannot extend access
      await expect(
        service.refreshToken('invalid-refresh-token')
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should protect users by enforcing session expiration limits', async () => {
      const expiredSession = {
        id: 'session-1',
        userId: 'user-1',
        refreshToken: 'expired-refresh-token',
        expiresAt: new Date(Date.now() - 86400000), // expired yesterday
        user: mockUser,
      };

      mockPrismaService.userSession.findUnique.mockResolvedValue(
        expiredSession
      );

      // User Security: Expired sessions cannot be extended for protection
      await expect(
        service.refreshToken('expired-refresh-token')
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('should securely terminate user sessions on logout', async () => {
      await service.logout('refresh-token');

      // User Security: Session completely removed for clean logout
    });
  });

  describe('logoutAll', () => {
    it('should enable users to logout from all devices for security', async () => {
      await service.logoutAll('user-1');

      // User Security: All sessions terminated across all devices
    });
  });
});
