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
export class LeBonCoinAdapter implements ISiteAdapter {
  readonly siteId = SiteSource.LEBONCOIN;
  readonly baseUrl = 'https://www.leboncoin.fr';
  readonly displayName = 'LeBonCoin';
  readonly colorCode = '#FF6E14';
  readonly urlOptimizer = undefined;

  private readonly logger = createServiceLogger(scraperLogConfig);

  constructor(private readonly llmExtraction: LlmExtractionService) {}

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
      this.logger.warn(`Failed to extract ${failedCount} of ${failedCount + listings.length} LeBonCoin listings`);
    }
    this.logger.log(`Extracted ${listings.length} LeBonCoin listings from ${sourceUrl}`);
    return { listings, llmTimeMs };
  }

  private async extractSingleListing(
    $: CheerioAPI,
    $element: Cheerio<Element>,
    sourceUrl: string,
    index: number,
  ): Promise<{ listing: UniversalListing; ollamaMs: number } | null> {
    const adId = $element.attr('data-qa-id') ?? $element.attr('id') ?? 'unknown';
    try {
      const result = await this.llmExtraction.extract({
        siteId: SiteSource.LEBONCOIN,
        listingHtml: $.html($element),
        sourceUrl,
      });
      return result;
    } catch (error) {
      const errorMsg = (error as Error).message || 'Unknown error';
      this.logger.warn(
        `Failed to extract LeBonCoin listing [${index}] (ad-id: ${adId}): ${errorMsg}`,
      );
      return null;
    }
  }

  buildCategoryUrl(categorySlug: string, page: number = 1): string {
    return `${this.baseUrl}/recherche?category=${categorySlug}&page=${page}`;
  }

  extractCategorySlug(url: string): string {
    const queryMatch = url.match(/[?&]category=([^&]+)/);
    if (queryMatch) {
      return queryMatch[1];
    }

    const pathMatch = url.match(/\/ad\/([^/]+)\/\d+/);
    if (pathMatch) {
      return pathMatch[1];
    }

    const searchMatch = url.match(/category=([^&]+)/);
    if (searchMatch) {
      return searchMatch[1];
    }

    this.logger.warn(`Cannot extract category from URL: ${url}, using 'unknown'`);
    return 'unknown';
  }

  extractElementCount(html: string): number | undefined {
    const $ = cheerio.load(html);

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

  getListingSelector(): string {
    return '[data-qa-id="aditem_container"]';
  }

  validateHtml(html: string): void {
    if (!html || html.trim().length === 0) {
      throw new Error('Empty HTML content');
    }

    const hasArticles = html.includes('<article') || html.includes('data-qa-id');
    const hasLeBonCoinDomain =
      html.includes('leboncoin') ||
      html.includes('img.leboncoin.fr');

    if (!hasArticles) {
      throw new Error('Invalid LeBonCoin HTML: No article or aditem elements found');
    }

    if (!hasLeBonCoinDomain) {
      this.logger.warn('HTML may not be from LeBonCoin (domain check failed)');
    }
  }
}
