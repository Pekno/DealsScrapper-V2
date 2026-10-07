import { Injectable } from '@nestjs/common';
import * as cheerio from 'cheerio';
import type { Cheerio } from 'cheerio';
import type { Element } from 'domhandler';
import { SiteSource } from '@dealscrapper/shared-types';
import {
  BaseSiteAdapter,
  type ListingElementId,
  type SelectorExtractor,
} from '../base/base-site-adapter.js';
import { extractLeBonCoinListingFromSelectors } from './leboncoin-selector-extractor.js';
import { LlmExtractionService } from '../../llm-extraction/llm-extraction.service.js';

@Injectable()
export class LeBonCoinAdapter extends BaseSiteAdapter {
  readonly siteId = SiteSource.LEBONCOIN;
  readonly baseUrl = 'https://www.leboncoin.fr';
  readonly displayName = 'LeBonCoin';
  readonly colorCode = '#FF6E14';

  constructor(llmExtraction: LlmExtractionService) {
    super(llmExtraction);
  }

  protected getElementId($element: Cheerio<Element>): ListingElementId {
    return {
      value: $element.attr('data-qa-id') ?? $element.attr('id') ?? 'unknown',
      label: 'ad-id',
    };
  }

  protected getSelectorExtractor(): SelectorExtractor {
    return extractLeBonCoinListingFromSelectors;
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
