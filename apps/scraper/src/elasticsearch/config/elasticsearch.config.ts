/**
 * @fileoverview ElasticSearch configuration constants and index mappings
 * Centralized configuration following SOLID single responsibility principle
 */

import { COMMON_CONFIG, extractErrorMessage } from '@dealscrapper/shared';
import type { ElasticSearchIndexConfig } from '../types/elasticsearch.types.js';

/**
 * Core ElasticSearch configuration constants
 * Immutable configuration values for consistent behavior across the application
 */
export const ELASTICSEARCH_CONFIG = {
  /** Connection and performance settings */
  CONNECTION: {
    DEFAULT_URL: 'http://localhost:9200',
    MAX_RETRIES: COMMON_CONFIG.RETRIES.MAX_ATTEMPTS_DATABASE,
    REQUEST_TIMEOUT: COMMON_CONFIG.TIMEOUTS.ELASTICSEARCH,
    PING_TIMEOUT: COMMON_CONFIG.TIMEOUTS.ELASTICSEARCH,
  },

  /** Index configuration and naming */
  INDICES: {
    DEALS: {
      NAME: 'deals-immutable-v1',
      ALIAS: 'deals-current',
    },
    EVOLUTION: {
      NAME: 'deal-evolution-v2',
      ALIAS: 'evolution-current',
    },
  },

  /** Index settings optimized for our use case */
  SETTINGS: {
    DEALS_INDEX: {
      number_of_shards: 3,
      number_of_replicas: 1,
      refresh_interval: '30s', // Batch-friendly
      max_result_window: 50000,
      'index.mapping.total_fields.limit': 2000,
    },
    EVOLUTION_INDEX: {
      number_of_shards: 3,
      number_of_replicas: 1,
      refresh_interval: '30s', // Optimized for batch writes
      max_result_window: 100000,
    },
  },

  /** Batch operation limits for performance */
  BATCH: {
    MAX_DEALS_PER_BATCH: COMMON_CONFIG.BATCH_SIZES.DATABASE_BULK,
    MAX_EVOLUTION_RECORDS_PER_BATCH: COMMON_CONFIG.BATCH_SIZES.ELASTICSEARCH_BULK, 
    BULK_REQUEST_TIMEOUT: COMMON_CONFIG.TIMEOUTS.LONG,
  },

  /** Query defaults for UI endpoints */
  QUERY: {
    TEMPERATURE_EVOLUTION_DAYS: 7,
    PRICE_EVOLUTION_DAYS: 14,
    MAX_DATA_POINTS: 100,
    DEFAULT_TIMEOUT: COMMON_CONFIG.TIMEOUTS.HEALTH_CHECK,
  },
} as const;

/**
 * ElasticSearch mapping for the deals-immutable index
 * Optimized for exact matching on externalId and full-text search on content
 */
export const DEALS_INDEX_MAPPING = {
  properties: {
    id: { type: 'keyword' },
    externalId: { 
      type: 'keyword',
      // Critical for deduplication queries
      index: true,
    },
    title: { 
      type: 'text', 
      analyzer: 'standard',
      // Support both full-text and exact matching
      fields: {
        keyword: { type: 'keyword', ignore_above: 256 }
      }
    },
    description: { 
      type: 'text', 
      analyzer: 'standard' 
    },
    currentPrice: { type: 'float' },
    originalPrice: { type: 'float' },
    merchant: { 
      type: 'keyword',
      // Enable merchant-based filtering
      index: true,
    },
    category: { 
      type: 'keyword',
      index: true,
    },
    publishedAt: { 
      type: 'date',
      format: 'date_time_no_millis||epoch_millis||date_optional_time'
    },
    url: { 
      type: 'keyword',
      index: false, // We don't search by URL
    },
    imageUrl: { 
      type: 'keyword',
      index: false,
    },
    firstSeenAt: { 
      type: 'date',
      format: 'date_time_no_millis||epoch_millis||date_optional_time'
    },
    sourceCategory: { 
      type: 'keyword',
      index: true,
    },
    sourceUrl: { 
      type: 'keyword',
      index: false,
    },
    scrapingJobId: { 
      type: 'keyword',
      index: true,
    },
    searchableText: { 
      type: 'text', 
      analyzer: 'standard',
      // Optimized for full-text search across title + description
      // Note: boost moved to query time in ES 9.x
    },
  }
} as const;

