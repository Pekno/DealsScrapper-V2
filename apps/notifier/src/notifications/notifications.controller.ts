import {
  Controller,
  Get,
  Put,
  Delete,
  Post,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
  ParseBoolPipe,
  Res,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
  ApiOkResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { createSuccessResponse, UnifiedNotificationPayload } from '@dealscrapper/shared-types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { NotificationsService } from './notifications.service.js';

interface NotificationQuery {
  read?: boolean;
  page?: number;
  limit?: number;
}

interface NotificationResponse {
  data: UnifiedNotificationPayload[];
  totalCount: number;
  unreadCount: number;
  currentPage?: number;
  hasMore?: boolean;
}

@Controller('notifications')
@ApiTags('Notifications')
@ApiBearerAuth()
export class NotificationsController {
  private readonly logger = new Logger(NotificationsController.name);

  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * Get notifications for the authenticated user
   */
  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Get user notifications',
    description:
      'Retrieve notifications for the authenticated user with filtering and pagination options.',
  })
  @ApiQuery({
    name: 'read',
    required: false,
    type: Boolean,
    description: 'Filter by read status (true=read, false=unread)',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number for pagination (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of notifications per page (default: 20)',
  })
  @ApiOkResponse({
    description: 'Notifications retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: { type: 'object' },
          description: 'Array of notifications',
        },
        totalCount: { type: 'number', example: 150 },
        unreadCount: { type: 'number', example: 12 },
        currentPage: { type: 'number', example: 1 },
        hasMore: { type: 'boolean', example: true },
      },
    },
  })
  async getNotifications(
    @CurrentUser('sub') userId: string,
    @Query('read', new ParseBoolPipe({ optional: true })) read?: boolean,
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number
  ): Promise<NotificationResponse> {
    return this.notificationsService.getNotifications(userId, {
      read,
      page,
      limit: limit || 20,
    });
  }

  /**
   * Mark a notification as read
   * PUT /notifications/{id}/read
   */
  @Put(':id/read')
  @UseGuards(JwtAuthGuard)
  async markAsRead(
    @Param('id') notificationId: string,
    @CurrentUser('sub') userId: string
  ) {
    await this.notificationsService.markAsRead(notificationId, userId);
    return createSuccessResponse(void 0, 'Notification marked as read');
  }

  /**
   * Mark all notifications as read for the user
   * POST /notifications/mark-all-read
   */
  @Post('mark-all-read')
  @UseGuards(JwtAuthGuard)
  async markAllAsRead(
    @CurrentUser('sub') userId: string
  ) {
    const count = await this.notificationsService.markAllAsRead(userId);
    return createSuccessResponse({ count }, `${count} notifications marked as read`);
  }

  /**
   * Delete a notification
   * DELETE /notifications/{id}
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async deleteNotification(
    @Param('id') notificationId: string,
    @CurrentUser('sub') userId: string
  ) {
    await this.notificationsService.deleteNotification(notificationId, userId);
    return createSuccessResponse(void 0, 'Notification deleted successfully');
  }
}

/**
 * Separate controller for tracking endpoints (no auth required)
 */
@ApiTags('Tracking')
@Controller('track')
export class TrackingController {
  private readonly logger = new Logger(TrackingController.name);

  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * Email tracking pixel endpoint
   * GET /track/email/{notificationId}/open.png
   */
  @Get('email/:notificationId/open.png')
  @ApiOperation({
    summary: 'Track email open',
    description: 'Track when user opens email notification via tracking pixel',
  })
  @ApiParam({ name: 'notificationId', description: 'Notification ID to track' })
  @ApiResponse({
    status: 200,
    description: 'Returns 1x1 transparent PNG tracking pixel',
    headers: {
      'Content-Type': { description: 'image/png' },
    },
  })
  async trackEmailOpen(
    @Param('notificationId') notificationId: string,
    @Res() res: Response
  ): Promise<void> {
    try {
      // Mark notification as read
      await this.notificationsService.markAsReadByPixel(notificationId);
    } catch (error) {
      // Silently ignore errors for tracking pixels - just log for debugging
      this.logger.debug('Email tracking pixel error (non-critical):', error);
    }

    // Return 1x1 transparent PNG
    const pixel = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      'base64'
    );

    res.set({
      'Content-Type': 'image/png',
      'Content-Length': pixel.length.toString(),
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    });

    res.status(HttpStatus.OK).send(pixel);
  }
}
