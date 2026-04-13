// Filter utility functions shared across services

import {
  FilterExpressionInput,
  RuleBasedFilterExpression,
  FilterRule,
} from './filtering.js';

/**
 * Converts FilterExpressionInput (rule-based with Date objects) to JSON-compatible format
 */
export function convertFilterExpressionForDb(
  expression: FilterExpressionInput
): Record<string, unknown> {
  if (!expression || !expression.rules || !Array.isArray(expression.rules)) {
    return {
      rules: [],
      matchLogic: 'AND',
      minScore: 50,
      scoreMode: 'weighted',
    };
  }

  const converted: Record<string, unknown> = { ...expression };

  // Convert Date objects to ISO strings in rule values for JSON storage
  if (converted.rules && Array.isArray(converted.rules)) {
    converted.rules = (converted.rules as FilterRule[]).map((rule) => {
      if (rule.value instanceof Date) {
        return { ...rule, value: rule.value.toISOString() };
      }
      if (Array.isArray(rule.value)) {
        const processedArray = rule.value.map((v: unknown) => {
          if (v instanceof Date) {
            return v.toISOString();
          }
          return v;
        });
        return {
          ...rule,
          value: processedArray as string[] | number[],
        };
      }
      return rule;
    });
  }

  return converted;
}

/**
 * Helper function to process rule values (convert dates)
 */
function processRuleValue(rule: FilterRule): FilterRule {
  if (
    typeof rule.value === 'string' &&
    rule.value.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
  ) {
    try {
      return { ...rule, value: new Date(rule.value) };
    } catch {
      // Invalid date string, keep as string
      return rule;
    }
  }
  if (Array.isArray(rule.value)) {
    const processedArray = rule.value.map((v: unknown) => {
      if (
        typeof v === 'string' &&
        v.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
      ) {
        try {
          return new Date(v);
        } catch {
          return v;
        }
      }
      return v;
    });
    return {
      ...rule,
      value: processedArray as string[] | number[] | Date[],
    };
  }
  return rule;
}

/**
 * Type guard to check if an object is a valid FilterExpressionInput
 */
function isFilterExpressionInput(value: unknown): value is FilterExpressionInput {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return Array.isArray(obj.rules);
}

/**
 * Converts JSON back to FilterExpressionInput (rule-based with Date objects)
 */
export function convertFilterExpressionFromDb(
  expression: unknown
): FilterExpressionInput {
  if (isFilterExpressionInput(expression)) {
    return expression;
  }

  return {
    rules: [],
    matchLogic: 'AND',
    minScore: 50,
    scoreMode: 'weighted',
  };
}
