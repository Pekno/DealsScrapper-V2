import { Injectable, Logger } from '@nestjs/common';
import { Process, Processor } from '@nestjs/bull';
import type { Job } from 'bull';
import { SiteSource, getSiteQueueName } from '@dealscrapper/shared-types';
import { extractErrorMessage } from '@dealscrapper/shared';

import { AdapterRegistry } from '../adapters/adapter.registry.js';
import type { UniversalListing } from '../adapters/base/site-adapter.interface.js';
import { UnifiedExtractionService } from '../extraction/unified-extraction.service.js';
import { MultiSiteArticleService } from '../services/multi-site-article.service.js';
import { DealPersistenceService } from '../services/deal-persistence.service.js';
import { PuppeteerPoolService } from '../puppeteer-pool/puppeteer-pool.service.js';
import { FilterMatchingService } from '../filter-matching/filter-matching.service.js';
import { CategoryDiscoveryAdapterRegistry } from '../category-discovery/category-discovery-adapter.registry.js';
import { CategoryRepository } from '../repositories/category.repository.js';

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
 * Multi-site scrape processor.
 *
 * Processes jobs from site-specific Bull queues.
 * Queue names are dynamically derived from SiteSource enum via getSiteQueueName().
 *
 * Each processor:
 * 1. Gets the appropriate adapter from AdapterRegistry using siteId
 * 2. Uses Puppeteer to fetch HTML
 * 3. Calls UnifiedExtractionService to extract listings
 * 4. Uses MultiSiteArticleService to save articles with extensions + ES indexing
 */

/**
 * Dealabs job processor
 */
@Injectable()
@Processor(getSiteQueueName(SiteSource.DEALABS))
export class DealabsScrapeProcessor {
  private readonly logger = new Logger(DealabsScrapeProcessor.name);

  constructor(
    private readonly adapterRegistry: AdapterRegistry,
    private readonly unifiedExtractionService: UnifiedExtractionService,
    private readonly multiSiteArticleService: MultiSiteArticleService,
    private readonly dealPersistenceService: DealPersistenceService,
    private readonly puppeteerPool: PuppeteerPoolService,
    private readonly filterMatchingService: FilterMatchingService,
    private readonly categoryDiscoveryRegistry: CategoryDiscoveryAdapterRegistry,
    private readonly categoryRepository: CategoryRepository,
  ) {}

