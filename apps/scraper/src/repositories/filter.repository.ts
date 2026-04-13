import { Injectable } from '@nestjs/common';
import { PrismaService, Prisma } from '@dealscrapper/database';
import type { Filter } from '@dealscrapper/database';
import {
  BaseFilterRepository,
  FilterStatistics,
} from '@dealscrapper/shared-repository';
import type {
  PaginationOptions,
  PaginatedResult,
} from '@dealscrapper/shared-repository';

/**
 * Scraper-specific filter repository interface extending shared base functionality
 * Focuses on scraping-related filter operations and matching
 */
export interface IFilterRepository {
  /**
   * Find active filters for category-based scraping
   * @param categorySlug Category identifier to filter by
   * @returns Array of filters active for the category
   */
  findActiveByCategorySlug(categorySlug: string): Promise<Filter[]>;

  /**
   * Find active filters by category ID (more efficient than slug lookup)
   * @param categoryId Category database ID to filter by
   * @returns Array of filters active for the category
   */
  findActiveByCategoryId(categoryId: string): Promise<Filter[]>;

  /**
   * Update filter statistics from scraping results
   * @param filterId Filter ID to update
   * @param scrapingStats Statistics from scraping process
   * @returns Updated filter
   */
  updateScrapingStatistics(
    filterId: string,
    scrapingStats: {
      readonly totalMatches?: number;
      readonly matchesLast24h?: number;
      readonly lastMatchAt?: Date;
    }
  ): Promise<Filter>;

  /**
   * Find filters that need performance monitoring
   * @returns Array of filters to monitor
   */
  findFiltersForMonitoring(): Promise<Filter[]>;

  /**
   * Get scraping performance metrics
   * @returns Performance statistics for dashboard
   */
  getScrapingMetrics(): Promise<{
    totalActiveFilters: number;
    averageMatches: number;
    filtersWithRecentMatches: number;
    topPerformingFilters: Filter[];
  }>;
}

/**
 * Scraper service filter repository implementation
 * Extends shared base with scraper-specific operations for deal matching and performance tracking
 *
 * Responsibilities:
 * - Filter matching during scraping processes
 * - Scraping performance metrics and monitoring
 * - Category-based filter optimization
 * - Match statistics tracking
 */
