/**
 * @fileoverview ElasticSearch type definitions for deal indexing and evolution tracking
 * Reuses existing RawDeal interface and extends it for ElasticSearch-specific needs
 */

import type { RawDeal } from '@dealscrapper/shared-types';

/**
 * Immutable deal document stored in the deals-immutable index
 * Represents a snapshot of a deal at the moment of first discovery
 */
export interface ElasticSearchDeal {
  /** Internal unique identifier for the document */
  readonly id: string;
  /** External Dealabs deal ID - primary deduplication key */
  readonly externalId: string;
  
  // Core immutable deal data (snapshot at first discovery)
  readonly title: string;
  readonly description?: string;
  readonly currentPrice?: number;
  readonly originalPrice?: number;
  readonly merchant?: string;
  readonly category?: string;
  readonly publishedAt?: Date;
  readonly url?: string;
  readonly imageUrl?: string;
  
  // Discovery metadata - when and where we found this deal
  readonly firstSeenAt: Date;
  readonly sourceCategory: string;
  readonly sourceUrl: string;
  readonly scrapingJobId?: string;
  
  // Search optimization - combined searchable content
  readonly searchableText: string;
}

/**
 * Evolution record documenting changes to a deal over time
 * Stores only raw observed values, no computed derivatives
 */
export interface DealEvolution {
  /** Auto-generated evolution record identifier */
  readonly id?: string;
  /** Links back to the immutable deal record */
  readonly dealExternalId: string;
  
  // Raw observed values at this point in time
  readonly temperature?: number;
  readonly commentCount?: number;
  readonly voteCount?: number;
  readonly isExpired?: boolean;
  readonly isActive?: boolean;
  
  // Observation metadata - when and where this change was observed
  readonly observedAt: Date;
  readonly scrapedFrom: string;
  readonly scrapingJobId?: string;
}

/**
 * Metadata context for scraping operations
 * Provides context about when and where deals were discovered
 */
export interface ScrapingMetadata {
  readonly categorySlug: string;
  readonly sourceUrl: string;
  readonly scrapedAt: Date;
  readonly scrapingJobId?: string;
}

/**
 * Configuration for ElasticSearch index management
 * Defines index names, aliases, and settings
 */
export interface ElasticSearchIndexConfig {
  readonly deals: {
    readonly name: string;
    readonly alias: string;
  };
  readonly evolution: {
    readonly name: string;
    readonly alias: string;
  };
}

/**
 * Results from evolution tracking operations
 * Provides statistics about what changes were detected and recorded
 */
export interface EvolutionTrackingResult {
  readonly totalDealsProcessed: number;
  readonly newEvolutionsRecorded: number;
  readonly dealsWithNoChanges: number;
  readonly expiredDealsSkipped: number;
  readonly errors: readonly string[];
}

/**
 * Results from deal indexing operations
 * Provides statistics about batch indexing operations
 */
export interface DealIndexingResult {
  readonly totalDealsProcessed: number;
  readonly newDealsIndexed: number;
  readonly duplicatesSkipped: number;
  readonly errors: readonly string[];
}

/**
 * Query parameters for temperature evolution API
 * Used for generating hover tooltips in the UI
 */
export interface TemperatureEvolutionQuery {
  readonly dealExternalId: string;
  readonly timeRangeHours?: number;
  readonly maxDataPoints?: number;
}



/**
 * Data point for evolution visualizations
 * Represents a single point in time for UI graphing
 */
export interface EvolutionDataPoint {
  readonly timestamp: Date;
  readonly value: number;
}

/**
 * Temperature evolution response for UI tooltips
 * Provides structured data for temperature trend visualization
 */
export interface TemperatureEvolutionResponse {
  readonly dealExternalId: string;
  readonly evolution: readonly EvolutionDataPoint[];
  readonly trend: 'rising' | 'falling' | 'stable';
  readonly peak: number;
  readonly change24Hours: number;
}



/**
 * Health status of ElasticSearch indices
 * Used for monitoring and alerting
 */
export interface ElasticSearchHealthStatus {
  readonly isHealthy: boolean;
  readonly dealsIndexHealth: 'green' | 'yellow' | 'red';
  readonly evolutionIndexHealth: 'green' | 'yellow' | 'red';
  readonly totalDealsCount: number;
  readonly totalEvolutionsCount: number;
  readonly lastIndexUpdate: Date;
}

/**
 * Transformation helper to convert RawDeal to ElasticSearchDeal
 * Ensures proper mapping between scraping data and search documents
 * 
 * @param rawDeal - Original deal data from scraping
 * @param metadata - Context about when/where the deal was discovered
 * @returns Immutable ElasticSearch document ready for indexing
 */
export function transformRawDealToElasticDocument(
  rawDeal: RawDeal,
  metadata: ScrapingMetadata
): ElasticSearchDeal {
  return {
    id: rawDeal.externalId, // Use externalId as the primary identifier
    externalId: rawDeal.externalId,
    title: rawDeal.title,
    description: rawDeal.description,
    currentPrice: rawDeal.currentPrice,
    originalPrice: rawDeal.originalPrice,
    merchant: rawDeal.merchant,
    category: rawDeal.category,
    publishedAt: rawDeal.publishedAt,
    url: rawDeal.url,
    imageUrl: rawDeal.imageUrl,
    firstSeenAt: metadata.scrapedAt,
    sourceCategory: metadata.categorySlug,
    sourceUrl: metadata.sourceUrl,
    scrapingJobId: metadata.scrapingJobId,
    searchableText: [rawDeal.title, rawDeal.description]
      .filter(Boolean)
      .join(' ')
      .toLowerCase(),
  };
}

/**
 * Transformation helper to create evolution record from RawDeal
 * Only includes fields that may change over time
 * 
 * @param rawDeal - Current deal state from scraping
 * @param metadata - Context about the observation
 * @returns Evolution record with current observable values
 */
export function createEvolutionFromRawDeal(
  rawDeal: RawDeal,
  metadata: ScrapingMetadata
): DealEvolution {
  return {
    dealExternalId: rawDeal.externalId,
    temperature: rawDeal.temperature,
    commentCount: rawDeal.commentCount,
    voteCount: rawDeal.communityVerified ? 1 : 0, // Map from boolean to count
    isExpired: rawDeal.isExpired,
    isActive: rawDeal.isActive,
    observedAt: metadata.scrapedAt,
    scrapedFrom: metadata.categorySlug,
    scrapingJobId: metadata.scrapingJobId,
  };
}