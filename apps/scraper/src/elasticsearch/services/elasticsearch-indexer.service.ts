/**
 * @fileoverview ElasticSearch indexer service for multi-site article indexing and search
 *
 * **Architecture**:
 * - Flattened index schema (not nested)
 * - Site-specific fields with prefixes (dealabs_, vinted_, leboncoin_)
 * - Type-safe ArticleWrapper integration
 * - Bulk indexing support
 *
 * **Responsibilities**:
 * - Index articles to ElasticSearch after database save
 * - Search articles with full-text and site-specific filtering
 * - Convert FilterExpression to ElasticSearch query DSL
 * - Bulk reindexing for migrations
 */

import { Injectable, Logger, OnModuleInit, Inject } from '@nestjs/common';
import { Client, errors as esErrors } from '@elastic/elasticsearch';
import type { estypes } from '@elastic/elasticsearch';
import type { PrismaClient } from '@prisma/client';
import {
  type FilterExpression,
  type RuleBasedFilterExpression,
  type FilterRule,
  type FilterRuleGroup,
  type LogicalOperator,
  type FilterOperator,
  type FilterableField,
  SiteSource,
} from '@dealscrapper/shared-types';
import {
  ArticleWrapper,
} from '@dealscrapper/shared-types/article';
import { extractErrorMessage } from '@dealscrapper/shared';

import {
  ARTICLE_INDEX_MAPPING,
  ARTICLE_INDEX_SETTINGS,
  type ArticleIndexSettings,
} from '../mappings/article-index-mapping.js';

/**
 * Elasticsearch article document structure
 * Represents a flattened article document in the ES index
 */
export interface ElasticsearchArticleDocument {
  // Base fields (universal)
  id: string;
  externalId: string;
  source: SiteSource;
  title: string;
  description: string | null;
  url: string;
  imageUrl: string | null;
  currentPrice: number | null;
  categoryId: string | null;
  publishedAt: Date | null;
  scrapedAt: Date;
  isActive: boolean;
  isExpired: boolean;
  location: string | null;

  // Dealabs-specific fields
  dealabs_temperature?: number | null;
  dealabs_commentCount?: number | null;
  dealabs_communityVerified?: boolean | null;
  dealabs_freeShipping?: boolean | null;
  dealabs_isCoupon?: boolean | null;
  dealabs_originalPrice?: number | null;
  dealabs_discountPercentage?: number | null;
  dealabs_merchant?: string | null;
  dealabs_expiresAt?: Date | null;

  // Vinted-specific fields
  vinted_favoriteCount?: number | null;
  vinted_viewCount?: number | null;
  vinted_boosted?: boolean | null;
  vinted_brand?: string | null;
  vinted_size?: string | null;
  vinted_color?: string | null;
  vinted_condition?: string | null;
  vinted_sellerName?: string | null;
  vinted_sellerRating?: number | null;
  vinted_buyerProtectionFee?: number | null;

  // LeBonCoin-specific fields
  leboncoin_city?: string | null;
  leboncoin_postcode?: string | null;
  leboncoin_department?: string | null;
  leboncoin_region?: string | null;
  leboncoin_proSeller?: boolean | null;
  leboncoin_urgentFlag?: boolean | null;
  leboncoin_topAnnonce?: boolean | null;
  leboncoin_deliveryOptions?: string[] | null;
  leboncoin_shippingCost?: number | null;
  leboncoin_condition?: string | null;
  leboncoin_sellerName?: string | null;
}

/**
 * Elasticsearch range query value
 */
interface ElasticsearchRangeValue {
  gt?: number | string;
  gte?: number | string;
  lt?: number | string;
  lte?: number | string;
}

/**
 * Search parameters for article queries
 */
export interface SearchParams {
  // Full-text search
  q?: string;

  // Site filtering
  sites?: SiteSource[];

  // Price range
  priceMin?: number;
  priceMax?: number;

  // Category filtering
  categoryId?: string;

  // Site-specific filters (Dealabs)
  dealabs_temperatureMin?: number;
  dealabs_temperatureMax?: number;
  dealabs_commentCountMin?: number;
  dealabs_communityVerified?: boolean;
  dealabs_freeShipping?: boolean;

  // Site-specific filters (Vinted)
  vinted_favoriteCountMin?: number;
  vinted_boosted?: boolean;
  vinted_brand?: string;
  vinted_size?: string;
  vinted_condition?: string;

