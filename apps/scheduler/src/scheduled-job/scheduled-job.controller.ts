import {
  Controller,
  Post,
  Body,
  Inject,
  forwardRef,
  Logger,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ScheduledJobService } from './scheduled-job.service.js';
import { UrlFilterOptimizerService } from '../url-filter-optimizer/url-filter-optimizer.service.js';
import { AdaptiveSchedulerService } from '../adaptive-scheduler/adaptive-scheduler.service.js';

/**
 * DTO for filter change notifications
 */
interface FilterChangeNotificationDto {
  filterId: string;
  action: 'created' | 'updated' | 'deleted';
  categoryIds?: string[]; // Categories affected by the change
}

/**
 * Controller for handling ScheduledJob lifecycle based on filter changes
 */
@ApiTags('jobs')
@Controller('scheduled-jobs')
export class ScheduledJobController {
  private readonly logger = new Logger(ScheduledJobController.name);

  constructor(
    private readonly scheduledJobService: ScheduledJobService,
    private readonly urlFilterOptimizer: UrlFilterOptimizerService,
    @Inject(forwardRef(() => AdaptiveSchedulerService))
    private readonly adaptiveSchedulerService: AdaptiveSchedulerService
  ) {}

  /**
   * Handle filter change notifications from the API service
   * Creates/updates/deletes ScheduledJobs based on filter category associations
   */
  @Post('filter-change')
  async handleFilterChange(
    @Body() notification: FilterChangeNotificationDto
  ): Promise<void> {
    const { filterId, action, categoryIds = [] } = notification;

    this.logger.debug(
      `📢 Received filter change notification: ${action} for filter ${filterId} ` +
        `affecting ${categoryIds.length} categories`
    );

    try {
      switch (action) {
        case 'created':
          if (categoryIds.length > 0) {
            await this.scheduledJobService.ensureScheduledJobsForCategories(
              categoryIds
            );
            // Trigger URL optimization for affected categories
            await this.urlFilterOptimizer.handleFilterChangeEvent(categoryIds);

            // Schedule newly created jobs immediately instead of waiting for hourly optimization
            await this.adaptiveSchedulerService.initializeScheduling(
              categoryIds
            );
          }
          break;

        case 'updated':
          if (categoryIds.length > 0) {
            await this.scheduledJobService.ensureScheduledJobsForCategories(
              categoryIds
            );
            // Trigger URL optimization for affected categories
            await this.urlFilterOptimizer.handleFilterChangeEvent(categoryIds);
          }
          break;

        case 'deleted':
          if (categoryIds.length > 0) {
            await this.scheduledJobService.cleanupUnusedScheduledJobs(
              categoryIds
            );
            // Trigger URL optimization for affected categories (may clear optimization)
            await this.urlFilterOptimizer.handleFilterChangeEvent(categoryIds);
          }
          break;

        default:
          this.logger.warn(`🤷 Unknown filter action: ${action}`);
          return;
      }

      this.logger.log(
        `✅ Processed filter change and URL optimization: ${action} for filter ${filterId}`
      );
    } catch (error) {
      this.logger.error(
        `❌ Failed to process filter change notification for ${filterId}:`,
        error
      );
      throw error;
    }
  }
}
