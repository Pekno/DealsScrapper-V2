// ponytail: This kernel is the single canonical operator contract shared by BOTH the
// scraper engine (RuleEngineService) and the API engine (FilterMatcherService). It started
// as the scraper's semantics verbatim, then absorbed the API's richer behavior during the
// Phase 7 reconciliation: `=`/`!=` stay strict ===/!==, while EQUALS/NOT_EQUALS/IN/NOT_IN
// are case-insensitive String()-coercion comparisons (honoring the rule's caseSensitive
// flag). Both services re-verify against this file's test-vector suite plus their own
// filter-matching specs. Do not "fix" edge cases here unilaterally — change it only as a
// deliberate, both-sides-re-verified reconciliation.

import { FilterOperator } from './filtering.js';

/** Regular expression flags mirroring the scraper engine's RULE_ENGINE_CONFIG. */
const REGEX_FLAGS = {
  CASE_SENSITIVE: '',
  CASE_INSENSITIVE: 'i',
} as const;

/** Time conversion constant mirroring the scraper engine's RULE_ENGINE_CONFIG. */
const MS_TO_HOURS = 1000 * 60 * 60;

/**
 * Evaluate a single filter operator between a field value and a rule value.
 *
 * Stateless, pure reproduction of the scraper RuleEngineService operator kernel
 * (evaluateOperator + evaluateOperatorByType + helpers). Same logic, same edge cases.
 *
 * @param operator - Filter operator to apply
 * @param fieldValue - Value extracted from the deal field
 * @param ruleValue - Expected value from the filter rule
 * @param caseSensitive - Whether string operations should be case-sensitive (default false)
 * @returns Boolean result of the operator evaluation
 * @throws Error if the operator is unknown
 */
export function evaluateFilterOperator(
  operator: FilterOperator,
  fieldValue: unknown,
  ruleValue: unknown,
  caseSensitive: boolean = false
): boolean {
  // Handle null/undefined field values with specific operator compatibility
  if (fieldValue === null || fieldValue === undefined) {
    return evaluateNullFieldValue(operator);
  }

  return evaluateOperatorByType(operator, fieldValue, ruleValue, caseSensitive);
}

/**
 * Evaluate operators by type category.
 */
function evaluateOperatorByType(
  operator: FilterOperator,
  fieldValue: unknown,
  ruleValue: unknown,
  caseSensitive: boolean
): boolean {
  switch (operator) {
    // Identity operators — strict, type-agnostic === / !== (no coercion).
    case '=':
      return fieldValue === ruleValue;
    case '!=':
      return fieldValue !== ruleValue;
    // String-equality operators — case-insensitive String() coercion by default.
    case 'EQUALS':
      return evaluateStringEquality(fieldValue, ruleValue, caseSensitive);
    case 'NOT_EQUALS':
      return !evaluateStringEquality(fieldValue, ruleValue, caseSensitive);
    case '>':
      return Number(fieldValue) > Number(ruleValue);
    case '>=':
      return Number(fieldValue) >= Number(ruleValue);
    case '<':
      return Number(fieldValue) < Number(ruleValue);
    case '<=':
      return Number(fieldValue) <= Number(ruleValue);

    // String operators
    case 'CONTAINS': {
      const search = caseSensitive
        ? String(ruleValue)
        : String(ruleValue).toLowerCase();
      return evaluateStringOperation(
        fieldValue,
        (field) => field.includes(search),
        caseSensitive
      );
    }
    case 'NOT_CONTAINS': {
      const search = caseSensitive
        ? String(ruleValue)
        : String(ruleValue).toLowerCase();
      return evaluateStringOperation(
        fieldValue,
        (field) => !field.includes(search),
        caseSensitive
      );
    }
    case 'STARTS_WITH': {
      const search = caseSensitive
        ? String(ruleValue)
        : String(ruleValue).toLowerCase();
      return evaluateStringOperation(
        fieldValue,
        (field) => field.startsWith(search),
        caseSensitive
      );
    }
    case 'ENDS_WITH': {
      const search = caseSensitive
        ? String(ruleValue)
        : String(ruleValue).toLowerCase();
      return evaluateStringOperation(
        fieldValue,
        (field) => field.endsWith(search),
        caseSensitive
      );
    }
    case 'REGEX':
      return evaluateRegexOperation(fieldValue, ruleValue, caseSensitive, false);
    case 'NOT_REGEX':
      return evaluateRegexOperation(fieldValue, ruleValue, caseSensitive, true);

    // Array operators
    case 'IN':
      return evaluateIn(fieldValue, ruleValue, caseSensitive);
    case 'NOT_IN':
      return (
        Array.isArray(ruleValue) &&
        !evaluateIn(fieldValue, ruleValue, caseSensitive)
      );
    case 'INCLUDES_ANY':
      return evaluateIncludesAny(fieldValue, ruleValue, caseSensitive);
    case 'INCLUDES_ALL':
      return evaluateIncludesAll(fieldValue, ruleValue, caseSensitive);
    case 'NOT_INCLUDES_ANY':
      return evaluateNotIncludesAny(fieldValue, ruleValue, caseSensitive);

    // Boolean operators
    case 'IS_TRUE':
      return Boolean(fieldValue) === true;
    case 'IS_FALSE':
      return Boolean(fieldValue) === false;

    // Range operators (works for numeric values, prices, temperatures, timestamps, etc.)
    case 'BETWEEN': {
      if (!Array.isArray(ruleValue) || ruleValue.length !== 2) return false;
      const numericValue = Number(fieldValue);
      const numericMin = Number(ruleValue[0]);
      const numericMax = Number(ruleValue[1]);
      return numericValue >= numericMin && numericValue <= numericMax;
    }

    // Date operators
    case 'BEFORE':
      return new Date(String(fieldValue)) < new Date(String(ruleValue));
    case 'AFTER':
      return new Date(String(fieldValue)) > new Date(String(ruleValue));
    case 'OLDER_THAN':
      return evaluateAgeComparison(fieldValue, ruleValue, 'older');
    case 'NEWER_THAN':
      return evaluateAgeComparison(fieldValue, ruleValue, 'newer');

    default:
      throw new Error(`Unknown operator: ${String(operator)}`);
  }
}

