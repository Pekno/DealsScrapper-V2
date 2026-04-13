import { Injectable } from '@nestjs/common';
import {
  PrismaService,
  Filter,
  FilterCategory,
  Prisma,
} from '@dealscrapper/database';
import {
  BaseFilterRepository,
  FilterStatistics,
  FilterSearchCriteria,
} from '@dealscrapper/shared-repository';
import type {
  PaginationOptions,
  PaginatedResult,
} from '@dealscrapper/shared-repository';

/**
 * API-specific filter repository interface extending shared base functionality
 * Focuses on user-facing filter operations and API response formatting
 */
export interface IFilterRepository {
  /**
   * Find user's personal filter library for management interface
   * @param userId User ID to find filters for
   * @returns Array of user's filters with full details
   */
  findUserFilterLibrary(userId: string): Promise<Filter[]>;

  /**
   * Update user filter preferences for notification settings
   * @param filterId Filter ID to update
   * @param preferences User preference settings
   * @returns Updated filter
   */
  updateUserFilterPreferences(
    filterId: string,
    preferences: {
      readonly immediateNotifications?: boolean;
      readonly digestFrequency?: string;
      readonly maxNotificationsPerDay?: number;
    }
  ): Promise<Filter>;

  /**
   * Get detailed filter analytics for user dashboard
   * @param userId User ID to get analytics for
   * @returns Comprehensive filter analytics
   */
  getUserFilterAnalytics(userId: string): Promise<{
    totalFilters: number;
    activeFilters: number;
    totalMatches: number;
    matchesThisWeek: number;
    topCategories: Array<{ categoryId: string; filterCount: number }>;
    recentMatches: number;
  }>;

  /**
   * Duplicate filter for user convenience
   * @param filterId Original filter ID to duplicate
   * @param userId User ID for the new filter
   * @param newName Optional new name for duplicated filter
   * @returns Newly created duplicate filter
   */
  duplicateFilterForUser(
    filterId: string,
    userId: string,
    newName?: string
  ): Promise<Filter>;
}

/**
 * API service filter repository implementation
 * Extends shared base with API-specific operations for user interface and management
 *
 * Responsibilities:
 * - User filter management and personalization
 * - Filter analytics and dashboard data
 * - User preference management
 * - Filter duplication and sharing
 */
