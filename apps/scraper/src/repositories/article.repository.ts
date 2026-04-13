import { Injectable, Logger } from '@nestjs/common';
import { PrismaService, Prisma } from '@dealscrapper/database';
import type { Article } from '@dealscrapper/database';
import { AbstractBaseRepository } from '@dealscrapper/shared-repository';
import type {
  PaginationOptions,
  PaginatedResult,
} from '@dealscrapper/shared-repository';
import { SiteSource } from '@dealscrapper/shared-types';
import type { RawDeal } from '@dealscrapper/shared-types';

/**
 * Repository interface for Article entity operations
 * Defines all article-related database operations used across the application
 */
export interface IArticleRepository {
  /**
   * Find article by external ID
   * @param externalId - External deal identifier
   * @returns Article or null if not found
   */
  findByExternalId(externalId: string): Promise<Article | null>;

  /**
   * Check if an article exists by external ID
   * @param externalId - External deal identifier to check
   * @returns True if article exists, false otherwise
   */
  existsByExternalId(externalId: string): Promise<boolean>;

  /**
   * Create a single article from RawDeal
   * @param deal - Raw deal data to store
   * @returns Created article
   */
  createFromRawDeal(deal: RawDeal): Promise<Article>;

  /**
   * Create multiple articles from RawDeals
   * @param deals - Array of raw deals to store
   * @returns Array of created articles
   */
  createManyFromRawDeals(deals: RawDeal[]): Promise<Article[]>;

  /**
   * Upsert an article (create or update based on external ID)
   * @param deal - Raw deal data
   * @returns Created or updated article
   */
  upsertFromRawDeal(deal: RawDeal): Promise<Article>;

  /**
   * Upsert multiple articles efficiently
   * @param deals - Array of raw deals to upsert
   * @returns Array of created or updated articles
   */
  upsertManyFromRawDeals(deals: RawDeal[]): Promise<Article[]>;

  /**
   * Find articles by category ID
   * @param categoryId - Category ID to filter by
   * @returns Array of articles in the category
   */
  findByCategoryId(categoryId: string): Promise<Article[]>;

  /**
   * Find recent articles (within specified hours)
   * @param hours - Number of hours to look back
   * @returns Array of recent articles
   */
  findRecent(hours: number): Promise<Article[]>;

  /**
   * Count articles by external IDs (for duplicate checking)
   * @param externalIds - Array of external IDs to check
   * @returns Map of external ID to boolean (true if exists)
   */
  checkExistenceByExternalIds(
    externalIds: string[]
  ): Promise<Map<string, boolean>>;

  /**
   * Delete articles older than specified days
   * @param days - Number of days to keep
   * @returns Number of deleted articles
   */
  deleteOlderThan(days: number): Promise<number>;
}

/**
 * Repository implementation for Article entity operations
 * Centralizes all article-related database access patterns used across services
 */
