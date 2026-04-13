import { Injectable, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { SharedConfigService } from '@dealscrapper/shared-config';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import {
  NotificationPriority,
  QUEUE_PRIORITIES,
} from '@dealscrapper/shared-types';
import { UsersService } from '../../users/users.service.js';
import { extractErrorMessage } from '@dealscrapper/shared';
import { createServiceLogger } from '@dealscrapper/shared-logging';
import { apiLogConfig } from '../../config/logging.config.js';

/**
 * JWT payload structure for email verification tokens
 */
export interface EmailVerificationTokenPayload {
  readonly userId: string;
  readonly email: string;
  readonly purpose: 'email-verification';
  readonly iat?: number;
  readonly exp?: number;
}

/**
 * Redis queue payload for email verification notifications
 */
export interface EmailVerificationQueuePayload {
  readonly userId: string;
  readonly email: string;
  readonly token: string;
  readonly verificationUrl: string;
  readonly type: 'verification';
  readonly timestamp: Date;
}

/**
 * Result of email verification token validation
 */
export interface EmailVerificationResult {
  readonly userId: string;
  readonly email: string;
  readonly success: boolean;
}

/**
 * Service responsible for email verification workflow using JWT tokens
 * Handles token generation, validation, and notification queuing
 */
@Injectable()
export class EmailVerificationService {
  private readonly logger = createServiceLogger(apiLogConfig);
  private readonly emailVerificationSecret: string;
  private readonly emailVerificationExpiresIn: string;
  private readonly webAppUrl: string;

  constructor(
    private readonly jwtService: JwtService,
    private readonly sharedConfig: SharedConfigService,
    private readonly usersService: UsersService,
    @InjectQueue('notifications') private readonly notificationQueue: Queue
  ) {
    this.emailVerificationSecret = this.sharedConfig.get<string>(
      'EMAIL_VERIFICATION_SECRET'
    );
    this.emailVerificationExpiresIn = this.sharedConfig.get<string>(
      'EMAIL_VERIFICATION_EXPIRES_IN'
    );
    this.webAppUrl = this.sharedConfig.get<string>('WEB_APP_URL');
  }

  /**
   * Generates a secure JWT token for email verification
   * @param userId - Unique identifier of the user
   * @param email - Email address to verify
   * @returns Signed JWT token for verification
   */
  generateVerificationToken(userId: string, email: string): string {
    const payload: EmailVerificationTokenPayload = {
      userId,
      email,
      purpose: 'email-verification',
    };

    return this.jwtService.sign(payload, {
      secret: this.emailVerificationSecret,
      expiresIn: this.emailVerificationExpiresIn,
    });
  }

  /**
   * Validates and decodes an email verification JWT token
   * @param token - JWT token to validate
   * @returns Decoded token payload with user information
   * @throws BadRequestException if token is invalid or expired
   */
  verifyEmailToken(token: string): EmailVerificationTokenPayload {
    try {
      const decoded = this.jwtService.verify<EmailVerificationTokenPayload>(
        token,
        {
          secret: this.emailVerificationSecret,
        }
      );

      // Validate token purpose for security
      if (decoded.purpose !== 'email-verification') {
        throw new BadRequestException('Invalid verification token purpose');
      }

      return decoded;
    } catch (error) {
      this.logger.warn(
        `Invalid verification token attempted: ${extractErrorMessage(error)}`
      );
      throw new BadRequestException('Invalid or expired verification token');
    }
  }

  /**
   * Queues an email verification notification for delivery
   * This method handles both initial verification and resend requests
   * @param userId - Unique identifier of the user
   * @param email - Email address to send verification to
   * @throws Error if user not found or notification queuing fails
   */
  async sendVerificationEmail(userId: string, email: string): Promise<void> {
    const methodStartTime = Date.now();
    this.logger.debug(
      `🔍 Starting email verification for user ${userId} (${email}) at ${new Date().toISOString()}`
    );

    try {
      // Validate user exists and email matches
      const userValidationStart = Date.now();
      this.logger.debug(`📋 Fetching user ${userId} from database...`);
      const user = await this.usersService.findById(userId);
      const userValidationTime = Date.now() - userValidationStart;
      this.logger.debug(`👤 User fetch completed in ${userValidationTime}ms`);

      if (!user) {
        this.logger.debug(`❌ User ${userId} not found`);
        throw new BadRequestException('User not found');
      }

      if (user.email !== email) {
        this.logger.debug(
          `❌ Email mismatch for user ${userId}: expected ${email}, got ${user.email}`
        );
        throw new BadRequestException('Email address mismatch');
      }

      if (user.emailVerified) {
        this.logger.debug(
          `✅ Email already verified for user ${userId}, skipping`
        );
        return;
      }

      // Generate verification token and URL
      const tokenGenerationStart = Date.now();
      this.logger.debug(
        `🔑 Generating verification token for user ${userId}...`
      );
      const verificationToken = this.generateVerificationToken(userId, email);
      const verificationUrl = this.buildVerificationUrl(verificationToken);
      const tokenGenerationTime = Date.now() - tokenGenerationStart;
      this.logger.debug(
        `🎫 Token generation completed in ${tokenGenerationTime}ms`
      );

      // Queue notification for external notifier service
      const queueingStart = Date.now();
      this.logger.debug(
        `📬 Queuing notification to Bull queue for user ${userId}...`
      );

      const queuePayload: EmailVerificationQueuePayload = {
        userId,
        email,
        token: verificationToken,
        verificationUrl,
        type: 'verification',
        timestamp: new Date(),
      };

      // Add timeout to prevent indefinite hanging if Redis is unavailable
      const queueAddPromise = this.notificationQueue.add(
        'email-verification',
        queuePayload,
        {
          priority: QUEUE_PRIORITIES[NotificationPriority.HIGH],
          attempts: 3,
          backoff: {
            type: 'exponential' as const,
            delay: 2000,
          },
        }
      );

      // Add timeout wrapper to prevent hanging
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(
            new Error('Redis/Bull queue connection timeout after 5 seconds')
          );
        }, 5000);
      });

      await Promise.race([queueAddPromise, timeoutPromise]);

      const queueingTime = Date.now() - queueingStart;
      this.logger.debug(`📮 Queue addition completed in ${queueingTime}ms`);

      const totalTime = Date.now() - methodStartTime;
      this.logger.log(
        `✅ Verification email queued for user ${userId} (${email}) in ${totalTime}ms (UserFetch: ${userValidationTime}ms, Token: ${tokenGenerationTime}ms, Queue: ${queueingTime}ms)`
      );
    } catch (error) {
      const totalTime = Date.now() - methodStartTime;
      const errorMessage = extractErrorMessage(error);
      this.logger.error(
        `💥 Failed to send verification email for user ${userId} after ${totalTime}ms: ${errorMessage}`
      );
      throw error;
    }
  }


  /**
   * Public endpoint for resending verification email (prevents email enumeration)
   * Always returns success regardless of whether email exists or is already verified
   * @param email - Email address requesting resend
   */
  /**
   * Public endpoint for resending verification email using userId (prevents email enumeration)
   * Always returns success regardless of whether userId exists or is already verified
   * @param userId - User ID requesting resend
   */
  async resendVerificationEmailByUserId(userId: string): Promise<void> {
    try {
      // Find user by ID
      const user = await this.usersService.findById(userId);

      // Only send if user exists AND is not verified
      if (user && !user.emailVerified) {
        await this.sendVerificationEmail(user.id, user.email);
        this.logger.log(`Verification email resent to user ${userId}`);
      } else if (user && user.emailVerified) {
        this.logger.debug(
          `Resend attempt for already verified user: ${userId}`
        );
      } else {
        this.logger.debug(`Resend attempt for non-existent user: ${userId}`);
      }

      // Always succeed to prevent enumeration
    } catch (error) {
      this.logger.error(
        `Error in resend verification: ${extractErrorMessage(error)}`
      );
      // Swallow error to prevent enumeration
    }
  }

  /**
   * Processes email verification and updates user status
   * @param token - JWT verification token from email link
   * @returns Verification result with user information
   * @throws BadRequestException if token is invalid or user not found
   */
  async processEmailVerification(
    token: string
  ): Promise<EmailVerificationResult> {
    try {
      // Validate and decode token
      const tokenPayload = this.verifyEmailToken(token);
      const { userId, email } = tokenPayload;

      // Verify user exists and email matches
      const user = await this.usersService.findById(userId);
      if (!user) {
        throw new BadRequestException('User not found');
      }

      if (user.email !== email) {
        throw new BadRequestException('Email address mismatch');
      }

      // Check if already verified
      if (user.emailVerified) {
        this.logger.debug(`Email already verified for user ${userId}`);
        return {
          userId,
          email,
          success: true,
        };
      }

      // Update user verification status
      await this.usersService.verifyEmail(userId);

      this.logger.log(
        `Email verification completed for user ${userId} (${email})`
      );

      return {
        userId,
        email,
        success: true,
      };
    } catch (error) {
      const errorMessage = extractErrorMessage(error);
      this.logger.error(`Email verification failed: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Constructs the complete email verification URL
   * @param token - JWT verification token
   * @returns Complete verification URL for email templates
   */
  private buildVerificationUrl(token: string): string {
    const baseUrl = this.webAppUrl.endsWith('/')
      ? this.webAppUrl.slice(0, -1)
      : this.webAppUrl;

    return `${baseUrl}/verify-email/confirm?token=${encodeURIComponent(token)}`;
  }
}
