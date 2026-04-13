import { Injectable } from '@nestjs/common';
import { PrismaService } from '@dealscrapper/database';
import type { Filter } from '@dealscrapper/database';
import {
  FilterRule,
  FilterRuleGroup,
  RuleBasedFilterExpression,
  FilterOperator,
  LogicalOperator,
  FilterableField,
} from '@dealscrapper/shared-types';
import {
  ArticleWrapper,
  SiteSource,
} from '@dealscrapper/shared-types/article';
import { createServiceLogger } from '@dealscrapper/shared-logging';
import { apiLogConfig } from '../../config/logging.config.js';
import { parseFilterExpression } from '../utils/filter-expression.utils.js';

/**
 * Service responsible for matching articles against user-defined filters.
 *
 * Implements the rule-based filter matching system with support for:
 * - Multi-site filtering (only match filters with article.source in enabledSites)
 * - Site-specific rules (skip rules when siteSpecific doesn't match article.source)
 * - Comprehensive operator support (=, >, <, CONTAINS, REGEX, IN, BETWEEN, etc.)
 * - Nested logical groups (AND, OR, NOT)
 * - Scoring logic (weighted, percentage, points modes)
 */
@Injectable()
export class FilterMatcherService {
  private readonly logger = createServiceLogger(apiLogConfig);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Finds all active filters that match the given article.
   *
   * @param article - ArticleWrapper containing base article + site-specific extension
   * @returns Array of matching Filter objects
   */
  async matchArticle(article: ArticleWrapper): Promise<Filter[]> {
    this.logger.debug(
      `Finding matching filters for article: ${article.base.id} (source: ${article.source})`,
    );

    // Only fetch filters that:
    // 1. Are active
    // 2. Have categories that match the article's site (siteId)
    // Note: enabledSites field removed - sites are now derived from categories
    const filters = await this.prisma.filter.findMany({
      where: {
        active: true,
        categories: {
          some: {
            category: {
              siteId: article.source, // Match articles by category's site
            },
          },
        },
      },
      include: {
        categories: {
          include: {
            category: {
              include: {
                site: true,
              },
            },
          },
        },
      },
    });

    this.logger.debug(
      `Found ${filters.length} active filters for site: ${article.source}`,
    );

    // Evaluate each filter's expression against the article
    const matchingFilters: Filter[] = [];

    for (const filter of filters) {
      try {
        const expression = parseFilterExpression(filter.filterExpression);
        if (!expression) {
          this.logger.warn(`Invalid filter expression for filter "${filter.name}" (${filter.id})`);
          continue;
        }
        const matches = this.evaluateFilterExpression(expression, article);

        if (matches) {
          matchingFilters.push(filter);
          this.logger.debug(`Filter "${filter.name}" (${filter.id}) matched`);
        }
      } catch (error) {
        this.logger.error(
          `Error evaluating filter "${filter.name}" (${filter.id}): ${error.message}`,
          error.stack,
        );
      }
    }

    this.logger.log(
      `Article ${article.base.id} matched ${matchingFilters.length} filters`,
    );

    return matchingFilters;
  }

  /**
   * Evaluates a complete filter expression tree against an article.
   *
   * @param expression - RuleBasedFilterExpression containing rules and settings
   * @param article - ArticleWrapper to evaluate against
   * @returns true if the article matches the filter expression
   */
  evaluateFilterExpression(
    expression: RuleBasedFilterExpression,
    article: ArticleWrapper,
  ): boolean {
    const { rules, matchLogic = 'AND', minScore, scoreMode } = expression;

    // If no rules, filter matches nothing
    if (!rules || rules.length === 0) {
      return false;
    }

    // If scoring is enabled, calculate score
    if (minScore !== undefined && minScore > 0) {
      const score = this.calculateScore(rules, article, scoreMode ?? 'weighted');
      const matches = score >= minScore;

      this.logger.debug(
        `Score-based evaluation: ${score} (min: ${minScore}, mode: ${scoreMode}) -> ${matches}`,
      );

      return matches;
    }

    // Boolean evaluation based on matchLogic
    const results = rules.map((rule) => this.evaluateRuleOrGroup(rule, article));

    if (matchLogic === 'AND') {
      return results.every((r) => r);
    } else if (matchLogic === 'OR') {
      return results.some((r) => r);
    } else {
      // NOT logic (negate all results)
      return !results.every((r) => r);
    }
  }

  /**
   * Evaluates a single rule or rule group.
   *
   * @param ruleOrGroup - FilterRule or FilterRuleGroup to evaluate
   * @param article - ArticleWrapper to evaluate against
   * @returns true if the rule/group matches
   */
  private evaluateRuleOrGroup(
    ruleOrGroup: FilterRule | FilterRuleGroup,
    article: ArticleWrapper,
  ): boolean {
    // Check if this is a rule group (has 'logic' property)
    if ('logic' in ruleOrGroup) {
      return this.evaluateRuleGroup(ruleOrGroup, article);
    } else {
      return this.evaluateRule(ruleOrGroup, article);
    }
  }

