import { evaluateFilterOperator } from '../filter-evaluator.js';

/**
 * Canonical operator test-vector suite for the shared filter-evaluation kernel.
 *
 * These vectors are the single canonical operator contract shared by BOTH engines
 * (scraper RuleEngineService + API FilterMatcherService) after the Phase 7
 * reconciliation: `=`/`!=` are strict ===/!==, while EQUALS/NOT_EQUALS/IN/NOT_IN are
 * case-insensitive String()-coercion comparisons honoring caseSensitive. Treat any
 * change here as a behavioral change that both services must re-verify.
 */
describe('evaluateFilterOperator', () => {
  describe('null / undefined field short-circuit', () => {
    const nullishOperatorsThatPass = ['!=', 'NOT_EQUALS', 'IS_FALSE'] as const;
    const someOperatorsThatFail = [
      '=',
      'EQUALS',
      '>',
      '>=',
      '<',
      '<=',
      'CONTAINS',
      'STARTS_WITH',
      'REGEX',
      'IN',
      'INCLUDES_ANY',
      'IS_TRUE',
      'BETWEEN',
      'BEFORE',
      'OLDER_THAN',
    ] as const;

    it.each(nullishOperatorsThatPass)(
      'returns true for %s when field is null',
      (operator) => {
        expect(evaluateFilterOperator(operator, null, 'whatever')).toBe(true);
      }
    );

    it.each(nullishOperatorsThatPass)(
      'returns true for %s when field is undefined',
      (operator) => {
        expect(evaluateFilterOperator(operator, undefined, 'whatever')).toBe(
          true
        );
      }
    );

    it.each(someOperatorsThatFail)(
      'returns false for %s when field is null',
      (operator) => {
        expect(evaluateFilterOperator(operator, null, 'whatever')).toBe(false);
      }
    );

    it('returns false for %s-style operators when field is undefined', () => {
      expect(evaluateFilterOperator('=', undefined, undefined)).toBe(false);
    });
  });

  describe('identity operators = / != (strict ===)', () => {
    it('= matches identical numbers strictly', () => {
      expect(evaluateFilterOperator('=', 5, 5)).toBe(true);
    });

    it('= does NOT coerce string vs number (strict ===)', () => {
      expect(evaluateFilterOperator('=', 5, '5')).toBe(false);
    });

    it('= matches identical strings', () => {
      expect(evaluateFilterOperator('=', 'abc', 'abc')).toBe(true);
    });

    it('= is case-sensitive (strict, no coercion)', () => {
      expect(evaluateFilterOperator('=', 'Amazon', 'amazon')).toBe(false);
    });

    it('!= returns true for differing values', () => {
      expect(evaluateFilterOperator('!=', 5, 6)).toBe(true);
    });

    it('!= returns true for string-vs-number (strict !==)', () => {
      expect(evaluateFilterOperator('!=', 5, '5')).toBe(true);
    });
  });

  describe('string-equality operators EQUALS / NOT_EQUALS (case-insensitive String())', () => {
    it('EQUALS matches identical values', () => {
      expect(evaluateFilterOperator('EQUALS', 5, 5)).toBe(true);
      expect(evaluateFilterOperator('EQUALS', 'abc', 'abc')).toBe(true);
    });

    it('EQUALS is case-insensitive by default', () => {
      expect(evaluateFilterOperator('EQUALS', 'Amazon', 'amazon')).toBe(true);
    });

    it('EQUALS respects caseSensitive=true', () => {
      expect(evaluateFilterOperator('EQUALS', 'Amazon', 'amazon', true)).toBe(
        false
      );
    });

    it('EQUALS coerces string vs number (String())', () => {
      expect(evaluateFilterOperator('EQUALS', 5, '5')).toBe(true);
    });

    it('NOT_EQUALS returns false for identical values', () => {
      expect(evaluateFilterOperator('NOT_EQUALS', 'x', 'x')).toBe(false);
    });

    it('NOT_EQUALS is case-insensitive by default (Amazon vs amazon -> false)', () => {
      expect(evaluateFilterOperator('NOT_EQUALS', 'Amazon', 'amazon')).toBe(
        false
      );
    });
  });

  describe('numeric comparison operators (Number coercion)', () => {
    it('> compares numerically', () => {
      expect(evaluateFilterOperator('>', 10, 5)).toBe(true);
      expect(evaluateFilterOperator('>', 5, 10)).toBe(false);
    });

    it('> coerces string operands via Number()', () => {
      expect(evaluateFilterOperator('>', '10', '5')).toBe(true);
    });

    it('>= is inclusive', () => {
      expect(evaluateFilterOperator('>=', 5, 5)).toBe(true);
    });

    it('< compares numerically', () => {
      expect(evaluateFilterOperator('<', 3, 5)).toBe(true);
      expect(evaluateFilterOperator('<', 5, 3)).toBe(false);
    });

    it('<= is inclusive', () => {
      expect(evaluateFilterOperator('<=', 5, 5)).toBe(true);
    });

    it('numeric comparison with non-numeric coerces to NaN and is false', () => {
      // Number('abc') === NaN -> all comparisons false
      expect(evaluateFilterOperator('>', 'abc', 5)).toBe(false);
      expect(evaluateFilterOperator('<', 'abc', 5)).toBe(false);
    });
  });

  describe('string operators (case-insensitive by default)', () => {
    it('CONTAINS matches substring case-insensitively by default', () => {
      expect(evaluateFilterOperator('CONTAINS', 'Hello World', 'WORLD')).toBe(
        true
      );
    });

    it('CONTAINS respects caseSensitive=true', () => {
      expect(
        evaluateFilterOperator('CONTAINS', 'Hello World', 'WORLD', true)
      ).toBe(false);
      expect(
        evaluateFilterOperator('CONTAINS', 'Hello World', 'World', true)
      ).toBe(true);
    });

    it('NOT_CONTAINS returns true when substring is absent', () => {
      expect(evaluateFilterOperator('NOT_CONTAINS', 'Hello', 'xyz')).toBe(true);
      expect(evaluateFilterOperator('NOT_CONTAINS', 'Hello', 'ell')).toBe(false);
    });

    it('STARTS_WITH matches prefix case-insensitively', () => {
      expect(evaluateFilterOperator('STARTS_WITH', 'Hello', 'HE')).toBe(true);
      expect(evaluateFilterOperator('STARTS_WITH', 'Hello', 'lo')).toBe(false);
    });

    it('ENDS_WITH matches suffix case-insensitively', () => {
      expect(evaluateFilterOperator('ENDS_WITH', 'Hello', 'LO')).toBe(true);
      expect(evaluateFilterOperator('ENDS_WITH', 'Hello', 'He')).toBe(false);
    });
  });

  describe('regex operators', () => {
    it('REGEX matches a valid pattern case-insensitively', () => {
      expect(evaluateFilterOperator('REGEX', 'Hello123', '^hello\\d+$')).toBe(
        true
      );
    });

    it('REGEX respects caseSensitive=true (no i flag)', () => {
      expect(
        evaluateFilterOperator('REGEX', 'Hello', '^hello$', true)
      ).toBe(false);
    });

    it('REGEX returns false on invalid pattern (negate=false)', () => {
      expect(evaluateFilterOperator('REGEX', 'anything', '([')).toBe(false);
    });

    it('NOT_REGEX returns true when pattern does not match', () => {
      expect(evaluateFilterOperator('NOT_REGEX', 'Hello', '^\\d+$')).toBe(true);
    });

    it('NOT_REGEX returns false when pattern matches', () => {
      expect(evaluateFilterOperator('NOT_REGEX', '12345', '^\\d+$')).toBe(false);
    });

    it('NOT_REGEX returns true (negate) on invalid pattern', () => {
      expect(evaluateFilterOperator('NOT_REGEX', 'anything', '([')).toBe(true);
    });
  });

  describe('IN / NOT_IN array operators', () => {
    it('IN returns true when value is present', () => {
      expect(evaluateFilterOperator('IN', 'b', ['a', 'b', 'c'])).toBe(true);
    });

    it('IN returns false when value absent', () => {
      expect(evaluateFilterOperator('IN', 'z', ['a', 'b'])).toBe(false);
    });

    it('IN returns false when ruleValue is not an array', () => {
      expect(evaluateFilterOperator('IN', 'b', 'b')).toBe(false);
    });

    it('IN is case-insensitive String()-coercion by default', () => {
      expect(evaluateFilterOperator('IN', 'B', ['a', 'b', 'c'])).toBe(true);
      expect(evaluateFilterOperator('IN', 5, ['5'])).toBe(true);
      expect(evaluateFilterOperator('IN', 5, [5])).toBe(true);
    });

    it('IN respects caseSensitive=true (strict includes)', () => {
      expect(evaluateFilterOperator('IN', 'B', ['a', 'b'], true)).toBe(false);
      expect(evaluateFilterOperator('IN', 5, ['5'], true)).toBe(false);
    });

    it('NOT_IN returns true when value absent', () => {
      expect(evaluateFilterOperator('NOT_IN', 'z', ['a', 'b'])).toBe(true);
    });

    it('NOT_IN returns false when ruleValue is not an array', () => {
      // Array.isArray(ruleValue) && !includes -> false when not array
      expect(evaluateFilterOperator('NOT_IN', 'z', 'z')).toBe(false);
    });
  });

  describe('INCLUDES_ANY / INCLUDES_ALL / NOT_INCLUDES_ANY', () => {
    it('INCLUDES_ANY matches when any search term is a substring (case-insensitive)', () => {
      expect(
        evaluateFilterOperator('INCLUDES_ANY', 'Apple iPhone', ['SAMSUNG', 'iphone'])
      ).toBe(true);
    });

    it('INCLUDES_ANY returns false when no term matches', () => {
      expect(
        evaluateFilterOperator('INCLUDES_ANY', 'Apple', ['samsung', 'sony'])
      ).toBe(false);
    });

    it('INCLUDES_ANY returns false when ruleValue is not an array', () => {
      expect(evaluateFilterOperator('INCLUDES_ANY', 'Apple', 'apple')).toBe(
        false
      );
    });

    it('INCLUDES_ANY respects caseSensitive=true', () => {
      expect(
        evaluateFilterOperator('INCLUDES_ANY', 'Apple', ['APPLE'], true)
      ).toBe(false);
      expect(
        evaluateFilterOperator('INCLUDES_ANY', 'Apple', ['Apple'], true)
      ).toBe(true);
    });

    it('INCLUDES_ALL matches only when all terms are substrings', () => {
      expect(
        evaluateFilterOperator('INCLUDES_ALL', 'red fast car', ['red', 'car'])
      ).toBe(true);
      expect(
        evaluateFilterOperator('INCLUDES_ALL', 'red car', ['red', 'plane'])
      ).toBe(false);
    });

    it('INCLUDES_ALL is case-insensitive by default', () => {
      expect(
        evaluateFilterOperator('INCLUDES_ALL', 'Red Car', ['RED', 'CAR'])
      ).toBe(true);
    });

    it('INCLUDES_ALL returns false when ruleValue is not an array', () => {
      expect(evaluateFilterOperator('INCLUDES_ALL', 'red', 'red')).toBe(false);
    });

    it('NOT_INCLUDES_ANY returns true when none of the terms match', () => {
      expect(
        evaluateFilterOperator('NOT_INCLUDES_ANY', 'Apple', ['samsung', 'sony'])
      ).toBe(true);
    });

    it('NOT_INCLUDES_ANY returns false when a term matches', () => {
      expect(
        evaluateFilterOperator('NOT_INCLUDES_ANY', 'Apple iPhone', ['iphone'])
      ).toBe(false);
    });

    it('NOT_INCLUDES_ANY returns true when ruleValue is not an array', () => {
      expect(evaluateFilterOperator('NOT_INCLUDES_ANY', 'Apple', 'apple')).toBe(
        true
      );
    });
  });

  describe('boolean operators (Boolean() coercion)', () => {
    it('IS_TRUE returns true for truthy values', () => {
      expect(evaluateFilterOperator('IS_TRUE', true, null)).toBe(true);
      expect(evaluateFilterOperator('IS_TRUE', 1, null)).toBe(true);
      expect(evaluateFilterOperator('IS_TRUE', 'non-empty', null)).toBe(true);
    });

    it('IS_TRUE returns false for falsy values (that are not null/undefined)', () => {
      expect(evaluateFilterOperator('IS_TRUE', 0, null)).toBe(false);
      expect(evaluateFilterOperator('IS_TRUE', '', null)).toBe(false);
    });

    it('IS_FALSE on 0 returns true (scraper semantics: Boolean(0) === false)', () => {
      expect(evaluateFilterOperator('IS_FALSE', 0, null)).toBe(true);
    });

    it('IS_FALSE on empty string returns true', () => {
      expect(evaluateFilterOperator('IS_FALSE', '', null)).toBe(true);
    });

    it('IS_FALSE on truthy value returns false', () => {
      expect(evaluateFilterOperator('IS_FALSE', true, null)).toBe(false);
      expect(evaluateFilterOperator('IS_FALSE', 'x', null)).toBe(false);
    });
  });

  describe('BETWEEN range operator', () => {
    it('returns true when value is within inclusive bounds', () => {
      expect(evaluateFilterOperator('BETWEEN', 5, [1, 10])).toBe(true);
      expect(evaluateFilterOperator('BETWEEN', 1, [1, 10])).toBe(true);
      expect(evaluateFilterOperator('BETWEEN', 10, [1, 10])).toBe(true);
    });

    it('returns false when value is outside bounds', () => {
      expect(evaluateFilterOperator('BETWEEN', 11, [1, 10])).toBe(false);
      expect(evaluateFilterOperator('BETWEEN', 0, [1, 10])).toBe(false);
    });

    it('coerces string operands via Number()', () => {
      expect(evaluateFilterOperator('BETWEEN', '5', ['1', '10'])).toBe(true);
    });

    it('returns false when ruleValue is not an array', () => {
      expect(evaluateFilterOperator('BETWEEN', 5, 10)).toBe(false);
    });

    it('returns false when ruleValue array has wrong length', () => {
      expect(evaluateFilterOperator('BETWEEN', 5, [1])).toBe(false);
      expect(evaluateFilterOperator('BETWEEN', 5, [1, 2, 3])).toBe(false);
    });
  });

  describe('BEFORE / AFTER date operators', () => {
    it('BEFORE returns true when field date precedes rule date', () => {
      expect(
        evaluateFilterOperator(
          'BEFORE',
          '2020-01-01T00:00:00Z',
          '2021-01-01T00:00:00Z'
        )
      ).toBe(true);
    });

    it('BEFORE returns false when field date is later', () => {
      expect(
        evaluateFilterOperator(
          'BEFORE',
          '2022-01-01T00:00:00Z',
          '2021-01-01T00:00:00Z'
        )
      ).toBe(false);
    });

    it('AFTER returns true when field date follows rule date', () => {
      expect(
        evaluateFilterOperator(
          'AFTER',
          '2022-01-01T00:00:00Z',
          '2021-01-01T00:00:00Z'
        )
      ).toBe(true);
    });

    it('AFTER works with Date objects via String() coercion', () => {
      expect(
        evaluateFilterOperator(
          'AFTER',
          new Date('2022-01-01T00:00:00Z'),
          new Date('2021-01-01T00:00:00Z')
        )
      ).toBe(true);
    });
  });

  describe('OLDER_THAN / NEWER_THAN age operators', () => {
    it('OLDER_THAN returns true when age in hours exceeds threshold', () => {
      // 48 hours ago, threshold 24h -> older
      const fortyEightHoursAgo = new Date(
        Date.now() - 48 * 60 * 60 * 1000
      ).toISOString();
      expect(evaluateFilterOperator('OLDER_THAN', fortyEightHoursAgo, 24)).toBe(
        true
      );
    });

    it('OLDER_THAN returns false when age is below threshold', () => {
      const oneHourAgo = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString();
      expect(evaluateFilterOperator('OLDER_THAN', oneHourAgo, 24)).toBe(false);
    });

    it('NEWER_THAN returns true when age in hours is below threshold', () => {
      const oneHourAgo = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString();
      expect(evaluateFilterOperator('NEWER_THAN', oneHourAgo, 24)).toBe(true);
    });

    it('NEWER_THAN returns false when age exceeds threshold', () => {
      const fortyEightHoursAgo = new Date(
        Date.now() - 48 * 60 * 60 * 1000
      ).toISOString();
      expect(
        evaluateFilterOperator('NEWER_THAN', fortyEightHoursAgo, 24)
      ).toBe(false);
    });
  });

  describe('unknown operator', () => {
    it('throws for an unrecognized operator', () => {
      expect(() =>
        evaluateFilterOperator(
          'TOTALLY_BOGUS' as unknown as Parameters<
            typeof evaluateFilterOperator
          >[0],
          'x',
          'y'
        )
      ).toThrow('Unknown operator: TOTALLY_BOGUS');
    });
  });
});