  @Process('scrape')
  async handleScrapeJob(job: Job<MultiSiteScrapeJobData>): Promise<ProcessResult> {
    const startTime = Date.now();
    const { categoryId, categorySlug, maxPages = 5 } = job.data;
    const siteId = resolveSiteId(job.data, SiteSource.DEALABS);
    const adapter = this.adapterRegistry.getAdapter(SiteSource.DEALABS);
    const categoryUrl = applyOptimizedQuery(
      adapter.buildCategoryUrl(categorySlug, 1),
      job.data.optimizedQuery,
    );

    this.logger.log(
      `🔄 Processing Dealabs scrape job [${job.id}] for category: ${categorySlug} (${categoryId}) (site: ${siteId})`,
    );

    try {
      // Fetch HTML using Puppeteer
      const html = await this.puppeteerPool.fetchPage(categoryUrl);

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

      // Run filter matching on ALL articles (both new and existing)
      const allArticles = [...saveResult.created, ...saveResult.existing];
      if (allArticles.length > 0) {
        this.logger.log(
          `🔍 Running filter matching on ${allArticles.length} articles (${saveResult.created.length} new, ${saveResult.existing.length} existing)`,
        );
        await this.filterMatchingService.processFreshDeals(allArticles);
      }

      const duration = Date.now() - startTime;

      this.logger.log(
        `✅ Completed Dealabs scrape job [${job.id}] for ${categorySlug} (${categoryId}):\n` +
        `   📊 Extracted: ${result.listings.length}, Saved: ${saveResult.created.length}, ` +
        `Skipped: ${saveResult.skipped}, Indexed: ${saveResult.indexed}\n` +
        `   ⏱️  Duration: ${duration}ms`,
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

      this.logger.error(
        `❌ Failed Dealabs scrape job [${job.id}] for ${categorySlug} (${categoryId}):\n` +
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

  @Process('discovery')
  async handleDiscoveryJob(job: Job<DiscoveryJobData>): Promise<DiscoveryResult> {
    const startTime = Date.now();
    const siteId = SiteSource.DEALABS;

    this.logger.log(
      `🔍 Processing Dealabs discovery job [${job.id}] (triggered by: ${job.data.triggeredBy || 'unknown'})`,
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
        `✅ Completed Dealabs discovery job [${job.id}]:\n` +
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
        `❌ Failed Dealabs discovery job [${job.id}]:\n` +
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
 * Vinted job processor
 */
@Injectable()
@Processor(getSiteQueueName(SiteSource.VINTED))
export class VintedScrapeProcessor {
  private readonly logger = new Logger(VintedScrapeProcessor.name);

  constructor(
    private readonly adapterRegistry: AdapterRegistry,
    private readonly unifiedExtractionService: UnifiedExtractionService,
    private readonly multiSiteArticleService: MultiSiteArticleService,
    private readonly dealPersistenceService: DealPersistenceService,
    private readonly puppeteerPool: PuppeteerPoolService,
    private readonly filterMatchingService: FilterMatchingService,
    private readonly categoryDiscoveryRegistry: CategoryDiscoveryAdapterRegistry,
    private readonly categoryRepository: CategoryRepository,
  ) {}

  @Process('scrape')
  async handleScrapeJob(job: Job<MultiSiteScrapeJobData>): Promise<ProcessResult> {
    const startTime = Date.now();
    const { categoryId, categorySlug, maxPages = 5 } = job.data;
    const siteId = resolveSiteId(job.data, SiteSource.VINTED);
    const adapter = this.adapterRegistry.getAdapter(SiteSource.VINTED);
    const categoryUrl = applyOptimizedQuery(
      adapter.buildCategoryUrl(categorySlug, 1),
      job.data.optimizedQuery,
    );

    this.logger.log(
      `🔄 Processing Vinted scrape job [${job.id}] for category: ${categorySlug} (${categoryId}) (site: ${siteId})`,
    );

    try {
      // Fetch HTML using Puppeteer
      const html = await this.puppeteerPool.fetchPage(categoryUrl);

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

      // Run filter matching on ALL articles (both new and existing)
      const allArticles = [...saveResult.created, ...saveResult.existing];
      if (allArticles.length > 0) {
        this.logger.log(
          `🔍 Running filter matching on ${allArticles.length} articles (${saveResult.created.length} new, ${saveResult.existing.length} existing)`,
        );
        await this.filterMatchingService.processFreshDeals(allArticles);
      }

      const duration = Date.now() - startTime;

      this.logger.log(
        `✅ Completed Vinted scrape job [${job.id}] for ${categorySlug} (${categoryId}):\n` +
        `   📊 Extracted: ${result.listings.length}, Saved: ${saveResult.created.length}, ` +
        `Skipped: ${saveResult.skipped}, Indexed: ${saveResult.indexed}\n` +
        `   ⏱️  Duration: ${duration}ms`,
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

      this.logger.error(
        `❌ Failed Vinted scrape job [${job.id}] for ${categorySlug} (${categoryId}):\n` +
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

  @Process('discovery')
  async handleDiscoveryJob(job: Job<DiscoveryJobData>): Promise<DiscoveryResult> {
    const startTime = Date.now();
    const siteId = SiteSource.VINTED;

    this.logger.log(
      `🔍 Processing Vinted discovery job [${job.id}] (triggered by: ${job.data.triggeredBy || 'unknown'})`,
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
        `✅ Completed Vinted discovery job [${job.id}]:\n` +
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
        `❌ Failed Vinted discovery job [${job.id}]:\n` +
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
 * LeBonCoin job processor
 */
@Injectable()
@Processor(getSiteQueueName(SiteSource.LEBONCOIN))
export class LeBonCoinScrapeProcessor {
  private readonly logger = new Logger(LeBonCoinScrapeProcessor.name);

  constructor(
    private readonly adapterRegistry: AdapterRegistry,
    private readonly unifiedExtractionService: UnifiedExtractionService,
    private readonly multiSiteArticleService: MultiSiteArticleService,
    private readonly dealPersistenceService: DealPersistenceService,
    private readonly puppeteerPool: PuppeteerPoolService,
    private readonly filterMatchingService: FilterMatchingService,
    private readonly categoryDiscoveryRegistry: CategoryDiscoveryAdapterRegistry,
    private readonly categoryRepository: CategoryRepository,
  ) {}

  @Process('scrape')
  async handleScrapeJob(job: Job<MultiSiteScrapeJobData>): Promise<ProcessResult> {
    const startTime = Date.now();
    const { categoryId, categorySlug, maxPages = 5 } = job.data;
    const siteId = resolveSiteId(job.data, SiteSource.LEBONCOIN);
    const adapter = this.adapterRegistry.getAdapter(SiteSource.LEBONCOIN);
    const categoryUrl = applyOptimizedQuery(
      adapter.buildCategoryUrl(categorySlug, 1),
      job.data.optimizedQuery,
    );

    this.logger.log(
      `🔄 Processing LeBonCoin scrape job [${job.id}] for category: ${categorySlug} (${categoryId}) (site: ${siteId})`,
    );

    try {
      // Fetch HTML using Puppeteer
      const html = await this.puppeteerPool.fetchPage(categoryUrl);

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

      // Run filter matching on ALL articles (both new and existing)
      const allArticles = [...saveResult.created, ...saveResult.existing];
      if (allArticles.length > 0) {
        this.logger.log(
          `🔍 Running filter matching on ${allArticles.length} articles (${saveResult.created.length} new, ${saveResult.existing.length} existing)`,
        );
        await this.filterMatchingService.processFreshDeals(allArticles);
      }

      const duration = Date.now() - startTime;

      this.logger.log(
        `✅ Completed LeBonCoin scrape job [${job.id}] for ${categorySlug} (${categoryId}):\n` +
        `   📊 Extracted: ${result.listings.length}, Saved: ${saveResult.created.length}, ` +
        `Skipped: ${saveResult.skipped}, Indexed: ${saveResult.indexed}\n` +
        `   ⏱️  Duration: ${duration}ms`,
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

      this.logger.error(
        `❌ Failed LeBonCoin scrape job [${job.id}] for ${categorySlug} (${categoryId}):\n` +
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

  @Process('discovery')
  async handleDiscoveryJob(job: Job<DiscoveryJobData>): Promise<DiscoveryResult> {
    const startTime = Date.now();
    const siteId = SiteSource.LEBONCOIN;

    this.logger.log(
      `🔍 Processing LeBonCoin discovery job [${job.id}] (triggered by: ${job.data.triggeredBy || 'unknown'})`,
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
        `✅ Completed LeBonCoin discovery job [${job.id}]:\n` +
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
        `❌ Failed LeBonCoin discovery job [${job.id}]:\n` +
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