/**
 * ElasticSearch mapping for the deal-evolution index
 * Optimized for time-series queries and aggregations
 */
export const EVOLUTION_INDEX_MAPPING = {
  properties: {
    id: { type: 'keyword' },
    dealExternalId: { 
      type: 'keyword',
      // Critical for linking to deals and grouping evolution data
      index: true,
    },
    temperature: { 
      type: 'integer',
      // Enable range queries and aggregations
      index: true,
    },
    commentCount: { 
      type: 'integer',
      index: true,
    },
    voteCount: { 
      type: 'integer',
      index: true,
    },
    isExpired: { 
      type: 'boolean',
      index: true,
    },
    isActive: { 
      type: 'boolean',
      index: true,
    },
    observedAt: { 
      type: 'date',
      format: 'date_time_no_millis||epoch_millis||date_optional_time',
      // Critical for time-series aggregations
      index: true,
    },
    scrapedFrom: { 
      type: 'keyword',
      index: true,
    },
    scrapingJobId: { 
      type: 'keyword',
      index: true,
    },
  }
} as const;

/**
 * Index templates for consistent index creation
 * Ensures all indices follow the same patterns and settings
 */
export const INDEX_TEMPLATES = {
  DEALS_TEMPLATE: {
    name: 'deals-template',
    index_patterns: ['deals-*'],
    template: {
      settings: ELASTICSEARCH_CONFIG.SETTINGS.DEALS_INDEX,
      mappings: DEALS_INDEX_MAPPING,
    },
  },
  EVOLUTION_TEMPLATE: {
    name: 'evolution-template',
    index_patterns: ['deal-evolution-*'],
    template: {
      settings: ELASTICSEARCH_CONFIG.SETTINGS.EVOLUTION_INDEX,
      mappings: EVOLUTION_INDEX_MAPPING,
    },
  },
} as const;

/**
 * Get the complete index configuration for the application
 * Provides type-safe access to index names and aliases
 * 
 * @returns Complete index configuration object
 */
export function getElasticSearchIndexConfig(): ElasticSearchIndexConfig {
  return {
    deals: {
      name: ELASTICSEARCH_CONFIG.INDICES.DEALS.NAME,
      alias: ELASTICSEARCH_CONFIG.INDICES.DEALS.ALIAS,
    },
    evolution: {
      name: ELASTICSEARCH_CONFIG.INDICES.EVOLUTION.NAME,
      alias: ELASTICSEARCH_CONFIG.INDICES.EVOLUTION.ALIAS,
    },
  };
}

/**
 * Build ElasticSearch connection configuration from environment variables
 * Provides flexible configuration for different environments
 * 
 * @returns ElasticSearch client configuration object
 */
export function buildElasticSearchConnectionConfig() {
  const elasticsearchUrl = process.env.ELASTICSEARCH_NODE ??
    ELASTICSEARCH_CONFIG.CONNECTION.DEFAULT_URL;

  return {
    node: elasticsearchUrl,
    maxRetries: ELASTICSEARCH_CONFIG.CONNECTION.MAX_RETRIES,
    requestTimeout: ELASTICSEARCH_CONFIG.CONNECTION.REQUEST_TIMEOUT,
    pingTimeout: ELASTICSEARCH_CONFIG.CONNECTION.PING_TIMEOUT,
    // Security disabled to match docker-compose configuration
    ssl: {
      rejectUnauthorized: false,
    },
  };
}

/**
 * Validate that required environment variables are set
 * Ensures proper configuration before starting the service
 * 
 * @throws Error if critical configuration is missing
 */
export function validateElasticSearchConfiguration(): void {
  const requiredEnvVars: string[] = [
    // ElasticSearch URL is required, but has defaults
  ];

  const missingVars = requiredEnvVars.filter(
    (envVar) => !process.env[envVar]
  );

  if (missingVars.length > 0) {
    throw new Error(
      `Missing required ElasticSearch environment variables: ${missingVars.join(', ')}`
    );
  }

  // Validate URL format
  const elasticsearchUrl = process.env.ELASTICSEARCH_NODE ??
    ELASTICSEARCH_CONFIG.CONNECTION.DEFAULT_URL;

  try {
    new URL(elasticsearchUrl);
  } catch (error) {
    throw new Error(
      `Invalid ElasticSearch URL: ${elasticsearchUrl}. Error: ${extractErrorMessage(error)}`
    );
  }
}