import { Injectable } from '@nestjs/common';
import { PrismaService, Category, Prisma } from '@dealscrapper/database';
import { AbstractBaseRepository } from '../base.repository.js';
import type { PaginationOptions, PaginatedResult } from '../interfaces.js';

/**
 * Shared category statistics interface for all services
 */
export interface CategoryStatistics {
  readonly dealCount?: number;
  readonly avgTemperature?: number;
  readonly popularBrands?: string[];
  readonly userCount?: number;
}

/**
 * Base category repository interface defining all shared category operations
 * Used across API, Scraper, and Scheduler services to eliminate duplication
 */
export interface IBaseCategoryRepository {
  /**
   * Find category by slug identifier
   * Note: slug is not unique, returns first match
   * @param slug Category slug to search for
   * @returns Category if found, null otherwise
   */
  findBySlug(slug: string): Promise<Category | null>;

  /**
   * Find category by source URL
   * @param sourceUrl Source URL to search for
   * @returns Category if found, null otherwise
   */
  findBySourceUrl(sourceUrl: string): Promise<Category | null>;

  /**
   * Find all active categories
   * @returns Array of active categories
   */
  findActiveCategories(): Promise<Category[]>;

  /**
   * Find categories by parent ID
   * @param parentId Parent category ID, null for top-level categories
   * @returns Array of child categories
   */
  findCategoriesByParent(parentId: string | null): Promise<Category[]>;

  /**
   * Find top-level categories (level 1)
   * @returns Array of top-level categories
   */
  findTopLevelCategories(): Promise<Category[]>;

  /**
   * Find categories by hierarchy level
   * @param level Category level (1=main, 2=sub, 3=specific)
   * @returns Array of categories at specified level
   */
  findCategoriesByLevel(level: number): Promise<Category[]>;

  /**
   * Toggle category active status
   * @param categoryId Category ID to update
   * @param isActive New active status
   * @returns Updated category
   */
  toggleActiveStatus(categoryId: string, isActive: boolean): Promise<Category>;

  /**
   * Update category statistics
   * @param categoryId Category ID to update
   * @param statistics New statistics data
   * @returns Updated category
   */
  updateCategoryStatistics(
    categoryId: string,
    statistics: CategoryStatistics
  ): Promise<Category>;

  /**
   * Search categories by name with pagination
   * @param searchQuery Query string to search in category names
   * @param paginationOptions Pagination options
   * @returns Paginated search results
   */
  searchCategoriesByName(
    searchQuery: string,
    paginationOptions?: PaginationOptions
  ): Promise<PaginatedResult<Category>>;

  /**
   * Find most popular categories based on user count
   * @param limitCount Maximum number of categories to return
   * @returns Array of popular categories ordered by user count
   */
  findMostPopularCategories(limitCount?: number): Promise<Category[]>;

  /**
   * Perform repository health check
   * @returns True if repository is healthy, false otherwise
   */
  performHealthCheck(): Promise<boolean>;
}

/**
 * Base category repository implementation containing all shared category operations
 * Eliminates 80% of code duplication across API, Scraper, and Scheduler services
 *
 * Design Pattern: Template Method Pattern with shared implementations
 * SOLID Principles: Single Responsibility (category operations only), Open/Closed (extensible)
 * DRY: Eliminates duplicate implementations across 3 services
 */
