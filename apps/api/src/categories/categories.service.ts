import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { SharedConfigService } from '@dealscrapper/shared-config';
import { PrismaService, CategoryDto } from '@dealscrapper/database';
import type { Prisma } from '@prisma/client';
import { CategoryDto as LocalCategoryDto } from './dto/category.dto.js';
import { buildCategoryDisplayPath, isCategorySelectable } from './utils/category-display.utils.js';
import { createServiceLogger } from '@dealscrapper/shared-logging';
import { apiLogConfig } from '../config/logging.config.js';

@Injectable()
export class CategoriesService {
  private readonly logger = createServiceLogger(apiLogConfig);
  private readonly schedulerUrl: string;

  constructor(
    private prisma: PrismaService,
    private sharedConfig: SharedConfigService
  ) {
    this.schedulerUrl = this.sharedConfig.get<string>('SCHEDULER_URL');
  }


  /**
   * Get categories with optional search and site filtering
   * Categories are managed by scraping cron job
   * @param searchText - Optional text to search in name, slug, or description
   * @param siteIds - Optional array of site IDs to filter by (e.g., ['dealabs', 'vinted'])
   */
  async findAll(
    searchText?: string,
    siteIds?: string[]
  ): Promise<LocalCategoryDto[]> {
    try {
      const whereClause: Prisma.CategoryWhereInput = {
        isActive: true,
      };

      // Filter by site(s) if provided
      if (siteIds && siteIds.length > 0) {
        whereClause.siteId = { in: siteIds };
        this.logger.debug(`Filtering categories by sites: ${siteIds.join(', ')}`);
      }

      // Add search functionality if searchText is provided
      if (searchText && searchText.trim()) {
        const searchTerm = searchText.trim().toLowerCase();
        this.logger.debug(`Searching categories with term: "${searchTerm}"`);
        whereClause.OR = [
          {
            name: {
              contains: searchTerm,
              mode: 'insensitive',
            },
          },
          {
            slug: {
              contains: searchTerm,
              mode: 'insensitive',
            },
          },
          {
            description: {
              contains: searchTerm,
              mode: 'insensitive',
            },
          },
        ];
      }

      const categories = await this.prisma.category.findMany({
        where: whereClause,
        include: {
          site: true,
          // Include nested parent for building displayPath (up to grandparent for level 2)
          parent: {
            include: {
              parent: true,
            },
          },
        },
        orderBy:
          searchText && searchText.trim()
            ? [{ name: 'asc' }, { level: 'asc' }] // Prioritize name match when searching
            : [{ level: 'asc' }, { name: 'asc' }], // Default hierarchy order
        take: searchText && searchText.trim() ? 50 : undefined, // Limit search results for performance
      });

      this.logger.debug(
        `Found ${categories.length} categories${searchText ? ` matching "${searchText}"` : ''}${siteIds ? ` from sites: ${siteIds.join(', ')}` : ''}`
      );

      return categories.map((category) => this.mapToCategoryDto(category));
    } catch (error) {
      this.logger.error('Error fetching categories:', error);
      throw error;
    }
  }

  /**
   * Trigger category discovery by calling the scheduler service
   * @param userId - ID of the user who triggered the discovery
   * @returns Discovery job information from scheduler
   */
  async triggerCategoryDiscovery(userId: string): Promise<{
    jobId: string;
    message: string;
    queuedAt: string;
    triggeredBy: string;
  }> {
    try {
      this.logger.log(`Triggering category discovery for user ${userId}`);

      const payload = {
        triggerSource: 'external-api',
        description: `Manual discovery requested by user ${userId} from API service`,
      };

      const response = await fetch(
        `${this.schedulerUrl}/category-discovery/trigger`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(
          `Failed to trigger category discovery: ${response.status} ${response.statusText} - ${errorText}`
        );

        if (response.status === 409) {
          throw new HttpException(
            'Category discovery is already running. Please wait for the current process to complete.',
            HttpStatus.CONFLICT
          );
        }

        throw new HttpException(
          'Failed to trigger category discovery. Please try again later.',
          HttpStatus.SERVICE_UNAVAILABLE
        );
      }

      const result = (await response.json()) as {
        jobId: string;
        message: string;
        queuedAt: string;
        triggeredBy: string;
      };
      this.logger.log(
        `Category discovery triggered successfully: Job ID ${result.jobId}`
      );

      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Error triggering category discovery:', error);
      throw new HttpException(
        'Failed to communicate with category discovery service',
        HttpStatus.SERVICE_UNAVAILABLE
      );
    }
  }


