import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { SharedConfigService } from '@dealscrapper/shared-config';
import { PrismaService } from '@dealscrapper/database';
import { Filter, Match, Article, Prisma } from '@dealscrapper/database';
import { firstValueFrom } from 'rxjs';
import { CreateFilterDto } from './dto/create-filter.dto.js';
import { UpdateFilterDto } from './dto/update-filter.dto.js';
import { FilterQueryDto } from './dto/filter-query.dto.js';
import {
  FilterResponseDto,
  FilterListResponseDto,
  MatchResponseDto,
  MatchListResponseDto,
} from './dto/filter-response.dto.js';
import { CategoryDto } from '../categories/dto/category.dto.js';
import {
  convertFilterExpressionForDb,
  convertFilterExpressionFromDb,
  parseFilterExpression,
} from './utils/filter-expression.utils.js';
import { FilterPrismaWhere } from './types/filter-query.types.js';
import { DigestFrequency } from '@dealscrapper/shared-types/enums';
import {
  RuleBasedFilterExpression,
  FilterRule,
  FilterRuleGroup,
} from '@dealscrapper/shared-types';
import { ArticleWrapper } from '@dealscrapper/shared-types/article';
import { calculatePaginationOffset } from '@dealscrapper/shared-repository';
import { createServiceLogger } from '@dealscrapper/shared-logging';
import { apiLogConfig } from '../config/logging.config.js';
import { FilterMatcherService } from './services/filter-matcher.service.js';

// Type definitions for Prisma relations
type FilterWithCategories = Prisma.FilterGetPayload<{
  include: {
    categories: {
      include: {
        category: {
          include: {
            site: true;
            scheduledJob: true;
          };
        };
      };
    };
  };
}>;

type FilterCategory = Prisma.FilterCategoryGetPayload<{
  include: {
    category: {
      include: {
        site: true;
        scheduledJob: true;
      };
    };
  };
}>;

type MatchWithArticle = Prisma.MatchGetPayload<{
  include: {
    article: true;
    filter: true;
  };
}>;

interface FilterStats {
  totalMatches: number;
  matchesLast24h: number;
  matchesLast7d: number;
  avgScore: number;
  topScore: number;
  lastMatchAt?: Date;
}

export interface ScrapingStatusCategory {
  categoryId: string;
  categoryName: string;
  scheduledJob: {
    id: string;
    nextScheduledAt: Date | null;
    isActive: boolean;
  } | null;
  latestExecution: {
    id: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    executionTimeMs: number | null;
    dealsFound: number | null;
    dealsProcessed: number | null;
  } | null;
}

export interface ScrapingStatusResponse {
  categories: ScrapingStatusCategory[];
  nextScrapingAt: Date | null;
}

@Injectable()
export class FiltersService {
  private readonly logger = createServiceLogger(apiLogConfig);

  constructor(
    private readonly prisma: PrismaService,
    private readonly httpService: HttpService,
    private readonly sharedConfig: SharedConfigService,
    private readonly filterMatcherService: FilterMatcherService,
  ) {}

