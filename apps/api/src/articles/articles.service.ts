/**
 * @fileoverview Articles service for Elasticsearch-powered article search
 *
 * **Architecture**:
 * - Queries Elasticsearch for fast full-text and filtered search
 * - Loads full ArticleWrapper data from PostgreSQL via Prisma
 * - Supports site-specific filtering (Dealabs, Vinted, LeBonCoin)
 *
 * **Search Flow**:
 * 1. Build Elasticsearch query from search parameters
 * 2. Execute search against 'articles' index
 * 3. Extract article IDs from search results
 * 4. Load full ArticleWrappers from database using Prisma
 * 5. Transform to response DTOs
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import { PrismaService } from '@dealscrapper/database';
import { ArticleWrapper, SiteSource } from '@dealscrapper/shared-types/article';
import { ProductSuggestion } from '@dealscrapper/shared-types';
import { SearchArticlesDto } from './dto/search-articles.dto.js';
import {
  ArticleResponseDto,
  ArticleListResponseDto,
  BaseArticleDto,
  DealabsExtensionDto,
  VintedExtensionDto,
  LeBonCoinExtensionDto,
} from './dto/article-response.dto.js';
import { createServiceLogger } from '@dealscrapper/shared-logging';
import { apiLogConfig } from '../config/logging.config.js';

/**
 * Internal search parameters matching Elasticsearch indexer
 */
interface SearchParams {
  q?: string;
  sites?: SiteSource[];
  priceMin?: number;
  priceMax?: number;
  categoryId?: string;
  dealabs_temperatureMin?: number;
  dealabs_temperatureMax?: number;
  dealabs_communityVerified?: boolean;
  dealabs_freeShipping?: boolean;
  vinted_favoriteCountMin?: number;
  vinted_brand?: string;
  vinted_size?: string;
  vinted_condition?: string;
  leboncoin_city?: string;
  leboncoin_postcode?: string;
  leboncoin_region?: string;
  leboncoin_proSeller?: boolean;
  leboncoin_urgentFlag?: boolean;
  from?: number;
  size?: number;
}

/**
 * Tunable defaults for cross-site "also found on" similarity suggestions.
 * Locked Appendix A design — strict defaults to favour precision.
 */
const SIMILAR_DEFAULTS = {
  minScore: 8.0,
  size: 5,
  minTermFreq: 1,
  minDocFreq: 1,
  maxQueryTerms: 25,
  minimumShouldMatch: '60%',
  priceRangeFactorLow: 0.85, // -15%
  priceRangeFactorHigh: 1.15, // +15%
} as const;

@Injectable()
export class ArticlesService {
  private readonly logger = createServiceLogger(apiLogConfig);
  private readonly indexName = 'articles';

  constructor(
    private readonly elasticsearchService: ElasticsearchService,
    private readonly prisma: PrismaService
  ) {}

  /**
   * Search articles with Elasticsearch and load full data from database
   *
   * @param dto - Search parameters from API request
   * @returns Paginated list of articles with full extension data
   */
  async search(dto: SearchArticlesDto): Promise<ArticleListResponseDto> {
    const params = this.dtoToSearchParams(dto);
    const query = this.buildSearchQuery(params);

    try {
      // Execute Elasticsearch search
      const response = await this.elasticsearchService.search({
        index: this.indexName,
        query,
        from: params.from ?? 0,
        size: params.size ?? 20,
        sort: [{ scrapedAt: { order: 'desc' } }],
        track_total_hits: true,
      });

      // Extract article IDs from search results
      const articleIds = response.hits.hits
        .map((hit: { _id?: string }) => hit._id)
        .filter(
          (id: string | undefined): id is string => typeof id === 'string'
        );

      if (articleIds.length === 0) {
        return {
          articles: [],
          total: 0,
          from: params.from ?? 0,
          size: params.size ?? 20,
        };
      }

      // Load full ArticleWrappers from database
      // PrismaService extends PrismaClient, so it's type-compatible
      const wrappers = await ArticleWrapper.loadMany(articleIds, this.prisma);

      // Transform to response DTOs
      const articles = wrappers.map((wrapper) =>
        this.wrapperToResponseDto(wrapper)
      );

      // Get total hits
      const total =
        typeof response.hits.total === 'number'
          ? response.hits.total
          : (response.hits.total?.value ?? 0);

      return {
        articles,
        total,
        from: params.from ?? 0,
        size: params.size ?? 20,
      };
    } catch (error) {
      this.logger.error(`Article search failed: ${error}`);
      throw error;
    }
  }

