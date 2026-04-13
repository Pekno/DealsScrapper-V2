import { Injectable } from '@nestjs/common';
import { PrismaService, Category, Prisma } from '@dealscrapper/database';
import {
  BaseCategoryRepository,
  CategoryStatistics,
} from '@dealscrapper/shared-repository';
import type {
  PaginationOptions,
  PaginatedResult,
} from '@dealscrapper/shared-repository';

/**
 * Scheduler metrics interface for monitoring job performance
 */
export interface SchedulingMetrics {
  readonly totalCategories: number;
  readonly activeCategories: number;
  readonly categoriesWithFilters: number;
  readonly categoriesWithJobs: number;
  readonly averageUserCount: number;
  readonly averageDealCount: number;
  readonly topCategoriesByUsers: Category[];
}

/**
 * Scheduler-specific category repository interface extending shared base functionality
 * Focuses on scheduling-related category operations and job management
 */
export interface ICategoryRepository {
  /**
   * Find categories with associated filters for scheduling
   * @returns Array of categories that have active filters
   */
  findCategoriesWithFilters(): Promise<Category[]>;

  /**
   * Find categories without scheduled jobs for gap analysis
   * @returns Array of categories missing scheduled jobs
   */
  findCategoriesWithoutScheduledJobs(): Promise<Category[]>;

  /**
   * Find categories by minimum user count for prioritization
   * @param minUsers Minimum number of users required
   * @returns Array of categories with sufficient user interest
   */
  findCategoriesByUserCount(minUsers?: number): Promise<Category[]>;

  /**
   * Find popular categories for priority scheduling
   * @param limit Maximum number of categories to return
   * @returns Array of popular categories ordered by metrics
   */
  findPopularCategories(limit?: number): Promise<Category[]>;

  /**
   * Update category metrics from scheduling results
   * @param categoryId Category ID to update
   * @param schedulingMetrics Metrics from scheduling process
   * @returns Updated category
   */
  updateSchedulingMetrics(
    categoryId: string,
    schedulingMetrics: CategoryStatistics
  ): Promise<Category>;

  /**
   * Get comprehensive metrics for scheduling dashboard
   * @returns Detailed scheduling metrics and statistics
   */
  getCategoryMetrics(): Promise<SchedulingMetrics>;

  /**
   * Find categories ready for scheduling optimization
   * @returns Array of categories suitable for scheduling
   */
  findCategoriesForScheduling(): Promise<Category[]>;
}

/**
 * Scheduler service category repository implementation
 * Extends shared base with scheduler-specific operations for job management and prioritization
 *
 * Responsibilities:
 * - Category prioritization for job scheduling
 * - Job gap analysis and optimization
 * - Scheduling metrics and performance tracking
 * - User interest-based category filtering
 */
