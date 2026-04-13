/**
 * @fileoverview ElasticSearch service for deal indexing and evolution tracking
 * Handles dual-index architecture with immutable deals and evolution records
 *
 * Follows SOLID principles:
 * - Single Responsibility: Only handles ElasticSearch operations
 * - Open/Closed: Extensible through composition and dependency injection
 * - Interface Segregation: Clear, focused public API
 * - Dependency Inversion: Depends on abstractions (ElasticsearchService)
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import type { RawDeal } from '@dealscrapper/shared-types';
import { extractErrorMessage } from '@dealscrapper/shared';

import {
  type DealEvolution,
  type ScrapingMetadata,
  type DealIndexingResult,
  type EvolutionTrackingResult,
  type TemperatureEvolutionQuery,
  type TemperatureEvolutionResponse,
  type ElasticSearchHealthStatus,
  transformRawDealToElasticDocument,
  createEvolutionFromRawDeal,
} from '../types/elasticsearch.types.js';

import {
  ELASTICSEARCH_CONFIG,
  DEALS_INDEX_MAPPING,
  EVOLUTION_INDEX_MAPPING,
  INDEX_TEMPLATES,
  getElasticSearchIndexConfig,
} from '../config/elasticsearch.config.js';

/**
 * Core ElasticSearch service for deal data management
 *
 * Responsibilities:
 * - Index management (creation, health checks)
 * - Deal deduplication through immutable index
 * - Evolution tracking through time-series records
 * - UI data endpoints for temperature/price tooltips
 *
 * Design principles:
 * - Immutable data storage (no computed fields)
 * - Batch-optimized operations
 * - Graceful error handling with detailed logging
 * - Type-safe operations using existing RawDeal interface
 */
@Injectable()
export class DealElasticSearchService implements OnModuleInit {
  private readonly logger = new Logger(DealElasticSearchService.name);
  private readonly indexConfig = getElasticSearchIndexConfig();

  constructor(private readonly elasticsearchService: ElasticsearchService) {}

  /**
   * Initialize ElasticSearch indices and templates on module startup
   * Ensures all required indices exist with proper mappings
   *
   * @throws Error if index creation fails critically
   */
  async onModuleInit(): Promise<void> {
    try {
      await this.initializeElasticSearchIndices();
      this.logger.log('ElasticSearch indices initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize ElasticSearch indices:', error);
      // Don't throw - allow service to start with degraded functionality
    }
  }

  /**
   * Process a batch of deals from page extraction
   * Handles both new deal indexing and evolution tracking for existing deals
   *
   * @param rawDeals - Array of deals extracted from a page
   * @param scrapingMetadata - Context about the scraping operation
   * @returns Combined results from indexing and evolution operations
   */
  async processBatchedDeals(
    rawDeals: readonly RawDeal[],
    scrapingMetadata: ScrapingMetadata
  ): Promise<{
    indexing: DealIndexingResult;
    evolution: EvolutionTrackingResult;
  }> {
    if (rawDeals.length === 0) {
      return this.createEmptyBatchResults();
    }

    this.logger.debug(
      `Processing batch of ${rawDeals.length} deals from ${scrapingMetadata.categorySlug}`
    );

    try {
      // Step 1: Determine which deals we've seen before
      const externalIds = rawDeals.map((deal) => deal.externalId);
      const existingDealIds = await this.checkExistingDeals(externalIds);

      // Step 2: Separate new deals from existing ones
      const newDeals = rawDeals.filter(
        (deal) => !existingDealIds.has(deal.externalId)
      );
      const existingDeals = rawDeals.filter((deal) =>
        existingDealIds.has(deal.externalId)
      );

      // Step 3: Process in parallel for performance
      const [indexingResult, evolutionResult] = await Promise.allSettled([
        newDeals.length > 0
          ? this.indexNewDeals(newDeals, scrapingMetadata)
          : this.createEmptyIndexingResult(0),
        existingDeals.length > 0
          ? this.trackEvolutionForExistingDeals(existingDeals, scrapingMetadata)
          : this.createEmptyEvolutionResult(0),
      ]);

      // Step 4: Handle results and errors
      const finalIndexingResult =
        indexingResult.status === 'fulfilled'
          ? indexingResult.value
          : this.createErrorIndexingResult(
              newDeals.length,
              indexingResult.reason
            );

      const finalEvolutionResult =
        evolutionResult.status === 'fulfilled'
          ? evolutionResult.value
          : this.createErrorEvolutionResult(
              existingDeals.length,
              evolutionResult.reason
            );

      this.logBatchProcessingResults(finalIndexingResult, finalEvolutionResult);

      return {
        indexing: finalIndexingResult,
        evolution: finalEvolutionResult,
      };
    } catch (error) {
      this.logger.error('Batch processing failed:', error);
      return {
        indexing: this.createErrorIndexingResult(rawDeals.length, error),
        evolution: this.createErrorEvolutionResult(0, error),
      };
    }
  }

