import { Injectable, Logger } from '@nestjs/common';
import * as cheerio from 'cheerio';
import type { CheerioAPI, Cheerio } from 'cheerio';
import type { Element } from 'domhandler';
import { SiteSource } from '@dealscrapper/shared-types';
import type {
  ISiteAdapter,
  UniversalListing,
  DealabsData,
} from '../base/site-adapter.interface.js';
import type { IUrlOptimizer } from '../base/url-optimizer.interface.js';
import type { IExpiryResolver } from '../base/expiry-resolver.interface.js';
import { DealabsUrlOptimizer } from './dealabs-url-optimizer.js';
import { DealabsExpiryResolver } from './dealabs-expiry-resolver.js';
import { FieldExtractorService } from '../../field-extraction/field-extractor.service.js';
import { dealabsFieldConfig } from './dealabs.field-config.js';

@Injectable()
export class DealabsAdapter implements ISiteAdapter {
  readonly siteId = SiteSource.DEALABS;
  readonly baseUrl = 'https://www.dealabs.com';
  readonly displayName = 'Dealabs';
  readonly colorCode = '#FF6B35'; // Orange
  readonly urlOptimizer: IUrlOptimizer;
  readonly expiryResolver: IExpiryResolver;

  private readonly logger = new Logger(DealabsAdapter.name);

  constructor(
    private readonly fieldExtractor: FieldExtractorService,
    dealabsUrlOptimizer: DealabsUrlOptimizer,
    dealabsExpiryResolver: DealabsExpiryResolver,
  ) {
    this.urlOptimizer = dealabsUrlOptimizer;
    this.expiryResolver = dealabsExpiryResolver;
  }

  /**
   * Extracts listings from Dealabs HTML page.
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
        const threadId = $el.attr('data-thread-id') || 'unknown';
        const outerHtmlSnippet = $el.toString().slice(0, 200);

        this.logger.warn(
          `⚠️ Failed to extract Dealabs listing [${index}] (thread-id: ${threadId}):\n` +
          `   💥 Error: ${errorMsg}\n` +
          `   📄 HTML snippet: ${outerHtmlSnippet}...`,
        );
      }
    });

    if (failedCount > 0) {
      this.logger.warn(`⚠️ Failed to extract ${failedCount} of ${failedCount + listings.length} Dealabs listings`);
    }
    this.logger.log(`✅ Extracted ${listings.length} Dealabs listings from ${sourceUrl}`);
    return listings;
  }

  /**
   * Extracts a single listing from Dealabs card element.
   */
  private extractSingleListing(
    $: CheerioAPI,
    $element: Cheerio<Element>,
    sourceUrl: string,
  ): UniversalListing | null {
    try {
      // Extract all fields using declarative config
      const extracted = this.fieldExtractor.extract($, $element, dealabsFieldConfig, {
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
        originalPrice:
          typeof extracted.originalPrice === 'number'
            ? extracted.originalPrice
            : null,
        merchant: extracted.merchant ? String(extracted.merchant) : null,
        location: null, // Dealabs doesn't display location
        publishedAt:
          extracted.publishedAt instanceof Date
            ? extracted.publishedAt
            : new Date(),
        isActive: true,
        categorySlug,
        siteSpecificData: this.buildDealabsData(extracted),
      };

      return listing;
    } catch (error) {
      const errorMsg = (error as Error).message || 'Unknown error';
      const errorStack = (error as Error).stack || '';
      this.logger.warn(
        `⚠️ Failed to extract single Dealabs listing:\n` +
        `   💥 Error: ${errorMsg}\n` +
        `   🔗 Source URL: ${sourceUrl}\n` +
        `   🔍 Stack: ${errorStack.split('\n').slice(0, 3).join('\n   ')}`,
      );
      return null;
    }
  }

  /**
   * Builds Dealabs-specific data object.
   */
  private buildDealabsData(extracted: Record<string, unknown>): DealabsData {
    return {
      type: SiteSource.DEALABS,
      temperature:
        typeof extracted.temperature === 'number' ? extracted.temperature : 0,
      commentCount:
        typeof extracted.commentCount === 'number' ? extracted.commentCount : 0,
      communityVerified:
        typeof extracted.communityVerified === 'boolean'
          ? extracted.communityVerified
          : false,
      freeShipping:
        typeof extracted.freeShipping === 'boolean'
          ? extracted.freeShipping
          : false,
      isCoupon:
        typeof extracted.isCoupon === 'boolean' ? extracted.isCoupon : false,
      discountPercentage:
        typeof extracted.discountPercentage === 'number'
          ? extracted.discountPercentage
          : null,
      expiresAt:
        extracted.expiresAt instanceof Date ? extracted.expiresAt : null,
    };
  }

  /**
   * Builds category URL for scraping.
   */
  buildCategoryUrl(categorySlug: string, page: number = 1): string {
    // Handle hub categories
    if (categorySlug.startsWith('hub-')) {
      const hubSlug = categorySlug.replace('hub-', '');
      return `${this.baseUrl}/groupe/hub/${hubSlug}?page=${page}`;
    }

    // Regular category
    return `${this.baseUrl}/groupe/${categorySlug}?page=${page}`;
  }

  /**
   * Extracts category slug from Dealabs URL.
   */
  extractCategorySlug(url: string): string {
    // Match hub categories: /groupe/hub/category-name
    const hubMatch = url.match(/\/groupe\/hub\/([^/?]+)/);
    if (hubMatch) {
      return `hub-${hubMatch[1]}`;
    }

    // Match regular categories: /groupe/category-name
    const categoryMatch = url.match(/\/groupe\/([^/?]+)/);
    if (categoryMatch) {
      return categoryMatch[1];
    }

    throw new Error(`Cannot extract category slug from URL: ${url}`);
  }

  /**
   * Extracts total element count from Dealabs listing page.
   */
  extractElementCount(html: string): number | undefined {
    const $ = cheerio.load(html);

    // Try multiple selectors for element count
    const selectors = [
      '.threadGrid-headerMeta',
      '.thread-count',
      '[data-count]',
    ];

    for (const selector of selectors) {
      const countText = $(selector).text();
      const match = countText.match(/(\d+)\s+deals?/i);
      if (match) {
        return parseInt(match[1], 10);
      }
    }

    return undefined;
  }

  /**
   * Returns CSS selector for Dealabs listing elements.
   */
  getListingSelector(): string {
    return 'article.thread, article[data-thread-id], article[id^="thread_"]';
  }

  /**
   * Validates that HTML contains expected Dealabs structure.
   */
  validateHtml(html: string): void {
    if (!html || html.trim().length === 0) {
      throw new Error('Empty HTML content');
    }

    // Check for Dealabs-specific markers (multiple patterns for flexibility)
    const hasThreadContent =
      html.includes('cept-thread-item') ||
      html.includes('thread-listingContent') ||
      html.includes('threadGrid') ||
      html.includes('data-thread-id') ||
      html.includes('id="thread_') ||
      html.includes('class="thread ') ||
      html.includes("class='thread '") ||
      html.includes('thread--type-list') ||
      html.includes('thread--deal');

    if (!hasThreadContent) {
      throw new Error('Invalid Dealabs HTML structure - missing thread markers');
    }
  }
}
