/**
 * RuleOperatorSelector - Enhanced operator selection component for filter rules
 * Provides dynamic operator options based on field type with user-friendly labels
 */
import React, { useMemo, useCallback } from 'react';
import {
  FilterableField,
  FilterOperator,
  FilterFieldDefinition,
  FilterOperatorDefinition,
  FIELD_DEFINITIONS,
  OPERATOR_DEFINITIONS,
} from '@/features/filters/types/filter.types';
import * as styles from './RuleOperatorSelector.css';
import { Dropdown, DropdownOption, DropdownGroup } from '@/shared/ui/Dropdown';

// Enhanced operator definitions with icons and grouping
interface EnhancedOperatorDefinition extends FilterOperatorDefinition {
  icon?: string;
  group: 'comparison' | 'text' | 'logic' | 'date' | 'array';
  shortLabel?: string;
}

// Extended operator definitions for better UX
const ENHANCED_OPERATORS: EnhancedOperatorDefinition[] = [
  // Comparison operators (numbers, strings)
  {
    ...OPERATOR_DEFINITIONS.find((op) => op.key === '=')!,
    icon: '=',
    group: 'comparison',
    shortLabel: '=',
  },
  {
    ...OPERATOR_DEFINITIONS.find((op) => op.key === '!=')!,
    icon: '≠',
    group: 'comparison',
    shortLabel: '≠',
  },
  {
    ...OPERATOR_DEFINITIONS.find((op) => op.key === '>')!,
    icon: '>',
    group: 'comparison',
    shortLabel: '>',
  },
  {
    ...OPERATOR_DEFINITIONS.find((op) => op.key === '>=')!,
    icon: '≥',
    group: 'comparison',
    shortLabel: '≥',
  },
  {
    ...OPERATOR_DEFINITIONS.find((op) => op.key === '<')!,
    icon: '<',
    group: 'comparison',
    shortLabel: '<',
  },
  {
    ...OPERATOR_DEFINITIONS.find((op) => op.key === '<=')!,
    icon: '≤',
    group: 'comparison',
    shortLabel: '≤',
  },
  {
    ...OPERATOR_DEFINITIONS.find((op) => op.key === 'BETWEEN')!,
    icon: '⟷',
    group: 'comparison',
    shortLabel: '↔',
  },

  // Text operators
  {
    ...OPERATOR_DEFINITIONS.find((op) => op.key === 'CONTAINS')!,
    icon: '⊃',
    group: 'text',
    shortLabel: '⊃',
  },
  {
    ...OPERATOR_DEFINITIONS.find((op) => op.key === 'NOT_CONTAINS')!,
    icon: '⊅',
    group: 'text',
    shortLabel: '⊅',
  },
  {
    ...OPERATOR_DEFINITIONS.find((op) => op.key === 'STARTS_WITH')!,
    icon: '▶',
    group: 'text',
    shortLabel: '▶',
  },
  {
    ...OPERATOR_DEFINITIONS.find((op) => op.key === 'ENDS_WITH')!,
    icon: '◀',
    group: 'text',
    shortLabel: '◀',
  },
  {
    ...OPERATOR_DEFINITIONS.find((op) => op.key === 'EQUALS')!,
    icon: '=',
    group: 'text',
    shortLabel: '=',
  },
  {
    ...OPERATOR_DEFINITIONS.find((op) => op.key === 'NOT_EQUALS')!,
    icon: '≠',
    group: 'text',
    shortLabel: '≠',
  },
  {
    ...OPERATOR_DEFINITIONS.find((op) => op.key === 'REGEX')!,
    icon: '.*',
    group: 'text',
    shortLabel: '.*',
  },
  {
    ...OPERATOR_DEFINITIONS.find((op) => op.key === 'NOT_REGEX')!,
    icon: '!.*',
    group: 'text',
    shortLabel: '!.*',
  },

  // Array operators
  {
    ...OPERATOR_DEFINITIONS.find((op) => op.key === 'IN')!,
    icon: '∈',
    group: 'array',
    shortLabel: '∈',
  },
  {
    ...OPERATOR_DEFINITIONS.find((op) => op.key === 'NOT_IN')!,
    icon: '∉',
    group: 'array',
    shortLabel: '∉',
  },
  {
    ...OPERATOR_DEFINITIONS.find((op) => op.key === 'INCLUDES_ANY')!,
    icon: '∪',
    group: 'array',
    shortLabel: '∪',
  },
  {
    ...OPERATOR_DEFINITIONS.find((op) => op.key === 'INCLUDES_ALL')!,
    icon: '∩',
    group: 'array',
    shortLabel: '∩',
  },

  // Logic operators (boolean)
  {
    ...OPERATOR_DEFINITIONS.find((op) => op.key === 'IS_TRUE')!,
    icon: '✓',
    group: 'logic',
    shortLabel: '✓',
  },
  {
    ...OPERATOR_DEFINITIONS.find((op) => op.key === 'IS_FALSE')!,
    icon: '✗',
    group: 'logic',
    shortLabel: '✗',
  },

  // Date operators
  {
    ...OPERATOR_DEFINITIONS.find((op) => op.key === 'BEFORE')!,
    icon: '←',
    group: 'date',
    shortLabel: '←',
  },
  {
    ...OPERATOR_DEFINITIONS.find((op) => op.key === 'AFTER')!,
    icon: '→',
    group: 'date',
    shortLabel: '→',
  },
  {
    ...OPERATOR_DEFINITIONS.find((op) => op.key === 'OLDER_THAN')!,
    icon: '⟵',
    group: 'date',
    shortLabel: '⟵',
  },
  {
    ...OPERATOR_DEFINITIONS.find((op) => op.key === 'NEWER_THAN')!,
    icon: '⟶',
    group: 'date',
    shortLabel: '⟶',
  },
];