  /**
   * Check which deals already exist in the immutable index
   * Fast lookup operation for deduplication
   *
   * @param externalIds - Array of deal external IDs to check
   * @returns Set of existing external IDs
   */
  async checkExistingDeals(
    externalIds: readonly string[]
  ): Promise<Set<string>> {
    if (externalIds.length === 0) {
      return new Set();
    }

    try {
      const response = await this.elasticsearchService.search({
        index: this.indexConfig.deals.alias,
        size: 0, // We only need existence, not documents
        query: {
          terms: {
            externalId: [...externalIds], // Convert readonly array to mutable
          },
        },
        // Use aggregation to get unique externalIds efficiently
        aggs: {
          existing_ids: {
            terms: {
              field: 'externalId',
              size: externalIds.length,
            },
          },
        },
        timeout: `${ELASTICSEARCH_CONFIG.QUERY.DEFAULT_TIMEOUT}ms`,
      });

      const existingIds = new Set<string>();

      // Handle aggregation results safely with proper type casting
      interface ExistingIdsAggregation {
        existing_ids: { buckets: Array<{ key: string }> };
      }
      const aggregations = response.aggregations as ExistingIdsAggregation | undefined;
      if (aggregations?.existing_ids?.buckets) {
        for (const bucket of aggregations.existing_ids.buckets) {
          existingIds.add(bucket.key);
        }
      }

      this.logger.debug(
        `🔍 ElasticSearch: Found ${existingIds.size} existing deals out of ${externalIds.length} checked`
      );

      return existingIds;
    } catch (error) {
      this.logger.error('Failed to check existing deals:', error);
      // Return empty set to allow processing to continue
      return new Set();
    }
  }

  /**
   * Get temperature evolution data for UI tooltips
   * Retrieves time-series data for a specific deal's temperature changes
   *
   * @param query - Parameters for temperature evolution query
   * @returns Temperature evolution response with trend analysis
   */
  async getTemperatureEvolution(
    query: TemperatureEvolutionQuery
  ): Promise<TemperatureEvolutionResponse> {
    const timeRangeMs =
      (query.timeRangeHours ??
        ELASTICSEARCH_CONFIG.QUERY.TEMPERATURE_EVOLUTION_DAYS * 24) *
      60 *
      60 *
      1000;
    const startTime = new Date(Date.now() - timeRangeMs).toISOString();

    try {
      const response = await this.elasticsearchService.search({
        index: this.indexConfig.evolution.alias,
        size: query.maxDataPoints ?? ELASTICSEARCH_CONFIG.QUERY.MAX_DATA_POINTS,
        query: {
          bool: {
            must: [
              { term: { dealExternalId: query.dealExternalId } },
              { exists: { field: 'temperature' } },
              { range: { observedAt: { gte: startTime } } },
            ],
          },
        },
        sort: [{ observedAt: { order: 'asc' } }],
        _source: ['observedAt', 'temperature'],
        timeout: `${ELASTICSEARCH_CONFIG.QUERY.DEFAULT_TIMEOUT}ms`,
      });

      interface EvolutionHit {
        _source: {
          observedAt: string;
          temperature: number;
        };
      }

      const dataPoints = response.hits.hits.map((hit) => {
        const source = hit._source as { observedAt: string; temperature: number };
        return {
          timestamp: new Date(source.observedAt),
          value: source.temperature,
        };
      });

      return {
        dealExternalId: query.dealExternalId,
        evolution: dataPoints,
        trend: this.calculateTrend(dataPoints.map((p) => p.value)),
        peak: Math.max(...dataPoints.map((p) => p.value)),
        change24Hours: this.calculate24HourChange(dataPoints),
      };
    } catch (error) {
      this.logger.error(
        `Failed to get temperature evolution for deal ${query.dealExternalId}:`,
        error
      );
      throw new Error(
        `Temperature evolution query failed: ${extractErrorMessage(error)}`
      );
    }
  }

