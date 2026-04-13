import { Injectable, Logger } from '@nestjs/common';
import * as cheerio from 'cheerio';
import type { CheerioAPI, Cheerio } from 'cheerio';
import type { Element } from 'domhandler';
import { SiteSource } from '@dealscrapper/shared-types';
import type {
  ISiteAdapter,
  UniversalListing,
  LeBonCoinData,
} from '../base/site-adapter.interface.js';
import { FieldExtractorService } from '../../field-extraction/field-extractor.service.js';
import { leboncoinFieldConfig } from './leboncoin.field-config.js';
import {
  parsePrice,
  parseLocation,
  getDepartment,
  getRegion,
} from './leboncoin.transformers.js';

/**
 * LeBonCoin scraping adapter.
 * Implements ISiteAdapter for leboncoin.fr marketplace.
 * Selectors verified with leboncoin-multimedia-catalog.html fixture (2025-01).
 */
@Injectable()
export class LeBonCoinAdapter implements ISiteAdapter {
  readonly siteId = SiteSource.LEBONCOIN;
  readonly baseUrl = 'https://www.leboncoin.fr';
  readonly displayName = 'LeBonCoin';
  readonly colorCode = '#FF6E14'; // Orange-red
  readonly urlOptimizer = undefined; // LeBonCoin doesn't support query param filtering

  private readonly logger = new Logger(LeBonCoinAdapter.name);

  constructor(private readonly fieldExtractor: FieldExtractorService) {}

  /**
   * Extracts listings from LeBonCoin HTML page.
   * Uses article[data-qa-id="aditem_container"] for listing elements.
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
        const adId = $el.attr('data-qa-id') || $el.attr('id') || 'unknown';
        const outerHtmlSnippet = $el.toString().slice(0, 200);

        this.logger.warn(
          `⚠️ Failed to extract LeBonCoin listing [${index}] (ad-id: ${adId}):\n` +
          `   💥 Error: ${errorMsg}\n` +
          `   📄 HTML snippet: ${outerHtmlSnippet}...`,
        );
      }
    });

    if (failedCount > 0) {
      this.logger.warn(`⚠️ Failed to extract ${failedCount} of ${failedCount + listings.length} LeBonCoin listings`);
    }
    this.logger.log(`✅ Extracted ${listings.length} LeBonCoin listings from ${sourceUrl}`);
    return listings;
  }

  /**
   * Extracts a single listing from LeBonCoin card element.
   */

  /**
   * Finds price text from <p> elements.
   * LeBonCoin price format: "800 €" (short text matching pattern)
   */
  private findPriceText($: CheerioAPI, $element: Cheerio<Element>): string | null {
    let priceText: string | null = null;

    $element.find('p').each((_, el) => {
      const text = $(el).text().trim();
      // Match pattern: "123 €" or "1 234 €" (with optional space)
      if (/^\d+(?:\s+\d+)*\s*€$/.test(text)) {
        priceText = text;
        return false; // Break .each() loop
      }
    });

    return priceText;
  }

  /**
   * Finds location text from <p> elements.
   * LeBonCoin location format: "Lannoy 59390" (City + 5-digit postcode)
   */
  private findLocationText($: CheerioAPI, $element: Cheerio<Element>): string | null {
    let locationText: string | null = null;

    $element.find('p').each((_, el) => {
      const text = $(el).text().trim();
      // Match pattern: "CityName 12345" (city may have hyphens and accents)
      if (/^[A-Za-zÀ-ÿ\-\s]+\s+\d{5}$/.test(text)) {
        locationText = text;
        return false; // Break .each() loop
      }
    });

    return locationText;
  }


