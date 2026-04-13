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
import { calculatePaginationOffset } from '@dealscrapper/shared-repository';

/**
 * API-specific category repository interface extending shared base functionality
 * Focuses on user-facing category operations and API response formatting
 */
export interface ICategoryRepository {
  /**
   * Find inactive categories for administration
   * @returns Array of inactive categories
   */
  findInactiveCategories(): Promise<Category[]>;

  /**
   * Find category with its associated filters for user filtering
   * @param categoryId Category ID to search for
   * @returns Category with filters included, null if not found
   */
  findCategoryWithFilters(categoryId: string): Promise<Category | null>;

  /**
   * Get full category hierarchy with parent-child relationships for UI
   * @returns Array of categories organized by hierarchy
   */
  getCategoryHierarchy(): Promise<Category[]>;

  /**
   * Get comprehensive category statistics for dashboard
   * @returns Statistical overview of categories
   */
  getCategoryStatistics(): Promise<{
    total: number;
    active: number;
    topLevel: number;
    withDeals: number;
  }>;

  /**
   * Update user category preferences for personalization
   * @param userId User ID to update preferences for
   * @param categoryIds Array of category IDs user is interested in
   * @returns Promise that resolves when preferences are updated
   */
  updateUserCategoryPreferences(
    userId: string,
    categoryIds: string[]
  ): Promise<void>;
}

/**
 * API service category repository implementation
 * Extends shared base with API-specific operations for user interface and administration
 *
 * Responsibilities:
 * - User-facing category browsing and filtering
 * - Administrative category management
 * - Category hierarchy for navigation
 * - Statistics for dashboard display
 * - User preference management
 */
