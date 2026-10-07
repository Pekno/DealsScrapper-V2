/**
 * Queue Helper Functions for Cypress Tests
 *
 * Drains the scraper's per-site BullMQ job queues so that slow, in-flight
 * scrape/match jobs from a previous test cannot race the per-test DB cleanup
 * (which would otherwise delete Articles out from under match creation).
 */

import Queue from 'bull';

// Mirror of SITE_QUEUE_CONFIGS in packages/shared-types/src/queues.ts:
// each site has queue name `jobs-<siteId>` with Bull keyPrefix = `<siteId>`.
// Inlined (not imported) to keep the Cypress plugin process free of workspace
// build/ESM resolution concerns — the list changes only when a site is added.
const SITE_QUEUES: ReadonlyArray<{ name: string; prefix: string }> = [
  { name: 'jobs-dealabs', prefix: 'dealabs' },
  { name: 'jobs-vinted', prefix: 'vinted' },
  { name: 'jobs-leboncoin', prefix: 'leboncoin' },
];

const REDIS_URL =
  process.env.CYPRESS_REDIS_URL || process.env.REDIS_URL || 'redis://localhost:6380';

/**
 * Remove all jobs (waiting, delayed, active, completed, failed) from every
 * site scrape queue. Connections are opened and closed per call so the plugin
 * process holds no persistent Redis handles between tests.
 *
 * Uses obliterate({ force: true }) so even an actively-processing job is
 * dropped; if the worker is mid-flight its later match insert may hit a
 * deleted Article, which MatchRepository.createManyMatches now skips (P2025).
 */
export async function drainScrapeQueues(): Promise<void> {
  for (const { name, prefix } of SITE_QUEUES) {
    const queue = new Queue(name, REDIS_URL, { prefix });
    try {
      await queue.obliterate({ force: true });
    } finally {
      await queue.close();
    }
  }
}
