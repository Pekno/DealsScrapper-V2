import { Injectable, Logger } from '@nestjs/common';
import { SiteSource } from '@dealscrapper/shared-types';
import { ICategoryDiscoveryAdapter } from './base/category-discovery-adapter.interface.js';
import { DealabsCategoryDiscoveryAdapter } from './dealabs/dealabs-category-discovery.adapter.js';
import { VintedCategoryDiscoveryAdapter } from './vinted/vinted-category-discovery.adapter.js';
import { LeBonCoinCategoryDiscoveryAdapter } from './leboncoin/leboncoin-category-discovery.adapter.js';

/**
 * Registry for site-specific category discovery adapters
 * Provides factory method to get the appropriate adapter based on siteId
 */
@Injectable()
export class CategoryDiscoveryAdapterRegistry {
  private readonly logger = new Logger(CategoryDiscoveryAdapterRegistry.name);
  private readonly adapters: Map<string, ICategoryDiscoveryAdapter>;

  constructor(
    private readonly dealabsAdapter: DealabsCategoryDiscoveryAdapter,
    private readonly vintedAdapter: VintedCategoryDiscoveryAdapter,
    private readonly leboncoinAdapter: LeBonCoinCategoryDiscoveryAdapter
  ) {
    this.adapters = new Map<string, ICategoryDiscoveryAdapter>();
    this.adapters.set(SiteSource.DEALABS, this.dealabsAdapter);
    this.adapters.set(SiteSource.VINTED, this.vintedAdapter);
    this.adapters.set(SiteSource.LEBONCOIN, this.leboncoinAdapter);

    this.logger.log(
      `📦 Registered ${this.adapters.size} category discovery adapters: ${[...this.adapters.keys()].join(', ')}`
    );
  }

  /**
   * Get the adapter for a specific site
   * @param siteId - Site identifier (dealabs, vinted, leboncoin)
   * @returns The appropriate adapter or null if not found
   */
  getAdapter(siteId: string): ICategoryDiscoveryAdapter | null {
    const adapter = this.adapters.get(siteId);
    if (!adapter) {
      this.logger.warn(`⚠️ No adapter found for site: ${siteId}`);
      return null;
    }
    return adapter;
  }

  /**
   * Get all registered adapters
   * @returns Array of all adapters
   */
  getAllAdapters(): ICategoryDiscoveryAdapter[] {
    return [...this.adapters.values()];
  }

  /**
   * Get all supported site IDs
   * @returns Array of site IDs
   */
  getSupportedSites(): string[] {
    return [...this.adapters.keys()];
  }

  /**
   * Check if a site is supported
   * @param siteId - Site identifier to check
   * @returns true if adapter exists for the site
   */
  isSupported(siteId: string): boolean {
    return this.adapters.has(siteId);
  }
}