// TODO: Clean up backward-compatibility alias methods — services primarily use PrismaService directly
@Injectable()
export class CategoryRepository
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
   * Get default includes for API category queries
   * API service includes filters for user filtering capabilities
   */
  protected getDefaultCategoryIncludes(): Prisma.CategoryInclude {
    return {
      filters: {
        include: {
          filter: true,
        },
      },
    };
  }

  /**
   * Get default ordering for API category queries
   * API service orders by name for user-friendly display
   */
  protected getDefaultCategoryOrderBy(): Prisma.CategoryOrderByWithRelationInput {
    return { name: 'asc' };
  }

  // API-specific method implementations

  /**
   * Find inactive categories for administration interface
   * Used by admin panels to manage disabled categories
   */
  async findInactiveCategories(): Promise<Category[]> {
    return this.executeWithErrorHandling('findInactiveCategories', () =>
      this.prisma.category.findMany({
        where: { isActive: false },
        include: this.getDefaultCategoryIncludes(),
        orderBy: { name: 'asc' },
      })
    );
  }

  /**
   * Find category with its associated filters for user filtering
   * Used by filtering components to show available filter options
   */
  async findCategoryWithFilters(categoryId: string): Promise<Category | null> {
    this.validateRequiredFields({ categoryId }, ['categoryId']);

    return this.executeWithErrorHandling(
      'findCategoryWithFilters',
      () =>
        this.prisma.category.findUnique({
          where: { id: categoryId },
          include: {
            filters: {
              include: {
                filter: true,
              },
              where: {
                filter: {
                  active: true, // Only include active filters
                },
              },
            },
          },
        }),
      { categoryId }
    );
  }

  /**
   * Get full category hierarchy with parent-child relationships for UI navigation
   * Used by navigation components to build category menus
   */
  async getCategoryHierarchy(): Promise<Category[]> {
    return this.executeWithErrorHandling('getCategoryHierarchy', () =>
      this.prisma.category.findMany({
        where: { isActive: true },
        include: this.getDefaultCategoryIncludes(),
        orderBy: [{ level: 'asc' }, { parentId: 'asc' }, { name: 'asc' }],
      })
    );
  }

  /**
   * Get comprehensive category statistics for admin dashboard
   * Provides overview metrics for category management interface
   */
  async getCategoryStatistics(): Promise<{
    total: number;
    active: number;
    topLevel: number;
    withDeals: number;
  }> {
    return this.executeWithErrorHandling('getCategoryStatistics', async () => {
      const [totalCount, activeCount, topLevelCount, withDealsCount] =
        await Promise.all([
          this.count(),
          this.count({ isActive: true }),
          this.count({ level: 1 }),
          this.count({
            dealCount: { gt: 0 },
          }),
        ]);

      return {
        total: totalCount,
        active: activeCount,
        topLevel: topLevelCount,
        withDeals: withDealsCount,
      };
    });
  }

  /**
   * Update user category preferences for personalized content
   * Used by user preference management to track interests
   */
  async updateUserCategoryPreferences(
    userId: string,
    categoryIds: string[]
  ): Promise<void> {
    this.validateRequiredFields({ userId, categoryIds }, [
      'userId',
      'categoryIds',
    ]);

    await this.executeWithErrorHandling(
      'updateUserCategoryPreferences',
      async () => {
        // This would typically involve a UserCategoryPreference junction table
        // For now, we'll update the userCount field on categories
        // In a real implementation, this would be more sophisticated

        // Reset all user counts for this user's previous preferences
        // Then increment counts for new preferences
        // This is a simplified implementation

        await Promise.all(
          categoryIds.map((categoryId) =>
            this.prisma.category.update({
              where: { id: categoryId },
              data: {
                userCount: { increment: 1 },
                updatedAt: new Date(),
              },
            })
          )
        );
      },
      { userId, categoryCount: categoryIds.length }
    );
  }

  // Enhanced shared method implementations with API-specific behavior

  /**
   * Find most popular categories with API-specific ordering
   * Orders by deal count first, then user count for API responses
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
            dealCount: { gt: 0 },
          },
          include: this.getDefaultCategoryIncludes(),
          orderBy: [
            { dealCount: 'desc' },
            { userCount: 'desc' },
            { name: 'asc' },
          ],
          take: limitCount,
        }),
      { limitCount }
    );
  }

  /**
   * Search categories with enhanced API-specific search criteria
   * Searches in name, description, and slug for comprehensive results
   */
  async searchCategoriesByName(
    searchQuery: string,
    paginationOptions?: PaginationOptions
  ): Promise<PaginatedResult<Category>> {
    this.validateRequiredFields({ searchQuery }, ['searchQuery']);
    this.validatePagination(paginationOptions);

    const page = paginationOptions?.page || 1;
    const limit = Math.min(paginationOptions?.limit || 50, 100);
    const skip = paginationOptions?.offset || calculatePaginationOffset(page, limit);

    const searchFilter: Prisma.CategoryWhereInput = {
      isActive: true, // API only shows active categories
      OR: [
        { name: { contains: searchQuery, mode: 'insensitive' } },
        { description: { contains: searchQuery, mode: 'insensitive' } },
        { slug: { contains: searchQuery, mode: 'insensitive' } },
      ],
    };

    const [categoriesData, totalCount] = await Promise.all([
      this.executeWithErrorHandling(
        'searchCategoriesByName',
        () =>
          this.prisma.category.findMany({
            where: searchFilter,
            include: this.getDefaultCategoryIncludes(),
            orderBy: [
              { dealCount: 'desc' }, // Prioritize popular categories in search
              { name: 'asc' },
            ],
            skip,
            take: limit,
          }),
        { searchQuery, paginationOptions }
      ),
      this.count(searchFilter),
    ]);

    return {
      data: categoriesData as Category[],
      pagination: this.calculatePaginationMetadata(
        totalCount,
        paginationOptions
      ),
    };
  }

  // Alias methods for backward compatibility with existing API service code

  /**
   * Alias for findActiveCategories() - maintains API service naming convention
   */
  async findActive(): Promise<Category[]> {
    return this.findActiveCategories();
  }

  /**
   * Alias for findInactiveCategories() - maintains API service naming convention
   */
  async findInactive(): Promise<Category[]> {
    return this.findInactiveCategories();
  }

  /**
   * Alias for findCategoriesByParent() - maintains API service naming convention
   */
  async findByParentId(parentId: string | null): Promise<Category[]> {
    return this.findCategoriesByParent(parentId);
  }

  /**
   * Alias for findTopLevelCategories() - maintains API service naming convention
   */
  async findTopLevel(): Promise<Category[]> {
    return this.findTopLevelCategories();
  }

  /**
   * Alias for findCategoryWithFilters() - maintains API service naming convention
   */
  async findWithFilters(categoryId: string): Promise<Category | null> {
    return this.findCategoryWithFilters(categoryId);
  }

  /**
   * Alias for toggleActiveStatus() - maintains API service naming convention
   */
  async toggleActive(categoryId: string, isActive: boolean): Promise<Category> {
    return this.toggleActiveStatus(categoryId, isActive);
  }

  /**
   * Alias for updateCategoryStatistics() - maintains API service naming convention
   */
  async updateStats(
    categoryId: string,
    statistics: CategoryStatistics
  ): Promise<Category> {
    return this.updateCategoryStatistics(categoryId, statistics);
  }

  /**
   * Alias for searchCategoriesByName() - maintains API service naming convention
   */
  async searchCategories(
    query: string,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<Category>> {
    return this.searchCategoriesByName(query, pagination);
  }

  /**
   * Alias for getCategoryStatistics() - maintains API service naming convention
   */
  async getCategoryStats(): Promise<{
    total: number;
    active: number;
    topLevel: number;
    withDeals: number;
  }> {
    return this.getCategoryStatistics();
  }

  /**
   * Alias for findMostPopularCategories() - maintains API service naming convention
   */
  async findMostPopular(limit?: number): Promise<Category[]> {
    return this.findMostPopularCategories(limit);
  }

  /**
   * Alias for performHealthCheck() - maintains API service naming convention
   */
  async healthCheck(): Promise<boolean> {
    return this.performHealthCheck();
  }

  /**
   * Find category by slug and site (multi-site support)
   * Note: slug is not unique, so this returns first match for site+slug combo
   */
  async findBySlugAndSite(
    slug: string,
    siteId: string
  ): Promise<Category | null> {
    this.validateRequiredFields({ slug, siteId }, ['slug', 'siteId']);

    return this.executeWithErrorHandling(
      'findBySlugAndSite',
      async () => {
        const categories = await this.prisma.category.findMany({
          where: { slug, siteId },
          include: this.getDefaultCategoryIncludes(),
          take: 1,
        });
        return categories.length > 0 ? categories[0] : null;
      },
      { slug, siteId }
    );
  }

  /**
   * Upsert category by site and sourceUrl composite key
   * Used by category sync service to update categories from scraping
   */
  async upsertBySiteAndSourceUrl(data: {
    slug: string;
    name: string;
    siteId: string;
    sourceUrl: string;
    parentId?: string | null;
    level?: number;
    description?: string | null;
  }): Promise<Category> {
    this.validateRequiredFields(
      { slug: data.slug, name: data.name, siteId: data.siteId, sourceUrl: data.sourceUrl },
      ['slug', 'name', 'siteId', 'sourceUrl']
    );

    const level = data.level || (data.parentId ? 2 : 1);

    return this.executeWithErrorHandling(
      'upsertBySiteAndSourceUrl',
      () =>
        this.prisma.category.upsert({
          where: {
            siteId_sourceUrl: { siteId: data.siteId, sourceUrl: data.sourceUrl },
          },
          create: {
            slug: data.slug,
            name: data.name,
            siteId: data.siteId,
            sourceUrl: data.sourceUrl,
            parentId: data.parentId ?? null,
            level,
            description: data.description ?? null,
            isActive: true,
            dealCount: 0,
            avgTemperature: 0,
            popularBrands: [],
            userCount: 0,
          },
          update: {
            name: data.name,
            slug: data.slug,
            parentId: data.parentId ?? null,
            level,
            description: data.description ?? null,
            updatedAt: new Date(),
          },
          include: this.getDefaultCategoryIncludes(),
        }),
      { data }
    );
  }

  /**
   * Find all categories by site
   * Used by frontend to get categories for a specific site
   */
  async findBySite(siteId: string): Promise<Category[]> {
    this.validateRequiredFields({ siteId }, ['siteId']);

    return this.executeWithErrorHandling(
      'findBySite',
      () =>
        this.prisma.category.findMany({
          where: {
            siteId,
            isActive: true,
          },
          include: this.getDefaultCategoryIncludes(),
          orderBy: [{ level: 'asc' }, { name: 'asc' }],
        }),
      { siteId }
    );
  }

  /**
   * Get category tree by site (hierarchical structure)
   * Useful for sites with nested categories (e.g., LeBonCoin)
   */
  async getCategoryTreeBySite(siteId: string): Promise<Category[]> {
    this.validateRequiredFields({ siteId }, ['siteId']);

    return this.executeWithErrorHandling(
      'getCategoryTreeBySite',
      () =>
        this.prisma.category.findMany({
          where: {
            siteId,
            isActive: true,
          },
          include: this.getDefaultCategoryIncludes(),
          orderBy: [{ level: 'asc' }, { parentId: 'asc' }, { name: 'asc' }],
        }),
      { siteId }
    );
  }

  /**
   * Define default includes for category queries (required abstract method)
   */
  protected getDefaultCategoryModelIncludes(): Prisma.CategoryInclude {
    return {
      filters: true,
    };
  }

  /**
   * Define default order by for category queries (required abstract method)
   */
  protected getDefaultCategoryModelOrderBy(): Prisma.CategoryOrderByWithRelationInput {
    return {
      name: 'asc',
    };
  }
}
