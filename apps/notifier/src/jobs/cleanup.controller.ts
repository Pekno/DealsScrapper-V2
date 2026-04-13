import { Controller, Get, Post } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { createSuccessResponse } from '@dealscrapper/shared-types';
import { NotificationCleanupJob } from './notification-cleanup.job.js';

@ApiTags('Cleanup')
@Controller('cleanup')
export class CleanupController {
  constructor(private readonly cleanupJob: NotificationCleanupJob) {}

  /**
   * Get cleanup preview (what would be deleted)
   * GET /cleanup/preview
   */
  @Get('preview')
  @ApiOperation({
    summary: 'Get cleanup preview',
    description: 'Preview what notifications would be deleted by cleanup job',
  })
  @ApiResponse({
    status: 200,
    description: 'Cleanup preview retrieved successfully',
  })
  async getCleanupPreview() {
    return this.cleanupJob.getCleanupPreview();
  }

  /**
   * Get current system statistics
   * GET /cleanup/stats
   */
  @Get('stats')
  @ApiOperation({
    summary: 'Get system statistics',
    description: 'Get current notification system statistics',
  })
  @ApiResponse({
    status: 200,
    description: 'System statistics retrieved successfully',
  })
  async getSystemStats() {
    return this.cleanupJob.getSystemStats();
  }

  /**
   * Manually trigger cleanup job (for testing/admin)
   * POST /cleanup/run
   */
  @Post('run')
  @ApiOperation({
    summary: 'Run cleanup job',
    description:
      'Manually trigger notification cleanup job for testing or admin purposes',
  })
  @ApiResponse({ status: 200, description: 'Cleanup completed successfully' })
  async runCleanup() {
    const stats = await this.cleanupJob.performCleanup();
    return createSuccessResponse(stats, 'Cleanup completed successfully');
  }
}