  /**
   * Get health status of ElasticSearch indices
   * Provides monitoring information for alerting and debugging
   *
   * @returns Current health status of all indices
   */
  async getHealthStatus(): Promise<ElasticSearchHealthStatus> {
    try {
      const [dealsHealth, evolutionHealth, dealStats, evolutionStats] =
        await Promise.allSettled([
          this.elasticsearchService.cluster.health({
            index: this.indexConfig.deals.alias,
          }),
          this.elasticsearchService.cluster.health({
            index: this.indexConfig.evolution.alias,
          }),
          this.elasticsearchService.count({
            index: this.indexConfig.deals.alias,
          }),
          this.elasticsearchService.count({
            index: this.indexConfig.evolution.alias,
          }),
        ]);

      const dealsHealthStatus =
        dealsHealth.status === 'fulfilled' ? dealsHealth.value.status : 'red';

      const evolutionHealthStatus =
        evolutionHealth.status === 'fulfilled'
          ? evolutionHealth.value.status
          : 'red';

      const totalDealsCount =
        dealStats.status === 'fulfilled' ? dealStats.value.count : 0;

      const totalEvolutionsCount =
        evolutionStats.status === 'fulfilled' ? evolutionStats.value.count : 0;

      return {
        isHealthy:
          dealsHealthStatus !== 'red' && evolutionHealthStatus !== 'red',
        dealsIndexHealth: dealsHealthStatus as 'green' | 'yellow' | 'red',
        evolutionIndexHealth: evolutionHealthStatus as
          | 'green'
          | 'yellow'
          | 'red',
        totalDealsCount,
        totalEvolutionsCount,
        lastIndexUpdate: new Date(),
      };
    } catch (error) {
      this.logger.error('Failed to get health status:', error);
      return {
        isHealthy: false,
        dealsIndexHealth: 'red',
        evolutionIndexHealth: 'red',
        totalDealsCount: 0,
        totalEvolutionsCount: 0,
        lastIndexUpdate: new Date(),
      };
    }
  }

  // =============================================================================
  // Private Implementation Methods
  // =============================================================================

  /**
   * Initialize ElasticSearch indices and templates
   * Creates indices with proper mappings if they don't exist
   */
  private async initializeElasticSearchIndices(): Promise<void> {
    // Create index templates first
    await this.createIndexTemplates();

    // Create indices if they don't exist
    await Promise.all([
      this.ensureIndexExists(
        this.indexConfig.deals.name,
        this.indexConfig.deals.alias,
        DEALS_INDEX_MAPPING
      ),
      this.ensureIndexExists(
        this.indexConfig.evolution.name,
        this.indexConfig.evolution.alias,
        EVOLUTION_INDEX_MAPPING
      ),
    ]);
  }

