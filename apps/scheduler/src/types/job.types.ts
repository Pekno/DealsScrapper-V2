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