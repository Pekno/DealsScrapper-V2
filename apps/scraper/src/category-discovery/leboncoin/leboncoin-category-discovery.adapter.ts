import { Injectable, Logger } from '@nestjs/common';
import { extractErrorMessage } from '@dealscrapper/shared';
import { PrismaService } from '@dealscrapper/database';
import {
  ICategoryDiscoveryAdapter,
  CategoryMetadata,
  CategoryNode,
} from '../base/category-discovery-adapter.interface.js';
import { PuppeteerPoolService } from '../../puppeteer-pool/puppeteer-pool.service.js';
import type * as PuppeteerCore from 'puppeteer';

/**
 * Configuration constants for LeBonCoin category discovery
 */
const LEBONCOIN_DISCOVERY_CONFIG = {
  BASE_URL: 'https://www.leboncoin.fr',
  SEARCH_URL: 'https://www.leboncoin.fr/recherche',
  FDATA_URL_PATTERN: '/api/frontend/v1/data/v7/fdata',
  BROWSER_TIMEOUT_MS: 120000,
  FDATA_INTERCEPT_TIMEOUT_MS: 30000,
  MAX_CATEGORY_NAME_LENGTH: 100,
  USE_DATABASE_FALLBACK: true,
} as const;

/**
 * LeBonCoin-specific category discovery adapter
 *
 * Strategy:
 * 1. Intercept the fdata API response during page load — contains the full
 *    category tree, no UI interaction needed
 * 2. Database fallback (pre-seeded categories)
 */
