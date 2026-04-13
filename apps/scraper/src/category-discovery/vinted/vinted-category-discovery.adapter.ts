import { Injectable, Logger } from '@nestjs/common';
import { delay, extractErrorMessage } from '@dealscrapper/shared';
import { SiteSource } from '@dealscrapper/shared-types';
import { PrismaService } from '@dealscrapper/database';
import {
  ICategoryDiscoveryAdapter,
  CategoryMetadata,
  CategoryNode,
} from '../base/category-discovery-adapter.interface.js';
import { PuppeteerPoolService } from '../../puppeteer-pool/puppeteer-pool.service.js';

/**
 * Configuration constants for Vinted category discovery
 */
const VINTED_DISCOVERY_CONFIG = {
  BASE_URL: 'https://www.vinted.fr',
  CATALOG_URL: 'https://www.vinted.fr/catalog',
  BROWSER_TIMEOUT_MS: 60000,
  HOVER_DELAY_MS: 500,
  MAX_CATEGORY_NAME_LENGTH: 100,
  USE_DATABASE_FALLBACK: true,
} as const;

/**
 * CSS Selectors for Vinted category navigation
 */
const VINTED_SELECTORS = {
  // Main navigation tabs (Femmes, Hommes, Enfants, Maison, Divertissement)
  MAIN_TABS: 'ul.web_ui__Tabs__content[role="tablist"] li[role="tab"]',
  // Level 1 category container (appears on hover of main tab)
  LEVEL1_CONTAINER: '.catalog-dropdown__level1-container',
  // Level 1 category links
  LEVEL1_LINKS: '.catalog-dropdown__level1-container a.web_ui__Cell__cell',
  // Level 2 category container (appears on hover of level 1 category)
  LEVEL2_CONTAINER: '.catalog-dropdown__level2-container',
  // Level 2 category links
  LEVEL2_LINKS: '.catalog-dropdown__level2-container a.web_ui__Cell__cell',
  // Category name text
  CATEGORY_NAME: '.web_ui__Text__text',
} as const;

/**
 * Vinted-specific category discovery adapter.
 *
 * Vinted uses an interactive dropdown menu that requires hovering to reveal categories:
 * - Main tabs (Femmes, Hommes, Enfants, etc.) in a tablist
 * - Level 1 categories appear when hovering on a main tab
 * - Level 2 subcategories appear when hovering on a level 1 category
 *
 * URL Pattern: /catalog/{id}-{slug} (e.g., /catalog/4-clothing, /catalog/13-jumpers-and-sweaters)
 *
 * Discovery Strategy:
 * 1. Primary: Use Puppeteer to navigate and hover through the category menu
 * 2. Fallback: Load from database (pre-seeded categories)
 */
@Injectable()
export class VintedCategoryDiscoveryAdapter implements ICategoryDiscoveryAdapter {
  readonly siteId = SiteSource.VINTED;
  readonly baseUrl = VINTED_DISCOVERY_CONFIG.BASE_URL;

  private readonly logger = new Logger(VintedCategoryDiscoveryAdapter.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly puppeteerPool: PuppeteerPoolService,
  ) {}

  /**
   * Discovers all categories from Vinted catalog page.
   * Uses Puppeteer to interact with the dropdown menu and extract categories.
   */
  async discoverCategories(): Promise<CategoryMetadata[]> {
    this.logger.log('🔍 Starting Vinted category discovery...');

    // Strategy 1: Try interactive Puppeteer scraping
    try {
      const categories = await this.discoverWithPuppeteer();
      if (categories.length > 0) {
        this.logger.log(
          `✅ Vinted Puppeteer discovery succeeded: ${categories.length} categories`
        );
        return categories;
      }
    } catch (error) {
      const errorMessage = extractErrorMessage(error);
      this.logger.warn(
        `⚠️ Vinted Puppeteer discovery failed: ${errorMessage}, trying database fallback...`
      );
    }

    // Strategy 2: Fallback to database
    if (VINTED_DISCOVERY_CONFIG.USE_DATABASE_FALLBACK) {
      try {
        const categories = await this.discoverFromDatabase();
        this.logger.log(
          `✅ Vinted database fallback succeeded: ${categories.length} categories`
        );
        return categories;
      } catch (error) {
        const errorMessage = extractErrorMessage(error);
        this.logger.error('❌ Vinted database fallback failed:', errorMessage);
        throw error;
      }
    }

    throw new Error(
      'All Vinted category discovery strategies failed. Please ensure database is seeded or website is accessible.'
    );
  }

