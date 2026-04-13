import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { MultiSiteJobDistributorService } from './multi-site-job-distributor.service.js';
import { QueueStatsController } from './queue-stats.controller.js';
import { WorkerHealthModule } from '../worker-health/worker-health.module.js';
import { SITE_QUEUE_CONFIGS } from '@dealscrapper/shared-types';

/**
 * Module for job distribution and queue management functionality
 *
 * Uses site-specific queues (derived from SiteSource enum):
 * - jobs-dealabs, jobs-vinted, jobs-leboncoin
 * Each queue handles both 'scrape' and 'discovery' job types
 */
@Module({
  imports: [
    BullModule.registerQueue(...SITE_QUEUE_CONFIGS),
    WorkerHealthModule,
  ],
  controllers: [QueueStatsController],
  providers: [MultiSiteJobDistributorService],
  exports: [MultiSiteJobDistributorService],
})
export class JobDistributorModule {}
