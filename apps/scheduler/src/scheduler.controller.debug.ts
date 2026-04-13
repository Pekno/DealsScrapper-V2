import {
  Controller,
  Post,
  HttpCode,
  HttpStatus,
  Param,
  Logger,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ScheduledJobService } from './scheduled-job/scheduled-job.service.js';
import { AdaptiveSchedulerService } from './adaptive-scheduler/adaptive-scheduler.service.js';
import { CategoryDiscoveryOrchestrator } from './category-discovery/category-discovery-orchestrator.service.js';

/**
 * Debug Controller for Scheduler Service
 *
 * This controller is only registered when NODE_ENV === 'test'
 * and provides endpoints to trigger scheduler operations on-demand for testing.
 *
 * These endpoints allow E2E tests to deterministically trigger scraping
 * and other scheduled operations without waiting for cron schedules.
 */
@ApiTags('scheduler')
@Controller('scheduler/debug')
export class SchedulerDebugController {
  private readonly logger = new Logger(SchedulerDebugController.name);

  constructor(
    private readonly scheduledJobService: ScheduledJobService,
    private readonly adaptiveSchedulerService: AdaptiveSchedulerService
  ) {}

  /**
   * Trigger a scraping cycle for all active categories
   * 
   * This endpoint allows E2E tests to initiate scraping without waiting for scheduled execution.
   * Useful for testing filter functionality after creation and validating that the adaptive 
   * scheduler can properly initialize and optimize scraping schedules on demand.
   * 
   * @returns Promise resolving to trigger confirmation with timestamp
   * @throws Error if scheduler initialization or optimization fails
   */
  @Post('trigger-scrape')
  @HttpCode(HttpStatus.OK)
  async triggerScrape(): Promise<{ message: string; timestamp: string }> {
    this.logger.log(
      '🧪 Debug endpoint triggered: Manual scraping cycle started'
    );

    try {
      // Get all active scheduled jobs
      const activeScheduledJobs = await this.scheduledJobService.getActiveScheduledJobs();
      
      if (activeScheduledJobs.length === 0) {
        this.logger.warn('⚠️ No active scheduled jobs found to trigger');
        return {
          message: 'No active scheduled jobs found to trigger',
          timestamp: new Date().toISOString(),
        };
      }

      // Trigger scraping for each active scheduled job immediately
      const scrapePromises = activeScheduledJobs.map(async (scheduledJob) => {
        // Use the public method to trigger immediate scraping
        // This directly queues jobs in Redis through MultiSiteJobDistributorService
        await this.adaptiveSchedulerService.triggerScheduledJobScrape(
          scheduledJob.id,
          scheduledJob.category.id
        );
      });

      await Promise.all(scrapePromises);

      const timestamp = new Date().toISOString();
      const message = `Scraping cycle triggered successfully for ${activeScheduledJobs.length} categories`;

      this.logger.log(`✅ ${message} at ${timestamp}`);

      return {
        message,
        timestamp,
      };
    } catch (error) {
      this.logger.error('❌ Debug scraping trigger failed:', error);
      throw error;
    }
  }

  /**
   * Trigger scraping for a specific category by slug
   * 
   * Allows targeted testing of specific category scraping workflows. This is particularly
   * useful for E2E tests that create filters for specific categories and need to validate
   * that the scraping and matching process works correctly for that category.
   * 
   * @param categorySlug - The slug identifier of the category to scrape
   * @returns Promise resolving to trigger confirmation with category info and timestamp
   * @throws Error if category scraping setup or execution fails
   */
  @Post('trigger-category-scrape/:categorySlug')
  @HttpCode(HttpStatus.OK)
  async triggerCategoryScrape(@Param('categorySlug') categorySlug: string): Promise<{
    message: string;
    categorySlug: string;
    timestamp: string;
  }> {
    this.logger.log(
      `🧪 Debug endpoint triggered: Manual scraping for category ${categorySlug}`
    );

    try {
      // Get the specific scheduled job for this category
      const activeJobs = await this.scheduledJobService.getActiveScheduledJobs();
      const targetJob = activeJobs.find(job => job.category.slug === categorySlug);

      if (!targetJob) {
        this.logger.warn(`⚠️ No active scheduled job found for category: ${categorySlug}`);
        return {
          message: `No active scheduled job found for category: ${categorySlug}`,
          categorySlug,
          timestamp: new Date().toISOString(),
        };
      }

      // Trigger scraping for this specific category immediately (resolve slug to ID)
      await this.adaptiveSchedulerService.triggerScheduledJobScrape(
        targetJob.id,
        targetJob.category.id
      );

      const timestamp = new Date().toISOString();
      const message = `Scraping job triggered for category: ${categorySlug}`;

      this.logger.log(`✅ ${message} at ${timestamp}`);

      return {
        message,
        categorySlug,
        timestamp,
      };
    } catch (error) {
      this.logger.error(
        `❌ Debug category scraping trigger failed for ${categorySlug}:`,
        error
      );
      throw error;
    }
  }
}