  /**
   * Evaluates a single filter rule against an article.
   *
   * Site-specific rule logic:
   * - If rule.siteSpecific is defined AND it doesn't match article.source,
   *   return true (skip the rule - don't fail the match).
   * - This allows multi-site filters to work across different sites by
   *   ignoring incompatible rules.
   *
   * @param rule - FilterRule to evaluate
   * @param article - ArticleWrapper to evaluate against
   * @returns true if the rule matches or should be skipped
   */
  evaluateRule(rule: FilterRule, article: ArticleWrapper): boolean {
    // Site-specific rule handling
    // Check if rule has siteSpecific property (it's optional in the interface)
    const siteSpecific = (rule as FilterRule & { siteSpecific?: string }).siteSpecific;
    if (siteSpecific && siteSpecific !== article.source) {
      this.logger.debug(
        `Skipping site-specific rule for field "${rule.field}" (siteSpecific: ${siteSpecific}, article.source: ${article.source})`,
      );
      return true; // Skip the rule (don't fail the match)
    }

    // Get field value from article
    const fieldValue = this.getFieldValue(article, rule.field);

    // Evaluate based on operator
    const matches = this.evaluateOperator(
      rule.operator,
      fieldValue,
      rule.value,
      rule.caseSensitive ?? false,
    );

    this.logger.debug(
      `Rule evaluation: field="${rule.field}", operator="${rule.operator}", value="${fieldValue}" vs "${rule.value}" -> ${matches}`,
    );

    return matches;
  }

  /**
   * Evaluates a logical group of rules.
   *
   * @param group - FilterRuleGroup with logic operator and nested rules
   * @param article - ArticleWrapper to evaluate against
   * @returns true if the group matches
   */
  evaluateRuleGroup(
    group: FilterRuleGroup,
    article: ArticleWrapper,
  ): boolean {
    const { logic, rules } = group;

    if (!rules || rules.length === 0) {
      return true; // Empty group matches
    }

    const results = rules.map((rule) => this.evaluateRuleOrGroup(rule, article));

    switch (logic) {
      case 'AND':
        return results.every((r) => r);
      case 'OR':
        return results.some((r) => r);
      case 'NOT':
        // NOT negates all results
        return !results.every((r) => r);
      default:
        this.logger.warn(`Unknown logic operator: ${logic}`);
        return false;
    }
  }

  /**
   * Gets a field value from an ArticleWrapper using type-safe accessors.
   *
   * @param article - ArticleWrapper to extract field from
   * @param field - FilterableField name
   * @returns Field value or null if not found
   */
  private getFieldValue(
    article: ArticleWrapper,
    field: FilterableField,
  ): string | number | boolean | Date | string[] | number[] | null {
    // Check base article fields first
    if (field in article.base) {
      return article.base[field as keyof typeof article.base] as
        | string
        | number
        | boolean
        | Date
        | null;
    }

    // Check site-specific extension fields
    if (field in article.extension) {
      return article.extension[field as keyof typeof article.extension] as
        | string
        | number
        | boolean
        | Date
        | null;
    }

    // Handle computed fields
    switch (field) {
      case 'age': {
        // Hours since scrapedAt
        const scrapedAt = article.base.scrapedAt;
        const now = new Date();
        return (now.getTime() - scrapedAt.getTime()) / (1000 * 60 * 60);
      }
      case 'discountPercent': {
        // Calculated percentage
        if (article.isDealabs()) {
          const originalPrice = article.extension.originalPrice;
          const currentPrice = article.base.currentPrice;
          if (originalPrice && currentPrice && originalPrice > 0) {
            return ((originalPrice - currentPrice) / originalPrice) * 100;
          }
        }
        return null;
      }
      case 'heat':
        // Alias for temperature (Dealabs only)
        if (article.isDealabs()) {
          return article.extension.temperature;
        }
        return null;
      case 'price':
        // Alias for currentPrice (universal field in base)
        return article.base.currentPrice;
      case 'stock':
      case 'availability':
        // Alias for stockLevel (Dealabs only)
        if (article.isDealabs() && 'stockLevel' in article.extension) {
          return (article.extension as typeof article.extension & { stockLevel: string | null }).stockLevel;
        }
        return null;
      case 'rating':
        // Alias for merchantRating (Dealabs only)
        if (article.isDealabs() && 'merchantRating' in article.extension) {
          return (article.extension as typeof article.extension & { merchantRating: number | null }).merchantRating;
        }
        return null;
      case 'specs':
        // Alias for metadata (Dealabs only)
        if (article.isDealabs() && 'metadata' in article.extension) {
          return (article.extension as typeof article.extension & { metadata: unknown }).metadata as null; // JSON field
        }
        return null;
      default:
        this.logger.warn(`Unknown field: ${field}`);
        return null;
    }
  }

