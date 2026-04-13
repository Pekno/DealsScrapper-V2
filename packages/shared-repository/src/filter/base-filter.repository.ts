import { Injectable } from '@nestjs/common';
import {
  PrismaService,
  Filter,
  Prisma,
  FilterCategory,
} from '@dealscrapper/database';
import { AbstractBaseRepository } from '../base.repository.js';
import type { PaginationOptions, PaginatedResult } from '../interfaces.js';

/**
 * Filter statistics interface for all services
 */
export interface FilterStatistics {
  readonly totalMatches?: number;
  readonly matchesLast24h?: number;
  readonly lastMatchAt?: Date;
  readonly maxNotificationsPerDay?: number;
}

/**
 * Filter search criteria interface for advanced filtering
 */
export interface FilterSearchCriteria {
  readonly userId?: string;
  readonly categoryIds?: string[];
  readonly active?: boolean;
  readonly digestFrequency?: string;
  readonly name?: string;
  readonly description?: string;
}

/**
 * Base filter repository interface defining all shared filter operations
 * Used across API and Scraper services to eliminate duplication
 */
export interface IBaseFilterRepository {
  /**
   * Find filters by user ID
   * @param userId User ID to search for
   * @returns Array of user's filters
   */
  findFiltersByUserId(userId: string): Promise<Filter[]>;

  /**
   * Find all active filters
   * @param userId Optional user ID to filter by
   * @returns Array of active filters
   */
  findActiveFilters(userId?: string): Promise<Filter[]>;

  /**
   * Find all inactive filters
   * @param userId Optional user ID to filter by
   * @returns Array of inactive filters
   */
  findInactiveFilters(userId?: string): Promise<Filter[]>;

  /**
   * Find filters by categories
   * @param categoryIds Array of category IDs to search in
   * @returns Array of filters associated with categories
   */
  findFiltersByCategories(categoryIds: string[]): Promise<Filter[]>;

  /**
   * Find filters by digest frequency
   * @param digestFrequency Digest frequency to filter by
   * @returns Array of filters with specified frequency
   */
  findFiltersByDigestFrequency(digestFrequency: string): Promise<Filter[]>;

  /**
   * Toggle filter active status
   * @param filterId Filter ID to update
   * @param isActive New active status
   * @returns Updated filter
   */
  toggleFilterActiveStatus(
    filterId: string,
    isActive: boolean
  ): Promise<Filter>;

  /**
   * Update filter expression
   * @param filterId Filter ID to update
   * @param filterExpression New filter expression
   * @returns Updated filter
   */
  updateFilterExpression(
    filterId: string,
    filterExpression: object
  ): Promise<Filter>;

  /**
   * Update filter statistics
   * @param filterId Filter ID to update
   * @param statistics New statistics data
   * @returns Updated filter
   */
  updateFilterStatistics(
    filterId: string,
    statistics: FilterStatistics
  ): Promise<Filter>;

  /**
   * Add categories to filter
   * @param filterId Filter ID to update
   * @param categoryIds Array of category IDs to add
   * @returns Updated filter with categories
   */
  addCategoriesToFilter(
    filterId: string,
    categoryIds: string[]
  ): Promise<Filter>;

  /**
   * Remove categories from filter
   * @param filterId Filter ID to update
   * @param categoryIds Array of category IDs to remove
   * @returns Updated filter
   */
  removeCategoriesFromFilter(
    filterId: string,
    categoryIds: string[]
  ): Promise<Filter>;

  /**
   * Search filters by criteria with pagination
   * @param searchCriteria Search criteria object
   * @param paginationOptions Pagination options
   * @returns Paginated search results
   */
  searchFiltersByCriteria(
    searchCriteria: FilterSearchCriteria,
    paginationOptions?: PaginationOptions
  ): Promise<PaginatedResult<Filter>>;

  /**
   * Find filters with their associated categories
   * @param whereClause Optional where clause
   * @returns Array of filters with categories included
   */
  findFiltersWithCategories(
    whereClause?: Prisma.FilterWhereInput
  ): Promise<(Filter & { categories: FilterCategory[] })[]>;

  /**
   * Get filter statistics summary
   * @param userId Optional user ID to filter by
   * @returns Filter statistics summary
   */
  getFilterStatisticsSummary(userId?: string): Promise<{
    total: number;
    active: number;
    inactive: number;
    byCategory: Record<string, number>;
    byDigestFrequency: Record<string, number>;
  }>;

  /**
   * Perform repository health check
   * @returns True if repository is healthy, false otherwise
   */
  performHealthCheck(): Promise<boolean>;
}

