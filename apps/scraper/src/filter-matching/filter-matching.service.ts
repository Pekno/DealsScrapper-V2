import { Injectable, Logger } from '@nestjs/common';
import type { Article, Filter } from '@dealscrapper/database';
import { PrismaService } from '@dealscrapper/database';
import {
  FilterRepository,
  MatchRepository,
  CategoryRepository,
  MatchCreateData,
} from '../repositories/index.js';
import {
  FilterEvaluationService,
  FilterEvaluationResult,
  FilterAnalysis,
} from '../services/index.js';
import { DealProcessingUtils } from '../common/index.js';
import { ArticleWrapper } from '@dealscrapper/shared-types/article';
import type { RawDeal } from '@dealscrapper/shared-types';

/** Legacy type alias for backward compatibility */
export type MatchResult = FilterEvaluationResult;

/** Re-export FilterAnalysis for backward compatibility */
export type { FilterAnalysis } from '../services/index.js';

@Injectable()
export class FilterMatchingService {
  private readonly logger = new Logger(FilterMatchingService.name);

  constructor(
    private readonly filterRepository: FilterRepository,
    private readonly matchRepository: MatchRepository,
    private readonly categoryRepository: CategoryRepository,
    private readonly filterEvaluationService: FilterEvaluationService,
    private readonly prisma: PrismaService
  ) {}

  /**
   * Process fresh deals against all active filters to find matches.
   * NOTE: Notifications are handled by the scheduler, not by this service.
   * Evaluates each deal against every active filter and creates matches for qualifying deals.
   * @param deals - Array of fresh articles to process
   * @throws Error if deal processing fails
   */
  /**
   * Process fresh deals against all active filters to find matches.
   * NOTE: Notifications are handled by the scheduler, not by this service.
   * Evaluates each deal against every active filter and creates matches for qualifying deals.
   * @param deals - Array of fresh articles to process
   * @throws Error if deal processing fails
   */
  async processFreshDeals(deals: Article[]): Promise<void> {
    this.logger.log(
      `🔍 Processing ${deals.length} fresh deals for filter matching`
    );

    if (deals.length === 0) {
      this.logger.log('⚠️ No deals to process');
      return;
    }

    // Group deals by categoryId to optimize filter queries
    const dealsByCategory = this.groupDealsByCategory(deals);

    this.logger.log(
      `📋 Found deals in ${Object.keys(dealsByCategory).length} different categories`
    );

    // Process each category group separately
    let totalFiltersEvaluated = 0;
    for (const [categoryId, categoryDeals] of Object.entries(dealsByCategory)) {
      const filterCount = await this.processDealsByCategory(categoryId, categoryDeals);
      totalFiltersEvaluated += filterCount;
    }

    this.logProcessingSummary(
      deals.length,
      Object.keys(dealsByCategory).length,
      totalFiltersEvaluated
    );
  }

  /**
   * Evaluate a single filter against a raw deal to determine if there's a match.
   * Delegates to FilterEvaluationService for pure business logic evaluation.
   * @param filter - Filter with rule expression to evaluate
   * @param deal - Raw deal data to evaluate against filter rules
   * @returns Match result with score and detailed reasons
   * @throws Error if filter expression is malformed or evaluation fails
   */
  async evaluateFilter(filter: Filter, deal: RawDeal): Promise<MatchResult> {
    return this.filterEvaluationService.evaluateFilter(filter, deal);
  }

  /**
   * Analyze multiple filters to extract optimization parameters for URL filtering.
   * Delegates to FilterEvaluationService for pure business logic analysis.
   * @param filters - Array of filters to analyze
   * @returns Optimization analysis with URL and processing filter parameters
   */
  analyzeFiltersForOptimization(filters: Filter[]): FilterAnalysis {
    return this.filterEvaluationService.analyzeFiltersForOptimization(filters);
  }

  // =====================================
  // Private Helper Methods
  // =====================================

