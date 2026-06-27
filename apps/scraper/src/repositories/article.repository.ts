import { Injectable } from '@nestjs/common';
import { PrismaService, Prisma } from '@dealscrapper/database';
import type { Article } from '@dealscrapper/database';
import { AbstractBaseRepository } from '@dealscrapper/shared-repository';
import type {
  PaginationOptions,
  PaginatedResult,
} from '@dealscrapper/shared-repository';

/**
 * Repository interface for Article entity operations
 * Defines all article-related database operations used across the application
 */
export interface IArticleRepository {
  /**
   * Find article by external ID within a specific site
   * @param externalId - External deal identifier
   * @param siteId - Site the externalId belongs to (externalId is only unique per site)
   * @returns Article or null if not found
   */
  findByExternalId(externalId: string, siteId: string): Promise<Article | null>;

  /**
   * Check if an article exists by external ID within a specific site
   * @param externalId - External deal identifier to check
   * @param siteId - Site the externalId belongs to (externalId is only unique per site)
   * @returns True if article exists, false otherwise
   */
  existsByExternalId(externalId: string, siteId: string): Promise<boolean>;

  /**
   * Find articles by category ID
   * @param categoryId - Category ID to filter by
   * @returns Array of articles in the category
   */
  findByCategoryId(categoryId: string): Promise<Article[]>;

  /**
   * Count articles by external IDs within a specific site (for duplicate checking)
   * @param externalIds - Array of external IDs to check
   * @param siteId - Site the externalIds belong to (externalId is only unique per site)
   * @returns Map of external ID to boolean (true if exists)
   */
  checkExistenceByExternalIds(
    externalIds: string[],
    siteId: string
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
   * Find article by external ID within a specific site
   * Uses compound unique key [siteId, externalId] since externalId is only
   * unique per site.
   */
  async findByExternalId(
    externalId: string,
    siteId: string
  ): Promise<Article | null> {
    try {
      return await this.prisma.article.findUnique({
        where: { siteId_externalId: { siteId, externalId } },
      });
    } catch (error) {
      this.handleDatabaseError(
        error,
        `Find article by external ID ${externalId} for site ${siteId}`
      );
    }
  }

  /**
   * Check if an article exists by external ID within a specific site
   * (optimized for existence checks). Scoped by siteId since externalId is
   * only unique per site.
   */
  async existsByExternalId(
    externalId: string,
    siteId: string
  ): Promise<boolean> {
    try {
      const count = await this.prisma.article.count({
        where: { siteId, externalId },
      });
      return count > 0;
    } catch (error) {
      this.handleDatabaseError(
        error,
        `Check article existence for external ID ${externalId} for site ${siteId}`
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
   * Check existence by external IDs within a specific site for efficient
   * duplicate detection. Scoped by siteId since externalId is only unique per
   * site, so the returned map keyed by externalId is unambiguous.
   */
  async checkExistenceByExternalIds(
    externalIds: string[],
    siteId: string
  ): Promise<Map<string, boolean>> {
    try {
      const existingArticles = await this.prisma.article.findMany({
        where: {
          siteId,
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

}
