import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue, Job } from 'bull';
import { SiteSource, getSiteQueueName } from '@dealscrapper/shared-types';
import { JobType, JobPriority, type ScrapeJobData, type JobPriorityLevel } from '../types/job.types.js';
import { SITE_URL_CONFIGS } from '../url-filter-optimizer/site-url-configs.js';

/**
 * Discovery job data for category discovery
 */
export interface DiscoveryJobData {
  siteId: SiteSource;
  triggeredBy: string;
  timestamp: string;
}

/**
 * Union type for all job types that can be processed by site-specific queues
 */
export type SiteQueueJobData = ScrapeJobData | DiscoveryJobData;

/**
 * Multi-site job distribution service using isolated queues per site
 * Implements Phase 3 of multi-site scraping architecture
 *
 * Architecture:
 * - Separate Bull queues per site (derived from SiteSource enum)
 * - Queue names defined in @dealscrapper/shared-types (QUEUE_NAMES)
 * - Jobs are routed to the correct queue based on siteId (SiteSource)
 * - Each queue is isolated to prevent cross-site interference
 * - Queue stats provided for monitoring dashboard
 * - Each queue handles both 'scrape' and 'discovery' job types
 *
 * Note: @InjectQueue decorators require compile-time string literals,
 * so we use QUEUE_NAMES constants for documentation but literals in decorators.
 */
@Injectable()
export class MultiSiteJobDistributorService implements OnModuleDestroy {
  private readonly logger = new Logger(MultiSiteJobDistributorService.name);
  private readonly queues = new Map<SiteSource, Queue<SiteQueueJobData>>();

  constructor(
    // Queue names dynamically derived from SiteSource enum
    @InjectQueue(getSiteQueueName(SiteSource.DEALABS)) private readonly dealabsQueue: Queue<SiteQueueJobData>,
    @InjectQueue(getSiteQueueName(SiteSource.VINTED)) private readonly vintedQueue: Queue<SiteQueueJobData>,
    @InjectQueue(getSiteQueueName(SiteSource.LEBONCOIN)) private readonly leboncoinQueue: Queue<SiteQueueJobData>,
  ) {
    // Map siteId to queue for easy lookup
    this.queues.set(SiteSource.DEALABS, this.dealabsQueue);
    this.queues.set(SiteSource.VINTED, this.vintedQueue);
    this.queues.set(SiteSource.LEBONCOIN, this.leboncoinQueue);
  }

  /**
   * Distributes a scraping job to the correct queue based on siteId
   * @param categorySlug - Category identifier
   * @param siteId - Site source (dealabs, vinted, or leboncoin)
   * @param options - Optional job configuration
   * @returns Job instance or null if job already exists
   */
  async distributeScrapeJob(
    categoryId: string,
    categorySlug: string,
    siteId: SiteSource,
    options?: {
      priority?: number;
      attempts?: number;
      delay?: number;
      optimizedQuery?: string | null;
    }
  ): Promise<Job<ScrapeJobData> | null> {
    const queue = this.getQueueForSite(siteId);

    // Check if job already exists for this category
    const existingJob = await this.findExistingJobForCategory(categoryId, siteId);
    if (existingJob) {
      this.logger.debug(
        `Skipping job creation for ${siteId}/${categorySlug} (${categoryId}) - job ${existingJob.id} already exists`
      );
      return null;
    }

    const jobData: ScrapeJobData = {
      type: JobType.SCRAPE_CATEGORY,
      categoryId,
      categorySlug,
      categoryUrl: '', // Will be built by adapter
      priority: (options?.priority as JobPriorityLevel) ?? JobPriority.NORMAL,
      filterCount: 0, // Will be set by scheduler
      expectedDuration: 0, // Will be estimated by scheduler
      optimizedQuery: options?.optimizedQuery
        ?? (new URLSearchParams(SITE_URL_CONFIGS[siteId]?.universalParams).toString()
        || undefined),
      source: siteId,
      metadata: {
        siteId,
        timestamp: new Date().toISOString(),
      },
    };

    const job = await queue.add('scrape', jobData, {
      attempts: options?.attempts ?? 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: true,
      removeOnFail: false,
      priority: options?.priority,
      delay: options?.delay,
    });

    this.logger.log(
      `Distributed scrape job to ${siteId} queue: ${categorySlug} (${categoryId}) (job ${job.id})`
    );

    return job as Job<ScrapeJobData>;
  }

