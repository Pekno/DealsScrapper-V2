/**
 * Filter Rule Types
 * Type definitions for filter operators and field types
 */

/** Field types that determine which operators are available */
export type SiteFieldType = 'string' | 'number' | 'boolean' | 'date' | 'array';

/** String comparison operators */
export type StringOperator =
  | 'EQUALS'
  | 'NOT_EQUALS'
  | 'CONTAINS'
  | 'NOT_CONTAINS'
  | 'STARTS_WITH'
  | 'ENDS_WITH'
  | 'REGEX'
  | 'IN';

/** Numeric comparison operators */
export type NumberOperator = '=' | '!=' | '<' | '<=' | '>' | '>=' | 'BETWEEN';

/** Boolean comparison operators */
export type BooleanOperator = 'IS_TRUE' | 'IS_FALSE';

/** Date comparison operators */
export type DateOperator = 'BEFORE' | 'AFTER' | 'BETWEEN' | 'OLDER_THAN' | 'NEWER_THAN';

/** Array comparison operators */
export type ArrayOperator =
  | 'CONTAINS'
  | 'NOT_CONTAINS'
  | 'CONTAINS_ANY'
  | 'CONTAINS_ALL'
  | 'IS_EMPTY'
  | 'IS_NOT_EMPTY';

/** Logical operators for combining rules */
export type SiteLogicalOperator = 'AND' | 'OR';

/** Union of all operators */
export type Operator =
  | StringOperator
  | NumberOperator
  | BooleanOperator
  | DateOperator
  | ArrayOperator;

/** Duration units for relative date comparisons */
export type DurationUnit = 'minutes' | 'hours' | 'days' | 'weeks' | 'months';
