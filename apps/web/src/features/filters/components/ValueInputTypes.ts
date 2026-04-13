/**
 * Shared types for value input components
 */
import { FilterableField, FilterOperator } from '@/features/filters/types/filter.types';

/**
 * Base props shared across all value input components
 */
export interface BaseValueInputProps {
  disabled?: boolean;
  className?: string;
}

/**
 * Props for the main RuleValueInput component
 */
export interface RuleValueInputProps extends BaseValueInputProps {
  field: FilterableField;
  operator: FilterOperator;
  value: string | string[];
  onChange: (value: string | string[]) => void;
  placeholder?: string;
  autoFocus?: boolean;
}

/**
 * Props for tag input (multiple values)
 */
export interface TagInputProps extends BaseValueInputProps {
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  validation?: (value: string) => boolean;
  validationMessage?: string;
  formatValue?: (value: string) => string;
}

/**
 * Props for date range input
 */
export interface DateRangeInputProps extends BaseValueInputProps {
  values: [string, string];
  onChange: (values: [string, string]) => void;
  labels?: [string, string];
}

/**
 * Props for number range input
 */
export interface NumberRangeInputProps extends BaseValueInputProps {
  values: [string, string];
  onChange: (values: [string, string]) => void;
  labels?: [string, string];
  fieldType?: 'price' | 'percentage' | 'number';
  min?: number;
  max?: number;
}

/**
 * Props for no value input (operators that don't need values)
 */
export interface NoValueInputProps extends BaseValueInputProps {
  operatorLabel: string;
}

/**
 * Props for single value input
 */
export interface SingleValueInputProps extends BaseValueInputProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  field: FilterableField;
  operator: FilterOperator;
  placeholder?: string;
  autoFocus?: boolean;
}
