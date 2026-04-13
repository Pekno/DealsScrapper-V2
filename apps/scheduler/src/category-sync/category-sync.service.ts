import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '@dealscrapper/database';
import { extractErrorMessage } from '@dealscrapper/shared';
import { SiteSource } from '@dealscrapper/shared-types';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

/**
 * Metadata for a single category discovered from a site
 * Copied from scraper for type-only usage (avoids cross-module import)
 */
interface CategoryMetadata {
  slug: string;
  name: string;
  url: string;
  parentId: string | null; // Parent's slug during discovery, resolved to ID when saving
}

/**
 * Category sync service - orchestrates daily category discovery across all sites
 *
 * Responsibilities:
 * - Schedule daily category synchronization (3 AM)
 * - Coordinate category discovery adapters for all sites
 * - Upsert categories in database (preserve existing data)
 * - Handle errors gracefully without crashing scheduler
 *
 * Architecture:
 * - Scheduler service calls scraper service via HTTP to trigger discovery
 * - Scraper service runs discovery adapters and returns category metadata
 * - Scheduler upserts categories in database
 *
 * This follows the microservices pattern where scheduler orchestrates
 * but scraper owns the discovery logic
 */
@Injectable()
export class CategorySyncService {
  private readonly logger = new Logger(CategorySyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly httpService: HttpService
  ) {}

