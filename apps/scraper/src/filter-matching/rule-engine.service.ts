import { Injectable, Logger } from '@nestjs/common';
import { RawDeal, evaluateFilterOperator } from '@dealscrapper/shared-types';
import { extractErrorMessage } from '@dealscrapper/shared';
import {
  FilterRule,
  FilterRuleGroup,
  RuleBasedFilterExpression,
  FilterableField,
  FilterOperator,
  LogicalOperator,
} from '@dealscrapper/shared-types';

/** Configuration constants for rule engine evaluation behavior */
const RULE_ENGINE_CONFIG = {
  /** Default scoring and threshold values */
  SCORING: {
    NO_RULES_SCORE: 100,
    DEFAULT_SCORE_PER_RULE: 100,
    DEFAULT_MIN_SCORE_THRESHOLD: 50,
  },
  /** Default values for fallback scenarios */
  DEFAULTS: {
    WEIGHT: 1.0,
    MATCH_LOGIC: 'AND' as const,
    CASE_SENSITIVE: false,
  },
  /** Time conversion constants */
  TIME_CONVERSION: {
    MS_TO_HOURS: 1000 * 60 * 60,
  },
  /** Deal age calculation limits */
  DEAL_AGE: {
    DEFAULT_AGE_HOURS: 0,
  },
  /** Brand pattern detection for extraction */
  BRAND_PATTERNS: {
    COMMON_BRANDS:
      /\b(apple|samsung|sony|lg|dell|hp|asus|acer|lenovo|microsoft|nintendo|xbox|playstation)\b/i,
  },
} as const;

/** Enhanced rule evaluation result with comprehensive match details */
export interface RuleEvaluationResult {
  readonly matches: boolean;
  readonly score: number;
  readonly maxPossibleScore: number;
  readonly details: RuleEvaluationDetail[];
}

/** Detailed information about individual rule evaluation results */
export interface RuleEvaluationDetail {
  readonly rule: FilterRule | FilterRuleGroup;
  readonly matches: boolean;
  readonly score: number;
  readonly weight: number;
  readonly reason: string;
  readonly children?: RuleEvaluationDetail[];
}

@Injectable()
export class RuleEngineService {
  private readonly logger = new Logger(RuleEngineService.name);

  /**
   * Evaluate a rule-based filter expression against a raw deal.
   * Processes all rules and rule groups within the expression to determine match status and score.
   * @param expression - Rule-based filter expression containing rules and evaluation logic
   * @param deal - Raw deal data to evaluate against the filter rules
   * @returns Comprehensive evaluation result with match status, score, and detailed reasoning
   * @throws Error if evaluation encounters unexpected errors during processing
   */
  async evaluateFilterExpression(
    expression: RuleBasedFilterExpression,
    deal: RawDeal
  ): Promise<RuleEvaluationResult> {
    try {
      // Handle empty or missing rules case
      if (!expression.rules || expression.rules.length === 0) {
        return this.createNoRulesResult();
      }

      const evaluationContext = await this.evaluateAllRules(
        expression.rules,
        deal
      );
      const matchLogic =
        expression.matchLogic ?? RULE_ENGINE_CONFIG.DEFAULTS.MATCH_LOGIC;
      const matches = this.applyMatchLogic(
        evaluationContext.details,
        matchLogic
      );

      const finalScore = this.calculateFinalScore(
        evaluationContext.totalScore,
        evaluationContext.maxPossibleScore
      );

      const minScoreThreshold =
        expression.minScore ??
        RULE_ENGINE_CONFIG.SCORING.DEFAULT_MIN_SCORE_THRESHOLD;
      const meetsThreshold = finalScore >= minScoreThreshold;
      const finalMatches = matches && meetsThreshold;

      // Add threshold failure details if needed
      if (matches && !meetsThreshold) {
        evaluationContext.details.push(
          this.createThresholdFailureDetail(minScoreThreshold, finalScore)
        );
      }

      return {
        matches: finalMatches,
        score: Math.round(finalScore * 100) / 100,
        maxPossibleScore:
          Math.round(evaluationContext.maxPossibleScore * 100) / 100,
        details: evaluationContext.details,
      };
    } catch (error) {
      return this.createErrorResult(error);
    }
  }

