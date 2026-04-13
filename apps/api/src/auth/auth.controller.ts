import {
  Controller,
  Post,
  Body,
  Get,
  Query,
  UseGuards,
  Request,
  UnauthorizedException,
  Ip,
  Headers,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { EmailVerificationService } from './services/email-verification.service.js';
import { PasswordResetService } from './services/password-reset.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import {
  RefreshTokenDto,
  AuthResponseDto,
  RegistrationResponseDto,
} from './dto/refresh-token.dto.js';
import {
  SendVerificationEmailDto,
  VerifyEmailDto,
  EmailVerificationResponseDto,
  VerificationEmailSentResponseDto,
  ResendVerificationEmailDto,
  ResendVerificationResponseDto,
} from './dto/email-verification.dto.js';
import {
  ForgotPasswordDto,
  ResetPasswordDto,
  ForgotPasswordResponseDto,
  ResetPasswordResponseDto,
  ValidateResetTokenResponseDto,
} from './dto/password-reset.dto.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { LocalAuthGuard } from './guards/local-auth.guard.js';
import { Public } from './decorators/public.decorator.js';
import { CurrentUser } from './decorators/current-user.decorator.js';
import type {
  AuthenticatedUser,
  AuthenticatedRequest,
  LoginResponse,
  RegistrationResponse,
} from '@dealscrapper/shared-types';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiBody,
  ApiHeader,
} from '@nestjs/swagger';
import { createSuccessResponse } from '@dealscrapper/shared-types';
import { AuthRateLimitGuard } from './guards/auth-rate-limit.guard.js';
import { createServiceLogger } from '@dealscrapper/shared-logging';
import { apiLogConfig } from '../config/logging.config.js';
import { User } from '@prisma/client';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { NotificationPriority, QUEUE_PRIORITIES } from '@dealscrapper/shared-types';
import { UsersService } from '../users/users.service.js';

// Local interface for login requests where LocalAuthGuard populates req.user with full User (without password)
interface LoginRequest extends Request {
  user: Omit<User, 'password'>;
}

/**
 * Converts a JWT duration shorthand (e.g. "1h", "30m", "7d") into a
 * human-readable string suitable for email templates (e.g. "1 hour", "30 minutes", "7 days").
 * Unrecognised formats are returned unchanged.
 */