  /**
   * Process a single ArticleWrapper against all active filters.
   * Uses full site-specific extension data for accurate filter evaluation.
   * @param wrapper - ArticleWrapper with base article and site-specific extension
   * @param activeFilters - Active filters to evaluate against
   */
  private async processSingleDeal(
    wrapper: ArticleWrapper,
    activeFilters: Filter[]
  ): Promise<void> {
    const article = wrapper.base;
    this.logDealEvaluation(article);

    const matchCreateData: MatchCreateData[] = [];

    // Convert ArticleWrapper to RawDeal with full extension data
    const rawDeal = DealProcessingUtils.convertArticleWrapperToRawDeal(wrapper);

    // Evaluate all filters in parallel for better performance
    const evaluationPromises = activeFilters.map(async (filter) => {
      const matchResult = await this.evaluateFilter(filter, rawDeal);
      this.logFilterEvaluation(article, filter, matchResult);
      return { filter, matchResult };
    });

    const evaluations = await Promise.all(evaluationPromises);

    // Collect matches from parallel evaluations
    for (const { filter, matchResult } of evaluations) {
      if (matchResult.matches) {
        matchCreateData.push({
          filterId: filter.id,
          articleId: article.id,
          score: matchResult.score,
          notified: false,
        });
      }
    }

    await this.processMatchResults(article, matchCreateData);
  }

  /**
   * Legacy fallback: Process a single Article without extension data.
   * Used when ArticleWrapper loading fails.
   * @deprecated Use processSingleDeal with ArticleWrapper for full field support
   * @param article - Base article without extension data
   * @param activeFilters - Active filters to evaluate against
   */
  private async processSingleDealLegacy(
    article: Article,
    activeFilters: Filter[]
  ): Promise<void> {
    this.logDealEvaluation(article);

    const matchCreateData: MatchCreateData[] = [];

    // Convert Article back to RawDeal (missing site-specific fields)
    const rawDeal = DealProcessingUtils.convertArticleToRawDeal(article);

    // Evaluate all filters in parallel for better performance
    const evaluationPromises = activeFilters.map(async (filter) => {
      const matchResult = await this.evaluateFilter(filter, rawDeal);
      this.logFilterEvaluation(article, filter, matchResult);
      return { filter, matchResult };
    });

    const evaluations = await Promise.all(evaluationPromises);

    // Collect matches from parallel evaluations
    for (const { filter, matchResult } of evaluations) {
      if (matchResult.matches) {
        matchCreateData.push({
          filterId: filter.id,
          articleId: article.id,
          score: matchResult.score,
          notified: false,
        });
      }
    }

    await this.processMatchResults(article, matchCreateData);
  }

  /**
   * Process match results by creating matches.
   * NOTE: Notifications are handled by the scheduler, not by this service.
   */
  private async processMatchResults(
    deal: Article,
    matchCreateData: MatchCreateData[]
  ): Promise<void> {
    if (matchCreateData.length === 0) {
      this.logger.log("   💤 Deal didn't match any filters");
      return;
    }

    this.logger.log(`   🎉 Deal matched ${matchCreateData.length} filter(s)!`);

    await this.matchRepository.createManyMatches(matchCreateData);
  }

  /**
   * Log deal evaluation start with key metrics.
   */
  private logDealEvaluation(deal: Article): void {
    this.logger.log(
      `\n🎯 Evaluating deal: "${deal.title}" (ID: ${deal.externalId})`
    );
    // NOTE: temperature and merchant are now in extension tables, not base Article
    this.logger.log(
      `   📊 Price: ${deal.currentPrice || 'N/A'}€ | Site: ${deal.siteId} | CategoryId: ${deal.categoryId}`
    );
  }

  /**
   * Log filter evaluation result with detailed reasoning.
   */
  private logFilterEvaluation(
    deal: Article,
    filter: Filter,
    matchResult: MatchResult
  ): void {
    const logLines = [
      `🔍 Check Product ${deal.externalId} vs ${filter.name}:`,
      ...matchResult.reasons.map((reason) => `     - ${reason}`),
    ];

    if (matchResult.matches) {
      logLines.push(`  ✅ MATCH! Score: ${matchResult.score}`);
    } else {
      logLines.push(`  ❌ No match (Score: ${matchResult.score})`);
    }

    this.logger.log(logLines.join('\n'));
  }

  /**
   * Log final processing summary.
   */
  private logProcessingSummary(dealCount: number, categoryCount: number, filterCount: number): void {
    this.logger.log(
      `\n📈 Filter matching summary: ${dealCount} deals processed across ${categoryCount} categories against ${filterCount} active filters`
    );
  }

