import type { PrismaClient } from '@prisma/client';
import type {
  Article,
  ArticleDealabs,
  ArticleVinted,
  ArticleLeBonCoin,
} from '@prisma/client';

// Import SiteSource for use in this file and re-export for backward compatibility
// with imports from '@dealscrapper/shared-types/article'
import { SiteSource } from '../site-source.js';
export { SiteSource };

/**
 * Discriminated union for site-specific extension data
 */
export type SiteExtension = ArticleDealabs | ArticleVinted | ArticleLeBonCoin;

/**
 * Exception thrown when an article or its extension is not found
 */
export class ArticleNotFoundException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ArticleNotFoundException';
  }
}

/**
 * ArticleWrapper implements the Wrapper Pattern for multi-site article data.
 *
 * **Architecture**:
 * - Base Article model contains ONLY universal fields (all sites)
 * - Extension tables (ArticleDealabs, ArticleVinted, ArticleLeBonCoin) contain site-specific fields
 * - NO Prisma relations between Article and extensions (application layer only)
 * - 2-step loading: Load base Article, then load extension based on `source` field
 *
 * **Usage**:
 * ```typescript
 * // Load single article
 * const wrapper = await ArticleWrapper.load('article-id', prisma);
 *
 * // Type guards for site-specific access
 * if (wrapper.isDealabs()) {
 *   console.log(wrapper.extension.temperature); // TypeScript knows this is ArticleDealabs
 * }
 *
 * // Load multiple articles
 * const wrappers = await ArticleWrapper.loadMany(['id1', 'id2'], prisma);
 * ```
 */
export class ArticleWrapper {
  constructor(
    public readonly base: Article,
    public readonly extension: SiteExtension,
    public readonly source: SiteSource,
  ) {}

  /**
   * Type guard: Check if article is from Dealabs
   */
  isDealabs(): this is ArticleWrapper & { extension: ArticleDealabs } {
    return this.source === SiteSource.DEALABS;
  }

  /**
   * Type guard: Check if article is from Vinted
   */
  isVinted(): this is ArticleWrapper & { extension: ArticleVinted } {
    return this.source === SiteSource.VINTED;
  }

  /**
   * Type guard: Check if article is from LeBonCoin
   */
  isLeBonCoin(): this is ArticleWrapper & { extension: ArticleLeBonCoin } {
    return this.source === SiteSource.LEBONCOIN;
  }

  /**
   * Load a single article with its site-specific extension.
   *
   * **2-Step Loading Process**:
   * 1. Load base Article by ID
   * 2. Load site-specific extension based on Article.source
   *
   * @param id - Article ID (internal CUID, not externalId)
   * @param prisma - PrismaClient instance
   * @throws {ArticleNotFoundException} If article or extension not found
   * @returns ArticleWrapper with base + extension data
   */
  static async load(
    id: string,
    prisma: PrismaClient,
  ): Promise<ArticleWrapper> {
    // Step 1: Load base Article
    const article = await prisma.article.findUnique({
      where: { id },
      include: {
        category: true, // Include category for context
      },
    });

    if (!article) {
      throw new ArticleNotFoundException(`Article with id "${id}" not found`);
    }

    // Step 2: Load extension based on siteId
    const source = article.siteId as SiteSource;
    let extension: SiteExtension;

    switch (source) {
      case SiteSource.DEALABS: {
        const dealabsExtension = await prisma.articleDealabs.findUnique({
          where: { articleId: id },
        });
        if (!dealabsExtension) {
          throw new ArticleNotFoundException(
            `ArticleDealabs extension for article "${id}" not found`,
          );
        }
        extension = dealabsExtension;
        break;
      }

      case SiteSource.VINTED: {
        const vintedExtension = await prisma.articleVinted.findUnique({
          where: { articleId: id },
        });
        if (!vintedExtension) {
          throw new ArticleNotFoundException(
            `ArticleVinted extension for article "${id}" not found`,
          );
        }
        extension = vintedExtension;
        break;
      }

      case SiteSource.LEBONCOIN: {
        const leboncoinExtension = await prisma.articleLeBonCoin.findUnique({
          where: { articleId: id },
        });
        if (!leboncoinExtension) {
          throw new ArticleNotFoundException(
            `ArticleLeBonCoin extension for article "${id}" not found`,
          );
        }
        extension = leboncoinExtension;
        break;
      }

      default:
        throw new ArticleNotFoundException(
          `Unknown article siteId: ${article.siteId}`,
        );
    }

    return new ArticleWrapper(article, extension, source);
  }