@Injectable()
export class ArticleRepository
  extends AbstractBaseRepository<
    Article,
    Prisma.ArticleCreateInput,
    Prisma.ArticleUpdateInput,
    Prisma.ArticleWhereInput
  >
  implements IArticleRepository
{
  protected readonly logger = new Logger(ArticleRepository.name);

  constructor(protected readonly prisma: PrismaService) {
    super(prisma);
  }

  /**
   * Implementation of abstract method - returns the Prisma model delegate
   */
  protected getModel() {
    return this.prisma.article;
  }

  /**
   * Articles use scrapedAt for ordering, not createdAt
   */
  protected getDefaultOrderBy() {
    return { scrapedAt: 'desc' as const };
  }

  /**
   * Required fields for article creation
   */
  protected getRequiredCreateFields(): string[] {
    return ['externalId', 'title', 'source'];
  }

  /**
   * Find article by external ID
   * Used by: MilestoneScrapingService, DealExtractionService
   * Note: Since Article has compound unique on [source, externalId],
   * we use findFirst when source is unknown
   */
  async findByExternalId(externalId: string): Promise<Article | null> {
    try {
      return await this.prisma.article.findFirst({
        where: { externalId },
      });
    } catch (error) {
      this.handleDatabaseError(
        error,
        `Find article by external ID ${externalId}`
      );
    }
  }

  /**
   * Check if an article exists by external ID (optimized for existence checks)
   * Used by: MilestoneScrapingService for duplicate detection
   */
  async existsByExternalId(externalId: string): Promise<boolean> {
    try {
      const count = await this.prisma.article.count({
        where: { externalId },
      });
      return count > 0;
    } catch (error) {
      this.handleDatabaseError(
        error,
        `Check article existence for external ID ${externalId}`
      );
    }
  }

  /**
   * Create a single article from RawDeal
   * Used by: DealPersistenceService, MilestoneScrapingService
   * Delegates to create() after converting RawDeal to ArticleCreateInput
   */
  async createFromRawDeal(deal: RawDeal): Promise<Article> {
    try {
      const articleData = await this.convertRawDealToArticleInput(deal);

      // Delegate to the base create() method - single source of truth for creation
      return await this.create(articleData);
    } catch (error) {
      this.handleDatabaseError(
        error,
        `Create article from RawDeal ${deal.externalId}`
      );
    }
  }

  /**
   * Create multiple articles from RawDeals
   * Used by: DealPersistenceService for batch operations
   */
  async createManyFromRawDeals(deals: RawDeal[]): Promise<Article[]> {
    try {
      const articles: Article[] = [];

      // Use individual creates to get returned objects with IDs
      for (const deal of deals) {
        const article = await this.createFromRawDeal(deal);
        articles.push(article);
      }

      return articles;
    } catch (error) {
      this.handleDatabaseError(
        error,
        `Create many articles from ${deals.length} RawDeals`
      );
    }
  }

  /**
   * Upsert an article (create or update based on external ID + siteId)
   * Used by: DealExtractionService for handling duplicates
   * Uses compound unique key [siteId, externalId]
   */
  async upsertFromRawDeal(deal: RawDeal): Promise<Article> {
    try {
      const articleData = await this.convertRawDealToArticleInput(deal);

      // Use compound unique key for upsert
      return await this.prisma.article.upsert({
        where: {
          siteId_externalId: {
            siteId: deal.source,
            externalId: deal.externalId,
          },
        },
        create: articleData,
        update: {
          ...articleData,
          scrapedAt: new Date(),
        },
      });
    } catch (error) {
      this.handleDatabaseError(
        error,
        `Upsert article from RawDeal ${deal.externalId}`
      );
    }
  }

  /**
   * Upsert multiple articles efficiently
   * Used by: DealExtractionService for batch persistence
   */
  async upsertManyFromRawDeals(deals: RawDeal[]): Promise<Article[]> {
    try {
      const articles: Article[] = [];

      // Use individual upserts to handle duplicates properly
      for (const deal of deals) {
        const article = await this.upsertFromRawDeal(deal);
        articles.push(article);
      }

      return articles;
    } catch (error) {
      this.handleDatabaseError(
        error,
        `Upsert many articles from ${deals.length} RawDeals`
      );
    }
  }

  /**
   * Find articles by category
   */
  async findByCategoryId(categoryId: string): Promise<Article[]> {
    try {
      return await this.prisma.article.findMany({
        where: { categoryId },
      });
    } catch (error) {
      this.handleDatabaseError(
        error,
        `Find articles by categoryId ${categoryId}`
      );
    }
  }

  /**
   * Find recent articles (within specified hours)
   */
  async findRecent(hours: number): Promise<Article[]> {
    try {
      const cutoffDate = new Date(Date.now() - hours * 60 * 60 * 1000);

      return await this.prisma.article.findMany({
        where: {
          scrapedAt: {
            gte: cutoffDate,
          },
        },
        orderBy: {
          scrapedAt: 'desc',
        },
      });
    } catch (error) {
      this.handleDatabaseError(
        error,
        `Find recent articles within ${hours} hours`
      );
    }
  }

  /**
   * Check existence by external IDs for efficient duplicate detection
   */
  async checkExistenceByExternalIds(
    externalIds: string[]
  ): Promise<Map<string, boolean>> {
    try {
      const existingArticles = await this.prisma.article.findMany({
        where: {
          externalId: {
            in: externalIds,
          },
        },
      });

      const existenceMap = new Map<string, boolean>();
      const existingExternalIds = new Set(
        existingArticles.map((a) => a.externalId)
      );

      externalIds.forEach((id) => {
        existenceMap.set(id, existingExternalIds.has(id));
      });

      return existenceMap;
    } catch (error) {
      this.handleDatabaseError(
        error,
        `Check existence for ${externalIds.length} external IDs`
      );
    }
  }

  /**
   * Delete articles older than specified days
   */
  async deleteOlderThan(days: number): Promise<number> {
    try {
      const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const result = await this.prisma.article.deleteMany({
        where: {
          scrapedAt: {
            lt: cutoffDate,
          },
        },
      });

      return result.count;
    } catch (error) {
      this.handleDatabaseError(
        error,
        `Delete articles older than ${days} days`
      );
    }
  }

  /**
   * Convert RawDeal to Article input format for database creation
   * @param deal - Raw deal to convert
   * @returns Article creation input data
   *
   * NOTE: Only includes UNIVERSAL fields that exist on base Article model.
   * Site-specific fields (temperature, merchant, etc.) go into extension tables
   * and are handled by MultiSiteArticleService.
   */
  private async convertRawDealToArticleInput(
    deal: RawDeal
  ): Promise<Prisma.ArticleCreateInput> {
    // Find or create category by name and siteId
    const categoryId = await this.findOrCreateCategoryIdByName(
      deal.category,
      deal.source
    );

    // Only include UNIVERSAL fields from the Article schema
    return {
      externalId: deal.externalId,
      title: deal.title,
      description: deal.description || null,
      url: deal.url,
      imageUrl: deal.imageUrl || null,
      currentPrice: deal.currentPrice || null,
      site: {
        connect: { id: deal.source },
      },
      category: {
        connect: { id: categoryId },
      },
      categoryPath: deal.categoryPath || [],
      isActive: deal.isActive,
      isExpired: deal.isExpired,
      location: deal.storeLocation || null, // Map storeLocation to location
      publishedAt: deal.publishedAt || null,
      scrapedAt: new Date(),
    };
  }

  /**
   * Find category ID by name, or create if it doesn't exist
   * Uses compound unique key [siteId, sourceUrl]
   */
  private async findOrCreateCategoryIdByName(
    categoryName: string,
    siteId: string
  ): Promise<string> {
    try {
      // Generate slug consistently
      const slug = categoryName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

      // Build source URL based on site
      const sourceUrl = await this.buildSourceUrl(siteId, slug);

      // Use upsert with compound unique key [siteId, sourceUrl]
      const category = await this.prisma.category.upsert({
        where: {
          siteId_sourceUrl: {
            siteId,
            sourceUrl,
          },
        },
        update: {}, // No updates needed if it exists
        create: {
          name: categoryName,
          slug,
          siteId,
          sourceUrl,
          level: 1,
          isActive: true,
        },
      });

      return category.id;
    } catch (error) {
      // If upsert fails, try to find by name and siteId as fallback
      try {
        const existingCategory = await this.prisma.category.findFirst({
          where: { name: categoryName, siteId },
        });

        if (existingCategory) {
          return existingCategory.id;
        }
      } catch (fallbackError) {
        // Log the fallback error but continue with the original error
        this.logger.warn(`Fallback category lookup also failed: ${fallbackError}`);
      }

      this.handleDatabaseError(
        error,
        `Find or create category for name: ${categoryName}, siteId: ${siteId}`
      );
    }
  }

  /**
   * Build source URL based on site type using database configuration
   */
  private async buildSourceUrl(siteId: string, slug: string): Promise<string> {
    const site = await this.prisma.site.findUnique({
      where: { id: siteId },
    });

    if (!site) {
      // Fallback for unknown sites
      return `https://unknown.site/${slug}`;
    }

    // Use categoryDiscoveryUrl pattern with slug appended
    return `${site.categoryDiscoveryUrl}${slug}`;
  }
}
