import { Module } from '@nestjs/common';
import { PrismaModule } from '@dealscrapper/database';
import { SitesController } from './sites.controller.js';
import { SitesService } from './sites.service.js';
import { SiteSyncService } from './services/site-sync.service.js';

/**
 * Sites Module
 *
 * Handles site management including:
 * - Auto-syncing site definitions from code to database on startup
 * - Providing site data via REST API endpoints
 *
 * The SiteSyncService runs on module init to ensure sites are always in sync.
 */
@Module({
  imports: [PrismaModule],
  controllers: [SitesController],
  providers: [SitesService, SiteSyncService],
  exports: [SitesService, SiteSyncService],
})
export class SitesModule {}
