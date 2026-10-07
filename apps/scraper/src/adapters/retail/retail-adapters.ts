import { Injectable } from '@nestjs/common';
import * as cheerio from 'cheerio';
import type { Cheerio } from 'cheerio';
import type { Element } from 'domhandler';
import { SiteSource } from '@dealscrapper/shared-types';
import { BaseSiteAdapter, type ListingElementId } from '../base/base-site-adapter.js';
import { LlmExtractionService } from '../../llm-extraction/llm-extraction.service.js';

/**
 * Shared base for retail adapters (Fnac, Darty, Boulanger). All retail sites use
 * the LLM path (no selector-extractor override), so the only per-site code is
 * the four readonly fields + URL/selector config. Électro Dépôt has its own
 * adapter (its sitemap discovery is verified); these three are best-effort.
 *
 * ⚠️ ponytail: Fnac/Darty/Boulanger sit behind DataDome and block bots — even
 * their robots.txt returned 403/hang-up — so the category-URL schemes, listing
 * selectors and HTML markers below are UNVERIFIED placeholders. Confirm each
 * against a real category page once the anti-bot path is solved.
 */
abstract class RetailAdapterBase extends BaseSiteAdapter {
  constructor(llmExtraction: LlmExtractionService) {
    super(llmExtraction);
  }

  protected getElementId($element: Cheerio<Element>): ListingElementId {
    return {
      value:
        $element.attr('data-product-id') ??
        $element.attr('data-sku') ??
        $element.attr('id') ??
        'unknown',
      label: 'product-id',
    };
  }

  extractElementCount(html: string): number | undefined {
    const $ = cheerio.load(html);
    const count = $(this.getListingSelector()).length;
    return count > 0 ? count : undefined;
  }

  // ponytail: generic retail product-card selector — verify per site.
  getListingSelector(): string {
    return '[data-product-id], li.product-item, article.product';
  }
}

@Injectable()
export class FnacAdapter extends RetailAdapterBase {
  readonly siteId = SiteSource.FNAC;
  readonly baseUrl = 'https://www.fnac.com';
  readonly displayName = 'Fnac';
  readonly colorCode = '#E1A925'; // Fnac gold

  buildCategoryUrl(categorySlug: string, page: number = 1): string {
    // ponytail: Fnac category URLs are shelf pages — confirm the real scheme.
    return `${this.baseUrl}/${categorySlug}?PageIndex=${page}`;
  }

  extractCategorySlug(url: string): string {
    const m = url.match(/fnac\.com\/([^?#]+)/);
    return m ? m[1] : 'unknown';
  }

  validateHtml(html: string): void {
    if (!html || html.trim().length === 0) throw new Error('Empty HTML content');
    if (!html.includes('fnac') && !html.includes('data-product-id')) {
      throw new Error('Invalid Fnac HTML structure - missing product markers');
    }
  }
}

@Injectable()
export class DartyAdapter extends RetailAdapterBase {
  readonly siteId = SiteSource.DARTY;
  readonly baseUrl = 'https://www.darty.com';
  readonly displayName = 'Darty';
  readonly colorCode = '#EE1C2E'; // Darty red

  buildCategoryUrl(categorySlug: string, page: number = 1): string {
    // ponytail: Darty uses /nav/achat/{slug}.html — confirm + pagination param.
    const url = `${this.baseUrl}/nav/achat/${categorySlug}.html`;
    return page > 1 ? `${url}?page=${page}` : url;
  }

  extractCategorySlug(url: string): string {
    const m = url.match(/darty\.com\/nav\/achat\/(.+?)\.html/);
    return m ? m[1] : 'unknown';
  }

  validateHtml(html: string): void {
    if (!html || html.trim().length === 0) throw new Error('Empty HTML content');
    if (!html.includes('darty') && !html.includes('data-product-id')) {
      throw new Error('Invalid Darty HTML structure - missing product markers');
    }
  }
}

@Injectable()
export class BoulangerAdapter extends RetailAdapterBase {
  readonly siteId = SiteSource.BOULANGER;
  readonly baseUrl = 'https://www.boulanger.com';
  readonly displayName = 'Boulanger';
  readonly colorCode = '#E3001B'; // Boulanger red

  buildCategoryUrl(categorySlug: string, page: number = 1): string {
    // ponytail: Boulanger uses /c/{slug} category pages — confirm + pagination.
    const url = `${this.baseUrl}/c/${categorySlug}`;
    return page > 1 ? `${url}?page=${page}` : url;
  }

  extractCategorySlug(url: string): string {
    const m = url.match(/boulanger\.com\/c\/([^?#]+)/);
    return m ? m[1] : 'unknown';
  }

  validateHtml(html: string): void {
    if (!html || html.trim().length === 0) throw new Error('Empty HTML content');
    if (!html.includes('boulanger') && !html.includes('data-product-id')) {
      throw new Error('Invalid Boulanger HTML structure - missing product markers');
    }
  }
}
