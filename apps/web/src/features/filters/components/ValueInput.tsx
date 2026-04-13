/**
 * ValueInput Component
 * Renders appropriate input field(s) based on field type and operator
 */
import React from 'react';
import {
  FilterableField,
  FilterOperator,
  FIELD_DEFINITIONS,
  OPERATOR_DEFINITIONS,
} from '@/features/filters/types/filter.types';
import { NumberInput } from '@/shared/ui/NumberInput';
import { getOperatorDataCyKey } from './RuleIcons';
import { dataCy } from '@/shared/lib/test-utils';
import { getPlaceholder } from './ValueInputHelpers';
import * as styles from './RuleBuilder.css';

/** Possible value types for filter rule values
 * Matches FilterRule['value'] with additional support for BETWEEN operator tuples
 */
export type FilterRuleValue = string | string[] | number | number[] | boolean;

export interface ValueInputProps {
  field: FilterableField;
  operator: FilterOperator;
  value: FilterRuleValue;
  onChange: (value: FilterRuleValue) => void;
  disabled?: boolean;
  ruleIdentifier?: string; // For semantic data-cy attributes
}

export const ValueInput: React.FC<ValueInputProps> = ({
  field,
  operator,
  value,
  onChange,
  disabled = false,
  ruleIdentifier,
}) => {
  const fieldDef = FIELD_DEFINITIONS.find((f) => f.key === field);
  const operatorDef = OPERATOR_DEFINITIONS.find((op) => op.key === operator);

  if (!operatorDef || operatorDef.valueType === 'none') {
    return null; // No input needed for boolean operators like IS_TRUE, IS_FALSE
  }

  const inputClassName = `${styles.valueInput} ${disabled ? styles.disabledState : ''}`;

  // Handle different value input types
  if (operatorDef.valueType === 'double') {
    // For BETWEEN operator - two inputs
    // Extract values from array, defaulting to empty strings
    const arrayValue = Array.isArray(value) ? value : [value, ''];
    const value1 = typeof arrayValue[0] === 'number' || typeof arrayValue[0] === 'string'
      ? arrayValue[0]
      : '';
    const value2 = typeof arrayValue[1] === 'number' || typeof arrayValue[1] === 'string'
      ? arrayValue[1]
      : '';

    // Use NumberInput for numeric fields, regular input for others
    if (fieldDef?.type === 'number') {
      const numValue1 = typeof value1 === 'number' ? value1 : 0;
      const numValue2 = typeof value2 === 'number' ? value2 : 0;
      const toNumber = (v: number | string | undefined): number =>
        typeof v === 'number' ? v : (typeof v === 'string' ? parseFloat(v) || 0 : 0);
      return (
        <div className={styles.valueInputDouble}>
          <NumberInput
            value={numValue1}
            onChange={(newValue) => onChange([toNumber(newValue), numValue2])}
            placeholder="Min value"
            disabled={disabled}
            size="md"
            min={fieldDef?.min}
            max={fieldDef?.max}
            step={fieldDef?.step || 1}
            precision={fieldDef?.precision}
          />
          <span className="text-gray-500 text-sm">and</span>
          <NumberInput
            value={numValue2}
            onChange={(newValue) => onChange([numValue1, toNumber(newValue)])}
            placeholder="Max value"
            disabled={disabled}
            size="md"
            min={fieldDef?.min}
            max={fieldDef?.max}
            step={fieldDef?.step || 1}
            precision={fieldDef?.precision}
          />
        </div>
      );
    } else {
      const stringValue1 = String(value1);
      const stringValue2 = String(value2);
      return (
        <div className={styles.valueInputDouble}>
          <input
            type="text"
            className={inputClassName}
            value={stringValue1}
            onChange={(e) => onChange([e.target.value, stringValue2])}
            placeholder="Min value"
            disabled={disabled}
          />
          <span className="text-gray-500 text-sm">and</span>
          <input
            type="text"
            className={inputClassName}
            value={stringValue2}
            onChange={(e) => onChange([stringValue1, e.target.value])}
            placeholder="Max value"
            disabled={disabled}
          />
        </div>
      );
    }
  }

  if (operatorDef.valueType === 'array') {
    // For array operators like IN, NOT_IN, INCLUDES_ANY
    // Convert to string for display - handle all value types
    const displayValue = Array.isArray(value)
      ? value.join(', ')
      : typeof value === 'string'
        ? value
        : typeof value === 'number'
          ? String(value)
          : '';

    return (
      <input
        type="text"
        className={inputClassName}
        value={displayValue}
        onChange={(e) => {
          const values = e.target.value
            .split(',')
            .map((v) => v.trim())
            .filter((v) => v);
          onChange(values);
        }}
        placeholder="Enter values separated by commas"
        disabled={disabled}
      />
    );
  }

  // Single value input
  if (fieldDef?.type === 'number') {
    // Use NumberInput for numeric fields - ensure we have number | string value
    const numericValue = typeof value === 'number' || typeof value === 'string'
      ? value
      : '';
    return (
      <NumberInput
        value={numericValue}
        onChange={(newValue) => onChange(typeof newValue === 'number' ? newValue : parseFloat(newValue) || 0)}
        placeholder={getPlaceholder(field, operator)}
        disabled={disabled}
        size="md"
        min={fieldDef?.min}
        max={fieldDef?.max}
        step={fieldDef?.step || 1}
        precision={fieldDef?.precision}
        {...dataCy(
          (() => {
            let dataCyValue = 'rule-value-input';
            if (ruleIdentifier) {
              if (field && operator) {
                dataCyValue = `rule-value-input-${field}-${getOperatorDataCyKey(operator)}-${ruleIdentifier}`;
              } else if (field) {
                dataCyValue = `rule-value-input-${field}-${ruleIdentifier}`;
              } else {
                dataCyValue = `rule-value-input-${ruleIdentifier}`;
              }
            }
            return dataCyValue;
          })()
        )}
      />
    );
  }

  // Regular input for non-numeric fields
  const inputType = fieldDef?.type === 'date' ? 'datetime-local' : 'text';
  // Ensure we have string value for text input
  const textValue = typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '';

  return (
    <input
      type={inputType}
      className={inputClassName}
      value={textValue}
      onChange={(e) => onChange(e.target.value)}
      placeholder={getPlaceholder(field, operator)}
      disabled={disabled}
      {...dataCy(
        (() => {
          let dataCyValue = 'rule-value-input';
          if (ruleIdentifier) {
            if (field && operator) {
              dataCyValue = `rule-value-input-${field}-${getOperatorDataCyKey(operator)}-${ruleIdentifier}`;
            } else if (field) {
              dataCyValue = `rule-value-input-${field}-${ruleIdentifier}`;
            } else {
              dataCyValue = `rule-value-input-${ruleIdentifier}`;
            }
          }
          return dataCyValue;
        })()
      )}
    />
  );
};
