import { Injectable, Logger } from '@nestjs/common';
import * as cheerio from 'cheerio';
import axios, { AxiosResponse } from 'axios';
import type { Element } from 'domhandler';
import { delay, extractErrorMessage } from '@dealscrapper/shared';
import { SiteSource } from '@dealscrapper/shared-types';
import {
  ICategoryDiscoveryAdapter,
  CategoryMetadata,
  CategoryNode,
} from '../base/category-discovery-adapter.interface.js';

/**
 * Configuration constants for Dealabs category discovery
 */
const DEALABS_DISCOVERY_CONFIG = {
  BASE_URL: 'https://www.dealabs.com',
  GROUPS_URL: 'https://www.dealabs.com/groupe',
  REQUEST_TIMEOUT_MS: 10000,
  MAX_CATEGORY_NAME_LENGTH: 100,
  MIN_SLUG_LENGTH: 2,
  SKIP_CATEGORIES: [
    'hot',
    'new',
    'nouveau',
    'top',
    'trending',
    'all',
    'search',
    'filter',
    'sort',
    'page',
    'hub',
  ] as const,
  DELAY_BETWEEN_HUB_REQUESTS_MS: 500,
} as const;

/**
 * HTTP headers for web scraping requests
 */
const REQUEST_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
} as const;

/**
 * CSS selectors for category discovery
 */
const CATEGORY_SELECTORS = [
  'a[href*="/groupe/"]',
  '[data-testid="category-link"]',
  '.category-link',
] as const;

/**
 * Dealabs-specific category discovery adapter
 * Dealabs has a FLAT category structure (no hierarchy)
 */
@Injectable()
export class DealabsCategoryDiscoveryAdapter implements ICategoryDiscoveryAdapter {
  readonly siteId = SiteSource.DEALABS;
  readonly baseUrl = DEALABS_DISCOVERY_CONFIG.BASE_URL;

  private readonly logger = new Logger(DealabsCategoryDiscoveryAdapter.name);

  /**
   * Discovers all categories from Dealabs homepage
   * Dealabs has flat structure, so all categories are top-level (no subcategory discovery needed)
   */
  async discoverCategories(): Promise<CategoryMetadata[]> {
    this.logger.log('🔍 Starting Dealabs category discovery...');

    try {
      const mainCategories = await this.discoverMainCategories();

      this.logger.log(
        `✅ Dealabs category discovery completed: ${mainCategories.length} categories (flat structure)`
      );
      return mainCategories;
    } catch (error) {
      const errorMessage = extractErrorMessage(error);
      this.logger.error('❌ Dealabs category discovery failed:', errorMessage);
      throw error;
    }
  }

  /**
   * Builds hierarchical category tree
   * For Dealabs, this is a flat structure with potential subcategories
   */
  async buildCategoryTree(): Promise<CategoryNode[]> {
    const categories = await this.discoverCategories();

    // Build tree structure
    const categoryMap = new Map<string, CategoryNode>();
    const rootNodes: CategoryNode[] = [];

    // First pass: Create all nodes
    categories.forEach((cat) => {
      categoryMap.set(cat.slug, {
        ...cat,
        children: [],
      });
    });

    // Second pass: Build hierarchy
    // Note: parentId at this stage contains the parent's slug (during discovery)
    categories.forEach((cat) => {
      const node = categoryMap.get(cat.slug)!;
      if (cat.parentId) {
        const parent = categoryMap.get(cat.parentId); // parentId holds slug during discovery
        if (parent) {
          parent.children.push(node);
        } else {
          // Parent not found, treat as root
          rootNodes.push(node);
        }
      } else {
        rootNodes.push(node);
      }
    });

    return rootNodes;
  }

  /**
   * Discover main categories from the Dealabs groups page, including hub sub-pages
   */
  private async discoverMainCategories(): Promise<CategoryMetadata[]> {
    try {
      const htmlContent = await this.fetchPageContent(
        DEALABS_DISCOVERY_CONFIG.GROUPS_URL
      );
      const $ = cheerio.load(htmlContent);

      const categoryLinks = this.findCategoryLinks($);
      if (categoryLinks.length === 0) {
        this.logger.warn('⚠️ No category links found, trying fallback method');
        return this.extractCategoriesWithFallback($);
      }

      const mainCategories = this.extractCategoriesFromLinks($, categoryLinks);

      const hubUrls = this.discoverHubPageUrls($);
      const hubCategories = await this.discoverHubCategories(hubUrls);

      const allCategories = [...mainCategories, ...hubCategories];
      const uniqueCategories = this.deduplicateAndSortCategories(allCategories);

      this.logger.debug(
        `📂 Discovered ${uniqueCategories.length} unique categories (${mainCategories.length} main + ${hubCategories.length} from ${hubUrls.length} hub pages)`
      );
      return uniqueCategories;
    } catch (error) {
      const errorMessage = extractErrorMessage(error);
      this.logger.error('❌ Failed to discover main categories:', errorMessage);
      throw error;
    }
  }