@Injectable()
export class CategoryModelRepository
  extends BaseCategoryRepository
  implements ICategoryRepository
{
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  protected getModel() {
    return this.prisma.category;
  }

  // Service-specific abstract method implementations

  /**
   * Get default includes for scheduler category queries
   * Scheduler service includes scheduled jobs and filters for job management
   * NOTE: Uses `include` instead of `select` per project guidelines (CLAUDE.md)
   */
  protected getDefaultCategoryIncludes(): Prisma.CategoryInclude {
    return {
      scheduledJob: true,
      filters: {
        include: {
          filter: true,
        },
        where: {
          filter: {
            active: true,
          },
        },
      },
    };
  }

  /**
   * Get default ordering for scheduler category queries
   * Scheduler service orders by user count for priority-based processing
   */
  protected getDefaultCategoryOrderBy(): Prisma.CategoryOrderByWithRelationInput {
    return { userCount: 'desc' };
  }

  // Scheduler-specific method implementations

  /**
   * Find categories with associated filters for scheduling
   * Identifies categories that have active filters and need job scheduling
   */
  async findCategoriesWithFilters(): Promise<Category[]> {
    return this.executeWithErrorHandling('findCategoriesWithFilters', () =>
      this.prisma.category.findMany({
        where: {
          isActive: true,
          filters: {
            some: {
              filter: {
                active: true,
              },
            },
          },
        },
        include: this.getDefaultCategoryIncludes(),
        orderBy: [{ userCount: 'desc' }, { dealCount: 'desc' }],
      })
    );
  }

  /**
   * Find categories without scheduled jobs for gap analysis
   * Identifies categories that need job creation for complete coverage
   */
  async findCategoriesWithoutScheduledJobs(): Promise<Category[]> {
    return this.executeWithErrorHandling(
      'findCategoriesWithoutScheduledJobs',
      () =>
        this.prisma.category.findMany({
          where: {
            isActive: true,
            scheduledJob: null, // No associated scheduled job
          },
          include: this.getDefaultCategoryIncludes(),
          orderBy: [{ userCount: 'desc' }, { level: 'asc' }],
        })
    );
  }

  /**
   * Find categories by minimum user count for prioritization
   * Focuses scheduling resources on categories with sufficient user interest
   */
  async findCategoriesByUserCount(minUsers: number = 1): Promise<Category[]> {
    if (minUsers < 0) {
      throw new Error('Minimum user count cannot be negative');
    }

    return this.executeWithErrorHandling(
      'findCategoriesByUserCount',
      () =>
        this.prisma.category.findMany({
          where: {
            isActive: true,
            userCount: { gte: minUsers },
          },
          include: this.getDefaultCategoryIncludes(),
          orderBy: [{ userCount: 'desc' }, { dealCount: 'desc' }],
        }),
      { minUsers }
    );
  }

  /**
   * Find popular categories for priority scheduling
   * Identifies high-value categories that should be scheduled frequently
   */
  async findPopularCategories(limit: number = 20): Promise<Category[]> {
    if (limit < 1 || limit > 100) {
      throw new Error('Limit must be between 1 and 100');
    }

    return this.executeWithErrorHandling(
      'findPopularCategories',
      () =>
        this.prisma.category.findMany({
          where: {
            isActive: true,
            OR: [{ userCount: { gt: 0 } }, { dealCount: { gt: 0 } }],
          },
          include: this.getDefaultCategoryIncludes(),
          orderBy: [
            { userCount: 'desc' },
            { dealCount: 'desc' },
            { avgTemperature: 'desc' },
          ],
          take: limit,
        }),
      { limit }
    );
  }

  /**
   * Update category metrics from scheduling results
   * Updates statistics based on scheduling performance and user engagement
   */
  async updateSchedulingMetrics(
    categoryId: string,
    schedulingMetrics: CategoryStatistics
  ): Promise<Category> {
    this.validateRequiredFields({ categoryId }, ['categoryId']);

    return this.updateCategoryStatistics(categoryId, schedulingMetrics);
  }

  /**
   * Get comprehensive metrics for scheduling dashboard
   * Provides detailed overview of scheduling performance and opportunities
   */
  async getCategoryMetrics(): Promise<SchedulingMetrics> {
    return this.executeWithErrorHandling('getCategoryMetrics', async () => {
      const [
        totalCategories,
        activeCategories,
        categoriesWithFilters,
        categoriesWithJobs,
        averageStats,
        topCategories,
      ] = await Promise.all([
        this.count(),
        this.count({ isActive: true }),
        this.count({
          isActive: true,
          filters: {
            some: {
              filter: { active: true },
            },
          },
        }),
        this.count({
          isActive: true,
          scheduledJob: {
            isNot: null,
          },
        }),
        this.prisma.category.aggregate({
          where: { isActive: true },
          _avg: {
            userCount: true,
            dealCount: true,
          },
        }),
        this.findPopularCategories(10),
      ]);

      return {
        totalCategories,
        activeCategories,
        categoriesWithFilters,
        categoriesWithJobs,
        averageUserCount: averageStats._avg.userCount || 0,
        averageDealCount: averageStats._avg.dealCount || 0,
        topCategoriesByUsers: topCategories,
      };
    });
  }

  /**
   * Find categories ready for scheduling optimization
   * Identifies categories that would benefit from adjusted scheduling frequency
   */
  async findCategoriesForScheduling(): Promise<Category[]> {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    return this.executeWithErrorHandling('findCategoriesForScheduling', () =>
      this.prisma.category.findMany({
        where: {
          isActive: true,
          OR: [
            {
              // High-value categories that need frequent scheduling
              userCount: { gte: 5 },
              dealCount: { gte: 10 },
            },
            {
              // Categories with recent user activity
              updatedAt: { gte: oneDayAgo },
              userCount: { gt: 0 },
            },
            {
              // Categories without jobs that need initial scheduling
              scheduledJob: null,
              userCount: { gt: 0 },
            },
          ],
        },
        include: this.getDefaultCategoryIncludes(),
        orderBy: [
          { userCount: 'desc' },
          { dealCount: 'desc' },
          { level: 'asc' },
        ],
        take: 100, // Limit for performance
      })
    );
  }

  // Enhanced shared method implementations with scheduler-specific behavior

  /**
   * Find most popular categories with scheduler-specific prioritization
   * Considers both user count and deal activity for scheduling priority
   */
  async findMostPopularCategories(
    limitCount: number = 10
  ): Promise<Category[]> {
    if (limitCount < 1 || limitCount > 100) {
      throw new Error('Limit must be between 1 and 100');
    }

    return this.executeWithErrorHandling(
      'findMostPopularCategories',
      () =>
        this.prisma.category.findMany({
          where: {
            isActive: true,
            userCount: { gt: 0 },
          },
          include: this.getDefaultCategoryIncludes(),
          orderBy: [
            { userCount: 'desc' },
            { dealCount: 'desc' },
            { avgTemperature: 'desc' },
          ],
          take: limitCount,
        }),
      { limitCount }
    );
  }

  // Alias methods for backward compatibility with existing scheduler service code

  /**
   * Alias for findActiveCategories() - maintains scheduler service naming convention
   */
  async findActiveCategories(): Promise<Category[]> {
    return super.findActiveCategories();
  }

  /**
   * Alias for updateSchedulingMetrics() - maintains scheduler service naming convention
   */
  async updateCategoryStats(
    categoryId: string,
    statistics: CategoryStatistics
  ): Promise<Category> {
    return this.updateSchedulingMetrics(categoryId, statistics);
  }

  /**
   * Alias for performHealthCheck() - maintains scheduler service naming convention
   */
  async healthCheck(): Promise<boolean> {
    return this.performHealthCheck();
  }

  /**
   * Define default includes for category queries (required abstract method)
   */
  protected getDefaultCategoryModelIncludes(): Prisma.CategoryInclude {
    return {
      filters: true,
      scheduledJob: true,
    };
  }

  /**
   * Define default order by for category queries (required abstract method)
   */
  protected getDefaultCategoryModelOrderBy(): Prisma.CategoryOrderByWithRelationInput {
    return {
      dealCount: 'desc',
    };
  }
}
