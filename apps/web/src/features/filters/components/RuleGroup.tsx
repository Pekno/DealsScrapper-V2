/**
 * RuleGroup - Nested rule group component with logical operators
 * Handles complex nested rule group functionality with proper visual hierarchy
 * and state management for filter creation
 */
import React, { useState, useCallback, useMemo } from 'react';
import {
  FilterRule,
  FilterRuleGroup,
  LogicalOperator,
  FilterFieldDefinition,
  FilterOperatorDefinition,
  RuleGroupProps,
} from '@/features/filters/types/filter.types';
import {
  FieldSelector,
  OperatorSelector,
  ValueInput,
  LogicalOperatorToggle,
  ActionButtons,
  RemoveButton,
  RuleLoadingSpinner,
  ErrorDisplay,
} from '@/features/filters/components/RuleComponents';
import * as styles from './RuleGroup.css';

// Utility functions for rule manipulation
const createEmptyRule = (): FilterRule => ({
  field: '' as FilterRule['field'],
  operator: '' as FilterRule['operator'],
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

// Individual rule item component for within groups
const RuleItem: React.FC<{
  rule: FilterRule;
  onChange: (rule: FilterRule) => void;
  onRemove: () => void;
  availableFields: FilterFieldDefinition[];
  operators: FilterOperatorDefinition[];
  disabled?: boolean;
  showRemoveButton?: boolean;
}> = ({
  rule,
  onChange,
  onRemove,
  availableFields,
  operators,
  disabled = false,
  showRemoveButton = true,
}) => {
  const handleFieldChange = useCallback(
    (field: FilterRule['field']) => {
      onChange({
        ...rule,
        field,
        operator: '' as FilterRule['operator'], // Reset operator when field changes
        value: '', // Reset value when field changes
      });
    },
    [rule, onChange]
  );

  const handleOperatorChange = useCallback(
    (operator: FilterRule['operator']) => {
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
      />

      <OperatorSelector
        field={rule.field}
        value={rule.operator}
        onChange={handleOperatorChange}
        operators={operators}
        disabled={disabled}
      />

      <ValueInput
        field={rule.field}
        operator={rule.operator}
        value={rule.value}
        onChange={handleValueChange}
        disabled={disabled}
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

// Main RuleGroup component
export const RuleGroup: React.FC<RuleGroupProps> = ({
  group,
  onChange,
  onRemove,
  level,
  availableFields,
  operators,
  disabled = false,
  showRemoveButton,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const handleLogicChange = useCallback(
    (logic: LogicalOperator) => {
      onChange({
        ...group,
        logic,
      });
    },
    [group, onChange]
  );

  const handleRuleChange = useCallback(
    (index: number, newRule: FilterRule | FilterRuleGroup) => {
      const newRules = [...group.rules];
      newRules[index] = newRule;
      onChange({
        ...group,
        rules: newRules,
      });
    },
    [group, onChange]
  );

  const handleAddRule = useCallback(() => {
    setIsLoading(true);
    try {
      onChange({
        ...group,
        rules: [...group.rules, createEmptyRule()],
      });
    } finally {
      setIsLoading(false);
    }
  }, [group, onChange]);

  const handleAddGroup = useCallback(() => {
    setIsLoading(true);
    try {
      onChange({
        ...group,
        rules: [...group.rules, createEmptyGroup()],
      });
    } finally {
      setIsLoading(false);
    }
  }, [group, onChange]);

  const handleRemoveRule = useCallback(
    (index: number) => {
      if (group.rules.length > 1) {
        const newRules = group.rules.filter((_, i) => i !== index);
        onChange({
          ...group,
          rules: newRules,
        });
      }
    },
    [group, onChange]
  );

  // Validate the current rule group
  const validateGroup = useCallback(() => {
    const errors: string[] = [];

    const validateRule = (rule: FilterRule | FilterRuleGroup, path: string) => {
      if (isRule(rule)) {
        if (!rule.field) errors.push(`${path}: Field is required`);
        if (!rule.operator) errors.push(`${path}: Operator is required`);
        if (
          rule.value === '' &&
          !['IS_TRUE', 'IS_FALSE'].includes(rule.operator)
        ) {
          errors.push(`${path}: Value is required`);
        }
      } else {
        rule.rules.forEach((subRule, index) => {
          validateRule(subRule, `${path}.${index}`);
        });
      }
    };

    group.rules.forEach((rule, index) => {
      validateRule(rule, `Rule ${index + 1}`);
    });

    setValidationErrors(errors);
    return errors.length === 0;
  }, [group]);

  // Memoized style computations for performance
  const containerStyles = useMemo(() => {
    const baseClass =
      styles.ruleGroupContainer[
        `level${Math.min(level, 2)}` as keyof typeof styles.ruleGroupContainer
      ];
    const modifierClasses = [
      disabled && styles.disabledState,
      styles.slideInAnimation,
    ]
      .filter(Boolean)
      .join(' ');

    return `${baseClass} ${modifierClasses}`;
  }, [level, disabled]);

  const isNotGroup = group.logic === 'NOT';
  const canAddItems = !disabled && !(isNotGroup && group.rules.length >= 1);

  return (
    <div className={containerStyles}>
      {/* Group Header with Logic Operator and Remove Button */}
      <div className={styles.ruleGroupHeader}>
        <div className="flex items-center gap-3">
          <LogicalOperatorToggle
            value={group.logic}
            onChange={handleLogicChange}
            disabled={disabled}
          />

          {/* Visual nesting indicator */}
          {level > 0 && (
            <div className={styles.nestingIndicator}>
              <span className="text-xs text-gray-500 font-medium">
                Level {level + 1}
              </span>
            </div>
          )}

          {isLoading && <RuleLoadingSpinner />}
        </div>

        {/* Remove group button */}
        {(showRemoveButton !== undefined ? showRemoveButton : level > 0) && (
          <RemoveButton
            onRemove={onRemove}
            disabled={disabled}
            label="Remove group"
          />
        )}
      </div>

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <div className={styles.validationErrors}>
          <h4 className="text-sm font-semibold text-red-800 mb-2">
            Group validation errors:
          </h4>
          <ul className="text-sm text-red-600 space-y-1">
            {validationErrors.map((error, index) => (
              <li key={index}>• {error}</li>
            ))}
          </ul>
        </div>
      )}

      {/* NOT Group Information */}
      {isNotGroup && (
        <div className={styles.notGroupInfo}>
          <div className="flex items-center gap-2">
            <div className={styles.notIndicator}>NOT</div>
            <span className="text-sm text-gray-600">
              This group will exclude matching results
            </span>
          </div>
        </div>
      )}

      {/* Rules and Nested Groups */}
      <div className="space-y-2">
        {group.rules.map((rule, index) => {
          const ruleWrapperClass = isNotGroup
            ? styles.notRuleWrapper
            : styles.ruleWrapper;

          return (
            <div key={`${level}-${index}`} className={ruleWrapperClass}>
              {/* Logical connector for multiple rules */}
              {index > 0 && (
                <div className={styles.logicalConnector}>
                  <span className={styles.logicalConnectorText}>
                    {group.logic}
                  </span>
                </div>
              )}

              {isRule(rule) ? (
                <RuleItem
                  rule={rule}
                  onChange={(newRule) => handleRuleChange(index, newRule)}
                  onRemove={() => handleRemoveRule(index)}
                  availableFields={availableFields}
                  operators={operators}
                  disabled={disabled || (isNotGroup && group.rules.length > 1)}
                  showRemoveButton={group.rules.length > 1}
                />
              ) : (
                <RuleGroup
                  group={rule}
                  onChange={(newGroup) => handleRuleChange(index, newGroup)}
                  onRemove={() => handleRemoveRule(index)}
                  level={level + 1}
                  availableFields={availableFields}
                  operators={operators}
                  disabled={disabled}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Action Buttons */}
      <div className={styles.ruleGroupActions}>
        <ActionButtons
          onAddRule={handleAddRule}
          onAddGroup={handleAddGroup}
          disabled={!canAddItems || isLoading}
          level={level}
        />

        {/* Validation Button */}
        <button
          onClick={() => {
            validateGroup();
          }}
          disabled={disabled}
          className={styles.validateButton}
          title="Validate this group"
          type="button"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          Validate
        </button>
      </div>

      {/* Debug Information (development only) */}
      {process.env.NODE_ENV === 'development' && level === 0 && (
        <details className={styles.debugInfo}>
          <summary className="cursor-pointer font-medium text-gray-700">
            Debug: Group Structure (Level {level})
          </summary>
          <pre className="mt-2 text-xs text-gray-600 overflow-auto">
            {JSON.stringify(group, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
};

export default RuleGroup;
