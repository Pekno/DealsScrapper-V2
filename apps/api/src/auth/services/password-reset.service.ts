import { Injectable, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcryptjs from 'bcryptjs';
import { SharedConfigService } from '@dealscrapper/shared-config';
import { UsersService } from '../../users/users.service.js';
import { extractErrorMessage } from '@dealscrapper/shared';
import { createServiceLogger } from '@dealscrapper/shared-logging';
import { apiLogConfig } from '../../config/logging.config.js';

const BCRYPT_ROUNDS = 12;

/**
 * JWT payload structure for password reset tokens
 */
export interface PasswordResetTokenPayload {
  readonly userId: string;
  readonly email: string;
  readonly purpose: 'password-reset';
  readonly iat?: number;
  readonly exp?: number;
}

/**
 * Result of password reset token validation
 */
export interface PasswordResetTokenResult {
  readonly userId: string;
  readonly email: string;
}

/**
 * Service responsible for the password reset workflow using one-time JWT tokens.
 * Tokens are single-use: once the password is changed, passwordChangedAt is set
 * and any submission with an older token is rejected.
 */
@Injectable()
export class PasswordResetService {
  private readonly logger = createServiceLogger(apiLogConfig);
  private readonly passwordResetSecret: string;
  private readonly passwordResetExpiresIn: string;
  private readonly webAppUrl: string;

  constructor(
    private readonly jwtService: JwtService,
    private readonly sharedConfig: SharedConfigService,
    private readonly usersService: UsersService,
  ) {
    this.passwordResetSecret = this.sharedConfig.get<string>('PASSWORD_RESET_SECRET');
    this.passwordResetExpiresIn =
      this.sharedConfig.get<string>('PASSWORD_RESET_EXPIRES_IN') ?? '30m';
    this.webAppUrl = this.sharedConfig.get<string>('WEB_APP_URL');
  }

  /**
   * Returns the configured password reset token lifetime in JWT shorthand format (e.g. "1h", "30m").
   */
  getConfiguredExpiresIn(): string {
    return this.passwordResetExpiresIn;
  }

  /**
   * Generates a signed JWT reset token and the corresponding reset URL.
   * @param userId - Unique identifier of the user
   * @param email - Email address of the user
   * @param expiresIn - Token lifetime (default: value from env, typically '30m')
   * @returns Signed token and full reset URL
   */
  generateResetToken(
    userId: string,
    email: string,
    expiresIn = this.passwordResetExpiresIn,
  ): { token: string; resetUrl: string } {
    const payload: PasswordResetTokenPayload = {
      userId,
      email,
      purpose: 'password-reset',
    };

    const token = this.jwtService.sign(payload, {
      secret: this.passwordResetSecret,
      expiresIn,
    });

    const resetUrl = this.buildResetUrl(token);
    return { token, resetUrl };
  }

  /**
   * Validates a password reset token and ensures it has not already been used.
   * @param token - JWT token from the reset URL
   * @returns Validated user identifiers
   * @throws BadRequestException if token is invalid, expired, or already used
   */
  async validateResetToken(token: string): Promise<PasswordResetTokenResult> {
    let decoded: PasswordResetTokenPayload;

    try {
      decoded = this.jwtService.verify<PasswordResetTokenPayload>(token, {
        secret: this.passwordResetSecret,
      });
    } catch (error) {
      this.logger.warn(
        `Invalid password reset token attempted: ${extractErrorMessage(error)}`,
      );
      throw new BadRequestException('Invalid or expired reset token');
    }

    if (decoded.purpose !== 'password-reset') {
      throw new BadRequestException('Invalid reset token purpose');
    }

    const user = await this.usersService.findById(decoded.userId);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Reject if the token was issued before the last password change (already used)
    if (
      user.passwordChangedAt &&
      decoded.iat !== undefined &&
      user.passwordChangedAt.getTime() / 1000 > decoded.iat
    ) {
      throw new BadRequestException('Reset link has already been used');
    }

    return { userId: decoded.userId, email: decoded.email };
  }

  /**
   * Resets the user's password using a valid reset token.
   * Sets passwordChangedAt to invalidate any further submissions with the same token.
   * @param token - JWT reset token
   * @param newPassword - The new plaintext password (will be hashed)
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    const { userId } = await this.validateResetToken(token);

    const rounds = this.sharedConfig.get<string>('BCRYPT_ROUNDS');
    const hashedPassword = await bcryptjs.hash(
      newPassword,
      parseInt(rounds, 10) || BCRYPT_ROUNDS,
    );

    await this.usersService.update(userId, {
      password: hashedPassword,
      passwordChangedAt: new Date(),
    });

    this.logger.log(`Password reset completed for user ${userId}`);
  }

  /**
   * Constructs the complete password reset URL for email templates.
   * @param token - JWT reset token
   * @returns Full reset URL with encoded token
   */
  private buildResetUrl(token: string): string {
    const baseUrl = this.webAppUrl.endsWith('/')
      ? this.webAppUrl.slice(0, -1)
      : this.webAppUrl;

    return `${baseUrl}/auth/reset-password?token=${encodeURIComponent(token)}`;
  }
}