  // Site-specific filters (LeBonCoin)
  leboncoin_city?: string;
  leboncoin_postcode?: string;
  leboncoin_region?: string;
  leboncoin_proSeller?: boolean;
  leboncoin_urgentFlag?: boolean;

  // Pagination
  from?: number;
  size?: number;
}

/**
 * ElasticSearch indexer service for multi-site article indexing and search
 *
 * Provides:
 * - Article indexing with site-specific field mapping
 * - Full-text search with filtering
 * - FilterExpression to ES query DSL conversion
 * - Bulk operations for reindexing
 */
@Injectable()
export class ElasticsearchIndexerService implements OnModuleInit {
  private readonly logger = new Logger(ElasticsearchIndexerService.name);
  private readonly indexName = 'articles';

  constructor(
    @Inject('ELASTICSEARCH_CLIENT') private readonly esClient: Client,
    @Inject('PRISMA_SERVICE') private readonly prisma: PrismaClient,
  ) {}

  /**
   * Initialize ElasticSearch index on module startup
   */
  async onModuleInit(): Promise<void> {
    try {
      await this.ensureIndex();
      this.logger.log('ElasticSearch articles index initialized');
    } catch (error) {
      this.logger.error('Failed to initialize articles index:', error);
      // Don't throw - allow service to start with degraded functionality
    }
  }

  /**
   * Index a single article to ElasticSearch
   *
   * @param article - ArticleWrapper with base and extension data
   */
  async indexArticle(article: ArticleWrapper): Promise<void> {
    try {
      const document = this.flattenArticle(article);

      await this.esClient.index({
        index: this.indexName,
        id: article.base.id,
        document,
      });

      this.logger.debug(
        `Indexed article ${article.base.id} from ${article.source}`,
      );
    } catch (error) {
      const errorMessage = extractErrorMessage(error);
      this.logger.error(
        `Failed to index article ${article.base.id}: ${errorMessage}`,
      );
      // Don't throw - indexing failure shouldn't break scraping
    }
  }

  /**
   * Bulk index multiple articles
   *
   * Used for reindexing operations and batch processing
   *
   * @param articles - Array of ArticleWrappers
   * @returns BulkResponse from ElasticSearch
   */
  async bulkIndex(articles: ArticleWrapper[]): Promise<estypes.BulkResponse> {
    if (articles.length === 0) {
      throw new Error('Cannot bulk index empty array');
    }

    const operations = articles.flatMap((article) => {
      const document = this.flattenArticle(article);
      return [
        { index: { _index: this.indexName, _id: article.base.id } },
        document,
      ];
    });

    const response = await this.esClient.bulk({
      operations,
      refresh: false, // Don't force refresh for performance
    });

    if (response.errors) {
      const errorCount = response.items.filter(
        (item) => item.index?.error,
      ).length;
      this.logger.warn(
        `Bulk indexing completed with ${errorCount} errors out of ${articles.length} articles`,
      );
    } else {
      this.logger.log(`Successfully indexed ${articles.length} articles`);
    }

    return response;
  }

  /**
   * Delete article from index
   *
   * @param articleId - Article ID to delete
   */
  async deleteArticle(articleId: string): Promise<void> {
    try {
      await this.esClient.delete({
        index: this.indexName,
        id: articleId,
      });

      this.logger.debug(`Deleted article ${articleId} from index`);
    } catch (error) {
      if (error instanceof esErrors.ResponseError && error.statusCode === 404) {
        this.logger.warn(`Article ${articleId} not found in index`);
      } else {
        const errorMessage = extractErrorMessage(error);
        this.logger.error(
          `Failed to delete article ${articleId}: ${errorMessage}`,
        );
      }
    }
  }

  /**
   * Search articles with full-text and filtering
   *
   * @param params - Search parameters
   * @returns Array of ArticleWrappers matching search criteria
   */
  async search(params: SearchParams): Promise<ArticleWrapper[]> {
    const query = this.buildSearchQuery(params);

    try {
      const response = await this.esClient.search({
        index: this.indexName,
        query,
        from: params.from ?? 0,
        size: params.size ?? 20,
        sort: [{ scrapedAt: { order: 'desc' } }],
      });

      // Extract article IDs from search results
      const articleIds = response.hits.hits
        .map((hit) => hit._id)
        .filter((id): id is string => typeof id === 'string');

      if (articleIds.length === 0) {
        return [];
      }

      // Load full ArticleWrappers from database
      return await ArticleWrapper.loadMany(articleIds, this.prisma);
    } catch (error) {
      const errorMessage = extractErrorMessage(error);
      this.logger.error(`Search failed: ${errorMessage}`);
      throw new Error(`Article search failed: ${errorMessage}`);
    }
  }

