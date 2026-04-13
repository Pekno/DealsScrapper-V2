import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { MultiSiteJobDistributorService } from '../job-distributor/multi-site-job-distributor.service.js';
import { extractErrorMessage } from '@dealscrapper/shared';
import { SiteSource } from '@dealscrapper/shared-types';

/**
 * Orchestrates category discovery jobs following the simplified approach
 * Schedules daily discovery and provides manual discovery triggers
 *
 * Routes discovery jobs to site-specific queues for parallel processing:
 * - jobs-dealabs for Dealabs discovery
 * - jobs-vinted for Vinted discovery
 * - jobs-leboncoin for LeBonCoin discovery
 */
@Injectable()
export class CategoryDiscoveryOrchestrator {
  private readonly logger = new Logger(CategoryDiscoveryOrchestrator.name);

  constructor(
    private readonly jobDistributor: MultiSiteJobDistributorService,
  ) {}

  /**
   * Daily scheduled category discovery - matches current scraper timing (2 AM)
   * Discovers new categories, validates existing ones, and updates metadata
   * Jobs are distributed to site-specific queues for parallel processing
   * @returns Promise that resolves when discovery jobs are queued
   */
  @Cron('0 2 * * *')
  async scheduleDailyCategoryDiscovery(): Promise<void> {
    this.logger.log('Triggering daily category discovery at 2 AM...');

    // Schedule discovery for all supported sites (in parallel via site-specific queues)
    const sites = Object.values(SiteSource);
    const results: Array<{ site: SiteSource; success: boolean; jobId?: string; error?: string }> = [];

    for (const site of sites) {
      try {
        const job = await this.jobDistributor.distributeDiscoveryJob(
          site,
          'daily-cron',
          { priority: 1 } // Low priority for scheduled discovery
        );

        results.push({ site, success: true, jobId: job.id.toString() });
        this.logger.log(
          `Daily category discovery job queued for ${site} (Job ID: ${job.id})`
        );
      } catch (error) {
        const errorMessage = extractErrorMessage(error);
        results.push({ site, success: false, error: errorMessage });
        this.logger.error(
          `Failed to queue daily category discovery job for ${site}: ${errorMessage}`,
          error instanceof Error ? error.stack : undefined
        );
        // Continue with other sites - don't fail entire batch
      }
    }

    const successCount = results.filter(r => r.success).length;
    this.logger.log(
      `Daily category discovery completed: ${successCount}/${sites.length} sites queued successfully (distributed to site-specific queues)`
    );
  }

  /**
   * Triggers manual category discovery for admin/testing purposes
   * Higher priority than scheduled discovery for immediate processing
   * Jobs are distributed to site-specific queues for parallel processing
   * @param triggeredBy - Identifier of who/what triggered the manual discovery
   * @param siteId - Optional site to discover (if not provided, discovers all sites)
   * @returns Promise resolving to the result of the discovery job(s)
   * @throws Error if job creation fails
   */
  async triggerManualDiscovery(
    triggeredBy: string = 'manual-api',
    siteId?: SiteSource
  ): Promise<{ success: boolean; jobId?: string; jobIds?: string[]; message: string; error?: string }> {
    this.logger.log(
      `Triggering manual category discovery (triggered by: ${triggeredBy}, site: ${siteId ?? 'all'})...`
    );

    // If a specific site is requested, only discover that site
    const sitesToDiscover = siteId ? [siteId] : Object.values(SiteSource);

    if (sitesToDiscover.length === 1) {
      // Single site discovery
      const site = sitesToDiscover[0];
      try {
        const job = await this.jobDistributor.distributeDiscoveryJob(
          site,
          triggeredBy,
          { priority: 10 } // High priority for manual requests
        );

        this.logger.log(
          `Manual category discovery job queued for ${site} (Job ID: ${job.id})`
        );

        return {
          success: true,
          jobId: job.id.toString(),
          message: `Manual category discovery job queued for ${site}`,
        };
      } catch (error) {
        const errorMessage = extractErrorMessage(error);
        this.logger.error(
          `Failed to queue manual category discovery job for ${site}: ${errorMessage}`,
          error instanceof Error ? error.stack : undefined
        );

        return {
          success: false,
          error: errorMessage,
          message: `Failed to queue manual category discovery job for ${site}`,
        };
      }
    }

    // Multi-site discovery (jobs go to separate queues for parallel processing)
    const jobIds: string[] = [];
    const errors: string[] = [];

    for (const site of sitesToDiscover) {
      try {
        const job = await this.jobDistributor.distributeDiscoveryJob(
          site,
          triggeredBy,
          { priority: 10 } // High priority for manual requests
        );

        jobIds.push(job.id.toString());
        this.logger.log(
          `Manual category discovery job queued for ${site} (Job ID: ${job.id})`
        );
      } catch (error) {
        const errorMessage = extractErrorMessage(error);
        errors.push(`${site}: ${errorMessage}`);
        this.logger.error(
          `Failed to queue manual category discovery job for ${site}: ${errorMessage}`,
          error instanceof Error ? error.stack : undefined
        );
      }
    }

    if (jobIds.length === 0) {
      return {
        success: false,
        error: errors.join('; '),
        message: 'Failed to queue manual category discovery jobs for all sites',
      };
    }

    return {
      success: true,
      jobIds,
      message: `Manual category discovery jobs queued for ${jobIds.length}/${sitesToDiscover.length} sites (distributed to site-specific queues)`,
      error: errors.length > 0 ? errors.join('; ') : undefined,
    };
  }