  /**
   * Get a single article by ID
   *
   * @param id - Article ID (internal CUID)
   * @returns Article with full extension data
   * @throws NotFoundException if article not found
   */
  async getById(id: string): Promise<ArticleResponseDto> {
    try {
      // PrismaService extends PrismaClient, so it's type-compatible
      const wrapper = await ArticleWrapper.load(id, this.prisma);
      return this.wrapperToResponseDto(wrapper);
    } catch (error) {
      if ((error as Error).name === 'ArticleNotFoundException') {
        throw new NotFoundException(`Article with ID "${id}" not found`);
      }
      throw error;
    }
  }

  /**
   * Find cross-site articles that look like the SAME product as the given
   * article ("also found on" suggestions).
   *
   * Uses an Elasticsearch `more_like_this` query on the article title, scoped
   * to active/non-expired articles from OTHER sites, optionally constrained to
   * a ±15% price band around the source article's current price.
   *
   * @param articleId - Source article ID (internal CUID)
   * @returns Up to 5 product suggestions sorted by relevance, or [] if the
   *   source article is not found
   */
  async findSimilar(articleId: string): Promise<ProductSuggestion[]> {
    let source: ArticleWrapper;
    try {
      // PrismaService extends PrismaClient, so it's type-compatible
      source = await ArticleWrapper.load(articleId, this.prisma);
    } catch (error) {
      if ((error as Error).name === 'ArticleNotFoundException') {
        return [];
      }
      throw error;
    }

    const query = this.buildSimilarQuery(
      source.base.title,
      source.source,
      source.base.currentPrice
    );

    try {
      const response = await this.elasticsearchService.search({
        index: this.indexName,
        min_score: SIMILAR_DEFAULTS.minScore,
        size: SIMILAR_DEFAULTS.size,
        query,
        sort: ['_score', { scrapedAt: { order: 'desc' } }],
      });

      return response.hits.hits.map((hit) => this.hitToSuggestion(hit));
    } catch (error) {
      this.logger.error(`Similar article search failed: ${error}`);
      throw error;
    }
  }

  // =============================================================================
  // Private Methods
  // =============================================================================

  /**
   * Convert DTO to internal search params
   */
  private dtoToSearchParams(dto: SearchArticlesDto): SearchParams {
    return {
      q: dto.q,
      sites: dto.sites,
      priceMin: dto.priceMin,
      priceMax: dto.priceMax,
      categoryId: dto.categoryId,
      dealabs_temperatureMin: dto.dealabs_temperatureMin,
      dealabs_temperatureMax: dto.dealabs_temperatureMax,
      dealabs_communityVerified: dto.dealabs_communityVerified,
      dealabs_freeShipping: dto.dealabs_freeShipping,
      vinted_favoriteCountMin: dto.vinted_favoriteCountMin,
      vinted_brand: dto.vinted_brand,
      vinted_size: dto.vinted_size,
      vinted_condition: dto.vinted_condition,
      leboncoin_city: dto.leboncoin_city,
      leboncoin_postcode: dto.leboncoin_postcode,
      leboncoin_region: dto.leboncoin_region,
      leboncoin_proSeller: dto.leboncoin_proSeller,
      leboncoin_urgentFlag: dto.leboncoin_urgentFlag,
      from: dto.from,
      size: dto.size,
    };
  }