  /**
   * Create or update index with mapping
   *
   * Creates the index if it doesn't exist, otherwise updates mapping
   */
  async ensureIndex(): Promise<void> {
    try {
      const indexExists = await this.esClient.indices.exists({
        index: this.indexName,
      });

      if (!indexExists) {
        await this.esClient.indices.create({
          index: this.indexName,
          settings: ARTICLE_INDEX_SETTINGS,
          mappings: {
            properties: ARTICLE_INDEX_MAPPING,
          },
        });

        this.logger.log(`Created ElasticSearch index: ${this.indexName}`);
      } else {
        this.logger.debug(`Index ${this.indexName} already exists`);
      }
    } catch (error) {
      const errorMessage = extractErrorMessage(error);
      this.logger.error(`Failed to ensure index exists: ${errorMessage}`);
      throw error;
    }
  }

  // =============================================================================
  // Private Methods
  // =============================================================================

  /**
   * Flatten ArticleWrapper to ElasticSearch document format
   *
   * **Flattening Logic**:
   * 1. Include all base (universal) fields
   * 2. Include site-specific fields with prefix based on article source
   * 3. Set fields for other sites to null (not included in document)
   *
   * @param article - ArticleWrapper with base and extension data
   * @returns Flattened document for ElasticSearch
   */
  private flattenArticle(article: ArticleWrapper): ElasticsearchArticleDocument {
    const doc: ElasticsearchArticleDocument = {
      // Base fields (universal)
      id: article.base.id,
      externalId: article.base.externalId,
      source: article.source,
      title: article.base.title,
      description: article.base.description,
      url: article.base.url,
      imageUrl: article.base.imageUrl,
      currentPrice: article.base.currentPrice,
      categoryId: article.base.categoryId,
      publishedAt: article.base.publishedAt,
      scrapedAt: article.base.scrapedAt,
      isActive: article.base.isActive,
      isExpired: article.base.isExpired,
      location: article.base.location,
    };

    // Add site-specific fields with prefix
    if (article.isDealabs()) {
      doc.dealabs_temperature = article.extension.temperature;
      doc.dealabs_commentCount = article.extension.commentCount;
      doc.dealabs_communityVerified = article.extension.communityVerified;
      doc.dealabs_freeShipping = article.extension.freeShipping;
      doc.dealabs_isCoupon = article.extension.isCoupon;
      doc.dealabs_originalPrice = article.extension.originalPrice;
      doc.dealabs_discountPercentage = article.extension.discountPercentage;
      doc.dealabs_merchant = article.extension.merchant;
      doc.dealabs_expiresAt = article.extension.expiresAt;
    } else if (article.isVinted()) {
      doc.vinted_favoriteCount = article.extension.favoriteCount;
      doc.vinted_viewCount = article.extension.viewCount;
      doc.vinted_boosted = article.extension.boosted;
      doc.vinted_brand = article.extension.brand;
      doc.vinted_size = article.extension.size;
      doc.vinted_color = article.extension.color;
      doc.vinted_condition = article.extension.condition;
      doc.vinted_sellerName = article.extension.sellerName;
      doc.vinted_sellerRating = article.extension.sellerRating;
      doc.vinted_buyerProtectionFee = article.extension.buyerProtectionFee;
    } else if (article.isLeBonCoin()) {
      doc.leboncoin_city = article.extension.city;
      doc.leboncoin_postcode = article.extension.postcode;
      doc.leboncoin_department = article.extension.department;
      doc.leboncoin_region = article.extension.region;
      doc.leboncoin_proSeller = article.extension.proSeller;
      doc.leboncoin_urgentFlag = article.extension.urgentFlag;
      doc.leboncoin_topAnnonce = article.extension.topAnnonce;
      doc.leboncoin_deliveryOptions = article.extension.deliveryOptions;
      doc.leboncoin_shippingCost = article.extension.shippingCost;
      doc.leboncoin_condition = article.extension.condition;
      doc.leboncoin_sellerName = article.extension.sellerName;
    }

    return doc;
  }

