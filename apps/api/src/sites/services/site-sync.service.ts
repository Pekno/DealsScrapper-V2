import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '@dealscrapper/database';
import { SITE_DEFINITIONS } from '../definitions/site.definitions.js';
import { createServiceLogger } from '@dealscrapper/shared-logging';
import { apiLogConfig } from '../../config/logging.config.js';

/**
 * Site Sync Service
 *
 * Automatically syncs site definitions from code to the database on API startup.
 * - Upserts all defined sites
 * - Deactivates sites that exist in DB but are removed from code definitions
 * - Never deletes sites to preserve data integrity (foreign key references)
 */
@Injectable()
export class SiteSyncService implements OnModuleInit {
  private readonly logger = createServiceLogger(apiLogConfig);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lifecycle hook - sync sites on module initialization
   */
  async onModuleInit(): Promise<void> {
    await this.syncSites();
  }

  /**
   * Sync site definitions from code to database
   *
   * This method:
   * 1. Upserts all sites defined in SITE_DEFINITIONS
   * 2. Deactivates sites in DB that are not in code definitions
   */
  async syncSites(): Promise<void> {
    this.logger.log('Syncing site definitions to database...');

    const definedSiteIds = Object.keys(SITE_DEFINITIONS);

    try {
      // Upsert all defined sites
      for (const [id, definition] of Object.entries(SITE_DEFINITIONS)) {
        await this.prisma.site.upsert({
          where: { id },
          create: {
            id,
            name: definition.name,
            baseUrl: definition.baseUrl,
            categoryDiscoveryUrl: definition.categoryDiscoveryUrl,
            color: definition.color,
            iconUrl: definition.iconUrl ?? null,
            isActive: true,
          },
          update: {
            name: definition.name,
            baseUrl: definition.baseUrl,
            categoryDiscoveryUrl: definition.categoryDiscoveryUrl,
            color: definition.color,
            iconUrl: definition.iconUrl ?? null,
            // Re-activate if it was previously deactivated and now added back
            isActive: true,
          },
        });

        this.logger.debug(`Synced site: ${id} (${definition.name})`);
      }

      // Deactivate sites that exist in DB but not in code definitions
      // We don't delete to preserve data integrity (foreign key references)
      const deactivateResult = await this.prisma.site.updateMany({
        where: {
          id: { notIn: definedSiteIds },
          isActive: true, // Only update if currently active
        },
        data: { isActive: false },
      });

      if (deactivateResult.count > 0) {
        this.logger.warn(
          `Deactivated ${deactivateResult.count} site(s) not in code definitions`
        );
      }

      this.logger.log(
        `Site sync completed: ${definedSiteIds.length} sites synced`
      );
    } catch (error) {
      this.logger.error('Failed to sync sites to database', error);
      throw error;
    }
  }

  /**
   * Force re-sync sites (useful for testing or manual refresh)
   */
  async forceSync(): Promise<void> {
    this.logger.log('Force re-syncing site definitions...');
    await this.syncSites();
  }
}
