import { Controller, Get, Param, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { SiteSource } from '@dealscrapper/shared-types';
import { MultiSiteJobDistributorService, QueueStats } from './multi-site-job-distributor.service.js';

/**
 * Controller for queue monitoring and statistics
 * Provides endpoints for monitoring job queues across all sites
 */
@ApiTags('Queue Monitoring')
@Controller('api/queues')
export class QueueStatsController {
  constructor(
    private readonly multiSiteDistributor: MultiSiteJobDistributorService,
  ) {}

  /**
   * Get statistics for all queues
   * @returns Array of queue stats for all sites
   */
  @Get('stats')
  @ApiOperation({
    summary: 'Get statistics for all queues',
    description: 'Returns waiting, active, completed, and failed job counts for all site-specific queues',
  })
  @ApiResponse({
    status: 200,
    description: 'Queue statistics retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        timestamp: { type: 'string', format: 'date-time' },
        queues: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              site: { type: 'string', enum: Object.values(SiteSource) },
              waiting: { type: 'number' },
              active: { type: 'number' },
              completed: { type: 'number' },
              failed: { type: 'number' },
            },
          },
        },
        total: {
          type: 'object',
          properties: {
            waiting: { type: 'number' },
            active: { type: 'number' },
            completed: { type: 'number' },
            failed: { type: 'number' },
          },
        },
      },
    },
  })
  async getAllQueueStats() {
    const queues = await this.multiSiteDistributor.getAllQueuesStats();

    // Calculate totals across all queues
    const total = queues.reduce(
      (acc, queue) => ({
        waiting: acc.waiting + queue.waiting,
        active: acc.active + queue.active,
        completed: acc.completed + queue.completed,
        failed: acc.failed + queue.failed,
      }),
      { waiting: 0, active: 0, completed: 0, failed: 0 }
    );

    return {
      timestamp: new Date().toISOString(),
      queues,
      total,
    };
  }

  /**
   * Get statistics for a specific site's queue
   * @param siteId - Site identifier (dealabs, vinted, or leboncoin)
   * @returns Queue stats for the specified site
   */
  @Get(':siteId/stats')
  @ApiOperation({
    summary: 'Get statistics for a specific site queue',
    description: 'Returns waiting, active, completed, and failed job counts for a specific site',
  })
  @ApiParam({
    name: 'siteId',
    enum: Object.values(SiteSource),
    description: 'Site identifier',
  })
  @ApiResponse({
    status: 200,
    description: 'Queue statistics retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        timestamp: { type: 'string', format: 'date-time' },
        stats: {
          type: 'object',
          properties: {
            site: { type: 'string' },
            waiting: { type: 'number' },
            active: { type: 'number' },
            completed: { type: 'number' },
            failed: { type: 'number' },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid siteId provided',
  })
  async getQueueStats(@Param('siteId') siteId: string): Promise<{ timestamp: string; stats: QueueStats }> {
    // Validate siteId
    if (!this.isValidSiteId(siteId)) {
      throw new HttpException(
        `Invalid siteId: ${siteId}. Must be one of: ${Object.values(SiteSource).join(', ')}`,
        HttpStatus.BAD_REQUEST
      );
    }

    const stats = await this.multiSiteDistributor.getQueueStats(siteId as SiteSource);

    return {
      timestamp: new Date().toISOString(),
      stats,
    };
  }

  /**
   * Pause a specific site's queue
   * @param siteId - Site identifier
   */
  @Get(':siteId/pause')
  @ApiOperation({
    summary: 'Pause a site queue',
    description: 'Pauses processing of jobs for a specific site',
  })
  @ApiParam({
    name: 'siteId',
    enum: Object.values(SiteSource),
    description: 'Site identifier',
  })
  @ApiResponse({
    status: 200,
    description: 'Queue paused successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid siteId provided',
  })
  async pauseQueue(@Param('siteId') siteId: string) {
    if (!this.isValidSiteId(siteId)) {
      throw new HttpException(
        `Invalid siteId: ${siteId}. Must be one of: ${Object.values(SiteSource).join(', ')}`,
        HttpStatus.BAD_REQUEST
      );
    }

    await this.multiSiteDistributor.pauseQueue(siteId as SiteSource);

    return {
      success: true,
      message: `Queue ${siteId} paused successfully`,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Resume a specific site's queue
   * @param siteId - Site identifier
   */
  @Get(':siteId/resume')
  @ApiOperation({
    summary: 'Resume a site queue',
    description: 'Resumes processing of jobs for a specific site',
  })
  @ApiParam({
    name: 'siteId',
    enum: Object.values(SiteSource),
    description: 'Site identifier',
  })
  @ApiResponse({
    status: 200,
    description: 'Queue resumed successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid siteId provided',
  })
  async resumeQueue(@Param('siteId') siteId: string) {
    if (!this.isValidSiteId(siteId)) {
      throw new HttpException(
        `Invalid siteId: ${siteId}. Must be one of: ${Object.values(SiteSource).join(', ')}`,
        HttpStatus.BAD_REQUEST
      );
    }

    await this.multiSiteDistributor.resumeQueue(siteId as SiteSource);

    return {
      success: true,
      message: `Queue ${siteId} resumed successfully`,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Validates if a siteId string is a valid SiteSource
   * @private
   */
  private isValidSiteId(siteId: string): siteId is SiteSource {
    return Object.values(SiteSource).includes(siteId as SiteSource);
  }
}
