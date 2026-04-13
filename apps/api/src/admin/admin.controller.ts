import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import {
  createSuccessResponse,
  type StandardApiResponse,
  type AuthenticatedRequest,
  UserRole,
} from '@dealscrapper/shared-types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { AdminService } from './admin.service.js';
import { AuditLoggerService, AuditAction } from './audit-logger.service.js';
import {
  UpdateUserRoleDto,
  UserQueryDto,
  DashboardResponseDto,
  DashboardMetricsDto,
  ServiceHealthDto,
  SchedulerHealthResponseDto,
  type AdminUserResponseDto,
} from './dto/admin-response.dto.js';
import type { PaginatedResult } from '@dealscrapper/shared-repository';
import type { User } from '@dealscrapper/database';

interface PaginatedAdminUsersResponse {
  data: AdminUserResponseDto[];
  pagination: PaginatedResult<User>['pagination'];
}

@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Roles(UserRole.ADMIN)
@ApiUnauthorizedResponse({
  description: 'Unauthorized - Invalid or missing JWT token',
})
@ApiForbiddenResponse({ description: 'Forbidden - Admin role required' })
@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly auditLogger: AuditLoggerService,
  ) {}

  /**
   * GET /admin/dashboard
   * Retrieves platform dashboard metrics and service health statuses
   */
  @Get('dashboard')
  @ApiOperation({
    summary: 'Get admin dashboard metrics',
    description:
      'Retrieves health status of all services and platform-wide metrics including user count, filter count, matches, and active sessions.',
  })
  @ApiOkResponse({
    description: 'Dashboard metrics retrieved successfully',
    type: DashboardResponseDto,
  })
  async getDashboard(): Promise<StandardApiResponse<DashboardResponseDto>> {
    const dashboard = await this.adminService.getDashboardMetrics();
    return createSuccessResponse(
      dashboard,
      'Dashboard metrics retrieved successfully'
    );
  }

  /**
   * GET /admin/health/api
   * Returns API self-health (no HTTP, calls health service directly)
   */
  @Get('health/api')
  @ApiOperation({
    summary: 'Get API health',
    description: 'Returns API service health data by calling the health service directly.',
  })
  @ApiOkResponse({ description: 'API health retrieved successfully', type: ServiceHealthDto })
  async getApiHealth(): Promise<StandardApiResponse<ServiceHealthDto>> {
    const health = await this.adminService.getApiHealth();
    return createSuccessResponse(health, 'API health retrieved successfully');
  }

  /**
   * GET /admin/health/notifier
   * Proxies health check to the notifier service
   */
  @Get('health/notifier')
  @ApiOperation({
    summary: 'Get Notifier health',
    description: 'Proxies health check to the notifier service.',
  })
  @ApiOkResponse({ description: 'Notifier health retrieved successfully', type: ServiceHealthDto })
  async getNotifierHealth(): Promise<StandardApiResponse<ServiceHealthDto>> {
    const health = await this.adminService.getNotifierHealth();
    return createSuccessResponse(health, 'Notifier health retrieved successfully');
  }

  /**
   * GET /admin/health/scheduler
   * Proxies health to the scheduler and fetches per-scraper worker details
   */
  @Get('health/scheduler')
  @ApiOperation({
    summary: 'Get Scheduler + Scraper health',
    description:
      'Proxies health check to the scheduler service and fetches detailed health from each registered scraper worker.',
  })
  @ApiOkResponse({
    description: 'Scheduler health retrieved successfully',
    type: SchedulerHealthResponseDto,
  })
  async getSchedulerHealth(): Promise<StandardApiResponse<SchedulerHealthResponseDto>> {
    const health = await this.adminService.getSchedulerHealth();
    return createSuccessResponse(health, 'Scheduler health retrieved successfully');
  }

  /**
   * GET /admin/metrics
   * Returns platform metrics (user/filter/match/session counts)
   */
  @Get('metrics')
  @ApiOperation({
    summary: 'Get platform metrics',
    description: 'Returns platform-wide metrics including user count, filter count, matches, and active sessions.',
  })
  @ApiOkResponse({ description: 'Metrics retrieved successfully', type: DashboardMetricsDto })
  async getMetrics(): Promise<StandardApiResponse<DashboardMetricsDto>> {
    const metrics = await this.adminService.getMetrics();
    return createSuccessResponse(metrics, 'Metrics retrieved successfully');
  }

  /**
   * GET /admin/users
   * Retrieves a paginated list of users with optional search
   */
  @Get('users')
  @ApiOperation({
    summary: 'List all users',
    description:
      'Retrieves a paginated list of all registered users. Supports search by email, first name, or last name.',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page (default: 20)',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Search by email, first name, or last name',
  })
  @ApiOkResponse({ description: 'Users retrieved successfully' })
  async getUsers(
    @Query() query: UserQueryDto
  ): Promise<StandardApiResponse<PaginatedAdminUsersResponse>> {
    const result = await this.adminService.getUsers(
      query.page ?? 1,
      query.limit ?? 20,
      query.search
    );
    return createSuccessResponse(result, 'Users retrieved successfully');
  }

  /**
   * PATCH /admin/users/:id/role
   * Updates a user's role
   */
  @Patch('users/:id/role')
  @ApiOperation({
    summary: 'Update user role',
    description: 'Changes a user role to ADMIN or USER.',
  })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiOkResponse({ description: 'User role updated successfully' })
  @ApiBadRequestResponse({ description: 'Invalid role value' })
  @ApiNotFoundResponse({ description: 'User not found' })
  async updateUserRole(
    @Param('id') id: string,
    @Body() dto: UpdateUserRoleDto,
    @Request() req: AuthenticatedRequest,
  ): Promise<StandardApiResponse<AdminUserResponseDto>> {
    const updatedUser = await this.adminService.updateUserRole(id, dto.role);
    this.auditLogger.log(AuditAction.USER_ROLE_CHANGED, req.user.id, req.user.email, {
      targetUserId: id,
      newRole: dto.role,
    });
    return createSuccessResponse(updatedUser, 'User role updated successfully');
  }

  /**
   * DELETE /admin/users/:id
   * Deletes a user account (cannot delete self)
   */
  @Delete('users/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete user',
    description:
      'Permanently deletes a user account and all associated data. Admin cannot delete their own account.',
  })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiOkResponse({ description: 'User deleted successfully' })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiForbiddenResponse({ description: 'Cannot delete your own account' })
  async deleteUser(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest
  ): Promise<StandardApiResponse<null>> {
    await this.adminService.deleteUser(id, req.user.id);
    this.auditLogger.log(AuditAction.USER_DELETED, req.user.id, req.user.email, {
      targetUserId: id,
    });
    return createSuccessResponse(null, 'User deleted successfully');
  }

  /**
   * POST /admin/users/:id/reset-password
   * Resets a user's password to a temporary value
   */
  @Post('users/:id/reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reset user password',
    description:
      'Generates a temporary password for the user. The admin must communicate this password to the user securely.',
  })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiOkResponse({
    description: 'Password reset link generated — email queued or URL returned for manual sharing',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string' },
        data: {
          oneOf: [
            { type: 'null', nullable: true },
            {
              type: 'object',
              properties: {
                resetUrl: {
                  type: 'string',
                  example: 'https://app.example.com/auth/reset-password?token=eyJ...',
                },
              },
            },
          ],
        },
      },
    },
  })
  @ApiNotFoundResponse({ description: 'User not found' })
  async resetUserPassword(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ): Promise<StandardApiResponse<{ resetUrl: string } | null>> {
    const result = await this.adminService.resetUserPassword(id);
    this.auditLogger.log(AuditAction.USER_PASSWORD_RESET, req.user.id, req.user.email, {
      targetUserId: id,
    });

    if (result === null) {
      return createSuccessResponse(null, 'Password reset link sent to user');
    }

    return createSuccessResponse(
      { resetUrl: result.resetUrl },
      'No email provider configured — share this link with the user',
    );
  }
}
