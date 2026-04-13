import { Injectable, Logger } from '@nestjs/common';
import type { Article } from '@dealscrapper/database';
import type { ISiteAdapter } from '../adapters/base/site-adapter.interface.js';
import { extractErrorMessage } from '@dealscrapper/shared';
import { ArticleRepository } from '../repositories/article.repository.js';
import { FilterEvaluationService } from './filter-evaluation.service.js';
import { FilterRepository } from '../repositories/filter.repository.js';
import { CategoryRepository } from '../repositories/category.repository.js';
import { DealElasticSearchService } from '../elasticsearch/services/deal-elasticsearch.service.js';
import type { RawDeal } from '@dealscrapper/shared-types';

/**
 * Options for deal persistence operations
 */
export interface PersistenceOptions {
  /** Whether to use upsert (update if exists) instead of create */
  readonly useUpsert?: boolean;
  /** Whether to check for duplicates before creating */
  readonly checkDuplicates?: boolean;
  /** Whether to filter deals before persistence */
  readonly applyFiltering?: boolean;
}

/**
 * Result of a persistence operation
 */
export interface PersistenceResult {
  /** Successfully persisted articles */
  readonly savedArticles: Article[];
  /** Number of deals that were skipped as duplicates */
  readonly duplicatesSkipped: number;
  /** Number of deals that failed filter evaluation */
  readonly filteredOut: number;
  /** Any errors encountered during persistence */
  readonly errors: string[];
}

/**
 * Service responsible for all deal persistence operations
 * Consolidates database persistence logic from multiple services
 *
 * This service handles:
 * - Converting RawDeals to Articles
 * - Filtering deals before persistence
 * - Batch operations for efficiency
 * - Duplicate handling
 * - Error management and logging
 * - Presence-based expiry detection via markHiddenExpiredDeals()
 */
@Injectable()
export class DealPersistenceService {
  private readonly logger = new Logger(DealPersistenceService.name);

  constructor(
    private readonly articleRepository: ArticleRepository,
    private readonly filterRepository: FilterRepository,
    private readonly categoryRepository: CategoryRepository, // Added for category-specific filtering
    private readonly filterEvaluationService: FilterEvaluationService,
    private readonly dealElasticSearchService: DealElasticSearchService,
  ) {}

  /**
   * Persist a single deal with optional filtering
   *
   * @param deal - Raw deal to persist
   * @param options - Persistence options
   * @returns Persistence result with saved article or skip reason
   */
  async persistSingleDeal(
    deal: RawDeal,
    options: PersistenceOptions = {}
  ): Promise<PersistenceResult> {
    const { useUpsert = false, applyFiltering = true } = options;

    try {
      this.logger.debug(`Persisting single deal: ${deal.externalId}`);

      // Apply filtering if requested
      if (applyFiltering) {
        const shouldPersist = await this.shouldPersistDeal(deal);
        if (!shouldPersist) {
          return {
            savedArticles: [],
            duplicatesSkipped: 0,
            filteredOut: 1,
            errors: [],
          };
        }
      }

      // Persist the deal
      const savedArticle = useUpsert
        ? await this.articleRepository.upsertFromRawDeal(deal)
        : await this.articleRepository.createFromRawDeal(deal);

      this.logger.debug(`Successfully persisted deal: ${deal.externalId}`);

      return {
        savedArticles: [savedArticle],
        duplicatesSkipped: 0,
        filteredOut: 0,
        errors: [],
      };
    } catch (error) {
      const errorMessage = extractErrorMessage(error);
      this.logger.error(
        `Failed to persist deal ${deal.externalId}:`,
        errorMessage
      );

      return {
        savedArticles: [],
        duplicatesSkipped: 0,
        filteredOut: 0,
        errors: [errorMessage],
      };
    }
  }

