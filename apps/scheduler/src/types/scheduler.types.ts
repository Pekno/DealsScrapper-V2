/**
 * Types for the scheduler/orchestrator service
 * Reuses existing shared types where possible to maintain consistency
 *
 * @deprecated These types are being replaced by job.types.ts for better consolidation
 * Use job.types.ts for new implementations
 */

import type { ScrapeJobStatus } from '@dealscrapper/shared-types';

/**
 * @deprecated Use JobPriorityLevel from job.types.ts instead
 */
export type JobPriority = 'high' | 'normal' | 'low';

/**
 * Source systems that can trigger jobs
 */
export type JobSource = 'adaptive_scheduler' | 'manual' | 'cron' | 'scheduled';

/**
 * @deprecated Use JobType from job.types.ts instead
 */
export type JobType =
  | 'scrape-category'
  | 'category-discovery'
  | 'manual-category-discovery';

/**
 * @deprecated Use BaseJobData from job.types.ts instead
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
 * @deprecated Use ScrapeJobData from job.types.ts instead
 */
export interface ScrapeJobData extends BaseJobData {
  readonly type: 'scrape-category';
  readonly categoryId: string;
  readonly categorySlug: string;
  readonly categoryUrl: string;
  readonly filterCount: number;
  readonly expectedDuration: number;
  readonly retryCount: number;
}

/**
 * @deprecated Use DiscoveryJobData from job.types.ts instead
 */
export interface DiscoveryJobData extends BaseJobData {
  readonly type: 'category-discovery' | 'manual-category-discovery';
  readonly description: string;
}

/**
 * Health status information for a worker
 */
export interface WorkerHealthStatus {
  readonly isHealthy: boolean;
  readonly currentLoad?: number;
  readonly error?: string;
  readonly lastCheck: Date;
  readonly responseTime: number;
}

/**
 * Cached health status with timestamp
 */
export interface CachedHealthStatus {
  readonly status: WorkerHealthStatus;
  readonly timestamp: number;
}

/**
 * Worker capacity information
 */
export interface WorkerCapacity {
  readonly maxConcurrentJobs: number;
  readonly maxMemoryMB: number;
  readonly supportedJobTypes: JobType[];
}

/**
 * Worker metrics and status
 */
export interface WorkerMetrics {
  readonly id: string;
  readonly endpoint: string;
  readonly site?: string;
  readonly capacity: WorkerCapacity;
  readonly currentLoad: number;
  readonly lastHeartbeat: Date;
  readonly status: 'active' | 'inactive' | 'maintenance';
}

/**
 * Job completion result
 */
export interface JobResult {
  readonly jobId: string;
  readonly status: ScrapeJobStatus;
  readonly duration: number;
  readonly dealsProcessed?: number;
  readonly newDealsFound?: number;
  readonly efficiency?: number;
  readonly error?: string;
  readonly completedAt: Date;
}
