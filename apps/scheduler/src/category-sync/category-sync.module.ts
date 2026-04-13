import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { CategorySyncService } from './category-sync.service.js';
import { CategorySyncController } from './category-sync.controller.js';

/**
 * Category Sync Module
 *
 * Provides daily category synchronization across all sites:
 * - Dealabs
 * - Vinted
 * - LeBonCoin
 *
 * Features:
 * - Automated daily sync at 3 AM
 * - Manual sync trigger via HTTP API
 * - Sync status monitoring
 */
@Module({
  imports: [HttpModule],
  controllers: [CategorySyncController],
  providers: [CategorySyncService],
  exports: [CategorySyncService],
})
export class CategorySyncModule {}