  /**
   * Persist multiple deals efficiently with optional filtering and duplicate handling
   * Used by: DealExtractionService, MilestoneScrapingService
   *
   * @param deals - Array of raw deals to persist
   * @param options - Persistence options
   * @returns Aggregated persistence result
   */
  async persistMultipleDeals(
    deals: RawDeal[],
    options: PersistenceOptions = {}
  ): Promise<PersistenceResult> {
    if (deals.length === 0) {
      return {
        savedArticles: [],
        duplicatesSkipped: 0,
        filteredOut: 0,
        errors: [],
      };
    }

    const {
      useUpsert = false,
      checkDuplicates = true,
      applyFiltering = true,
    } = options;

    this.logger.log(
      `Persisting ${deals.length} deals (upsert: ${useUpsert}, filtering: ${applyFiltering})`
    );

    try {
      let dealsToProcess = deals;
      let duplicatesSkipped = 0;
      let filteredOut = 0;

      // Check for duplicates if requested
      if (checkDuplicates && !useUpsert) {
        const { uniqueDeals, duplicateCount } =
          await this.filterDuplicates(deals);
        dealsToProcess = uniqueDeals;
        duplicatesSkipped = duplicateCount;

        this.logger.debug(
          `Filtered ${duplicateCount} duplicates, ${uniqueDeals.length} unique deals remaining`
        );
      }

      // Apply filter evaluation if requested
      if (applyFiltering) {
        const { filteredDeals, filteredCount } =
          await this.filterDealsByActiveFilters(dealsToProcess);
        dealsToProcess = filteredDeals;
        filteredOut = filteredCount;

        this.logger.debug(
          `Filtered ${filteredCount} deals that didn't match filters, ${filteredDeals.length} deals remaining`
        );
      }

      // Persist remaining deals
      const savedArticles = useUpsert
        ? await this.articleRepository.upsertManyFromRawDeals(dealsToProcess)
        : await this.articleRepository.createManyFromRawDeals(dealsToProcess);

      this.logger.log(
        `Successfully persisted ${savedArticles.length} deals ` +
          `(${duplicatesSkipped} duplicates, ${filteredOut} filtered out)`
      );

      return {
        savedArticles,
        duplicatesSkipped,
        filteredOut,
        errors: [],
      };
    } catch (error) {
      const errorMessage = extractErrorMessage(error);
      this.logger.error(`Failed to persist deals:`, errorMessage);

      return {
        savedArticles: [],
        duplicatesSkipped: 0,
        filteredOut: 0,
        errors: [errorMessage],
      };
    }
  }

  /**
   * Persist deals that have already been filtered (no additional filtering applied)
   * Used when deals have been pre-filtered by another service
   *
   * @param deals - Pre-filtered deals to persist
   * @param useUpsert - Whether to use upsert instead of create
   * @returns Array of saved articles
   */
  async persistPreFilteredDeals(
    deals: RawDeal[],
    useUpsert = false
  ): Promise<Article[]> {
    if (deals.length === 0) return [];

    this.logger.debug(`Persisting ${deals.length} pre-filtered deals`);

    try {
      const savedArticles = useUpsert
        ? await this.articleRepository.upsertManyFromRawDeals(deals)
        : await this.articleRepository.createManyFromRawDeals(deals);

      this.logger.debug(
        `Successfully persisted ${savedArticles.length} pre-filtered deals`
      );
      return savedArticles;
    } catch (error) {
      const errorMessage = extractErrorMessage(error);
      this.logger.error(`Failed to persist pre-filtered deals:`, errorMessage);
      throw error;
    }
  }

  /**
   * Check if a deal already exists in the database or ElasticSearch
   *
   * @param externalId - External ID to check
   * @returns True if deal exists, false otherwise
   */
  async dealExists(externalId: string): Promise<boolean> {
    // Check PostgreSQL first (faster for recent deals)
    const existsInPostgres =
      await this.articleRepository.existsByExternalId(externalId);
    if (existsInPostgres) {
      this.logger.debug(`💾 Deal ${externalId} found in PostgreSQL`);
      return true;
    }

    // If not in PostgreSQL, check ElasticSearch (contains historical deals)
    try {
      const existingIds =
        await this.dealElasticSearchService.checkExistingDeals([externalId]);
      const existsInElastic = existingIds.has(externalId);
      if (existsInElastic) {
        this.logger.debug(
          `🔍 Deal ${externalId} found in ElasticSearch (not in PostgreSQL)`
        );
      } else {
        this.logger.debug(
          `🆕 Deal ${externalId} is new (not in PostgreSQL or ElasticSearch)`
        );
      }
      return existsInElastic;
    } catch (error) {
      this.logger.warn(
        `Failed to check ElasticSearch for deal ${externalId}:`,
        error
      );
      // Fall back to PostgreSQL result only if ElasticSearch fails
      return existsInPostgres;
    }
  }

