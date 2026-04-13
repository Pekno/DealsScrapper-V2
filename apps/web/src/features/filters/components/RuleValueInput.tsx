/**
 * RuleValueInput - Dynamic value input router
 * Routes to appropriate input component based on operator type
 */
import React, { useMemo, useCallback } from 'react';
import {
  FilterableField,
  FilterOperator,
  FIELD_DEFINITIONS,
  OPERATOR_DEFINITIONS,
} from '@/features/filters/types/filter.types';
import { RuleValueInputProps } from './ValueInputTypes';
import { TagInput } from './TagInput';
import { DateRangeInput } from './DateRangeInput';
import { NumberRangeInput } from './NumberRangeInput';
import { NoValueInput } from './NoValueInput';
import { SingleValueInput } from './SingleValueInput';
import {
  normalizeValue,
  getPlaceholderText,
  getValidationForField,
  getValidationMessageForField,
  getFormatterForField,
} from './ValueInputUtils';
import * as styles from './RuleValueInput.css';

/**
 * RuleValueInput component provides dynamic input interfaces
 * that adapt to field types and operators for optimal UX
 */
export const RuleValueInput: React.FC<RuleValueInputProps> = ({
  field,
  operator,
  value,
  onChange,
  disabled = false,
  className = '',
  placeholder,
  autoFocus = false,
}) => {
  // Get field and operator definitions
  const fieldDefinition = useMemo(() => {
    return FIELD_DEFINITIONS.find((f) => f.key === field);
  }, [field]);

  const operatorDefinition = useMemo(() => {
    return OPERATOR_DEFINITIONS.find((op) => op.key === operator);
  }, [operator]);

  // Determine input type needed
  const needsArrayInput = useMemo(() => {
    return operatorDefinition?.valueType === 'array';
  }, [operatorDefinition]);

  const needsRangeInput = useMemo(() => {
    return operatorDefinition?.valueType === 'double';
  }, [operatorDefinition]);

  const needsNoInput = useMemo(() => {
    return operatorDefinition?.valueType === 'none';
  }, [operatorDefinition]);

  // Convert value to appropriate format
  const normalizedValue = useMemo(() => {
    return normalizeValue(value, needsArrayInput, needsRangeInput);
  }, [value, needsArrayInput, needsRangeInput]);

  // Get placeholder text
  const placeholderText = useMemo(() => {
    return getPlaceholderText(field, operator, placeholder);
  }, [field, operator, placeholder]);

  // Handle single value change
  const handleSingleValueChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(e.target.value);
    },
    [onChange]
  );

  // Handle array value change
  const handleArrayValueChange = useCallback(
    (values: string[]) => {
      onChange(values);
    },
    [onChange]
  );

  // Handle range value change
  const handleRangeValueChange = useCallback(
    (values: [string, string]) => {
      onChange(values);
    },
    [onChange]
  );

  // No input needed
  if (needsNoInput) {
    return (
      <NoValueInput
        operatorLabel={operatorDefinition?.label || ''}
        className={className}
      />
    );
  }

  // Array input (multiple values)
  if (needsArrayInput) {
    return (
      <div className={`${styles.arrayInput.container} ${className}`}>
        <TagInput
          values={normalizedValue as string[]}
          onChange={handleArrayValueChange}
          placeholder={placeholderText}
          disabled={disabled}
          validation={getValidationForField(field)}
          validationMessage={getValidationMessageForField(field)}
          formatValue={getFormatterForField(field)}
        />
      </div>
    );
  }

  // Range input (two values)
  if (needsRangeInput) {
    const rangeValues = normalizedValue as [string, string];

    if (fieldDefinition?.type === 'date') {
      return (
        <div className={`${styles.rangeInput.container} ${className}`}>
          <DateRangeInput
            values={rangeValues}
            onChange={handleRangeValueChange}
            disabled={disabled}
            labels={operator === 'BETWEEN' ? ['From', 'To'] : ['Start', 'End']}
          />
        </div>
      );
    }

    if (fieldDefinition?.type === 'number') {
      const fieldType =
        fieldDefinition.key === 'price'
          ? 'price'
          : fieldDefinition.key === 'discountPercentage'
            ? 'percentage'
            : 'number';

      return (
        <div className={`${styles.rangeInput.container} ${className}`}>
          <NumberRangeInput
            values={rangeValues}
            onChange={handleRangeValueChange}
            disabled={disabled}
            labels={['Min', 'Max']}
            fieldType={fieldType}
            min={fieldType === 'percentage' ? 0 : undefined}
            max={fieldType === 'percentage' ? 100 : undefined}
          />
        </div>
      );
    }
  }

  // Single value input (default)
  return (
    <SingleValueInput
      value={normalizedValue as string}
      onChange={handleSingleValueChange}
      field={field}
      operator={operator}
      placeholder={placeholderText}
      disabled={disabled}
      autoFocus={autoFocus}
      className={className}
    />
  );
};

// Default export
export default RuleValueInput;

// Re-export helper functions for backward compatibility
export { isValueCompatible, getSuggestedValues } from './ValueInputUtils';