  /**
   * Load multiple articles with their site-specific extensions.
   *
   * This method performs batch loading for efficiency:
   * 1. Load all base Articles
   * 2. Group by source
   * 3. Batch load extensions per source
   * 4. Combine into ArticleWrappers
   *
   * @param ids - Array of Article IDs
   * @param prisma - PrismaClient instance
   * @returns Array of ArticleWrappers (same order as input IDs)
   * @throws {ArticleNotFoundException} If any article or extension not found
   */
  static async loadMany(
    ids: string[],
    prisma: PrismaClient,
  ): Promise<ArticleWrapper[]> {
    if (ids.length === 0) {
      return [];
    }

    // Step 1: Load all base Articles
    const articles = await prisma.article.findMany({
      where: { id: { in: ids } },
      include: {
        category: true,
      },
    });

    if (articles.length !== ids.length) {
      const foundIds = new Set(articles.map((a) => a.id));
      const missingIds = ids.filter((id) => !foundIds.has(id));
      throw new ArticleNotFoundException(
        `Articles not found: ${missingIds.join(', ')}`,
      );
    }

    // Step 2: Group articles by siteId
    const articlesBySource: Record<string, Article[]> = {};
    for (const article of articles) {
      if (!articlesBySource[article.siteId]) {
        articlesBySource[article.siteId] = [];
      }
      articlesBySource[article.siteId].push(article);
    }

    // Step 3: Batch load extensions per source
    const extensionMap = new Map<string, SiteExtension>();

    // Load Dealabs extensions
    if (articlesBySource[SiteSource.DEALABS]?.length > 0) {
      const dealabsIds = articlesBySource[SiteSource.DEALABS].map((a) => a.id);
      const dealabsExtensions = await prisma.articleDealabs.findMany({
        where: { articleId: { in: dealabsIds } },
      });

      if (dealabsExtensions.length !== dealabsIds.length) {
        throw new ArticleNotFoundException(
          `Some ArticleDealabs extensions not found`,
        );
      }

      for (const ext of dealabsExtensions) {
        extensionMap.set(ext.articleId, ext);
      }
    }

    // Load Vinted extensions
    if (articlesBySource[SiteSource.VINTED]?.length > 0) {
      const vintedIds = articlesBySource[SiteSource.VINTED].map((a) => a.id);
      const vintedExtensions = await prisma.articleVinted.findMany({
        where: { articleId: { in: vintedIds } },
      });

      if (vintedExtensions.length !== vintedIds.length) {
        throw new ArticleNotFoundException(
          `Some ArticleVinted extensions not found`,
        );
      }

      for (const ext of vintedExtensions) {
        extensionMap.set(ext.articleId, ext);
      }
    }

    // Load LeBonCoin extensions
    if (articlesBySource[SiteSource.LEBONCOIN]?.length > 0) {
      const leboncoinIds = articlesBySource[SiteSource.LEBONCOIN].map(
        (a) => a.id,
      );
      const leboncoinExtensions = await prisma.articleLeBonCoin.findMany({
        where: { articleId: { in: leboncoinIds } },
      });

      if (leboncoinExtensions.length !== leboncoinIds.length) {
        throw new ArticleNotFoundException(
          `Some ArticleLeBonCoin extensions not found`,
        );
      }

      for (const ext of leboncoinExtensions) {
        extensionMap.set(ext.articleId, ext);
      }
    }

    // Step 4: Combine into ArticleWrappers (preserve input order)
    const wrappers: ArticleWrapper[] = [];
    for (const id of ids) {
      const article = articles.find((a) => a.id === id)!;
      const extension = extensionMap.get(id);

      if (!extension) {
        throw new ArticleNotFoundException(
          `Extension for article "${id}" not found`,
        );
      }

      wrappers.push(
        new ArticleWrapper(article, extension, article.siteId as SiteSource),
      );
    }

    return wrappers;
  }
}