  /**
   * Build ElasticSearch query from search parameters
   *
   * @param params - Search parameters
   * @returns ElasticSearch query object
   */
  private buildSearchQuery(params: SearchParams): estypes.QueryDslQueryContainer {
    const mustClauses: estypes.QueryDslQueryContainer[] = [];

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
      const rangeQuery: ElasticsearchRangeValue = {};
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
    if (params.dealabs_commentCountMin !== undefined) {
      mustClauses.push({
        range: {
          dealabs_commentCount: { gte: params.dealabs_commentCountMin },
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
    if (params.vinted_boosted !== undefined) {
      mustClauses.push({
        term: {
          vinted_boosted: params.vinted_boosted,
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
   * Convert RuleBasedFilterExpression to ElasticSearch query DSL
   *
   * Handles:
   * - Rule groups (AND, OR, NOT)
   * - Nested expressions (recursive)
   * - All 27 operators
   * - Site-specific field mapping
   *
   * @param filter - RuleBasedFilterExpression from filter system
   * @returns ElasticSearch query object
   */
  buildFilterExpressionQuery(
    filter: RuleBasedFilterExpression,
  ): Record<string, unknown> {
    if (!filter.rules || filter.rules.length === 0) {
      return { match_all: {} };
    }

    const clauses = filter.rules.map((rule) => {
      if (this.isRuleGroup(rule)) {
        return this.buildGroupQuery(rule);
      }
      return this.buildRuleQuery(rule);
    });

    const logic = filter.matchLogic ?? 'AND';
    return this.combineWithLogic(clauses, logic);
  }

  /**
   * Legacy FilterExpression conversion (backwards compatible)
   */
  private buildElasticsearchQuery(filter: FilterExpression): Record<string, unknown> {
    // Handle legacy FilterExpression format
    if (filter.type === 'GROUP' && filter.children) {
      const clauses = filter.children.map((child) =>
        this.buildElasticsearchQuery(child),
      );
      const logic = filter.operator ?? 'AND';
      return this.combineWithLogic(clauses, logic as LogicalOperator);
    }

    if (filter.type === 'CONDITION' && filter.field && filter.comparison) {
      // Convert legacy comparison to modern operator
      const operatorMap: Record<string, FilterOperator> = {
        '>': '>',
        '<': '<',
        '=': '=',
        '>=': '>=',
        '<=': '<=',
        'CONTAINS': 'CONTAINS',
        'REGEX': 'REGEX',
      };
      const operator = operatorMap[filter.comparison] ?? '=';
      // Create a FilterRule from the legacy filter format
      const legacyRule: FilterRule = {
        field: filter.field as FilterableField,
        operator,
        value: filter.value ?? '',
      };
      return this.buildRuleQuery(legacyRule);
    }

    return { match_all: {} };
  }

  /**
   * Check if a rule is a FilterRuleGroup
   */
  private isRuleGroup(
    rule: FilterRule | FilterRuleGroup,
  ): rule is FilterRuleGroup {
    return 'logic' in rule && 'rules' in rule;
  }

  /**
   * Build ES query for a single FilterRule
   */
  private buildRuleQuery(rule: FilterRule): Record<string, unknown> {
    const field = this.mapFieldToEsField(rule.field as string, rule.siteSpecific);
    const value = rule.value;
    const caseSensitive = rule.caseSensitive ?? true;

    switch (rule.operator) {
      // Numeric/Equality operators
      case '=':
      case 'EQUALS':
        return { term: { [field]: value } };

      case '!=':
      case 'NOT_EQUALS':
        return { bool: { must_not: [{ term: { [field]: value } }] } };

      case '>':
        return { range: { [field]: { gt: value } } };

      case '>=':
        return { range: { [field]: { gte: value } } };

      case '<':
        return { range: { [field]: { lt: value } } };

      case '<=':
        return { range: { [field]: { lte: value } } };

      // String operators
      case 'CONTAINS':
        if (caseSensitive) {
          return { wildcard: { [field]: `*${value}*` } };
        }
        return { match: { [field]: { query: value, operator: 'and' } } };

      case 'NOT_CONTAINS':
        return {
          bool: { must_not: [{ wildcard: { [field]: `*${value}*` } }] },
        };

      case 'STARTS_WITH':
        return { prefix: { [field]: value } };

      case 'ENDS_WITH':
        return { wildcard: { [field]: `*${value}` } };

      case 'REGEX':
        return { regexp: { [field]: String(value) } };

      case 'NOT_REGEX':
        return { bool: { must_not: [{ regexp: { [field]: String(value) } }] } };

      // Array operators
      case 'IN':
        return { terms: { [field]: Array.isArray(value) ? value : [value] } };

      case 'NOT_IN':
        return {
          bool: {
            must_not: [
              { terms: { [field]: Array.isArray(value) ? value : [value] } },
            ],
          },
        };

      case 'INCLUDES_ANY':
        return { terms: { [field]: Array.isArray(value) ? value : [value] } };

      case 'INCLUDES_ALL':
        if (Array.isArray(value)) {
          return {
            bool: {
              must: value.map((v) => ({ term: { [field]: v } })),
            },
          };
        }
        return { term: { [field]: value } };

      case 'NOT_INCLUDES_ANY':
        return {
          bool: {
            must_not: [
              { terms: { [field]: Array.isArray(value) ? value : [value] } },
            ],
          },
        };

      // Boolean operators
      case 'IS_TRUE':
        return { term: { [field]: true } };

      case 'IS_FALSE':
        return { term: { [field]: false } };

      // Date operators
      case 'BEFORE':
        return { range: { [field]: { lt: value } } };

      case 'AFTER':
        return { range: { [field]: { gt: value } } };

      case 'BETWEEN':
        if (Array.isArray(value) && value.length >= 2) {
          return { range: { [field]: { gte: value[0], lte: value[1] } } };
        }
        return { match_all: {} };

      case 'OLDER_THAN':
        // value should be duration like "7d", "24h"
        return { range: { [field]: { lt: `now-${value}` } } };

      case 'NEWER_THAN':
        return { range: { [field]: { gt: `now-${value}` } } };

      default:
        this.logger.warn(`Unknown operator: ${rule.operator}, using match_all`);
        return { match_all: {} };
    }
  }

  /**
   * Build ES query for a FilterRuleGroup
   */
  private buildGroupQuery(group: FilterRuleGroup): Record<string, unknown> {
    const clauses = group.rules.map((rule) => {
      if (this.isRuleGroup(rule)) {
        return this.buildGroupQuery(rule);
      }
      return this.buildRuleQuery(rule);
    });

    return this.combineWithLogic(clauses, group.logic);
  }

  /**
   * Combine clauses with logical operator
   */
  private combineWithLogic(
    clauses: Record<string, unknown>[],
    logic: LogicalOperator,
  ): Record<string, unknown> {
    if (clauses.length === 0) {
      return { match_all: {} };
    }

    if (clauses.length === 1 && logic !== 'NOT') {
      return clauses[0];
    }

    switch (logic) {
      case 'AND':
        return { bool: { must: clauses } };

      case 'OR':
        return { bool: { should: clauses, minimum_should_match: 1 } };

      case 'NOT':
        return { bool: { must_not: clauses } };

      default:
        return { bool: { must: clauses } };
    }
  }

  /**
   * Map field name to Elasticsearch field name
   * Site-specific fields get prefixed with site name
   */
  private mapFieldToEsField(field: string, siteSpecific?: string): string {
    // Site-specific field definitions
    const dealabsFields = [
      'temperature',
      'commentCount',
      'communityVerified',
      'freeShipping',
      'isCoupon',
      'originalPrice',
      'discountPercentage',
      'merchant',
      'expiresAt',
    ];

    const vintedFields = [
      'favoriteCount',
      'viewCount',
      'boosted',
      'brand',
      'size',
      'color',
      'condition',
      'sellerName',
      'sellerRating',
      'buyerProtectionFee',
    ];

    const leboncoinFields = [
      'city',
      'postcode',
      'department',
      'region',
      'proSeller',
      'urgentFlag',
      'topAnnonce',
      'deliveryOptions',
      'shippingCost',
      'attributes',
    ];

    // If explicitly marked as site-specific
    if (siteSpecific === SiteSource.DEALABS || (!siteSpecific && dealabsFields.includes(field))) {
      return `${SiteSource.DEALABS}_${field}`;
    }
    if (siteSpecific === SiteSource.VINTED || (!siteSpecific && vintedFields.includes(field))) {
      return `${SiteSource.VINTED}_${field}`;
    }
    if (siteSpecific === SiteSource.LEBONCOIN || (!siteSpecific && leboncoinFields.includes(field))) {
      return `${SiteSource.LEBONCOIN}_${field}`;
    }

    // Computed field aliases
    const aliases: Record<string, string> = {
      heat: 'dealabs_temperature',
      price: 'currentPrice',
      stock: 'stockLevel',
      availability: 'stockLevel',
      rating: 'merchantRating',
      specs: 'metadata',
    };

    if (aliases[field]) {
      return aliases[field];
    }

    // Base fields remain unchanged
    return field;
  }
}
