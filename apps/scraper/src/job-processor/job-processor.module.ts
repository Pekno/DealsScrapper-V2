import { Module, Logger, type DynamicModule, type Provider, type Type } from '@nestjs/common';
import { BullModule, type BullModuleOptions } from '@nestjs/bull';
import {
  DealabsScrapeProcessor,
  VintedScrapeProcessor,
  LeBonCoinScrapeProcessor,
} from './multi-site-scrape.processor.js';
import { PrismaService } from '@dealscrapper/database';
import { PuppeteerPoolModule } from '../puppeteer-pool/puppeteer-pool.module.js';
import { CategoryDiscoveryModule } from '../category-discovery/category-discovery.module.js';
import { DealElasticSearchModule } from '../elasticsearch/elasticsearch.module.js';
import { FilterMatchingModule } from '../filter-matching/filter-matching.module.js';
import { ScrapingJobRepository } from '../repositories/scraping-job.repository.js';
import { ArticleRepository } from '../repositories/article.repository.js';
import { CategoryRepository } from '../repositories/category.repository.js';
import { FilterRepository } from '../repositories/filter.repository.js';
import { FilterEvaluationService } from '../services/filter-evaluation.service.js';
import { RuleEngineService } from '../filter-matching/rule-engine.service.js';
import { ScheduledJobService } from '../services/scheduled-job.service.js';
import { MultiSiteArticleService } from '../services/multi-site-article.service.js';
import { AdapterRegistry } from '../adapters/adapter.registry.js';
import { UnifiedExtractionService } from '../extraction/unified-extraction.service.js';
import { DealabsAdapter } from '../adapters/dealabs/dealabs.adapter.js';
import { DealabsUrlOptimizer } from '../adapters/dealabs/dealabs-url-optimizer.js';
import { DealabsExpiryResolver } from '../adapters/dealabs/dealabs-expiry-resolver.js';
import { DealPersistenceService } from '../services/deal-persistence.service.js';
import { VintedAdapter } from '../adapters/vinted/vinted.adapter.js';
import { LeBonCoinAdapter } from '../adapters/leboncoin/leboncoin.adapter.js';
import { FieldExtractorService } from '../field-extraction/field-extractor.service.js';
import { SITE_QUEUE_CONFIGS, SiteSource, getSiteQueueName } from '@dealscrapper/shared-types';

/**
 * Mapping of site sources to their processor classes
 */
const SITE_PROCESSOR_MAP: Record<SiteSource, Type> = {
  [SiteSource.DEALABS]: DealabsScrapeProcessor,
  [SiteSource.VINTED]: VintedScrapeProcessor,
  [SiteSource.LEBONCOIN]: LeBonCoinScrapeProcessor,
};

/**
 * Get the configured site from environment variable
 * Returns null if SCRAPER_SITE is not set or set to "all"
 */
function getConfiguredSite(): SiteSource | null {
  const scraperSite = process.env.SCRAPER_SITE?.toLowerCase();

  if (!scraperSite || scraperSite === 'all') {
    return null; // Process all sites
  }

  // Validate the site value
  const validSites = Object.values(SiteSource);
  if (validSites.includes(scraperSite as SiteSource)) {
    return scraperSite as SiteSource;
  }

  // Log warning for invalid site value
  const logger = new Logger('JobProcessorModule');
  logger.warn(
    `Invalid SCRAPER_SITE value: "${scraperSite}". Valid values: ${validSites.join(', ')}, all. Defaulting to all sites.`
  );
  return null;
}

/**
 * Get queue configurations based on configured site
 */
function getQueueConfigs(): BullModuleOptions[] {
  const configuredSite = getConfiguredSite();

  if (configuredSite) {
    // Single site mode - only register the specific queue
    const queueName = getSiteQueueName(configuredSite);
    return SITE_QUEUE_CONFIGS.filter(config => config.name === queueName);
  }

  // All sites mode - register all queues
  return [...SITE_QUEUE_CONFIGS];
}

/**
 * Get processor providers based on configured site
 */
function getProcessorProviders(): Provider[] {
  const configuredSite = getConfiguredSite();

  if (configuredSite) {
    // Single site mode - only register the specific processor
    return [SITE_PROCESSOR_MAP[configuredSite]];
  }

  // All sites mode - register all processors
  return Object.values(SITE_PROCESSOR_MAP);
}

@Module({})
export class JobProcessorModule {
  private static readonly logger = new Logger(JobProcessorModule.name);

  static register(): DynamicModule {
    const configuredSite = getConfiguredSite();
    const queueConfigs = getQueueConfigs();
    const processorProviders = getProcessorProviders();

    // Log the configuration
    if (configuredSite) {
      this.logger.log(
        `🎯 Site-dedicated mode: Processing only ${configuredSite.toUpperCase()} jobs`
      );
    } else {
      this.logger.log(
        `🌐 Multi-site mode: Processing jobs for ALL sites (${Object.values(SiteSource).join(', ')})`
      );
    }

    return {
      module: JobProcessorModule,
      imports: [
        // Register site-specific queues based on configuration
        BullModule.registerQueue(...queueConfigs),
        CategoryDiscoveryModule,
        PuppeteerPoolModule,
        DealElasticSearchModule,
        FilterMatchingModule,
      ],
      providers: [
        // Site-specific processors based on configuration
        ...processorProviders,

        // Repositories
        PrismaService,
        ScrapingJobRepository,
        ArticleRepository,
        CategoryRepository,
        ScheduledJobService,

        // Article Service (unified creation with extensions + ES indexing)
        MultiSiteArticleService,

        // Adapters & Extraction
        AdapterRegistry,
        UnifiedExtractionService,
        DealabsAdapter,
        DealabsUrlOptimizer,
        DealabsExpiryResolver,
        VintedAdapter,
        LeBonCoinAdapter,
        FieldExtractorService,

        // Deal persistence (presence-based expiry detection)
        FilterRepository,
        RuleEngineService,
        FilterEvaluationService,
        DealPersistenceService,
      ],
      exports: processorProviders,
    };
  }
}