/**
 * Evaluate null/undefined field values against operators.
 * Only !=, NOT_EQUALS, and IS_FALSE return true for a null/undefined field.
 */
function evaluateNullFieldValue(operator: FilterOperator): boolean {
  return (
    operator === '!=' || operator === 'NOT_EQUALS' || operator === 'IS_FALSE'
  );
}

/**
 * Case-insensitive (by default) string-equality comparison via String() coercion.
 * Backs EQUALS/NOT_EQUALS — the "smart" equality variant distinct from the strict
 * `=`/`!=` identity operators. Honors caseSensitive.
 */
function evaluateStringEquality(
  fieldValue: unknown,
  ruleValue: unknown,
  caseSensitive: boolean
): boolean {
  const field = String(fieldValue);
  const rule = String(ruleValue);
  return caseSensitive
    ? field === rule
    : field.toLowerCase() === rule.toLowerCase();
}

/**
 * IN membership test: case-insensitive String() coercion by default, strict
 * `Array.prototype.includes` when caseSensitive. Returns false when ruleValue
 * is not an array. NOT_IN is the array-guarded negation of this.
 */
function evaluateIn(
  fieldValue: unknown,
  ruleValue: unknown,
  caseSensitive: boolean
): boolean {
  if (!Array.isArray(ruleValue)) return false;
  if (caseSensitive) return ruleValue.includes(fieldValue);
  const lowerField = String(fieldValue).toLowerCase();
  return ruleValue.some((v) => String(v).toLowerCase() === lowerField);
}

/**
 * Helper for case-sensitive string operations with proper type handling.
 */
function evaluateStringOperation(
  fieldValue: unknown,
  operation: (field: string) => boolean,
  caseSensitive: boolean
): boolean {
  const field = String(fieldValue);
  return operation(caseSensitive ? field : field.toLowerCase());
}

/**
 * Evaluate regex operations with error handling.
 * Returns `negate` (the opposite of the expectation) when the pattern is invalid.
 */
function evaluateRegexOperation(
  fieldValue: unknown,
  ruleValue: unknown,
  caseSensitive: boolean,
  negate: boolean
): boolean {
  try {
    const flags = caseSensitive
      ? REGEX_FLAGS.CASE_SENSITIVE
      : REGEX_FLAGS.CASE_INSENSITIVE;
    const regex = new RegExp(String(ruleValue), flags);
    const result = regex.test(String(fieldValue));
    return negate ? !result : result;
  } catch {
    return negate; // Return opposite of expectation on error
  }
}

/**
 * Evaluate INCLUDES_ANY array operation.
 */
function evaluateIncludesAny(
  fieldValue: unknown,
  ruleValue: unknown,
  caseSensitive: boolean
): boolean {
  if (!Array.isArray(ruleValue)) return false;

  return ruleValue.some((val) =>
    evaluateStringOperation(
      fieldValue,
      (field) => {
        const searchValue = caseSensitive
          ? String(val)
          : String(val).toLowerCase();
        return field.includes(searchValue);
      },
      caseSensitive
    )
  );
}

/**
 * Evaluate INCLUDES_ALL array operation.
 */
function evaluateIncludesAll(
  fieldValue: unknown,
  ruleValue: unknown,
  caseSensitive: boolean
): boolean {
  if (!Array.isArray(ruleValue)) return false;

  return ruleValue.every((val) => {
    const searchValue = caseSensitive
      ? String(val)
      : String(val).toLowerCase();
    return evaluateStringOperation(
      fieldValue,
      (field) => field.includes(searchValue),
      caseSensitive
    );
  });
}

/**
 * Evaluate NOT_INCLUDES_ANY array operation.
 */
function evaluateNotIncludesAny(
  fieldValue: unknown,
  ruleValue: unknown,
  caseSensitive: boolean
): boolean {
  if (!Array.isArray(ruleValue)) return true;

  return !ruleValue.some((val) => {
    const searchValue = caseSensitive
      ? String(val)
      : String(val).toLowerCase();
    return evaluateStringOperation(
      fieldValue,
      (field) => field.includes(searchValue),
      caseSensitive
    );
  });
}

/**
 * Evaluate age-based comparisons (OLDER_THAN/NEWER_THAN).
 * Computes the field value's age in hours from `Date.now()`, then compares against
 * the rule value (interpreted as a threshold in hours).
 */
function evaluateAgeComparison(
  fieldValue: unknown,
  ruleValue: unknown,
  comparison: 'older' | 'newer'
): boolean {
  const ageHours = calculateAgeHours(fieldValue);

  const thresholdHours = Number(ruleValue);
  return comparison === 'older'
    ? ageHours > thresholdHours
    : ageHours < thresholdHours;
}

/**
 * Calculate age in hours from a date-like field value.
 * Mirrors RuleEngineService.calculateDealAge: a falsy value yields 0 hours,
 * otherwise the age is (now - publishedAt) in hours.
 */
function calculateAgeHours(fieldValue: unknown): number {
  if (!fieldValue) {
    return 0;
  }
  return (Date.now() - new Date(fieldValue as string).getTime()) / MS_TO_HOURS;
}