  /**
   * Check existence for multiple deals efficiently
   *
   * @param externalIds - Array of external IDs to check
   * @returns Map of external ID to existence status
   */
  async checkMultipleDealExistence(
    externalIds: string[]
  ): Promise<Map<string, boolean>> {
    return this.articleRepository.checkExistenceByExternalIds(externalIds);
  }

  /**
   * Get recent articles for processing
   *
   * @param hours - Number of hours to look back
   * @returns Array of recent articles
   */
  async getRecentArticles(hours: number): Promise<Article[]> {
    return this.articleRepository.findRecent(hours);
  }

  /**
   * Mark articles as expired when they're no longer appearing on the scraped page
   * This handles the case where Dealabs hides expired listings instead of marking them
   *
   * @param categorySlug - Category slug being scraped
   * @param extractedExternalIds - External IDs found on the current page
   * @returns Number of articles marked as expired
   */
  async markHiddenExpiredDeals(
    categorySlug: string,
    extractedExternalIds: Set<string>,
    adapter: ISiteAdapter,
  ): Promise<number> {
    try {
      this.logger.log(
        `🔍 Checking for hidden expired deals in category: ${categorySlug}`
      );

      // Get category ID from slug for database lookup
      const categoryId =
        await this.categoryRepository.findCategoryIdBySlug(categorySlug);

      if (!categoryId) {
        this.logger.warn(
          `📂 Category slug "${categorySlug}" not found in database - no articles to check`
        );
        return 0;
      }

      this.logger.log(
        `📂 Category slug "${categorySlug}" resolved to categoryId: ${categoryId}`
      );

      // Find ALL active articles in this category (no age filter)
      const activeArticles = await this.articleRepository.findMany({
        categoryId: categoryId,
        isActive: true,
      });

      this.logger.log(
        `📋 Found ${activeArticles.length} active articles in categoryId: ${categoryId}`
      );

      if (activeArticles.length === 0) {
        this.logger.log(
          `📭 No active articles found for categoryId: ${categoryId}`
        );
        return 0;
      }

      // Log all extracted external IDs for debugging
      const extractedIds = Array.from(extractedExternalIds);
      this.logger.log(
        `🌐 External IDs found on current page (${extractedIds.length}): ${extractedIds.join(', ')}`
      );

      // Log all existing article external IDs for comparison
      const existingIds = activeArticles.map((article) => article.externalId);
      this.logger.log(
        `💾 External IDs in database (${existingIds.length}): ${existingIds.join(', ')}`
      );

      // Find articles that are no longer on the page (hidden by Dealabs)
      const hiddenArticles = activeArticles.filter(
        (article) => !extractedExternalIds.has(article.externalId)
      );

      // Log detailed comparison
      if (hiddenArticles.length > 0) {
        const hiddenIds = hiddenArticles.map((article) => article.externalId);
        this.logger.log(
          `🕰️ MISSING from page (potential expired): ${hiddenIds.join(', ')}`
        );

        // Log individual article details for debugging
        hiddenArticles.forEach((article) => {
          const titlePreview = article.title
            ? article.title.substring(0, 50)
            : 'No title';
          this.logger.log(
            `   📄 Missing Article: ID=${article.externalId}, title="${titlePreview}...", scraped=${article.scrapedAt?.toISOString()}`
          );
        });
      } else {
        this.logger.log(
          `✅ All ${activeArticles.length} active articles still visible on page for categoryId: ${categoryId}`
        );

        // Log which articles are still visible for confirmation
        const visibleIds = activeArticles
          .filter((article) => extractedExternalIds.has(article.externalId))
          .map((article) => article.externalId);
        if (visibleIds.length > 0) {
          this.logger.log(`👀 Still visible: ${visibleIds.join(', ')}`);
        }

        return 0;
      }

      // Mark hidden articles as expired
      const hiddenExternalIds = hiddenArticles.map(
        (article) => article.externalId
      );
      this.logger.log(
        `🔄 Marking ${hiddenExternalIds.length} articles as expired: ${hiddenExternalIds.join(', ')}`
      );

      let updateCount: number;

      if (adapter.expiryResolver) {
        // Resolve per-article expiry dates and update individually
        const updates = hiddenArticles.map((article) => {
          const expiresAt = adapter.expiryResolver!.resolveExpiredAt(article);
          return this.articleRepository.updateMany(
            { externalId: article.externalId },
            { isActive: false, isExpired: true, expiresAt },
          );
        });
        const counts = await Promise.all(updates);
        updateCount = counts.reduce((sum, n) => sum + n, 0);
      } else {
        updateCount = await this.articleRepository.updateMany(
          { externalId: { in: hiddenExternalIds } },
          { isActive: false, isExpired: true, expiresAt: new Date() },
        );
      }

      this.logger.log(
        `🕰️ Successfully marked ${updateCount} hidden deals as expired in categoryId ${categoryId} ` +
          `(${extractedExternalIds.size} visible on page, ${activeArticles.length} active total)`
      );

      // Log summary for easy tracking
      this.logger.log(
        `📊 SUMMARY - Category: ${categorySlug} | Found on page: ${extractedIds.length} | In DB: ${existingIds.length} | Expired: ${updateCount}`
      );

      return updateCount;
    } catch (error) {
      this.logger.error(
        `❌ Failed to mark hidden expired deals for category ${categorySlug}:`,
        error
      );
      return 0;
    }
  }

