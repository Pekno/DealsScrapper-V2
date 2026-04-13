import { Injectable, Logger } from '@nestjs/common';
import { PrismaService, ScheduledJob, Prisma } from '@dealscrapper/database';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  AdaptiveSchedulingMetrics,
  CategoryStructure,
} from '@dealscrapper/shared-types';
import { MultiSiteJobDistributorService } from '../job-distributor/multi-site-job-distributor.service.js';
import { ScheduledJobService } from '../scheduled-job/scheduled-job.service.js';
import type { JobPriority } from '../types/scheduler.types.js';
import {
  JobPriority as ConsolidatedPriority,
  type JobPriorityLevel,
} from '../types/job.types.js';
import { SiteSource } from '@dealscrapper/shared-types';

/** Type for ScheduledJob with Category relation */
type ScheduledJobWithCategory = Prisma.ScheduledJobGetPayload<{
  include: { category: true };
}>;

/** Configuration constants for adaptive scheduling behavior */
const SCHEDULING_CONFIG = {
  /** Minimum time between scrapes (5 minutes) */
  MIN_SCRAPE_INTERVAL_MS: 5 * 60 * 1000,
  /** Maximum time between scrapes (30 minutes) */
  MAX_SCRAPE_INTERVAL_MS: 30 * 60 * 1000,
  /** Base scraping interval before adjustments (10 minutes) */
  BASE_INTERVAL_MS: 10 * 60 * 1000,
  /** Hours considered peak activity for deal posting */
  PEAK_HOURS: [9, 10, 11, 12, 13, 14, 18, 19, 20] as const,
  /** Activity level thresholds for frequency calculation */
  ACTIVITY_THRESHOLDS: {
    HIGH: 10,
    MEDIUM: 5,
    LOW: 2,
  } as const,
  /** User count thresholds for priority classification */
  USER_THRESHOLDS: {
    HIGH_PRIORITY: 50,
    LOW_PRIORITY: 10,
    MILESTONE_LOW_PRIORITY: 5,
  } as const,
  /** Temperature threshold for hot categories */
  HOT_CATEGORY_TEMPERATURE: 100,
  /** Temperature threshold for high priority */
  HIGH_PRIORITY_TEMPERATURE: 200,
} as const;

/** Frequency adjustment multipliers for different conditions */
const FREQUENCY_MULTIPLIERS = {
  HIGH_ACTIVITY: 0.5,
  MEDIUM_ACTIVITY: 0.7,
  LOW_ACTIVITY: 0.9,
  VERY_LOW_ACTIVITY: 1.2,
  PEAK_HOURS: 0.7,
  HOT_CATEGORY: 0.8,
  LOW_EFFICIENCY: 0.8,
  HIGH_EFFICIENCY: 1.3,
  USER_FACTOR_MIN: 0.3,
} as const;

/** Category metrics for scheduling calculations */
interface CategoryMetrics {
  readonly dealCount: number;
  readonly avgTemperature: number;
  readonly userCount: number;
}

/**
 * Service for adaptive scheduling of scraping jobs based on user activity and category metrics
 * Orchestrates job creation and distribution via site-specific queues (dealabs, vinted, leboncoin)
 */