@Injectable()
export class FilterRepository
  extends BaseFilterRepository
  implements IFilterRepository
{
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  /**
   * Implementation of abstract method - returns the Prisma model delegate
   */
  protected getModel() {
    return this.prisma.filter;
  }

  // Service-specific abstract method implementations

  /**
   * Get default includes for scraper filter queries
   * Scraper service needs minimal includes for performance during scraping
   */
  protected getDefaultFilterIncludes(): Prisma.FilterInclude {
    return {}; // Minimal includes for scraper performance
  }

  /**
   * Get default ordering for scraper filter queries
   * Scraper service orders by total matches for performance optimization
   */
  protected getDefaultFilterOrderBy(): Prisma.FilterOrderByWithRelationInput {
    return { totalMatches: 'desc' };
  }

  /**
   * Get default includes for scraper filter queries
   * @returns Default filter includes for scraper service
   */
  private getDefaultFilterIncludesWithRelations(): Prisma.FilterInclude {
    return {
      categories: {
        include: {
          category: true,
        },
      },
      user: true,
    };
  }

  // Scraper-specific method implementations

  /**
   * Find active filters for category-based scraping
   * Enhanced with scraper-specific performance optimizations
   */
  async findActiveByCategorySlug(categorySlug: string): Promise<Filter[]> {
    this.validateRequiredFields({ categorySlug }, ['categorySlug']);

    return this.executeWithErrorHandling(
      'findActiveByCategorySlug',
      () =>
        this.prisma.filter.findMany({
          where: {
            active: true,
            categories: {
              some: {
                category: {
                  slug: categorySlug,
                },
              },
            },
          },
          include: this.getDefaultFilterIncludesWithRelations(),
          orderBy: [
            { totalMatches: 'desc' }, // Most successful filters first
            { lastMatchAt: 'desc' }, // Recently active filters
          ],
        }),
      { categorySlug }
    );
  }

  /**
   * Find active filters by category ID (more efficient than slug lookup)
   * Uses proper foreign key relationship through filter_categories junction table
   */
  async findActiveByCategoryId(categoryId: string): Promise<Filter[]> {
    this.validateRequiredFields({ categoryId }, ['categoryId']);

    return this.executeWithErrorHandling(
      'findActiveByCategoryId',
      () =>
        this.prisma.filter.findMany({
          where: {
            active: true,
            categories: {
              some: {
                categoryId: categoryId,
              },
            },
          },
          include: this.getDefaultFilterIncludesWithRelations(),
          orderBy: [
            { totalMatches: 'desc' }, // Most successful filters first
            { lastMatchAt: 'desc' }, // Recently active filters
          ],
        }),
      { categoryId }
    );
  }

  /**
   * Update filter statistics from scraping results
   * Updates performance metrics based on scraping outcomes
   */
  async updateScrapingStatistics(
    filterId: string,
    scrapingStats: {
      readonly totalMatches?: number;
      readonly matchesLast24h?: number;
      readonly lastMatchAt?: Date;
    }
  ): Promise<Filter> {
    this.validateRequiredFields({ filterId }, ['filterId']);

    const statistics: FilterStatistics = {
      totalMatches: scrapingStats.totalMatches,
      matchesLast24h: scrapingStats.matchesLast24h,
      lastMatchAt: scrapingStats.lastMatchAt,
    };

    return this.updateFilterStatistics(filterId, statistics);
  }

  /**
   * Find filters that need performance monitoring
   * Identifies filters that should be tracked for scraping efficiency
   */
  async findFiltersForMonitoring(): Promise<Filter[]> {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    return this.executeWithErrorHandling('findFiltersForMonitoring', () =>
      this.prisma.filter.findMany({
        where: {
          active: true,
          OR: [
            { totalMatches: { gte: 100 } }, // High-volume filters
            { lastMatchAt: { gte: oneDayAgo } }, // Recently active
            { matchesLast24h: { gte: 10 } }, // High recent activity
          ],
        },
        include: this.getDefaultFilterIncludesWithRelations(),
        orderBy: [{ totalMatches: 'desc' }, { matchesLast24h: 'desc' }],
        take: 50, // Limit for performance
      })
    );
  }

  /**
   * Get scraping performance metrics
   * Provides comprehensive metrics for scraping dashboard
   */
  async getScrapingMetrics(): Promise<{
    totalActiveFilters: number;
    averageMatches: number;
    filtersWithRecentMatches: number;
    topPerformingFilters: Filter[];
  }> {
    return this.executeWithErrorHandling('getScrapingMetrics', async () => {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const [
        totalActiveFilters,
        averageMatchesResult,
        filtersWithRecentMatches,
        topPerformingFilters,
      ] = await Promise.all([
        this.count({ active: true }),
        this.prisma.filter.aggregate({
          where: { active: true },
          _avg: { totalMatches: true },
        }),
        this.count({
          active: true,
          lastMatchAt: { gte: oneDayAgo },
        }),
        this.prisma.filter.findMany({
          where: {
            active: true,
            totalMatches: { gt: 0 },
          },
          include: this.getDefaultFilterIncludesWithRelations(),
          orderBy: [{ totalMatches: 'desc' }, { matchesLast24h: 'desc' }],
          take: 10,
        }),
      ]);

      return {
        totalActiveFilters,
        averageMatches: averageMatchesResult._avg.totalMatches || 0,
        filtersWithRecentMatches,
        topPerformingFilters,
      };
    });
  }

  // Alias methods for backward compatibility with existing scraper service code

  /**
   * Alias for findActiveFilters() - maintains scraper service naming convention
   */
  async findAllActive(): Promise<Filter[]> {
    return this.findActiveFilters();
  }

  /**
   * Alias for findUnique() - maintains scraper service naming convention
   */
  async findById(id: string): Promise<Filter | null> {
    return this.findUnique({ id });
  }

  /**
   * Alias for create() - maintains scraper service naming convention
   */
  async createFilter(data: Prisma.FilterCreateInput): Promise<Filter> {
    return this.create(data);
  }

  /**
   * Alias for update() - maintains scraper service naming convention
   */
  async updateFilter(
    id: string,
    data: Prisma.FilterUpdateInput
  ): Promise<Filter> {
    return this.update({ id }, data);
  }

  /**
   * Alias for delete() - maintains scraper service naming convention
   */
  async deleteFilter(id: string): Promise<Filter> {
    return this.delete({ id });
  }

  /**
   * Alias for exists() - maintains scraper service naming convention
   */
  async existsById(id: string): Promise<boolean> {
    return this.exists({ id });
  }

  /**
   * Alias for count() with active filter - maintains scraper service naming convention
   */
  async countActive(): Promise<number> {
    return this.count({ active: true });
  }

  /**
   * Alias for updateScrapingStatistics() - maintains scraper service naming convention
   */
  async updateFilterStats(
    filterId: string,
    stats: {
      readonly totalMatches?: number;
      readonly matchesLast24h?: number;
      readonly lastMatchAt?: Date;
    }
  ): Promise<Filter> {
    return this.updateScrapingStatistics(filterId, stats);
  }

  /**
   * Alias for performHealthCheck() - maintains scraper service naming convention
   */
  async healthCheck(): Promise<boolean> {
    return this.performHealthCheck();
  }
}