function convertJwtDurationToHuman(duration: string): string {
  const match = /^(\d+)([smhd])$/.exec(duration.trim());
  if (!match) return duration;

  const amount = parseInt(match[1], 10);
  const unit = match[2];

  const unitMap: Record<string, string> = {
    s: 'second',
    m: 'minute',
    h: 'hour',
    d: 'day',
  };

  const word = unitMap[unit];
  return `${amount} ${word}${amount !== 1 ? 's' : ''}`;
}

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  private readonly logger = createServiceLogger(apiLogConfig);

  constructor(
    private readonly authService: AuthService,
    private readonly emailVerificationService: EmailVerificationService,
    private readonly passwordResetService: PasswordResetService,
    private readonly usersService: UsersService,
    @InjectQueue('notifications') private readonly notificationQueue: Queue,
  ) {}

  @Post('register')
  @Public()
  @UseGuards(AuthRateLimitGuard)
  @ApiOperation({
    summary: 'Register a new user',
    description:
      'Creates a new user account with email and password. Sends verification email and requires email verification before login.',
  })
  @ApiBody({ type: RegisterDto })
  @ApiCreatedResponse({
    description: 'User registered successfully, verification email sent',
    type: RegistrationResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid input data or email already exists',
  })
  async register(
    @Body() registerDto: RegisterDto
  ): Promise<RegistrationResponseDto> {
    const requestStartTime = Date.now();

    this.logger.debug(
      `🌐 Registration request received for email: ${registerDto.email} at ${new Date().toISOString()}`
    );

    try {
      const result = await this.authService.register(
        registerDto.email,
        registerDto.password,
        registerDto.firstName,
        registerDto.lastName
      );

      const totalRequestTime = Date.now() - requestStartTime;
      this.logger.log(
        `🎉 Registration request completed for ${registerDto.email} in ${totalRequestTime}ms`
      );

      return result;
    } catch (error) {
      const totalRequestTime = Date.now() - requestStartTime;
      this.logger.error(
        `❌ Registration request failed for ${registerDto.email} after ${totalRequestTime}ms: ${error.message}`
      );
      throw error;
    }
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Public()
  @UseGuards(AuthRateLimitGuard, LocalAuthGuard)
  @ApiOperation({
    summary: 'Login user',
    description:
      'Authenticates user with email and password. Returns JWT tokens for accessing protected endpoints.',
  })
  @ApiBody({ type: LoginDto })
  @ApiHeader({
    name: 'user-agent',
    description: 'User agent string for session tracking',
    required: false,
    schema: {
      type: 'string',
      default:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      enum: [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 OPR/106.0.0.0',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0',
      ],
    },
  })
  @ApiOkResponse({
    description: 'Login successful',
    type: AuthResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Invalid email or password' })
  @ApiBadRequestResponse({ description: 'Invalid input data' })
  async login(
    @Request() req: LoginRequest,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string
  ) {
    return this.authService.login(req.user as User, ipAddress, userAgent);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Public()
  @UseGuards(AuthRateLimitGuard)
  @ApiOperation({
    summary: 'Refresh access token',
    description: 'Use refresh token to get a new access token',
  })
  @ApiBody({ type: RefreshTokenDto })
  @ApiOkResponse({
    description: 'Token refreshed successfully',
    schema: {
      type: 'object',
      properties: {
        access_token: { type: 'string' },
        expires_in: { type: 'string' },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired refresh token' })
  async refreshToken(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshToken(refreshTokenDto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Logout user',
    description: 'Invalidates the refresh token for the current session',
  })
  @ApiBody({ type: RefreshTokenDto })
  @ApiOkResponse({ description: 'Logged out successfully' })
  @ApiUnauthorizedResponse({ description: 'Invalid or missing JWT token' })
  async logout(@Body() refreshTokenDto: RefreshTokenDto) {
    await this.authService.logout(refreshTokenDto.refreshToken);
    return { message: 'Logged out successfully' };
  }

  @Post('logout-all')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Logout from all devices',
    description: 'Invalidates all refresh tokens for the current user',
  })
  @ApiOkResponse({ description: 'Logged out from all devices successfully' })
  @ApiUnauthorizedResponse({ description: 'Invalid or missing JWT token' })
  async logoutAll(@CurrentUser() user: AuthenticatedUser) {
    await this.authService.logoutAll(user.id);
    return { message: 'Logged out from all devices successfully' };
  }

  @Post('send-verification')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Send email verification',
    description:
      'Sends or resends email verification to the authenticated user. Unified endpoint for initial send and resend operations.',
  })
  @ApiOkResponse({
    description: 'Verification email sent successfully',
    type: VerificationEmailSentResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Invalid or missing JWT token' })
  @ApiBadRequestResponse({
    description: 'Email already verified or user not found',
  })
  async sendVerificationEmail(
    @CurrentUser() user: AuthenticatedUser
  ): Promise<VerificationEmailSentResponseDto> {
    await this.emailVerificationService.sendVerificationEmail(
      user.id,
      user.email
    );

    return {
      success: true,
      message: 'Verification email sent successfully',
      email: user.email,
    };
  }


  @Post('resend-verification')
  @Public()
  @UseGuards(AuthRateLimitGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Resend verification email (public)',
    description:
      'Request a new verification email for an unverified account using userId. For security, always returns success regardless of whether the user exists.',
  })
  @ApiBody({ type: ResendVerificationEmailDto })
  @ApiOkResponse({
    description:
      'Request processed (email sent if account exists and is unverified)',
    type: ResendVerificationResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid userId format',
  })
  async resendVerificationEmail(
    @Body() dto: ResendVerificationEmailDto
  ): Promise<ResendVerificationResponseDto> {
    await this.emailVerificationService.resendVerificationEmailByUserId(
      dto.userId
    );

    return {
      success: true,
      message:
        'If this account exists and is unverified, a verification email has been sent',
    };
  }

  @Get('verify-email')
  @Public()
  @ApiOperation({
    summary: 'Verify email address',
    description:
      'Verifies user email address using JWT token from verification email link',
  })
  @ApiOkResponse({
    description: 'Email verified successfully',
    type: EmailVerificationResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid or expired verification token',
  })
  async verifyEmail(
    @Query('token') token: string
  ): Promise<EmailVerificationResponseDto> {
    if (!token) {
      throw new UnauthorizedException('Verification token is required');
    }

    const verificationResult =
      await this.emailVerificationService.processEmailVerification(token);

    return {
      success: verificationResult.success,
      message: 'Email verification completed successfully',
      userId: verificationResult.userId,
      email: verificationResult.email,
    };
  }

  @Post('forgot-password')
  @Public()
  @UseGuards(AuthRateLimitGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Request password reset',
    description:
      'Sends a one-time password reset link to the given email address. Always returns the same response to prevent email enumeration.',
  })
  @ApiBody({ type: ForgotPasswordDto })
  @ApiOkResponse({
    description: 'Request processed',
    type: ForgotPasswordResponseDto,
  })
  async forgotPassword(
    @Body() dto: ForgotPasswordDto
  ): Promise<ForgotPasswordResponseDto> {
    const SAFE_RESPONSE = {
      success: true as const,
      message: 'If this email is registered, a reset link has been sent',
    };

    try {
      const user = await this.usersService.findByEmail(dto.email);
      if (!user) {
        return SAFE_RESPONSE;
      }

      const configuredExpiresIn = this.passwordResetService.getConfiguredExpiresIn();
      const { resetUrl } = this.passwordResetService.generateResetToken(
        user.id,
        user.email,
        configuredExpiresIn,
      );

      await this.notificationQueue.add(
        'password-reset',
        {
          userId: user.id,
          email: user.email,
          resetUrl,
          timestamp: new Date(),
          expiresIn: convertJwtDurationToHuman(configuredExpiresIn),
        },
        {
          priority: QUEUE_PRIORITIES[NotificationPriority.HIGH],
          attempts: 3,
          backoff: { type: 'exponential' as const, delay: 2000 },
        },
      );
    } catch (error) {
      this.logger.error(
        `Error processing forgot-password for ${dto.email}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    return SAFE_RESPONSE;
  }

  @Get('validate-reset-token')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Validate a password reset token',
    description:
      'Checks whether a password reset token is valid and has not already been used. Always returns HTTP 200.',
  })
  @ApiOkResponse({
    description: 'Token validation result',
    type: ValidateResetTokenResponseDto,
  })
  async validateResetToken(
    @Query('token') token: string
  ): Promise<ValidateResetTokenResponseDto> {
    if (!token) {
      return { valid: false, message: 'Token is required' };
    }

    try {
      await this.passwordResetService.validateResetToken(token);
      return { valid: true };
    } catch {
      return { valid: false, message: 'Token is invalid, expired, or already used' };
    }
  }

  @Post('reset-password')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reset password with token',
    description: 'Resets the user password using a valid one-time JWT reset token.',
  })
  @ApiBody({ type: ResetPasswordDto })
  @ApiOkResponse({
    description: 'Password reset successfully',
    type: ResetPasswordResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid or expired token, or token already used',
  })
  async resetPassword(
    @Body() dto: ResetPasswordDto
  ): Promise<ResetPasswordResponseDto> {
    await this.passwordResetService.resetPassword(dto.token, dto.newPassword);
    return { success: true, message: 'Password reset successfully' };
  }
}
