import { Injectable } from '@nestjs/common';
import * as cheerio from 'cheerio';
import type { Cheerio } from 'cheerio';
import type { Element } from 'domhandler';
import { SiteSource } from '@dealscrapper/shared-types';
import { BaseSiteAdapter, type ListingElementId } from '../base/base-site-adapter.js';
import { LlmExtractionService } from '../../llm-extraction/llm-extraction.service.js';

/**
 * Électro Dépôt adapter — first of the retail-site family.
 *
 * Pure config: no selector-extractor override, so every product card is read by
 * the shared retail LLM module (like Vinted). Adding Fnac/Darty/Boulanger means
 * copying this file and changing the four readonly fields + URL/selector config.
 *
 * ponytail: the listing selector, pagination param and id attribute below are
 * best-guess and MUST be verified against a real category page (the product grid
 * sits behind DataDome, so confirm once you can fetch live HTML).
 */
@Injectable()
export class ElectroDepotAdapter extends BaseSiteAdapter {
  readonly siteId = SiteSource.ELECTRODEPOT;
  readonly baseUrl = 'https://www.electrodepot.fr';
  readonly displayName = 'Électro Dépôt';
  readonly colorCode = '#E2001A'; // Électro Dépôt red

  constructor(llmExtraction: LlmExtractionService) {
    super(llmExtraction);
  }

  protected getElementId($element: Cheerio<Element>): ListingElementId {
    return {
      value: $element.attr('data-product-id') ?? $element.attr('data-sku') ?? $element.attr('id') ?? 'unknown',
      label: 'product-id',
    };
  }

  buildCategoryUrl(categorySlug: string, page: number = 1): string {
    // Category slugs are the sitemap path without the .html suffix, e.g.
    // "gros-electromenager/lave-linge" -> /gros-electromenager/lave-linge.html
    // ponytail: confirm the pagination query param against the live site.
    const url = `${this.baseUrl}/${categorySlug}.html`;
    return page > 1 ? `${url}?page=${page}` : url;
  }

  extractCategorySlug(url: string): string {
    const match = url.match(/electrodepot\.fr\/(.+?)\.html/);
    if (match) {
      return match[1];
    }
    this.logger.warn(`Cannot extract category slug from URL: ${url}, using 'unknown'`);
    return 'unknown';
  }

  extractElementCount(html: string): number | undefined {
    const $ = cheerio.load(html);
    const count = $(this.getListingSelector()).length;
    return count > 0 ? count : undefined;
  }

  getListingSelector(): string {
    // ponytail: verify against live markup; retail grids usually expose a
    // product-item class or a data-product-id hook.
    return '[data-product-id], li.product-item, article.product';
  }

  validateHtml(html: string): void {
    if (!html || html.trim().length === 0) {
      throw new Error('Empty HTML content');
    }
    const looksLikeElectroDepot =
      html.includes('electrodepot') || html.includes('data-product-id') || html.includes('product-item');
    if (!looksLikeElectroDepot) {
      throw new Error('Invalid Électro Dépôt HTML structure - missing product markers');
    }
  }
}
