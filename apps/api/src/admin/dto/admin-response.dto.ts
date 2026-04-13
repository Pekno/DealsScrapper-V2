import { IsEnum, IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '@dealscrapper/shared-types';

/**
 * DTO for updating a user's role
 */
export class UpdateUserRoleDto {
  @ApiProperty({
    enum: UserRole,
    description: 'The new role to assign to the user',
    example: UserRole.ADMIN,
  })
  @IsEnum(UserRole, {
    message: `role must be one of: ${Object.values(UserRole).join(', ')}`,
  })
  role: UserRole;
}

/**
 * DTO for user query parameters (pagination + search)
 */
export class UserQueryDto {
  @ApiPropertyOptional({
    description: 'Page number (default: 1)',
    minimum: 1,
    default: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Items per page (default: 20, max: 100)',
    minimum: 1,
    maximum: 100,
    default: 20,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 20;

  @ApiPropertyOptional({
    description:
      'Search term to filter users by email, first name, or last name',
  })
  @IsOptional()
  @IsString()
  search?: string;
}

/**
 * Response DTO for admin user data (password stripped)
 */
export class AdminUserResponseDto {
  @ApiProperty({ description: 'User unique identifier' })
  id: string;

  @ApiProperty({ description: 'User email address' })
  email: string;

  @ApiPropertyOptional({ description: 'User first name' })
  firstName: string | null;

  @ApiPropertyOptional({ description: 'User last name' })
  lastName: string | null;

  @ApiProperty({ enum: UserRole, description: 'User role' })
  role: string;

  @ApiProperty({ description: 'Whether the user email is verified' })
  emailVerified: boolean;

  @ApiProperty({ description: 'Account creation timestamp' })
  createdAt: Date;

  @ApiPropertyOptional({ description: 'Last login timestamp' })
  lastLoginAt: Date | null;
}

/**
 * Service health status within the dashboard
 */
export class ServiceHealthDto {
  @ApiProperty({ description: 'Service status', example: 'healthy' })
  status: string;

  @ApiPropertyOptional({ description: 'Additional service details' })
  details?: Record<string, unknown>;
}

/**
 * Dashboard metrics shape
 */
export class DashboardMetricsDto {
  @ApiProperty({ description: 'Total registered users' })
  totalUsers: number;

  @ApiProperty({ description: 'Total filters created' })
  totalFilters: number;

  @ApiProperty({ description: 'Total matches found' })
  totalMatches: number;

  @ApiProperty({ description: 'Number of active user sessions' })
  activeSessions: number;
}

/**
 * Full dashboard response including service statuses and metrics
 */
export class DashboardResponseDto {
  @ApiProperty({
    description: 'Health status of all services',
  })
  services: {
    api: ServiceHealthDto;
    scraper: ServiceHealthDto;
    notifier: ServiceHealthDto;
    scheduler: ServiceHealthDto;
  };

  @ApiProperty({
    description: 'Platform metrics',
    type: DashboardMetricsDto,
  })
  metrics: DashboardMetricsDto;
}

/**
 * Browser pool stats from a scraper worker
 */
export class ScraperBrowserPoolDto {
  @ApiProperty() totalInstances: number;
  @ApiProperty() availableInstances: number;
  @ApiProperty() busyInstances: number;
  @ApiProperty() queuedRequests: number;
  @ApiProperty() utilizationPercentage: number;
  @ApiProperty() healthStatus: string;
}

/**
 * Scraping stats from a scraper worker
 */
export class ScraperScrapingStatsDto {
  @ApiProperty() totalRequests: number;
  @ApiProperty() successfulRequests: number;
  @ApiProperty() failedRequests: number;
  @ApiProperty() avgWaitTime: number;
}

/**
 * Individual scraper worker details
 */
export class ScraperWorkerDto {
  @ApiProperty({ description: 'Worker identifier' })
  id: string;

  @ApiPropertyOptional({ description: 'Site this worker is dedicated to (e.g. dealabs, vinted)', example: 'dealabs' })
  site?: string;

  @ApiProperty({ description: 'Worker health status', example: 'healthy' })
  status: string;

  @ApiProperty({ description: 'Worker endpoint URL' })
  endpoint: string;

  @ApiProperty({ description: 'Current active jobs' })
  currentLoad: number;

  @ApiProperty({ description: 'Maximum concurrent jobs' })
  maxConcurrentJobs: number;

  @ApiProperty({ description: 'Supported job types' })
  supportedJobTypes: string[];

  @ApiProperty({ description: 'Last heartbeat timestamp (ISO)' })
  lastHeartbeat: string;

  @ApiPropertyOptional({ description: 'Browser pool statistics', type: ScraperBrowserPoolDto })
  browserPool?: ScraperBrowserPoolDto;

  @ApiPropertyOptional({ description: 'Scraping statistics', type: ScraperScrapingStatsDto })
  scraping?: ScraperScrapingStatsDto;
}

/**
 * Combined scheduler health with nested scraper worker details
 */
export class SchedulerHealthResponseDto {
  @ApiProperty({ description: 'Scheduler service health', type: ServiceHealthDto })
  scheduler: ServiceHealthDto;

  @ApiProperty({ description: 'Registered scraper workers', type: [ScraperWorkerDto] })
  scrapers: ScraperWorkerDto[];
}
