/**
 * Filter Expression Validation
 * Validates filter expressions against field definitions and site constraints
 */
import type { SiteFieldDefinition } from '../field-definitions/index.js';
import { getFieldsForSites, getFieldDefinition } from '../field-definitions/index.js';
import type { SiteFilterExpression, SiteRuleGroup, ValidationResult, ValidationError } from './groups.js';
import type { SiteFilterRule, StringRule, NumberRule, DateRule, ArrayRule } from './rules.js';

/**
 * Type guard: checks if a node is a SiteRuleGroup
 */
export function isSiteRuleGroup(node: SiteFilterExpression): node is SiteRuleGroup {
  return 'type' in node && node.type === 'group';
}

/**
 * Validates a complete filter expression
 * @param expression The filter expression to validate
 * @param enabledSiteIds Array of enabled site IDs (used to check field availability)
 * @returns Validation result with any errors
 */
export function validateSiteFilterExpression(
  expression: SiteFilterExpression,
  enabledSiteIds: string[]
): ValidationResult {
  const errors: ValidationError[] = [];
  const availableFields = getFieldsForSites(enabledSiteIds);

  validateNode(expression, '', availableFields, errors);

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validates a single node (rule or group) recursively
 */
function validateNode(
  node: SiteFilterExpression,
  path: string,
  availableFields: SiteFieldDefinition[],
  errors: ValidationError[]
): void {
  if (isSiteRuleGroup(node)) {
    validateGroup(node, path, availableFields, errors);
  } else {
    validateRule(node, path, availableFields, errors);
  }
}

/**
 * Validates a rule group
 */
function validateGroup(
  group: SiteRuleGroup,
  path: string,
  availableFields: SiteFieldDefinition[],
  errors: ValidationError[]
): void {
  if (group.rules.length === 0) {
    errors.push({
      path: path || 'root',
      message: 'Rule group cannot be empty',
      code: 'EMPTY_GROUP',
    });
    return;
  }

  group.rules.forEach((rule, index) => {
    validateNode(rule, `${path}rules[${index}].`, availableFields, errors);
  });
}

/**
 * Validates a single filter rule
 */
function validateRule(
  rule: SiteFilterRule,
  path: string,
  availableFields: SiteFieldDefinition[],
  errors: ValidationError[]
): void {
  // Find field definition (also check aliases)
  const fieldDef = availableFields.find(
    (f) => f.key === rule.field || f.aliases?.includes(rule.field)
  );

  if (!fieldDef) {
    // Check if field exists but is not available for selected sites
    const globalField = getFieldDefinition(rule.field);
    if (globalField) {
      errors.push({
        path: `${path}field`,
        message: `Field '${rule.field}' is not available for the selected sites`,
        code: 'FIELD_NOT_AVAILABLE_FOR_SITES',
      });
    } else {
      errors.push({
        path: `${path}field`,
        message: `Unknown field: ${rule.field}`,
        code: 'INVALID_FIELD',
      });
    }
    return;
  }

  // Validate operator matches field type
  if (!fieldDef.operators.includes(rule.operator)) {
    errors.push({
      path: `${path}operator`,
      message: `Operator '${rule.operator}' is not valid for field '${rule.field}' (${fieldDef.type})`,
      code: 'INVALID_OPERATOR_FOR_TYPE',
    });
  }

  // Validate value based on rule type
  validateRuleValue(rule, path, errors);
}

/**
 * Validates the value of a filter rule based on its type
 */
function validateRuleValue(
  rule: SiteFilterRule,
  path: string,
  errors: ValidationError[]
): void {
  switch (rule.fieldType) {
    case 'string':
      validateStringRuleValue(rule as StringRule, path, errors);
      break;
    case 'number':
      validateNumberRuleValue(rule as NumberRule, path, errors);
      break;
    case 'boolean':
      // Boolean rules don't have a value field - operator is the value
      break;
    case 'date':
      validateDateRuleValue(rule as DateRule, path, errors);
      break;
    case 'array':
      validateArrayRuleValue(rule as ArrayRule, path, errors);
      break;
  }
}

/**
 * Validates a string rule value
 */
function validateStringRuleValue(
  rule: StringRule,
  path: string,
  errors: ValidationError[]
): void {
  if (rule.operator === 'IN') {
    if (!Array.isArray(rule.value)) {
      errors.push({
        path: `${path}value`,
        message: 'IN operator requires an array of values',
        code: 'INVALID_VALUE_TYPE',
      });
    }
  } else if (rule.operator === 'REGEX') {
    try {
      new RegExp(rule.value as string);
    } catch {
      errors.push({
        path: `${path}value`,
        message: 'Invalid regular expression',
        code: 'INVALID_REGEX',
      });
    }
  } else if (typeof rule.value !== 'string') {
    errors.push({
      path: `${path}value`,
      message: 'String value required',
      code: 'INVALID_VALUE_TYPE',
    });
  }
}

/**
 * Validates a number rule value
 */
function validateNumberRuleValue(
  rule: NumberRule,
  path: string,
  errors: ValidationError[]
): void {
  if (rule.operator === 'BETWEEN') {
    if (!Array.isArray(rule.value) || rule.value.length !== 2) {
      errors.push({
        path: `${path}value`,
        message: 'BETWEEN operator requires [min, max] tuple',
        code: 'INVALID_BETWEEN_VALUES',
      });
    } else if (rule.value[0] > rule.value[1]) {
      errors.push({
        path: `${path}value`,
        message: 'BETWEEN min must be less than or equal to max',
        code: 'INVALID_BETWEEN_VALUES',
      });
    }
  } else if (typeof rule.value !== 'number') {
    errors.push({
      path: `${path}value`,
      message: 'Numeric value required',
      code: 'INVALID_VALUE_TYPE',
    });
  }
}

/**
 * Validates a date rule value
 */
function validateDateRuleValue(
  rule: DateRule,
  path: string,
  errors: ValidationError[]
): void {
  if (rule.operator === 'BETWEEN') {
    if (!Array.isArray(rule.value) || rule.value.length !== 2) {
      errors.push({
        path: `${path}value`,
        message: 'BETWEEN operator requires [startDate, endDate] tuple',
        code: 'INVALID_BETWEEN_VALUES',
      });
    }
  } else if (rule.operator === 'OLDER_THAN' || rule.operator === 'NEWER_THAN') {
    if (typeof rule.value !== 'string' || !rule.unit) {
      errors.push({
        path: `${path}value`,
        message: 'OLDER_THAN/NEWER_THAN requires a duration value and unit',
        code: 'INVALID_VALUE_TYPE',
      });
    }
  } else if (typeof rule.value !== 'string') {
    errors.push({
      path: `${path}value`,
      message: 'ISO date string required',
      code: 'INVALID_VALUE_TYPE',
    });
  }
}

/**
 * Validates an array rule value
 */
function validateArrayRuleValue(
  rule: ArrayRule,
  path: string,
  errors: ValidationError[]
): void {
  if (rule.operator === 'IS_EMPTY' || rule.operator === 'IS_NOT_EMPTY') {
    // No value required
    return;
  }

  if (rule.operator === 'CONTAINS_ANY' || rule.operator === 'CONTAINS_ALL') {
    if (!Array.isArray(rule.value)) {
      errors.push({
        path: `${path}value`,
        message: `${rule.operator} requires an array of values`,
        code: 'INVALID_VALUE_TYPE',
      });
    }
  } else if (rule.value === undefined) {
    errors.push({
      path: `${path}value`,
      message: 'Value required for this operator',
      code: 'MISSING_VALUE',
    });
  }
}
