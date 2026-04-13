import { Injectable, Logger } from '@nestjs/common';
import { Filter } from '@dealscrapper/database';
import {
  RuleEngineService,
  RuleEvaluationDetail,
} from '../filter-matching/rule-engine.service.js';
import {
  FilterRule,
  FilterRuleGroup,
  convertFilterExpressionFromDb,
  type RawDeal,
} from '@dealscrapper/shared-types';

/**
 * Result of evaluating a filter against a raw deal
 */
export interface FilterEvaluationResult {
  readonly matches: boolean;
  readonly score: number;
  readonly reasons: string[];
}

/**
 * Analysis result for filter optimization
 */
export interface FilterAnalysis {
  readonly urlFilters: {
    readonly price_min?: number;
    readonly price_max?: number;
    readonly merchant?: string;
    readonly sort?: 'new' | 'hot' | 'price_asc' | 'price_desc';
  };
  readonly processingFilters: {
    readonly titleRegex?: RegExp[];
    readonly heatRange?: { readonly min: number; readonly max: number };
    readonly descriptionKeywords?: string[];
  };
}

/**
 * Collection structure for optimization data extraction
 */
interface OptimizationCollectors {
  readonly maxPrices: number[];
  readonly minPrices: number[];
  readonly minHeats: number[];
  readonly processingFilters: FilterAnalysis['processingFilters'];
}

/**
 * Configuration constants for filter evaluation
 */
const FILTER_EVALUATION_CONFIG = {
  /** Default heat range for optimization analysis */
  DEFAULT_HEAT_RANGE: {
    MIN: 0,
    MAX: 1000,
  },
  /** Default sorting preference for URL filters */
  DEFAULT_SORT: 'new' as const,
} as const;

/**
 * Pure filter evaluation service containing only business logic
 * Separated from database operations following Single Responsibility Principle
 *
 * This service focuses solely on:
 * - Evaluating filters against raw deals
 * - Analyzing filters for optimization
 * - No database access or side effects
 */
@Injectable()
export class FilterEvaluationService {
  private readonly logger = new Logger(FilterEvaluationService.name);

  constructor(private readonly ruleEngine: RuleEngineService) {}

  /**
   * Evaluate a single filter against a raw deal to determine if there's a match
   * Pure function with no side effects - only evaluates business logic
   *
   * @param filter - Filter with rule expression to evaluate
   * @param deal - Raw deal data to evaluate against filter rules
   * @returns Evaluation result with match status, score, and detailed reasons
   * @throws Error if filter expression is malformed or evaluation fails
   */
  async evaluateFilter(
    filter: Filter,
    deal: RawDeal
  ): Promise<FilterEvaluationResult> {
    try {
      this.logger.debug(
        `Evaluating filter "${filter.name}" against deal ${deal.externalId}`
      );

      const filterExpression = convertFilterExpressionFromDb(
        filter.filterExpression
      );

      const evaluationResult = await this.ruleEngine.evaluateFilterExpression(
        filterExpression,
        deal
      );

      const result: FilterEvaluationResult = {
        matches: evaluationResult.matches,
        score: evaluationResult.score,
        reasons: this.flattenDetailReasons(evaluationResult.details),
      };

      this.logger.debug(
        `Filter evaluation complete: ${result.matches ? 'MATCH' : 'NO MATCH'} ` +
          `(score: ${result.score}) for filter "${filter.name}"`
      );

      return result;
    } catch (error) {
      this.logger.error(
        `Error evaluating filter ${filter.id} against deal ${deal.externalId}:`,
        error
      );
      return {
        matches: false,
        score: 0,
        reasons: [
          'Evaluation error: ' + ((error as Error)?.message || 'Unknown error'),
        ],
      };
    }
  }

  /**
   * Evaluate multiple deals against a single filter efficiently
   *
   * @param filter - Filter to evaluate against
   * @param deals - Array of deals to evaluate
   * @returns Array of evaluation results in the same order as input deals
   */
  async evaluateFilterAgainstMultipleDeals(
    filter: Filter,
    deals: RawDeal[]
  ): Promise<FilterEvaluationResult[]> {
    this.logger.debug(
      `Evaluating filter "${filter.name}" against ${deals.length} deals`
    );

    const results = await Promise.all(
      deals.map((deal) => this.evaluateFilter(filter, deal))
    );

    const matchCount = results.filter((r) => r.matches).length;
    this.logger.debug(
      `Filter "${filter.name}" matched ${matchCount}/${deals.length} deals`
    );

    return results;
  }