  /**
   * Create index templates for consistent index management
   */
  private async createIndexTemplates(): Promise<void> {
    const templates = [
      INDEX_TEMPLATES.DEALS_TEMPLATE,
      INDEX_TEMPLATES.EVOLUTION_TEMPLATE,
    ];

    for (const template of templates) {
      try {
        await this.elasticsearchService.indices.putIndexTemplate({
          name: template.name,
          index_patterns: [...template.index_patterns], // Convert readonly to mutable
          template: template.template,
        });
        this.logger.debug(`Created index template: ${template.name}`);
      } catch (error) {
        this.logger.warn(
          `Failed to create index template ${template.name}:`,
          error
        );
      }
    }
  }

  /**
   * Ensure a specific index exists with proper alias and mapping
   */
  private async ensureIndexExists(
    indexName: string,
    aliasName: string,
    mapping: Record<string, unknown>
  ): Promise<void> {
    try {
      const indexExists = await this.elasticsearchService.indices.exists({
        index: indexName,
      });

      if (!indexExists) {
        await this.elasticsearchService.indices.create({
          index: indexName,
          settings: indexName.includes('evolution')
            ? ELASTICSEARCH_CONFIG.SETTINGS.EVOLUTION_INDEX
            : ELASTICSEARCH_CONFIG.SETTINGS.DEALS_INDEX,
          mappings: mapping,
          aliases: {
            [aliasName]: {},
          },
        });
        this.logger.log(
          `Created ElasticSearch index: ${indexName} with alias: ${aliasName}`
        );
      }
    } catch (error) {
      this.logger.error(`Failed to create index ${indexName}:`, error);
      throw error;
    }
  }

  /**
   * Index new deals in the immutable deals index
   */
  private async indexNewDeals(
    newDeals: readonly RawDeal[],
    scrapingMetadata: ScrapingMetadata
  ): Promise<DealIndexingResult> {
    const errors: string[] = [];
    let successCount = 0;

    try {
      // Transform deals to ElasticSearch documents
      const documentsToIndex = newDeals.map((deal) =>
        transformRawDealToElasticDocument(deal, scrapingMetadata)
      );

      // Prepare bulk operation
      const bulkBody = documentsToIndex.flatMap((doc) => [
        {
          index: { _index: this.indexConfig.deals.alias, _id: doc.externalId },
        },
        doc,
      ]);

      // Execute bulk index
      const response = await this.elasticsearchService.bulk({
        body: bulkBody,
        timeout: `${ELASTICSEARCH_CONFIG.BATCH.BULK_REQUEST_TIMEOUT}ms`,
      });

      // Process results
      if (response.errors) {
        for (const item of response.items) {
          if (item.index?.error) {
            errors.push(`Deal ${item.index._id}: ${item.index.error.reason}`);
          } else {
            successCount++;
          }
        }
      } else {
        successCount = documentsToIndex.length;
      }

      this.logger.log(
        `Indexed ${successCount} new deals, ${errors.length} errors`
      );

      return {
        totalDealsProcessed: newDeals.length,
        newDealsIndexed: successCount,
        duplicatesSkipped: 0, // These are pre-filtered
        errors,
      };
    } catch (error) {
      const errorMessage =
        extractErrorMessage(error);
      errors.push(errorMessage);

      this.logger.error('Bulk indexing failed:', error);

      return {
        totalDealsProcessed: newDeals.length,
        newDealsIndexed: 0,
        duplicatesSkipped: 0,
        errors,
      };
    }
  }

  /**
   * Track evolution for deals that already exist in the system
   */
  private async trackEvolutionForExistingDeals(
    existingDeals: readonly RawDeal[],
    scrapingMetadata: ScrapingMetadata
  ): Promise<EvolutionTrackingResult> {
    // Get last known state for each deal
    const externalIds = existingDeals.map((deal) => deal.externalId);
    const lastEvolutions = await this.getLastEvolutionsForDeals(externalIds);

    // Determine what has changed
    const evolutionRecords: DealEvolution[] = [];
    let noChangesCount = 0;
    let expiredDealsSkipped = 0;

    for (const deal of existingDeals) {
      const lastEvolution = lastEvolutions.get(deal.externalId);
      const currentEvolution = createEvolutionFromRawDeal(
        deal,
        scrapingMetadata
      );

      // Skip evolution tracking for expired deals (closed listings)
      if (deal.isExpired) {
        expiredDealsSkipped++;
        continue;
      }

      if (this.hasSignificantChanges(currentEvolution, lastEvolution)) {
        evolutionRecords.push(currentEvolution);
      } else {
        noChangesCount++;
      }
    }

    // Index evolution records if any changes found
    if (evolutionRecords.length === 0) {
      return {
        totalDealsProcessed: existingDeals.length,
        newEvolutionsRecorded: 0,
        dealsWithNoChanges: noChangesCount,
        expiredDealsSkipped,
        errors: [],
      };
    }

    return this.indexEvolutionRecords(
      evolutionRecords,
      existingDeals.length,
      noChangesCount,
      expiredDealsSkipped
    );
  }

