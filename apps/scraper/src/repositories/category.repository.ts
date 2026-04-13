import { Injectable } from '@nestjs/common';
import { PrismaService, Prisma } from '@dealscrapper/database';
import type { Category } from '@dealscrapper/database';
import {
  BaseCategoryRepository,
  CategoryStatistics,
} from '@dealscrapper/shared-repository';
import type {
  PaginationOptions,
  PaginatedResult,
} from '@dealscrapper/shared-repository';

/**
 * Discovery data interface for creating categories from scraping process
 */
export interface CategoryDiscoveryData {
  readonly name: string;
  readonly slug: string;
  readonly siteId: string; // 'dealabs' | 'vinted' | 'leboncoin'
  readonly sourceUrl: string;
  readonly parentId?: string | null; // Parent category ID (FK)
  readonly level?: number;
  readonly description?: string;
}

/**
 * Discovery statistics interface for monitoring scraping progress
 */
export interface DiscoveryStatistics {
  readonly totalCategories: number;
  readonly activeCategories: number;
  readonly byLevel: Record<number, number>;
  readonly recentlyDiscovered: Category[];
}

/**
 * Scraper-specific category repository interface extending shared base functionality
 * Focuses on category discovery and scraping operations
 */
export interface ICategoryRepository {
  /**
   * Find categories suitable for discovery process
   * @returns Array of categories that need discovery
   */
  findCategoriesForDiscovery(): Promise<Category[]>;

  /**
   * Create category from discovery process
   * @param categoryData Discovery data for new category
   * @returns Created category
   */
  createFromDiscovery(categoryData: CategoryDiscoveryData): Promise<Category>;

  /**
   * Update category metrics from scraping results
   * @param categoryId Category ID to update
   * @param scrapingMetrics Metrics from scraping process
   * @returns Updated category
   */
  updateScrapingMetrics(
    categoryId: string,
    scrapingMetrics: {
      readonly dealCount?: number;
      readonly avgTemperature?: number;
      readonly popularBrands?: string[];
    }
  ): Promise<Category>;

  /**
   * Find categories that need fresh scraping
   * @returns Array of categories ready for scraping
   */
  findCategoriesNeedingDiscovery(): Promise<Category[]>;

  /**
   * Get discovery statistics for monitoring
   * @returns Discovery progress statistics
   */
  getDiscoveryStatistics(): Promise<DiscoveryStatistics>;
}

/**
 * Scraper service category repository implementation
 * Extends shared base with scraper-specific operations for category discovery and management
 *
 * Responsibilities:
 * - Category discovery from scraping processes
 * - Scraping metrics tracking and updates
 * - Discovery progress monitoring
 * - Category hierarchy management for scraping
 */
