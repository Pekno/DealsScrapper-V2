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
 * Électro Dépôt category discovery — reads the official category sitemap
 * (sitemap-arbo.xml = "arborescence") instead of crawling the nav DOM.
 *
 * Why the sitemap and not the page nav: it's the site's own machine-readable
 * source of truth, it stays current automatically, and it isn't guarded by the
 * DataDome bot-wall that protects the product/search pages. So categories come
 * out automatic and with proper, real slugs — no hand-typed list to rot.
 *
 * ponytail: if Électro Dépôt ever drops this sitemap, fall back to a committed
 * static snapshot generated from a previous run.
 */
const ARBO_SITEMAP_URL = 'https://www.electrodepot.fr/sitemap-arbo.xml';
const REQUEST_TIMEOUT_MS = 10000;

/**
 * The store's real top-nav groups. sitemap-arbo.xml is noisy — ~half its 600+
 * entries are promo/landing pages ("reprise-de-vos-appareils", "test", spotlight
 * ops). Keeping only entries whose root segment is one of these 6 stable groups
 * drops the junk and yields ~328 genuine product categories. ponytail: this
 * allowlist is the only hand-maintained bit; the categories under it stay
 * automatic. Re-check it if Électro Dépôt restructures its top nav.
 */
const TOP_NAV_GROUPS: ReadonlySet<string> = new Set([
  'gros-electromenager',
  'petit-dejeuner-cuisson',
  'informatique-gaming-tablette',
  'tv-image-son',
  'smartphone-mobilite',
  'maison-entretien-beaute',
]);
const REQUEST_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
} as const;

/** Matches a category page URL and captures the path between the host and `.html`. */
const CATEGORY_URL_RE = /https?:\/\/www\.electrodepot\.fr\/([^<>"']+?)\.html/gi;

@Injectable()
export class ElectroDepotCategoryDiscoveryAdapter implements ICategoryDiscoveryAdapter {
  readonly siteId = SiteSource.ELECTRODEPOT;
  readonly baseUrl = 'https://www.electrodepot.fr';

  private readonly logger = new Logger(ElectroDepotCategoryDiscoveryAdapter.name);

  async discoverCategories(): Promise<CategoryMetadata[]> {
    this.logger.log('🔍 Starting Électro Dépôt category discovery (sitemap-arbo.xml)...');
    try {
      const xml = await this.fetchSitemap();
      const categories = this.parseCategories(xml);
      this.logger.log(`✅ Électro Dépôt discovery completed: ${categories.length} categories`);
      return categories;
    } catch (error) {
      this.logger.error('❌ Électro Dépôt category discovery failed:', extractErrorMessage(error));
      throw error;
    }
  }

  async buildCategoryTree(): Promise<CategoryNode[]> {
    const categories = await this.discoverCategories();
    const nodeBySlug = new Map<string, CategoryNode>();
    categories.forEach((cat) => nodeBySlug.set(cat.slug, { ...cat, children: [] }));

    const roots: CategoryNode[] = [];
    for (const cat of categories) {
      const node = nodeBySlug.get(cat.slug)!;
      const parent = cat.parentId ? nodeBySlug.get(cat.parentId) : undefined;
      if (parent) {
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    }
    return roots;
  }

  private async fetchSitemap(): Promise<string> {
    const response: AxiosResponse<string> = await axios.get(ARBO_SITEMAP_URL, {
      headers: REQUEST_HEADERS,
      timeout: REQUEST_TIMEOUT_MS,
      responseType: 'text',
    });
    return response.data;
  }

  /**
   * Turns each `<loc>.../{path}.html</loc>` into a CategoryMetadata. The slug is
   * the path (which may be nested, e.g. "gros-electromenager/lave-linge"); the
   * parentId holds the parent slug during discovery (resolved to an id on save).
   */
  private parseCategories(xml: string): CategoryMetadata[] {
    const bySlug = new Map<string, CategoryMetadata>();

    for (const match of xml.matchAll(CATEGORY_URL_RE)) {
      const path = match[1]; // e.g. "gros-electromenager/lave-linge"
      if (!path || bySlug.has(path)) continue;

      const segments = path.split('/');
      // Drop promo/landing pages: keep only real product taxonomy under a known group.
      if (!TOP_NAV_GROUPS.has(segments[0])) continue;

      const lastSegment = segments[segments.length - 1];
      const parentId = segments.length > 1 ? segments.slice(0, -1).join('/') : null;

      bySlug.set(path, {
        slug: path,
        name: this.prettifyName(lastSegment),
        url: `${this.baseUrl}/${path}.html`,
        parentId,
        isSelectable: true,
      });
    }

    return Array.from(bySlug.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  /** "gros-electromenager" -> "Gros electromenager". ponytail: good enough; accents stay as-is. */
  private prettifyName(slug: string): string {
    const spaced = slug.replace(/-/g, ' ').trim();
    return spaced.charAt(0).toUpperCase() + spaced.slice(1);
  }
}