  /**
   * Strategy 1: Discover categories using Puppeteer with hover interactions
   *
   * Hierarchy:
   * - Level 0: Main tabs (Femmes, Hommes, Enfants, etc.) - synthetic slugs
   * - Level 1: Categories (Vêtements, Chaussures, etc.) - parent = main tab
   * - Level 2: Subcategories (Shorts, T-shirts, etc.) - parent = level 1
   */
  private async discoverWithPuppeteer(): Promise<CategoryMetadata[]> {
    this.logger.debug('Starting Puppeteer-based category discovery...');

    const browser = await this.puppeteerPool.acquire();
    let page = null;
    let recorder: Awaited<ReturnType<typeof this.puppeteerPool.startScreencast>> = null;

    try {
      page = await this.puppeteerPool.createPage(browser);
      page.setDefaultNavigationTimeout(VINTED_DISCOVERY_CONFIG.BROWSER_TIMEOUT_MS);

      // Start screencast recording in non-production mode
      recorder = await this.puppeteerPool.startScreencast(page, 'vinted-discovery');

      // Navigate to catalog page
      this.logger.debug(`Navigating to ${VINTED_DISCOVERY_CONFIG.CATALOG_URL}...`);
      await page.goto(VINTED_DISCOVERY_CONFIG.CATALOG_URL, {
        waitUntil: 'networkidle2',
      });

      // Wait for the main tabs to be visible
      await page.waitForSelector(VINTED_SELECTORS.MAIN_TABS, { timeout: 10000 });

      const categories: CategoryMetadata[] = [];

      // Get all main tab buttons
      const mainTabs = await page.$$(VINTED_SELECTORS.MAIN_TABS);
      this.logger.debug(`Found ${mainTabs.length} main tabs`);

      for (let tabIndex = 0; tabIndex < mainTabs.length; tabIndex++) {
        const tab = mainTabs[tabIndex];

        // Get tab name and create a slug for it
        const tabName = await tab.evaluate((el) => el.textContent?.trim() || '');
        const tabSlug = this.createSlugFromName(tabName);

        if (!tabName || !tabSlug) {
          this.logger.debug(`Skipping tab ${tabIndex + 1}: empty name`);
          continue;
        }

        this.logger.debug(`Processing main tab ${tabIndex + 1}: "${tabName}" (slug: ${tabSlug})`);

        // Add main tab as level 0 category (root)
        // These are navigation-only tabs, not real scrapeable categories
        categories.push({
          slug: tabSlug,
          name: this.cleanCategoryName(tabName),
          url: `${this.baseUrl}/catalog?tab=${tabSlug}`, // Synthetic URL for the tab
          parentId: null, // Root level
          isSelectable: false, // Main tabs are not selectable, only for hierarchy display
        });

        // Hover on the tab to reveal level 1 categories
        await tab.hover();
        await delay(VINTED_DISCOVERY_CONFIG.HOVER_DELAY_MS);

        // Wait for level 1 container to appear
        try {
          await page.waitForSelector(VINTED_SELECTORS.LEVEL1_CONTAINER, {
            visible: true,
            timeout: 3000
          });
        } catch {
          this.logger.debug(`No level 1 container found for tab "${tabName}", skipping...`);
          continue;
        }

        // Get all level 1 category links
        const level1Links = await page.$$(VINTED_SELECTORS.LEVEL1_LINKS);
        this.logger.debug(`Found ${level1Links.length} level 1 categories under "${tabName}"`);

        for (let l1Index = 0; l1Index < level1Links.length; l1Index++) {
          const l1Link = level1Links[l1Index];

          // Extract level 1 category info
          const l1Info = await l1Link.evaluate((el) => {
            const href = el.getAttribute('href') || '';
            const nameEl = el.querySelector('.web_ui__Text__text');
            const name = nameEl?.textContent?.trim() || el.textContent?.trim() || '';
            return { href, name };
          });

          if (l1Info.href && l1Info.name) {
            const l1BaseSlug = this.extractSlugFromUrl(l1Info.href);
            if (l1BaseSlug) {
              // Create unique slug by prefixing with tab slug
              // e.g., "femmes/4-clothing" instead of just "4-clothing"
              const l1Slug = `${tabSlug}/${l1BaseSlug}`;

              // Add level 1 category with parent = main tab
              // These have real URLs and can be scraped
              categories.push({
                slug: l1Slug,
                name: this.cleanCategoryName(l1Info.name),
                url: l1Info.href.startsWith('http')
                  ? l1Info.href
                  : `${this.baseUrl}${l1Info.href}`,
                parentId: tabSlug, // Link to parent main tab
                isSelectable: true, // Real category with scrapeable URL
              });

              // Hover on level 1 to reveal level 2 categories
              await l1Link.hover();
              await delay(VINTED_DISCOVERY_CONFIG.HOVER_DELAY_MS);

              // Try to find level 2 categories
              try {
                await page.waitForSelector(VINTED_SELECTORS.LEVEL2_CONTAINER, {
                  visible: true,
                  timeout: 1500
                });

                const level2Links = await page.$$(VINTED_SELECTORS.LEVEL2_LINKS);
                this.logger.debug(
                  `Found ${level2Links.length} level 2 categories under "${l1Info.name}"`
                );

                for (const l2Link of level2Links) {
                  const l2Info = await l2Link.evaluate((el) => {
                    const href = el.getAttribute('href') || '';
                    const nameEl = el.querySelector('.web_ui__Text__text');
                    const name = nameEl?.textContent?.trim() || el.textContent?.trim() || '';
                    return { href, name };
                  });

                  if (l2Info.href && l2Info.name) {
                    const l2BaseSlug = this.extractSlugFromUrl(l2Info.href);
                    if (l2BaseSlug && l2BaseSlug !== l1BaseSlug) {
                      // Create unique slug by prefixing with tab and level 1 slugs
                      // e.g., "femmes/4-clothing/13-shorts"
                      const l2Slug = `${tabSlug}/${l2BaseSlug}`;

                      categories.push({
                        slug: l2Slug,
                        name: this.cleanCategoryName(l2Info.name),
                        url: l2Info.href.startsWith('http')
                          ? l2Info.href
                          : `${this.baseUrl}${l2Info.href}`,
                        parentId: l1Slug, // Link to parent level 1 category
                        isSelectable: true, // Real category with scrapeable URL
                      });
                    }
                  }
                }
              } catch {
                // No level 2 categories for this level 1, that's OK
                this.logger.debug(`No level 2 categories found for "${l1Info.name}"`);
              }
            }
          }
        }

        // Move mouse away to close the dropdown before next tab
        await page.mouse.move(0, 0);
        await delay(300);
      }

      const uniqueCategories = this.deduplicateCategories(categories);
      this.logger.debug(`Discovered ${uniqueCategories.length} unique categories`);

      return uniqueCategories;
    } finally {
      await this.puppeteerPool.stopScreencast(recorder);
      if (page) {
        await page.close();
      }
      await this.puppeteerPool.release(browser);
    }
  }