  /**
   * Distributes a category discovery job to the correct site-specific queue
   * @param siteId - Site source (dealabs, vinted, or leboncoin)
   * @param triggeredBy - Who/what triggered the discovery
   * @param options - Optional job configuration
   * @returns Job instance
   */
  async distributeDiscoveryJob(
    siteId: SiteSource,
    triggeredBy: string,
    options?: {
      priority?: number;
      attempts?: number;
      delay?: number;
    }
  ): Promise<Job> {
    const queue = this.getQueueForSite(siteId);

    const jobData = {
      siteId,
      triggeredBy,
      timestamp: new Date().toISOString(),
    };

    const job = await queue.add('discovery', jobData, {
      attempts: options?.attempts ?? 2,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
      removeOnComplete: true,
      removeOnFail: false,
      priority: options?.priority ?? JobPriority.HIGH, // Discovery jobs get high priority
      delay: options?.delay,
    });

    this.logger.log(
      `Distributed discovery job to ${siteId} queue (job ${job.id}, triggered by: ${triggeredBy})`
    );

    return job;
  }

  /**
   * Gets queue statistics for a specific site
   * @param siteId - Site source
   * @returns Queue metrics (waiting, active, completed, failed)
   */
  async getQueueStats(siteId: SiteSource): Promise<QueueStats> {
    const queue = this.getQueueForSite(siteId);

    const [waiting, active, completed, failed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
    ]);

    return {
      site: siteId,
      waiting,
      active,
      completed,
      failed,
    };
  }

  /**
   * Gets statistics for all queues
   * @returns Array of queue stats for all sites
   */
  async getAllQueuesStats(): Promise<QueueStats[]> {
    return Promise.all(
      Array.from(this.queues.keys()).map(site => this.getQueueStats(site))
    );
  }

  /**
   * Removes all jobs from a specific queue (use with caution!)
   * @param siteId - Site source
   */
  async clearQueue(siteId: SiteSource): Promise<void> {
    const queue = this.getQueueForSite(siteId);
    await queue.empty();
    this.logger.warn(`Cleared all jobs from ${siteId} queue`);
  }

  /**
   * Pauses a queue (stops processing new jobs)
   * @param siteId - Site source
   */
  async pauseQueue(siteId: SiteSource): Promise<void> {
    const queue = this.getQueueForSite(siteId);
    await queue.pause();
    this.logger.log(`Paused ${siteId} queue`);
  }

  /**
   * Resumes a paused queue
   * @param siteId - Site source
   */
  async resumeQueue(siteId: SiteSource): Promise<void> {
    const queue = this.getQueueForSite(siteId);
    await queue.resume();
    this.logger.log(`Resumed ${siteId} queue`);
  }

  /**
   * Gets the queue instance for a specific site
   * @private
   * @param siteId - Site source
   * @returns Bull Queue instance
   * @throws Error if siteId is invalid
   */
  private getQueueForSite(siteId: SiteSource): Queue<SiteQueueJobData> {
    const queue = this.queues.get(siteId);
    if (!queue) {
      throw new Error(`No queue configured for site: ${siteId}`);
    }
    return queue;
  }

  /**
   * Type guard to check if job data is a scrape job
   */
  private isScrapeJobData(data: SiteQueueJobData): data is ScrapeJobData {
    return 'categoryId' in data && 'type' in data;
  }

  /**
   * Finds existing job for a category in a specific site's queue
   * @private
   * @param categorySlug - Category identifier
   * @param siteId - Site source
   * @returns Existing job or null
   */
  private async findExistingJobForCategory(
    categoryId: string,
    siteId: SiteSource
  ): Promise<Job<ScrapeJobData> | null> {
    const queue = this.getQueueForSite(siteId);

    const [waiting, active, delayed] = await Promise.all([
      queue.getWaiting(),
      queue.getActive(),
      queue.getDelayed(),
    ]);

    const allJobs = [...waiting, ...active, ...delayed];

    // Find any existing job targeting the same category ID
    const matchingJob = allJobs.find((job) => {
      return 'categoryId' in job.data && job.data.categoryId === categoryId;
    });

    return matchingJob ? (matchingJob as Job<ScrapeJobData>) : null;
  }

  /**
   * Cleanup during module destruction
   */
  onModuleDestroy(): void {
    this.logger.log('MultiSiteJobDistributorService shutting down');
    this.queues.clear();
  }
}

/**
 * Queue statistics interface
 */
export interface QueueStats {
  site: SiteSource;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
}
