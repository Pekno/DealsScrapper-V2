import { Module, forwardRef } from '@nestjs/common';
import { ScheduledJobService } from './scheduled-job.service.js';
import { ScheduledJobController } from './scheduled-job.controller.js';
import { UrlFilterOptimizerModule } from '../url-filter-optimizer/url-filter-optimizer.module.js';
import { AdaptiveSchedulerModule } from '../adaptive-scheduler/adaptive-scheduler.module.js';

/**
 * Module for managing ScheduledJob lifecycle based on filter associations
 */
@Module({
  imports: [
    UrlFilterOptimizerModule,
    forwardRef(() => AdaptiveSchedulerModule),
  ],
  controllers: [ScheduledJobController],
  providers: [ScheduledJobService],
  exports: [ScheduledJobService],
})
export class ScheduledJobModule {}