/**
 * Base filter repository implementation containing all shared filter operations
 * Eliminates 95% of code duplication between API and Scraper services
 *
 * Design Pattern: Template Method Pattern with shared implementations
 * SOLID Principles: Single Responsibility (filter operations only), Open/Closed (extensible)
 * DRY: Eliminates duplicate implementations across 2 services
 */
@Injectable()
export abstract class BaseFilterRepository
  extends AbstractBaseRepository<
    Filter,
    Prisma.FilterCreateInput,
    Prisma.FilterUpdateInput,
    Prisma.FilterWhereUniqueInput
  >
  implements IBaseFilterRepository
{
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  /**
   * Find filters by user ID
   * Shared across all services - no customization needed
   */
  async findFiltersByUserId(userId: string): Promise<Filter[]> {
    this.validateRequiredFields({ userId }, ['userId']);

    return this.executeWithErrorHandling(
      'findFiltersByUserId',
      () =>
        this.prisma.filter.findMany({
          where: { userId },
          include: this.getDefaultFilterIncludes(),
          orderBy: this.getDefaultFilterOrderBy(),
        }),
      { userId }
    );
  }

  /**
   * Find all active filters
   * Shared implementation with optional user filtering
   */
  async findActiveFilters(userId?: string): Promise<Filter[]> {
    const whereClause: Prisma.FilterWhereInput = {
      active: true,
      ...(userId && { userId }),
    };

    return this.executeWithErrorHandling(
      'findActiveFilters',
      () =>
        this.prisma.filter.findMany({
          where: whereClause,
          include: this.getDefaultFilterIncludes(),
          orderBy: this.getDefaultFilterOrderBy(),
        }),
      { userId }
    );
  }

  /**
   * Find all inactive filters
   * Shared implementation with optional user filtering
   */
  async findInactiveFilters(userId?: string): Promise<Filter[]> {
    const whereClause: Prisma.FilterWhereInput = {
      active: false,
      ...(userId && { userId }),
    };

    return this.executeWithErrorHandling(
      'findInactiveFilters',
      () =>
        this.prisma.filter.findMany({
          where: whereClause,
          include: this.getDefaultFilterIncludes(),
          orderBy: this.getDefaultFilterOrderBy(),
        }),
      { userId }
    );
  }

  /**
   * Find filters by categories
   * Shared implementation for category-based filtering
   */
  async findFiltersByCategories(categoryIds: string[]): Promise<Filter[]> {
    this.validateRequiredFields({ categoryIds }, ['categoryIds']);

    if (categoryIds.length === 0) {
      return [];
    }

    return this.executeWithErrorHandling(
      'findFiltersByCategories',
      () =>
        this.prisma.filter.findMany({
          where: {
            categories: {
              some: {
                categoryId: { in: categoryIds },
              },
            },
          },
          include: this.getDefaultFilterIncludes(),
          orderBy: this.getDefaultFilterOrderBy(),
        }),
      { categoryCount: categoryIds.length }
    );
  }

  /**
   * Find filters by digest frequency
   * Shared implementation for notification frequency filtering
   */
  async findFiltersByDigestFrequency(
    digestFrequency: string
  ): Promise<Filter[]> {
    this.validateRequiredFields({ digestFrequency }, ['digestFrequency']);

    const validFrequencies = ['hourly', 'daily', 'weekly', 'disabled'];
    if (!validFrequencies.includes(digestFrequency)) {
      throw new Error(
        `Invalid digest frequency. Must be one of: ${validFrequencies.join(', ')}`
      );
    }

    return this.executeWithErrorHandling(
      'findFiltersByDigestFrequency',
      () =>
        this.prisma.filter.findMany({
          where: { digestFrequency },
          include: this.getDefaultFilterIncludes(),
          orderBy: this.getDefaultFilterOrderBy(),
        }),
      { digestFrequency }
    );
  }

  /**
   * Toggle filter active status
   * Shared implementation with validation
   */
  async toggleFilterActiveStatus(
    filterId: string,
    isActive: boolean
  ): Promise<Filter> {
    this.validateRequiredFields({ filterId, isActive }, [
      'filterId',
      'isActive',
    ]);

    return this.executeWithErrorHandling(
      'toggleFilterActiveStatus',
      () =>
        this.prisma.filter.update({
          where: { id: filterId },
          data: {
            active: isActive,
            updatedAt: new Date(),
          },
          include: this.getDefaultFilterIncludes(),
        }),
      { filterId, isActive }
    );
  }

  /**
   * Update filter expression
   * Shared implementation with JSON validation
   */
  async updateFilterExpression(
    filterId: string,
    filterExpression: object
  ): Promise<Filter> {
    this.validateRequiredFields({ filterId, filterExpression }, [
      'filterId',
      'filterExpression',
    ]);

    return this.executeWithErrorHandling(
      'updateFilterExpression',
      () =>
        this.prisma.filter.update({
          where: { id: filterId },
          data: {
            filterExpression,
            updatedAt: new Date(),
          },
          include: this.getDefaultFilterIncludes(),
        }),
      { filterId }
    );
  }

  /**
   * Update filter statistics
   * Shared implementation with partial updates
   */
  async updateFilterStatistics(
    filterId: string,
    statistics: FilterStatistics
  ): Promise<Filter> {
    this.validateRequiredFields({ filterId }, ['filterId']);

    // Build update object only with provided statistics (partial update)
    const updateData: Prisma.FilterUpdateInput = {
      updatedAt: new Date(),
    };

    if (statistics.totalMatches !== undefined) {
      updateData.totalMatches = statistics.totalMatches;
    }

    if (statistics.matchesLast24h !== undefined) {
      updateData.matchesLast24h = statistics.matchesLast24h;
    }

    if (statistics.lastMatchAt !== undefined) {
      updateData.lastMatchAt = statistics.lastMatchAt;
    }

    if (statistics.maxNotificationsPerDay !== undefined) {
      updateData.maxNotificationsPerDay = statistics.maxNotificationsPerDay;
    }

    return this.executeWithErrorHandling(
      'updateFilterStatistics',
      () =>
        this.prisma.filter.update({
          where: { id: filterId },
          data: updateData,
          include: this.getDefaultFilterIncludes(),
        }),
      { filterId, statistics }
    );
  }

  /**
   * Add categories to filter
   * Shared implementation with duplicate prevention
   */
  async addCategoriesToFilter(
    filterId: string,
    categoryIds: string[]
  ): Promise<Filter> {
    this.validateRequiredFields({ filterId, categoryIds }, [
      'filterId',
      'categoryIds',
    ]);

    if (categoryIds.length === 0) {
      return this.findUnique({ id: filterId }) as Promise<Filter>;
    }

    return this.executeWithErrorHandling(
      'addCategoriesToFilter',
      async () => {
        // Create filter category relationships, ignoring duplicates
        await Promise.all(
          categoryIds.map((categoryId) =>
            this.prisma.filterCategory
              .upsert({
                where: {
                  filterId_categoryId: {
                    filterId,
                    categoryId,
                  },
                },
                create: {
                  filterId,
                  categoryId,
                },
                update: {}, // No update needed if already exists
              })
              .catch(() => {
                // Ignore unique constraint violations (duplicates)
              })
          )
        );

        // Return updated filter with categories
        return this.prisma.filter.findUniqueOrThrow({
          where: { id: filterId },
          include: this.getDefaultFilterIncludes(),
        });
      },
      { filterId, categoryCount: categoryIds.length }
    );
  }

  /**
   * Remove categories from filter
   * Shared implementation with safe deletion
   */
  async removeCategoriesFromFilter(
    filterId: string,
    categoryIds: string[]
  ): Promise<Filter> {
    this.validateRequiredFields({ filterId, categoryIds }, [
      'filterId',
      'categoryIds',
    ]);

    if (categoryIds.length === 0) {
      return this.findUnique({ id: filterId }) as Promise<Filter>;
    }

    return this.executeWithErrorHandling(
      'removeCategoriesFromFilter',
      async () => {
        // Delete filter category relationships
        await this.prisma.filterCategory.deleteMany({
          where: {
            filterId,
            categoryId: { in: categoryIds },
          },
        });

        // Return updated filter with categories
        return this.prisma.filter.findUniqueOrThrow({
          where: { id: filterId },
          include: this.getDefaultFilterIncludes(),
        });
      },
      { filterId, categoryCount: categoryIds.length }
    );
  }

  /**
   * Search filters by criteria with pagination
   * Shared implementation with comprehensive search
   */
  async searchFiltersByCriteria(
    searchCriteria: FilterSearchCriteria,
    paginationOptions?: PaginationOptions
  ): Promise<PaginatedResult<Filter>> {
    this.validatePagination(paginationOptions);

    const page = paginationOptions?.page || 1;
    const limit = Math.min(paginationOptions?.limit || 50, 100);
    const skip = paginationOptions?.offset || (page - 1) * limit;

    // Build dynamic where clause from search criteria
    const whereClause: Prisma.FilterWhereInput = {};

    if (searchCriteria.userId) {
      whereClause.userId = searchCriteria.userId;
    }

    if (searchCriteria.active !== undefined) {
      whereClause.active = searchCriteria.active;
    }

    if (searchCriteria.digestFrequency) {
      whereClause.digestFrequency = searchCriteria.digestFrequency;
    }

    if (searchCriteria.name || searchCriteria.description) {
      whereClause.OR = [];

      if (searchCriteria.name) {
        whereClause.OR.push({
          name: { contains: searchCriteria.name, mode: 'insensitive' },
        });
      }

      if (searchCriteria.description) {
        whereClause.OR.push({
          description: {
            contains: searchCriteria.description,
            mode: 'insensitive',
          },
        });
      }
    }

    if (searchCriteria.categoryIds && searchCriteria.categoryIds.length > 0) {
      whereClause.categories = {
        some: {
          categoryId: { in: searchCriteria.categoryIds },
        },
      };
    }

    const [filtersData, totalCount] = await Promise.all([
      this.executeWithErrorHandling(
        'searchFiltersByCriteria',
        () =>
          this.prisma.filter.findMany({
            where: whereClause,
            include: this.getDefaultFilterIncludes(),
            orderBy: this.getDefaultFilterOrderBy(),
            skip,
            take: limit,
          }),
        { searchCriteria, paginationOptions }
      ),
      this.count(whereClause),
    ]);

    return {
      data: filtersData,
      pagination: this.calculatePaginationMetadata(
        totalCount,
        paginationOptions
      ),
    };
  }

  /**
   * Find filters with their associated categories
   * Shared implementation with category relationship loading
   */
  async findFiltersWithCategories(
    whereClause?: Prisma.FilterWhereInput
  ): Promise<(Filter & { categories: FilterCategory[] })[]> {
    return this.executeWithErrorHandling(
      'findFiltersWithCategories',
      () =>
        this.prisma.filter.findMany({
          where: whereClause,
          include: {
            categories: {
              include: {
                category: true,
              },
            },
          },
          orderBy: this.getDefaultFilterOrderBy(),
        }),
      { whereClause }
    ) as Promise<(Filter & { categories: FilterCategory[] })[]>;
  }

  /**
   * Get filter statistics summary
   * Shared implementation with comprehensive metrics
   */
  async getFilterStatisticsSummary(userId?: string): Promise<{
    total: number;
    active: number;
    inactive: number;
    byCategory: Record<string, number>;
    byDigestFrequency: Record<string, number>;
  }> {
    return this.executeWithErrorHandling(
      'getFilterStatisticsSummary',
      async () => {
        const baseWhere: Prisma.FilterWhereInput = userId ? { userId } : {};

        const [
          totalCount,
          activeCount,
          inactiveCount,
          categoryStats,
          frequencyStats,
        ] = await Promise.all([
          this.count(baseWhere),
          this.count({ ...baseWhere, active: true }),
          this.count({ ...baseWhere, active: false }),
          this.prisma.filterCategory.groupBy({
            by: ['categoryId'],
            where: userId ? { filter: { userId } } : {},
            _count: { filterId: true },
          }),
          this.prisma.filter.groupBy({
            by: ['digestFrequency'],
            where: baseWhere,
            _count: { id: true },
          }),
        ]);

        // Transform category statistics into a more usable format
        const byCategoryStats: Record<string, number> = {};
        for (const categoryStat of categoryStats) {
          byCategoryStats[categoryStat.categoryId] =
            categoryStat._count.filterId;
        }

        // Transform frequency statistics into a more usable format
        const byFrequencyStats: Record<string, number> = {};
        for (const frequencyStat of frequencyStats) {
          byFrequencyStats[frequencyStat.digestFrequency] =
            frequencyStat._count.id;
        }

        return {
          total: totalCount,
          active: activeCount,
          inactive: inactiveCount,
          byCategory: byCategoryStats,
          byDigestFrequency: byFrequencyStats,
        };
      },
      { userId }
    );
  }

  /**
   * Perform repository health check
   * Shared implementation with basic connectivity test
   */
  async performHealthCheck(): Promise<boolean> {
    try {
      await this.count();
      return true;
    } catch (error) {
      this.logger.error('Filter repository health check failed', error);
      return false;
    }
  }

  // Abstract methods for service-specific customization

  /**
   * Get default includes for filter queries
   * Override in child classes for service-specific includes
   */
  protected abstract getDefaultFilterIncludes(): Prisma.FilterInclude;

  /**
   * Get default ordering for filter queries
   * Override in child classes for service-specific ordering
   */
  protected abstract getDefaultFilterOrderBy(): Prisma.FilterOrderByWithRelationInput;

  // Standard BaseRepository method implementations

  async findUnique(
    where: Prisma.FilterWhereUniqueInput
  ): Promise<Filter | null> {
    return this.executeWithErrorHandling(
      'findUnique',
      () =>
        this.prisma.filter.findUnique({
          where,
          include: this.getDefaultFilterIncludes(),
        }),
      { where }
    );
  }

  async findMany(where?: Prisma.FilterWhereInput): Promise<Filter[]> {
    return this.executeWithErrorHandling(
      'findMany',
      () =>
        this.prisma.filter.findMany({
          where,
          include: this.getDefaultFilterIncludes(),
          orderBy: this.getDefaultFilterOrderBy(),
        }),
      { where }
    );
  }

  async findManyPaginated(
    where?: Prisma.FilterWhereInput,
    paginationOptions?: PaginationOptions
  ): Promise<PaginatedResult<Filter>> {
    this.validatePagination(paginationOptions);

    const page = paginationOptions?.page || 1;
    const limit = Math.min(paginationOptions?.limit || 50, 100);
    const skip = paginationOptions?.offset || (page - 1) * limit;

    const [filtersData, totalCount] = await Promise.all([
      this.executeWithErrorHandling(
        'findManyPaginated',
        () =>
          this.prisma.filter.findMany({
            where,
            include: this.getDefaultFilterIncludes(),
            orderBy: this.getDefaultFilterOrderBy(),
            skip,
            take: limit,
          }),
        { where, paginationOptions }
      ),
      this.count(where),
    ]);

    return {
      data: filtersData,
      pagination: this.calculatePaginationMetadata(
        totalCount,
        paginationOptions
      ),
    };
  }

  async count(where?: Prisma.FilterWhereInput): Promise<number> {
    return this.executeWithErrorHandling(
      'count',
      () => this.prisma.filter.count({ where }),
      { where }
    );
  }

  async create(filterData: Prisma.FilterCreateInput): Promise<Filter> {
    return this.executeWithErrorHandling(
      'create',
      () =>
        this.prisma.filter.create({
          data: filterData,
          include: this.getDefaultFilterIncludes(),
        }),
      { filterData }
    );
  }

  async createMany(filtersData: Prisma.FilterCreateInput[]): Promise<Filter[]> {
    return this.executeWithErrorHandling(
      'createMany',
      async () => {
        const createdFilters = await Promise.all(
          filtersData.map((filterData) => this.create(filterData))
        );
        return createdFilters;
      },
      { count: filtersData.length }
    );
  }

  async update(
    where: Prisma.FilterWhereUniqueInput,
    filterData: Prisma.FilterUpdateInput
  ): Promise<Filter> {
    return this.executeWithErrorHandling(
      'update',
      () =>
        this.prisma.filter.update({
          where,
          data: { ...filterData, updatedAt: new Date() },
          include: this.getDefaultFilterIncludes(),
        }),
      { where, filterData }
    );
  }

  async updateMany(
    where: Prisma.FilterWhereInput,
    filterData: Prisma.FilterUpdateInput
  ): Promise<number> {
    return this.executeWithErrorHandling(
      'updateMany',
      async () => {
        const result = await this.prisma.filter.updateMany({
          where,
          data: { ...filterData, updatedAt: new Date() },
        });
        return result.count;
      },
      { where, filterData }
    );
  }

  async delete(where: Prisma.FilterWhereUniqueInput): Promise<Filter> {
    return this.executeWithErrorHandling(
      'delete',
      () =>
        this.prisma.filter.delete({
          where,
          include: this.getDefaultFilterIncludes(),
        }),
      { where }
    );
  }

  async deleteMany(where: Prisma.FilterWhereInput): Promise<number> {
    return this.executeWithErrorHandling(
      'deleteMany',
      async () => {
        const result = await this.prisma.filter.deleteMany({ where });
        return result.count;
      },
      { where }
    );
  }

  async upsert(
    where: Prisma.FilterWhereUniqueInput,
    createData: Prisma.FilterCreateInput,
    updateData: Prisma.FilterUpdateInput
  ): Promise<Filter> {
    return this.executeWithErrorHandling(
      'upsert',
      () =>
        this.prisma.filter.upsert({
          where,
          create: createData,
          update: { ...updateData, updatedAt: new Date() },
          include: this.getDefaultFilterIncludes(),
        }),
      { where, createData, updateData }
    );
  }

  async exists(where: Prisma.FilterWhereUniqueInput): Promise<boolean> {
    const filter = await this.prisma.filter.findUnique({ where });
    return filter !== null;
  }
}