  /**
   * Strategy 2: Load categories from database (fallback)
   */
  private async discoverFromDatabase(): Promise<CategoryMetadata[]> {
    this.logger.debug('Loading categories from database...');

    const dbCategories = await this.prisma.category.findMany({
      where: { siteId: SiteSource.VINTED, isActive: true },
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
   * Builds hierarchical category tree.
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
    categories.forEach((cat) => {
      const node = categoryMap.get(cat.slug)!;
      if (cat.parentId) {
        const parent = categoryMap.get(cat.parentId);
        if (parent) {
          parent.children.push(node);
        } else {
          rootNodes.push(node);
        }
      } else {
        rootNodes.push(node);
      }
    });

    this.logger.log(
      `📊 Built category tree: ${rootNodes.length} root categories, ${categories.length - rootNodes.length} subcategories`
    );

    return rootNodes;
  }

  /**
   * Extract category slug from Vinted URL.
   * Vinted uses /catalog/{id}-{slug} pattern.
   * Example: /catalog/4-clothing → "4-clothing"
   * Example: /catalog/13-jumpers-and-sweaters → "13-jumpers-and-sweaters"
   */
  private extractSlugFromUrl(url: string): string | null {
    // Pattern: /catalog/{id}-{slug} or /catalog/{id}
    const catalogMatch = url.match(/\/catalog\/([^/?]+)/);
    if (catalogMatch) {
      return catalogMatch[1];
    }

    // Fallback: catalog[]=XXXX query parameter (old pattern)
    const catalogArrayMatch = url.match(/catalog\[\]=(\d+)/);
    if (catalogArrayMatch) {
      return catalogArrayMatch[1];
    }

    return null;
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
      .substring(0, VINTED_DISCOVERY_CONFIG.MAX_CATEGORY_NAME_LENGTH);
  }

  /**
   * Create a URL-friendly slug from a category name
   * e.g., "Femmes" → "femmes", "Maison & Jardin" → "maison-jardin"
   */
  private createSlugFromName(name: string): string {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents
      .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with dashes
      .replace(/^-+|-+$/g, '') // Trim leading/trailing dashes
      .substring(0, 50);
  }

}
