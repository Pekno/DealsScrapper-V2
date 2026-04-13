/**
 * @fileoverview ElasticSearch index mapping for multi-site article indexing
 *
 * **Architecture Decision: Flattened Schema**
 * - Uses FLATTENED approach (not nested objects) for simplicity and performance
 * - Base fields are universal across all sites
 * - Site-specific fields use prefixes: dealabs_, vinted_, leboncoin_
 * - Fields for other sites are simply null (e.g., dealabs_temperature is null for Vinted articles)
 *
 * **Benefits of Flattened Schema**:
 * - Simpler queries (no nested path complexity)
 * - Better performance for our use case
 * - Easier to understand and debug
 * - Straightforward aggregations and filtering
 */

import type { estypes } from '@elastic/elasticsearch';

/**
 * Elasticsearch field mapping type
 */
export type ArticleIndexMapping = Record<string, estypes.MappingProperty>;

/**
 * Index settings type for article index
 */
export type ArticleIndexSettings = estypes.IndicesIndexSettings;

/**
 * Index mapping for the articles index
 *
 * Supports multi-site articles with site-specific extensions:
 * - Dealabs: Community engagement (temperature, commentCount) and deal metadata
 * - Vinted: Fashion metadata (brand, size, color, condition) and engagement
 * - LeBonCoin: Location data (city, postcode, region) and ad features
 */
export const ARTICLE_INDEX_MAPPING: ArticleIndexMapping = {
  // =============================================================================
  // Base Fields (Universal - ALL sites)
  // =============================================================================

  id: {
    type: 'keyword',
  },

  externalId: {
    type: 'keyword',
  },

  source: {
    type: 'keyword', // 'dealabs' | 'vinted' | 'leboncoin'
  },

  title: {
    type: 'text',
    analyzer: 'standard',
    fields: {
      keyword: {
        type: 'keyword',
        ignore_above: 256,
      },
    },
  },

  description: {
    type: 'text',
    analyzer: 'standard',
  },

  url: {
    type: 'keyword',
    index: false, // Don't need to search by URL
  },

  imageUrl: {
    type: 'keyword',
    index: false,
  },

  currentPrice: {
    type: 'float',
  },

  categoryId: {
    type: 'keyword',
  },

  publishedAt: {
    type: 'date',
  },

  scrapedAt: {
    type: 'date',
  },

  isActive: {
    type: 'boolean',
  },

  isExpired: {
    type: 'boolean',
  },

  location: {
    type: 'text',
    fields: {
      keyword: {
        type: 'keyword',
        ignore_above: 256,
      },
    },
  },

  // =============================================================================
  // Dealabs-Specific Fields (prefix: dealabs_)
  // =============================================================================

  dealabs_temperature: {
    type: 'integer',
  },

  dealabs_commentCount: {
    type: 'integer',
  },

  dealabs_communityVerified: {
    type: 'boolean',
  },

  dealabs_freeShipping: {
    type: 'boolean',
  },

  dealabs_isCoupon: {
    type: 'boolean',
  },

  dealabs_originalPrice: {
    type: 'float',
  },

  dealabs_discountPercentage: {
    type: 'float',
  },

  dealabs_merchant: {
    type: 'keyword',
  },

  dealabs_expiresAt: {
    type: 'date',
  },

  // =============================================================================
  // Vinted-Specific Fields (prefix: vinted_)
  // =============================================================================

  vinted_favoriteCount: {
    type: 'integer',
  },

  vinted_viewCount: {
    type: 'integer',
  },

  vinted_boosted: {
    type: 'boolean',
  },

  vinted_brand: {
    type: 'keyword',
  },

  vinted_size: {
    type: 'keyword',
  },

  vinted_color: {
    type: 'keyword',
  },

  vinted_condition: {
    type: 'keyword',
  },

  vinted_sellerName: {
    type: 'keyword',
  },

  vinted_sellerRating: {
    type: 'float',
  },

  vinted_buyerProtectionFee: {
    type: 'float',
  },

  // =============================================================================
  // LeBonCoin-Specific Fields (prefix: leboncoin_)
  // =============================================================================

  leboncoin_city: {
    type: 'keyword',
  },

  leboncoin_postcode: {
    type: 'keyword',
  },

  leboncoin_department: {
    type: 'keyword',
  },

  leboncoin_region: {
    type: 'keyword',
  },

  leboncoin_proSeller: {
    type: 'boolean',
  },

  leboncoin_urgentFlag: {
    type: 'boolean',
  },

  leboncoin_topAnnonce: {
    type: 'boolean',
  },

  leboncoin_deliveryOptions: {
    type: 'keyword',
  },

  leboncoin_shippingCost: {
    type: 'float',
  },

  leboncoin_condition: {
    type: 'keyword',
  },

  leboncoin_sellerName: {
    type: 'keyword',
  },
};

/**
 * Index settings for the articles index
 */
export const ARTICLE_INDEX_SETTINGS: ArticleIndexSettings = {
  number_of_shards: 1,
  number_of_replicas: 1,
  refresh_interval: '5s', // Balance between real-time and performance

  analysis: {
    analyzer: {
      // Standard analyzer for full-text search on title and description
      standard: {
        type: 'standard',
        stopwords: '_french_', // French stopwords for better search
      },
    },
  },
};

/**
 * Total field count for the mapping (for validation)
 */
export const ARTICLE_MAPPING_FIELD_COUNT = Object.keys(ARTICLE_INDEX_MAPPING).length;
