import { Injectable, Logger } from '@nestjs/common';
import { SiteSource } from '@dealscrapper/shared-types';
import type { ISiteAdapter } from './base/site-adapter.interface.js';
import { DealabsAdapter } from './dealabs/dealabs.adapter.js';
import { VintedAdapter } from './vinted/vinted.adapter.js';
import { LeBonCoinAdapter } from './leboncoin/leboncoin.adapter.js';

/**
 * Site metadata for frontend display.
 */
export interface SiteMetadata {
  id: SiteSource;
  name: string;
  color: string;
  baseUrl: string;
  supportsUrlOptimization: boolean;
}

/**
 * Adapter registry using factory pattern.
 * Provides centralized access to all site adapters.
 */
@Injectable()
export class AdapterRegistry {
  private readonly adapters = new Map<SiteSource, ISiteAdapter>();
  private readonly logger = new Logger(AdapterRegistry.name);

  constructor(
    private readonly dealabsAdapter: DealabsAdapter,
    private readonly vintedAdapter: VintedAdapter,
    private readonly leboncoinAdapter: LeBonCoinAdapter,
  ) {
    this.register(dealabsAdapter);
    this.register(vintedAdapter);
    this.register(leboncoinAdapter);

    this.logger.log(
      `Registered ${this.adapters.size} site adapters: ${Array.from(this.adapters.keys()).join(', ')}`,
    );
  }

  /**
   * Registers a site adapter.
   */
  private register(adapter: ISiteAdapter): void {
    if (this.adapters.has(adapter.siteId)) {
      this.logger.warn(`Adapter for ${adapter.siteId} already registered`);
      return;
    }

    this.adapters.set(adapter.siteId, adapter);
    this.logger.log(`Registered adapter: ${adapter.siteId} (${adapter.displayName})`);
  }

  /**
   * Gets adapter by site ID.
   * @throws Error if adapter not found
   */
  getAdapter(siteId: SiteSource): ISiteAdapter {
    const adapter = this.adapters.get(siteId);

    if (!adapter) {
      throw new Error(
        `No adapter registered for site: ${siteId}. Available: ${Array.from(this.adapters.keys()).join(', ')}`,
      );
    }

    return adapter;
  }

  /**
   * Gets all registered adapters.
   */
  getAllAdapters(): ISiteAdapter[] {
    return Array.from(this.adapters.values());
  }

  /**
   * Gets all site sources.
   */
  getAllSiteIds(): SiteSource[] {
    return Array.from(this.adapters.keys());
  }

  /**
   * Checks if adapter exists for site.
   */
  hasAdapter(siteId: SiteSource): boolean {
    return this.adapters.has(siteId);
  }

  /**
   * Gets site metadata for frontend.
   * Returns basic site info (id, name, color) for UI rendering.
   */
  getSiteMetadata(): SiteMetadata[] {
    return this.getAllAdapters().map((adapter) => this.adapterToMetadata(adapter));
  }

  /**
   * Gets single site metadata by ID.
   */
  getSiteMetadataById(siteId: SiteSource): SiteMetadata {
    const adapter = this.getAdapter(siteId);
    return this.adapterToMetadata(adapter);
  }

  /**
   * Converts adapter to site metadata.
   */
  private adapterToMetadata(adapter: ISiteAdapter): SiteMetadata {
    return {
      id: adapter.siteId,
      name: adapter.displayName,
      color: adapter.colorCode,
      baseUrl: adapter.baseUrl,
      supportsUrlOptimization: adapter.urlOptimizer !== undefined,
    };
  }
}
