import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { IsString, IsOptional, IsNotEmpty } from 'class-validator';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiInternalServerErrorResponse,
} from '@nestjs/swagger';
import { CategoryDiscoveryOrchestrator } from './category-discovery-orchestrator.service.js';
import { extractErrorMessage } from '@dealscrapper/shared';
import {
  createSuccessResponse,
  type StandardApiResponse,
} from '@dealscrapper/shared-types';

/**
 * DTO for manual discovery trigger requests
 */
export class TriggerDiscoveryDto {
  /**
   * Source identifier for who/what triggered the discovery
   * @example "admin-dashboard"
   */
  @IsString()
  @IsNotEmpty()
  triggerSource: string;

  /**
   * Optional description of why discovery was triggered
   * @example "Testing new category detection after site changes"
   */
  @IsString()
  @IsOptional()
  description?: string;
}

/**
 * Data payload for discovery trigger operations
 */
export interface DiscoveryTriggerData {
  /**
   * Unique identifier for the queued discovery job
   * @example "12345"
   */
  jobId: string;

  /**
   * Timestamp when the job was queued
   * @example "2024-01-15T10:30:00.000Z"
   */
  queuedAt: string;

  /**
   * Source that triggered the discovery
   * @example "admin-dashboard"
   */
  triggeredBy: string;
}

/**
 * Data payload for discovery status queries
 */
export interface DiscoveryStatusData {
  /**
   * Whether discovery jobs are currently running or queued
   * @example true
   */
  isActive: boolean;

  /**
   * Current queue status
   */
  queueStatus: {
    /**
     * Number of discovery jobs waiting to be processed
     * @example 2
     */
    waiting: number;

    /**
     * Number of discovery jobs currently being processed
     * @example 1
     */
    active: number;
  };

  /**
   * Timestamp of when this status was last checked
   * @example "2024-01-15T10:30:00.000Z"
   */
  lastScheduledAt: string;

  /**
   * Timestamp when status was retrieved
   * @example "2024-01-15T10:30:00.000Z"
   */
  checkedAt: string;
}

/**
 * Standard error response DTO
 */
export class ErrorResponse {
  /**
   * HTTP status code
   * @example 400
   */
  statusCode: number;

  /**
   * Error message describing what went wrong
   * @example "Invalid trigger source provided"
   */
  message: string;

  /**
   * Additional error details (optional)
   */
  details?: string[];

  /**
   * Timestamp when error occurred
   * @example "2024-01-15T10:30:00.000Z"
   */
  timestamp: string;
}

/**
 * Controller for managing category discovery operations
 * Provides HTTP endpoints to trigger manual discovery and monitor status
 */
@ApiTags('category-discovery')
@Controller('category-discovery')
export class CategoryDiscoveryController {
  constructor(
    private readonly categoryDiscoveryOrchestrator: CategoryDiscoveryOrchestrator
  ) {}

