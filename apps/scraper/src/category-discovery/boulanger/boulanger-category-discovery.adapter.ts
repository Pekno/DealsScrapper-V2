import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosResponse } from 'axios';
import { extractErrorMessage } from '@dealscrapper/shared';
import { SiteSource } from '@dealscrapper/shared-types';
import {
  ICategoryDiscoveryAdapter,
  CategoryMetadata,
  CategoryNode,
} from '../base/category-discovery-adapter.interface.js';

/**
 * Boulanger category discovery — reads the official category sitemap.
 *
 * Verified live: Boulanger declares sitemap_categorie.xml in robots.txt, listing
 * ~749 real `/c/{slug}` category pages. Unlike its product/search pages (which
 * DataDome guards), the sitemap is served to a plain request with normal browser
 * headers — so this needs no browser, stays current, and gives real slugs.
 */
const CATEGORY_SITEMAP_URL = 'https://www.boulanger.com/sitemap_categorie.xml';
const REQUEST_TIMEOUT_MS = 10000;
const REQUEST_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'application/xml,text/html;q=0.9,*/*;q=0.8',
  'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
} as const;

/** Boulanger category URL: https://www.boulanger.com/c/{slug} */
const CATEGORY_URL_RE = /https?:\/\/www\.boulanger\.com\/c\/([^<>"']+?)<\/loc>/gi;

/**
 * Non-product categories to drop (services, warranties, gift cards, etc.). The
 * sitemap is ~98% product categories, so a tiny denylist is enough.
 * ponytail: extend if more service slugs show up.
 */
const SKIP_RE = /assurance|garantie|reparation|service|livraison|carte-cadeau|installation|reprise|occasion|seconde-vie|bon-plan|guide|conseil/i;

@Injectable()
export class BoulangerCategoryDiscoveryAdapter implements ICategoryDiscoveryAdapter {
  readonly siteId = SiteSource.BOULANGER;
  readonly baseUrl = 'https://www.boulanger.com';

  private readonly logger = new Logger(BoulangerCategoryDiscoveryAdapter.name);

  async discoverCategories(): Promise<CategoryMetadata[]> {
    this.logger.log('🔍 Starting Boulanger category discovery (sitemap_categorie.xml)...');
    try {
      const xml = await this.fetchSitemap();
      const categories = this.parseCategories(xml);
      this.logger.log(`✅ Boulanger discovery completed: ${categories.length} categories`);
      return categories;
    } catch (error) {
      this.logger.error('❌ Boulanger category discovery failed:', extractErrorMessage(error));
      throw error;
    }
  }

  async buildCategoryTree(): Promise<CategoryNode[]> {
    const cats = await this.discoverCategories();
    return cats.map((c) => ({ ...c, children: [] }));
  }

  private async fetchSitemap(): Promise<string> {
    const response: AxiosResponse<string> = await axios.get(CATEGORY_SITEMAP_URL, {
      headers: REQUEST_HEADERS,
      timeout: REQUEST_TIMEOUT_MS,
      responseType: 'text',
    });
    return response.data;
  }

  /** Boulanger has a FLAT taxonomy (no nested paths), so every category is top-level. */
  private parseCategories(xml: string): CategoryMetadata[] {
    const bySlug = new Map<string, CategoryMetadata>();
    for (const match of xml.matchAll(CATEGORY_URL_RE)) {
      const slug = match[1];
      if (!slug || bySlug.has(slug) || SKIP_RE.test(slug)) continue;
      bySlug.set(slug, {
        slug,
        name: this.prettifyName(slug),
        url: `${this.baseUrl}/c/${slug}`,
        parentId: null,
        isSelectable: true,
      });
    }
    return Array.from(bySlug.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  /** "hachoir-mixeur-batteur" -> "Hachoir mixeur batteur". */
  private prettifyName(slug: string): string {
    const spaced = slug.replace(/-/g, ' ').trim();
    return spaced.charAt(0).toUpperCase() + spaced.slice(1);
  }
}