  /**
   * Extract category slug from category name for expired detection
   * @param categoryName - Category name like "cartes graphiques"
   * @returns Category slug like "cartes-graphiques" or null if extraction fails
   */
  private extractCategorySlugFromCategoryName(
    categoryName: string
  ): string | null {
    try {
      // Convert category name to slug format (same logic as in ArticleRepository)
      const slug = categoryName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      return slug || null;
    } catch (error) {
      this.logger.warn(
        `Failed to extract category slug from name "${categoryName}":`,
        error
      );
      return null;
    }
  }

  /**
   * Extract category name from category slug for database lookup
   * Maps common slugs to proper category names used in database
   */
  // REMOVED: This method is no longer needed since we use categoryId foreign keys

  // =====================================
  // Private Helper Methods
  // =====================================

  /**
   * Group deals by their category for optimized processing.
   * @param deals - Array of deals to group
   * @returns Object with category names as keys and arrays of deals as values
   */
  private groupDealsByCategory(deals: RawDeal[]): Record<string, RawDeal[]> {
    const dealsByCategory: Record<string, RawDeal[]> = {};

    for (const deal of deals) {
      const categoryName = deal.category;
      if (!dealsByCategory[categoryName]) {
        dealsByCategory[categoryName] = [];
      }
      dealsByCategory[categoryName].push(deal);
    }

    return dealsByCategory;
  }

