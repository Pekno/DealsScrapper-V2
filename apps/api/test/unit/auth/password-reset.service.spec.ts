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
import { BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PasswordResetService } from '../../../src/auth/services/password-reset.service';
import { UsersService } from '../../../src/users/users.service';
import { SharedConfigService } from '@dealscrapper/shared-config';

describe('PasswordResetService', () => {
  let service: PasswordResetService;
  let jwtService: jest.Mocked<JwtService>;
  let usersService: jest.Mocked<UsersService>;
  let sharedConfigService: jest.Mocked<SharedConfigService>;

  const mockUser = {
    id: 'user-1',
    email: 'user@example.com',
    password: 'hashed',
    passwordChangedAt: null as Date | null,
  };

  const mockJwtService = {
    sign: jest.fn(),
    verify: jest.fn(),
  };

  const mockUsersService = {
    findById: jest.fn(),
    update: jest.fn(),
  };

  const CONFIG_MAP: Record<string, string> = {
    PASSWORD_RESET_SECRET: 'test-password-reset-secret',
    PASSWORD_RESET_EXPIRES_IN: '30m',
    WEB_APP_URL: 'http://localhost:3000',
    BCRYPT_ROUNDS: '12',
  };

  const mockSharedConfigService = {
    get: jest.fn((key: string) => CONFIG_MAP[key]),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockSharedConfigService.get.mockImplementation((key: string) => CONFIG_MAP[key] ?? undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PasswordResetService,
        { provide: JwtService, useValue: mockJwtService },
        { provide: UsersService, useValue: mockUsersService },
        { provide: SharedConfigService, useValue: mockSharedConfigService },
      ],
    }).compile();

    service = module.get<PasswordResetService>(PasswordResetService);
    jwtService = module.get(JwtService);
    usersService = module.get(UsersService);
    sharedConfigService = module.get(SharedConfigService);
  });

  describe('generateResetToken', () => {
    it('should return a signed JWT token and a correct reset URL', () => {
      mockJwtService.sign.mockReturnValue('signed-jwt-token');

      const result = service.generateResetToken('user-1', 'user@example.com');

      expect(mockJwtService.sign).toHaveBeenCalledWith(
        { userId: 'user-1', email: 'user@example.com', purpose: 'password-reset' },
        expect.objectContaining({ secret: 'test-password-reset-secret' }),
      );
      expect(result.token).toBe('signed-jwt-token');
      expect(result.resetUrl).toContain('/auth/reset-password?token=');
      expect(result.resetUrl).toContain('signed-jwt-token');
    });

    it('should use custom expiresIn when provided', () => {
      mockJwtService.sign.mockReturnValue('signed-jwt-token');

      service.generateResetToken('user-1', 'user@example.com', '24h');

      expect(mockJwtService.sign).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ expiresIn: '24h' }),
      );
    });
  });

  describe('validateResetToken', () => {
    it('should throw BadRequestException for an expired or invalid token', async () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('jwt expired');
      });

      await expect(service.validateResetToken('bad-token')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.validateResetToken('bad-token')).rejects.toThrow(
        'Invalid or expired reset token',
      );
    });

    it('should throw BadRequestException for wrong purpose', async () => {
      mockJwtService.verify.mockReturnValue({
        userId: 'user-1',
        email: 'user@example.com',
        purpose: 'email-verification',
        iat: Math.floor(Date.now() / 1000),
      });

      await expect(service.validateResetToken('bad-purpose-token')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.validateResetToken('bad-purpose-token')).rejects.toThrow(
        'Invalid reset token purpose',
      );
    });

    it('should throw "Reset link has already been used" when passwordChangedAt is after token iat', async () => {
      const iatSeconds = Math.floor(Date.now() / 1000) - 60; // issued 60s ago
      const passwordChangedAt = new Date((iatSeconds + 30) * 1000); // changed 30s after token was issued

      mockJwtService.verify.mockReturnValue({
        userId: 'user-1',
        email: 'user@example.com',
        purpose: 'password-reset',
        iat: iatSeconds,
      });
      mockUsersService.findById.mockResolvedValue({ ...mockUser, passwordChangedAt });

      await expect(service.validateResetToken('used-token')).rejects.toThrow(
        'Reset link has already been used',
      );
    });

    it('should return userId and email for a valid, unused token', async () => {
      const iatSeconds = Math.floor(Date.now() / 1000);

      mockJwtService.verify.mockReturnValue({
        userId: 'user-1',
        email: 'user@example.com',
        purpose: 'password-reset',
        iat: iatSeconds,
      });
      mockUsersService.findById.mockResolvedValue({ ...mockUser, passwordChangedAt: null });

      const result = await service.validateResetToken('valid-token');

      expect(result).toEqual({ userId: 'user-1', email: 'user@example.com' });
    });

    it('should accept token when passwordChangedAt is null (never changed)', async () => {
      mockJwtService.verify.mockReturnValue({
        userId: 'user-1',
        email: 'user@example.com',
        purpose: 'password-reset',
        iat: Math.floor(Date.now() / 1000),
      });
      mockUsersService.findById.mockResolvedValue({ ...mockUser, passwordChangedAt: null });

      const result = await service.validateResetToken('valid-token');

      expect(result.userId).toBe('user-1');
    });
  });

  describe('resetPassword', () => {
    it('should hash the new password and set passwordChangedAt on the user', async () => {
      const iatSeconds = Math.floor(Date.now() / 1000);

      mockJwtService.verify.mockReturnValue({
        userId: 'user-1',
        email: 'user@example.com',
        purpose: 'password-reset',
        iat: iatSeconds,
      });
      mockUsersService.findById.mockResolvedValue({ ...mockUser, passwordChangedAt: null });
      mockUsersService.update.mockResolvedValue(mockUser as never);

      await service.resetPassword('valid-token', 'NewPassword1!');

      expect(mockUsersService.update).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          password: expect.stringMatching(/^\$2[ab]\$/),
          passwordChangedAt: expect.any(Date),
        }),
      );
    });

    it('should propagate BadRequestException from validateResetToken', async () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('jwt expired');
      });

      await expect(
        service.resetPassword('expired-token', 'NewPassword1!'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
