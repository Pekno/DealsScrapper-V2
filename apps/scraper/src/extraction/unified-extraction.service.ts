import { Injectable, Logger } from '@nestjs/common';
import type { ISiteAdapter, UniversalListing } from '../adapters/base/site-adapter.interface.js';
import type { FilterConstraints } from '../adapters/base/url-optimizer.interface.js';

/**
 * Extraction result from scraping operation.
 */
export interface ExtractionResult {
  listings: UniversalListing[];
  pageCount: number;
  totalCount: number | undefined;
  source: string;
  categorySlug: string;
}

/**
 * Extraction options.
 */
export interface ExtractionOptions {
  maxPages?: number;
  filterConstraints?: FilterConstraints;
  delayBetweenPages?: number;
}

/**
 * Unified extraction service for all sites.
 * Provides generic scraping logic that works with any ISiteAdapter.
 *
 * This service replaces site-specific extraction services with a
 * single, adapter-agnostic implementation.
 */
@Injectable()
export class UnifiedExtractionService {
  private readonly logger = new Logger(UnifiedExtractionService.name);

  /**
   * Scrapes a category using the provided adapter.
   *
   * @param adapter - Site adapter to use for extraction
   * @param categorySlug - Category identifier
   * @param html - Raw HTML content
   * @param options - Extraction options (maxPages, filters, etc.)
   * @returns Extraction result with listings
   */
  async scrapeCategoryFromHtml(
    adapter: ISiteAdapter,
    categorySlug: string,
    html: string,
    options: ExtractionOptions = {},
  ): Promise<ExtractionResult> {
    const startTime = Date.now();

    try {
      // Build source URL (for context)
      const sourceUrl = adapter.buildCategoryUrl(categorySlug, 1);

      // Optionally optimize URL with filter constraints
      const optimizedUrl = this.optimizeUrl(adapter, sourceUrl, options.filterConstraints);

      this.logger.log(
        `Extracting from ${adapter.siteId} category "${categorySlug}" (URL: ${optimizedUrl}, hasFilters: ${!!options.filterConstraints})`,
      );

      // Extract listings from HTML
      const listings = adapter.extractListings(html, optimizedUrl);

      // Extract total count if available
      const totalCount = adapter.extractElementCount(html);

      const duration = Date.now() - startTime;

      this.logger.log(
        `Extracted ${listings.length} listings from ${adapter.siteId} category "${categorySlug}" in ${duration}ms (totalCount: ${totalCount ?? 'unknown'})`,
      );

      return {
        listings,
        pageCount: 1,
        totalCount,
        source: adapter.siteId,
        categorySlug,
      };
    } catch (error) {
      const errorMessage = (error as Error).message || 'Unknown error';
      const errorStack = (error as Error).stack || 'No stack trace';

      this.logger.error(
        `Failed to extract from ${adapter.siteId} category "${categorySlug}":\n` +
        `   💥 Error: ${errorMessage}\n` +
        `   📄 HTML length: ${html?.length || 0} chars\n` +
        `   🔍 Stack: ${errorStack}`,
      );

      throw error;
    }
  }

  /**
   * Optimizes URL with filter constraints if adapter supports it.
   */
  private optimizeUrl(
    adapter: ISiteAdapter,
    baseUrl: string,
    constraints?: FilterConstraints,
  ): string {
    if (!constraints || !adapter.urlOptimizer) {
      return baseUrl;
    }

    try {
      const optimizedUrl = adapter.urlOptimizer.optimizeUrl(baseUrl, constraints);

      if (optimizedUrl !== baseUrl) {
        this.logger.log(
          `URL optimized with filter constraints for ${adapter.siteId}:\n` +
          `   📎 Original: ${baseUrl}\n` +
          `   🔗 Optimized: ${optimizedUrl}`,
        );
      }

      return optimizedUrl;
    } catch (error) {
      const errorMsg = (error as Error).message || 'Unknown error';
      this.logger.warn(
        `⚠️ Failed to optimize URL for ${adapter.siteId}, using base URL:\n` +
        `   💥 Error: ${errorMsg}\n` +
        `   🔗 URL: ${baseUrl}`,
      );
      return baseUrl;
    }
  }

  /**
   * Validates extraction result.
   * Ensures listings have required fields and proper structure.
   */
  validateExtractionResult(result: ExtractionResult): void {
    if (!result.listings || !Array.isArray(result.listings)) {
      throw new Error('Invalid extraction result: listings must be an array');
    }

    if (!result.source || !result.categorySlug) {
      throw new Error('Invalid extraction result: missing source or categorySlug');
    }

    // Validate each listing has required fields
    for (const listing of result.listings) {
      if (!listing.externalId || !listing.title || !listing.url) {
        this.logger.warn(
          `⚠️ Listing missing required fields:\n` +
          `   🆔 externalId: ${listing.externalId || 'MISSING'}\n` +
          `   📝 title: ${listing.title || 'MISSING'}\n` +
          `   🔗 url: ${listing.url || 'MISSING'}`,
        );
      }

      if (listing.siteId !== result.source) {
        this.logger.warn(
          `⚠️ Listing siteId mismatch: expected "${result.source}", got "${listing.siteId}"`,
        );
      }
    }
  }

  /**
   * Calculates extraction statistics.
   */
  calculateStatistics(result: ExtractionResult): {
    listingCount: number;
    withImages: number;
    withPrices: number;
    withDescriptions: number;
    averagePrice: number | null;
  } {
    const { listings } = result;

    const withImages = listings.filter((l) => l.imageUrl !== null).length;
    const withPrices = listings.filter((l) => l.currentPrice !== null).length;
    const withDescriptions = listings.filter((l) => l.description !== null).length;

    const prices = listings
      .map((l) => l.currentPrice)
      .filter((p): p is number => p !== null);

    const averagePrice =
      prices.length > 0
        ? prices.reduce((sum, p) => sum + p, 0) / prices.length
        : null;

    return {
      listingCount: listings.length,
      withImages,
      withPrices,
      withDescriptions,
      averagePrice,
    };
  }
}
