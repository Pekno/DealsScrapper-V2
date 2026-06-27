/**
 * @fileoverview ElasticSearch module exports
 * Provides clean imports for ElasticSearch functionality
 */

// Main module
export { DealElasticSearchModule } from './elasticsearch.module.js';

// Core services
export { ElasticsearchIndexerService } from './services/elasticsearch-indexer.service.js';

export type { SearchParams } from './services/elasticsearch-indexer.service.js';

// Configuration
export {
  ELASTICSEARCH_CONFIG,
  buildElasticSearchConnectionConfig,
} from './config/elasticsearch.config.js';

// Mappings
export {
  ARTICLE_INDEX_MAPPING,
  ARTICLE_INDEX_SETTINGS,
  ARTICLE_MAPPING_FIELD_COUNT,
} from './mappings/article-index-mapping.js';
