import { Module, forwardRef } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '@dealscrapper/database';
import { AdaptiveSchedulerService } from './adaptive-scheduler.service.js';
import { JobDistributorModule } from '../job-distributor/job-distributor.module.js';
import { ScheduledJobModule } from '../scheduled-job/scheduled-job.module.js';

/**
 * Module for adaptive scheduling functionality
 * Manages dynamic scraping frequencies based on user activity and category metrics
 */
@Module({
  imports: [
    // ScheduleModule.forRoot() removed - already configured in main SchedulerModule
    PrismaModule,
    JobDistributorModule,
    forwardRef(() => ScheduledJobModule),
  ],
  providers: [AdaptiveSchedulerService],
  exports: [AdaptiveSchedulerService],
})
export class AdaptiveSchedulerModule {}