  /**
   * Evaluate a single rule or rule group using type guard pattern.
   * Determines rule type and delegates to appropriate evaluation method.
   * @param rule - Filter rule or rule group to evaluate
   * @param deal - Raw deal data for evaluation context
   * @returns Detailed evaluation result with score and reasoning
   */
  private async evaluateRule(
    rule: FilterRule | FilterRuleGroup,
    deal: RawDeal
  ): Promise<RuleEvaluationDetail> {
    return this.isRuleGroup(rule)
      ? this.evaluateRuleGroup(rule, deal)
      : this.evaluateSimpleRule(rule, deal);
  }

  /**
   * Evaluate a simple filter rule against deal data.
   * Extracts field value, applies operator logic, and generates human-readable reasoning.
   * @param rule - Individual filter rule to evaluate
   * @param deal - Raw deal data containing field values
   * @returns Evaluation detail with match status, score, and descriptive reason
   */
  private evaluateSimpleRule(
    rule: FilterRule,
    deal: RawDeal
  ): RuleEvaluationDetail {
    try {
      const fieldValue = this.extractFieldValue(rule.field, deal);
      const caseSensitive =
        rule.caseSensitive ?? RULE_ENGINE_CONFIG.DEFAULTS.CASE_SENSITIVE;
      const matches = this.evaluateOperator(
        rule.operator,
        fieldValue,
        rule.value,
        caseSensitive
      );

      const weight = rule.weight ?? RULE_ENGINE_CONFIG.DEFAULTS.WEIGHT;
      const score = matches
        ? weight * RULE_ENGINE_CONFIG.SCORING.DEFAULT_SCORE_PER_RULE
        : 0;
      const reason = this.generateRuleReason(rule, fieldValue, matches);

      return {
        rule,
        matches,
        score,
        weight,
        reason,
      };
    } catch (error) {
      return this.createRuleErrorDetail(rule, error);
    }
  }

  /**
   * Evaluate a rule group with logical operators (AND/OR/NOT).
   * Processes all rules within the group and applies group logic to determine overall result.
   * @param group - Rule group containing multiple rules and logical operator
   * @param deal - Raw deal data for rule evaluation
   * @returns Aggregated evaluation result for the entire rule group
   */
  private async evaluateRuleGroup(
    group: FilterRuleGroup,
    deal: RawDeal
  ): Promise<RuleEvaluationDetail> {
    const groupEvaluation = await this.evaluateGroupRules(group.rules, deal);
    const matches = this.applyMatchLogic(groupEvaluation.details, group.logic);
    const weight = group.weight ?? RULE_ENGINE_CONFIG.DEFAULTS.WEIGHT;

    const score = this.calculateGroupScore(
      group.logic,
      matches,
      groupEvaluation.totalScore,
      weight
    );

    const reason = this.generateGroupReason(
      group.logic,
      groupEvaluation.details,
      matches
    );

    return {
      rule: group,
      matches,
      score,
      weight,
      reason,
      children: groupEvaluation.details,
    };
  }

  /**
   * Extract field value from raw deal using type-safe field access.
   * Handles computed fields, direct properties, and special extraction cases.
   * @param field - Field name to extract from the deal
   * @param deal - Raw deal object containing field data
   * @returns Extracted field value or computed value
   * @throws Error if field is unknown or extraction fails
   */
  private extractFieldValue(field: FilterableField, deal: RawDeal): unknown {
    // Handle computed/alias fields first
    const computedValue = this.getComputedFieldValue(field, deal);
    if (computedValue !== undefined) {
      return computedValue;
    }

    // Handle direct RawDeal fields using type-safe key access
    if (field in deal) {
      return deal[field as keyof RawDeal];
    }
  }

  /**
   * Evaluate operator between field value and rule value.
   * Supports numeric, string, array, boolean, and date operations with proper type handling.
   * @param operator - Filter operator to apply
   * @param fieldValue - Value extracted from the deal field
   * @param ruleValue - Expected value from the filter rule
   * @param caseSensitive - Whether string operations should be case-sensitive
   * @returns Boolean result of the operator evaluation
   * @throws Error if operator is unknown or evaluation fails
   */
  private evaluateOperator(
    operator: FilterOperator,
    fieldValue: unknown,
    ruleValue: unknown,
    caseSensitive: boolean = false
  ): boolean {
    return evaluateFilterOperator(operator, fieldValue, ruleValue, caseSensitive);
  }

