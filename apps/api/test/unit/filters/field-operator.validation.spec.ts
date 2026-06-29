import { SiteSource } from '@dealscrapper/shared-types';
import { validateFilterRules } from '../../../src/filters/validation/validate-site-fields.decorator.js';
import {
  getFieldTypeCategory,
  isOperatorAllowedForCategory,
} from '../../../src/filters/validation/field-operator.constants.js';
import type { FilterRule } from '@dealscrapper/shared-types';

/**
 * Verifies that `FieldTypeMap` is load-bearing: the DTO boundary rejects
 * (field, operator) pairs the matching engine can never meaningfully evaluate,
 * while leaving valid pairs and unmapped site-specific fields untouched.
 */
describe('Field/operator validation', () => {
  /**
   * Pulls only the operator/type errors out of the combined validator output,
   * so site-fields errors don't mask (or fake) the assertion.
   */
  const operatorErrorsFor = (rules: FilterRule[]): string[] =>
    validateFilterRules(rules).filter((message) =>
      message.includes('does not support operator')
    );

  describe('rejects incompatible pairs', () => {
    it('rejects a string operator on a numeric field', () => {
      // Arrange: REGEX is a string operator; `price` is numeric.
      const rules: FilterRule[] = [
        { field: 'price', operator: 'REGEX', value: '.*' },
      ];

      // Act
      const errors = operatorErrorsFor(rules);

      // Assert
      expect(errors).toEqual([
        "Field 'price' (number) does not support operator 'REGEX'.",
      ]);
    });

    it('rejects a numeric comparison on a boolean field', () => {
      // Arrange: `>` is numeric-only; `isActive` is boolean.
      const rules: FilterRule[] = [
        { field: 'isActive', operator: '>', value: 1 },
      ];

      // Act
      const errors = operatorErrorsFor(rules);

      // Assert
      expect(errors).toEqual([
        "Field 'isActive' (boolean) does not support operator '>'.",
      ]);
    });

    it('rejects a boolean predicate on a string field', () => {
      // Arrange: IS_TRUE is boolean-only; `title` is a string.
      const rules: FilterRule[] = [
        { field: 'title', operator: 'IS_TRUE', value: true },
      ];

      // Act
      const errors = operatorErrorsFor(rules);

      // Assert
      expect(errors).toEqual([
        "Field 'title' (string) does not support operator 'IS_TRUE'.",
      ]);
    });
  });

  describe('accepts valid pairs', () => {
    it('accepts a numeric comparison on a numeric field (temperature >= 100)', () => {
      // Arrange: temperature is Dealabs-specific, so annotate siteSpecific to
      // keep the site-fields validator happy and isolate the operator check.
      const rules: FilterRule[] = [
        {
          field: 'temperature',
          operator: '>=',
          value: 100,
          siteSpecific: SiteSource.DEALABS,
        },
      ];

      // Act
      const errors = operatorErrorsFor(rules);

      // Assert
      expect(errors).toEqual([]);
    });

    it('accepts a string operator on a string field (title CONTAINS)', () => {
      // Arrange
      const rules: FilterRule[] = [
        { field: 'title', operator: 'CONTAINS', value: 'gaming' },
      ];

      // Act
      const errors = operatorErrorsFor(rules);

      // Assert
      expect(errors).toEqual([]);
    });

    it('accepts a substring-overlap operator on a string field (title INCLUDES_ANY [...])', () => {
      // Regression guard: the kernel evaluates this via String(title).includes(),
      // so the documented `title INCLUDES_ANY ['refurbished','used']` Swagger
      // example must validate (no 400) instead of being rejected.
      const rules: FilterRule[] = [
        {
          field: 'title',
          operator: 'INCLUDES_ANY',
          value: ['refurbished', 'used'],
        },
      ];

      // Act
      const errors = operatorErrorsFor(rules);

      // Assert
      expect(errors).toEqual([]);
    });

    it('accepts a boolean predicate on a boolean field (freeShipping IS_TRUE)', () => {
      // Arrange: freeShipping is Dealabs-specific; annotate to isolate.
      const rules: FilterRule[] = [
        {
          field: 'freeShipping',
          operator: 'IS_TRUE',
          value: true,
          siteSpecific: SiteSource.DEALABS,
        },
      ];

      // Act
      const errors = operatorErrorsFor(rules);

      // Assert
      expect(errors).toEqual([]);
    });
  });

  describe('fails open for unmapped fields', () => {
    it('does not reject an unmapped site-specific field (favoriteCount >=)', () => {
      // Arrange: favoriteCount is not in FieldTypeMap; the operator/type rule
      // must defer to the site-fields validator and add no error of its own.
      const rules: FilterRule[] = [
        {
          field: 'favoriteCount',
          operator: '>=',
          value: 10,
          siteSpecific: SiteSource.VINTED,
        },
      ];

      // Act
      const errors = operatorErrorsFor(rules);

      // Assert
      expect(errors).toEqual([]);
    });
  });

  describe('helpers', () => {
    it('maps known fields and returns undefined for unmapped fields', () => {
      expect(getFieldTypeCategory('temperature')).toBe('number');
      expect(getFieldTypeCategory('title')).toBe('string');
      expect(getFieldTypeCategory('favoriteCount')).toBeUndefined();
    });

    it('treats equality operators as type-agnostic', () => {
      // `=` / `!=` use strict comparison in the engine, valid for any category.
      expect(isOperatorAllowedForCategory('=', 'boolean')).toBe(true);
      expect(isOperatorAllowedForCategory('!=', 'date')).toBe(true);
      expect(isOperatorAllowedForCategory('=', 'string')).toBe(true);
    });

    it('allows substring-overlap operators on string and array fields', () => {
      // The engine does String(fieldValue).includes(...), so INCLUDES_ANY is
      // meaningful on strings (the documented `title INCLUDES_ANY [...]` usage)
      // and on arrays (which stringify to a comma-joined list).
      expect(isOperatorAllowedForCategory('INCLUDES_ANY', 'string')).toBe(true);
      expect(isOperatorAllowedForCategory('INCLUDES_ANY', 'array')).toBe(true);
    });

    it('still rejects substring-overlap operators on genuinely-incompatible fields', () => {
      // Numeric/boolean fields can only ever produce nonsense substring matches,
      // so the table keeps protecting against silent never-match.
      expect(isOperatorAllowedForCategory('INCLUDES_ANY', 'number')).toBe(false);
      expect(isOperatorAllowedForCategory('INCLUDES_ANY', 'boolean')).toBe(
        false
      );
    });
  });
});
