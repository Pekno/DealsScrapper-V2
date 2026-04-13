/**
 * Types for scraper worker functionality
 * Defines interfaces for job processing and worker health monitoring
 */

import { ScrapeJobStatus, RawDeal } from '@dealscrapper/shared-types';

/**
 * Worker capacity and capability information
 */
export interface WorkerCapacity {
  readonly maxConcurrentJobs: number;
  readonly maxMemoryMB: number;
  readonly supportedJobTypes: JobType[];
}

/**
 * Worker health status information
 */
export interface WorkerHealthStatus {
  readonly isHealthy: boolean;
  readonly currentLoad?: number;
  readonly error?: string;
  readonly lastCheck: Date;
  readonly responseTime: number;
}

/**
 * Job types supported by workers
 */
export type JobType =
  | 'scrape-category'
  | 'category-discovery'
  | 'manual-category-discovery';

/**
 * Job priority levels
 */
export type JobPriority = 'high' | 'normal' | 'low';

/**
 * Job source systems
 */
export type JobSource = 'adaptive_scheduler' | 'manual' | 'cron' | 'scheduled';

/**
 * Base job data interface
 */
export interface BaseJobData {
  readonly jobId: string;
  readonly type: JobType;
  readonly priority: JobPriority;
  readonly source: JobSource;
  readonly createdAt: Date;
  readonly metadata?: Record<string, unknown>;
}

/**
 * Scraping job data received from scheduler
 */
export interface ScrapeJobData extends BaseJobData {
  readonly type: 'scrape-category';
  readonly categorySlug: string;
  readonly categoryUrl: string;
  readonly filterCount: number;
  readonly expectedDuration: number;
  readonly retryCount: number;
}

/**
 * Discovery job data for category discovery
 */
export interface DiscoveryJobData extends BaseJobData {
  readonly type: 'category-discovery' | 'manual-category-discovery';
  readonly description: string;
}

/**
 * Union type for all job data types
 */
export type AnyJobData = ScrapeJobData | DiscoveryJobData;

/**
 * Job processing result
 */
export interface ScrapeJobResult {
  readonly jobId: string;
  readonly status: ScrapeJobStatus;
  readonly duration: number;
  readonly dealsExtracted: number;
  readonly newDealsFound: number;
  readonly filtersMatched: number;
  readonly efficiency: number;
  readonly workerMetrics: WorkerMetrics;
  readonly completedAt: Date;
  readonly error?: string;
}

/**
 * Worker performance metrics
 */
export interface WorkerMetrics {
  readonly workerId: string;
  readonly memoryUsageMB: number;
  readonly cpuUsagePercent: number;
  readonly activeJobs: number;
  readonly jobsProcessed: number;
  readonly avgJobDuration: number;
  readonly successRate: number;
}

/**
 * Scraping operation results
 */
export interface ScrapingResult {
  readonly deals: RawDeal[]; // Use proper RawDeal type from shared-types
  readonly totalPages: number;
  readonly scrapedPages: number;
  readonly errors: string[];
  readonly duration: number;
}

/**
 * Persistence operation results
 */
export interface PersistenceResult {
  readonly newDeals: number;
  readonly updatedDeals: number;
  readonly matchesCreated: number;
  readonly errors: string[];
}
