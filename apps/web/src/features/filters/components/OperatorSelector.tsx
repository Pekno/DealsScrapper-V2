/**
 * OperatorSelector Component
 * Allows users to select a filter operator based on the selected field
 */
import React from 'react';
import {
  FilterableField,
  FilterOperator,
  FilterOperatorDefinition,
  FIELD_DEFINITIONS,
  OPERATOR_DEFINITIONS,
} from '@/features/filters/types/filter.types';
import { Dropdown, DropdownOption } from '@/shared/ui/Dropdown';
import { RuleOperatorSelector } from '@/features/filters/components/RuleOperatorSelector';
import { getOperatorIcon } from './RuleIcons';
import { dataCy } from '@/shared/lib/test-utils';
import * as styles from './RuleBuilder.css';

export interface OperatorSelectorProps {
  field: FilterableField;
  value: FilterOperator;
  onChange: (operator: FilterOperator) => void;
  operators: FilterOperatorDefinition[];
  disabled?: boolean;
  enhanced?: boolean; // Use the enhanced RuleOperatorSelector
  showIcons?: boolean; // For enhanced version
  groupOperators?: boolean; // For enhanced version
  compact?: boolean; // For enhanced version
  ruleIdentifier?: string; // For semantic data-cy attributes
}

export const OperatorSelector: React.FC<OperatorSelectorProps> = ({
  field,
  value,
  onChange,
  operators,
  disabled = false,
  enhanced = false,
  showIcons = true,
  groupOperators = true,
  compact = false,
  ruleIdentifier,
}) => {
  // Use enhanced RuleOperatorSelector if requested
  if (enhanced) {
    return (
      <RuleOperatorSelector
        field={field}
        value={value}
        onChange={onChange}
        disabled={disabled}
        showIcons={showIcons}
        groupOperators={groupOperators}
        compact={compact}
        className={styles.operatorSelect}
      />
    );
  }

  // Original implementation (backward compatibility) - now using Dropdown
  const operatorFieldDef = FIELD_DEFINITIONS.find((f) => f.key === field);
  const availableOperators = operators.filter((op) =>
    operatorFieldDef ? operatorFieldDef.operators.includes(op.key) : true
  );

  // Convert operators to dropdown options with icons
  const options: DropdownOption[] = availableOperators.map((operator) => ({
    value: operator.key,
    label: operator.label,
    description: operator.description,
    icon: getOperatorIcon(operator.key),
  }));

  const handleChange = (selectedValue: string | string[]) => {
    onChange(selectedValue as FilterOperator);
  };

  // Generate semantic data-cy attribute
  const dataCyValue =
    ruleIdentifier && field
      ? `rule-operator-select-${field}-${ruleIdentifier}`
      : ruleIdentifier
        ? `rule-operator-select-${ruleIdentifier}`
        : 'rule-operator-select';

  // Generate aria-label with field and operator context
  const fieldDef = FIELD_DEFINITIONS.find((f) => f.key === field);
  const operatorDef = OPERATOR_DEFINITIONS.find((op) => op.key === value);
  const ariaLabel =
    fieldDef && operatorDef
      ? `Filter operator for ${fieldDef.label}: ${operatorDef.label} selected. Choose a different operator.`
      : fieldDef
        ? `Select filter operator for ${fieldDef.label}`
        : 'Select filter operator';

  return (
    <Dropdown
      options={options}
      value={value || ''}
      onChange={handleChange}
      placeholder="Select operator..."
      disabled={disabled || !field}
      searchable={options.length > 8}
      searchPlaceholder="Search operators..."
      className={disabled || !field ? styles.disabledState : ''}
      aria-label={ariaLabel}
      optionDataCyPrefix="operator-option"
      {...dataCy(dataCyValue)}
    />
  );
};
