import { Injectable, Logger } from '@nestjs/common';
import * as cheerio from 'cheerio';
import type { CheerioAPI, Cheerio } from 'cheerio';
import type { Element } from 'domhandler';
import { SiteSource } from '@dealscrapper/shared-types';
import type {
  ISiteAdapter,
  UniversalListing,
  VintedData,
} from '../base/site-adapter.interface.js';
import { FieldExtractorService } from '../../field-extraction/field-extractor.service.js';
import { vintedFieldConfig } from './vinted.field-config.js';

/**
 * Vinted scraping adapter.
 * Implements ISiteAdapter for vinted.fr marketplace.
 *
 * Updated with real HTML selectors in Phase 5 (2025-01-19).
 */
@Injectable()
export class VintedAdapter implements ISiteAdapter {
  readonly siteId = SiteSource.VINTED;
  readonly baseUrl = 'https://www.vinted.fr';
  readonly displayName = 'Vinted';
  readonly colorCode = '#09B1BA'; // Teal
  readonly urlOptimizer = undefined; // Vinted doesn't support URL filter optimization (uses API-driven search)

  private readonly logger = new Logger(VintedAdapter.name);

  constructor(private readonly fieldExtractor: FieldExtractorService) {}

  /**
   * Extracts listings from Vinted HTML page.
   * Selectors verified with vinted-women-catalog.html fixture (2025-01).
   */
  extractListings(html: string, sourceUrl: string): UniversalListing[] {
    this.validateHtml(html);

    const $ = cheerio.load(html);
    const selector = this.getListingSelector();

    const listings: UniversalListing[] = [];
    let failedCount = 0;

    $(selector).each((index, element) => {
      try {
        const listing = this.extractSingleListing($, $(element) as Cheerio<Element>, sourceUrl);
        if (listing) {
          listings.push(listing);
        }
      } catch (error) {
        failedCount++;
        const errorMsg = (error as Error).message || 'Unknown error';
        const $el = $(element);
        const itemId = $el.attr('data-product-item-id') || $el.attr('id') || 'unknown';
        const outerHtmlSnippet = $el.toString().slice(0, 200);

        this.logger.warn(
          `⚠️ Failed to extract Vinted listing [${index}] (item-id: ${itemId}):\n` +
          `   💥 Error: ${errorMsg}\n` +
          `   📄 HTML snippet: ${outerHtmlSnippet}...`,
        );
      }
    });

    if (failedCount > 0) {
      this.logger.warn(`⚠️ Failed to extract ${failedCount} of ${failedCount + listings.length} Vinted listings`);
    }
    this.logger.log(`✅ Extracted ${listings.length} Vinted listings from ${sourceUrl}`);
    return listings;
  }

  /**
   * Extracts a single listing from Vinted card element.
   */
  private extractSingleListing(
    $: CheerioAPI,
    $element: Cheerio<Element>,
    sourceUrl: string,
  ): UniversalListing | null {
    try {
      // Extract all fields using declarative config
      const extracted = this.fieldExtractor.extract($, $element, vintedFieldConfig, {
        siteId: this.siteId,
        siteBaseUrl: this.baseUrl,
        $element,
        sourceUrl,
      });

      // Validate required fields
      if (!extracted.externalId || !extracted.title || !extracted.url) {
        throw new Error('Missing required fields (externalId, title, or url)');
      }

      // Extract category slug from source URL
      const categorySlug = this.extractCategorySlug(sourceUrl);

      // Build universal listing
      const listing: UniversalListing = {
        externalId: String(extracted.externalId),
        title: String(extracted.title),
        description: extracted.description ? String(extracted.description) : null,
        url: String(extracted.url),
        imageUrl: extracted.imageUrl ? String(extracted.imageUrl) : null,
        siteId: this.siteId,
        currentPrice:
          typeof extracted.currentPrice === 'number' ? extracted.currentPrice : null,
        originalPrice: null, // Vinted doesn't have "original price" (secondhand)
        merchant: null, // Vinted is P2P marketplace
        location: extracted.location ? String(extracted.location) : null,
        publishedAt:
          extracted.publishedAt instanceof Date
            ? extracted.publishedAt
            : new Date(),
        isActive: true,
        categorySlug,
        siteSpecificData: this.buildVintedData(extracted),
      };

      return listing;
    } catch (error) {
      const errorMsg = (error as Error).message || 'Unknown error';
      const errorStack = (error as Error).stack || '';
      this.logger.warn(
        `⚠️ Failed to extract single Vinted listing:\n` +
        `   💥 Error: ${errorMsg}\n` +
        `   🔗 Source URL: ${sourceUrl}\n` +
        `   🔍 Stack: ${errorStack.split('\n').slice(0, 3).join('\n   ')}`,
      );
      return null;
    }
  }

