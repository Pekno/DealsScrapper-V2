import { Injectable } from '@nestjs/common';
import * as cheerio from 'cheerio';
import type { CheerioAPI, Cheerio } from 'cheerio';
import type { Element } from 'domhandler';
import { SiteSource } from '@dealscrapper/shared-types';
import type {
  ISiteAdapter,
  UniversalListing,
} from '../base/site-adapter.interface.js';
import type { IUrlOptimizer } from '../base/url-optimizer.interface.js';
import type { IExpiryResolver } from '../base/expiry-resolver.interface.js';
import { DealabsUrlOptimizer } from './dealabs-url-optimizer.js';
import { DealabsExpiryResolver } from './dealabs-expiry-resolver.js';
import { createServiceLogger } from '@dealscrapper/shared-logging';
import { scraperLogConfig } from '../../config/logging.config.js';
import { LlmExtractionService } from '../../llm-extraction/llm-extraction.service.js';

@Injectable()
export class DealabsAdapter implements ISiteAdapter {
  readonly siteId = SiteSource.DEALABS;
  readonly baseUrl = 'https://www.dealabs.com';
  readonly displayName = 'Dealabs';
  readonly colorCode = '#FF6B35'; // Orange
  readonly urlOptimizer: IUrlOptimizer;
  readonly expiryResolver: IExpiryResolver;

  private readonly logger = createServiceLogger(scraperLogConfig);

  constructor(
    dealabsUrlOptimizer: DealabsUrlOptimizer,
    dealabsExpiryResolver: DealabsExpiryResolver,
    private readonly llmExtraction: LlmExtractionService,
  ) {
    this.urlOptimizer = dealabsUrlOptimizer;
    this.expiryResolver = dealabsExpiryResolver;
  }

  /**
   * Extracts listings from Dealabs HTML page by delegating per-element
   * extraction to the extractor microservice.
   */
  async extractListings(html: string, sourceUrl: string): Promise<{ listings: UniversalListing[]; llmTimeMs: number }> {
    this.validateHtml(html);

    const $ = cheerio.load(html);
    const selector = this.getListingSelector();

    const elements: Cheerio<Element>[] = [];
    $(selector).each((_index, element) => {
      elements.push($(element) as Cheerio<Element>);
    });

    const results = await Promise.allSettled(
      elements.map(($element, index) =>
        this.extractSingleListing($, $element, sourceUrl, index),
      ),
    );

    const listings: UniversalListing[] = [];
    let llmTimeMs = 0;
    let failedCount = 0;

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value !== null) {
        listings.push(result.value.listing);
        llmTimeMs += result.value.ollamaMs;
      } else {
        failedCount++;
      }
    }

    if (failedCount > 0) {
      this.logger.warn(`Failed to extract ${failedCount} of ${failedCount + listings.length} Dealabs listings`);
    }
    this.logger.log(`Extracted ${listings.length} Dealabs listings from ${sourceUrl}`);
    return { listings, llmTimeMs };
  }

  /**
   * Delegates extraction of a single listing element to the extractor service
   * and normalizes the response into a UniversalListing.
   */
  private async extractSingleListing(
    $: CheerioAPI,
    $element: Cheerio<Element>,
    sourceUrl: string,
    index: number,
  ): Promise<{ listing: UniversalListing; ollamaMs: number } | null> {
    const threadId = $element.attr('data-thread-id') ?? $element.attr('id') ?? 'unknown';
    try {
      const result = await this.llmExtraction.extract({
        siteId: SiteSource.DEALABS,
        listingHtml: $.html($element),
        sourceUrl,
      });
      return result;
    } catch (error) {
      const errorMsg = (error as Error).message || 'Unknown error';
      this.logger.warn(
        `Failed to extract Dealabs listing [${index}] (thread-id: ${threadId}): ${errorMsg}`,
      );
      return null;
    }
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
