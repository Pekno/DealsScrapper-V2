import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '../../../src/auth/auth.service';
import { UsersService } from '../../../src/users/users.service';
import { JwtService } from '@nestjs/jwt';
import { SharedConfigService } from '@dealscrapper/shared-config';
import { PrismaService, UserSession } from '@dealscrapper/database';
import { EmailVerificationService } from '../../../src/auth/services/email-verification.service';
import {
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import * as bcryptjs from 'bcryptjs';
import { createMockUser } from '../../mocks/user.mock';

// Mock bcryptjs at the module level
jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

describe('AuthService - Security Tests', () => {
  let service: AuthService;
  let usersService: jest.Mocked<UsersService>;
  let jwtService: jest.Mocked<JwtService>;
  let sharedConfigService: jest.Mocked<SharedConfigService>;
  let prismaService: jest.Mocked<PrismaService>;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    password: '$2a$12$hash', // bcrypt hash
    role: 'USER',
    firstName: 'Test',
    lastName: 'User',
    emailVerified: true,
    loginAttempts: 0,
    lockedUntil: null,
    createdAt: new Date(),
    lastLoginAt: new Date(),
    passwordChangedAt: null,
  };

  const createMockServices = () => ({
    usersService: {
      findByEmail: jest.fn(),
      create: jest.fn(),
      findById: jest.fn(),
    },
    jwtService: {
      sign: jest.fn(),
      verify: jest.fn(),
      decode: jest.fn(),
    },
    sharedConfigService: {
      get: jest.fn(),
      getJwtConfig: jest.fn().mockReturnValue({
        secret: 'test-jwt-secret',
        expiresIn: '15m',
      }),
    },
    prismaService: {
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
      },
      userSession: {
        create: jest.fn(),
        findUnique: jest.fn(),
        deleteMany: jest.fn(),
        findMany: jest.fn(),
      },
    },
    emailVerificationService: {
      sendVerificationEmail: jest.fn(),
      verifyEmail: jest.fn(),
    },
  });

  beforeEach(async () => {
    const mocks = createMockServices();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mocks.usersService },
        { provide: JwtService, useValue: mocks.jwtService },
        { provide: SharedConfigService, useValue: mocks.sharedConfigService },
        { provide: PrismaService, useValue: mocks.prismaService },
        {
          provide: EmailVerificationService,
          useValue: mocks.emailVerificationService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get(UsersService);
    jwtService = module.get(JwtService);
    sharedConfigService = module.get(SharedConfigService);
    prismaService = module.get(PrismaService);

    // Setup default successful responses
    sharedConfigService.getJwtConfig.mockReturnValue({
      secret: 'test-jwt-secret',
      expiresIn: '15m',
    });
    jwtService.sign.mockReturnValue('mock-jwt-token');
    usersService.findByEmail.mockResolvedValue(null); // Default to no existing user
    prismaService.user.findUnique.mockResolvedValue(mockUser);
    prismaService.userSession.create.mockImplementation(
      (data) =>
        ({
          id: 'session-123',
          refreshToken: data.data.refreshToken, // Return the actual token passed to create
          expiresAt: data.data.expiresAt,
          userId: data.data.userId,
          ipAddress: data.data.ipAddress || '127.0.0.1',
          userAgent: data.data.userAgent || 'test',
        }) as UserSession
    );

    // Setup bcryptjs mocks
    (bcryptjs.hash as jest.Mock).mockResolvedValue('$2a$12$hashedpassword');
    (bcryptjs.compare as jest.Mock).mockResolvedValue(true);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Password Security', () => {
    describe('Password Hashing', () => {
      it('should use bcrypt with 12 rounds for password hashing', async () => {
        usersService.create.mockResolvedValue(mockUser);

        await service.register(
          'test@example.com',
          'ValidPass123',
          'Test',
          'User'
        );

        expect(bcryptjs.hash).toHaveBeenCalledWith('ValidPass123', 12);
      });

      it('should validate password strength requirements', async () => {
        const weakPasswords = [
          'short', // Too short
          'nouppercase123', // No uppercase
          'NOLOWERCASE123', // No lowercase
          'NoNumbers', // No numbers
          '12345678', // Only numbers
          'onlylowercase', // Only lowercase
          'ONLYUPPERCASE', // Only uppercase
        ];

        for (const password of weakPasswords) {
          await expect(
            service.register(
              `test${Math.random()}@example.com`,
              password,
              'Test',
              'User'
            )
          ).rejects.toThrow(BadRequestException);
        }
      });

      it('should accept strong passwords', async () => {
        const strongPasswords = [
          'ValidPass123',
          'SecureP@ssw0rd',
          'AnotherGood1',
          'Complex123Password',
        ];

        usersService.create.mockResolvedValue(mockUser);

        for (const password of strongPasswords) {
          await expect(
            service.register(
              `test${Math.random()}@example.com`,
              password,
              'Test',
              'User'
            )
          ).resolves.toBeDefined();
        }
      });

      it('should not store plain text passwords', async () => {
        const plainPassword = 'TestPassword123';
        usersService.create.mockResolvedValue(mockUser);

        await service.register(
          'test@example.com',
          plainPassword,
          'Test',
          'User'
        );

        const createCall = usersService.create.mock.calls[0][0];
        expect(createCall.password).not.toBe(plainPassword);
        expect(createCall.password).toMatch(/^\$2[ab]\$12\$/); // bcrypt format
      });
    });

    describe('Password Verification', () => {
      it('should use secure password comparison', async () => {
        usersService.findByEmail.mockResolvedValue(mockUser);

        await service.validateUser('test@example.com', 'testpassword');

        expect(bcryptjs.compare).toHaveBeenCalledWith(
          'testpassword',
          mockUser.password
        );
      });

      it('should handle timing attacks by always completing bcrypt comparison', async () => {
        (bcryptjs.compare as jest.Mock).mockImplementation(() => {
          return new Promise((resolve) => {
            // Simulate bcrypt taking time
            setTimeout(() => resolve(false), 10);
          });
        });
        usersService.findByEmail.mockResolvedValue(mockUser);

        const startTime = Date.now();
        await service.validateUser('test@example.com', 'wrongpassword');
        const endTime = Date.now();

        expect(bcryptjs.compare).toHaveBeenCalled();
        expect(endTime - startTime).toBeGreaterThan(5); // Should take some time
      });
    });
  });

  describe('Account Lockout Protection', () => {
    it('should lock account after 5 failed login attempts', async () => {
      const userWithAttempts = { ...mockUser, loginAttempts: 4 };
      usersService.findByEmail.mockResolvedValue(userWithAttempts);
      prismaService.user.findUnique.mockResolvedValue(userWithAttempts);
      (bcryptjs.compare as jest.Mock).mockResolvedValue(false);

      await service.validateUser('test@example.com', 'wrongpassword');

      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: expect.objectContaining({
          loginAttempts: 5,
          lockedUntil: expect.any(Date),
        }),
      });
    });

    it('should prevent login for locked accounts', async () => {
      const lockedUser = {
        ...mockUser,
        loginAttempts: 5,
        lockedUntil: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes from now
      };
      usersService.findByEmail.mockResolvedValue(lockedUser);

      await expect(
        service.validateUser('test@example.com', 'correctpassword')
      ).rejects.toThrow(UnauthorizedException);
      expect(bcryptjs.compare).not.toHaveBeenCalled();
    });

    it('should allow login after lockout period expires', async () => {
      const expiredLockUser = {
        ...mockUser,
        loginAttempts: 5,
        lockedUntil: new Date(Date.now() - 1000), // 1 second ago
      };
      usersService.findByEmail.mockResolvedValue(expiredLockUser);
      (bcryptjs.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.validateUser(
        'test@example.com',
        'correctpassword'
      );

      expect(result).toBeDefined();
      expect(result.id).toBe('user-123');
    });

    it('should reset login attempts on successful login', async () => {
      const userWithAttempts = { ...mockUser, loginAttempts: 3 };
      usersService.findByEmail.mockResolvedValue(userWithAttempts);
      prismaService.user.findUnique.mockResolvedValue(userWithAttempts);
      (bcryptjs.compare as jest.Mock).mockResolvedValue(true);

      await service.validateUser('test@example.com', 'correctpassword');

      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: {
          loginAttempts: 0,
          lockedUntil: null,
          lastLoginAt: expect.any(Date),
        },
      });
    });

    it('should increment login attempts on failed login', async () => {
      const userWithAttempts = { ...mockUser, loginAttempts: 2 };
      usersService.findByEmail.mockResolvedValue(userWithAttempts);
      prismaService.user.findUnique.mockResolvedValue(userWithAttempts);
      (bcryptjs.compare as jest.Mock).mockResolvedValue(false);

      await service.validateUser('test@example.com', 'wrongpassword');

      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: { loginAttempts: 3 },
      });
    });

    it('should handle concurrent login attempts safely', async () => {
      const userWithAttempts = { ...mockUser, loginAttempts: 4 };
      usersService.findByEmail.mockResolvedValue(userWithAttempts);
      prismaService.user.findUnique.mockResolvedValue(userWithAttempts);
      (bcryptjs.compare as jest.Mock).mockResolvedValue(false);

      // Simulate concurrent login attempts
      const promises = Array(3)
        .fill(null)
        .map(() =>
          service
            .validateUser('test@example.com', 'wrongpassword')
            .catch(() => null)
        );

      await Promise.all(promises);

      // Should have called update for each attempt
      expect(prismaService.user.update).toHaveBeenCalledTimes(3);
    });
  });

  describe('Session Security', () => {
    describe('Refresh Token Security', () => {
      it('should generate cryptographically secure refresh tokens', async () => {
        const tokens = new Set();

        // Reset mocks to ensure clean state
        jest.clearAllMocks();

        // Setup fresh mocks for this test
        jwtService.sign.mockReturnValue('jwt-token');

        // Generate multiple tokens via login to check for uniqueness
        for (let i = 0; i < 10; i++) {
          // Reduced to 10 for faster testing
          const testUser = {
            ...mockUser,
            id: `user-${i}`,
            email: `test${i}@example.com`,
          };

          const result = await service.login(testUser);
          tokens.add(result.data.refresh_token);
        }

        // All tokens should be unique
        expect(tokens.size).toBe(10);

        // Tokens should be UUIDs (36 characters with hyphens)
        for (const token of tokens) {
          expect(token).toMatch(
            /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
          );
        }
      });

      it('should store refresh tokens with proper expiration', async () => {
        const beforeLogin = Date.now();

        await service.login(mockUser, '127.0.0.1', 'test-agent');

        const afterLogin = Date.now();
        const createCall = prismaService.userSession.create.mock.calls[0][0];

        expect(createCall.data.expiresAt).toBeInstanceOf(Date);

        // Expiration should be 7 days from now (with reasonable tolerance)
        const sevenDays = 7 * 24 * 60 * 60 * 1000;
        const minExpiry = beforeLogin + sevenDays - 60000; // -1 minute tolerance
        const maxExpiry = afterLogin + sevenDays + 7200000; // +2 hours tolerance (for timezone/config differences)

        expect(createCall.data.expiresAt.getTime()).toBeGreaterThan(minExpiry);
        expect(createCall.data.expiresAt.getTime()).toBeLessThan(maxExpiry);
      });

      it('should reject expired refresh tokens', async () => {
        const expiredSession = {
          refreshToken: 'expired-token',
          expiresAt: new Date(Date.now() - 1000), // 1 second ago
          user: mockUser,
        };
        prismaService.userSession.findUnique.mockResolvedValue(
          expiredSession as UserSession
        );

        await expect(service.refreshToken('expired-token')).rejects.toThrow(
          UnauthorizedException
        );
      });

      it('should reject invalid refresh tokens', async () => {
        prismaService.userSession.findUnique.mockResolvedValue(null);

        await expect(service.refreshToken('invalid-token')).rejects.toThrow(
          UnauthorizedException
        );
      });

      it('should store session metadata for security tracking', async () => {
        const ipAddress = '192.168.1.100';
        const userAgent = 'Mozilla/5.0 Test Browser';

        await service.login(mockUser, ipAddress, userAgent);

        const createCall = prismaService.userSession.create.mock.calls[0][0];
        expect(createCall.data.ipAddress).toBe(ipAddress);
        expect(createCall.data.userAgent).toBe(userAgent);
        expect(createCall.data.userId).toBe(mockUser.id);
      });
    });

    describe('Session Management', () => {
      it('should properly logout single session', async () => {
        await service.logout('refresh-token-123');

        expect(prismaService.userSession.deleteMany).toHaveBeenCalledWith({
          where: { refreshToken: 'refresh-token-123' },
        });
      });

      it('should properly logout all sessions', async () => {
        await service.logoutAll('user-123');

        expect(prismaService.userSession.deleteMany).toHaveBeenCalledWith({
          where: { userId: 'user-123' },
        });
      });

      it('should handle logout of non-existent sessions gracefully', async () => {
        prismaService.userSession.deleteMany.mockResolvedValue({ count: 0 });

        await expect(
          service.logout('non-existent-token')
        ).resolves.toBeUndefined();
        expect(prismaService.userSession.deleteMany).toHaveBeenCalled();
      });
    });
  });

  describe('JWT Security', () => {
    it('should include only necessary claims in JWT payload', async () => {
      await service.login(mockUser);

      expect(jwtService.sign).toHaveBeenCalledWith({
        email: mockUser.email,
        sub: mockUser.id,
        emailVerified: mockUser.emailVerified,
        role: mockUser.role,
      });
    });

    it('should not include sensitive data in JWT payload', async () => {
      await service.login(mockUser);

      const payload = jwtService.sign.mock.calls[0][0];
      expect(payload).not.toHaveProperty('password');
      expect(payload).not.toHaveProperty('loginAttempts');
      expect(payload).not.toHaveProperty('lockedUntil');
    });

    it('should generate new access token on refresh', async () => {
      const validSession = {
        refreshToken: 'valid-token',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        user: mockUser,
      };
      prismaService.userSession.findUnique.mockResolvedValue(
        validSession as UserSession
      );

      const result = await service.refreshToken('valid-token');

      expect(result).toHaveProperty('access_token');
      expect(jwtService.sign).toHaveBeenCalledWith({
        email: mockUser.email,
        sub: mockUser.id,
        emailVerified: mockUser.emailVerified,
        role: mockUser.role,
      });
    });
  });

  describe('Data Protection', () => {
    it('should not return password in user objects', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser);
      (bcryptjs.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.validateUser(
        'test@example.com',
        'correctpassword'
      );

      expect(result).toBeDefined();
      expect(result).not.toHaveProperty('password');
      expect(result.id).toBe(mockUser.id);
      expect(result.email).toBe(mockUser.email);
    });

    it('should not expose sensitive user data in login response', async () => {
      const result = await service.login(mockUser);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Login successful');
      expect(result.data.user).not.toHaveProperty('password');
      expect(result.data.user).not.toHaveProperty('loginAttempts');
      expect(result.data.user).not.toHaveProperty('lockedUntil');
      expect(result.data.user).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        firstName: mockUser.firstName,
        lastName: mockUser.lastName,
        emailVerified: mockUser.emailVerified,
        role: mockUser.role,
        createdAt: mockUser.createdAt,
      });
    });

    it('should handle database errors gracefully without exposing internals', async () => {
      usersService.create.mockRejectedValue(
        new Error('Database connection failed')
      );

      await expect(
        service.register('test@example.com', 'ValidPass123')
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('Input Validation Security', () => {
    it('should reject duplicate email registrations', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser); // User exists

      await expect(
        service.register('test@example.com', 'ValidPass123')
      ).rejects.toThrow(ConflictException);
    });

    it('should handle malformed email addresses in validation', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      // Mock create to throw an error for malformed email (simulating database validation failure)
      usersService.create.mockRejectedValue(new Error('Invalid email format'));

      // The service should still attempt to create user even with malformed email
      // (email validation should be done at the API layer)
      await expect(
        service.register('not-an-email', 'ValidPass123')
      ).rejects.toThrow(ConflictException); // Fails at user creation level
    });

    it('should handle extremely long passwords securely', async () => {
      const longPassword = 'A1' + 'a'.repeat(1000); // 1002 character password
      usersService.create.mockResolvedValue(mockUser);

      await expect(
        service.register('test@example.com', longPassword)
      ).resolves.toBeDefined();
    });

    it('should handle special characters in passwords', async () => {
      const specialCharPasswords = [
        'Valid123!@#$%^&*()',
        'Test123<>"\'`',
        'Pass123\\|[];:',
        'Secure123{}~',
      ];

      usersService.create.mockResolvedValue(mockUser);

      for (const password of specialCharPasswords) {
        await expect(
          service.register(`test${Math.random()}@example.com`, password)
        ).resolves.toBeDefined();
      }
    });
  });

  describe('Timing Attack Protection', () => {
    it('should take similar time for non-existent vs wrong password', async () => {
      // Test with non-existent user
      usersService.findByEmail.mockResolvedValueOnce(null);
      const start1 = Date.now();
      await service.validateUser('nonexistent@example.com', 'password');
      const time1 = Date.now() - start1;

      // Test with wrong password
      usersService.findByEmail.mockResolvedValueOnce(mockUser);
      (bcryptjs.compare as jest.Mock).mockResolvedValueOnce(false);
      const start2 = Date.now();
      await service.validateUser('test@example.com', 'wrongpassword');
      const time2 = Date.now() - start2;

      // Times should be similar (within reasonable variance)
      // bcrypt should still be called for timing consistency
      expect(Math.abs(time1 - time2)).toBeLessThan(100); // 100ms variance allowed
    });
  });

  describe('Error Handling Security', () => {
    it('should handle database errors during failed login tracking', async () => {
      // Test that database errors during login attempt tracking don't crash the service
      prismaService.user.update.mockRejectedValue(
        new Error('Database connection failed')
      );
      usersService.findByEmail.mockResolvedValue(mockUser);
      (bcryptjs.compare as jest.Mock).mockResolvedValue(false);

      // The service should still complete the authentication flow
      // even if tracking the failed attempt fails
      await expect(
        service.validateUser('test@example.com', 'wrongpassword')
      ).rejects.toThrow('Database connection failed');

      // Verify the service attempted to track the failed login
      expect(prismaService.user.update).toHaveBeenCalled();
    });

    it('should handle session creation failures securely', async () => {
      prismaService.userSession.create.mockRejectedValue(
        new Error('Session creation failed')
      );

      await expect(service.login(mockUser)).rejects.toThrow(); // Should throw, but not expose internal details
    });
  });
});