  /**
   * Triggers manual category discovery job
   * Creates a high-priority discovery job that will find new categories and validate existing ones
   *
   * @param triggerData - Information about who/what is triggering the discovery
   * @returns Promise resolving to job creation details
   */
  @Post('trigger')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Trigger manual category discovery',
    description: `
Manually triggers a category discovery job for immediate processing.

**What it does:**
- Discovers new product categories from the source site
- Validates existing category configurations
- Updates category metadata and statistics
- Queues job with normal priority for faster processing than scheduled runs

**Use cases:**
- Testing after site structure changes
- Admin-requested discovery updates
- Integration with external category management tools
- Emergency category refresh after detection issues

**Rate limiting:** Consider implementing rate limiting for production use
    `,
  })
  @ApiBody({
    type: TriggerDiscoveryDto,
    description: 'Discovery trigger request parameters',
    examples: {
      adminDashboard: {
        summary: 'Admin Dashboard Trigger',
        description: 'Triggered from admin dashboard for testing',
        value: {
          triggerSource: 'admin-dashboard',
          description:
            'Manual discovery requested by admin for testing new categories',
        },
      },
      apiIntegration: {
        summary: 'API Integration Trigger',
        description: 'Triggered by external system integration',
        value: {
          triggerSource: 'external-api',
          description: 'Automated trigger from category management system',
        },
      },
      emergency: {
        summary: 'Emergency Discovery',
        description: 'Emergency category refresh',
        value: {
          triggerSource: 'emergency-refresh',
          description:
            'Emergency discovery after detecting category structure changes',
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.ACCEPTED,
    description: 'Discovery job successfully queued for processing',
  })
  @ApiBadRequestResponse({
    description: 'Invalid request parameters',
    type: ErrorResponse,
    example: {
      statusCode: 400,
      message: 'triggerSource is required and must be a non-empty string',
      details: ['triggerSource should not be empty'],
      timestamp: '2024-01-15T10:30:00.000Z',
    },
  })
  @ApiConflictResponse({
    description:
      'Discovery job already running - duplicate requests not allowed',
    type: ErrorResponse,
    example: {
      statusCode: 409,
      message: 'Category discovery is already running',
      details: [
        'Wait for current discovery to complete before triggering another',
      ],
      timestamp: '2024-01-15T10:30:00.000Z',
    },
  })
  @ApiInternalServerErrorResponse({
    description: 'Failed to queue discovery job due to system error',
    type: ErrorResponse,
    example: {
      statusCode: 500,
      message: 'Failed to queue category discovery job',
      details: ['Job queue is currently unavailable'],
      timestamp: '2024-01-15T10:30:00.000Z',
    },
  })
  async triggerDiscovery(
    @Body() triggerData: TriggerDiscoveryDto
  ): Promise<StandardApiResponse<DiscoveryTriggerData>> {
    // Validate input
    if (!triggerData.triggerSource?.trim()) {
      throw new BadRequestException(
        'triggerSource is required and must be a non-empty string'
      );
    }

    // Check if discovery is already running to prevent duplicates
    const isActive =
      await this.categoryDiscoveryOrchestrator.isDiscoveryActive();
    if (isActive) {
      throw new ConflictException(
        'Category discovery is already running. Wait for current discovery to complete before triggering another.'
      );
    }

    try {
      const result =
        await this.categoryDiscoveryOrchestrator.handleManualDiscoveryRequest(
          triggerData.triggerSource.trim()
        );

      // Check for success - handle both single-site (jobId) and multi-site (jobIds) responses
      const effectiveJobId = result.jobId || (result.jobIds && result.jobIds[0]);
      if (!result.success || !effectiveJobId) {
        throw new BadRequestException(
          result.error || 'Failed to queue category discovery job'
        );
      }

      return createSuccessResponse<DiscoveryTriggerData>(
        {
          jobId: effectiveJobId,
          queuedAt: new Date().toISOString(),
          triggeredBy: triggerData.triggerSource.trim(),
        },
        result.message
      );
    } catch (error) {
      const errorMessage = extractErrorMessage(error);
      throw new BadRequestException(
        `Failed to queue category discovery job: ${errorMessage}`
      );
    }
  }

  /**
   * Gets current category discovery status
   * Returns information about running/queued discovery jobs and queue statistics
   *
   * @returns Promise resolving to current discovery status
   */
  @Get('status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get category discovery status',
    description: `
Retrieves the current status of category discovery operations.

**Information provided:**
- Whether discovery jobs are currently running or queued
- Number of jobs waiting in the discovery queue
- Number of jobs currently being processed
- Last scheduled discovery timestamp
- Current system timestamp for reference

**Use cases:**
- Monitoring dashboard integration
- Checking if manual trigger is needed
- System health monitoring
- Queue management and capacity planning
- Debugging discovery issues

**Performance:** This endpoint is lightweight and safe to call frequently
    `,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Current discovery status information',
  })
  @ApiInternalServerErrorResponse({
    description: 'Failed to retrieve discovery status due to system error',
    type: ErrorResponse,
    example: {
      statusCode: 500,
      message: 'Failed to retrieve category discovery status',
      details: ['Queue metrics service is currently unavailable'],
      timestamp: '2024-01-15T10:30:00.000Z',
    },
  })
  async getDiscoveryStatus(): Promise<StandardApiResponse<DiscoveryStatusData>> {
    try {
      const status =
        await this.categoryDiscoveryOrchestrator.getDiscoveryStatus();

      return createSuccessResponse(
        {
          isActive: status.discoveryJobs.processing > 0,
          queueStatus: {
            waiting: status.queueStatus.waiting,
            active: status.queueStatus.active,
          },
          lastScheduledAt: status.lastUpdate.toISOString(),
          checkedAt: new Date().toISOString(),
          systemStatus: status.systemStatus,
        },
        'Discovery status retrieved successfully'
      );
    } catch (error) {
      const errorMessage = extractErrorMessage(error);
      throw new BadRequestException(
        `Failed to retrieve category discovery status: ${errorMessage}`
      );
    }
  }
}