// Component props
interface RuleOperatorSelectorProps {
  field: FilterableField;
  value: FilterOperator;
  onChange: (operator: FilterOperator) => void;
  disabled?: boolean;
  className?: string;
  showIcons?: boolean;
  groupOperators?: boolean;
  compact?: boolean;
}

/**
 * RuleOperatorSelector component provides intelligent operator selection
 * based on the current field type with enhanced UX features
 */
export const RuleOperatorSelector: React.FC<RuleOperatorSelectorProps> = ({
  field,
  value,
  onChange,
  disabled = false,
  className = '',
  showIcons = true,
  groupOperators = true,
  compact = false,
}) => {
  // Get field definition to determine field type and available operators
  const fieldDefinition = useMemo(() => {
    return FIELD_DEFINITIONS.find((f) => f.key === field);
  }, [field]);

  // Get available operators for the current field type
  const availableOperators = useMemo(() => {
    if (!fieldDefinition) return [];

    // Filter enhanced operators based on field definition
    const operators = ENHANCED_OPERATORS.filter(
      (op) =>
        fieldDefinition.operators.includes(op.key) &&
        op.supportedFieldTypes.includes(fieldDefinition.type)
    );

    // Fallback: include any operators from the field definition that are not
    // present in ENHANCED_OPERATORS so they never silently disappear from the UI
    const enhancedKeys = new Set(operators.map((op) => op.key));
    fieldDefinition.operators.forEach((operatorKey) => {
      if (enhancedKeys.has(operatorKey)) return;

      const baseDef = OPERATOR_DEFINITIONS.find(
        (op) => op.key === operatorKey
      );
      if (
        baseDef &&
        baseDef.supportedFieldTypes.includes(fieldDefinition.type)
      ) {
        operators.push({
          ...baseDef,
          icon: '?',
          group: 'logic',
          shortLabel: baseDef.key,
        });
      }
    });

    // Group operators by type if requested
    if (groupOperators) {
      const grouped = operators.reduce(
        (acc, op) => {
          if (!acc[op.group]) acc[op.group] = [];
          acc[op.group].push(op);
          return acc;
        },
        {} as Record<string, EnhancedOperatorDefinition[]>
      );

      // Return flattened array with separators for visual grouping
      const result: (EnhancedOperatorDefinition | 'separator')[] = [];
      const groups = ['comparison', 'text', 'logic', 'array', 'date'] as const;

      groups.forEach((groupType, index) => {
        if (grouped[groupType]?.length > 0) {
          if (result.length > 0) result.push('separator');
          result.push(...grouped[groupType]);
        }
      });

      return result;
    }

    return operators;
  }, [fieldDefinition, groupOperators]);

  // Handle operator change
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const selectedOperator = e.target.value as FilterOperator;
      onChange(selectedOperator);
    },
    [onChange]
  );

  // Render option label with icon support
  const renderOptionLabel = useCallback(
    (operator: EnhancedOperatorDefinition) => {
      if (compact && operator.shortLabel) {
        return operator.shortLabel;
      }

      if (showIcons && operator.icon) {
        return `${operator.icon} ${operator.label}`;
      }

      return operator.label;
    },
    [compact, showIcons]
  );

  // Get placeholder text based on field type
  const getPlaceholder = useCallback(() => {
    if (!fieldDefinition) return 'Select operator...';

    const typeLabels = {
      string: 'Choose text operation...',
      number: 'Choose numeric operation...',
      date: 'Choose date operation...',
      boolean: 'Choose logic operation...',
      array: 'Choose list operation...',
    };

    return typeLabels[fieldDefinition.type] || 'Select operator...';
  }, [fieldDefinition]);

  // Get field type hint for better UX
  const getFieldTypeHint = useCallback(() => {
    if (!fieldDefinition) return null;

    const hints = {
      string: 'Text operations',
      number: 'Numeric comparisons',
      date: 'Date/time operations',
      boolean: 'True/false values',
      array: 'List operations',
    };

    return hints[fieldDefinition.type];
  }, [fieldDefinition]);

  // Render loading state if no field selected
  if (!field) {
    return (
      <Dropdown
        options={[]}
        value=""
        onChange={() => {}}
        placeholder="Select a field first..."
        disabled={true}
        className={`${styles.disabledState} ${className}`}
        aria-label="Select a field first"
      />
    );
  }

  // Render error state if field definition not found
  if (!fieldDefinition) {
    return (
      <Dropdown
        options={[]}
        value=""
        onChange={() => {}}
        placeholder="Invalid field selected"
        disabled={true}
        error={true}
        errorMessage="Invalid field selected"
        className={`${styles.errorState} ${className}`}
        aria-label="Invalid field selected"
      />
    );
  }

  // Convert operators to dropdown format
  const dropdownOptions: DropdownGroup[] = useMemo(() => {
    const groups: DropdownGroup[] = [];

    // If not grouping, just convert to flat options
    if (!groupOperators) {
      const flatOptions: DropdownOption[] = [];
      availableOperators.forEach((item) => {
        if (item !== 'separator') {
          const operator = item;
          flatOptions.push({
            value: operator.key,
            label: renderOptionLabel(operator),
            description: operator.description,
            icon: showIcons ? (
              <span style={{ fontSize: '14px', fontWeight: 'bold' }}>
                {operator.icon}
              </span>
            ) : undefined,
          });
        }
      });
      return [{ id: 'all', label: 'All Operators', options: flatOptions }];
    }

    // Group operators by type
    const operatorsByGroup: Record<string, DropdownOption[]> = {};

    availableOperators.forEach((item) => {
      if (item !== 'separator') {
        const operator = item;
        const option: DropdownOption = {
          value: operator.key,
          label: renderOptionLabel(operator),
          description: operator.description,
          icon: showIcons ? (
            <span style={{ fontSize: '14px', fontWeight: 'bold' }}>
              {operator.icon}
            </span>
          ) : undefined,
          group: operator.group,
        };

        if (!operatorsByGroup[operator.group]) {
          operatorsByGroup[operator.group] = [];
        }
        operatorsByGroup[operator.group].push(option);
      }
    });

    // Convert to groups
    Object.entries(operatorsByGroup).forEach(([groupId, options]) => {
      if (options.length > 0) {
        groups.push({
          id: groupId,
          label: groupId.charAt(0).toUpperCase() + groupId.slice(1),
          options,
        });
      }
    });

    return groups;
  }, [availableOperators, renderOptionLabel, showIcons, groupOperators]);

  const handleDropdownChange = useCallback(
    (selectedValue: string | string[]) => {
      onChange(selectedValue as FilterOperator);
    },
    [onChange]
  );

  return (
    <div className={styles.operatorSelectorContainer}>
      <Dropdown
        options={
          groupOperators
            ? dropdownOptions
            : dropdownOptions.flatMap((g) => g.options)
        }
        value={value || ''}
        onChange={handleDropdownChange}
        placeholder={getPlaceholder()}
        disabled={disabled}
        searchable={dropdownOptions.flatMap((g) => g.options).length > 8}
        searchPlaceholder="Search operators..."
        className={`
          ${styles.operatorSelect} 
          ${disabled ? styles.disabledState : ''}
          ${compact ? styles.compact : ''}
          ${className}
        `}
        aria-label={`Select operator for ${fieldDefinition.label}`}
        size={compact ? 'sm' : 'md'}
      />

      {/* Field type hint for better UX */}
      {!compact && getFieldTypeHint() && (
        <span className={styles.fieldTypeHint} aria-hidden="true">
          {getFieldTypeHint()}
        </span>
      )}

      {/* Operator description tooltip for selected operator */}
      {value && !compact && (
        <div className={styles.operatorDescription}>
          {ENHANCED_OPERATORS.find((op) => op.key === value)?.description ??
            OPERATOR_DEFINITIONS.find((op) => op.key === value)?.description}
        </div>
      )}
    </div>
  );
};

// Default export
export default RuleOperatorSelector;

// Helper function to get operator group color for styling
export const getOperatorGroupColor = (group: string): string => {
  const colors = {
    comparison: '#0F62FE',
    text: '#10B981',
    logic: '#8B5CF6',
    array: '#F59E0B',
    date: '#EF4444',
  };
  return colors[group as keyof typeof colors] || colors.comparison;
};

// Helper function to validate operator compatibility
export const isOperatorCompatible = (
  field: FilterableField,
  operator: FilterOperator
): boolean => {
  const fieldDef = FIELD_DEFINITIONS.find((f) => f.key === field);
  const operatorDef = OPERATOR_DEFINITIONS.find((op) => op.key === operator);

  if (!fieldDef || !operatorDef) return false;

  return (
    fieldDef.operators.includes(operator) &&
    operatorDef.supportedFieldTypes.includes(fieldDef.type)
  );
};
