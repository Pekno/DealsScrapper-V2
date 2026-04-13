import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';
import { SiteSource } from '@dealscrapper/shared-types';
import {
  isUniversalField,
  getFieldSites,
  getSiteName,
} from './site-fields.constants.js';
import type {
  FilterRule,
  FilterRuleGroup,
} from '@dealscrapper/shared-types';

/**
 * Fields that represent prices and must have non-negative values
 */
const PRICE_FIELDS = [
  'currentPrice',
  'price',
  'originalPrice',
  'shippingCost',
  'buyerProtectionFee',
];

/**
 * Fields that represent percentages (0-100 or 0-1000 for temperature)
 */
const PERCENTAGE_FIELDS = ['discountPercentage'];

/**
 * Fields that represent counts and must be non-negative integers
 */
const COUNT_FIELDS = [
  'commentCount',
  'favoriteCount',
  'viewCount',
  'temperature',
];

/**
 * Validates that site-specific fields have proper `siteSpecific` annotations.
 *
 * **Architecture Note**:
 * Sites are now derived from filter categories (Filter -> FilterCategory -> Category -> Site),
 * NOT from an `enabledSites` field. This validator ensures site-specific fields are properly
 * annotated so the service layer can validate them against the filter's actual enabled sites.
 *
 * **Validation Logic**:
 * 1. Extracts `filterExpression.rules` from the DTO
 * 2. Recursively validates all rules (including nested groups)
 * 3. For each rule:
 *    - If field is universal -> always valid
 *    - If field is site-specific -> must have explicit `siteSpecific` property
 *    - If `siteSpecific` is set -> must be valid for that field
 *
 * **Examples**:
 * - Valid: `{ field: 'title', operator: 'INCLUDES', value: 'gaming' }` (universal field)
 * - Valid: `{ field: 'temperature', operator: '>=', value: 100, siteSpecific: 'dealabs' }`
 * - Invalid: `{ field: 'temperature', operator: '>=', value: 100 }` (missing siteSpecific)
 * - Invalid: `{ field: 'temperature', siteSpecific: 'vinted' }` (wrong site for field)
 */
