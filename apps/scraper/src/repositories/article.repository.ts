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
   * Find articles by category ID
   * @param categoryId - Category ID to filter by
   * @returns Array of articles in the category
   */
  findByCategoryId(categoryId: string): Promise<Article[]>;

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
