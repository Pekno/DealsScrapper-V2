import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
  PuppeteerPoolService,
  type PoolStats,
} from './puppeteer-pool.service.js';
import {
  createSuccessResponse,
  type StandardApiResponse,
} from '@dealscrapper/shared-types';

@ApiTags('scraper')
@Controller('puppeteer-pool')
export class PuppeteerPoolController {
  constructor(private readonly puppeteerPool: PuppeteerPoolService) {}

  @Get('stats')
  @ApiOperation({
    summary: 'Get Puppeteer pool statistics',
    description:
      'Returns detailed statistics about the Puppeteer browser instance pool including active instances, queue status, memory usage, and performance metrics.',
  })
  @ApiResponse({
    status: 200,
    description: 'Pool statistics retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        totalInstances: {
          type: 'number',
          description: 'Total browser instances in pool',
        },
        activeInstances: {
          type: 'number',
          description: 'Currently active browser instances',
        },
        idleInstances: {
          type: 'number',
          description: 'Available idle browser instances',
        },
        maxInstances: {
          type: 'number',
          description: 'Maximum allowed instances',
        },
        queuedRequests: {
          type: 'number',
          description: 'Requests waiting for browser instance',
        },
        totalRequests: {
          type: 'number',
          description: 'Total requests processed',
        },
        averageResponseTime: {
          type: 'number',
          description: 'Average response time in milliseconds',
        },
        memoryUsage: { type: 'object', description: 'Memory usage statistics' },
        uptime: { type: 'number', description: 'Pool uptime in seconds' },
      },
    },
  })
  getPoolStats(): StandardApiResponse<PoolStats> {
    const stats = this.puppeteerPool.getStats();
    return createSuccessResponse(
      stats,
      'Pool statistics retrieved successfully'
    );
  }
}
