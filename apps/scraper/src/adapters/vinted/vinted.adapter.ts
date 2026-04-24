import { Injectable } from '@nestjs/common';
import * as cheerio from 'cheerio';
import type { CheerioAPI, Cheerio } from 'cheerio';
import type { Element } from 'domhandler';
import { SiteSource } from '@dealscrapper/shared-types';
import type {
  ISiteAdapter,
  UniversalListing,
} from '../base/site-adapter.interface.js';
import { createServiceLogger } from '@dealscrapper/shared-logging';
import { scraperLogConfig } from '../../config/logging.config.js';
import { LlmExtractionService } from '../../llm-extraction/llm-extraction.service.js';

@Injectable()
export class VintedAdapter implements ISiteAdapter {
  readonly siteId = SiteSource.VINTED;
  readonly baseUrl = 'https://www.vinted.fr';
  readonly displayName = 'Vinted';
  readonly colorCode = '#09B1BA';
  readonly urlOptimizer = undefined;

  private readonly logger = createServiceLogger(scraperLogConfig);

  constructor(private readonly llmExtraction: LlmExtractionService) {}

  async extractListings(html: string, sourceUrl: string): Promise<UniversalListing[]> {
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
    let failedCount = 0;

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value !== null) {
        listings.push(result.value);
      } else {
        failedCount++;
      }
    }

    if (failedCount > 0) {
      this.logger.warn(`Failed to extract ${failedCount} of ${failedCount + listings.length} Vinted listings`);
    }
    this.logger.log(`Extracted ${listings.length} Vinted listings from ${sourceUrl}`);
    return listings;
  }

  private async extractSingleListing(
    $: CheerioAPI,
    $element: Cheerio<Element>,
    sourceUrl: string,
    index: number,
  ): Promise<UniversalListing | null> {
    const itemId = $element.attr('data-product-item-id') ?? $element.attr('id') ?? 'unknown';
    try {
      const listing = await this.llmExtraction.extract({
        siteId: SiteSource.VINTED,
        listingHtml: $.html($element),
        sourceUrl,
      });
      return listing;
    } catch (error) {
      const errorMsg = (error as Error).message || 'Unknown error';
      this.logger.warn(
        `Failed to extract Vinted listing [${index}] (item-id: ${itemId}): ${errorMsg}`,
      );
      return null;
    }
  }

  buildCategoryUrl(categorySlug: string, page: number = 1): string {
    const parts = categorySlug.split('/');
    const baseSlug = parts[parts.length - 1];
    return `${this.baseUrl}/catalog/${baseSlug}?page=${page}&order=newest_first`;
  }

  extractCategorySlug(url: string): string {
    const queryMatch = url.match(/catalog\[\]=([^&]+)/);
    if (queryMatch) {
      return decodeURIComponent(queryMatch[1]);
    }

    const pathMatch = url.match(/\/catalog\/([^/?]+)/);
    if (pathMatch) {
      return pathMatch[1];
    }

    this.logger.warn(`Cannot extract category slug from URL: ${url}, using default`);
    return 'unknown';
  }

  extractElementCount(html: string): number | undefined {
    const $ = cheerio.load(html);

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

    const itemCount = $('.feed-grid__item').length;
    return itemCount > 0 ? itemCount : undefined;
  }

  getListingSelector(): string {
    return '.feed-grid__item';
  }

  validateHtml(html: string): void {
    if (!html || html.trim().length === 0) {
      throw new Error('Empty HTML content');
    }

    const hasVintedContent =
      html.includes('feed-grid__item') ||
      html.includes('new-item-box') ||
      html.includes('data-testid="item-') ||
      html.includes('vinted.net');

    if (!hasVintedContent) {
      throw new Error('Invalid Vinted HTML structure - missing feed-grid or item markers');
    }
  }
}