@Injectable()
export class AdaptiveSchedulerService {
  private readonly logger = new Logger(AdaptiveSchedulerService.name);
  private readonly scheduledJobs = new Map<string, NodeJS.Timeout>();
  private readonly schedulingLock = new Map<string, Promise<void>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly scheduledJobService: ScheduledJobService,
    private readonly multiSiteDistributor: MultiSiteJobDistributorService
  ) {}

  /**
   * Initializes adaptive scheduling system for all active ScheduledJobs
   * Sets up interval-based scraping frequencies based on user activity and category metrics
   * @returns Promise that resolves when scheduling is initialized
   */
  async initializeScheduling(categoryIds?: string[]): Promise<void> {
    this.logger.log('🔄 Initializing adaptive scheduling...');

    // Get active scheduled jobs
    const activeScheduledJobs =
      await this.scheduledJobService.getActiveScheduledJobs(categoryIds);

    this.logger.log(
      `📊 Found ${activeScheduledJobs.length} active scheduled jobs${categoryIds ? ` for ${categoryIds.length} categories` : ''}`
    );

    // RECOVERY FIX: Check for overdue jobs and handle them
    const now = new Date();
    let overdueJobs = 0;
    let immediateJobs = 0;

    for (const scheduledJob of activeScheduledJobs) {
      const nextScheduled = scheduledJob.nextScheduledAt;

      if (!nextScheduled || nextScheduled <= now) {
        // Job is overdue or never scheduled - run immediately
        overdueJobs++;
        await this.scheduleJobFromScheduledJob(scheduledJob, true); // scheduleNow = true
      } else {
        // Job is properly scheduled for future
        await this.scheduleJobFromScheduledJob(scheduledJob, false);
      }
    }

    if (overdueJobs > 0) {
      this.logger.log(
        `🚀 Triggered immediate execution for ${overdueJobs} overdue jobs`
      );
    }

    this.logger.log(
      `✅ Scheduled ${activeScheduledJobs.length} jobs for adaptive scraping (${overdueJobs} immediate, ${activeScheduledJobs.length - overdueJobs} future)`
    );
  }

  /**
   * Schedules a job based on ScheduledJob record with adaptive frequency calculation
   * @param scheduledJob - ScheduledJob record with category data
   * @returns Promise that resolves when job is scheduled
   */
  private async scheduleJobFromScheduledJob(
    scheduledJob: ScheduledJob & {
      category: {
        id: string;
        slug: string;
        name: string;
        siteId: string;
        sourceUrl: string;
        userCount: number;
        dealCount: number;
        avgTemperature: number;
        isActive: boolean;
      };
    },
    scheduleNow: boolean = false
  ): Promise<void> {
    const { category } = scheduledJob;
    const categoryId = category.id;

    // Prevent race conditions by ensuring only one scheduling operation per category
    const existingOperation = this.schedulingLock.get(categoryId);
    if (existingOperation) {
      await existingOperation;
      return;
    }

    // Create lock promise for this scheduling operation
    const schedulingPromise = this.executeScheduling(scheduledJob, scheduleNow);
    this.schedulingLock.set(categoryId, schedulingPromise);

    try {
      await schedulingPromise;
    } finally {
      // Clean up the lock after operation completes
      this.schedulingLock.delete(categoryId);
    }
  }

  /**
   * Executes the actual scheduling logic with proper cleanup
   * @private
   */
  private async executeScheduling(
    scheduledJob: ScheduledJob & {
      category: {
        id: string;
        slug: string;
        name: string;
        siteId: string;
        sourceUrl: string;
        userCount: number;
        dealCount: number;
        avgTemperature: number;
        isActive: boolean;
      };
    },
    scheduleNow: boolean = false
  ): Promise<void> {
    const { category } = scheduledJob;
    const categoryId = category.id;

    this.clearSchedule(categoryId);

    // Calculate optimal interval for this category
    const intervalMs = this.calculateOptimalInterval({
      slug: category.slug,
      userCount: category.userCount,
      dealCount: category.dealCount,
      avgTemperature: category.avgTemperature,
      isActive: category.isActive,
    } as CategoryStructure);

    this.logger.log(
      `📅 Scheduling ${category.slug} (${categoryId}) with interval: ${intervalMs}ms (${Math.round(intervalMs / 60000)} minutes)`
    );

    // If scheduleNow is true, run immediately first
    if (scheduleNow) {
      this.logger.log(`📅 Running immediate check on ${category.slug} (${categoryId})`);
      void this.triggerScheduledJobScrape(scheduledJob.id, categoryId);
    } else {
      // Set initial nextScheduledAt for normal scheduling
      const initialNextScheduledAt = new Date(Date.now() + intervalMs);
      await this.scheduledJobService.updateNextScheduledTime(
        scheduledJob.id,
        initialNextScheduledAt
      );
      this.logger.debug(
        `🕒 Initial nextScheduledAt for ${category.slug} (${categoryId}) set to ${initialNextScheduledAt.toISOString()}`
      );
    }

    // Set up recurring schedule with setInterval
    // Note: triggerScheduledJobScrape will update nextScheduledAt after each execution
    const timeoutId = setInterval(() => {
      void this.triggerScheduledJobScrape(scheduledJob.id, categoryId);
    }, intervalMs);

    this.scheduledJobs.set(categoryId, timeoutId);

    this.logger.log(
      `✅ Successfully scheduled recurring job for ${category.slug} (${categoryId}) (every ${Math.round(intervalMs / 60000)} minutes)`
    );
  }

  /**
   * @deprecated Use scheduleJobFromScheduledJob instead
   * Schedules a category for periodic scraping with adaptive frequency based on user activity and metrics
   * @param category - Category with user count and performance data
   * @returns Promise that resolves when category is scheduled
   */
  async scheduleCategory(category: CategoryStructure): Promise<void> {
    const categoryId = category.id;
    this.clearSchedule(categoryId);

    const intervalMs = this.calculateOptimalInterval(category);

    this.logger.log(
      `📅 Scheduling ${category.slug} (${categoryId}) with interval: ${intervalMs}ms (${Math.round(intervalMs / 60000)} minutes)`
    );

    const timeoutId = setInterval(() => {
      void this.triggerCategoryScrape(categoryId);
    }, intervalMs);

    this.scheduledJobs.set(categoryId, timeoutId);
  }

  /**
   * Updates scheduling frequency for a category based on current metrics and activity
   * Removes scheduling if category becomes inactive or has no monitoring users
   * @param categorySlug - Unique identifier for the category
   * @returns Promise that resolves when schedule is updated
   */
  async updateCategorySchedule(categorySlug: string): Promise<void> {
    const category = await this.getCategoryForScheduling(categorySlug);

    if (!category) {
      // Cannot resolve to ID, try clearing by slug (best-effort for deprecated path)
      return;
    }

    this.clearSchedule(category.id);
    await this.scheduleCategory(category);
  }

  /**
   * Removes all scheduled jobs and cleans up timer resources
   * Called during application shutdown to prevent memory leaks
   */
  clearAllSchedules(): void {
    const schedulesCount = this.scheduledJobs.size;
    const locksCount = this.schedulingLock.size;

    // Clear all scheduled intervals
    this.scheduledJobs.forEach((timeoutId, categorySlug) => {
      try {
        clearInterval(timeoutId);
        this.logger.debug(`Cleared schedule for ${categorySlug}`);
      } catch (error) {
        this.logger.warn(
          `Failed to clear schedule for ${categorySlug}:`,
          error
        );
      }
    });

    // Clear all maps to prevent memory leaks
    this.scheduledJobs.clear();
    this.schedulingLock.clear();

    this.logger.log(
      `🧹 Cleared ${schedulesCount} scheduled jobs and ${locksCount} locks`
    );
  }

  /**
   * Gets current scheduling performance metrics and operational statistics
   * @returns Metrics including active schedules, efficiency rates, and deal discovery rates
   */
  async getSchedulingMetrics(): Promise<AdaptiveSchedulingMetrics> {
    const activeSchedules = this.scheduledJobs.size;
    const categories = await this.getCategoriesForScheduledItems();

    const { avgEfficiency, avgDealsPerHour } =
      this.calculateAverageMetrics(categories);

    return {
      activeSchedules,
      avgEfficiency,
      avgDealsPerHour,
      categoriesMonitored: activeSchedules,
      lastUpdateTime: new Date(),
    };
  }

  /**
   * Optimizes all schedules based on current performance metrics and user activity
   * Runs automatically every hour to adjust frequencies based on recent performance data
   */
  @Cron(CronExpression.EVERY_HOUR)
  async optimizeSchedules(): Promise<void> {
    this.logger.log('⚡ Running hourly schedule optimization...');

    const activeScheduledJobs =
      await this.scheduledJobService.getActiveScheduledJobs();

    await Promise.all(
      activeScheduledJobs.map((scheduledJob: ScheduledJobWithCategory) =>
        this.scheduleJobFromScheduledJob(scheduledJob)
      )
    );

    this.logger.log(
      `✅ Schedule optimization complete: ${activeScheduledJobs.length} scheduled jobs`
    );
  }

  /**
   * Cleans up all scheduled jobs when the service is being destroyed
   * Implements NestJS lifecycle hook for graceful shutdown
   */
  onModuleDestroy(): void {
    this.logger.log(
      'AdaptiveSchedulerService is being destroyed, cleaning up resources...'
    );
    try {
      this.clearAllSchedules();
      this.logger.log(
        'AdaptiveSchedulerService cleanup completed successfully'
      );
    } catch (error) {
      this.logger.error(
        'Error during AdaptiveSchedulerService cleanup:',
        error
      );
    }
  }

  /**
   * Calculates optimal scraping interval based on user activity, deal frequency, and time patterns
   * @param category - Category with user metrics and performance data
   * @returns Calculated interval in milliseconds, bounded by configured limits
   */
  private calculateOptimalInterval(category: CategoryStructure): number {
    let intervalMs = SCHEDULING_CONFIG.BASE_INTERVAL_MS;

    // Apply user-based frequency adjustment (more users = higher frequency)
    intervalMs *= this.calculateUserFactor(category.userCount);

    // Apply deal activity-based adjustment (more deals = higher frequency)
    intervalMs *= this.calculateDealCountFactor(category.dealCount);

    // Apply time-of-day adjustment (peak hours = higher frequency)
    intervalMs *= this.calculatePeakHoursFactor();

    // Apply category temperature adjustment (hot categories = higher frequency)
    if (this.isCategoryHot(category.avgTemperature)) {
      intervalMs *= FREQUENCY_MULTIPLIERS.HOT_CATEGORY;
    }

    return this.boundInterval(intervalMs);
  }

  /**
   * Calculates frequency multiplier based on user count monitoring the category
   * Higher user count results in more frequent scraping to catch deals quickly
   */
  private calculateUserFactor(userCount: number): number {
    const validUserCount = this.safeNumber(userCount, 0);
    return Math.max(
      FREQUENCY_MULTIPLIERS.USER_FACTOR_MIN,
      1 - validUserCount / 100
    );
  }

  /**
   * Calculates frequency multiplier based on total deal count in category
   * Categories with more deals get scraped more frequently
   */
  private calculateDealCountFactor(dealCount: number): number {
    const validDealCount = this.safeNumber(dealCount, 0);
    const { HIGH, MEDIUM, LOW } = SCHEDULING_CONFIG.ACTIVITY_THRESHOLDS;

    // Adjust thresholds for deal count (deals are cumulative, not per hour)
    const HIGH_DEALS = HIGH * 24 * 7; // Equivalent to high deals per hour over a week
    const MEDIUM_DEALS = MEDIUM * 24 * 7;
    const LOW_DEALS = LOW * 24 * 7;

    if (validDealCount > HIGH_DEALS) return FREQUENCY_MULTIPLIERS.HIGH_ACTIVITY;
    if (validDealCount > MEDIUM_DEALS)
      return FREQUENCY_MULTIPLIERS.MEDIUM_ACTIVITY;
    if (validDealCount > LOW_DEALS) return FREQUENCY_MULTIPLIERS.LOW_ACTIVITY;

    return FREQUENCY_MULTIPLIERS.VERY_LOW_ACTIVITY;
  }

  /**
   * Calculates frequency multiplier for current time of day
   * Peak business hours get higher frequency due to increased deal posting activity
   */
  private calculatePeakHoursFactor(): number {
    const currentHour = new Date().getHours();
    return (SCHEDULING_CONFIG.PEAK_HOURS as readonly number[]).includes(
      currentHour
    )
      ? FREQUENCY_MULTIPLIERS.PEAK_HOURS
      : 1;
  }

  /**
   * Ensures interval is within acceptable bounds and handles invalid numeric values
   * Protects against extreme values that could overload or underutilize the system
   */
  private boundInterval(intervalMs: number): number {
    const safeInterval = this.safeNumber(
      intervalMs,
      SCHEDULING_CONFIG.MIN_SCRAPE_INTERVAL_MS
    );

    return Math.round(
      Math.max(
        SCHEDULING_CONFIG.MIN_SCRAPE_INTERVAL_MS,
        Math.min(SCHEDULING_CONFIG.MAX_SCRAPE_INTERVAL_MS, safeInterval)
      )
    );
  }

  /**
   * Checks if category is considered "hot" based on community temperature rating
   */
  private isCategoryHot(avgTemperature: number | null): boolean {
    return !!(
      avgTemperature &&
      avgTemperature > SCHEDULING_CONFIG.HOT_CATEGORY_TEMPERATURE
    );
  }

  /**
   * Safe numeric conversion with fallback for invalid or missing values
   * Prevents NaN errors in mathematical calculations
   */
  private safeNumber(
    value: number | null | undefined,
    fallback: number
  ): number {
    return typeof value === 'number' && !isNaN(value) ? value : fallback;
  }

  /**
   * Retrieves category data suitable for scheduling, ensuring it meets activity requirements
   */
  private async getCategoryForScheduling(
    categorySlug: string
  ): Promise<CategoryStructure | null> {
    // Note: Category has compound unique [source, slug], so we use findFirst
    const category = await this.prisma.category.findFirst({
      where: { slug: categorySlug },
    });

    if (!category?.isActive || category.userCount === 0) {
      return null;
    }

    return {
      id: category.id,
      slug: category.slug,
      name: category.name,
      siteId: category.siteId,
      sourceUrl: category.sourceUrl,
      parentId: category.parentId ?? undefined,
      level: category.level,
      description: category.description ?? undefined,
      dealCount: category.dealCount,
      avgTemperature: category.avgTemperature,
      popularBrands: category.popularBrands,
      isActive: category.isActive,
      userCount: category.userCount,
    };
  }

  /**
   * Retrieves category metrics for currently scheduled items
   */
  private async getCategoriesForScheduledItems(): Promise<
    Array<{ dealCount: number; avgTemperature: number }>
  > {
    const categories = await this.prisma.category.findMany({
      where: {
        id: {
          in: Array.from(this.scheduledJobs.keys()),
        },
      },
    });

    // Extract only needed fields (following project guideline: use include, not select)
    return categories.map(({ dealCount, avgTemperature }) => ({
      dealCount,
      avgTemperature,
    }));
  }

  /**
   * Calculates average performance metrics from category data
   */
  private calculateAverageMetrics(
    categories: Array<{ dealCount: number; avgTemperature: number }>
  ) {
    if (categories.length === 0) {
      return { avgEfficiency: 0, avgDealsPerHour: 0 };
    }

    const avgDealCount =
      categories.reduce((sum, category) => sum + category.dealCount, 0) /
      categories.length;

    const avgTemperature =
      categories.reduce((sum, category) => sum + category.avgTemperature, 0) /
      categories.length;

    // Estimate deals per hour based on total deal count and temperature
    // Higher temperature categories likely have more frequent deal posting
    const estimatedDealsPerHour =
      (avgDealCount / (24 * 7)) * (avgTemperature / 100);

    return {
      avgEfficiency: avgTemperature, // Use temperature as efficiency metric
      avgDealsPerHour: estimatedDealsPerHour,
    };
  }

  /**
   * Retrieves active categories that have users monitoring them for deal notifications
   * @returns Categories sorted by user count in descending order for priority scheduling
   */
  private async getActiveCategoriesWithUsers(): Promise<CategoryStructure[]> {
    const categories = await this.prisma.category.findMany({
      where: {
        isActive: true,
        userCount: { gt: 0 },
      },
      orderBy: {
        userCount: 'desc',
      },
    });

    return categories.map((category) => ({
      id: category.id,
      slug: category.slug,
      name: category.name,
      siteId: category.siteId,
      sourceUrl: category.sourceUrl,
      parentId: category.parentId ?? undefined,
      level: category.level,
      description: category.description ?? undefined,
      dealCount: category.dealCount,
      avgTemperature: category.avgTemperature,
      popularBrands: category.popularBrands,
      isActive: category.isActive,
      userCount: category.userCount,
    }));
  }

  /**
   * Queues a scrape job for a ScheduledJob with execution tracking
   * Priority is based on user count, activity metrics, and category temperature
   * @param scheduledJobId - ScheduledJob ID for execution tracking
   * @param categorySlug - Category identifier to scrape
   */
  /**
   * Core job distribution logic for category scraping
   * Extracts common logic from triggerScheduledJobScrape and triggerCategoryScrape
   * @param categorySlug - Category identifier to scrape
   * @param scheduledJobId - Optional ScheduledJob ID for tracking
   * @param optimizedQuery - Optional optimized query parameters from ScheduledJob
   * @returns Category data and whether job was created
   * @throws Error if category not found
   */
  private async distributeCategoryJob(
    categoryId: string,
    scheduledJobId?: string,
    optimizedQuery?: string | null
  ): Promise<{ category: Prisma.CategoryGetPayload<{}>; jobCreated: boolean }> {
    // Fetch category by ID (unique, faster than slug-based lookup)
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
    });

    if (!category) {
      this.logger.warn(
        `⚠️ Category ${categoryId} no longer exists. Clearing schedule.`
      );
      this.clearSchedule(categoryId);
      throw new Error(`Category ${categoryId} not found`);
    }

    const priority = this.determinePriority(category);

    // Route to site-specific queue based on category siteId
    if (!category.siteId || !this.isValidSiteSource(category.siteId)) {
      throw new Error(
        `Category ${category.slug} (${categoryId}) has invalid or missing siteId: ${category.siteId}. ` +
        `All categories must have a valid siteId (dealabs, vinted, or leboncoin).`
      );
    }

    this.logger.debug(`Routing ${category.slug} (${categoryId}) to ${category.siteId} queue`);
    const job = await this.multiSiteDistributor.distributeScrapeJob(
      categoryId,
      category.slug,
      category.siteId as SiteSource,
      {
        priority: this.mapPriorityToConsolidated(priority),
        optimizedQuery: optimizedQuery,
      }
    );

    const jobCreated = !!job;

    if (jobCreated) {
      this.logger.log(
        `✅ Queued scrape job for ${category.slug} (${categoryId}) with priority: ${priority}${scheduledJobId ? ` (scheduled job: ${scheduledJobId})` : ''}`
      );
    } else {
      this.logger.debug(
        `⏭️ Skipped creating duplicate job for ${category.slug} (${categoryId}) - job already exists in queue`
      );
    }

    return { category, jobCreated };
  }

  public async triggerScheduledJobScrape(
    scheduledJobId: string,
    categoryId: string
  ): Promise<void> {
    try {
      this.logger.debug(
        `🎯 Triggering scheduled scrape for job ${scheduledJobId} (categoryId: ${categoryId})`
      );

      // First check if ScheduledJob still exists (it might be deleted during test cleanup)
      const scheduledJob = await this.prisma.scheduledJob.findUnique({
        where: { id: scheduledJobId },
      });

      if (!scheduledJob) {
        this.logger.warn(
          `⚠️ ScheduledJob ${scheduledJobId} no longer exists (likely deleted during cleanup). Clearing schedule for ${categoryId}.`
        );
        this.clearSchedule(categoryId);
        return;
      }

      // Distribute job using extracted common logic
      const { category } = await this.distributeCategoryJob(
        categoryId,
        scheduledJobId,
        scheduledJob.optimizedQuery
      );

      // CRITICAL FIX: Update nextScheduledAt after each trigger
      const intervalMs = this.calculateOptimalInterval({
        slug: category.slug,
        userCount: category.userCount,
        dealCount: category.dealCount,
        avgTemperature: category.avgTemperature,
        isActive: category.isActive,
      } as CategoryStructure);

      const nextScheduledAt = new Date(Date.now() + intervalMs);

      await this.scheduledJobService.updateNextScheduledTime(
        scheduledJobId,
        nextScheduledAt
      );

      this.logger.debug(
        `🕒 Updated nextScheduledAt for ${category.slug} (${categoryId}) to ${nextScheduledAt.toISOString()} (in ${Math.round(intervalMs / 60000)} minutes)`
      );
    } catch (error) {
      this.logger.error(
        `❌ Failed to trigger scrape for scheduled job ${scheduledJobId} (categoryId: ${categoryId}):`,
        error
      );
      // Note: Job queueing failures are scheduler responsibility
      // Actual execution stats will be updated by scraper when jobs are processed
    }
  }

  /**
   * @deprecated Use triggerScheduledJobScrape instead
   * Queues a scrape job for a specific category with dynamically determined priority
   * Priority is based on user count, activity metrics, and category temperature
   * @param categoryId - Category ID to scrape
   */
  private async triggerCategoryScrape(categoryId: string): Promise<void> {
    try {
      this.logger.debug(
        `🎯 Triggering adaptive scrape for categoryId: ${categoryId}`
      );

      // Use extracted common logic
      await this.distributeCategoryJob(categoryId);
    } catch (error) {
      this.logger.error(
        `❌ Failed to trigger scrape for ${categoryId}:`,
        error
      );
    }
  }

  /**
   * Maps old priority strings to consolidated job priority levels
   */
  private mapPriorityToConsolidated(
    oldPriority: JobPriority
  ): JobPriorityLevel {
    switch (oldPriority) {
      case 'high':
        return ConsolidatedPriority.HIGH;
      case 'normal':
        return ConsolidatedPriority.NORMAL;
      case 'low':
        return ConsolidatedPriority.LOW;
      default:
        return ConsolidatedPriority.NORMAL;
    }
  }

  /**
   * Determines scraping priority based on user engagement and activity metrics
   */
  private determinePriority(
    category: {
      userCount: number;
      avgTemperature: number;
      dealCount: number;
    } | null
  ): JobPriority {
    if (!category) {
      return 'low';
    }

    const { userCount, avgTemperature, dealCount } = category;

    // High priority: many users OR high temperature OR many deals
    if (
      userCount > SCHEDULING_CONFIG.USER_THRESHOLDS.HIGH_PRIORITY ||
      avgTemperature > SCHEDULING_CONFIG.HIGH_PRIORITY_TEMPERATURE ||
      dealCount > 1000
    ) {
      return 'high';
    }

    // Low priority: few users AND low temperature AND few deals
    if (
      userCount < SCHEDULING_CONFIG.USER_THRESHOLDS.LOW_PRIORITY &&
      avgTemperature < 50 &&
      dealCount < 100
    ) {
      return 'low';
    }

    return 'normal';
  }

  /**
   * Removes scheduled job for a specific category and cleans up resources
   * Now with proper race condition protection and error handling
   */
  private clearSchedule(categoryId: string): void {
    try {
      const existingTimeout = this.scheduledJobs.get(categoryId);
      if (existingTimeout) {
        clearInterval(existingTimeout);
        this.scheduledJobs.delete(categoryId);
        this.logger.debug(`🧹 Cleared schedule for ${categoryId}`);
      }

      // Also clean up any pending scheduling locks for this category
      if (this.schedulingLock.has(categoryId)) {
        this.schedulingLock.delete(categoryId);
        this.logger.debug(`🔓 Cleared scheduling lock for ${categoryId}`);
      }
    } catch (error) {
      this.logger.error(`Error clearing schedule for ${categoryId}:`, error);
    }
  }

  /**
   * Validates if a string is a valid SiteSource enum value
   * @param source - String to validate
   * @returns True if source is a valid SiteSource
   */
  private isValidSiteSource(source: string): source is SiteSource {
    return Object.values(SiteSource).includes(source as SiteSource);
  }
}