@ValidatorConstraint({ name: 'ValidateSiteSpecificFields', async: false })
export class ValidateSiteSpecificFieldsConstraint
  implements ValidatorConstraintInterface
{
  private lastErrors: string[] = [];

  /**
   * Main validation method called by class-validator
   */
  validate(value: unknown, args: ValidationArguments): boolean {
    const object = args.object as Record<string, unknown>;

    const filterExpression = object.filterExpression as { rules?: (FilterRule | FilterRuleGroup)[] } | undefined;

    // If no filter expression, validation passes
    if (!filterExpression || !filterExpression.rules) {
      this.lastErrors = [];
      return true;
    }

    // Validate all rules recursively
    // Sites are now derived from filter categories, so we validate that
    // site-specific fields have explicit siteSpecific property set
    const errors = this.validateFilterRules(filterExpression.rules);

    // Store errors for defaultMessage to use
    this.lastErrors = errors;

    return errors.length === 0;
  }

  /**
   * Returns error message(s) when validation fails
   */
  defaultMessage(args: ValidationArguments): string {
    const errors = this.lastErrors;

    if (errors.length === 0) {
      return 'Invalid site-specific field usage';
    }

    // Return all error messages joined with newlines
    return errors.join('\n');
  }

  /**
   * Recursively validates filter rules and their nested groups
   *
   * @param rules - Array of filter rules or rule groups
   * @returns Array of validation error messages (empty if valid)
   */
  private validateFilterRules(
    rules: (FilterRule | FilterRuleGroup)[]
  ): string[] {
    const errors: string[] = [];

    for (const rule of rules) {
      // Check if this is a rule group (has 'logic' and nested 'rules')
      if ('logic' in rule && 'rules' in rule) {
        // Recursively validate nested rules
        const nestedErrors = this.validateFilterRules(rule.rules);
        errors.push(...nestedErrors);
      } else if ('field' in rule) {
        // This is a FilterRule with a field
        const fieldRule = rule as FilterRule;
        const field = fieldRule.field;

        // Business rule validation: Check for invalid values
        const businessErrors = this.validateBusinessRules(fieldRule);
        errors.push(...businessErrors);

        // Case 1: Field is universal - skip site-specific validation
        if (isUniversalField(field)) {
          continue;
        }

        // Case 2: Field is site-specific
        const fieldSites = getFieldSites(field);

        if (fieldSites.length === 0) {
          // Field is not recognized as universal or site-specific
          // This might be a typo or unsupported field
          errors.push(
            `Unknown field '${field}'. Please check the field name.`
          );
          continue;
        }

        // Case 3: Site-specific field must have explicit siteSpecific property
        // Sites are now derived from filter categories, so we require explicit
        // siteSpecific annotation for site-specific fields to be validated
        // against enabled sites in the service layer
        if (!fieldRule.siteSpecific) {
          const siteNames = fieldSites.map((s) => getSiteName(s)).join(', ');
          errors.push(
            `Field '${field}' is ${siteNames}-specific. Please add 'siteSpecific' property to explicitly indicate which site this rule applies to.`
          );
          continue;
        }

        // Validate that siteSpecific value is valid for this field
        const site = fieldRule.siteSpecific as SiteSource;
        if (!fieldSites.includes(site)) {
          const siteNames = fieldSites.map((s) => getSiteName(s)).join(', ');
          errors.push(
            `Field '${field}' is ${siteNames}-specific but siteSpecific is set to '${site}'.`
          );
        }
      }
    }

    return errors;
  }

  /**
   * Validates business rules for a filter rule
   * Ensures values make sense for the field type (e.g., no negative prices)
   *
   * @param rule - Filter rule to validate
   * @returns Array of validation error messages (empty if valid)
   */
  private validateBusinessRules(rule: FilterRule): string[] {
    const errors: string[] = [];
    const field = rule.field;
    const value = rule.value;

    // Skip validation for operators that don't use numeric values
    const nonNumericOperators = [
      'IS_TRUE',
      'IS_FALSE',
      'IS_NULL',
      'IS_NOT_NULL',
      'EXISTS',
      'NOT_EXISTS',
    ];
    if (nonNumericOperators.includes(rule.operator)) {
      return errors;
    }

    // Validate price fields: must be non-negative
    if (PRICE_FIELDS.includes(field)) {
      if (typeof value === 'number' && value < 0) {
        errors.push(
          `Field '${field}' cannot have a negative value. Price must be 0 or greater.`
        );
      }
      // Handle array values (e.g., BETWEEN operator)
      if (Array.isArray(value)) {
        for (const v of value) {
          if (typeof v === 'number' && v < 0) {
            errors.push(
              `Field '${field}' cannot have negative values in range. All prices must be 0 or greater.`
            );
            break;
          }
        }
      }
    }

    // Validate percentage fields: must be 0-100
    if (PERCENTAGE_FIELDS.includes(field)) {
      if (typeof value === 'number' && (value < 0 || value > 100)) {
        errors.push(
          `Field '${field}' must be between 0 and 100 (percentage).`
        );
      }
    }

    // Validate count fields: must be non-negative
    if (COUNT_FIELDS.includes(field)) {
      if (typeof value === 'number' && value < 0) {
        errors.push(
          `Field '${field}' cannot have a negative value. Count must be 0 or greater.`
        );
      }
    }

    return errors;
  }
}

/**
 * Decorator factory: Validates site-specific field usage in filter expressions
 *
 * **Usage**:
 * ```typescript
 * export class CreateFilterDto {
 *   categoryIds: string[];
 *
 *   @ValidateSiteSpecificFields()
 *   filterExpression: FilterExpressionInput;
 * }
 * ```
 *
 * This decorator should be applied to the `filterExpression` property.
 * It validates that site-specific fields have explicit `siteSpecific` annotations.
 *
 * @param validationOptions - Optional validation options from class-validator
 * @returns PropertyDecorator
 */
export function ValidateSiteSpecificFields(
  validationOptions?: ValidationOptions
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: ValidateSiteSpecificFieldsConstraint,
    });
  };
}

/**
 * Standalone helper function to validate filter rules
 *
 * This function can be used outside of class-validator contexts (e.g., in services or tests).
 * It validates that site-specific fields have explicit `siteSpecific` annotations.
 *
 * @param rules - Array of filter rules to validate
 * @returns Array of validation error messages (empty if valid)
 *
 * @example
 * ```typescript
 * const errors = validateFilterRules([
 *   { field: 'temperature', operator: '>=', value: 100, siteSpecific: 'dealabs' }
 * ]);
 * if (errors.length > 0) {
 *   console.error('Validation errors:', errors);
 * }
 * ```
 */
export function validateFilterRules(
  rules: (FilterRule | FilterRuleGroup)[]
): string[] {
  const validator = new ValidateSiteSpecificFieldsConstraint();
  return validator['validateFilterRules'](rules);
}
