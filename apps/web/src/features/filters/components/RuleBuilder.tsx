/**
 * RuleBuilder - Complex visual rule builder for filter creation
 * Implements the sophisticated visual rule system with nested groups,
 * logical operators, and dynamic field/operator selection
 */
import React, { useState, useCallback } from 'react';
import {
  FilterRule,
  FilterRuleGroup,
  LogicalOperator,
  FilterableField,
  FilterOperator,
  RuleBuilderProps,
  RuleItemProps,
  FIELD_DEFINITIONS,
  OPERATOR_DEFINITIONS,
} from '@/features/filters/types/filter.types';
import {
  FieldSelector,
  OperatorSelector,
  ValueInput,
  ActionButtons,
  RemoveButton,
  ErrorDisplay,
} from './RuleComponents';
import RuleGroup from './RuleGroup';
import * as styles from './RuleBuilder.css';
import { dataCy } from '@/shared/lib/test-utils';

// Utility functions for rule manipulation
const createEmptyRule = (): FilterRule => ({
  field: '' as FilterableField,
  operator: '' as FilterOperator,
  value: '',
  weight: 1.0,
});

const createEmptyGroup = (logic: LogicalOperator = 'AND'): FilterRuleGroup => ({
  logic,
  rules: [createEmptyRule()],
  weight: 1.0,
});

const isRule = (item: FilterRule | FilterRuleGroup): item is FilterRule => {
  return 'field' in item && 'operator' in item;
};

// Individual rule item component
const RuleItem: React.FC<RuleItemProps> = ({
  rule,
  onChange,
  onRemove,
  availableFields,
  operators,
  disabled = false,
  showRemoveButton = true,
  index,
}) => {
  const handleFieldChange = useCallback(
    (field: FilterableField) => {
      // Find the field definition to check if it's site-specific
      const fieldDef = availableFields.find((f) => f.key === field);
      const siteSpecific =
        fieldDef && fieldDef.sites !== 'universal' && fieldDef.sites.length > 0
          ? fieldDef.sites[0] // Auto-set to the first (usually only) site for this field
          : undefined;

      onChange({
        ...rule,
        field,
        operator: '' as FilterOperator, // Reset operator when field changes
        value: '', // Reset value when field changes
        siteSpecific,
      });
    },
    [rule, onChange, availableFields]
  );

  const handleOperatorChange = useCallback(
    (operator: FilterOperator) => {
      onChange({
        ...rule,
        operator,
        value: '', // Reset value when operator changes
      });
    },
    [rule, onChange]
  );

  const handleValueChange = useCallback(
    (value: FilterRule['value']) => {
      onChange({
        ...rule,
        value,
      });
    },
    [rule, onChange]
  );

  // Determine if the rule has validation errors
  const hasErrors =
    !rule.field ||
    !rule.operator ||
    (rule.value === '' && !['IS_TRUE', 'IS_FALSE'].includes(rule.operator));

  const ruleClassName = `${styles.ruleItem} ${hasErrors ? styles.errorState : ''} ${disabled ? styles.disabledState : ''}`;

  return (
    <div className={`${ruleClassName} ${styles.fadeInAnimation}`}>
      <FieldSelector
        value={rule.field}
        onChange={handleFieldChange}
        availableFields={availableFields}
        disabled={disabled}
        ruleIdentifier={index !== undefined ? `${index}` : undefined}
      />

      <OperatorSelector
        field={rule.field}
        value={rule.operator}
        onChange={handleOperatorChange}
        operators={operators}
        disabled={disabled}
        ruleIdentifier={index !== undefined ? `${index}` : undefined}
      />

      <ValueInput
        field={rule.field}
        operator={rule.operator}
        value={rule.value}
        onChange={handleValueChange}
        disabled={disabled}
        ruleIdentifier={index !== undefined ? `${index}` : undefined}
      />

      {showRemoveButton && (
        <RemoveButton
          onRemove={onRemove}
          disabled={disabled}
          label="Remove rule"
        />
      )}

      {hasErrors && (
        <ErrorDisplay message="Please complete all required fields" />
      )}
    </div>
  );
};

// Main RuleBuilder component
export const RuleBuilder: React.FC<RuleBuilderProps> = ({
  rules,
  onRulesChange,
  availableFields = FIELD_DEFINITIONS,
  operators = OPERATOR_DEFINITIONS,
  className = '',
  disabled = false,
}) => {
  const [validationErrors] = useState<string[]>([]);

  const handleRootRuleChange = useCallback(
    (index: number, newRule: FilterRule | FilterRuleGroup) => {
      const newRules = [...rules];
      newRules[index] = newRule;
      onRulesChange(newRules);
    },
    [rules, onRulesChange]
  );

  const handleAddRootRule = useCallback(() => {
    onRulesChange([...rules, createEmptyRule()]);
  }, [rules, onRulesChange]);

  const handleAddRootGroup = useCallback(() => {
    onRulesChange([...rules, createEmptyGroup()]);
  }, [rules, onRulesChange]);

  const handleRemoveRootRule = useCallback(
    (index: number) => {
      if (rules.length > 1) {
        const newRules = rules.filter((_, i) => i !== index);
        onRulesChange(newRules);
      }
    },
    [rules, onRulesChange]
  );

  // Initialize with at least one empty rule if none provided
  React.useEffect(() => {
    if (rules.length === 0) {
      onRulesChange([createEmptyRule()]);
    }
  }, [rules.length, onRulesChange]);

  const containerClassName = `${styles.ruleBuilderContainer} ${className} ${disabled ? styles.disabledState : ''}`;

  return (
    <div className={containerClassName}>
      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-red-800 mb-2">
            Please fix the following errors:
          </h4>
          <ul className="text-sm text-red-600 space-y-1">
            {validationErrors.map((error, index) => (
              <li key={index}>• {error}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Rule Groups and Rules */}
      <div className="space-y-4">
        {rules.map((rule, index) => (
          <div key={index}>
            {isRule(rule) ? (
              <RuleItem
                rule={rule}
                onChange={(newRule) => handleRootRuleChange(index, newRule)}
                onRemove={() => handleRemoveRootRule(index)}
                availableFields={availableFields}
                operators={operators}
                disabled={disabled}
                showRemoveButton={rules.length > 1}
                index={index}
              />
            ) : (
              <RuleGroup
                group={rule}
                onChange={(newGroup) => handleRootRuleChange(index, newGroup)}
                onRemove={() => handleRemoveRootRule(index)}
                level={0}
                availableFields={availableFields}
                operators={operators}
                disabled={disabled}
                showRemoveButton={rules.length > 1}
              />
            )}
          </div>
        ))}
      </div>

      {/* Main Action Buttons */}
      <div {...dataCy('add-rule-section')}>
        <ActionButtons
          onAddRule={handleAddRootRule}
          onAddGroup={handleAddRootGroup}
          disabled={disabled}
          level={0}
        />
      </div>

      {/* Debug Information (only in development) */}
      {process.env.NODE_ENV === 'development' && (
        <details className="mt-4 p-4 bg-gray-50 rounded-lg text-sm">
          <summary className="cursor-pointer font-medium text-gray-700">
            Debug: Rule Structure
          </summary>
          <pre className="mt-2 text-xs text-gray-600 overflow-auto">
            {JSON.stringify(rules, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
};

export default RuleBuilder;
