/**
 * Filter Rule Interfaces
 * Type-safe rule definitions for each field type
 */
import type {
  SiteFieldType,
  StringOperator,
  NumberOperator,
  BooleanOperator,
  DateOperator,
  ArrayOperator,
  DurationUnit,
  Operator,
} from './types.js';

/** Base interface for all filter rules */
interface BaseFilterRule<T extends SiteFieldType, O extends Operator> {
  /** Field name to filter on */
  field: string;
  /** Field data type */
  fieldType: T;
  /** Comparison operator */
  operator: O;
}

/** Rule for string fields */
export interface StringRule extends BaseFilterRule<'string', StringOperator> {
  fieldType: 'string';
  operator: StringOperator;
  /** Value to compare against (string[] for IN operator) */
  value: string | string[];
  /** Whether comparison is case sensitive */
  caseSensitive?: boolean;
}

/** Rule for numeric fields */
export interface NumberRule extends BaseFilterRule<'number', NumberOperator> {
  fieldType: 'number';
  operator: NumberOperator;
  /** Value to compare against ([min, max] tuple for BETWEEN) */
  value: number | [number, number];
}

/** Rule for boolean fields */
export interface BooleanRule extends BaseFilterRule<'boolean', BooleanOperator> {
  fieldType: 'boolean';
  operator: BooleanOperator;
  // No value needed - operator IS the value (IS_TRUE/IS_FALSE)
}

/** Rule for date fields */
export interface DateRule extends BaseFilterRule<'date', DateOperator> {
  fieldType: 'date';
  operator: DateOperator;
  /** ISO date string or [startDate, endDate] tuple for BETWEEN */
  value: string | [string, string];
  /** Unit for OLDER_THAN/NEWER_THAN operators */
  unit?: DurationUnit;
}

/** Rule for array fields */
export interface ArrayRule extends BaseFilterRule<'array', ArrayOperator> {
  fieldType: 'array';
  operator: ArrayOperator;
  /** Value(s) to check for (optional for IS_EMPTY/IS_NOT_EMPTY) */
  value?: string | string[];
}

/** Discriminated union of all rule types */
export type SiteFilterRule = StringRule | NumberRule | BooleanRule | DateRule | ArrayRule;
