/**
 * Consolidated job types and priority system for single queue architecture
 */

/**
 * Job types - defines what kind of work needs to be done
 */
export enum JobType {
  SCRAPE_CATEGORY = 'scrape-category',
  DISCOVERY = 'discovery',
}

/**
 * Job priority levels using Bull queue priority system
 * Higher numbers = higher priority (processed first)
 */
export const JobPriority = {
  URGENT: 10, // User-triggered, time-sensitive operations
  HIGH: 7, // Hot categories, many users, high engagement
  NORMAL: 5, // Regular adaptive scheduling
  LOW: 1, // Discovery, maintenance, background tasks
} as const;

export type JobPriorityLevel = (typeof JobPriority)[keyof typeof JobPriority];

/**
 * Base job data structure for the consolidated queue
 */
export interface BaseJobData {
  type: JobType;
  source: string;
  metadata?: Record<string, unknown>;
}

/**
 * Category scraping job data
 */
export interface ScrapeJobData extends BaseJobData {
  type: JobType.SCRAPE_CATEGORY;
  categoryId: string;
  categorySlug: string;
  categoryUrl: string;
  priority: JobPriorityLevel;
  filterCount: number;
  expectedDuration: number;
  retryCount?: number;
  /** Optimized URL query string generated from filter constraints (e.g. "temperatureFrom=95&sortBy=new") */
  optimizedQuery?: string;
  metadata: {
    scheduledJobId?: string;
    userCount?: number;
    temperature?: number;
    dealCount?: number;
    siteId?: string;
    timestamp?: string;
  };
}

/**
 * Discovery job data
 */
export interface DiscoveryJobData extends BaseJobData {
  type: JobType.DISCOVERY;
  startUrl: string;
  depth: number;
  maxCategories: number;
  retryCount?: number;
  metadata: {
    discoveryType: 'full' | 'incremental';
    urgent?: boolean;
    [key: string]: string | number | boolean | undefined; // Allow additional typed metadata fields
  };
}

/**
 * Union type for all job data types
 */
export type JobData = ScrapeJobData | DiscoveryJobData;

/**
 * Job options for Bull queue
 */
export interface JobOptions {
  priority: JobPriorityLevel;
  attempts: number;
  backoff: { type: 'exponential' | 'fixed'; delay?: number };
  delay?: number;
  removeOnComplete?: number;
  removeOnFail?: number;
}

/**
 * Job processing result
 */
export interface JobProcessingResult {
  success: boolean;
  categoryId?: string;
  dealsFound?: number;
  newDealsFound?: number;
  duration: number;
  error?: string;
}

/**
 * Default job options by priority level
 */
export const DEFAULT_JOB_OPTIONS: Record<JobPriorityLevel, JobOptions> = {
  [JobPriority.URGENT]: {
    priority: JobPriority.URGENT,
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
    delay: 0,
    removeOnComplete: 10,
    removeOnFail: 5,
  },
  [JobPriority.HIGH]: {
    priority: JobPriority.HIGH,
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    delay: 500,
    removeOnComplete: 20,
    removeOnFail: 10,
  },
  [JobPriority.NORMAL]: {
    priority: JobPriority.NORMAL,
    attempts: 3,
    backoff: { type: 'exponential', delay: 3000 },
    delay: 1000,
    removeOnComplete: 50,
    removeOnFail: 20,
  },
  [JobPriority.LOW]: {
    priority: JobPriority.LOW,
    attempts: 2,
    backoff: { type: 'fixed', delay: 5000 },
    delay: 2000,
    removeOnComplete: 100,
    removeOnFail: 50,
  },
};
