import * as cheerio from 'cheerio';
import type { CheerioAPI, Cheerio } from 'cheerio';
import type { Element } from 'domhandler';
import { SiteSource } from '@dealscrapper/shared-types';
import { createServiceLogger } from '@dealscrapper/shared-logging';
import type { ISiteAdapter, UniversalListing } from './site-adapter.interface.js';
import type { IUrlOptimizer } from './url-optimizer.interface.js';
import type { IExpiryResolver } from './expiry-resolver.interface.js';
import { scraperLogConfig } from '../../config/logging.config.js';
import { LlmExtractionService } from '../../llm-extraction/llm-extraction.service.js';

/**
 * Identifier extracted from a listing element, used only for diagnostic logging
 * when single-listing extraction fails.
 */
export interface ListingElementId {
  /** The resolved identifier value (e.g. the thread id), or 'unknown'. */
  readonly value: string;
  /** The site's label for the id, used in log messages (e.g. 'thread-id'). */
  readonly label: string;
}

/**
 * Shared base for all site adapters. Implements the identical listing-extraction
 * pipeline once (HTML validation, cheerio parsing, per-element LLM delegation via
 * Promise.allSettled, and result aggregation). Subclasses supply only the
 * genuine per-site differences: selectors, HTML validation, URL handling, and
 * the id attribute used for failure logging.
 */
export abstract class BaseSiteAdapter implements ISiteAdapter {
  abstract readonly siteId: SiteSource;
  abstract readonly baseUrl: string;
  abstract readonly displayName: string;
  abstract readonly colorCode: string;

  readonly urlOptimizer?: IUrlOptimizer;
  readonly expiryResolver?: IExpiryResolver;

  protected readonly logger = createServiceLogger(scraperLogConfig);

  constructor(protected readonly llmExtraction: LlmExtractionService) {}

  async extractListings(
    html: string,
    sourceUrl: string,
  ): Promise<{ listings: UniversalListing[]; llmTimeMs: number }> {
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
      this.logger.warn(
        `Failed to extract ${failedCount} of ${failedCount + listings.length} ${this.displayName} listings`,
      );
    }
    this.logger.log(`Extracted ${listings.length} ${this.displayName} listings from ${sourceUrl}`);
    return { listings, llmTimeMs };
  }

  private async extractSingleListing(
    $: CheerioAPI,
    $element: Cheerio<Element>,
    sourceUrl: string,
    index: number,
  ): Promise<{ listing: UniversalListing; ollamaMs: number } | null> {
    const elementId = this.getElementId($element);
    try {
      return await this.llmExtraction.extract({
        siteId: this.siteId,
        listingHtml: $.html($element),
        sourceUrl,
      });
    } catch (error) {
      const errorMsg = (error as Error).message || 'Unknown error';
      this.logger.warn(
        `Failed to extract ${this.displayName} listing [${index}] (${elementId.label}: ${elementId.value}): ${errorMsg}`,
      );
      return null;
    }
  }

  /**
   * Resolves the diagnostic identifier for a listing element. Used only for
   * failure logging in {@link extractSingleListing}.
   */
  protected abstract getElementId($element: Cheerio<Element>): ListingElementId;

  abstract buildCategoryUrl(categorySlug: string, page?: number): string;

  abstract extractCategorySlug(url: string): string;

  abstract extractElementCount(html: string): number | undefined;

  abstract getListingSelector(): string;

  abstract validateHtml(html: string): void;
}
