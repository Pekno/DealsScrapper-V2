/**
 * @fileoverview ElasticSearch module for deal indexing and search functionality
 * Configures ElasticSearch client and provides deal search services
 * 
 * Follows NestJS module patterns established in the codebase:
 * - Centralized configuration through environment variables
 * - Service exports for dependency injection
 * - Integration with existing health checks and monitoring
 */

import { Module } from '@nestjs/common';
import {
  ElasticsearchModule,
  ElasticsearchService,
} from '@nestjs/elasticsearch';
import { PrismaService } from '@dealscrapper/database';
import { DealElasticSearchService } from './services/deal-elasticsearch.service.js';
import { ElasticsearchIndexerService } from './services/elasticsearch-indexer.service.js';
import {
  buildElasticSearchConnectionConfig,
  validateElasticSearchConfiguration,
} from './config/elasticsearch.config.js';

/**
 * ElasticSearch module providing deal indexing and search capabilities
 *
 * Responsibilities:
 * - Configure ElasticSearch client connection
 * - Provide DealElasticSearchService for legacy deal processing
 * - Provide ElasticsearchIndexerService for multi-site article indexing
 * - Handle connection validation and error scenarios
 *
 * Integration points:
 * - Used by DealExtractionService for batch deal processing
 * - Used by article extraction services for multi-site indexing
 * - Provides search endpoints for UI components
 * - Integrates with health check system
 */
@Module({
  imports: [
    ElasticsearchModule.registerAsync({
      useFactory: () => {
        // Validate configuration before creating connection
        validateElasticSearchConfiguration();

        const config = buildElasticSearchConnectionConfig();

        return {
          ...config,
          // Additional options for resilience
          compression: true, // Enable gzip compression
          keepAlive: true,
        };
      },
    }),
  ],
  providers: [
    DealElasticSearchService,
    ElasticsearchIndexerService,
    {
      provide: 'ELASTICSEARCH_CLIENT',
      useFactory: (elasticsearchService: ElasticsearchService) => {
        // Return the ElasticsearchService for injection
        return elasticsearchService;
      },
      inject: [ElasticsearchService],
    },
    {
      provide: 'PRISMA_SERVICE',
      useExisting: PrismaService,
    },
  ],
  exports: [
    DealElasticSearchService,
    ElasticsearchIndexerService,
    ElasticsearchModule, // Export for direct client access if needed
  ],
})
export class DealElasticSearchModule {}