  /**
   * Build Elasticsearch query from search parameters
   *
   * Ported from scraper's elasticsearch-indexer.service.ts buildSearchQuery()
   */
  private buildSearchQuery(params: SearchParams): Record<string, unknown> {
    const mustClauses: Record<string, unknown>[] = [];

    // Full-text search on title and description
    if (params.q) {
      mustClauses.push({
        multi_match: {
          query: params.q,
          fields: ['title^2', 'description'], // Boost title matches
          type: 'best_fields',
        },
      });
    }

    // Site filtering
    if (params.sites && params.sites.length > 0) {
      mustClauses.push({
        terms: {
          source: params.sites,
        },
      });
    }

    // Price range
    if (params.priceMin !== undefined || params.priceMax !== undefined) {
      const rangeQuery: Record<string, number> = {};
      if (params.priceMin !== undefined) {
        rangeQuery.gte = params.priceMin;
      }
      if (params.priceMax !== undefined) {
        rangeQuery.lte = params.priceMax;
      }
      mustClauses.push({
        range: {
          currentPrice: rangeQuery,
        },
      });
    }

    // Category filtering
    if (params.categoryId) {
      mustClauses.push({
        term: {
          categoryId: params.categoryId,
        },
      });
    }

    // Dealabs-specific filters
    if (params.dealabs_temperatureMin !== undefined) {
      mustClauses.push({
        range: {
          dealabs_temperature: { gte: params.dealabs_temperatureMin },
        },
      });
    }
    if (params.dealabs_temperatureMax !== undefined) {
      mustClauses.push({
        range: {
          dealabs_temperature: { lte: params.dealabs_temperatureMax },
        },
      });
    }
    if (params.dealabs_communityVerified !== undefined) {
      mustClauses.push({
        term: {
          dealabs_communityVerified: params.dealabs_communityVerified,
        },
      });
    }
    if (params.dealabs_freeShipping !== undefined) {
      mustClauses.push({
        term: {
          dealabs_freeShipping: params.dealabs_freeShipping,
        },
      });
    }

    // Vinted-specific filters
    if (params.vinted_favoriteCountMin !== undefined) {
      mustClauses.push({
        range: {
          vinted_favoriteCount: { gte: params.vinted_favoriteCountMin },
        },
      });
    }
    if (params.vinted_brand) {
      mustClauses.push({
        term: {
          vinted_brand: params.vinted_brand,
        },
      });
    }
    if (params.vinted_size) {
      mustClauses.push({
        term: {
          vinted_size: params.vinted_size,
        },
      });
    }
    if (params.vinted_condition) {
      mustClauses.push({
        term: {
          vinted_condition: params.vinted_condition,
        },
      });
    }

    // LeBonCoin-specific filters
    if (params.leboncoin_city) {
      mustClauses.push({
        term: {
          leboncoin_city: params.leboncoin_city,
        },
      });
    }
    if (params.leboncoin_postcode) {
      mustClauses.push({
        term: {
          leboncoin_postcode: params.leboncoin_postcode,
        },
      });
    }
    if (params.leboncoin_region) {
      mustClauses.push({
        term: {
          leboncoin_region: params.leboncoin_region,
        },
      });
    }
    if (params.leboncoin_proSeller !== undefined) {
      mustClauses.push({
        term: {
          leboncoin_proSeller: params.leboncoin_proSeller,
        },
      });
    }
    if (params.leboncoin_urgentFlag !== undefined) {
      mustClauses.push({
        term: {
          leboncoin_urgentFlag: params.leboncoin_urgentFlag,
        },
      });
    }

    // If no filters, match all
    if (mustClauses.length === 0) {
      return { match_all: {} };
    }

    // Combine all filters with AND logic
    return {
      bool: {
        must: mustClauses,
      },
    };
  }

