import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { SharedConfigService } from '@dealscrapper/shared-config';
import { UsersService } from '../users/users.service.js';
import { EmailVerificationService } from './services/email-verification.service.js';
import * as bcryptjs from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '@dealscrapper/database';
import { User } from '@dealscrapper/database';
import {
  LoginResponse,
  RegistrationResponse,
  UserUpdateData,
  JwtPayload,
  UserRole,
} from '@dealscrapper/shared-types';
import { createSuccessResponse } from '@dealscrapper/shared-types';
import { createServiceLogger } from '@dealscrapper/shared-logging';
import { apiLogConfig } from '../config/logging.config.js';

@Injectable()
export class AuthService {
  private readonly BCRYPT_ROUNDS = 12;
  private readonly MAX_LOGIN_ATTEMPTS = 5;
  private readonly LOCK_TIME = 15 * 60 * 1000; // 15 minutes

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly sharedConfig: SharedConfigService,
    private readonly prisma: PrismaService,
    private readonly emailVerificationService: EmailVerificationService
  ) {}

  /**
   * Validates user credentials and checks account status
   * @param email - User's email address
   * @param password - User's password to verify
   * @returns User object without password if valid, null if credentials are invalid
   * @throws UnauthorizedException if account is locked or email is not verified
   */
  async validateUser(email: string, password: string): Promise<Omit<User, 'password'> | null> {
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      return null;
    }

    // Check if account is locked
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException(
        'Account is temporarily locked. Please try again later.'
      );
    }

    // Check if email is verified
    if (!user.emailVerified) {
      throw new UnauthorizedException(
        'Please verify your email address before logging in. Check your inbox for the verification email.'
      );
    }

    // Check password
    const isPasswordValid = await bcryptjs.compare(password, user.password);

    if (!isPasswordValid) {
      // Increment failed attempts
      await this.handleFailedLogin(user.id);
      return null;
    }

    // Reset failed attempts on successful login
    await this.handleSuccessfulLogin(user.id);

    const { password: _, ...result } = user;
    return result as Omit<User, 'password'>;
  }

  /**
   * Logs in a user and generates authentication tokens
   * @param user - The authenticated user object
   * @param ipAddress - Optional IP address of the login request
   * @param userAgent - Optional user agent string of the client
   * @returns Login response containing access token, refresh token, and user data
   */
  async login(
    user: User,
    ipAddress?: string,
    userAgent?: string
  ): Promise<LoginResponse> {
    const payload: JwtPayload = {
      email: user.email,
      sub: user.id,
      emailVerified: user.emailVerified,
      role: user.role as UserRole,
    };

    // Generate access and refresh tokens
    const accessToken = this.jwtService.sign(payload);
    const refreshToken = uuidv4();

    // Store refresh token in database
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    await this.prisma.userSession.create({
      data: {
        userId: user.id,
        refreshToken,
        expiresAt,
        ipAddress,
        userAgent,
      },
    });

    const loginData = {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: this.sharedConfig.getJwtConfig().expiresIn,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName ?? undefined,
        lastName: user.lastName ?? undefined,
        emailVerified: user.emailVerified,
        role: user.role,
        createdAt: user.createdAt,
      },
    };

    return createSuccessResponse(
      loginData,
      'Login successful'
    ) as LoginResponse;
  }

  /**
   * Registers a new user and sends email verification
   * @param email - User's email address
   * @param password - User's password (will be hashed)
   * @param firstName - Optional first name
   * @param lastName - Optional last name
   * @returns Registration response with user data and next steps
   * @throws ConflictException if user already exists
   * @throws BadRequestException if password validation fails
   */
  async register(
    email: string,
    password: string,
    firstName?: string,
    lastName?: string
  ): Promise<RegistrationResponse> {
    const logger = createServiceLogger(apiLogConfig);
    const startTime = Date.now();
    logger.debug(
      `🔍 Registration started for email: ${email} at ${new Date().toISOString()}`
    );

    try {
      // Check if user already exists
      const userCheckStart = Date.now();
      const existingUser = await this.usersService.findByEmail(email);
      const userCheckTime = Date.now() - userCheckStart;
      logger.debug(`📋 User existence check completed in ${userCheckTime}ms`);

      if (existingUser) {
        // Allow re-registration if email is not verified
        if (!existingUser.emailVerified) {
          logger.log(`🔄 Re-registration for unverified account: ${email}`);
          
          // Validate password strength
          const passwordValidationStart = Date.now();
          this.validatePassword(password);
          const passwordValidationTime = Date.now() - passwordValidationStart;
          logger.debug(
            `🔒 Password validation completed in ${passwordValidationTime}ms`
          );
          
          // Hash new password
          const hashingStart = Date.now();
          const hashedPassword = await bcryptjs.hash(password, this.BCRYPT_ROUNDS);
          const hashingTime = Date.now() - hashingStart;
          logger.debug(
            `🔐 Password hashing (${this.BCRYPT_ROUNDS} rounds) completed in ${hashingTime}ms`
          );
          
          // Update user with new credentials and names (if provided)
          const updateStart = Date.now();
          const updatedUser = await this.usersService.update(existingUser.id, {
            password: hashedPassword,
            firstName: firstName ?? existingUser.firstName ?? undefined,
            lastName: lastName ?? existingUser.lastName ?? undefined,
          });
          const updateTime = Date.now() - updateStart;
          logger.debug(`👤 User update completed in ${updateTime}ms`);
          
          // Re-send verification email
          const emailSendStart = Date.now();
          logger.debug(
            `📧 Re-sending email verification for user ${updatedUser.id}`
          );
          await this.emailVerificationService.sendVerificationEmail(
            updatedUser.id,
            updatedUser.email
          );
          const emailSendTime = Date.now() - emailSendStart;
          logger.debug(
            `📮 Email verification queuing completed in ${emailSendTime}ms`
          );
          
          const registrationData = {
            user: {
              id: updatedUser.id,
              email: updatedUser.email,
              firstName: updatedUser.firstName ?? undefined,
              lastName: updatedUser.lastName ?? undefined,
              emailVerified: updatedUser.emailVerified,
              role: updatedUser.role,
              createdAt: updatedUser.createdAt,
            },
            nextStep: 'verify-email' as const,
          };
          
          const totalTime = Date.now() - startTime;
          logger.log(
            `✅ Re-registration completed for ${email} in ${totalTime}ms`
          );
          
          return createSuccessResponse(
            registrationData,
            'Registration successful. Please check your email to verify your account.'
          ) as RegistrationResponse;
        }
        
        // Email is verified = account is claimed = reject
        logger.debug(`❌ User already exists for email: ${email} (verified)`);
        throw new ConflictException('User with this email already exists');
      }

      // Normal registration flow for new users
      // Validate password strength
      const passwordValidationStart = Date.now();
      this.validatePassword(password);
      const passwordValidationTime = Date.now() - passwordValidationStart;
      logger.debug(
        `🔒 Password validation completed in ${passwordValidationTime}ms`
      );

      // Hash password - this is potentially slow
      const hashingStart = Date.now();
      const hashedPassword = await bcryptjs.hash(password, this.BCRYPT_ROUNDS);
      const hashingTime = Date.now() - hashingStart;
      logger.debug(
        `🔐 Password hashing (${this.BCRYPT_ROUNDS} rounds) completed in ${hashingTime}ms`
      );

      // Create user in database
      const userCreationStart = Date.now();
      const user = await this.usersService.create({
        email,
        password: hashedPassword,
        firstName,
        lastName,
      });
      const userCreationTime = Date.now() - userCreationStart;
      logger.debug(
        `👤 User creation in database completed in ${userCreationTime}ms`
      );

      // Send verification email - this could be the bottleneck
      const emailSendStart = Date.now();
      logger.debug(
        `📧 Starting email verification process for user ${user.id}`
      );
      await this.emailVerificationService.sendVerificationEmail(
        user.id,
        user.email
      );
      const emailSendTime = Date.now() - emailSendStart;
      logger.debug(
        `📮 Email verification queuing completed in ${emailSendTime}ms`
      );

      const registrationData = {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName ?? undefined,
          lastName: user.lastName ?? undefined,
          emailVerified: user.emailVerified,
          role: user.role,
          createdAt: user.createdAt,
        },
        nextStep: 'verify-email' as const,
      };

      const totalTime = Date.now() - startTime;
      logger.log(
        `✅ Registration completed for ${email} in ${totalTime}ms (Check: ${userCheckTime}ms, Validation: ${passwordValidationTime}ms, Hashing: ${hashingTime}ms, Creation: ${userCreationTime}ms, Email: ${emailSendTime}ms)`
      );

      return createSuccessResponse(
        registrationData,
        'Registration successful. Please check your email to verify your account.'
      ) as RegistrationResponse;
    } catch (error) {
      const totalTime = Date.now() - startTime;
      logger.error(
        `💥 Registration failed for ${email} after ${totalTime}ms: ${error.message}`
      );
      throw error instanceof ConflictException ||
        error instanceof BadRequestException
        ? error
        : new ConflictException('Registration failed');
    }
  }

  /**
   * Refreshes an access token using a valid refresh token
   * @param refreshToken - The refresh token from a previous login
   * @returns New access token and expiration time
   * @throws UnauthorizedException if refresh token is invalid or expired
   */
  async refreshToken(refreshToken: string): Promise<{ access_token: string; expires_in: string }> {
    const session = await this.prisma.userSession.findUnique({
      where: { refreshToken },
      include: { user: true },
    });

    if (!session || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = session.user;
    const payload: JwtPayload = {
      email: user.email,
      sub: user.id,
      emailVerified: user.emailVerified,
      role: user.role as UserRole,
    };
    const newAccessToken = this.jwtService.sign(payload);

    return {
      access_token: newAccessToken,
      expires_in: this.sharedConfig.getJwtConfig().expiresIn,
    };
  }

  /**
   * Logs out a user by invalidating their refresh token
   * @param refreshToken - The refresh token to invalidate
   */
  async logout(refreshToken: string): Promise<void> {
    await this.prisma.userSession.deleteMany({
      where: { refreshToken },
    });
  }

  /**
   * Logs out a user from all devices by invalidating all their sessions
   * @param userId - The unique identifier of the user
   */
  async logoutAll(userId: string): Promise<void> {
    await this.prisma.userSession.deleteMany({
      where: { userId },
    });
  }

  /**
   * Handles failed login attempts by incrementing counter and locking account if needed
   * @param userId - The unique identifier of the user
   */
  private async handleFailedLogin(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) return;

    const loginAttempts = user.loginAttempts + 1;
    const updateData: UserUpdateData = { loginAttempts };

    // Lock account if max attempts reached
    if (loginAttempts >= this.MAX_LOGIN_ATTEMPTS) {
      updateData.lockedUntil = new Date(Date.now() + this.LOCK_TIME);
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
    });
  }

  /**
   * Resets failed login attempts and updates last login timestamp
   * @param userId - The unique identifier of the user
   */
  private async handleSuccessfulLogin(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        loginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
      },
    });
  }

  /**
   * Validates password strength requirements
   * @param password - The password to validate
   * @throws BadRequestException if password doesn't meet requirements
   */
  private validatePassword(password: string): void {
    if (password.length < 8) {
      throw new BadRequestException(
        'Password must be at least 8 characters long'
      );
    }

    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
      throw new BadRequestException(
        'Password must contain at least one uppercase letter, one lowercase letter, and one number'
      );
    }
  }
}