// TODO: Clean up backward-compatibility alias methods — services primarily use PrismaService directly
@Injectable()
export class FilterRepository
  extends BaseFilterRepository
  implements IFilterRepository
{
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  protected getModel() {
    return this.prisma.filter;
  }

  // Service-specific abstract method implementations

  /**
   * Get default includes for API filter queries
   * API service includes categories and detailed relationships for user interface
   */
  protected getDefaultFilterIncludes(): Prisma.FilterInclude {
    return {
      categories: {
        include: {
          category: true, // Use full entity type for better type safety
        },
      },
    };
  }

  // API-specific method implementations

  /**
   * Find user's personal filter library for management interface
   * Enhanced with full relationship data for rich UI experience
   */
  async findUserFilterLibrary(userId: string): Promise<Filter[]> {
    this.validateRequiredFields({ userId }, ['userId']);

    return this.executeWithErrorHandling(
      'findUserFilterLibrary',
      () =>
        this.prisma.filter.findMany({
          where: { userId },
          include: {
            categories: {
              include: {
                category: true, // Use full entity type for better type safety
              },
            },
            _count: {
              select: {
                categories: true,
              },
            },
          },
          orderBy: [
            { active: 'desc' }, // Active filters first
            { totalMatches: 'desc' }, // Then by popularity
            { createdAt: 'desc' }, // Then by recency
          ],
        }),
      { userId }
    );
  }

  /**
   * Update user filter preferences for notification settings
   * Manages user's notification preferences with validation
   */
  async updateUserFilterPreferences(
    filterId: string,
    preferences: {
      readonly immediateNotifications?: boolean;
      readonly digestFrequency?: string;
      readonly maxNotificationsPerDay?: number;
    }
  ): Promise<Filter> {
    this.validateRequiredFields({ filterId }, ['filterId']);

    // Validate digest frequency if provided
    if (preferences.digestFrequency) {
      const validFrequencies = ['hourly', 'daily', 'weekly', 'disabled'];
      if (!validFrequencies.includes(preferences.digestFrequency)) {
        throw new Error(
          `Invalid digest frequency. Must be one of: ${validFrequencies.join(', ')}`
        );
      }
    }

    // Validate max notifications per day
    if (preferences.maxNotificationsPerDay !== undefined) {
      if (
        preferences.maxNotificationsPerDay < 0 ||
        preferences.maxNotificationsPerDay > 1000
      ) {
        throw new Error('Max notifications per day must be between 0 and 1000');
      }
    }

    const updateData: Prisma.FilterUpdateInput = {
      updatedAt: new Date(),
    };

    if (preferences.immediateNotifications !== undefined) {
      updateData.immediateNotifications = preferences.immediateNotifications;
    }

    if (preferences.digestFrequency !== undefined) {
      updateData.digestFrequency = preferences.digestFrequency;
    }

    if (preferences.maxNotificationsPerDay !== undefined) {
      updateData.maxNotificationsPerDay = preferences.maxNotificationsPerDay;
    }

    return this.executeWithErrorHandling(
      'updateUserFilterPreferences',
      () =>
        this.prisma.filter.update({
          where: { id: filterId },
          data: updateData,
          include: this.getDefaultFilterIncludes(),
        }),
      { filterId, preferences }
    );
  }

  /**
   * Get detailed filter analytics for user dashboard
   * Provides comprehensive metrics for user's filter performance
   */
  async getUserFilterAnalytics(userId: string): Promise<{
    totalFilters: number;
    activeFilters: number;
    totalMatches: number;
    matchesThisWeek: number;
    topCategories: Array<{ categoryId: string; filterCount: number }>;
    recentMatches: number;
  }> {
    this.validateRequiredFields({ userId }, ['userId']);

    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    return this.executeWithErrorHandling(
      'getUserFilterAnalytics',
      async () => {
        const [
          totalFilters,
          activeFilters,
          totalMatchesResult,
          matchesThisWeekResult,
          categoryStats,
          recentMatchesResult,
        ] = await Promise.all([
          this.count({ userId }),
          this.count({ userId, active: true }),
          this.prisma.filter.aggregate({
            where: { userId },
            _sum: { totalMatches: true },
          }),
          this.prisma.filter.aggregate({
            where: { userId },
            _sum: { matchesLast24h: true },
          }),
          this.prisma.filterCategory.groupBy({
            by: ['categoryId'],
            where: { filter: { userId } },
            _count: { filterId: true },
            orderBy: { _count: { filterId: 'desc' } },
            take: 5,
          }),
          this.count({
            userId,
            lastMatchAt: { gte: oneWeekAgo },
          }),
        ]);

        const topCategories = categoryStats.map((stat) => ({
          categoryId: stat.categoryId,
          filterCount: stat._count.filterId,
        }));

        return {
          totalFilters,
          activeFilters,
          totalMatches: totalMatchesResult._sum.totalMatches || 0,
          matchesThisWeek: matchesThisWeekResult._sum.matchesLast24h || 0,
          topCategories,
          recentMatches: recentMatchesResult,
        };
      },
      { userId }
    );
  }

  /**
   * Duplicate filter for user convenience
   * Creates a copy of an existing filter with user customization options
   */
  async duplicateFilterForUser(
    filterId: string,
    userId: string,
    newName?: string
  ): Promise<Filter> {
    this.validateRequiredFields({ filterId, userId }, ['filterId', 'userId']);

    return this.executeWithErrorHandling(
      'duplicateFilterForUser',
      async () => {
        // Get original filter with all relationships
        const originalFilter = await this.prisma.filter.findUniqueOrThrow({
          where: { id: filterId },
          include: {
            categories: true,
          },
        });

        // Create new filter data
        const duplicatedFilterData: Prisma.FilterCreateInput = {
          user: { connect: { id: userId } },
          name: newName || `${originalFilter.name} (Copy)`,
          description: originalFilter.description,
          active: false, // Start inactive for user to review
          filterExpression:
            originalFilter.filterExpression as Prisma.InputJsonValue,
          immediateNotifications: originalFilter.immediateNotifications,
          digestFrequency: originalFilter.digestFrequency,
          maxNotificationsPerDay: originalFilter.maxNotificationsPerDay,
        };

        // Create the duplicated filter
        const newFilter = await this.create(duplicatedFilterData);

        // Copy category relationships if they exist
        if (originalFilter.categories.length > 0) {
          const categoryIds = originalFilter.categories.map(
            (fc: { categoryId: string }) => fc.categoryId
          );
          await this.addCategoriesToFilter(newFilter.id, categoryIds);
        }

        // Return the complete filter with relationships
        return this.prisma.filter.findUniqueOrThrow({
          where: { id: newFilter.id },
          include: this.getDefaultFilterIncludes(),
        });
      },
      { filterId, userId, newName }
    );
  }

  // Enhanced shared method implementations with API-specific behavior

  /**
   * Search filters with API-specific enhancements
   * Includes relevance scoring and user-friendly ordering
   */
  async searchFiltersByCriteria(
    searchCriteria: FilterSearchCriteria,
    paginationOptions?: PaginationOptions
  ): Promise<PaginatedResult<Filter>> {
    // Enhance search criteria for API-specific behavior
    const enhancedCriteria: FilterSearchCriteria = {
      ...searchCriteria,
      // API typically shows only active filters in search results
      active: searchCriteria.active ?? true,
    };

    const result = await super.searchFiltersByCriteria(
      enhancedCriteria,
      paginationOptions
    );

    // Sort results by relevance for API responses
    if (searchCriteria.name || searchCriteria.description) {
      result.data.sort((a: Filter, b: Filter) => {
        // Prioritize by total matches (popular filters first)
        const scoreA = (a.totalMatches || 0) + (a.active ? 100 : 0);
        const scoreB = (b.totalMatches || 0) + (b.active ? 100 : 0);
        return scoreB - scoreA;
      });
    }

    return result;
  }

  // Alias methods for backward compatibility with existing API service code

  /**
   * Alias for findFiltersByUserId() - maintains API service naming convention
   */
  async findByUserId(userId: string): Promise<Filter[]> {
    return this.findFiltersByUserId(userId);
  }

  /**
   * Alias for findActiveFilters() - maintains API service naming convention
   */
  async findActiveFilters(userId?: string): Promise<Filter[]> {
    return super.findActiveFilters(userId);
  }

  /**
   * Alias for findInactiveFilters() - maintains API service naming convention
   */
  async findInactiveFilters(userId?: string): Promise<Filter[]> {
    return super.findInactiveFilters(userId);
  }

  /**
   * Alias for findFiltersByCategories() - maintains API service naming convention
   */
  async findByCategories(categoryIds: string[]): Promise<Filter[]> {
    return this.findFiltersByCategories(categoryIds);
  }

  /**
   * Alias for findFiltersByDigestFrequency() - maintains API service naming convention
   */
  async findByDigestFrequency(frequency: string): Promise<Filter[]> {
    return this.findFiltersByDigestFrequency(frequency);
  }

  /**
   * Alias for toggleFilterActiveStatus() - maintains API service naming convention
   */
  async toggleActive(filterId: string, isActive: boolean): Promise<Filter> {
    return this.toggleFilterActiveStatus(filterId, isActive);
  }

  /**
   * Alias for updateFilterExpression() - maintains API service naming convention
   */
  async updateExpression(
    filterId: string,
    expression: string
  ): Promise<Filter> {
    // Convert string to object for the base method
    let filterExpression: object;
    try {
      filterExpression =
        typeof expression === 'string' ? JSON.parse(expression) : expression;
    } catch (error) {
      throw new Error('Invalid filter expression: must be valid JSON');
    }

    return this.updateFilterExpression(filterId, filterExpression);
  }

  /**
   * Alias for addCategoriesToFilter() - maintains API service naming convention
   */
  async addCategories(
    filterId: string,
    categoryIds: string[]
  ): Promise<Filter> {
    return this.addCategoriesToFilter(filterId, categoryIds);
  }

  /**
   * Alias for removeCategoriesFromFilter() - maintains API service naming convention
   */
  async removeCategories(
    filterId: string,
    categoryIds: string[]
  ): Promise<Filter> {
    return this.removeCategoriesFromFilter(filterId, categoryIds);
  }

  /**
   * Alias for getFilterStatisticsSummary() - maintains API service naming convention
   */
  async getFilterStats(userId?: string): Promise<{
    total: number;
    active: number;
    inactive: number;
    byCategory: Record<string, number>;
  }> {
    const stats = await this.getFilterStatisticsSummary(userId);
    return {
      total: stats.total,
      active: stats.active,
      inactive: stats.inactive,
      byCategory: stats.byCategory,
    };
  }

  /**
   * Alias for searchFiltersByCriteria() - maintains API service naming convention
   */
  async searchFilters(
    query: string,
    userId?: string,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<Filter>> {
    const searchCriteria: FilterSearchCriteria = {
      userId,
      name: query,
      description: query, // Search in both name and description
    };

    return this.searchFiltersByCriteria(searchCriteria, pagination);
  }

  /**
   * Alias for findFiltersWithCategories() - maintains API service naming convention
   */
  async findWithCategories(
    where?: Prisma.FilterWhereInput
  ): Promise<(Filter & { categories: FilterCategory[] })[]> {
    return this.findFiltersWithCategories(where);
  }

  /**
   * Alias for performHealthCheck() - maintains API service naming convention
   */
  async healthCheck(): Promise<boolean> {
    return this.performHealthCheck();
  }

  // Abstract method implementations from BaseFilterRepository

  /**
   * Get default ordering for filter queries in API service
   */
  protected getDefaultFilterOrderBy(): Prisma.FilterOrderByWithRelationInput {
    return {
      active: 'desc', // Active filters first
      totalMatches: 'desc', // Most popular filters next
      updatedAt: 'desc', // Recently updated filters last
    };
  }
}