  /**
   * Provides a way to trigger discovery via API endpoints or admin dashboard
   * Wrapper method for external access
   * @param triggerSource - Source of the manual trigger (e.g., 'admin-dashboard', 'api-endpoint')
   * @returns Promise resolving to the created job(s) - jobId for single site, jobIds for all sites
   */
  async handleManualDiscoveryRequest(
    triggerSource: string
  ): Promise<{ success: boolean; jobId?: string; jobIds?: string[]; message: string; error?: string }> {
    return await this.triggerManualDiscovery(triggerSource);
  }

  /**
   * Checks if a discovery job is currently running or queued
   * Checks all site-specific queues for active discovery jobs
   * @returns Promise resolving to boolean indicating if discovery is active
   */
  async isDiscoveryActive(): Promise<boolean> {
    try {
      const allStats = await this.jobDistributor.getAllQueuesStats();

      // Sum active jobs across all site queues
      const totalActive = allStats.reduce((sum, stats) => sum + stats.active, 0);
      const totalWaiting = allStats.reduce((sum, stats) => sum + stats.waiting, 0);

      const isActive = totalActive > 0 || totalWaiting > 0;
      this.logger.debug(
        `Discovery job status check: ${isActive ? 'active' : 'inactive'} (${totalActive} active, ${totalWaiting} waiting across ${allStats.length} queues)`
      );

      return isActive;
    } catch (error) {
      this.logger.error('Failed to check discovery status:', error);
      return false; // Assume not active on error to allow new jobs
    }
  }

  /**
   * Gets discovery status information for monitoring
   * Aggregates stats from all site-specific queues
   * @returns Discovery status summary including queue stats and system health
   */
  async getDiscoveryStatus(): Promise<{
    queueStatus: { waiting: number; active: number; completed: number; failed: number };
    discoveryJobs: { pending: number; processing: number };
    perSiteStatus: Array<{ site: SiteSource; waiting: number; active: number; completed: number; failed: number }>;
    lastUpdate: Date;
    systemStatus: 'operational' | 'degraded' | 'error';
    error?: string;
  }> {
    try {
      const allStats = await this.jobDistributor.getAllQueuesStats();

      // Aggregate stats across all queues
      const aggregated = allStats.reduce(
        (acc, stats) => ({
          waiting: acc.waiting + stats.waiting,
          active: acc.active + stats.active,
          completed: acc.completed + stats.completed,
          failed: acc.failed + stats.failed,
        }),
        { waiting: 0, active: 0, completed: 0, failed: 0 }
      );

      // Determine system status based on queue health
      let systemStatus: 'operational' | 'degraded' | 'error' = 'operational';

      // Check for degraded conditions
      if (aggregated.failed > 0 && aggregated.active === 0) {
        systemStatus = 'degraded';
      } else if (aggregated.waiting > 5 && aggregated.active === 0) {
        systemStatus = 'degraded';
      }

      return {
        queueStatus: aggregated,
        discoveryJobs: {
          pending: aggregated.waiting,
          processing: aggregated.active,
        },
        perSiteStatus: allStats,
        lastUpdate: new Date(),
        systemStatus,
      };
    } catch (error) {
      const errorMessage = extractErrorMessage(error);
      this.logger.error('Failed to get discovery status:', error);

      return {
        queueStatus: {
          waiting: 0,
          active: 0,
          completed: 0,
          failed: 0,
        },
        discoveryJobs: {
          pending: 0,
          processing: 0,
        },
        perSiteStatus: [],
        lastUpdate: new Date(),
        systemStatus: 'error',
        error: errorMessage,
      };
    }
  }
}