  /**
   * Find all deals that match any of the provided filters
   *
   * @param deals - Deals to evaluate
   * @param filters - Filters to check against
   * @returns Array of deals that matched at least one filter
   */
  async findMatchingDeals(
    deals: RawDeal[],
    filters: Filter[]
  ): Promise<RawDeal[]> {
    if (filters.length === 0) {
      this.logger.debug('No filters provided - no deals will match');
      return [];
    }

    this.logger.debug(
      `Evaluating ${deals.length} deals against ${filters.length} filters`
    );

    // Process each deal in parallel to find if it matches any filter
    const dealEvaluationPromises = deals.map(async (deal) => {
      // For each deal, evaluate all filters in parallel until we find a match
      const filterEvaluationPromises = filters.map((filter) =>
        this.evaluateFilter(filter, deal).then((result) => result.matches)
      );

      const evaluationResults = await Promise.all(filterEvaluationPromises);
      const hasMatch = evaluationResults.some((matches) => matches);

      return { deal, hasMatch };
    });

    const dealResults = await Promise.all(dealEvaluationPromises);
    const matchingDeals = dealResults
      .filter((result) => result.hasMatch)
      .map((result) => result.deal);

    this.logger.debug(
      `Found ${matchingDeals.length}/${deals.length} deals matching at least one filter`
    );

    return matchingDeals;
  }

  /**
   * Analyze multiple filters to extract optimization parameters for URL filtering
   * Aggregates price ranges, heat thresholds, and other criteria for efficient pre-filtering
   *
   * @param filters - Array of filters to analyze
   * @returns Optimization analysis with URL and processing filter parameters
   */
  analyzeFiltersForOptimization(filters: Filter[]): FilterAnalysis {
    this.logger.debug(`Analyzing ${filters.length} filters for optimization`);

    const collectors = this.initializeOptimizationCollectors();

    for (const filter of filters) {
      this.extractFilterOptimizationData(filter, collectors);
    }

    const analysis = this.buildFilterAnalysis(collectors);

    this.logger.debug(
      `Filter optimization analysis complete: ` +
        `URL filters: ${Object.keys(analysis.urlFilters).length}, ` +
        `Processing filters: ${Object.keys(analysis.processingFilters).length}`
    );

    return analysis;
  }

  /**
   * Calculate a composite score for a deal against multiple filters
   * Useful for ranking deals by relevance
   *
   * @param deal - Deal to evaluate
   * @param filters - Filters to evaluate against
   * @returns Composite score (sum of all matching filter scores)
   */
  async calculateCompositeScore(
    deal: RawDeal,
    filters: Filter[]
  ): Promise<number> {
    const evaluations = await Promise.all(
      filters.map((filter) => this.evaluateFilter(filter, deal))
    );

    return evaluations
      .filter((evaluation) => evaluation.matches)
      .reduce((total, evaluation) => total + evaluation.score, 0);
  }

  // =====================================
  // Private Helper Methods for Reason Formatting
  // =====================================

  /**
   * Flatten evaluation details tree into a flat list of reason strings.
   * Groups are expanded to show their summary + individual child rules indented.
   */
  private flattenDetailReasons(
    details: RuleEvaluationDetail[],
    depth: number = 0
  ): string[] {
    const reasons: string[] = [];
    const indent = '  '.repeat(depth);

    for (const detail of details) {
      if (detail.children && detail.children.length > 0) {
        // Group: show summary header then recurse into children
        reasons.push(`${indent}${detail.reason}`);
        reasons.push(
          ...this.flattenDetailReasons(detail.children, depth + 1)
        );
      } else {
        reasons.push(`${indent}${detail.reason}`);
      }
    }

    return reasons;
  }

  // =====================================
  // Private Helper Methods for Optimization Analysis
  // =====================================

  /**
   * Initialize collectors for optimization data extraction
   */
  private initializeOptimizationCollectors(): OptimizationCollectors {
    return {
      maxPrices: [],
      minPrices: [],
      minHeats: [],
      processingFilters: {
        titleRegex: [],
        heatRange: {
          min: FILTER_EVALUATION_CONFIG.DEFAULT_HEAT_RANGE.MIN,
          max: FILTER_EVALUATION_CONFIG.DEFAULT_HEAT_RANGE.MAX,
        },
        descriptionKeywords: [],
      },
    };
  }