  /**
   * Create a new filter for a user
   */
  async create(
    userId: string,
    createFilterDto: CreateFilterDto
  ): Promise<FilterResponseDto> {
    try {
      // Validate filter expression
      this.validateFilterExpression(createFilterDto.filterExpression);

      // Validate that all category IDs exist
      const existingCategories = await this.prisma.category.findMany({
        where: {
          id: {
            in: createFilterDto.categoryIds,
          },
        },
      });

      const existingCategoryIds = existingCategories.map((cat) => cat.id);
      const missingCategoryIds = createFilterDto.categoryIds.filter(
        (id) => !existingCategoryIds.includes(id)
      );

      if (missingCategoryIds.length > 0) {
        throw new BadRequestException(
          `The following category IDs do not exist: ${missingCategoryIds.join(', ')}`
        );
      }

      const filter = await this.prisma.filter.create({
        data: {
          name: createFilterDto.name,
          description: createFilterDto.description,
          active: createFilterDto.active ?? true,
          userId,
          filterExpression: convertFilterExpressionForDb(
            createFilterDto.filterExpression
          ),
          immediateNotifications:
            createFilterDto.immediateNotifications ?? true,
          digestFrequency: createFilterDto.digestFrequency ?? 'daily',
          maxNotificationsPerDay: createFilterDto.maxNotificationsPerDay ?? 50,
          categories: {
            create: createFilterDto.categoryIds.map((categoryId) => ({
              categoryId,
            })),
          },
        },
        include: {
          categories: {
            include: {
              category: {
                include: {
                  site: true,
                  scheduledJob: true,
                },
              },
            },
          },
        },
      });

      this.logger.log(
        `Created filter ${filter.id} for user ${userId} with ${createFilterDto.categoryIds.length} categories`
      );

      // Notify scheduler service to create ScheduledJobs for the categories
      // This enables scraping for the filter's categories
      await this.notifySchedulerService(
        filter.id,
        'created',
        createFilterDto.categoryIds
      );

      // Match existing articles against the new filter (async, don't block response)
      // This provides immediate results without triggering new scrapes
      this.matchExistingArticlesForFilter(filter.id, createFilterDto.categoryIds)
        .then((matchCount) => {
          if (matchCount > 0) {
            this.logger.log(
              `✅ Created ${matchCount} matches for new filter ${filter.id} from existing articles`
            );
          }
        })
        .catch((error) => {
          this.logger.warn(
            `⚠️ Failed to match existing articles for filter ${filter.id}: ${(error as Error).message}`
          );
        });

      return this.mapToResponseDto(filter);
    } catch (error) {
      this.logger.error(
        `Error creating filter for user ${userId}:`,
        (error as Error).message
      );
      throw error;
    }
  }