@Injectable()
export class CategoryRepository
  extends BaseCategoryRepository
  implements ICategoryRepository
{
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  /**
   * Implementation of abstract method - returns the Prisma model delegate
   */
  protected getModel() {
    return this.prisma.category;
  }

  // Service-specific abstract method implementations

  /**
   * Get default includes for scraper category queries
   * @returns Default category includes for scraper service
   */
  private getDefaultCategoryIncludesWithRelations(): Prisma.CategoryInclude {
    return {
      parent: true,
      children: true,
    };
  }

  /**
   * Get default includes for scraper category queries
   * Scraper service doesn't need filter includes, focuses on hierarchy
   */
  protected getDefaultCategoryIncludes(): Prisma.CategoryInclude {
    return {}; // Minimal includes for scraper performance
  }

  /**
   * Get default ordering for scraper category queries
   * Scraper service orders by level first for hierarchy processing
   */
  protected getDefaultCategoryOrderBy(): Prisma.CategoryOrderByWithRelationInput {
    return { level: 'asc' };
  }

  // Required abstract method implementations from BaseCategoryRepository
  protected getDefaultCategoryModelIncludes(): Prisma.CategoryInclude {
    return this.getDefaultCategoryIncludes();
  }

  protected getDefaultCategoryModelOrderBy(): Prisma.CategoryOrderByWithRelationInput {
    return this.getDefaultCategoryOrderBy();
  }

  // Scraper-specific method implementations

  /**
   * Find categories suitable for discovery process
   * Focuses on top-level and sub-level categories for efficient discovery
   */
  async findCategoriesForDiscovery(): Promise<Category[]> {
    return this.executeWithErrorHandling('findCategoriesForDiscovery', () =>
      this.prisma.category.findMany({
        where: {
          isActive: true,
          level: { lte: 2 }, // Only top and sub-level categories
        },
        include: this.getDefaultCategoryIncludesWithRelations(),
        orderBy: [{ level: 'asc' }, { parentId: 'asc' }, { name: 'asc' }],
      })
    );
  }

  /**
   * Create category from discovery process
   * Creates new categories found during the scraping discovery phase
   */
  async createFromDiscovery(
    categoryData: CategoryDiscoveryData
  ): Promise<Category> {
    this.validateRequiredFields(
      categoryData as unknown as Record<string, unknown>,
      ['name', 'slug', 'siteId', 'sourceUrl']
    );

    const createData: Prisma.CategoryCreateInput = {
      name: categoryData.name,
      slug: categoryData.slug,
      site: {
        connect: { id: categoryData.siteId },
      },
      sourceUrl: categoryData.sourceUrl,
      parent: categoryData.parentId ? { connect: { id: categoryData.parentId } } : undefined,
      level: categoryData.level || 1,
      description: categoryData.description || null,
      isActive: true,
      dealCount: 0,
      avgTemperature: 0,
      popularBrands: [],
      userCount: 0,
    };

    return this.executeWithErrorHandling(
      'createFromDiscovery',
      () => this.create(createData),
      { categoryData }
    );
  }


  /**
   * Upsert categories from discovery adapters
   * Creates new categories or updates existing ones based on slug and siteId
   * Handles parent resolution by slug
   * @param siteId Site identifier
   * @param categories Array of category metadata from adapter
   * @returns Number of categories upserted
   */
  async upsertCategories(
    siteId: string,
    categories: Array<{
      slug: string;
      name: string;
      url: string;
      parentId: string | null; // This is the parent's SLUG during discovery
      isSelectable?: boolean; // Whether users can select this category (defaults to true)
    }>
  ): Promise<number> {
    this.validateRequiredFields({ siteId }, ['siteId']);

    if (categories.length === 0) {
      return 0;
    }

    // First pass: Create a map of slug -> category for parent resolution
    const slugToCategory = new Map<string, (typeof categories)[0]>();
    for (const cat of categories) {
      slugToCategory.set(cat.slug, cat);
    }

    // Calculate levels based on parent hierarchy
    // Level 0 = root categories (no parent), Level 1 = children of root, Level 2 = grandchildren
    const calculateLevel = (cat: (typeof categories)[0]): number => {
      if (!cat.parentId) return 0; // Root categories are level 0
      const parent = slugToCategory.get(cat.parentId);
      if (!parent) return 1; // Parent not in this batch, assume level 1
      return calculateLevel(parent) + 1;
    };

    // Sort categories by level (parents first) to ensure parent IDs exist
    const sortedCategories = [...categories].sort((a, b) => {
      return calculateLevel(a) - calculateLevel(b);
    });

    let upsertedCount = 0;

    // Process categories in order (parents first)
    for (const cat of sortedCategories) {
      try {
        // Resolve parent slug to parent ID if provided
        let parentDbId: string | undefined;
        if (cat.parentId) {
          const parentCategory = await this.prisma.category.findFirst({
            where: {
              slug: cat.parentId,
              siteId: siteId,
            },
            select: { id: true },
          });
          parentDbId = parentCategory?.id;
        }

        const level = calculateLevel(cat);

        // Upsert the category using the composite unique key [siteId, sourceUrl]
        await this.prisma.category.upsert({
          where: {
            siteId_sourceUrl: {
              siteId: siteId,
              sourceUrl: cat.url,
            },
          },
          create: {
            name: cat.name,
            slug: cat.slug,
            site: { connect: { id: siteId } },
            sourceUrl: cat.url,
            parent: parentDbId ? { connect: { id: parentDbId } } : undefined,
            level: level,
            isActive: true,
            isSelectable: cat.isSelectable ?? true, // Default to true if not specified
            dealCount: 0,
            avgTemperature: 0,
            popularBrands: [],
            userCount: 0,
          },
          update: {
            name: cat.name,
            sourceUrl: cat.url,
            parent: parentDbId ? { connect: { id: parentDbId } } : { disconnect: true },
            level: level,
            isActive: true,
            isSelectable: cat.isSelectable ?? true, // Default to true if not specified
            updatedAt: new Date(),
          },
        });

        upsertedCount++;
      } catch (error) {
        // Log but continue with other categories
        this.logger.warn(
          `Failed to upsert category ${cat.slug} for ${siteId}: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }

    return upsertedCount;
  }

  /**
   * Update category metrics from scraping results
   * Updates statistics based on scraping performance and results
   */
  async updateScrapingMetrics(
    categoryId: string,
    scrapingMetrics: {
      readonly dealCount?: number;
      readonly avgTemperature?: number;
      readonly popularBrands?: string[];
    }
  ): Promise<Category> {
    this.validateRequiredFields({ categoryId }, ['categoryId']);

    const statistics: CategoryStatistics = {
      dealCount: scrapingMetrics.dealCount,
      avgTemperature: scrapingMetrics.avgTemperature,
      popularBrands: scrapingMetrics.popularBrands,
    };

    return this.updateCategoryStatistics(categoryId, statistics);
  }

  /**
   * Find categories that need fresh scraping
   * Identifies categories that haven't been scraped recently
   */
  async findCategoriesNeedingDiscovery(): Promise<Category[]> {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    return this.executeWithErrorHandling('findCategoriesNeedingDiscovery', () =>
      this.prisma.category.findMany({
        where: {
          isActive: true,
          OR: [{ updatedAt: { lt: oneDayAgo } }, { dealCount: 0 }],
        },
        include: this.getDefaultCategoryIncludesWithRelations(),
        orderBy: [
          { updatedAt: 'asc' }, // Oldest first
          { level: 'asc' },
        ],
        take: 50, // Limit for performance
      })
    );
  }

  /**
   * Get discovery statistics for monitoring scraping progress
   * Provides comprehensive metrics for discovery dashboard
   */
  async getDiscoveryStatistics(): Promise<DiscoveryStatistics> {
    return this.executeWithErrorHandling('getDiscoveryStatistics', async () => {
      const [
        totalCategories,
        activeCategories,
        levelStatisticsRaw,
        recentCategoriesData,
      ] = await Promise.all([
        this.count(),
        this.count({ isActive: true }),
        this.prisma.category.groupBy({
          by: ['level'],
          _count: { id: true },
        }),
        this.prisma.category.findMany({
          where: {
            createdAt: {
              gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
            },
          },
          include: this.getDefaultCategoryIncludesWithRelations(),
          orderBy: { createdAt: 'desc' },
          take: 10,
        }),
      ]);

      // Transform level statistics into a more usable format
      const levelStatistics: Record<number, number> = {};
      for (const levelStat of levelStatisticsRaw) {
        levelStatistics[levelStat.level] = levelStat._count.id;
      }

      return {
        totalCategories,
        activeCategories,
        byLevel: levelStatistics,
        recentlyDiscovered: recentCategoriesData,
      };
    });
  }

  // Enhanced shared method implementations with scraper-specific behavior

  /**
   * Search categories with scraper-specific criteria
   * Includes scrape URL in search for discovery operations
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
      OR: [
        { name: { contains: searchQuery, mode: 'insensitive' } },
        { slug: { contains: searchQuery, mode: 'insensitive' } },
        { sourceUrl: { contains: searchQuery, mode: 'insensitive' } },
        { description: { contains: searchQuery, mode: 'insensitive' } },
      ],
    };

    const [categoriesData, totalCount] = await Promise.all([
      this.executeWithErrorHandling(
        'searchCategoriesByName',
        () =>
          this.prisma.category.findMany({
            where: searchFilter,
            include: this.getDefaultCategoryIncludesWithRelations(),
            orderBy: [
              { level: 'asc' }, // Hierarchy first for scraper
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
      data: categoriesData,
      pagination: this.calculatePaginationMetadata(
        totalCount,
        paginationOptions
      ),
    };
  }

  // Alias methods for backward compatibility with existing scraper service code

  /**
   * Alias for findActiveCategories() - maintains scraper service naming convention
   */
  async findActiveCategories(): Promise<Category[]> {
    return super.findActiveCategories();
  }

  /**
   * Find categories by parent ID - maintains scraper service naming convention
   */
  async findCategoriesByParentId(parentId: string): Promise<Category[]> {
    return this.executeWithErrorHandling('findCategoriesByParentId', () =>
      this.prisma.category.findMany({
        where: { parentId, isActive: true },
        include: this.getDefaultCategoryIncludesWithRelations(),
        orderBy: { name: 'asc' },
      })
    );
  }

  /**
   * Alias for findTopLevelCategories() - maintains scraper service naming convention
   */
  async findTopLevelCategories(): Promise<Category[]> {
    return super.findTopLevelCategories();
  }

  /**
   * Alias for updateScrapingMetrics() - maintains scraper service naming convention
   */
  async updateCategoryMetrics(
    categoryId: string,
    metrics: {
      readonly dealCount?: number;
      readonly avgTemperature?: number;
      readonly popularBrands?: string[];
    }
  ): Promise<Category> {
    return this.updateScrapingMetrics(categoryId, metrics);
  }

  /**
   * Alias for getDiscoveryStatistics() - maintains scraper service naming convention
   */
  async getDiscoveryStats(): Promise<DiscoveryStatistics> {
    return this.getDiscoveryStatistics();
  }

  /**
   * Find category ID by category name for efficient filter queries
   * This enables proper foreign key-based filtering instead of string matching
   */
  /**
   * Find category ID by category name for efficient filter queries
   * This enables proper foreign key-based filtering instead of string matching
   */
  async findCategoryIdByName(categoryName: string): Promise<string | null> {
    this.validateRequiredFields({ categoryName }, ['categoryName']);

    try {
      // First, try exact name match
      const exactMatch = await this.executeWithErrorHandling(
        'findCategoryIdByName',
        () =>
          this.prisma.category.findFirst({
            where: {
              name: {
                equals: categoryName,
                mode: 'insensitive',
              },
              isActive: true,
            },
          }),
        { categoryName }
      );

      if (exactMatch) {
        return exactMatch.id;
      }

      // If no exact match, try partial matching for names like "Consoles & Jeux vidéo"
      const simplifiedName = categoryName.split('&')[0].trim();
      const partialMatch = await this.executeWithErrorHandling(
        'findCategoryIdByNamePartial',
        () =>
          this.prisma.category.findFirst({
            where: {
              name: {
                contains: simplifiedName,
                mode: 'insensitive',
              },
              isActive: true,
            },
            orderBy: {
              name: 'asc', // Get the most specific match first
            },
          }),
        { categoryName, simplifiedName }
      );

      return partialMatch?.id || null;
    } catch (error) {
      this.logger.error(`Error finding category ID for "${categoryName}":`, error);
      return null;
    }
  }

  /**
   * Find category ID by category slug for scraping operations
   * Used when processing scraping URLs that contain category slugs
   */
  async findCategoryIdBySlug(categorySlug: string): Promise<string | null> {
    this.validateRequiredFields({ categorySlug }, ['categorySlug']);

    try {
      const category = await this.executeWithErrorHandling(
        'findCategoryIdBySlug',
        () =>
          this.prisma.category.findFirst({
            where: {
              slug: categorySlug,
              isActive: true,
            },
          }),
        { categorySlug }
      );

      return category?.id || null;
    } catch (error) {
      this.logger.error(
        `Error finding category ID for slug "${categorySlug}":`,
        error
      );
      return null;
    }
  }

  /**
   * Finds a category by slug and siteId.
   * Used by MultiSiteArticleService to resolve categories per site.
   */
  async findBySlugAndSiteId(
    slug: string,
    siteId: string,
  ): Promise<{ id: string; slug: string; siteId: string } | null> {
    try {
      const category = await this.prisma.category.findFirst({
        where: {
          slug,
          siteId,
          isActive: true,
        },
      });

      return category ? { id: category.id, slug: category.slug, siteId: category.siteId } : null;
    } catch (error) {
      this.logger.error(
        `Error finding category by slug "${slug}" and siteId "${siteId}":`,
        error,
      );
      return null;
    }
  }

  /**
   * Alias for performHealthCheck() - maintains scraper service naming convention
   */
  async healthCheck(): Promise<boolean> {
    return this.performHealthCheck();
  }
}