  /**
   * Find hub page URLs from the main groups page (e.g. /groupe/hub/high-tech)
   */
  private discoverHubPageUrls($: cheerio.CheerioAPI): string[] {
    const hubUrls = new Set<string>();

    $('a[href*="/groupe/hub/"]').each((_, element) => {
      const href = $(element).attr('href');
      if (!href) return;

      const absoluteUrl = href.startsWith('http')
        ? href
        : `${DEALABS_DISCOVERY_CONFIG.BASE_URL}${href}`;

      hubUrls.add(absoluteUrl);
    });

    this.logger.debug(`🔗 Found ${hubUrls.size} hub page URLs`);
    return Array.from(hubUrls);
  }

  /**
   * Fetch each hub page and extract regular categories from them
   */
  private async discoverHubCategories(hubUrls: string[]): Promise<CategoryMetadata[]> {
    const allCategories: CategoryMetadata[] = [];

    for (const hubUrl of hubUrls) {
      try {
        const htmlContent = await this.fetchPageContent(hubUrl);
        const $ = cheerio.load(htmlContent);

        const categoryLinks = this.findCategoryLinks($);
        const categories = this.extractCategoriesFromLinks($, categoryLinks);

        this.logger.debug(
          `📂 Hub page ${hubUrl}: found ${categories.length} categories`
        );
        allCategories.push(...categories);

        await delay(DEALABS_DISCOVERY_CONFIG.DELAY_BETWEEN_HUB_REQUESTS_MS);
      } catch (error) {
        const errorMessage = extractErrorMessage(error);
        this.logger.warn(
          `⚠️ Failed to fetch hub page ${hubUrl}: ${errorMessage}`
        );
      }
    }

    return allCategories;
  }


  /**
   * Fetch HTML content from a URL with standardized headers and timeout
   */
  private async fetchPageContent(url: string): Promise<string> {
    const response: AxiosResponse<string> = await axios.get(url, {
      headers: REQUEST_HEADERS,
      timeout: DEALABS_DISCOVERY_CONFIG.REQUEST_TIMEOUT_MS,
    });
    return response.data;
  }

  /**
   * Find category links using multiple CSS selectors with fallback logic
   */
  private findCategoryLinks($: cheerio.CheerioAPI): cheerio.Cheerio<Element> {
    for (const selector of CATEGORY_SELECTORS) {
      const links = $(selector);
      if (links.length > 0) {
        this.logger.debug(
          `📋 Found category links using selector: ${selector}`
        );
        return links;
      }
    }
    return $(); // Return empty cheerio object
  }

  /**
   * Extract categories using fallback method
   */
  private extractCategoriesWithFallback(
    $: cheerio.CheerioAPI
  ): CategoryMetadata[] {
    const categoryLinks = $('a').filter((_, element) => {
      const href = $(element).attr('href');
      return href ? href.includes('/groupe/') : false;
    });
    return this.extractCategoriesFromLinks($, categoryLinks);
  }

  /**
   * Extract category structures from cheerio link elements
   */
  private extractCategoriesFromLinks(
    $: cheerio.CheerioAPI,
    categoryLinks: cheerio.Cheerio<Element>
  ): CategoryMetadata[] {
    const categories: CategoryMetadata[] = [];
    const seenSlugs = new Set<string>();

    categoryLinks.each((_, element) => {
      const href = $(element).attr('href');
      const name = $(element).text().trim();

      if (href && name && href.includes('/groupe/')) {
        const slug = this.extractSlugFromHref(href);
        if (slug && !seenSlugs.has(slug) && !this.shouldSkipCategory(slug)) {
          seenSlugs.add(slug);
          categories.push(this.createCategoryMetadata(slug, name));
        }
      }
    });

    return categories;
  }

  /**
   * Remove duplicates and sort categories alphabetically
   */
  private deduplicateAndSortCategories(
    categories: CategoryMetadata[]
  ): CategoryMetadata[] {
    return categories
      .filter(
        (category, index, array) =>
          array.findIndex((c) => c.slug === category.slug) === index
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Extract slug from href URL
   */
  private extractSlugFromHref(href: string): string | null {
    const match = href.match(/\/groupe\/([^/?]+)/);
    return match ? match[1] : null;
  }

  /**
   * Check if a slug should be skipped
   */
  private shouldSkipCategory(slug: string): boolean {
    return (
      (DEALABS_DISCOVERY_CONFIG.SKIP_CATEGORIES as readonly string[]).includes(
        slug
      ) || slug.length < DEALABS_DISCOVERY_CONFIG.MIN_SLUG_LENGTH
    );
  }

  /**
   * Create category metadata for main category
   */
  private createCategoryMetadata(slug: string, name: string): CategoryMetadata {
    return {
      slug,
      name: this.cleanCategoryName(name),
      url: `${this.baseUrl}/groupe/${slug}`,
      parentId: null,
    };
  }

  /**
   * Clean and normalize category name
   */
  private cleanCategoryName(name: string): string {
    return name
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s\-&]/g, '')
      .substring(0, DEALABS_DISCOVERY_CONFIG.MAX_CATEGORY_NAME_LENGTH);
  }

}