  /**
   * Get all filters for a user with pagination and filtering
   */
  async findAll(
    userId: string,
    query: FilterQueryDto
  ): Promise<FilterListResponseDto> {
    const {
      page = 1,
      limit = 20,
      active,
      category,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;
    const offset = calculatePaginationOffset(page, limit);

    const where: FilterPrismaWhere = { userId };

    // Apply filters
    if (active !== undefined) {
      where.active = active;
    }

    if (category) {
      where.categories = {
        some: {
          category: {
            slug: category,
          },
        },
      };
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Get total count
    const total = await this.prisma.filter.count({ where });

    // Get filters with pagination and include categories with site and ScheduledJob data
    const filters = await this.prisma.filter.findMany({
      where,
      skip: offset,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      include: {
        categories: {
          include: {
            category: {
              include: {
                site: true,
                scheduledJob: true,
              },
            },
          },
        },
      },
    });

    // For list endpoint, use lightweight mapping without individual stats queries
    const filterResponses = filters.map((filter) =>
      this.mapToListResponseDto(filter)
    );

    return {
      filters: filterResponses,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get a specific filter by ID
   */
  async findOne(userId: string, filterId: string): Promise<FilterResponseDto> {
    const filter = await this.prisma.filter.findFirst({
      where: { id: filterId, userId },
      include: {
        categories: {
          include: {
            category: {
              include: {
                site: true,
                scheduledJob: true,
              },
            },
          },
        },
      },
    });

    if (!filter) {
      throw new NotFoundException(`Filter with ID ${filterId} not found`);
    }

    return this.mapToResponseDto(filter);
  }

  /**
   * Update a filter
   */
  async update(
    userId: string,
    filterId: string,
    updateFilterDto: UpdateFilterDto
  ): Promise<FilterResponseDto> {
    // Check if filter exists and belongs to user
    const existingFilter = await this.prisma.filter.findFirst({
      where: { id: filterId, userId },
      include: {
        categories: {
          include: { category: true },
        },
      },
    });

    if (!existingFilter) {
      throw new NotFoundException(`Filter with ID ${filterId} not found`);
    }

    // Determine if matching criteria changed (requires match re-evaluation)
    const filterExpressionChanged = updateFilterDto.filterExpression !== undefined;
    const categoriesChanged = updateFilterDto.categoryIds !== undefined;
    // Note: enabledSites removed - sites are now derived from categories
    const matchingCriteriaChanged = filterExpressionChanged || categoriesChanged;

    try {
      const updatedFilter = await this.prisma.filter.update({
        where: { id: filterId },
        data: {
          name: updateFilterDto.name,
          description: updateFilterDto.description,
          active: updateFilterDto.active,
          // Note: enabledSites removed - sites are now derived from categories
          filterExpression: updateFilterDto.filterExpression
            ? convertFilterExpressionForDb(updateFilterDto.filterExpression)
            : undefined,
          immediateNotifications: updateFilterDto.immediateNotifications,
          digestFrequency: updateFilterDto.digestFrequency,
          maxNotificationsPerDay: updateFilterDto.maxNotificationsPerDay,
          updatedAt: new Date(),
          // Update categories if provided
          ...(updateFilterDto.categoryIds && {
            categories: {
              deleteMany: {}, // Remove existing categories
              create: updateFilterDto.categoryIds.map((categoryId) => ({
                categoryId,
              })),
            },
          }),
        },
        include: {
          categories: {
            include: {
              category: {
                include: {
                  site: true,
                  scheduledJob: true,
                },
              },
            },
          },
        },
      });

      this.logger.log(`Updated filter ${filterId} for user ${userId}`);

      // Notify scheduler service about filter update
      // Get category IDs from the updated filter
      const categoryIds = updatedFilter.categories.map(
        (fc) => fc.category.id
      );
      await this.notifySchedulerService(filterId, 'updated', categoryIds);

      // If matching criteria changed, re-evaluate all matches
      if (matchingCriteriaChanged) {
        this.logger.log(
          `🔄 Matching criteria changed for filter ${filterId}, re-evaluating matches...`
        );

        // Delete all existing matches for this filter
        const deleteResult = await this.prisma.match.deleteMany({
          where: { filterId },
        });
        this.logger.log(
          `🗑️ Deleted ${deleteResult.count} existing matches for filter ${filterId}`
        );

        // Re-evaluate articles against updated filter (async, don't block response)
        this.matchExistingArticlesForFilter(filterId, categoryIds)
          .then((matchCount) => {
            this.logger.log(
              `✅ Re-evaluated filter ${filterId}: created ${matchCount} new matches`
            );
          })
          .catch((error) => {
            this.logger.warn(
              `⚠️ Failed to re-evaluate matches for filter ${filterId}: ${(error as Error).message}`
            );
          });
      }

      return this.mapToResponseDto(updatedFilter);
    } catch (error) {
      this.logger.error(
        `Error updating filter ${filterId}:`,
        (error as Error).message
      );
      throw error;
    }
  }

  /**
   * Delete a filter
   */
  async remove(userId: string, filterId: string): Promise<void> {
    // Check if filter exists and belongs to user
    const filter = await this.prisma.filter.findFirst({
      where: { id: filterId, userId },
      include: {
        categories: {
          include: { category: true },
        },
      },
    });

    if (!filter) {
      throw new NotFoundException(`Filter with ID ${filterId} not found`);
    }

    // Get category IDs before deletion for cleanup notification
    const categoryIds = filter.categories.map((fc) => fc.category.id);

    try {
      await this.prisma.filter.delete({
        where: { id: filterId },
      });

      this.logger.log(`Deleted filter ${filterId} for user ${userId}`);

      // Notify scheduler service about filter deletion
      await this.notifySchedulerService(filterId, 'deleted', categoryIds);
    } catch (error) {
      this.logger.error(
        `Error deleting filter ${filterId}:`,
        (error as Error).message
      );
      throw error;
    }
  }

  /**
   * Toggle filter active status
   */
  async toggleActive(
    userId: string,
    filterId: string
  ): Promise<FilterResponseDto> {
    const filter = await this.prisma.filter.findFirst({
      where: { id: filterId, userId },
      include: {
        categories: {
          include: { category: true },
        },
      },
    });

    if (!filter) {
      throw new NotFoundException(`Filter with ID ${filterId} not found`);
    }

    const updatedFilter = await this.prisma.filter.update({
      where: { id: filterId },
      data: { active: !filter.active },
      include: {
        categories: {
          include: {
            category: {
              include: {
                site: true,
                scheduledJob: true,
              },
            },
          },
        },
      },
    });

    this.logger.log(
      `Toggled filter ${filterId} to ${updatedFilter.active ? 'active' : 'inactive'}`
    );

    // Notify scheduler service about status change
    const categoryIds = filter.categories.map((fc) => fc.categoryId);
    await this.notifySchedulerService(filterId, 'updated', categoryIds);

    return this.mapToResponseDto(updatedFilter);
  }

  /**
   * Get matches for a specific filter
   */
  async getMatches(
    userId: string,
    filterId: string,
    page: number = 1,
    limit: number = 20,
    search?: string,
    sortBy?: string,
    sortOrder?: 'asc' | 'desc'
  ): Promise<MatchListResponseDto> {
    // Verify filter belongs to user
    const filter = await this.prisma.filter.findFirst({
      where: { id: filterId, userId },
    });

    if (!filter) {
      throw new NotFoundException(`Filter with ID ${filterId} not found`);
    }

    const offset = calculatePaginationOffset(page, limit);

    // Build where clause with search filter
    const whereClause: Prisma.MatchWhereInput = { filterId };

    if (search) {
      whereClause.article = {
        title: {
          contains: search,
          mode: 'insensitive' as Prisma.QueryMode,
        },
      };
    }

    // Build order clause
    const orderClause: Prisma.MatchOrderByWithRelationInput[] = [];

    if (sortBy && sortOrder) {
      // Map frontend sort fields to database fields
      // NOTE: Site-specific fields (temperature, merchant, etc.) are in extension tables
      // and cannot be used for sorting at the Prisma level. Only base Article fields are supported.
      const sortFieldMap: Record<string, string> = {
        title: 'article.title',
        currentPrice: 'article.currentPrice',
        publishedAt: 'article.publishedAt',
        scrapedAt: 'article.scrapedAt',
        score: 'score',
        createdAt: 'createdAt',
      };

      const dbField = sortFieldMap[sortBy];
      if (dbField) {
        if (dbField.includes('article.')) {
          // For article fields, use nested orderBy
          const articleField = dbField.replace('article.', '');
          orderClause.push({
            article: { [articleField]: sortOrder },
          });
        } else {
          // For match fields, use direct orderBy
          orderClause.push({ [dbField]: sortOrder });
        }
      }
    }

    // Default sorting: by score desc, then by creation date desc
    if (orderClause.length === 0) {
      orderClause.push({ score: 'desc' }, { createdAt: 'desc' });
    }

    // Get total count
    const total = await this.prisma.match.count({
      where: whereClause,
    });

    // Get matches with articles
    // NOTE: Extension tables (ArticleDealabs, etc.) are NOT Prisma relations
    // They use application-layer ArticleWrapper pattern - loaded separately if needed
    const matches = await this.prisma.match.findMany({
      where: whereClause,
      include: {
        article: true,
        filter: true,
      },
      skip: offset,
      take: limit,
      orderBy: orderClause,
    });

    // Load ArticleWrappers to include site-specific extension data
    const articleIds = matches.map((m) => m.articleId);
    let wrapperMap = new Map<string, ArticleWrapper>();

    if (articleIds.length > 0) {
      try {
        const wrappers = await ArticleWrapper.loadMany(articleIds, this.prisma);
        wrapperMap = new Map(wrappers.map((w) => [w.base.id, w]));
      } catch (error) {
        this.logger.warn(
          `Failed to load ArticleWrappers for matches: ${(error as Error).message}. Extension fields will be undefined.`
        );
      }
    }

    // Map matches to response DTOs with site-specific extension data
    const matchResponses: MatchResponseDto[] = matches.map((match) => {
      const article = match.article;
      const wrapper = wrapperMap.get(article.id);

      // Extract site-specific fields from wrapper extension
      let temperature: number | undefined;
      let merchant: string | undefined;
      let originalPrice: number | undefined;
      let expiresAt: Date | undefined;

      if (wrapper?.isDealabs()) {
        const ext = wrapper.extension;
        temperature = ext.temperature;
        merchant = ext.merchant ?? undefined;
        originalPrice = ext.originalPrice ?? undefined;
        expiresAt = ext.expiresAt ?? undefined;
      }

      return {
        id: match.id,
        filterId: match.filterId,
        filterName: match.filter.name,
        articleId: match.articleId,
        score: match.score,
        notified: match.notified,
        notifiedAt: match.notifiedAt ?? undefined,
        createdAt: match.createdAt,
        article: {
          id: article.id,
          title: article.title,
          currentPrice: article.currentPrice || 0,
          originalPrice,
          temperature,
          merchant,
          categoryId: article.categoryId,
          siteId: article.siteId,
          url: article.url,
          imageUrl: article.imageUrl ?? undefined,
          publishedAt: article.publishedAt ?? undefined,
          scrapedAt: article.scrapedAt,
          expiresAt,
          isExpired: article.isExpired || false,
        },
      };
    });

    return {
      matches: matchResponses,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get filter statistics
   */
  async getFilterStats(userId: string, filterId: string): Promise<FilterStats> {
    const filter = await this.prisma.filter.findFirst({
      where: { id: filterId, userId },
    });

    if (!filter) {
      throw new NotFoundException(`Filter with ID ${filterId} not found`);
    }

    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalMatches,
      matchesLast24h,
      matchesLast7d,
      avgScore,
      topScore,
      lastMatch,
    ] = await Promise.all([
      this.prisma.match.count({ where: { filterId } }),
      this.prisma.match.count({
        where: { filterId, createdAt: { gte: last24h } },
      }),
      this.prisma.match.count({
        where: { filterId, createdAt: { gte: last7d } },
      }),
      this.prisma.match.aggregate({
        where: { filterId },
        _avg: { score: true },
      }),
      this.prisma.match.aggregate({
        where: { filterId },
        _max: { score: true },
      }),
      this.prisma.match.findFirst({
        where: { filterId },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      totalMatches,
      matchesLast24h,
      matchesLast7d,
      avgScore: avgScore._avg.score || 0,
      topScore: topScore._max.score || 0,
      lastMatchAt: lastMatch?.createdAt,
    };
  }

  /**
   * Find all filters that match a given article.
   * 
   * Uses FilterMatcherService to evaluate filter expressions against
   * the article's data.
   * 
   * @param articleId - Article ID to match filters against
   * @returns Array of matching Filter objects
   * @throws {NotFoundException} If article not found
   */
  async findMatchingFilters(articleId: string): Promise<Filter[]> {
    this.logger.debug(`Finding matching filters for article: ${articleId}`);

    // Load article with ArticleWrapper (includes site-specific extension)
    const article = await ArticleWrapper.load(articleId, this.prisma);

    // Use FilterMatcherService to find matches
    const matchingFilters = await this.filterMatcherService.matchArticle(article);

    this.logger.log(
      `Article ${articleId} matched ${matchingFilters.length} filters`,
    );

    return matchingFilters;
  }

  private mapCategoriesToDto(filterCategories: FilterCategory[]): CategoryDto[] {
    return filterCategories?.map((fc) => ({
      id: fc.category.id,
      slug: fc.category.slug,
      name: fc.category.name,
      siteId: fc.category.siteId,
      sourceUrl: fc.category.sourceUrl,
      parentId: fc.category.parentId ?? undefined,
      level: fc.category.level,
      description: fc.category.description ?? undefined,
      dealCount: fc.category.dealCount,
      avgTemperature: fc.category.avgTemperature,
      popularBrands: fc.category.popularBrands,
      isActive: fc.category.isActive,
      userCount: fc.category.userCount,
      createdAt: fc.category.createdAt,
      updatedAt: fc.category.updatedAt,
    })) || [];
  }

  private async mapToResponseDto(filter: FilterWithCategories): Promise<FilterResponseDto> {
    const stats = await this.getFilterStats(filter.userId, filter.id);

    // Derive enabled sites from categories
    const enabledSites = [...new Set(filter.categories.map((fc) => fc.category.siteId))];

    return {
      id: filter.id,
      userId: filter.userId,
      name: filter.name,
      description: filter.description ?? undefined,
      active: filter.active,
      createdAt: filter.createdAt,
      updatedAt: filter.updatedAt,
      categories: this.mapCategoriesToDto(filter.categories),
      enabledSites, // Derived from categories
      filterExpression: convertFilterExpressionFromDb(filter.filterExpression),
      immediateNotifications: filter.immediateNotifications,
      digestFrequency: filter.digestFrequency as DigestFrequency,
      maxNotificationsPerDay: filter.maxNotificationsPerDay,
      lastMatchAt: stats.lastMatchAt,
      stats,
      // REMOVED: totalMatches - now only in stats object
      // REMOVED: matchesLast24h - now only in stats object
      // REMOVED: nextScheduledAt - scheduling is now per-category
    };
  }

  /**
   * Map filter to lightweight response DTO for list endpoints (without stats)
   */
  private mapToListResponseDto(filter: FilterWithCategories): FilterResponseDto {
    // Derive enabled sites from categories
    const enabledSites = [...new Set(filter.categories.map((fc) => fc.category.siteId))];

    return {
      id: filter.id,
      userId: filter.userId,
      name: filter.name,
      description: filter.description ?? undefined,
      active: filter.active,
      createdAt: filter.createdAt,
      updatedAt: filter.updatedAt,
      categories: this.mapCategoriesToDto(filter.categories),
      enabledSites, // Derived from categories
      filterExpression: convertFilterExpressionFromDb(filter.filterExpression),
      immediateNotifications: filter.immediateNotifications,
      digestFrequency: filter.digestFrequency as DigestFrequency,
      maxNotificationsPerDay: filter.maxNotificationsPerDay,
      lastMatchAt: undefined, // Not calculated for list view
      // REMOVED: stats object - use /filters/:id/stats endpoint for async loading
    };
  }

  async getFiltersCount(userId: string): Promise<number> {
    return this.prisma.filter.count({
      where: { userId },
    });
  }

  /**
   * Notify scheduler service about filter changes for ScheduledJob management
   */
  private async notifySchedulerService(
    filterId: string,
    action: 'created' | 'updated' | 'deleted',
    categoryIds: string[] = []
  ): Promise<void> {
    try {
      const schedulerUrl = this.sharedConfig.get<string>('SCHEDULER_URL');

      await firstValueFrom(
        this.httpService.post(`${schedulerUrl}/scheduled-jobs/filter-change`, {
          filterId,
          action,
          categoryIds,
        })
      );

      this.logger.debug(
        `✅ Notified scheduler service: filter ${filterId} ${action} with ${categoryIds.length} categories`
      );
    } catch (error) {
      // Don't fail the filter operation if scheduler service is unavailable
      this.logger.warn(
        `⚠️ Failed to notify scheduler service:`,
        (error as Error).message
      );
    }
  }

  /**
   * Match existing articles against a newly created filter
   * This runs asynchronously after filter creation to provide immediate matches
   * without triggering new scrapes (handled by scheduler separately)
   */
  private async matchExistingArticlesForFilter(
    filterId: string,
    categoryIds: string[]
  ): Promise<number> {
    if (!categoryIds || categoryIds.length === 0) {
      this.logger.debug(
        `No categories specified for filter ${filterId}, skipping article matching`
      );
      return 0;
    }

    // Fetch the filter with its expression
    const filter = await this.prisma.filter.findUnique({
      where: { id: filterId },
    });

    if (!filter) {
      this.logger.warn(`Filter ${filterId} not found for article matching`);
      return 0;
    }

    const filterExpression = parseFilterExpression(filter.filterExpression);

    if (!filterExpression) {
      this.logger.warn(`Invalid filter expression for filter ${filterId}`);
      return 0;
    }

    // Fetch articles from the specified categories
    // Sites are now derived from categories, not stored on filter
    // Limit to recent articles to avoid processing too many (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const articles = await this.prisma.article.findMany({
      where: {
        categoryId: { in: categoryIds },
        publishedAt: { gte: thirtyDaysAgo },
      },
      take: 1000, // Limit batch size for performance
    });

    if (articles.length === 0) {
      this.logger.debug(
        `No recent articles found in categories for filter ${filterId}`
      );
      return 0;
    }

    this.logger.debug(
      `Processing ${articles.length} existing articles for filter ${filterId}`
    );

    // Load articles as ArticleWrappers for evaluation
    const articleIds = articles.map((a) => a.id);
    let wrappers: ArticleWrapper[];

    try {
      wrappers = await ArticleWrapper.loadMany(articleIds, this.prisma);
    } catch (error) {
      this.logger.warn(
        `Failed to load article wrappers for filter ${filterId}: ${(error as Error).message}`
      );
      return 0;
    }

    // Evaluate filter against each article
    const matchesToCreate: { filterId: string; articleId: string; score: number }[] = [];

    for (const wrapper of wrappers) {
      try {
        const matches = this.filterMatcherService.evaluateFilterExpression(
          filterExpression,
          wrapper
        );

        if (matches) {
          // Calculate score for the match
          const score = this.calculateMatchScore(filterExpression, wrapper);
          matchesToCreate.push({
            filterId,
            articleId: wrapper.base.id,
            score,
          });
        }
      } catch (error) {
        this.logger.debug(
          `Error evaluating article ${wrapper.base.id} against filter ${filterId}: ${(error as Error).message}`
        );
      }
    }

    if (matchesToCreate.length === 0) {
      this.logger.debug(`No matches found for filter ${filterId}`);
      return 0;
    }

    // Create matches in bulk, skip duplicates
    try {
      const result = await this.prisma.match.createMany({
        data: matchesToCreate,
        skipDuplicates: true,
      });

      this.logger.debug(
        `Created ${result.count} matches for filter ${filterId}`
      );
      return result.count;
    } catch (error) {
      this.logger.warn(
        `Failed to create matches for filter ${filterId}: ${(error as Error).message}`
      );
      return 0;
    }
  }

  /**
   * Calculate match score for an article against filter rules
   */
  private calculateMatchScore(
    expression: RuleBasedFilterExpression,
    article: ArticleWrapper
  ): number {
    const { rules, minScore, scoreMode = 'weighted' } = expression;

    // If no rules, no score
    if (!rules || rules.length === 0) {
      return 0;
    }

    // If score-based matching is used, calculate actual score
    if (minScore !== undefined && minScore > 0) {
      let totalWeight = 0;
      let earnedWeight = 0;

      for (const rule of rules) {
        const weight = rule.weight ?? 1.0;
        totalWeight += weight;

        // TODO: Expose evaluateRuleOrGroup as a public method on FilterMatcherService instead of using bracket notation to bypass access modifiers
        const matches = this.filterMatcherService['evaluateRuleOrGroup'](
          rule,
          article
        );
        if (matches) {
          earnedWeight += weight;
        }
      }

      switch (scoreMode) {
        case 'percentage':
          return totalWeight > 0 ? (earnedWeight / totalWeight) * 100 : 0;
        case 'points':
        case 'weighted':
        default:
          return earnedWeight;
      }
    }

    // For boolean matching, use count of matching rules as score
    let matchingRules = 0;
    for (const rule of rules) {
      if (
        this.filterMatcherService['evaluateRuleOrGroup'](rule, article)
      ) {
        matchingRules++;
      }
    }
    return matchingRules;
  }

  /**
   * Validate filter expression for basic structural issues
   */
  private validateFilterExpression(expression: RuleBasedFilterExpression): void {
    if (!expression || typeof expression !== 'object') {
      throw new BadRequestException('Filter expression must be an object');
    }

    if (!expression.rules || !Array.isArray(expression.rules)) {
      throw new BadRequestException(
        'Filter expression must have a rules array'
      );
    }

    if (expression.rules.length === 0) {
      throw new BadRequestException(
        'Filter expression must have at least one rule'
      );
    }

    // Validate each rule
    for (let i = 0; i < expression.rules.length; i++) {
      const rule = expression.rules[i];
      this.validateRule(rule, `rules[${i}]`);
    }
  }

  /**
   * Validate a single rule or rule group
   */
  private validateRule(rule: FilterRule | FilterRuleGroup, path: string): void {
    if (!rule || typeof rule !== 'object') {
      throw new BadRequestException(
        `Invalid rule at ${path}: must be an object`
      );
    }

    // Type guard: check if this is a rule group
    if ('logic' in rule && rule.logic) {
      // This is a rule group
      const ruleGroup = rule as FilterRuleGroup;
      if (!ruleGroup.rules || !Array.isArray(ruleGroup.rules)) {
        throw new BadRequestException(
          `Invalid rule group at ${path}: must have a rules array`
        );
      }

      if (ruleGroup.rules.length === 0) {
        throw new BadRequestException(
          `Invalid rule group at ${path}: must have at least one rule`
        );
      }

      // Validate nested rules
      for (let i = 0; i < ruleGroup.rules.length; i++) {
        this.validateRule(ruleGroup.rules[i], `${path}.rules[${i}]`);
      }
    } else {
      // This is a regular rule
      const filterRule = rule as FilterRule;
      if (
        !filterRule.field ||
        typeof filterRule.field !== 'string' ||
        filterRule.field.trim() === ''
      ) {
        throw new BadRequestException(
          `Filter validation failed: Invalid rule at ${path}: field is required and cannot be empty`
        );
      }

      if (
        !filterRule.operator ||
        typeof filterRule.operator !== 'string' ||
        filterRule.operator.trim() === ''
      ) {
        throw new BadRequestException(
          `Invalid rule at ${path}: operator is required and cannot be empty`
        );
      }

      if (filterRule.value === undefined || filterRule.value === null) {
        throw new BadRequestException(
          `Invalid rule at ${path}: value is required`
        );
      }

      // Check for empty string values
      if (typeof filterRule.value === 'string' && filterRule.value.trim() === '') {
        throw new BadRequestException(
          `Invalid rule at ${path}: value cannot be empty`
        );
      }
    }
  }

  /**
   * Get scraping job status for all categories associated with a filter
   */
  async getScrapingStatus(userId: string, filterId: string): Promise<ScrapingStatusResponse> {
    this.logger.debug(`Getting scraping status for filter ${filterId}`);

    // Get filter with categories (verifies ownership and existence)
    const filter = await this.prisma.filter.findFirst({
      where: {
        id: filterId,
        userId,
      },
      include: {
        categories: {
          include: {
            category: {
              include: {
                site: true,
                scheduledJob: {
                  include: {
                    scrapingJobs: {
                      orderBy: { createdAt: 'desc' },
                      take: 1, // Get most recent execution
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!filter) {
      throw new NotFoundException('Filter not found');
    }

    const categories: ScrapingStatusCategory[] = [];
    let nextScrapingAt: Date | null = null;

    // Process each category - return raw data only
    for (const filterCategory of filter.categories) {
      const category = filterCategory.category;
      const scheduledJob = category.scheduledJob;
      const latestExecution = scheduledJob?.scrapingJobs?.[0] || null;

      categories.push({
        categoryId: category.id,
        categoryName: category.name,
        scheduledJob: scheduledJob
          ? {
              id: scheduledJob.id,
              nextScheduledAt: scheduledJob.nextScheduledAt,
              isActive: scheduledJob.isActive,
            }
          : null,
        latestExecution: latestExecution
          ? {
              id: latestExecution.id,
              status: latestExecution.status,
              createdAt: latestExecution.createdAt,
              updatedAt: latestExecution.updatedAt,
              executionTimeMs: latestExecution.executionTimeMs,
              dealsFound: latestExecution.dealsFound,
              dealsProcessed: latestExecution.dealsProcessed,
            }
          : null,
        // REMOVED: statusText - let frontend handle presentation
      });

      // Track the earliest next scraping time across all categories
      if (scheduledJob?.nextScheduledAt) {
        const nextTime = new Date(scheduledJob.nextScheduledAt);
        if (!nextScrapingAt || nextTime < nextScrapingAt) {
          nextScrapingAt = nextTime;
        }
      }
    }

    return {
      categories,
      nextScrapingAt, // Raw data - frontend calculates "next in X minutes"
      // REMOVED: overallStatus - let frontend handle presentation
    };
  }

}