  /**
   * Daily category synchronization - runs at 3 AM
   * Syncs all 3 sites in parallel
   */
  @Cron('0 3 * * *')
  async syncAllCategories(): Promise<void> {
    this.logger.log('⏰ Starting daily category synchronization for all sites');

    try {
      // Get all sites from SiteSource enum for consistency
      const sites = Object.values(SiteSource);

      // Sync all sites in parallel for efficiency
      const results = await Promise.allSettled(
        sites.map(site => this.syncSiteCategories(site))
      );

      // Log results
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          this.logger.log(`${sites[index]} sync completed`);
        } else {
          this.logger.error(
            `${sites[index]} sync failed: ${result.reason}`
          );
        }
      });

      this.logger.log('✅ Daily category synchronization completed');
    } catch (error) {
      const errorMessage = extractErrorMessage(error);
      this.logger.error(
        `❌ Daily category synchronization failed: ${errorMessage}`
      );
      // Don't throw - we don't want to crash the scheduler
    }
  }

  /**
   * Sync categories for a specific site
   *
   * @param siteId - Site identifier (dealabs, vinted, leboncoin)
   */
  async syncSiteCategories(siteId: string): Promise<void> {
    const startTime = Date.now();

    try {
      this.logger.log(`🔄 Syncing categories for ${siteId}...`);

      // Call scraper service to discover categories
      // Note: In production, scraper service should expose an HTTP endpoint for discovery
      // For now, we'll handle discovery directly via database upsert logic
      const discovered = await this.discoverCategoriesFromScraper(siteId);

      // Upsert categories in database
      for (const catMeta of discovered) {
        await this.upsertCategory(siteId, catMeta);
      }

      const duration = Date.now() - startTime;
      this.logger.log(
        `✅ Synced ${discovered.length} categories for ${siteId} in ${duration}ms`
      );
    } catch (error) {
      const errorMessage = extractErrorMessage(error);
      const duration = Date.now() - startTime;
      this.logger.error(
        `❌ Failed to sync categories for ${siteId} after ${duration}ms: ${errorMessage}`
      );
      throw error;
    }
  }

  /**
   * Manual trigger for category sync (for admin/testing purposes)
   *
   * @param siteId - Optional site ID to sync specific site only
   */
  async triggerManualSync(siteId?: string): Promise<{
    success: boolean;
    message: string;
    categoriesCount?: number;
  }> {
    try {
      if (siteId) {
        await this.syncSiteCategories(siteId);
        const count = await this.prisma.category.count({
          where: { siteId },
        });
        return {
          success: true,
          message: `Successfully synced categories for ${siteId}`,
          categoriesCount: count,
        };
      } else {
        await this.syncAllCategories();
        const count = await this.prisma.category.count();
        return {
          success: true,
          message: 'Successfully synced categories for all sites',
          categoriesCount: count,
        };
      }
    } catch (error) {
      const errorMessage = extractErrorMessage(error);
      return {
        success: false,
        message: `Failed to sync categories: ${errorMessage}`,
      };
    }
  }

  /**
   * Discover categories from scraper service
   *
   * NOTE: Category discovery is currently handled by the CategoryDiscoveryOrchestrator
   * via the consolidated job queue. This method returns an empty array as the actual
   * discovery is performed asynchronously by scraper workers processing discovery jobs.
   *
   * When the scraper service exposes a synchronous HTTP endpoint for category discovery:
   * GET http://scraper:3002/api/category-discovery/{siteId}
   * This method can be updated to call that endpoint directly.
   *
   * @param siteId - The site to discover categories from
   * @returns Empty array (discovery is async via job queue)
   */
  private async discoverCategoriesFromScraper(
    siteId: string
  ): Promise<CategoryMetadata[]> {
    try {
      // Category discovery is handled asynchronously via CategoryDiscoveryOrchestrator
      // This placeholder allows the sync method to complete without error
      // Real category data comes from discovery jobs processed by scraper workers
      this.logger.debug(
        `Category sync for ${siteId}: using existing categories (async discovery via job queue)`
      );
      return [];
    } catch (error) {
      const errorMessage = extractErrorMessage(error);
      this.logger.error(
        `Failed to discover categories from scraper for ${siteId}: ${errorMessage}`
      );
      return [];
    }
  }

  /**
   * Upsert a single category in the database
   *
   * Uses composite key [siteId, sourceUrl] for matching
   * Preserves existing data (deal counts, user counts, etc.)
   */
  private async upsertCategory(
    siteId: string,
    catMeta: CategoryMetadata
  ): Promise<void> {
    try {
      // Find parent category if parentId (holds slug during discovery) is provided
      let resolvedParentId: string | null = null;
      if (catMeta.parentId) {
        const parent = await this.prisma.category.findFirst({
          where: {
            siteId,
            slug: catMeta.parentId, // parentId holds parent's slug during discovery
          },
        });
        if (parent) {
          resolvedParentId = parent.id;
        }
      }

      // Determine level based on parent
      const level = catMeta.parentId ? 2 : 1;

      // Upsert category
      await this.prisma.category.upsert({
        where: {
          siteId_sourceUrl: { siteId, sourceUrl: catMeta.url },
        },
        create: {
          slug: catMeta.slug,
          name: catMeta.name,
          siteId,
          sourceUrl: catMeta.url,
          parentId: resolvedParentId,
          level,
          isActive: true,
          dealCount: 0,
          avgTemperature: 0,
          popularBrands: [],
          userCount: 0,
        },
        update: {
          name: catMeta.name,
          slug: catMeta.slug,
          parentId: resolvedParentId,
          level,
          updatedAt: new Date(),
          // Note: We DON'T update dealCount, userCount, popularBrands
          // These are preserved from existing data
        },
      });
    } catch (error) {
      const errorMessage = extractErrorMessage(error);
      this.logger.error(
        `❌ Failed to upsert category ${catMeta.slug} for ${siteId}: ${errorMessage}`
      );
      throw error;
    }
  }

  /**
   * Get sync status for monitoring
   */
  async getSyncStatus(): Promise<{
    lastSync: Date | null;
    categoriesBySite: Record<string, number>;
    totalCategories: number;
  }> {
    try {
      // Get category counts by siteId
      const categoryCounts = await this.prisma.category.groupBy({
        by: ['siteId'],
        _count: {
          id: true,
        },
        where: {
          isActive: true,
        },
      });

      const categoriesBySite: Record<string, number> = {};
      categoryCounts.forEach((count) => {
        categoriesBySite[count.siteId] = count._count.id;
      });

      const totalCategories = await this.prisma.category.count({
        where: { isActive: true },
      });

      // Get last updated category as proxy for last sync time
      const lastUpdated = await this.prisma.category.findFirst({
        orderBy: { updatedAt: 'desc' },
      });

      return {
        lastSync: lastUpdated?.updatedAt ?? null,
        categoriesBySite,
        totalCategories,
      };
    } catch (error) {
      const errorMessage = extractErrorMessage(error);
      this.logger.error(
        `❌ Failed to get sync status: ${errorMessage}`
      );
      return {
        lastSync: null,
        categoriesBySite: {},
        totalCategories: 0,
      };
    }
  }
}
