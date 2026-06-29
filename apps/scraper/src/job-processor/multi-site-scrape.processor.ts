import { Injectable } from '@nestjs/common';
import { Process, Processor } from '@nestjs/bull';
import type { Job } from 'bull';
import { SiteSource, getSiteQueueName } from '@dealscrapper/shared-types';
import { extractErrorMessage } from '@dealscrapper/shared';
import { createServiceLogger } from '@dealscrapper/shared-logging';

import { AdapterRegistry } from '../adapters/adapter.registry.js';
import type { UniversalListing } from '../adapters/base/site-adapter.interface.js';
import { UnifiedExtractionService } from '../extraction/unified-extraction.service.js';
import { MultiSiteArticleService } from '../services/multi-site-article.service.js';
import { DealPersistenceService } from '../services/deal-persistence.service.js';
import { PuppeteerPoolService } from '../puppeteer-pool/puppeteer-pool.service.js';
import { FilterMatchingService } from '../filter-matching/filter-matching.service.js';
import { CategoryDiscoveryAdapterRegistry } from '../category-discovery/category-discovery-adapter.registry.js';
import { CategoryRepository } from '../repositories/category.repository.js';
import { ScrapingJobRepository } from '../repositories/scraping-job.repository.js';
import { scraperLogConfig } from '../config/logging.config.js';

/**
 * Job data for multi-site scraping.
 * Supports both direct `siteId` and scheduler's `source` / `metadata.siteId` fields.
 */
export interface MultiSiteScrapeJobData {
  categoryId: string;
  categorySlug: string;
  categoryUrl?: string;
  siteId?: SiteSource;
  source?: string;
  metadata?: { siteId?: string; [key: string]: unknown };
  timestamp?: string;
  priority?: number;
  maxPages?: number;
  /** ID of the ScheduledJob that triggered this job, used to record ScrapingJob execution history */
  scheduledJobId?: string;
  /** Optimized URL query string from filter constraints (e.g. "temperatureFrom=95&sortBy=new") */
  optimizedQuery?: string;
}

/**
 * Appends optimized query parameters to a base URL.
 * Merges query params from the optimizedQuery string into the URL.
 */