  /**
   * Get the last evolution record for each deal
   */
  private async getLastEvolutionsForDeals(
    externalIds: readonly string[]
  ): Promise<Map<string, DealEvolution>> {
    try {
      const response = await this.elasticsearchService.search({
        index: this.indexConfig.evolution.alias,
        size: externalIds.length,
        query: {
          terms: {
            dealExternalId: [...externalIds], // Convert readonly to mutable array
          },
        },
        sort: [{ observedAt: { order: 'desc' } }],
        collapse: {
          field: 'dealExternalId',
        },
      });

      const evolutions = new Map<string, DealEvolution>();

      for (const hit of response.hits.hits) {
        const evolution = hit._source as DealEvolution;
        evolutions.set(evolution.dealExternalId, evolution);
      }

      return evolutions;
    } catch (error) {
      this.logger.error('Failed to get last evolutions:', error);
      return new Map();
    }
  }

  /**
   * Determine if there are significant changes worth recording
   */
  private hasSignificantChanges(
    current: DealEvolution,
    last: DealEvolution | undefined
  ): boolean {
    if (!last) {
      return true; // First time seeing this deal
    }

    return (
      current.temperature !== last.temperature ||
      current.commentCount !== last.commentCount ||
      current.voteCount !== last.voteCount ||
      current.isExpired !== last.isExpired ||
      current.isActive !== last.isActive
    );
  }

  /**
   * Index evolution records in bulk
   */
  private async indexEvolutionRecords(
    evolutionRecords: readonly DealEvolution[],
    totalProcessed: number,
    noChangesCount: number,
    expiredDealsSkipped: number
  ): Promise<EvolutionTrackingResult> {
    const errors: string[] = [];
    let successCount = 0;

    try {
      const bulkBody = evolutionRecords.flatMap((record) => [
        { index: { _index: this.indexConfig.evolution.alias } },
        record,
      ]);

      const response = await this.elasticsearchService.bulk({
        body: bulkBody,
        timeout: `${ELASTICSEARCH_CONFIG.BATCH.BULK_REQUEST_TIMEOUT}ms`,
      });

      if (response.errors) {
        for (const item of response.items) {
          if (item.index?.error) {
            errors.push(`Evolution record: ${item.index.error.reason}`);
          } else {
            successCount++;
          }
        }
      } else {
        successCount = evolutionRecords.length;
      }

      return {
        totalDealsProcessed: totalProcessed,
        newEvolutionsRecorded: successCount,
        dealsWithNoChanges: noChangesCount,
        expiredDealsSkipped,
        errors,
      };
    } catch (error) {
      const errorMessage =
        extractErrorMessage(error);
      errors.push(errorMessage);

      return {
        totalDealsProcessed: totalProcessed,
        newEvolutionsRecorded: 0,
        dealsWithNoChanges: noChangesCount,
        expiredDealsSkipped,
        errors,
      };
    }
  }

  // =============================================================================
  // Utility and Helper Methods
  // =============================================================================