  /**
   * Extract optimization data from a single filter
   */
  private extractFilterOptimizationData(
    filter: Filter,
    collectors: OptimizationCollectors
  ): void {
    try {
      const expression = convertFilterExpressionFromDb(filter.filterExpression);

      if (expression.rules && Array.isArray(expression.rules)) {
        this.extractOptimizationFromRules(expression.rules, collectors);
      }
    } catch (error) {
      this.logger.warn(
        `Failed to extract optimization data from filter ${filter.id}:`,
        error
      );
    }
  }

  /**
   * Build final filter analysis from collected optimization data
   */
  private buildFilterAnalysis(
    collectors: OptimizationCollectors
  ): FilterAnalysis {
    // Build URL filters with dynamic properties
    const urlFilters: Record<string, unknown> = {
      sort: FILTER_EVALUATION_CONFIG.DEFAULT_SORT,
    };

    // Set price ranges for maximum compatibility
    if (collectors.maxPrices.length > 0) {
      urlFilters.price_max = Math.max(...collectors.maxPrices);
    }
    if (collectors.minPrices.length > 0) {
      urlFilters.price_min = Math.min(...collectors.minPrices);
    }

    // Update heat range if heat filters found
    const processingFilters = { ...collectors.processingFilters };
    if (collectors.minHeats.length > 0 && processingFilters.heatRange) {
      processingFilters.heatRange = {
        ...processingFilters.heatRange,
        min: Math.min(...collectors.minHeats),
      };
    }

    return {
      urlFilters: urlFilters as FilterAnalysis['urlFilters'],
      processingFilters,
    };
  }

  /**
   * Extract optimization data from filter rules recursively
   * Handles both individual rules and rule groups with nested logic
   */
  private extractOptimizationFromRules(
    rules: (FilterRule | FilterRuleGroup)[],
    collectors: OptimizationCollectors
  ): void {
    for (const rule of rules) {
      if (this.isFilterRuleGroup(rule)) {
        this.extractOptimizationFromRules(rule.rules, collectors);
      } else if (this.isValidFilterRule(rule)) {
        this.processIndividualRule(rule, collectors);
      }
    }
  }

  /**
   * Check if a rule is a filter rule group
   */
  private isFilterRuleGroup(
    rule: FilterRule | FilterRuleGroup
  ): rule is FilterRuleGroup {
    return 'logic' in rule && Boolean(rule.rules);
  }

  /**
   * Check if a rule is a valid individual filter rule
   */
  private isValidFilterRule(
    rule: FilterRule | FilterRuleGroup
  ): rule is FilterRule {
    return (
      'field' in rule &&
      Boolean(rule.field) &&
      Boolean(rule.operator) &&
      rule.value !== undefined
    );
  }

  /**
   * Process an individual filter rule for optimization data
   */
  private processIndividualRule(
    rule: FilterRule,
    collectors: OptimizationCollectors
  ): void {
    switch (rule.field) {
      case 'price':
      case 'currentPrice':
        this.extractPriceOptimization(rule, collectors);
        break;
      case 'temperature':
      case 'heat':
        this.extractHeatOptimization(rule, collectors);
        break;
      case 'title':
        this.extractTitleOptimization(rule, collectors);
        break;
    }
  }

  /**
   * Extract price optimization parameters from a rule
   */
  private extractPriceOptimization(
    rule: FilterRule,
    collectors: OptimizationCollectors
  ): void {
    const priceValue = Number(rule.value);

    if (rule.operator === '>=' || rule.operator === '>') {
      collectors.minPrices.push(priceValue);
    } else if (rule.operator === '<=' || rule.operator === '<') {
      collectors.maxPrices.push(priceValue);
    }
  }

  /**
   * Extract heat/temperature optimization parameters from a rule
   */
  private extractHeatOptimization(
    rule: FilterRule,
    collectors: OptimizationCollectors
  ): void {
    if (rule.operator === '>=' || rule.operator === '>') {
      collectors.minHeats.push(Number(rule.value));
    }
  }

  /**
   * Extract title optimization parameters from a rule
   */
  private extractTitleOptimization(
    rule: FilterRule,
    collectors: OptimizationCollectors
  ): void {
    if (rule.operator === 'REGEX') {
      try {
        collectors.processingFilters.titleRegex?.push(
          new RegExp(String(rule.value), 'i')
        );
      } catch (error) {
        this.logger.warn(`Invalid regex pattern: ${rule.value}`);
      }
    }
  }
}