  /**
   * Check if a deal should be persisted based on category-specific active filters
   */
  private async shouldPersistDeal(deal: RawDeal): Promise<boolean> {
    try {
      // Get category ID for this deal's category
      const categoryId = await this.categoryRepository.findCategoryIdByName(
        deal.category
      );

      if (!categoryId) {
        this.logger.debug(
          `⚠️ Could not find category ID for "${deal.category}" - deal ${deal.externalId} will not be persisted`
        );
        return false;
      }

      // Get only filters linked to this specific category
      const categoryFilters =
        await this.filterRepository.findActiveByCategoryId(categoryId);

      this.logger.debug(
        `🔍 Persistence phase: Found ${categoryFilters.length} active filters for category "${deal.category}" (deal ${deal.externalId})`
      );

      if (categoryFilters.length === 0) {
        this.logger.debug(
          `⚠️ No active filters found for category "${deal.category}" - deal ${deal.externalId} will not be persisted`
        );
        return false;
      }

      // Evaluate all category-specific filters in parallel for better performance
      const evaluationPromises = categoryFilters.map((filter) =>
        this.filterEvaluationService.evaluateFilter(filter, deal)
      );

      const evaluations = await Promise.all(evaluationPromises);

      // Check if any evaluation resulted in a match
      const hasMatch = evaluations.some((evaluation) => evaluation.matches);

      if (hasMatch) {
        this.logger.debug(
          `✅ Deal ${deal.externalId} matches at least one filter in category "${deal.category}" - will be persisted`
        );
      } else {
        this.logger.debug(
          `❌ Deal ${deal.externalId} matches no filters in category "${deal.category}" - will not be persisted`
        );
      }

      return hasMatch;
    } catch (error) {
      this.logger.error(`Error checking if deal should be persisted:`, error);
      return false; // Fail safe - don't persist if evaluation fails
    }
  }

  /**
   * Filter out duplicate deals based on external ID
   * Uses PostgreSQL for fast batch duplicate detection
   */
  private async filterDuplicates(deals: RawDeal[]): Promise<{
    uniqueDeals: RawDeal[];
    duplicateCount: number;
  }> {
    const externalIds = deals.map((deal) => deal.externalId);
    const existenceMap =
      await this.articleRepository.checkExistenceByExternalIds(externalIds);

    const uniqueDeals = deals.filter(
      (deal) => !existenceMap.get(deal.externalId)
    );
    const duplicateCount = deals.length - uniqueDeals.length;

    this.logger.debug(
      `💾 PostgreSQL batch check: ${duplicateCount} duplicates found out of ${deals.length} deals`
    );

    return { uniqueDeals, duplicateCount };
  }

  /**
   * Filter deals by category-specific active filters
   */
  private async filterDealsByActiveFilters(deals: RawDeal[]): Promise<{
    filteredDeals: RawDeal[];
    filteredCount: number;
  }> {
    try {
      // Group deals by category for optimized processing
      const dealsByCategory = this.groupDealsByCategory(deals);
      const filteredDeals: RawDeal[] = [];

      // Process each category separately with category-specific filters
      for (const [categoryName, categoryDeals] of Object.entries(
        dealsByCategory
      )) {
        try {
          // Get category ID for this category
          const categoryId =
            await this.categoryRepository.findCategoryIdByName(categoryName);

          if (!categoryId) {
            this.logger.debug(
              `⚠️ Could not find category ID for "${categoryName}" - skipping ${categoryDeals.length} deals`
            );
            continue;
          }

          // Get only filters linked to this specific category
          const categoryFilters =
            await this.filterRepository.findActiveByCategoryId(categoryId);

          if (categoryFilters.length === 0) {
            this.logger.debug(
              `⚠️ No active filters found for category "${categoryName}" - filtering out ${categoryDeals.length} deals`
            );
            continue;
          }

          // Use FilterEvaluationService to find matching deals for this category
          const categoryFilteredDeals =
            await this.filterEvaluationService.findMatchingDeals(
              categoryDeals,
              categoryFilters
            );

          this.logger.debug(
            `📋 Category "${categoryName}": ${categoryFilteredDeals.length}/${categoryDeals.length} deals passed filtering`
          );
          filteredDeals.push(...categoryFilteredDeals);
        } catch (error) {
          this.logger.error(
            `Error filtering deals for category "${categoryName}":`,
            error
          );
          // Continue with other categories even if one fails
        }
      }

      const filteredCount = deals.length - filteredDeals.length;
      this.logger.debug(
        `🔍 Total filtering result: ${filteredDeals.length}/${deals.length} deals passed category-specific filtering`
      );

      return { filteredDeals, filteredCount };
    } catch (error) {
      this.logger.error(
        'Error filtering deals by category-specific active filters:',
        error
      );
      // Fail safe - return empty array if filtering fails
      return { filteredDeals: [], filteredCount: deals.length };
    }
  }

}