  private extractSingleListing(
    $: CheerioAPI,
    $element: Cheerio<Element>,
    sourceUrl: string,
  ): UniversalListing | null {
    try {
      // Special handling for fields requiring custom logic
      const title = $element.attr('aria-label') || $element.find('h3').first().text().trim();
      const priceText = this.findPriceText($, $element);
      const locationText = this.findLocationText($, $element);

      // Extract all fields using declarative config
      const extracted = this.fieldExtractor.extract(
        $,
        $element,
        leboncoinFieldConfig,
        {
          siteId: this.siteId,
          siteBaseUrl: this.baseUrl,
          $element,
          sourceUrl,
        },
      );

      // Override with our specially extracted values
      if (title) {
        extracted.title = title;
      }
      if (priceText) {
        extracted.currentPrice = parsePrice(priceText);
      }
      if (locationText) {
        extracted.location = locationText;
        const parsed = parseLocation(locationText);
        if (parsed) {
          extracted.city = parsed.city;
          extracted.postcode = parsed.postcode;
          extracted.department = getDepartment(parsed.postcode);
          extracted.region = getRegion(extracted.department as string);
        }
      }

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
        originalPrice: null, // LeBonCoin doesn't have "original price"
        merchant: null, // LeBonCoin is P2P/C2C marketplace
        location: extracted.location ? String(extracted.location) : null,
        publishedAt:
          extracted.publishedAt instanceof Date
            ? extracted.publishedAt
            : new Date(),
        isActive: true,
        categorySlug,
        siteSpecificData: this.buildLeBonCoinData(extracted),
      };

      return listing;
    } catch (error) {
      const errorMsg = (error as Error).message || 'Unknown error';
      const errorStack = (error as Error).stack || '';
      this.logger.warn(
        `⚠️ Failed to extract single LeBonCoin listing:\n` +
        `   💥 Error: ${errorMsg}\n` +
        `   🔗 Source URL: ${sourceUrl}\n` +
        `   🔍 Stack: ${errorStack.split('\n').slice(0, 3).join('\n   ')}`,
      );
      return null;
    }
  }

  /**
   * Builds LeBonCoin-specific data object.
   */
  private buildLeBonCoinData(extracted: Record<string, unknown>): LeBonCoinData {
    // Parse delivery options (array or string to array)
    let deliveryOptions: string[] = [];
    if (Array.isArray(extracted.deliveryOptions)) {
      deliveryOptions = extracted.deliveryOptions;
    } else if (typeof extracted.deliveryOptions === 'string') {
      deliveryOptions = extracted.deliveryOptions
        .split(',')
        .map((opt) => opt.trim())
        .filter((opt) => opt.length > 0);
    }

    return {
      type: SiteSource.LEBONCOIN,
      city: extracted.city ? String(extracted.city) : null,
      postcode: extracted.postcode ? String(extracted.postcode) : null,
      department: extracted.department ? String(extracted.department) : null,
      region: extracted.region ? String(extracted.region) : null,
      proSeller:
        typeof extracted.proSeller === 'boolean' ? extracted.proSeller : false,
      sellerName: extracted.sellerName ? String(extracted.sellerName) : null,
      urgentFlag:
        typeof extracted.urgentFlag === 'boolean' ? extracted.urgentFlag : false,
      topAnnonce:
        typeof extracted.topAnnonce === 'boolean' ? extracted.topAnnonce : false,
      deliveryOptions,
      shippingCost:
        typeof extracted.shippingCost === 'number' ? extracted.shippingCost : null,
      condition: extracted.condition ? String(extracted.condition) : null,
      attributes: extracted.attributes || null,
    };
  }

  /**
   * Builds category URL for scraping.
   * LeBonCoin URL pattern: /recherche?category={slug}&page={page}
   */
  buildCategoryUrl(categorySlug: string, page: number = 1): string {
    return `${this.baseUrl}/recherche?category=${categorySlug}&page=${page}`;
  }

  /**
   * Extracts category slug from LeBonCoin URL.
   * Handles patterns: ?category=X, /ad/{category}/{id}, /recherche?category=X
   */
  extractCategorySlug(url: string): string {
    // Try query param pattern first: ?category=15
    const queryMatch = url.match(/[?&]category=([^&]+)/);
    if (queryMatch) {
      return queryMatch[1];
    }

    // Try path pattern: /ad/{category}/{id}
    const pathMatch = url.match(/\/ad\/([^/]+)\/\d+/);
    if (pathMatch) {
      return pathMatch[1];
    }

    // Try search path: /recherche?category=...
    const searchMatch = url.match(/category=([^&]+)/);
    if (searchMatch) {
      return searchMatch[1];
    }

    // Default fallback
    this.logger.warn(`Cannot extract category from URL: ${url}, using 'unknown'`);
    return 'unknown';
  }

  /**
   * Extracts total element count from LeBonCoin listing page.
   * Note: LeBonCoin doesn't display visible count text on catalog pages.
   */
  extractElementCount(html: string): number | undefined {
    const $ = cheerio.load(html);

    // LeBonCoin doesn't show count text visibly - try common patterns
    const selectors = ['.ad-count', '[data-ad-count]', '.results-count'];

    for (const selector of selectors) {
      const countText = $(selector).text();
      const match = countText.match(/(\d+)\s+annonces?/i);
      if (match) {
        return parseInt(match[1], 10);
      }
    }

    return undefined;
  }

  /**
   * Returns CSS selector for LeBonCoin listing elements.
   * Verified with leboncoin-multimedia-catalog.html fixture.
   */
  getListingSelector(): string {
    // LeBonCoin uses <article> elements with data-qa-id="aditem_container"
    return 'article[data-qa-id="aditem_container"]';
  }

  /**
   * Validates that HTML contains expected LeBonCoin structure.
   */
  validateHtml(html: string): void {
    if (!html || html.trim().length === 0) {
      throw new Error('Empty HTML content');
    }

    // Check for LeBonCoin-specific structure
    const hasArticles = html.includes('<article');
    const hasLeBonCoinDomain =
      html.includes('leboncoin') ||
      html.includes('img.leboncoin.fr');

    if (!hasArticles) {
      throw new Error('Invalid LeBonCoin HTML: No <article> elements found');
    }

    if (!hasLeBonCoinDomain) {
      this.logger.warn('HTML may not be from LeBonCoin (domain check failed)');
    }
  }
}