  /**
   * Apply logical operators (AND/OR/NOT) to rule results.
   * Determines overall match status based on individual rule results and logic operator.
   * @param details - Array of individual rule evaluation results
   * @param logic - Logical operator to apply across all results
   * @returns Combined boolean result based on logic operator
   */
  private applyMatchLogic(
    details: RuleEvaluationDetail[],
    logic: LogicalOperator
  ): boolean {
    switch (logic) {
      case 'AND':
        return details.every((detail) => detail.matches);
      case 'OR':
        return details.some((detail) => detail.matches);
      case 'NOT':
        return !details.some((detail) => detail.matches);
      default:
        return details.every((detail) => detail.matches); // Default to AND
    }
  }

  /**
   * Calculate final score by normalizing the accumulated score to a 0-100 scale.
   * @param totalScore - Accumulated score from all matching rules
   * @param maxPossibleScore - Maximum possible score from all rules
   * @returns Final calculated score value (0-100)
   */
  private calculateFinalScore(
    totalScore: number,
    maxPossibleScore: number
  ): number {
    return maxPossibleScore > 0 ? (totalScore / maxPossibleScore) * 100 : 0;
  }

  // =====================================
  // Helper Methods for Field Extraction
  // =====================================

  /**
   * Calculate discount percentage from original and current prices.
   * @param deal - Raw deal containing price information
   * @returns Calculated discount percentage or 0 if calculation not possible
   */
  private calculateDiscountPercent(deal: RawDeal): number {
    if (
      !deal.originalPrice ||
      !deal.currentPrice ||
      deal.originalPrice <= deal.currentPrice
    ) {
      return 0;
    }
    return (
      ((deal.originalPrice - deal.currentPrice) / deal.originalPrice) * 100
    );
  }

  /**
   * Calculate deal age in hours from published date.
   * @param deal - Raw deal containing publication timestamp
   * @returns Age in hours or 0 if no published date available
   */
  private calculateDealAge(deal: RawDeal): number {
    if (!deal.publishedAt) {
      return RULE_ENGINE_CONFIG.DEAL_AGE.DEFAULT_AGE_HOURS;
    }
    return (
      (Date.now() - new Date(deal.publishedAt).getTime()) /
      RULE_ENGINE_CONFIG.TIME_CONVERSION.MS_TO_HOURS
    );
  }

  /**
   * Extract brand name from deal title using pattern recognition.
   * @param deal - Raw deal containing title information
   * @returns Extracted brand name or null if not found
   */
  private extractBrand(deal: RawDeal): string | null {
    // Extract from title using common brand patterns
    const match = deal.title?.match(
      RULE_ENGINE_CONFIG.BRAND_PATTERNS.COMMON_BRANDS
    );
    return match ? match[1] : null;
  }

  // =====================================
  // Human-Readable Formatting Methods
  // =====================================

  /**
   * Convert technical field names to human-readable display names.
   * @param field - Technical field name to convert
   * @returns Human-readable field name for UI display
   */
  private getHumanFieldName(field: string): string {
    const fieldMap: Record<string, string> = {
      title: 'Title',
      description: 'Description',
      price: 'Price',
      currentPrice: 'Current Price',
      originalPrice: 'Original Price',
      discountPercentage: 'Discount %',
      discountAmount: 'Discount Amount',
      brand: 'Brand',
      model: 'Model',
      category: 'Category',
      subcategory: 'Subcategory',
      merchant: 'Merchant',
      merchantType: 'Merchant Type',
      temperature: 'Temperature',
      heat: 'Temperature',
      voteCount: 'Vote Count',
      commentCount: 'Comments',
      viewCount: 'Views',
      isSponsored: 'Is Sponsored',
      isExpired: 'Is Expired',
      isCoupon: 'Is Coupon',
      freeShipping: 'Free Shipping',
      stockLevel: 'Stock Level',
      dealType: 'Deal Type',
      publishedAt: 'Published Date',
      age: 'Deal Age',
      source: 'Source',
      keywords: 'Keywords',
      tags: 'Tags',
    } as const;

    return fieldMap[field] ?? field;
  }