  /**
   * Calculate trend direction from a series of values
   */
  private calculateTrend(
    values: readonly number[]
  ): 'rising' | 'falling' | 'stable' {
    if (values.length < 2) {
      return 'stable';
    }

    const first = values[0];
    const last = values[values.length - 1];
    const difference = last - first;
    const threshold = first * 0.1; // 10% change threshold

    if (difference > threshold) {
      return 'rising';
    } else if (difference < -threshold) {
      return 'falling';
    } else {
      return 'stable';
    }
  }

  /**
   * Calculate 24-hour change from evolution data points
   */
  private calculate24HourChange(
    dataPoints: readonly { timestamp: Date; value: number }[]
  ): number {
    if (dataPoints.length < 2) {
      return 0;
    }

    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Find closest points to 24 hours ago and now
    const oldPoint =
      dataPoints.find((p) => p.timestamp <= twentyFourHoursAgo) ??
      dataPoints[0];
    const newPoint = dataPoints[dataPoints.length - 1];

    return newPoint.value - oldPoint.value;
  }

  /**
   * Create empty batch processing results
   */
  private createEmptyBatchResults() {
    return {
      indexing: this.createEmptyIndexingResult(0),
      evolution: this.createEmptyEvolutionResult(0),
    };
  }

  /**
   * Create empty indexing result
   */
  private createEmptyIndexingResult(
    totalProcessed: number
  ): DealIndexingResult {
    return {
      totalDealsProcessed: totalProcessed,
      newDealsIndexed: 0,
      duplicatesSkipped: 0,
      errors: [],
    };
  }

  /**
   * Create empty evolution result
   */
  private createEmptyEvolutionResult(
    totalProcessed: number
  ): EvolutionTrackingResult {
    return {
      totalDealsProcessed: totalProcessed,
      newEvolutionsRecorded: 0,
      dealsWithNoChanges: totalProcessed,
      expiredDealsSkipped: 0,
      errors: [],
    };
  }

  /**
   * Create error indexing result
   */
  private createErrorIndexingResult(
    totalProcessed: number,
    error: unknown
  ): DealIndexingResult {
    const errorMessage =
      extractErrorMessage(error);
    return {
      totalDealsProcessed: totalProcessed,
      newDealsIndexed: 0,
      duplicatesSkipped: 0,
      errors: [errorMessage],
    };
  }

  /**
   * Create error evolution result
   */
  private createErrorEvolutionResult(
    totalProcessed: number,
    error: unknown
  ): EvolutionTrackingResult {
    const errorMessage =
      extractErrorMessage(error);
    return {
      totalDealsProcessed: totalProcessed,
      newEvolutionsRecorded: 0,
      dealsWithNoChanges: 0,
      expiredDealsSkipped: 0,
      errors: [errorMessage],
    };
  }

  /**
   * Log batch processing results for monitoring
   */
  private logBatchProcessingResults(
    indexingResult: DealIndexingResult,
    evolutionResult: EvolutionTrackingResult
  ): void {
    const totalErrors =
      indexingResult.errors.length + evolutionResult.errors.length;

    if (totalErrors === 0) {
      this.logger.log(
        `📊 ElasticSearch batch complete: ${indexingResult.newDealsIndexed} new deals indexed, ` +
          `${evolutionResult.newEvolutionsRecorded} evolutions recorded, ` +
          `${evolutionResult.dealsWithNoChanges} unchanged deals, ` +
          `${evolutionResult.expiredDealsSkipped} expired deals skipped`
      );
    } else {
      this.logger.warn(
        `📊 ElasticSearch batch complete with ${totalErrors} errors: ` +
          `${indexingResult.newDealsIndexed} new deals indexed, ` +
          `${evolutionResult.newEvolutionsRecorded} evolutions recorded, ` +
          `${evolutionResult.dealsWithNoChanges} unchanged deals, ` +
          `${evolutionResult.expiredDealsSkipped} expired deals skipped`
      );

      // Log first few errors for debugging
      const allErrors = [...indexingResult.errors, ...evolutionResult.errors];
      allErrors.slice(0, 3).forEach((error, index) => {
        this.logger.error(`Error ${index + 1}: ${error}`);
      });
    }
  }
}