  /**
   * Evaluates a filter operator against field and comparison values.
   *
   * Supports all operators: =, !=, >, >=, <, <=, CONTAINS, NOT_CONTAINS,
   * STARTS_WITH, ENDS_WITH, REGEX, NOT_REGEX, EQUALS, NOT_EQUALS, IN, NOT_IN,
   * INCLUDES_ANY, INCLUDES_ALL, NOT_INCLUDES_ANY, IS_TRUE, IS_FALSE, BEFORE,
   * AFTER, BETWEEN, OLDER_THAN, NEWER_THAN.
   *
   * @param operator - FilterOperator to apply
   * @param fieldValue - Actual value from the article field
   * @param compareValue - Expected value from the filter rule
   * @param caseSensitive - Whether string comparisons are case-sensitive
   * @returns true if the operator condition is satisfied
   */
  private evaluateOperator(
    operator: FilterOperator,
    fieldValue: string | number | boolean | Date | string[] | number[] | null,
    compareValue: string | number | boolean | string[] | number[] | Date | Date[],
    caseSensitive: boolean,
  ): boolean {
    // Handle null field values
    if (fieldValue === null || fieldValue === undefined) {
      // Only IS_FALSE can match null (treat as false)
      return operator === 'IS_FALSE';
    }

    switch (operator) {
      // Numeric operators
      case '=':
        return fieldValue === compareValue;
      case '!=':
        return fieldValue !== compareValue;
      case '>':
        return typeof fieldValue === 'number' &&
          typeof compareValue === 'number'
          ? fieldValue > compareValue
          : false;
      case '>=':
        return typeof fieldValue === 'number' &&
          typeof compareValue === 'number'
          ? fieldValue >= compareValue
          : false;
      case '<':
        return typeof fieldValue === 'number' &&
          typeof compareValue === 'number'
          ? fieldValue < compareValue
          : false;
      case '<=':
        return typeof fieldValue === 'number' &&
          typeof compareValue === 'number'
          ? fieldValue <= compareValue
          : false;

      // String operators
      case 'CONTAINS': {
        const strField = String(fieldValue);
        const strCompare = String(compareValue);
        return caseSensitive
          ? strField.includes(strCompare)
          : strField.toLowerCase().includes(strCompare.toLowerCase());
      }
      case 'NOT_CONTAINS': {
        const strField = String(fieldValue);
        const strCompare = String(compareValue);
        return caseSensitive
          ? !strField.includes(strCompare)
          : !strField.toLowerCase().includes(strCompare.toLowerCase());
      }
      case 'STARTS_WITH': {
        const strField = String(fieldValue);
        const strCompare = String(compareValue);
        return caseSensitive
          ? strField.startsWith(strCompare)
          : strField.toLowerCase().startsWith(strCompare.toLowerCase());
      }
      case 'ENDS_WITH': {
        const strField = String(fieldValue);
        const strCompare = String(compareValue);
        return caseSensitive
          ? strField.endsWith(strCompare)
          : strField.toLowerCase().endsWith(strCompare.toLowerCase());
      }
      case 'REGEX':
      case 'NOT_REGEX': {
        try {
          const flags = caseSensitive ? '' : 'i';
          const regex = new RegExp(String(compareValue), flags);
          const matches = regex.test(String(fieldValue));
          return operator === 'REGEX' ? matches : !matches;
        } catch (error) {
          this.logger.error(
            `Invalid regex pattern: ${compareValue}`,
            error.stack,
          );
          return false;
        }
      }
      case 'EQUALS': {
        const strField = String(fieldValue);
        const strCompare = String(compareValue);
        return caseSensitive
          ? strField === strCompare
          : strField.toLowerCase() === strCompare.toLowerCase();
      }
      case 'NOT_EQUALS': {
        const strField = String(fieldValue);
        const strCompare = String(compareValue);
        return caseSensitive
          ? strField !== strCompare
          : strField.toLowerCase() !== strCompare.toLowerCase();
      }

      // Array operators
      case 'IN': {
        if (!Array.isArray(compareValue)) {
          return false;
        }
        if (caseSensitive) {
          return (compareValue as (string | number)[]).includes(fieldValue as string | number);
        } else {
          const lowerField = String(fieldValue).toLowerCase();
          return (compareValue as (string | number)[]).some(
            (v: string | number) => String(v).toLowerCase() === lowerField,
          );
        }
      }
      case 'NOT_IN': {
        if (!Array.isArray(compareValue)) {
          return false;
        }
        if (caseSensitive) {
          return !(compareValue as (string | number)[]).includes(fieldValue as string | number);
        } else {
          const lowerField = String(fieldValue).toLowerCase();
          return !(compareValue as (string | number)[]).some(
            (v: string | number) => String(v).toLowerCase() === lowerField,
          );
        }
      }
      case 'INCLUDES_ANY': {
        if (!Array.isArray(fieldValue) || !Array.isArray(compareValue)) {
          return false;
        }
        if (caseSensitive) {
          return (compareValue as (string | number)[]).some((v: string | number) => (fieldValue as (string | number)[]).includes(v));
        } else {
          const lowerFieldArray = (fieldValue as (string | number)[]).map((v: string | number) =>
            String(v).toLowerCase(),
          );
          return (compareValue as (string | number)[]).some((v: string | number) =>
            lowerFieldArray.includes(String(v).toLowerCase()),
          );
        }
      }
      case 'INCLUDES_ALL': {
        if (!Array.isArray(fieldValue) || !Array.isArray(compareValue)) {
          return false;
        }
        if (caseSensitive) {
          return (compareValue as (string | number)[]).every((v: string | number) => (fieldValue as (string | number)[]).includes(v));
        } else {
          const lowerFieldArray = (fieldValue as (string | number)[]).map((v: string | number) =>
            String(v).toLowerCase(),
          );
          return (compareValue as (string | number)[]).every((v: string | number) =>
            lowerFieldArray.includes(String(v).toLowerCase()),
          );
        }
      }
      case 'NOT_INCLUDES_ANY': {
        if (!Array.isArray(fieldValue) || !Array.isArray(compareValue)) {
          return false;
        }
        if (caseSensitive) {
          return !(compareValue as (string | number)[]).some((v: string | number) => (fieldValue as (string | number)[]).includes(v));
        } else {
          const lowerFieldArray = (fieldValue as (string | number)[]).map((v: string | number) =>
            String(v).toLowerCase(),
          );
          return !(compareValue as (string | number)[]).some((v: string | number) =>
            lowerFieldArray.includes(String(v).toLowerCase()),
          );
        }
      }

      // Boolean operators
      case 'IS_TRUE':
        return fieldValue === true;
      case 'IS_FALSE':
        return fieldValue === false || fieldValue === null;

      // Date operators
      case 'BEFORE': {
        if (!(fieldValue instanceof Date) || !(compareValue instanceof Date)) {
          return false;
        }
        return fieldValue < compareValue;
      }
      case 'AFTER': {
        if (!(fieldValue instanceof Date) || !(compareValue instanceof Date)) {
          return false;
        }
        return fieldValue > compareValue;
      }
      case 'BETWEEN': {
        if (
          !(fieldValue instanceof Date) ||
          !Array.isArray(compareValue) ||
          compareValue.length !== 2
        ) {
          return false;
        }
        const [start, end] = compareValue as Date[];
        return fieldValue >= start && fieldValue <= end;
      }
      case 'OLDER_THAN': {
        // compareValue is number of hours
        if (
          !(fieldValue instanceof Date) ||
          typeof compareValue !== 'number'
        ) {
          return false;
        }
        const now = new Date();
        const ageHours = (now.getTime() - fieldValue.getTime()) / (1000 * 60 * 60);
        return ageHours > compareValue;
      }
      case 'NEWER_THAN': {
        // compareValue is number of hours
        if (
          !(fieldValue instanceof Date) ||
          typeof compareValue !== 'number'
        ) {
          return false;
        }
        const now = new Date();
        const ageHours = (now.getTime() - fieldValue.getTime()) / (1000 * 60 * 60);
        return ageHours < compareValue;
      }

      default:
        this.logger.warn(`Unsupported operator: ${operator}`);
        return false;
    }
  }

  /**
   * Calculates a score for an article based on weighted rules.
   *
   * @param rules - Array of FilterRule or FilterRuleGroup
   * @param article - ArticleWrapper to score
   * @param scoreMode - Scoring method (weighted, percentage, points)
   * @returns Calculated score
   */
  private calculateScore(
    rules: (FilterRule | FilterRuleGroup)[],
    article: ArticleWrapper,
    scoreMode: 'weighted' | 'percentage' | 'points',
  ): number {
    let totalWeight = 0;
    let earnedWeight = 0;

    for (const rule of rules) {
      const weight = rule.weight ?? 1.0;
      totalWeight += weight;

      const matches = this.evaluateRuleOrGroup(rule, article);
      if (matches) {
        earnedWeight += weight;
      }
    }

    switch (scoreMode) {
      case 'weighted':
        // Return raw earned weight
        return earnedWeight;
      case 'percentage':
        // Return percentage (0-100)
        return totalWeight > 0 ? (earnedWeight / totalWeight) * 100 : 0;
      case 'points':
        // Return points (same as weighted for now)
        return earnedWeight;
      default:
        return earnedWeight;
    }
  }
}
