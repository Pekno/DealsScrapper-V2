import { Injectable } from '@nestjs/common';
import * as cheerio from 'cheerio';
import type { Cheerio } from 'cheerio';
import type { Element } from 'domhandler';
import { SiteSource } from '@dealscrapper/shared-types';
import { BaseSiteAdapter, type ListingElementId } from '../base/base-site-adapter.js';
import { LlmExtractionService } from '../../llm-extraction/llm-extraction.service.js';

@Injectable()
export class VintedAdapter extends BaseSiteAdapter {
  readonly siteId = SiteSource.VINTED;
  readonly baseUrl = 'https://www.vinted.fr';
  readonly displayName = 'Vinted';
  readonly colorCode = '#09B1BA';

  constructor(llmExtraction: LlmExtractionService) {
    super(llmExtraction);
  }

  protected getElementId($element: Cheerio<Element>): ListingElementId {
    return {
      value: $element.attr('data-product-item-id') ?? $element.attr('id') ?? 'unknown',
      label: 'item-id',
    };
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