  /**
   * Builds Vinted-specific data object.
   */
  private buildVintedData(extracted: Record<string, unknown>): VintedData {
    return {
      type: SiteSource.VINTED,
      favoriteCount:
        typeof extracted.favoriteCount === 'number' ? extracted.favoriteCount : 0,
      viewCount:
        typeof extracted.viewCount === 'number' ? extracted.viewCount : 0,
      itemCondition:
        typeof extracted.itemCondition === 'string'
          ? extracted.itemCondition
          : 'unknown',
      brand: extracted.brand ? String(extracted.brand) : null,
      size: extracted.size ? String(extracted.size) : null,
      color: extracted.color ? String(extracted.color) : null,
      sellerRating:
        typeof extracted.sellerRating === 'number' ? extracted.sellerRating : null,
      sellerName: extracted.sellerName ? String(extracted.sellerName) : null,
    };
  }

  /**
   * Builds category URL for scraping.
   * Vinted URL pattern: /catalog/{baseSlug}?page={page}&order=newest_first
   *
   * Category slugs may be hierarchical (e.g., "loisirs-et-collections/4880-uncut-card-sheets").
   * Only the last segment is the actual Vinted catalog identifier.
   */
  buildCategoryUrl(categorySlug: string, page: number = 1): string {
    // Extract the last segment from hierarchical slugs (e.g., "femmes/4-clothing" → "4-clothing")
    const parts = categorySlug.split('/');
    const baseSlug = parts[parts.length - 1];
    return `${this.baseUrl}/catalog/${baseSlug}?page=${page}&order=newest_first`;
  }

  /**
   * Extracts category slug from Vinted URL.
   * Examples:
   * - "?catalog[]=1904" → "1904"
   * - "?catalog[]=loisirs-et-collections/4880-uncut-card-sheets" → "loisirs-et-collections/4880-uncut-card-sheets"
   * - "/catalog/1904-women" → "1904-women"
   * - "/catalog/13-jumpers-and-sweaters" → "13-jumpers-and-sweaters"
   */
  extractCategorySlug(url: string): string {
    // Try query parameter: catalog[]=<slug> (numeric or text-based)
    const queryMatch = url.match(/catalog\[\]=([^&]+)/);
    if (queryMatch) {
      return decodeURIComponent(queryMatch[1]);
    }

    // Try path pattern: /catalog/{id}-{slug} or /catalog/{id}
    const pathMatch = url.match(/\/catalog\/([^/?]+)/);
    if (pathMatch) {
      return pathMatch[1];
    }

    this.logger.warn(
      `Cannot extract category slug from URL: ${url}, using default`,
    );
    return 'unknown';
  }

  /**
   * Extracts total element count from Vinted listing page.
   * Note: Vinted doesn't display total count in catalog view.
   */
  extractElementCount(html: string): number | undefined {
    const $ = cheerio.load(html);

    // Try various selectors for result count
    const selectors = [
      '.item-count',
      '[data-item-count]',
      '.results-count',
      '[data-testid*="results-count"]',
    ];

    for (const selector of selectors) {
      const countText = $(selector).text();
      const match = countText.match(/(\d+)\s+résultats?/i);
      if (match) {
        return parseInt(match[1], 10);
      }
    }

    // Fallback: count .feed-grid__item elements
    const itemCount = $('.feed-grid__item').length;
    return itemCount > 0 ? itemCount : undefined;
  }

  /**
   * Returns CSS selector for Vinted listing elements.
   * Verified with real vinted.fr HTML (2025-01-19).
   */
  getListingSelector(): string {
    return '.feed-grid__item';
  }

  /**
   * Validates that HTML contains expected Vinted structure.
   */
  validateHtml(html: string): void {
    if (!html || html.trim().length === 0) {
      throw new Error('Empty HTML content');
    }

    // Check for Vinted-specific markers (verified from fixture)
    const hasVintedContent =
      html.includes('feed-grid__item') ||
      html.includes('new-item-box') ||
      html.includes('data-testid="item-') ||
      html.includes('vinted.net');

    if (!hasVintedContent) {
      throw new Error(
        'Invalid Vinted HTML structure - missing feed-grid or item markers'
      );
    }
  }
}