  /**
   * Build the `more_like_this` query for cross-site product suggestions.
   *
   * Excludes the source site, restricts to active/non-expired articles, and
   * (when the source price is known) constrains to a ±15% price band.
   */
  private buildSimilarQuery(
    title: string,
    source: SiteSource,
    currentPrice: number | null
  ): Record<string, unknown> {
    const filter: Record<string, unknown>[] = [
      { term: { isActive: true } },
      { term: { isExpired: false } },
    ];

    // Only constrain by price when the source article has a known price.
    if (currentPrice !== null && currentPrice !== undefined) {
      filter.push({
        range: {
          currentPrice: {
            gte: currentPrice * SIMILAR_DEFAULTS.priceRangeFactorLow,
            lte: currentPrice * SIMILAR_DEFAULTS.priceRangeFactorHigh,
          },
        },
      });
    }

    return {
      bool: {
        must: [
          {
            more_like_this: {
              fields: ['title'],
              like: [{ doc: { title } }],
              min_term_freq: SIMILAR_DEFAULTS.minTermFreq,
              min_doc_freq: SIMILAR_DEFAULTS.minDocFreq,
              max_query_terms: SIMILAR_DEFAULTS.maxQueryTerms,
              minimum_should_match: SIMILAR_DEFAULTS.minimumShouldMatch,
            },
          },
        ],
        filter,
        must_not: [{ term: { source } }],
      },
    };
  }

  /**
   * Map an Elasticsearch hit to a ProductSuggestion, reading data directly
   * from `_source` (no per-hit database round-trip).
   */
  private hitToSuggestion(hit: {
    _id?: string;
    _score?: number | null;
    _source?: unknown;
  }): ProductSuggestion {
    const src = (hit._source ?? {}) as Record<string, unknown>;
    return {
      articleId: hit._id ?? '',
      score: hit._score ?? 0,
      source: src.source as SiteSource,
      title: src.title as string,
      currentPrice: (src.currentPrice as number | null) ?? null,
      url: src.url as string,
      scrapedAt: src.scrapedAt as Date,
    };
  }

  /**
   * Transform ArticleWrapper to response DTO
   */
  private wrapperToResponseDto(wrapper: ArticleWrapper): ArticleResponseDto {
    const base: BaseArticleDto = {
      id: wrapper.base.id,
      externalId: wrapper.base.externalId,
      source: wrapper.source,
      title: wrapper.base.title,
      description: wrapper.base.description,
      url: wrapper.base.url,
      imageUrl: wrapper.base.imageUrl,
      currentPrice: wrapper.base.currentPrice,
      categoryId: wrapper.base.categoryId,
      location: wrapper.base.location,
      publishedAt: wrapper.base.publishedAt,
      scrapedAt: wrapper.base.scrapedAt,
      isActive: wrapper.base.isActive,
      isExpired: wrapper.base.isExpired,
    };

    const response: ArticleResponseDto = {
      base,
      source: wrapper.source,
    };

    // Add site-specific extension
    if (wrapper.isDealabs()) {
      const ext = wrapper.extension;
      const dealabsExtension: DealabsExtensionDto = {
        temperature: ext.temperature,
        commentCount: ext.commentCount,
        communityVerified: ext.communityVerified,
        freeShipping: ext.freeShipping,
        isCoupon: ext.isCoupon,
        originalPrice: ext.originalPrice,
        discountPercentage: ext.discountPercentage,
        merchant: ext.merchant,
        expiresAt: ext.expiresAt,
      };
      response.dealabsExtension = dealabsExtension;
    } else if (wrapper.isVinted()) {
      const ext = wrapper.extension;
      const vintedExtension: VintedExtensionDto = {
        favoriteCount: ext.favoriteCount,
        viewCount: ext.viewCount,
        boosted: ext.boosted,
        brand: ext.brand,
        size: ext.size,
        color: ext.color,
        condition: ext.condition,
        sellerName: ext.sellerName,
        sellerRating: ext.sellerRating,
        buyerProtectionFee: ext.buyerProtectionFee,
      };
      response.vintedExtension = vintedExtension;
    } else if (wrapper.isLeBonCoin()) {
      const ext = wrapper.extension;
      const leboncoinExtension: LeBonCoinExtensionDto = {
        city: ext.city,
        postcode: ext.postcode,
        department: ext.department,
        region: ext.region,
        proSeller: ext.proSeller,
        urgentFlag: ext.urgentFlag,
        topAnnonce: ext.topAnnonce,
        deliveryOptions: ext.deliveryOptions,
        shippingCost: ext.shippingCost,
        condition: ext.condition,
        sellerName: ext.sellerName,
      };
      response.leboncoinExtension = leboncoinExtension;
    }

    return response;
  }
}