  /**
   * Convert technical operators to human-readable descriptions.
   * @param operator - Technical operator string to convert
   * @returns Human-readable operator description
   */
  private getHumanOperator(operator: string): string {
    const operatorMap: Record<string, string> = {
      '=': '==',
      EQUALS: '==',
      '!=': '!=',
      NOT_EQUALS: '!=',
      '>': '>',
      '>=': '>=',
      '<': '<',
      '<=': '<=',
      CONTAINS: 'contains',
      NOT_CONTAINS: '!contains',
      STARTS_WITH: 'starts with',
      ENDS_WITH: 'ends with',
      REGEX: 'regex',
      NOT_REGEX: '!regex',
      IN: 'in',
      NOT_IN: '!in',
      INCLUDES_ANY: 'includes any',
      INCLUDES_ALL: 'includes all',
      NOT_INCLUDES_ANY: '!includes any',
      IS_TRUE: '== true',
      IS_FALSE: '== false',
      BEFORE: 'before',
      AFTER: 'after',
      BETWEEN: 'between',
      OLDER_THAN: 'older than',
      NEWER_THAN: 'newer than',
    } as const;

    return operatorMap[operator] ?? operator;
  }

  /**
   * Format values for human-readable display with proper type handling.
   * @param value - Value to format for display
   * @returns Human-readable string representation of the value
   */
  private formatHumanValue(value: unknown): string {
    if (value === null || value === undefined) {
      return 'empty';
    }

    if (Array.isArray(value)) {
      return `[${value.map((v) => JSON.stringify(v)).join(', ')}]`;
    }

    if (typeof value === 'boolean') {
      return value ? 'yes' : 'no';
    }

    if (typeof value === 'number') {
      return value.toString();
    }

    if (typeof value === 'string') {
      return `"${value}"`;
    }

    if (value instanceof Date) {
      return value.toLocaleString();
    }

    return JSON.stringify(value);
  }

  // =====================================
  // Private Helper Methods
  // =====================================

  /**
   * Type guard to determine if a rule is a rule group.
   */
  private isRuleGroup(
    rule: FilterRule | FilterRuleGroup
  ): rule is FilterRuleGroup {
    return 'logic' in rule;
  }

  /**
   * Create result for expressions with no rules defined.
   * Phase 7 convergence (V2): an empty rule set matches NOTHING, aligning with
   * the API engine. A filter with no rules should never spam every deal.
   */
  private createNoRulesResult(): RuleEvaluationResult {
    return {
      matches: false,
      score: 0,
      maxPossibleScore: RULE_ENGINE_CONFIG.SCORING.NO_RULES_SCORE,
      details: [
        {
          rule: { field: 'title', operator: 'EQUALS', value: true },
          matches: false,
          score: 0,
          weight: RULE_ENGINE_CONFIG.DEFAULTS.WEIGHT,
          reason: 'No rules defined - matches nothing',
        },
      ],
    };
  }

  /**
   * Evaluate all rules and accumulate scores.
   */
  private async evaluateAllRules(
    rules: (FilterRule | FilterRuleGroup)[],
    deal: RawDeal
  ): Promise<{
    details: RuleEvaluationDetail[];
    totalScore: number;
    maxPossibleScore: number;
  }> {
    const details: RuleEvaluationDetail[] = [];
    let totalScore = 0;
    let maxPossibleScore = 0;

    for (const rule of rules) {
      const result = await this.evaluateRule(rule, deal);
      details.push(result);
      totalScore += result.score;
      maxPossibleScore +=
        result.weight * RULE_ENGINE_CONFIG.SCORING.DEFAULT_SCORE_PER_RULE;
    }

    return { details, totalScore, maxPossibleScore };
  }

  /**
   * Create threshold failure detail for scoring.
   */
  private createThresholdFailureDetail(
    minScoreThreshold: number,
    finalScore: number
  ): RuleEvaluationDetail {
    return {
      rule: { field: 'title', operator: '>=', value: minScoreThreshold },
      matches: false,
      score: 0,
      weight: 0,
      reason: `Score threshold >= ${minScoreThreshold} => ${finalScore.toFixed(1)} ❌`,
    };
  }

