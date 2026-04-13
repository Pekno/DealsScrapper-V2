/**
 * Operator Mapping and Type Guards
 * Maps field types to valid operators and provides type guard functions
 */
import type {
  SiteFieldType,
  Operator,
  StringOperator,
  NumberOperator,
  BooleanOperator,
  DateOperator,
  ArrayOperator,
} from './types.js';

/** Map of field types to their valid operators */
export const OPERATORS_BY_TYPE: Record<SiteFieldType, readonly Operator[]> = {
  string: ['EQUALS', 'NOT_EQUALS', 'CONTAINS', 'NOT_CONTAINS', 'STARTS_WITH', 'ENDS_WITH', 'REGEX', 'IN'] as const,
  number: ['=', '!=', '<', '<=', '>', '>=', 'BETWEEN'] as const,
  boolean: ['IS_TRUE', 'IS_FALSE'] as const,
  date: ['BEFORE', 'AFTER', 'BETWEEN', 'OLDER_THAN', 'NEWER_THAN'] as const,
  array: ['CONTAINS', 'NOT_CONTAINS', 'CONTAINS_ANY', 'CONTAINS_ALL', 'IS_EMPTY', 'IS_NOT_EMPTY'] as const,
};

/** All string operators as a set for efficient lookups */
const STRING_OPERATORS = new Set<string>(OPERATORS_BY_TYPE.string);

/** All number operators as a set for efficient lookups */
const NUMBER_OPERATORS = new Set<string>(OPERATORS_BY_TYPE.number);

/** All boolean operators as a set for efficient lookups */
const BOOLEAN_OPERATORS = new Set<string>(OPERATORS_BY_TYPE.boolean);

/** All date operators as a set for efficient lookups */
const DATE_OPERATORS = new Set<string>(OPERATORS_BY_TYPE.date);

/** All array operators as a set for efficient lookups */
const ARRAY_OPERATORS = new Set<string>(OPERATORS_BY_TYPE.array);

/**
 * Type guard: checks if operator is valid for string fields
 */
export function isStringOperator(op: Operator | string): op is StringOperator {
  return STRING_OPERATORS.has(op);
}

/**
 * Type guard: checks if operator is valid for number fields
 */
export function isNumberOperator(op: Operator | string): op is NumberOperator {
  return NUMBER_OPERATORS.has(op);
}

/**
 * Type guard: checks if operator is valid for boolean fields
 */
export function isBooleanOperator(op: Operator | string): op is BooleanOperator {
  return BOOLEAN_OPERATORS.has(op);
}

/**
 * Type guard: checks if operator is valid for date fields
 */
export function isDateOperator(op: Operator | string): op is DateOperator {
  return DATE_OPERATORS.has(op);
}

/**
 * Type guard: checks if operator is valid for array fields
 */
export function isArrayOperator(op: Operator | string): op is ArrayOperator {
  return ARRAY_OPERATORS.has(op);
}

/**
 * Checks if an operator is valid for a given field type
 */
export function isOperatorValidForType(operator: string, fieldType: SiteFieldType): boolean {
  const validOperators = OPERATORS_BY_TYPE[fieldType];
  return validOperators.includes(operator as Operator);
}

/**
 * Get the display label for an operator
 */
export function getOperatorLabel(operator: Operator): string {
  const labels: Record<Operator, string> = {
    // String
    EQUALS: 'equals',
    NOT_EQUALS: 'does not equal',
    CONTAINS: 'contains',
    NOT_CONTAINS: 'does not contain',
    STARTS_WITH: 'starts with',
    ENDS_WITH: 'ends with',
    REGEX: 'matches pattern',
    IN: 'is one of',
    // Number
    '=': 'equals',
    '!=': 'does not equal',
    '<': 'less than',
    '<=': 'less than or equal',
    '>': 'greater than',
    '>=': 'greater than or equal',
    BETWEEN: 'between',
    // Boolean
    IS_TRUE: 'is true',
    IS_FALSE: 'is false',
    // Date
    BEFORE: 'before',
    AFTER: 'after',
    OLDER_THAN: 'older than',
    NEWER_THAN: 'newer than',
    // Array
    CONTAINS_ANY: 'contains any of',
    CONTAINS_ALL: 'contains all of',
    IS_EMPTY: 'is empty',
    IS_NOT_EMPTY: 'is not empty',
  };
  return labels[operator] || operator;
}
