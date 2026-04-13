import { Controller, Post, Get, Param, Logger } from '@nestjs/common';
import { CategorySyncService } from './category-sync.service.js';

/**
 * Category Sync Controller
 *
 * HTTP endpoints for category synchronization management
 */
@Controller('api/category-sync')
export class CategorySyncController {
  private readonly logger = new Logger(CategorySyncController.name);

  constructor(private readonly categorySyncService: CategorySyncService) {}

  /**
   * Trigger manual sync for all sites
   *
   * POST /api/category-sync/trigger
   */
  @Post('trigger')
  async triggerManualSync() {
    this.logger.log('📡 Manual category sync triggered via API');
    return await this.categorySyncService.triggerManualSync();
  }

  /**
   * Trigger manual sync for specific site
   *
   * POST /api/category-sync/trigger/:siteId
   */
  @Post('trigger/:siteId')
  async triggerSiteSync(@Param('siteId') siteId: string) {
    this.logger.log(`📡 Manual category sync triggered for ${siteId} via API`);
    return await this.categorySyncService.triggerManualSync(siteId);
  }

  /**
   * Get sync status for monitoring
   *
   * GET /api/category-sync/status
   */
  @Get('status')
  async getSyncStatus() {
    return await this.categorySyncService.getSyncStatus();
  }
}