  /**
   * Create error result for evaluation failures.
   */
  private createErrorResult(error: unknown): RuleEvaluationResult {
    const errorMessage = extractErrorMessage(error);
    this.logger.error('Error evaluating filter expression:', error);

    return {
      matches: false,
      score: 0,
      maxPossibleScore: 0,
      details: [
        {
          rule: { field: 'title', operator: 'EQUALS', value: 'error' },
          matches: false,
          score: 0,
          weight: 0,
          reason: `Evaluation error: ${errorMessage}`,
        },
      ],
    };
  }

  /**
   * Generate human-readable reason for rule evaluation.
   */
  private generateRuleReason(
    rule: FilterRule,
    fieldValue: unknown,
    matches: boolean
  ): string {
    const humanFieldName = this.getHumanFieldName(rule.field);
    const humanOperator = this.getHumanOperator(rule.operator);
    const humanValue = this.formatHumanValue(rule.value);
    const humanFieldValue = this.formatHumanValue(fieldValue);
    const statusIcon = matches ? '✅' : '❌';

    return `${humanFieldName} ${humanOperator} ${humanValue} => ${humanFieldValue} ${statusIcon}`;
  }

  /**
   * Create error detail for rule evaluation failures.
   */
  private createRuleErrorDetail(
    rule: FilterRule,
    error: unknown
  ): RuleEvaluationDetail {
    const errorMessage = extractErrorMessage(error);

    return {
      rule,
      matches: false,
      score: 0,
      weight: rule.weight ?? RULE_ENGINE_CONFIG.DEFAULTS.WEIGHT,
      reason: `❌ Error evaluating ${rule.field}: ${errorMessage}`,
    };
  }

  /**
   * Evaluate all rules within a group.
   */
  private async evaluateGroupRules(
    rules: (FilterRule | FilterRuleGroup)[],
    deal: RawDeal
  ): Promise<{ details: RuleEvaluationDetail[]; totalScore: number }> {
    const details: RuleEvaluationDetail[] = [];
    let totalScore = 0;

    for (const rule of rules) {
      const result = await this.evaluateRule(rule, deal);
      details.push(result);
      totalScore += result.score;
    }

    return { details, totalScore };
  }

  /**
   * Calculate score for rule groups based on logic type.
   */
  private calculateGroupScore(
    logic: LogicalOperator,
    matches: boolean,
    totalScore: number,
    weight: number
  ): number {
    // For NOT groups, scoring is inverted
    if (logic === 'NOT') {
      return matches
        ? weight * RULE_ENGINE_CONFIG.SCORING.DEFAULT_SCORE_PER_RULE
        : 0;
    }
    return matches ? totalScore * weight : 0;
  }

  /**
   * Generate human-readable reason for rule groups.
   */
  private generateGroupReason(
    logic: LogicalOperator,
    details: RuleEvaluationDetail[],
    matches: boolean
  ): string {
    const matchingRulesCount = details.filter((d) => d.matches).length;
    const groupLogic =
      logic === 'AND' ? 'ALL' : logic === 'OR' ? 'ANY' : 'NONE';
    const statusIcon = matches ? '✅' : '❌';

    if (matches) {
      return `Group(${groupLogic}): ${matchingRulesCount}/${details.length} rules matched ${statusIcon}`;
    }

    const requirement =
      logic === 'AND' ? 'all' : logic === 'OR' ? 'at least one' : 'none';
    return `Group(${groupLogic}): ${matchingRulesCount}/${details.length} rules matched (required: ${requirement}) ${statusIcon}`;
  }

  /**
   * Get computed field values for alias fields.
   */
  private getComputedFieldValue(
    field: FilterableField,
    deal: RawDeal
  ): unknown {
    switch (field) {
      case 'price':
        return deal.currentPrice;
      case 'heat':
        return deal.temperature;
      case 'rating':
        return undefined; // Not available in RawDeal
      case 'stock':
      case 'availability':
        return undefined; // Not available in RawDeal
      case 'specs':
        return null; // RawDeal doesn't have metadata field
      case 'age':
        return this.calculateDealAge(deal);
      case 'discountPercent':
        return this.calculateDiscountPercent(deal);
      default:
        return undefined;
    }
  }
}
