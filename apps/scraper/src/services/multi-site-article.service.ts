/**
 * MultiSiteArticleService
 *
 * Handles creation of articles with site-specific extension tables
 * and Elasticsearch indexing. This service bridges the gap between
 * adapter output (UniversalListing) and the database schema.
 *
 * Flow:
 * 1. Adapter extracts UniversalListing with siteSpecificData
 * 2. This service creates Article + Extension in a transaction
 * 3. Loads ArticleWrapper for type-safe access
 * 4. Indexes to Elasticsearch
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '@dealscrapper/database';
import { createServiceLogger } from '@dealscrapper/shared-logging';
import { ArticleWrapper, SiteSource } from '@dealscrapper/shared-types/article';
import type { Article, Prisma } from '@dealscrapper/database';
import { scraperLogConfig } from '../config/logging.config.js';
import { DealProcessingUtils } from '../common/deal-processing.utils.js';
import { ElasticsearchIndexerService } from '../elasticsearch/services/elasticsearch-indexer.service.js';
import type {
  UniversalListing,
  DealabsData,
  VintedData,
  LeBonCoinData,
} from '../adapters/base/site-adapter.interface.js';

export interface ArticleCreationResult {
  article: Article;
  indexed: boolean;
  error?: string;
}

export interface BulkCreationResult {
  created: Article[];
  existing: Article[]; // Articles that already existed (for filter matching)
  indexed: number;
  skipped: number;
  errors: string[];
}

@Injectable()
export class MultiSiteArticleService {
  private readonly logger = createServiceLogger(scraperLogConfig);

  constructor(
    private readonly prisma: PrismaService,
    private readonly elasticsearchIndexer: ElasticsearchIndexerService,
  ) {}

  /**
   * Creates an article from a UniversalListing with proper extension data
   * and indexes to Elasticsearch.
   */
  async createFromListing(
    listing: UniversalListing,
    categoryId: string,
  ): Promise<ArticleCreationResult> {
    try {
      // Step 1: Create Article + Extension in a transaction
      const article = await this.prisma.$transaction(async (tx) => {
        // Create base article
        const baseArticle = await tx.article.create({
          data: this.buildArticleCreateInput(listing, categoryId),
        });

        // Create site-specific extension
        await this.createExtension(tx, baseArticle.id, listing);

        // First price observation: no previous price on create
        await this.recordPriceObservation(
          tx,
          baseArticle.id,
          listing.currentPrice,
          null,
        );

        return baseArticle;
      });

      // Step 3: Index to Elasticsearch (fire-and-forget, don't block)
      let indexed = false;
      try {
        const wrapper = await ArticleWrapper.load(article.id, this.prisma);
        await this.elasticsearchIndexer.indexArticle(wrapper);
        indexed = true;
        this.logger.debug(
          `Indexed article ${article.id} from ${listing.siteId}`,
        );
      } catch (esError) {
        this.logger.warn(
          `Failed to index article ${article.id} to Elasticsearch: ${String(esError)}`,
        );
      }

      return { article, indexed };
    } catch (error) {
      // Handle race condition: article was created by a concurrent job
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        this.logger.debug(
          `Article ${listing.externalId} already exists (concurrent insert), fetching existing`,
        );
        const existing = await this.prisma.article.findFirst({
          where: {
            siteId: listing.siteId,
            externalId: listing.externalId,
          },
        });
        if (existing) {
          return { article: existing, indexed: false };
        }
      }
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to create article from listing ${listing.externalId}: ${errorMessage}`,
      );
      throw error;
    }
  }

  /**
   * Creates multiple articles from listings with bulk Elasticsearch indexing.
   */
  async createManyFromListings(
    listings: UniversalListing[],
    categoryId: string,
  ): Promise<BulkCreationResult> {
    const created: Article[] = [];
    const existing: Article[] = []; // Track existing articles for filter matching
    const errors: string[] = [];
    let skipped = 0;

    // Process each listing
    for (const listing of listings) {
      try {
        // Check if article already exists
        const existingArticle = await this.prisma.article.findFirst({
          where: {
            siteId: listing.siteId,
            externalId: listing.externalId,
          },
        });

        if (existingArticle) {
          skipped++;
          existing.push(existingArticle); // Add to existing list for filter matching
          continue;
        }

        const result = await this.createFromListing(listing, categoryId);
        created.push(result.article);
      } catch (error) {
        // Handle race condition: another concurrent job may have created the same article
        // between our findFirst check and the create call
        if (
          error &&
          typeof error === 'object' &&
          'code' in error &&
          error.code === 'P2002'
        ) {
          const raceExisting = await this.prisma.article.findFirst({
            where: {
              siteId: listing.siteId,
              externalId: listing.externalId,
            },
          });
          if (raceExisting) {
            skipped++;
            existing.push(raceExisting);
          }
          continue;
        }
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        errors.push(`${listing.externalId}: ${errorMessage}`);
      }
    }

    // Bulk index all created articles
    let indexed = 0;
    if (created.length > 0) {
      try {
        const wrappers = await ArticleWrapper.loadMany(
          created.map((a) => a.id),
          this.prisma,
        );
        const bulkResult = await this.elasticsearchIndexer.bulkIndex(wrappers);
        indexed = bulkResult.items.filter(
          (item: { index?: { error?: unknown } }) => !item.index?.error
        ).length;
        this.logger.log(
          `Bulk indexed ${indexed}/${created.length} articles to Elasticsearch`,
        );
      } catch (esError) {
        this.logger.warn(
          `Bulk Elasticsearch indexing failed: ${String(esError)}`,
        );
      }
    }

    return { created, existing, indexed, skipped, errors };
  }

  /**
   * Upserts an article from a listing (creates or updates).
   */
  async upsertFromListing(
    listing: UniversalListing,
    categoryId: string,
  ): Promise<ArticleCreationResult> {
    try {
      // Check if article exists
      const existing = await this.prisma.article.findFirst({
        where: {
          siteId: listing.siteId,
          externalId: listing.externalId,
        },
      });

      if (existing) {
        // Update existing article
        return await this.updateFromListing(
          existing.id,
          listing,
          categoryId,
          existing.currentPrice,
        );
      }

      // Create new article
      return await this.createFromListing(listing, categoryId);
    } catch (error) {
      // Handle race condition: article was created between findFirst and create
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        const raceExisting = await this.prisma.article.findFirst({
          where: {
            siteId: listing.siteId,
            externalId: listing.externalId,
          },
        });
        if (raceExisting) {
          return await this.updateFromListing(
            raceExisting.id,
            listing,
            categoryId,
            raceExisting.currentPrice,
          );
        }
      }
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to upsert article ${listing.externalId}: ${errorMessage}`,
      );
      throw error;
    }
  }

  /**
   * Updates an existing article from a listing.
   */
  private async updateFromListing(
    articleId: string,
    listing: UniversalListing,
    categoryId: string,
    previousPrice: number | null,
  ): Promise<ArticleCreationResult> {
    const article = await this.prisma.$transaction(async (tx) => {
      // Update base article
      const updatedArticle = await tx.article.update({
        where: { id: articleId },
        data: {
          title: listing.title,
          description: listing.description,
          currentPrice: listing.currentPrice,
          imageUrl: listing.imageUrl,
          location: listing.location,
          isActive: listing.isActive,
          scrapedAt: new Date(),
          categoryId,
        },
      });

      // Update extension
      await this.updateExtension(tx, articleId, listing);

      // Append a price observation only when the price actually changed
      await this.recordPriceObservation(
        tx,
        articleId,
        listing.currentPrice,
        previousPrice,
      );

      return updatedArticle;
    });

    // Re-index to Elasticsearch
    let indexed = false;
    try {
      const wrapper = await ArticleWrapper.load(article.id, this.prisma);
      await this.elasticsearchIndexer.indexArticle(wrapper);
      indexed = true;
    } catch (esError) {
      this.logger.warn(
        `Failed to re-index article ${article.id}: ${String(esError)}`,
      );
    }

    return { article, indexed };
  }

  /**
   * Append-only, change-gated price history (PriceGhost style): insert a
   * PriceObservation only when the price is known and differs from the last
   * recorded price. Article.currentPrice remains the fast-read "latest".
   */
  private async recordPriceObservation(
    tx: Prisma.TransactionClient,
    articleId: string,
    newPrice: number | null,
    previousPrice: number | null,
  ): Promise<void> {
    if (newPrice == null) return; // no price, nothing to record
    if (newPrice === previousPrice) return; // change-gated: skip unchanged
    await tx.priceObservation.create({ data: { articleId, price: newPrice } });

    // Phase 6 foundation: detect drops so they become visible now and reusable
    // by the alert wiring later. ponytail: log-only until a consumer needs it.
    const drop = DealProcessingUtils.computePriceDrop(previousPrice, newPrice);
    if (drop) {
      this.logger.log(
        `Price drop on article ${articleId}: ${drop.previousPrice} -> ${drop.currentPrice} ` +
          `(-${drop.amount}, -${drop.percentage}%)`,
      );
    }
  }

  /**
   * Builds Prisma ArticleCreateInput from UniversalListing.
   * Note: originalPrice is stored in site-specific extension tables, not base Article.
   */
  private buildArticleCreateInput(
    listing: UniversalListing,
    categoryId: string,
  ): Prisma.ArticleCreateInput {
    return {
      externalId: listing.externalId,
      title: listing.title,
      description: listing.description,
      url: listing.url,
      imageUrl: listing.imageUrl,
      currentPrice: listing.currentPrice,
      location: listing.location,
      publishedAt: listing.publishedAt,
      isActive: listing.isActive,
      scrapedAt: new Date(),
      site: {
        connect: { id: listing.siteId },
      },
      category: {
        connect: { id: categoryId },
      },
    };
  }

  /**
   * Creates the site-specific extension record.
   */
  private async createExtension(
    tx: Prisma.TransactionClient,
    articleId: string,
    listing: UniversalListing,
  ): Promise<void> {
    const { siteSpecificData } = listing;

    switch (siteSpecificData.type) {
      case SiteSource.DEALABS:
        await this.createDealabsExtension(tx, articleId, siteSpecificData, listing);
        break;
      case SiteSource.VINTED:
        await this.createVintedExtension(tx, articleId, siteSpecificData);
        break;
      case SiteSource.LEBONCOIN:
        await this.createLeBonCoinExtension(tx, articleId, siteSpecificData);
        break;
      default:
        throw new Error(
          `Unknown site type: ${(siteSpecificData as { type: string }).type}`,
        );
    }
  }

  /**
   * Updates the site-specific extension record.
   */
  private async updateExtension(
    tx: Prisma.TransactionClient,
    articleId: string,
    listing: UniversalListing,
  ): Promise<void> {
    const { siteSpecificData } = listing;

    switch (siteSpecificData.type) {
      case SiteSource.DEALABS:
        await tx.articleDealabs.update({
          where: { articleId },
          data: {
            temperature: siteSpecificData.temperature ?? undefined,
            commentCount: siteSpecificData.commentCount ?? undefined,
            communityVerified: siteSpecificData.communityVerified,
            freeShipping: siteSpecificData.freeShipping,
            isCoupon: siteSpecificData.isCoupon,
            discountPercentage: siteSpecificData.discountPercentage,
            originalPrice: listing.originalPrice,
            merchant: listing.merchant,
            expiresAt: siteSpecificData.expiresAt,
          },
        });
        break;
      case SiteSource.VINTED:
        await tx.articleVinted.update({
          where: { articleId },
          data: {
            favoriteCount: siteSpecificData.favoriteCount ?? undefined,
            viewCount: siteSpecificData.viewCount ?? undefined,
            condition: siteSpecificData.itemCondition,
            brand: siteSpecificData.brand,
            size: siteSpecificData.size,
            color: siteSpecificData.color,
            sellerRating: siteSpecificData.sellerRating,
            sellerName: siteSpecificData.sellerName,
          },
        });
        break;
      case SiteSource.LEBONCOIN:
        await tx.articleLeBonCoin.update({
          where: { articleId },
          data: {
            city: siteSpecificData.city,
            postcode: siteSpecificData.postcode,
            department: siteSpecificData.department,
            region: siteSpecificData.region,
            proSeller: siteSpecificData.proSeller ?? undefined,
            sellerName: siteSpecificData.sellerName,
            urgentFlag: siteSpecificData.urgentFlag ?? undefined,
          },
        });
        break;
    }
  }

  private async createDealabsExtension(
    tx: Prisma.TransactionClient,
    articleId: string,
    data: DealabsData,
    listing: UniversalListing,
  ): Promise<void> {
    // Map null -> undefined for non-nullable DB columns so Prisma applies its
    // schema-level default (e.g. temperature=0) instead of us fabricating one.
    await tx.articleDealabs.create({
      data: {
        articleId,
        temperature: data.temperature ?? undefined,
        commentCount: data.commentCount ?? undefined,
        communityVerified: data.communityVerified,
        freeShipping: data.freeShipping,
        isCoupon: data.isCoupon,
        discountPercentage: data.discountPercentage,
        originalPrice: listing.originalPrice,
        merchant: listing.merchant,
        expiresAt: data.expiresAt,
      },
    });
  }

  private async createVintedExtension(
    tx: Prisma.TransactionClient,
    articleId: string,
    data: VintedData,
  ): Promise<void> {
    // DB has @default on favoriteCount/viewCount; condition is required and
    // enforced upstream by validateVintedListing.
    await tx.articleVinted.create({
      data: {
        articleId,
        favoriteCount: data.favoriteCount ?? undefined,
        viewCount: data.viewCount ?? undefined,
        condition: data.itemCondition,
        brand: data.brand,
        size: data.size,
        color: data.color,
        sellerRating: data.sellerRating,
        sellerName: data.sellerName,
      },
    });
  }

  private async createLeBonCoinExtension(
    tx: Prisma.TransactionClient,
    articleId: string,
    data: LeBonCoinData,
  ): Promise<void> {
    // proSeller/urgentFlag are null when the LLM didn't see the badge; let
    // Prisma apply the schema default rather than fabricating `false`.
    await tx.articleLeBonCoin.create({
      data: {
        articleId,
        city: data.city,
        postcode: data.postcode,
        department: data.department,
        region: data.region,
        proSeller: data.proSeller ?? undefined,
        sellerName: data.sellerName,
        urgentFlag: data.urgentFlag ?? undefined,
      },
    });
  }
}