@Injectable()
export abstract class BaseCategoryRepository
  extends AbstractBaseRepository<
    Category,
    Prisma.CategoryCreateInput,
    Prisma.CategoryUpdateInput,
    Prisma.CategoryWhereUniqueInput
  >
  implements IBaseCategoryRepository
{
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  /**
   * Find category by slug identifier
   * Note: slug is not unique in the schema, so this returns the first match
   */
  async findBySlug(slug: string): Promise<Category | null> {
    this.validateRequiredFields({ slug }, ['slug']);

    return this.executeWithErrorHandling(
      'findBySlug',
      async () => {
        const categories = await this.prisma.category.findMany({
          where: { slug },
          include: this.getDefaultCategoryIncludes(),
          take: 1,
        });
        return categories.length > 0 ? categories[0] : null;
      },
      { slug }
    );
  }

  /**
   * Find category by source URL
   * Shared implementation - finds first matching category
   */
  async findBySourceUrl(sourceUrl: string): Promise<Category | null> {
    this.validateRequiredFields({ sourceUrl }, ['sourceUrl']);

    return this.executeWithErrorHandling(
      'findBySourceUrl',
      async () => {
        const categories = await this.prisma.category.findMany({
          where: { sourceUrl },
          include: this.getDefaultCategoryIncludes(),
          take: 1,
        });
        return categories.length > 0 ? categories[0] : null;
      },
      { sourceUrl }
    );
  }

  /**
   * Find all active categories
   * Shared implementation with default ordering
   */
  async findActiveCategories(): Promise<Category[]> {
    return this.executeWithErrorHandling('findActiveCategories', () =>
      this.prisma.category.findMany({
        where: { isActive: true },
        include: this.getDefaultCategoryIncludes(),
        orderBy: this.getDefaultCategoryOrderBy(),
      })
    );
  }

  /**
   * Find categories by parent ID
   * Shared implementation for hierarchy navigation
   */
  async findCategoriesByParent(parentId: string | null): Promise<Category[]> {
    return this.executeWithErrorHandling(
      'findCategoriesByParent',
      () =>
        this.prisma.category.findMany({
          where: { parentId },
          include: this.getDefaultCategoryIncludes(),
          orderBy: { name: 'asc' },
        }),
      { parentId }
    );
  }

  /**
   * Find top-level categories (level 1)
   * Shared implementation for root categories
   */
  async findTopLevelCategories(): Promise<Category[]> {
    return this.findCategoriesByLevel(1);
  }

  /**
   * Find categories by hierarchy level
   * Shared implementation with level-based filtering
   */
  async findCategoriesByLevel(level: number): Promise<Category[]> {
    this.validateRequiredFields({ level }, ['level']);

    if (level < 1 || level > 3) {
      throw new Error('Category level must be between 1 and 3');
    }

    return this.executeWithErrorHandling(
      'findCategoriesByLevel',
      () =>
        this.prisma.category.findMany({
          where: { level },
          include: this.getDefaultCategoryIncludes(),
          orderBy: { name: 'asc' },
        }),
      { level }
    );
  }

  /**
   * Toggle category active status
   * Shared implementation with validation
   */
  async toggleActiveStatus(
    categoryId: string,
    isActive: boolean
  ): Promise<Category> {
    this.validateRequiredFields({ categoryId, isActive }, [
      'categoryId',
      'isActive',
    ]);

    return this.executeWithErrorHandling(
      'toggleActiveStatus',
      () =>
        this.prisma.category.update({
          where: { id: categoryId },
          data: {
            isActive,
            updatedAt: new Date(),
          },
          include: this.getDefaultCategoryIncludes(),
        }),
      { categoryId, isActive }
    );
  }

  /**
   * Update category statistics
   * Shared implementation with partial updates
   */
  async updateCategoryStatistics(
    categoryId: string,
    statistics: CategoryStatistics
  ): Promise<Category> {
    this.validateRequiredFields({ categoryId }, ['categoryId']);

    // Build update object only with provided statistics (partial update)
    const updateData: Prisma.CategoryUpdateInput = {
      updatedAt: new Date(),
    };

    if (statistics.dealCount !== undefined) {
      updateData.dealCount = statistics.dealCount;
    }

    if (statistics.avgTemperature !== undefined) {
      updateData.avgTemperature = statistics.avgTemperature;
    }

    if (statistics.popularBrands !== undefined) {
      updateData.popularBrands = statistics.popularBrands;
    }

    if (statistics.userCount !== undefined) {
      updateData.userCount = statistics.userCount;
    }

    return this.executeWithErrorHandling(
      'updateCategoryStatistics',
      () =>
        this.prisma.category.update({
          where: { id: categoryId },
          data: updateData,
          include: this.getDefaultCategoryIncludes(),
        }),
      { categoryId, statistics }
    );
  }

  /**
   * Search categories by name with pagination
   * Shared implementation with case-insensitive search
   */
  async searchCategoriesByName(
    searchQuery: string,
    paginationOptions?: PaginationOptions
  ): Promise<PaginatedResult<Category>> {
    this.validateRequiredFields({ searchQuery }, ['searchQuery']);
    this.validatePagination(paginationOptions);

    const page = paginationOptions?.page || 1;
    const limit = Math.min(paginationOptions?.limit || 50, 100);
    const skip = paginationOptions?.offset || (page - 1) * limit;

    const searchFilter: Prisma.CategoryWhereInput = {
      name: {
        contains: searchQuery,
        mode: 'insensitive',
      },
    };

    const [categoriesData, totalCount] = await Promise.all([
      this.executeWithErrorHandling(
        'searchCategoriesByName',
        () =>
          this.prisma.category.findMany({
            where: searchFilter,
            include: this.getDefaultCategoryIncludes(),
            orderBy: { name: 'asc' },
            skip,
            take: limit,
          }),
        { searchQuery, paginationOptions }
      ),
      this.count(searchFilter),
    ]);

    return {
      data: categoriesData,
      pagination: this.calculatePaginationMetadata(
        totalCount,
        paginationOptions
      ),
    };
  }

  /**
   * Find most popular categories based on user count
   * Shared implementation with configurable limit
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
          orderBy: { userCount: 'desc' },
          take: limitCount,
        }),
      { limitCount }
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
      this.logger.error('Category repository health check failed', error);
      return false;
    }
  }

  // Abstract methods for service-specific customization

  /**
   * Get default includes for category queries
   * Override in child classes for service-specific includes
   */
  protected abstract getDefaultCategoryIncludes(): Prisma.CategoryInclude;

  /**
   * Get default ordering for category queries
   * Override in child classes for service-specific ordering
   */
  protected abstract getDefaultCategoryOrderBy(): Prisma.CategoryOrderByWithRelationInput;

  // Standard BaseRepository method implementations

  async findUnique(
    where: Prisma.CategoryWhereUniqueInput
  ): Promise<Category | null> {
    return this.executeWithErrorHandling(
      'findUnique',
      () =>
        this.prisma.category.findUnique({
          where,
          include: this.getDefaultCategoryIncludes(),
        }),
      { where }
    );
  }

  async findMany(where?: Prisma.CategoryWhereInput): Promise<Category[]> {
    return this.executeWithErrorHandling(
      'findMany',
      () =>
        this.prisma.category.findMany({
          where,
          include: this.getDefaultCategoryIncludes(),
          orderBy: this.getDefaultCategoryOrderBy(),
        }),
      { where }
    );
  }

  async findManyPaginated(
    where?: Prisma.CategoryWhereInput,
    paginationOptions?: PaginationOptions
  ): Promise<PaginatedResult<Category>> {
    this.validatePagination(paginationOptions);

    const page = paginationOptions?.page || 1;
    const limit = Math.min(paginationOptions?.limit || 50, 100);
    const skip = paginationOptions?.offset || (page - 1) * limit;

    const [categoriesData, totalCount] = await Promise.all([
      this.executeWithErrorHandling(
        'findManyPaginated',
        () =>
          this.prisma.category.findMany({
            where,
            include: this.getDefaultCategoryIncludes(),
            orderBy: this.getDefaultCategoryOrderBy(),
            skip,
            take: limit,
          }),
        { where, paginationOptions }
      ),
      this.count(where),
    ]);

    return {
      data: categoriesData,
      pagination: this.calculatePaginationMetadata(
        totalCount,
        paginationOptions
      ),
    };
  }

  async count(where?: Prisma.CategoryWhereInput): Promise<number> {
    return this.executeWithErrorHandling(
      'count',
      () => this.prisma.category.count({ where }),
      { where }
    );
  }

  async create(categoryData: Prisma.CategoryCreateInput): Promise<Category> {
    return this.executeWithErrorHandling(
      'create',
      () =>
        this.prisma.category.create({
          data: categoryData,
          include: this.getDefaultCategoryIncludes(),
        }),
      { categoryData }
    );
  }

  async createMany(
    categoriesData: Prisma.CategoryCreateInput[]
  ): Promise<Category[]> {
    return this.executeWithErrorHandling(
      'createMany',
      async () => {
        const createdCategories = await Promise.all(
          categoriesData.map((categoryData) => this.create(categoryData))
        );
        return createdCategories;
      },
      { count: categoriesData.length }
    );
  }

  async update(
    where: Prisma.CategoryWhereUniqueInput,
    categoryData: Prisma.CategoryUpdateInput
  ): Promise<Category> {
    return this.executeWithErrorHandling(
      'update',
      () =>
        this.prisma.category.update({
          where,
          data: { ...categoryData, updatedAt: new Date() },
          include: this.getDefaultCategoryIncludes(),
        }),
      { where, categoryData }
    );
  }

  async updateMany(
    where: Prisma.CategoryWhereInput,
    categoryData: Prisma.CategoryUpdateInput
  ): Promise<number> {
    return this.executeWithErrorHandling(
      'updateMany',
      async () => {
        const result = await this.prisma.category.updateMany({
          where,
          data: { ...categoryData, updatedAt: new Date() },
        });
        return result.count;
      },
      { where, categoryData }
    );
  }

  async delete(where: Prisma.CategoryWhereUniqueInput): Promise<Category> {
    return this.executeWithErrorHandling(
      'delete',
      () =>
        this.prisma.category.delete({
          where,
          include: this.getDefaultCategoryIncludes(),
        }),
      { where }
    );
  }

  async deleteMany(where: Prisma.CategoryWhereInput): Promise<number> {
    return this.executeWithErrorHandling(
      'deleteMany',
      async () => {
        const result = await this.prisma.category.deleteMany({ where });
        return result.count;
      },
      { where }
    );
  }

  async upsert(
    where: Prisma.CategoryWhereUniqueInput,
    createData: Prisma.CategoryCreateInput,
    updateData: Prisma.CategoryUpdateInput
  ): Promise<Category> {
    return this.executeWithErrorHandling(
      'upsert',
      () =>
        this.prisma.category.upsert({
          where,
          create: createData,
          update: { ...updateData, updatedAt: new Date() },
          include: this.getDefaultCategoryIncludes(),
        }),
      { where, createData, updateData }
    );
  }

  async exists(where: Prisma.CategoryWhereUniqueInput): Promise<boolean> {
    const category = await this.prisma.category.findUnique({ where });
    return category !== null;
  }
}
