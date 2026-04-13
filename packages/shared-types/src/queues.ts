/**
 * Queue Configuration
 * Centralized queue names and configurations derived from SiteSource
 *
 * This ensures consistency across scheduler and scraper services.
 * Each site has its own queue for parallel processing of scrape and discovery jobs.
 */

import { SiteSource } from './site-source.js';

/**
 * Generate a site-specific queue name
 */
export function getSiteQueueName(siteId: SiteSource | string): string {
  return `jobs-${siteId}`;
}

/**
 * Site-specific queue names - dynamically generated from SiteSource enum
 * Key = SiteSource value, Value = queue name
 */
export const SITE_QUEUE_NAMES = Object.fromEntries(
  Object.values(SiteSource).map((siteId) => [siteId, getSiteQueueName(siteId)])
) as Record<SiteSource, string>;

/**
 * Queue name constants for use with NestJS decorators (@Processor, @InjectQueue)
 *
 * Note: Values are dynamically derived from SiteSource via getSiteQueueName().
 * Keys must be static for TypeScript type inference with decorators.
 */
export const QUEUE_NAMES = {
  JOBS_DEALABS: getSiteQueueName(SiteSource.DEALABS),
  JOBS_VINTED: getSiteQueueName(SiteSource.VINTED),
  JOBS_LEBONCOIN: getSiteQueueName(SiteSource.LEBONCOIN),
} as const;

/**
 * Type for valid queue names
 */
export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

/**
 * Bull queue registration configurations for each site
 * Use this in BullModule.registerQueue() calls
 */
export const SITE_QUEUE_CONFIGS = Object.values(SiteSource).map((siteId) => ({
  name: getSiteQueueName(siteId),
  prefix: siteId,
}));

/**
 * Get all queue names as an array (useful for logging)
 */
export function getAllSiteQueueNames(): string[] {
  return Object.values(SiteSource).map(getSiteQueueName);
}

/**
 * Check if a queue name is a valid site queue
 */
export function isSiteQueue(queueName: string): boolean {
  const validQueueNames: string[] = Object.values(SITE_QUEUE_NAMES);
  return validQueueNames.includes(queueName);
}

/**
 * Extract site ID from queue name
 */
export function getSiteFromQueueName(queueName: string): SiteSource | null {
  const match = queueName.match(/^jobs-(.+)$/);
  if (match && Object.values(SiteSource).includes(match[1] as SiteSource)) {
    return match[1] as SiteSource;
  }
  return null;
}