@Injectable()
export class LeBonCoinCategoryDiscoveryAdapter
  implements ICategoryDiscoveryAdapter
{
  readonly siteId = 'leboncoin';
  readonly baseUrl = LEBONCOIN_DISCOVERY_CONFIG.BASE_URL;

  private readonly logger = new Logger(
    LeBonCoinCategoryDiscoveryAdapter.name
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly puppeteerPool: PuppeteerPoolService,
  ) {}

  /**
   * Discovers all categories from LeBonCoin
   *
   * Strategy:
   * 1. Intercept fdata API response (fastest, no UI interaction)
   * 2. Database fallback (pre-seeded categories)
   */
  async discoverCategories(): Promise<CategoryMetadata[]> {
    this.logger.log('Starting LeBonCoin category discovery...');

    // Strategy 1: Intercept fdata API response
    try {
      const categories = await this.discoverFromApiIntercept();
      if (categories.length > 0) {
        this.logger.log(
          `LeBonCoin API intercept succeeded: ${categories.length} categories`
        );
        return categories;
      }
    } catch (error) {
      const errorMessage = extractErrorMessage(error);
      this.logger.warn(
        `LeBonCoin API intercept failed: ${errorMessage}`
      );
    }

    // Strategy 2: Database fallback
    if (LEBONCOIN_DISCOVERY_CONFIG.USE_DATABASE_FALLBACK) {
      try {
        const categories = await this.discoverFromDatabase();
        this.logger.log(
          `LeBonCoin database fallback succeeded: ${categories.length} categories`
        );
        return categories;
      } catch (error) {
        const errorMessage = extractErrorMessage(error);
        this.logger.error(
          'LeBonCoin database fallback failed:',
          errorMessage
        );
        throw error;
      }
    }

    throw new Error(
      'All LeBonCoin category discovery strategies failed. Please ensure database is seeded or website is accessible.'
    );
  }

  /**
   * Discovers categories by intercepting the fdata API response.
   *
   * When LeBonCoin's search page loads, it fetches /api/frontend/v1/data/v7/fdata
   * which contains the full category tree used to populate the filter UI.
   * We intercept that response and extract categories directly from the JSON,
   * avoiding all UI interaction (no clicking, no drawer, no consent issues).
   */
  private async discoverFromApiIntercept(): Promise<CategoryMetadata[]> {
    this.logger.debug('Attempting fdata API intercept...');

    const browser = await this.puppeteerPool.acquire();
    let page: PuppeteerCore.Page | null = null;

    try {
      page = await this.puppeteerPool.createPage(browser);
      page.setDefaultNavigationTimeout(LEBONCOIN_DISCOVERY_CONFIG.BROWSER_TIMEOUT_MS);

      // Set up a promise that resolves when we capture the fdata response
      const fdataPromise = new Promise<any>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('fdata response not received within timeout'));
        }, LEBONCOIN_DISCOVERY_CONFIG.FDATA_INTERCEPT_TIMEOUT_MS);

        page!.on('response', async (response: PuppeteerCore.HTTPResponse) => {
          if (!response.url().includes(LEBONCOIN_DISCOVERY_CONFIG.FDATA_URL_PATTERN)) return;
          if (response.status() !== 200) return;

          try {
            clearTimeout(timeout);
            const body = await response.json();
            resolve(body);
          } catch {
            // Not JSON or couldn't read body, ignore
          }
        });
      });

      // Navigate — the page will fetch fdata during load
      await page.goto(LEBONCOIN_DISCOVERY_CONFIG.SEARCH_URL, {
        waitUntil: 'domcontentloaded',
      });

      const fdataBody = await fdataPromise;

      // Parse categories from the fdata payload
      const categories = this.parseFdataCategories(fdataBody);
      return categories;
    } finally {
      if (page) await page.close();
      await this.puppeteerPool.release(browser);
    }
  }

  /**
   * Parses the fdata API response to extract categories.
   *
   * fdata returns { features, regions, categories } where categories is an
   * object keyed by index. Each entry has:
   *   { catId, label, name, deeplink, subcategories?: [...], ad_types }
   * Subcategories have the same shape plus categoryParentId.
   * "mirror" entries (type: "mirror") are cross-references to other parents — skip them.
   */
  private parseFdataCategories(fdata: any): CategoryMetadata[] {
    const categories: CategoryMetadata[] = [];

    const rawCategories = fdata?.categories;
    if (!rawCategories || typeof rawCategories !== 'object') {
      this.logger.debug(
        `fdata: no categories found. Top-level keys: ${Object.keys(fdata || {}).join(', ')}`
      );
      return [];
    }

    const entries = Object.values(rawCategories) as any[];
    this.logger.debug(`fdata: found ${entries.length} top-level category entries`);

    for (const entry of entries) {
      const catId = String(entry.catId ?? '');
      const name = entry.name ?? entry.label ?? '';
      if (!catId || !name) continue;

      const hasChildren = Array.isArray(entry.subcategories) && entry.subcategories.length > 0;

      // Parent category
      categories.push({
        slug: catId,
        name: this.cleanCategoryName(name),
        url: `${this.baseUrl}/recherche?category=${catId}`,
        parentId: null,
        isSelectable: !hasChildren,
      });

      if (!hasChildren) continue;

      // Subcategories
      for (const sub of entry.subcategories) {
        // Skip "mirror" entries — they're cross-references to other parent categories
        if (sub.type === 'mirror') continue;

        const subCatId = String(sub.catId ?? '');
        const subName = sub.name ?? sub.label ?? '';
        if (!subCatId || !subName) continue;

        categories.push({
          slug: subCatId,
          name: this.cleanCategoryName(subName),
          url: `${this.baseUrl}/recherche?category=${subCatId}`,
          parentId: catId,
          isSelectable: true,
        });
      }
    }

    return this.deduplicateCategories(categories);
  }

  /**
   * Database fallback: load pre-seeded categories
   */
  private async discoverFromDatabase(): Promise<CategoryMetadata[]> {
    this.logger.debug('Loading categories from database...');

    const dbCategories = await this.prisma.category.findMany({
      where: { siteId: 'leboncoin', isActive: true },
      orderBy: [{ level: 'asc' }, { slug: 'asc' }],
      include: { parent: true },
    });

    return dbCategories.map((cat) => ({
      slug: cat.slug,
      name: cat.name,
      url: cat.sourceUrl,
      parentId: cat.parent?.slug ?? null,
    }));
  }

  /**
   * Builds hierarchical category tree
   */
  async buildCategoryTree(): Promise<CategoryNode[]> {
    const categories = await this.discoverCategories();

    const categoryMap = new Map<string, CategoryNode>();
    const rootNodes: CategoryNode[] = [];

    categories.forEach((cat) => {
      categoryMap.set(cat.slug, {
        ...cat,
        children: [],
      });
    });

    categories.forEach((cat) => {
      const node = categoryMap.get(cat.slug)!;
      if (cat.parentId) {
        const parent = categoryMap.get(cat.parentId);
        if (parent) {
          parent.children.push(node);
        } else {
          this.logger.warn(
            `Parent category "${cat.parentId}" not found for "${cat.slug}"`
          );
          rootNodes.push(node);
        }
      } else {
        rootNodes.push(node);
      }
    });

    this.logger.log(
      `Built category tree: ${rootNodes.length} root categories, ${categories.length - rootNodes.length} subcategories`
    );

    return rootNodes;
  }

  /**
   * Remove duplicates from categories array
   */
  private deduplicateCategories(
    categories: CategoryMetadata[]
  ): CategoryMetadata[] {
    return categories.filter(
      (category, index, array) =>
        array.findIndex((c) => c.slug === category.slug) === index
    );
  }

  /**
   * Clean and normalize category name
   */
  private cleanCategoryName(name: string): string {
    return name
      .trim()
      .replace(/\s+/g, ' ')
      .substring(0, LEBONCOIN_DISCOVERY_CONFIG.MAX_CATEGORY_NAME_LENGTH);
  }
}