function applyOptimizedQuery(baseUrl: string, optimizedQuery?: string): string {
  if (!optimizedQuery) return baseUrl;
  const url = new URL(baseUrl);
  const params = new URLSearchParams(optimizedQuery);
  for (const [key, value] of params) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

/**
 * Resolves siteId from job data, checking multiple fields for compatibility
 * with both direct job creation and scheduler-dispatched jobs.
 */
function resolveSiteId(data: MultiSiteScrapeJobData, fallback: SiteSource): SiteSource {
  return (data.siteId ?? data.source ?? data.metadata?.siteId ?? fallback) as SiteSource;
}

/**
 * Human-readable site labels used in log messages. Kept byte-identical to the
 * previously hardcoded nouns so existing log assertions remain valid.
 */
const SITE_LOG_LABEL: Record<SiteSource, string> = {
  [SiteSource.DEALABS]: 'Dealabs',
  [SiteSource.VINTED]: 'Vinted',
  [SiteSource.LEBONCOIN]: 'LeBonCoin',
};

/**
 * Processing result for multi-site scraping
 */
export interface ProcessResult {
  success: boolean;
  siteId: SiteSource;
  categoryId: string;
  articleCount: number;
  pageCount: number;
  duration: number;
  timestamp: string;
  error?: string;
  indexed?: number;
}

/**
 * Job data for category discovery
 */
export interface DiscoveryJobData {
  siteId: SiteSource;
  triggeredBy?: string;
  timestamp: string;
}

/**
 * Processing result for category discovery
 */
export interface DiscoveryResult {
  success: boolean;
  siteId: SiteSource;
  categoryCount: number;
  duration: number;
  timestamp: string;
  error?: string;
}

/**
 * Shared base for all site scrape processors.
 *
 * Processes jobs from site-specific Bull queues. Holds the identical scrape and
 * discovery pipelines once, parameterized by the abstract {@link site}.
 *
 * Each processor:
 * 1. Gets the appropriate adapter from AdapterRegistry using siteId
 * 2. Uses Puppeteer to fetch HTML
 * 3. Calls UnifiedExtractionService to extract listings
 * 4. Uses MultiSiteArticleService to save articles with extensions + ES indexing
 *
 * NestJS requires one concrete consumer class per queue, and `@nestjs/bull`
 * only scans the direct prototype of the registered provider for `@Process`
 * handlers (not the full prototype chain). The thin subclasses below therefore
 * re-declare the decorated handlers and delegate to the base implementations.
 */
abstract class BaseScrapeProcessor {
  protected abstract readonly site: SiteSource;

  protected readonly logger = createServiceLogger(scraperLogConfig);

  constructor(
    protected readonly adapterRegistry: AdapterRegistry,
    protected readonly unifiedExtractionService: UnifiedExtractionService,
    protected readonly multiSiteArticleService: MultiSiteArticleService,
    protected readonly dealPersistenceService: DealPersistenceService,
    protected readonly puppeteerPool: PuppeteerPoolService,
    protected readonly filterMatchingService: FilterMatchingService,
    protected readonly categoryDiscoveryRegistry: CategoryDiscoveryAdapterRegistry,
    protected readonly categoryRepository: CategoryRepository,
    protected readonly scrapingJobRepository: ScrapingJobRepository,
  ) {}

  async handleScrapeJob(job: Job<MultiSiteScrapeJobData>): Promise<ProcessResult> {
    const startTime = Date.now();
    const { categoryId, categorySlug, maxPages = 5 } = job.data;
    const label = SITE_LOG_LABEL[this.site];
    const siteId = resolveSiteId(job.data, this.site);
    const adapter = this.adapterRegistry.getAdapter(this.site);
    const categoryUrl = applyOptimizedQuery(
      adapter.buildCategoryUrl(categorySlug, 1),
      job.data.optimizedQuery,
    );

    const scrapingJob = job.data.scheduledJobId
      ? await this.scrapingJobRepository.createProcessingJob(job.data.scheduledJobId)
      : null;

    this.logger.log(
      `🔄 Processing ${label} scrape job [${job.id}] for category: ${categorySlug} (${categoryId}) (site: ${siteId})`,
    );

    let scrapingTimeMs: number | undefined;

    try {
      // Fetch HTML using Puppeteer — timed separately
      const fetchStart = Date.now();
      const html = await this.puppeteerPool.fetchPage(categoryUrl);
      scrapingTimeMs = Date.now() - fetchStart;

      // Extract listings using adapter
      const result = await this.unifiedExtractionService.scrapeCategoryFromHtml(
        adapter,
        categorySlug,
        html,
        { maxPages },
      );

      // Save articles to database with extensions and ES indexing
      const saveResult = await this.multiSiteArticleService.createManyFromListings(
        result.listings as UniversalListing[],
        categoryId,
      );

      // Mark articles no longer present on the page as expired
      const extractedIds = new Set(result.listings.map((l) => l.externalId));
      await this.dealPersistenceService.markHiddenExpiredDeals(categorySlug, extractedIds, adapter);

      // Run filter matching on ALL articles (both new and existing), deduped by id
      const allArticles = [
        ...new Map(
          [...saveResult.created, ...saveResult.existing].map((a) => [a.id, a]),
        ).values(),
      ];
      if (allArticles.length > 0) {
        this.logger.log(
          `🔍 Running filter matching on ${allArticles.length} articles (${saveResult.created.length} new, ${saveResult.existing.length} existing)`,
        );
        await this.filterMatchingService.processFreshDeals(allArticles);
      }

      const duration = Date.now() - startTime;

      if (scrapingJob) {
        await this.scrapingJobRepository.markCompleted(scrapingJob.id, {
          dealsFound: saveResult.created.length,
          dealsProcessed: saveResult.indexed ?? saveResult.created.length,
          executionTimeMs: duration,
          scrapingTimeMs,
          ollamaExtractionTimeMs: result.llmTimeMs,
        });
      }

      this.logger.log(
        `✅ Completed ${label} scrape job [${job.id}] for ${categorySlug} (${categoryId}):\n` +
        `   📊 Extracted: ${result.listings.length}, Saved: ${saveResult.created.length}, ` +
        `Skipped: ${saveResult.skipped}, Indexed: ${saveResult.indexed}\n` +
        `   ⏱️  Duration: ${duration}ms (scraping: ${scrapingTimeMs}ms, LLM: ${result.llmTimeMs}ms)`,
      );

      return {
        success: true,
        siteId,
        categoryId,
        articleCount: saveResult.created.length,
        pageCount: result.pageCount,
        duration,
        timestamp: new Date().toISOString(),
        indexed: saveResult.indexed,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = extractErrorMessage(error);
      const errorStack = (error as Error).stack || 'No stack trace';

      if (scrapingJob) {
        await this.scrapingJobRepository.markFailed(scrapingJob.id, errorMessage, duration, scrapingTimeMs);
      }

      this.logger.error(
        `❌ Failed ${label} scrape job [${job.id}] for ${categorySlug} (${categoryId}):\n` +
        `   🔗 URL: ${categoryUrl}\n` +
        `   💥 Error: ${errorMessage}\n` +
        `   ⏱️  Duration: ${duration}ms\n` +
        `   🔍 Stack: ${errorStack.split('\n').slice(0, 5).join('\n   ')}`,
      );

      return {
        success: false,
        siteId,
        categoryId,
        articleCount: 0,
        pageCount: 0,
        duration,
        timestamp: new Date().toISOString(),
        error: errorMessage,
      };
    }
  }

  async handleDiscoveryJob(job: Job<DiscoveryJobData>): Promise<DiscoveryResult> {
    const startTime = Date.now();
    const label = SITE_LOG_LABEL[this.site];
    const siteId = this.site;

    this.logger.log(
      `🔍 Processing ${label} discovery job [${job.id}] (triggered by: ${job.data.triggeredBy || 'unknown'})`,
    );

    try {
      const adapter = this.categoryDiscoveryRegistry.getAdapter(siteId);
      if (!adapter) {
        throw new Error(`No discovery adapter found for site: ${siteId}`);
      }

      const categories = await adapter.discoverCategories();

      this.logger.log(
        `📂 Found ${categories.length} categories for ${siteId}, saving to database...`,
      );

      await this.categoryRepository.upsertCategories(siteId, categories);

      const duration = Date.now() - startTime;

      this.logger.log(
        `✅ Completed ${label} discovery job [${job.id}]:\n` +
        `   📊 Categories discovered: ${categories.length}\n` +
        `   ⏱️  Duration: ${duration}ms`,
      );

      return {
        success: true,
        siteId,
        categoryCount: categories.length,
        duration,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = extractErrorMessage(error);

      this.logger.error(
        `❌ Failed ${label} discovery job [${job.id}]:\n` +
        `   💥 Error: ${errorMessage}\n` +
        `   ⏱️  Duration: ${duration}ms`,
      );

      return {
        success: false,
        siteId,
        categoryCount: 0,
        duration,
        timestamp: new Date().toISOString(),
        error: errorMessage,
      };
    }
  }
}

/**
 * Dealabs job processor
 */
@Injectable()
@Processor(getSiteQueueName(SiteSource.DEALABS))
export class DealabsScrapeProcessor extends BaseScrapeProcessor {
  protected readonly site = SiteSource.DEALABS;

  // Explicit constructor required so TypeScript emits `design:paramtypes` DI
  // metadata on this concrete class. A decorated subclass without its own
  // constructor emits no param metadata, so NestJS would inject nothing and
  // every dependency would be undefined at runtime.
  constructor(
    adapterRegistry: AdapterRegistry,
    unifiedExtractionService: UnifiedExtractionService,
    multiSiteArticleService: MultiSiteArticleService,
    dealPersistenceService: DealPersistenceService,
    puppeteerPool: PuppeteerPoolService,
    filterMatchingService: FilterMatchingService,
    categoryDiscoveryRegistry: CategoryDiscoveryAdapterRegistry,
    categoryRepository: CategoryRepository,
    scrapingJobRepository: ScrapingJobRepository,
  ) {
    super(
      adapterRegistry,
      unifiedExtractionService,
      multiSiteArticleService,
      dealPersistenceService,
      puppeteerPool,
      filterMatchingService,
      categoryDiscoveryRegistry,
      categoryRepository,
      scrapingJobRepository,
    );
  }

  @Process('scrape')
  async handleScrapeJob(job: Job<MultiSiteScrapeJobData>): Promise<ProcessResult> {
    return super.handleScrapeJob(job);
  }

  @Process('discovery')
  async handleDiscoveryJob(job: Job<DiscoveryJobData>): Promise<DiscoveryResult> {
    return super.handleDiscoveryJob(job);
  }
}

/**
 * Vinted job processor
 */
@Injectable()
@Processor(getSiteQueueName(SiteSource.VINTED))
export class VintedScrapeProcessor extends BaseScrapeProcessor {
  protected readonly site = SiteSource.VINTED;

  // Explicit constructor required so NestJS emits DI metadata on this concrete
  // class — see DealabsScrapeProcessor for details.
  constructor(
    adapterRegistry: AdapterRegistry,
    unifiedExtractionService: UnifiedExtractionService,
    multiSiteArticleService: MultiSiteArticleService,
    dealPersistenceService: DealPersistenceService,
    puppeteerPool: PuppeteerPoolService,
    filterMatchingService: FilterMatchingService,
    categoryDiscoveryRegistry: CategoryDiscoveryAdapterRegistry,
    categoryRepository: CategoryRepository,
    scrapingJobRepository: ScrapingJobRepository,
  ) {
    super(
      adapterRegistry,
      unifiedExtractionService,
      multiSiteArticleService,
      dealPersistenceService,
      puppeteerPool,
      filterMatchingService,
      categoryDiscoveryRegistry,
      categoryRepository,
      scrapingJobRepository,
    );
  }

  @Process('scrape')
  async handleScrapeJob(job: Job<MultiSiteScrapeJobData>): Promise<ProcessResult> {
    return super.handleScrapeJob(job);
  }

  @Process('discovery')
  async handleDiscoveryJob(job: Job<DiscoveryJobData>): Promise<DiscoveryResult> {
    return super.handleDiscoveryJob(job);
  }
}

/**
 * LeBonCoin job processor
 */
@Injectable()
@Processor(getSiteQueueName(SiteSource.LEBONCOIN))
export class LeBonCoinScrapeProcessor extends BaseScrapeProcessor {
  protected readonly site = SiteSource.LEBONCOIN;

  // Explicit constructor required so NestJS emits DI metadata on this concrete
  // class — see DealabsScrapeProcessor for details.
  constructor(
    adapterRegistry: AdapterRegistry,
    unifiedExtractionService: UnifiedExtractionService,
    multiSiteArticleService: MultiSiteArticleService,
    dealPersistenceService: DealPersistenceService,
    puppeteerPool: PuppeteerPoolService,
    filterMatchingService: FilterMatchingService,
    categoryDiscoveryRegistry: CategoryDiscoveryAdapterRegistry,
    categoryRepository: CategoryRepository,
    scrapingJobRepository: ScrapingJobRepository,
  ) {
    super(
      adapterRegistry,
      unifiedExtractionService,
      multiSiteArticleService,
      dealPersistenceService,
      puppeteerPool,
      filterMatchingService,
      categoryDiscoveryRegistry,
      categoryRepository,
      scrapingJobRepository,
    );
  }

  @Process('scrape')
  async handleScrapeJob(job: Job<MultiSiteScrapeJobData>): Promise<ProcessResult> {
    return super.handleScrapeJob(job);
  }

  @Process('discovery')
  async handleDiscoveryJob(job: Job<DiscoveryJobData>): Promise<DiscoveryResult> {
    return super.handleDiscoveryJob(job);
  }
}
