/**
 * @fileoverview ElasticSearch module exports
 * Provides clean imports for ElasticSearch functionality
 */

// Main module
export { DealElasticSearchModule } from './elasticsearch.module.js';

// Core services
export { DealElasticSearchService } from './services/deal-elasticsearch.service.js';
export { ElasticsearchIndexerService } from './services/elasticsearch-indexer.service.js';

// Types and interfaces
export type {
  ElasticSearchDeal,
  DealEvolution,
  ScrapingMetadata,
  DealIndexingResult,
  EvolutionTrackingResult,
  TemperatureEvolutionQuery,
  TemperatureEvolutionResponse,
  ElasticSearchHealthStatus,
  EvolutionDataPoint,
} from './types/elasticsearch.types.js';

export type { SearchParams } from './services/elasticsearch-indexer.service.js';

// Configuration
export {
  ELASTICSEARCH_CONFIG,
  getElasticSearchIndexConfig,
  buildElasticSearchConnectionConfig,
} from './config/elasticsearch.config.js';

// Transformation utilities
export {
  transformRawDealToElasticDocument,
  createEvolutionFromRawDeal,
} from './types/elasticsearch.types.js';

// Mappings
export {
  ARTICLE_INDEX_MAPPING,
  ARTICLE_INDEX_SETTINGS,
  ARTICLE_MAPPING_FIELD_COUNT,
} from './mappings/article-index-mapping.js';