  /**
   * Group deals by their category for optimized processing.
   * @param deals - Array of articles to group
   * @returns Object with category names as keys and arrays of deals as values
   */
  private groupDealsByCategory(deals: Article[]): Record<string, Article[]> {
    const dealsByCategory: Record<string, Article[]> = {};

    for (const deal of deals) {
      const categoryId = deal.categoryId;
      if (!dealsByCategory[categoryId]) {
        dealsByCategory[categoryId] = [];
      }
      dealsByCategory[categoryId].push(deal);
    }

    return dealsByCategory;
  }

  /**
   * Process deals from a specific category against filters linked to that category only.
   * Uses proper foreign key relationships instead of string-based lookups.
   * Loads ArticleWrappers to include site-specific extension data for filter evaluation.
   * @param categoryId - ID of the category
   * @param deals - Deals from this category
   * @returns Number of active filters evaluated for this category
   */
  private async processDealsByCategory(
    categoryId: string,
    deals: Article[]
  ): Promise<number> {
    this.logger.log(
      `\n🏷️ Processing ${deals.length} deals from categoryId: "${categoryId}"`
    );

    // Get only filters that are linked to this specific category via filter_categories junction table
    const categoryFilters =
      await this.filterRepository.findActiveByCategoryId(categoryId);

    this.logger.log(
      `📋 Found ${categoryFilters.length} active filters for categoryId "${categoryId}"`
    );

    if (categoryFilters.length === 0) {
      this.logger.log(
        `⚠️ No active filters found for categoryId "${categoryId}" - no matches will be generated`
      );
      return 0;
    }

    // Load ArticleWrappers with site-specific extension data for proper filter evaluation
    const articleIds = deals.map((deal) => deal.id);

    try {
      const articleWrappers = await ArticleWrapper.loadMany(
        articleIds,
        this.prisma
      );
      this.logger.debug(
        `📦 Loaded ${articleWrappers.length} ArticleWrappers with extensions`
      );

      // Process each ArticleWrapper against the category-specific filters
      await Promise.all(
        articleWrappers.map(async (wrapper) => {
          await this.processSingleDeal(wrapper, categoryFilters);
        })
      );

      return categoryFilters.length;
    } catch (error) {
      // ArticleWrapper.loadMany is all-or-nothing: a single missing/stale id
      // (e.g. an article removed between persistence and matching, or carried
      // over from a re-scrape) throws and would otherwise poison the WHOLE
      // batch, stripping site-specific fields (e.g. temperature) from the
      // articles that ARE present. Recover per-deal so present articles keep
      // their extensions and only genuinely-missing ids degrade.
      this.logger.warn(
        `⚠️ Batch ArticleWrapper load failed (${(error as Error).message}); ` +
          'recovering per-deal so present articles keep site-specific fields'
      );
      await this.processDealsResilient(deals, categoryFilters);
      return categoryFilters.length;
    }
  }

  /**
   * Resilient per-deal processing used when batch wrapper loading fails.
   * Loads each deal's ArticleWrapper individually so a missing/stale id only
   * degrades that single deal to base Article processing instead of dropping
   * the entire batch to legacy processing (which loses site-specific fields).
   * @param deals - Articles to process
   * @param categoryFilters - Active filters for the category
   */
  private async processDealsResilient(
    deals: Article[],
    categoryFilters: Filter[]
  ): Promise<void> {
    const missingIds: string[] = [];

    await Promise.all(
      deals.map(async (deal) => {
        try {
          const wrapper = await ArticleWrapper.load(deal.id, this.prisma);
          await this.processSingleDeal(wrapper, categoryFilters);
        } catch (error) {
          missingIds.push(deal.id);
          this.logger.debug(
            `Deal "${deal.id}" lacks loadable extension ` +
              `(${(error as Error).message}); using base Article processing`
          );
          await this.processSingleDealLegacy(deal, categoryFilters);
        }
      })
    );

    if (missingIds.length > 0) {
      this.logger.warn(
        `⚠️ ${missingIds.length}/${deals.length} deal(s) degraded to base ` +
          `Article processing (site-specific fields unavailable): ${missingIds.join(', ')}`
      );
    }
  }
}
