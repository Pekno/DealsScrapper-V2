/**
 * Shared utilities for value input components
 */
import {
  FilterableField,
  FilterOperator,
  FIELD_DEFINITIONS,
  OPERATOR_DEFINITIONS,
} from '@/features/filters/types/filter.types';

/**
 * Helper function to validate value compatibility with field type
 */
export const isValueCompatible = (
  field: FilterableField,
  operator: FilterOperator,
  value: string | string[]
): boolean => {
  const fieldDef = FIELD_DEFINITIONS.find((f) => f.key === field);
  const operatorDef = OPERATOR_DEFINITIONS.find((op) => op.key === operator);

  if (!fieldDef || !operatorDef) return false;

  // No value needed for boolean operators
  if (operatorDef.valueType === 'none') return true;

  // Array operators need array values
  if (operatorDef.valueType === 'array') {
    return Array.isArray(value) && value.length > 0;
  }

  // Range operators need array with 2 values
  if (operatorDef.valueType === 'double') {
    return Array.isArray(value) && value.length === 2;
  }

  // Single value operators need single value
  if (operatorDef.valueType === 'single') {
    const singleValue = Array.isArray(value) ? value[0] : value;
    if (!singleValue) return false;

    // Validate based on field type
    if (fieldDef.type === 'number') {
      const num = parseFloat(singleValue);
      return !isNaN(num) && isFinite(num);
    }

    if (fieldDef.type === 'date') {
      return !isNaN(Date.parse(singleValue));
    }

    return true; // String values are generally valid
  }

  return false;
};

/**
 * Helper function to get suggested values for common fields
 */
export const getSuggestedValues = (field: FilterableField): string[] => {
  const suggestions: Record<string, string[]> = {
    merchant: ['Amazon', 'Cdiscount', 'Fnac', 'Darty', 'Boulanger', 'LDLC'],
    category: [
      'Electronics',
      'Fashion',
      'Home & Garden',
      'Sports',
      'Books',
      'Beauty',
    ],
    freeShipping: ['true', 'false'],
  };

  return suggestions[field] || [];
};

/**
 * Get validation function for field type
 */
export const getValidationForField = (
  field: FilterableField
): ((value: string) => boolean) | undefined => {
  const fieldDefinition = FIELD_DEFINITIONS.find((f) => f.key === field);
  if (!fieldDefinition) return undefined;

  if (fieldDefinition.type === 'number') {
    return (val: string) => {
      const num = parseFloat(val);
      return !isNaN(num) && isFinite(num);
    };
  }

  if (fieldDefinition.type === 'date') {
    return (val: string) => {
      return !isNaN(Date.parse(val));
    };
  }

  return undefined;
};

/**
 * Get validation error message for field type
 */
export const getValidationMessageForField = (
  field: FilterableField
): string | undefined => {
  const fieldDefinition = FIELD_DEFINITIONS.find((f) => f.key === field);
  if (!fieldDefinition) return undefined;

  if (fieldDefinition.type === 'number') {
    if (fieldDefinition.key === 'price') return 'Please enter a valid price (e.g. 29.99)';
    if (fieldDefinition.key === 'discountPercentage') return 'Please enter a valid percentage (0-100)';
    return 'Please enter a valid number';
  }

  if (fieldDefinition.type === 'date') {
    return 'Please enter a valid date';
  }

  return undefined;
};

/**
 * Get value formatter for field type
 */
export const getFormatterForField = (
  field: FilterableField
): ((value: string) => string) | undefined => {
  const fieldDefinition = FIELD_DEFINITIONS.find((f) => f.key === field);
  if (!fieldDefinition) return undefined;

  if (fieldDefinition.key === 'price') {
    return (val: string) => {
      const num = parseFloat(val);
      return isNaN(num) ? val : num.toFixed(2);
    };
  }

  if (fieldDefinition.key === 'discountPercentage') {
    return (val: string) => {
      const num = parseFloat(val);
      return isNaN(num) ? val : Math.min(100, Math.max(0, num)).toFixed(1);
    };
  }

  return undefined;
};

/**
 * Get context-aware placeholder text
 */
export const getPlaceholderText = (
  field: FilterableField,
  operator: FilterOperator,
  customPlaceholder?: string
): string => {
  if (customPlaceholder) return customPlaceholder;

  const fieldDefinition = FIELD_DEFINITIONS.find((f) => f.key === field);
  const operatorDefinition = OPERATOR_DEFINITIONS.find(
    (op) => op.key === operator
  );

  if (!fieldDefinition || !operatorDefinition) return 'Enter value...';

  // Context-aware placeholders
  const fieldType = fieldDefinition.type;
  const operatorKey = operatorDefinition.key;

  if (fieldType === 'string') {
    if (operatorKey === 'CONTAINS')
      return `Text that ${fieldDefinition.label.toLowerCase()} should contain...`;
    if (operatorKey === 'STARTS_WITH')
      return `Text that ${fieldDefinition.label.toLowerCase()} starts with...`;
    if (operatorKey === 'ENDS_WITH')
      return `Text that ${fieldDefinition.label.toLowerCase()} ends with...`;
    if (operatorKey === 'REGEX') return 'Regular expression pattern...';
    return `Enter ${fieldDefinition.label.toLowerCase()}...`;
  }

  if (fieldType === 'number') {
    if (fieldDefinition.key === 'price') return 'Price in euros...';
    if (fieldDefinition.key === 'discountPercentage') return 'Percentage...';
    if (fieldDefinition.key === 'temperature') return 'Temperature score...';
    return `Enter ${fieldDefinition.label.toLowerCase()}...`;
  }

  if (fieldType === 'date') {
    return 'Select date and time...';
  }

  return 'Enter value...';
};

/**
 * Get right icon for field type
 */
export const getRightIconForField = (
  field: FilterableField
): string | undefined => {
  const fieldDefinition = FIELD_DEFINITIONS.find((f) => f.key === field);
  if (!fieldDefinition) return undefined;

  if (fieldDefinition.key === 'price') return '€';
  if (fieldDefinition.key === 'discountPercentage') return '%';
  return undefined;
};

/**
 * Normalize value to appropriate format based on operator
 */
export const normalizeValue = (
  value: string | string[],
  needsArrayInput: boolean,
  needsRangeInput: boolean
): string | string[] | [string, string] => {
  if (needsArrayInput) {
    return Array.isArray(value) ? value : value ? [String(value)] : [];
  }

  if (needsRangeInput) {
    const arrayValue = Array.isArray(value)
      ? value
      : value
        ? [String(value)]
        : ['', ''];
    return [arrayValue[0] || '', arrayValue[1] || ''] as [string, string];
  }

  return Array.isArray(value) ? value[0] || '' : String(value || '');
};
