import {
  Controller,
  Get,
  Put,
  Body,
  UseGuards,
  Patch,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiOkResponse,
  ApiUnauthorizedResponse,
  ApiNotFoundResponse,
  ApiBadRequestResponse,
  ApiBody,
} from '@nestjs/swagger';
import { User, Role } from '@prisma/client';
import { UsersService } from './users.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import {
  UpdateProfileDto,
  UpdateNotificationPreferencesDto,
} from './dto/update-user.dto.js';
import type { AuthenticatedUser } from '@dealscrapper/shared-types';
import {
  createSuccessResponse,
  type StandardApiResponse,
} from '@dealscrapper/shared-types';

/**
 * User profile without sensitive fields
 */
type SafeUserProfile = Omit<User, 'password' | 'loginAttempts' | 'lockedUntil'>;

/**
 * User data without password
 */
type UserWithoutPassword = Omit<User, 'password'>;


@ApiTags('Users')
@ApiBearerAuth()
@ApiUnauthorizedResponse({
  description: 'Unauthorized - Invalid or missing JWT token',
})
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('profile')
  @ApiOperation({
    summary: 'Get user profile',
    description:
      "Get the current user's profile information including personal details and preferences",
  })
  @ApiOkResponse({
    description: 'Profile retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Profile retrieved successfully' },
        data: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            email: { type: 'string' },
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            timezone: { type: 'string' },
            locale: { type: 'string' },
            emailVerified: { type: 'boolean' },
            emailNotifications: { type: 'boolean' },
            marketingEmails: { type: 'boolean' },
            weeklyDigest: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
  })
  @ApiNotFoundResponse({ description: 'User profile not found' })
  async getProfile(
    @CurrentUser() user: AuthenticatedUser
  ): Promise<StandardApiResponse<SafeUserProfile>> {
    const fullUser = await this.usersService.findById(user.id);
    if (!fullUser) {
      throw new NotFoundException('User not found');
    }
    const { password, loginAttempts, lockedUntil, ...rest } = fullUser;
    const safeUser: SafeUserProfile = {
      ...rest,
      role: rest.role as Role,
      emailVerifiedAt: rest.emailVerifiedAt ?? null,
      lastLoginAt: rest.lastLoginAt ?? null,
      passwordChangedAt: rest.passwordChangedAt ?? null,
      firstName: rest.firstName ?? null,
      lastName: rest.lastName ?? null,
      timezone: rest.timezone ?? null,
      locale: rest.locale ?? null,
    };
    return createSuccessResponse(safeUser, 'Profile retrieved successfully');
  }

  @Patch('profile')
  @ApiOperation({
    summary: 'Update user profile',
    description:
      "Update the current user's profile information such as name, timezone, and locale",
  })
  @ApiBody({ type: UpdateProfileDto })
  @ApiOkResponse({
    description: 'Profile updated successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Profile updated successfully' },
        data: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            email: { type: 'string' },
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            timezone: { type: 'string' },
            locale: { type: 'string' },
            emailVerified: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Invalid profile data provided' })
  async updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() updateProfileDto: UpdateProfileDto
  ): Promise<StandardApiResponse<SafeUserProfile>> {
    const updatedUser = await this.usersService.updateProfile(
      user.id,
      updateProfileDto
    );
    const { loginAttempts, lockedUntil, ...safeUpdatedUser } = updatedUser;
    return createSuccessResponse(safeUpdatedUser as SafeUserProfile, 'Profile updated successfully');
  }

  @Patch('notifications')
  @ApiOperation({
    summary: 'Update notification preferences',
    description:
      "Update the current user's notification preferences for emails and marketing communications",
  })
  @ApiBody({ type: UpdateNotificationPreferencesDto })
  @ApiOkResponse({
    description: 'Notification preferences updated successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: {
          type: 'string',
          example: 'Notification preferences updated successfully',
        },
        data: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            email: { type: 'string' },
            emailNotifications: { type: 'boolean' },
            marketingEmails: { type: 'boolean' },
            weeklyDigest: { type: 'boolean' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Invalid notification preferences provided',
  })
  async updateNotificationPreferences(
    @CurrentUser() user: AuthenticatedUser,
    @Body() updateNotificationDto: UpdateNotificationPreferencesDto
  ): Promise<StandardApiResponse<UserWithoutPassword>> {
    const updatedUser = await this.usersService.updateNotificationPreferences(
      user.id,
      updateNotificationDto
    );
    return createSuccessResponse(
      updatedUser as UserWithoutPassword,
      'Notification preferences updated successfully'
    );
  }
}
