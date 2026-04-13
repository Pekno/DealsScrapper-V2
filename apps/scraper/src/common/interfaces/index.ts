import type { StandardApiResponse } from '@dealscrapper/shared-types';

// Common interfaces for scraper service
export interface ScrapeRequest {
  categorySlug: string;
  priority?: 'low' | 'normal' | 'high';
}

/**
 * Scraping operation response
 * Extends StandardApiResponse with scraping-specific data
 */
export interface ScrapeResponse
  extends StandardApiResponse<{ dealsFound: number }> {
  // Backward compatibility: dealsFound also available at root level
  dealsFound: number;
}

// Re-export types from shared types for backward compatibility
export type { RawDeal } from '@dealscrapper/shared-types';
export type { ScrapeResult } from '@dealscrapper/shared-types';

// Re-export filter types from shared-types (previously duplicated here)
export type {
  LogicalOperator,
  FilterRule,
  FilterRuleGroup,
  RuleBasedFilterExpression,
} from '@dealscrapper/shared-types';