  /**
   * Get categories filtered by site
   * @param siteId - Site ID (dealabs, vinted, leboncoin)
   * @returns Array of categories for the specified site
   */
  async findBySite(siteId: string): Promise<LocalCategoryDto[]> {
    try {
      this.logger.debug(`Fetching categories for site: ${siteId}`);

      const categories = await this.prisma.category.findMany({
        where: {
          siteId,
          isActive: true,
        },
        include: {
          site: true,
          // Include nested parent for building displayPath (up to grandparent for level 2)
          parent: {
            include: {
              parent: true,
            },
          },
        },
        orderBy: [{ level: 'asc' }, { name: 'asc' }],
      });

      this.logger.debug(
        `Found ${categories.length} categories for site: ${siteId}`
      );

      return categories.map((category) => this.mapToCategoryDto(category));
    } catch (error) {
      this.logger.error(`Error fetching categories for site ${siteId}:`, error);
      throw error;
    }
  }

  /**
   * Get category tree (hierarchical structure) by site
   * @param siteId - Site ID (dealabs, vinted, leboncoin)
   * @param includeInactive - Whether to include inactive categories
   * @returns Array of categories in hierarchical order
   */
  async getCategoryTree(
    siteId: string,
    includeInactive = false
  ): Promise<LocalCategoryDto[]> {
    try {
      this.logger.debug(
        `Fetching category tree for site: ${siteId} (includeInactive: ${includeInactive})`
      );

      const whereClause: Prisma.CategoryWhereInput = {
        siteId,
      };

      if (!includeInactive) {
        whereClause.isActive = true;
      }

      const categories = await this.prisma.category.findMany({
        where: whereClause,
        include: {
          site: true,
          // Include nested parent for building displayPath (up to grandparent for level 2)
          parent: {
            include: {
              parent: true,
            },
          },
        },
        orderBy: [{ level: 'asc' }, { parentId: 'asc' }, { name: 'asc' }],
      });

      this.logger.debug(
        `Found ${categories.length} categories in tree for site: ${siteId}`
      );

      return categories.map((category) => this.mapToCategoryDto(category));
    } catch (error) {
      this.logger.error(
        `Error fetching category tree for site ${siteId}:`,
        error
      );
      throw error;
    }
  }

  private mapToCategoryDto(category: {
    id: string;
    slug: string;
    name: string;
    siteId: string;
    sourceUrl: string;
    parentId: string | null;
    level: number;
    description: string | null;
    dealCount: number;
    avgTemperature: number;
    popularBrands: string[];
    isActive: boolean;
    isSelectable: boolean;
    userCount: number;
    createdAt: Date;
    updatedAt: Date;
    parent?: { name: string; parent?: { name: string } | null } | null;
  }): LocalCategoryDto {
    return {
      id: category.id,
      slug: category.slug,
      name: category.name,
      siteId: category.siteId,
      sourceUrl: category.sourceUrl,
      parentId: category.parentId ?? undefined,
      level: category.level,
      description: category.description ?? undefined,
      dealCount: category.dealCount,
      avgTemperature: category.avgTemperature,
      popularBrands: category.popularBrands,
      isActive: category.isActive,
      userCount: category.userCount,
      displayPath: buildCategoryDisplayPath(category),
      isSelectable: isCategorySelectable(category.isSelectable, category.level, category.siteId),
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
    };
  }
}
