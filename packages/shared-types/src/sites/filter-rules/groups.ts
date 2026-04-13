/**
 * Rule Groups and Filter Expressions
 * Structures for combining multiple rules with logical operators
 */
import type { SiteLogicalOperator } from './types.js';
import type { SiteFilterRule } from './rules.js';

/** A group of rules combined with a logical operator */
export interface SiteRuleGroup {
  /** Identifies this as a group (for discriminated union) */
  type: 'group';
  /** Logical operator to combine rules (AND | OR) */
  operator: SiteLogicalOperator;
  /** Child rules or nested groups */
  rules: (SiteFilterRule | SiteRuleGroup)[];
}

/** Top-level filter expression (single rule or rule group) */
export type SiteFilterExpression = SiteFilterRule | SiteRuleGroup;

/** Error codes for validation failures */
export type ValidationErrorCode =
  | 'INVALID_FIELD'
  | 'INVALID_OPERATOR_FOR_TYPE'
  | 'INVALID_VALUE_TYPE'
  | 'MISSING_VALUE'
  | 'FIELD_NOT_AVAILABLE_FOR_SITES'
  | 'INVALID_REGEX'
  | 'EMPTY_GROUP'
  | 'INVALID_BETWEEN_VALUES';

/** Single validation error */
export interface ValidationError {
  /** Path to the error (e.g., "rules[0].value", "rules[1].rules[2].operator") */
  path: string;
  /** Human-readable error message */
  message: string;
  /** Error code for programmatic handling */
  code: ValidationErrorCode;
}

/** Result of validating a filter expression */
export interface ValidationResult {
  /** Whether the expression is valid */
  valid: boolean;
  /** Array of validation errors (empty if valid) */
  errors: ValidationError[];
}
