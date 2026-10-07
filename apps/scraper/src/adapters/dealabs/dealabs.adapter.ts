import { Injectable } from '@nestjs/common';
import * as cheerio from 'cheerio';
import type { Cheerio } from 'cheerio';
import type { Element } from 'domhandler';
import { SiteSource } from '@dealscrapper/shared-types';
import type { IUrlOptimizer } from '../base/url-optimizer.interface.js';
import type { IExpiryResolver } from '../base/expiry-resolver.interface.js';
import {
  BaseSiteAdapter,
  type ListingElementId,
  type SelectorExtractor,
} from '../base/base-site-adapter.js';
import { DealabsUrlOptimizer } from './dealabs-url-optimizer.js';
import { DealabsExpiryResolver } from './dealabs-expiry-resolver.js';
import { extractDealabsListingFromSelectors } from './dealabs-selector-extractor.js';
import { LlmExtractionService } from '../../llm-extraction/llm-extraction.service.js';

@Injectable()
export class DealabsAdapter extends BaseSiteAdapter {
  readonly siteId = SiteSource.DEALABS;
  readonly baseUrl = 'https://www.dealabs.com';
  readonly displayName = 'Dealabs';
  readonly colorCode = '#FF6B35'; // Orange
  readonly urlOptimizer: IUrlOptimizer;
  readonly expiryResolver: IExpiryResolver;

  constructor(
    dealabsUrlOptimizer: DealabsUrlOptimizer,
    dealabsExpiryResolver: DealabsExpiryResolver,
    llmExtraction: LlmExtractionService,
  ) {
    super(llmExtraction);
    this.urlOptimizer = dealabsUrlOptimizer;
    this.expiryResolver = dealabsExpiryResolver;
  }

  protected getElementId($element: Cheerio<Element>): ListingElementId {
    return {
      value: $element.attr('data-thread-id') ?? $element.attr('id') ?? 'unknown',
      label: 'thread-id',
    };
  }

  protected getSelectorExtractor(): SelectorExtractor {
    return extractDealabsListingFromSelectors;
  }

  buildCategoryUrl(categorySlug: string, page: number = 1): string {
    // Handle hub categories
    if (categorySlug.startsWith('hub-')) {
      const hubSlug = categorySlug.replace('hub-', '');
      return `${this.baseUrl}/groupe/hub/${hubSlug}?page=${page}`;
    }

    // Regular category
    return `${this.baseUrl}/groupe/${categorySlug}?page=${page}`;
  }

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

  getListingSelector(): string {
    return 'article.thread, article[data-thread-id], article[id^="thread_"]';
  }

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
