/**
 * ============================================================================
 * Phase 7 characterization: filter-engine divergence vectors
 * ============================================================================
 *
 * Phase 7 of the remediation backlog collapses the two filter engines
 * (scraper's `RuleEngineService` and API's `FilterMatcherService`) into one
 * shared evaluator. Before that migration we must PIN the CURRENT behavior of
 * each engine so the collapse is provably behavior-preserving (or, where the
 * engines diverge today, so we know exactly which behavior we are choosing).
 *
 * This spec characterizes the SCRAPER engine only. A sibling spec characterizes
 * the API engine using the same vector ids and scenarios. The API column below
 * is documented purely for cross-reference; this file never imports or runs the
 * API engine.
 *
 * Per-vector summary (current behavior observed by RUNNING the vector):
 *
 *  V1 — NOT-semantics
 *      Expression: top-level matchLogic 'NOT' over two rules, one true one false.
 *      Scraper TODAY: NOR semantics — NOT(some-true) => false. matches:false.
 *      API     TODAY: NAND semantics — true.
 *      Chosen-correct target: NOR (none-true) => matches:false.
 *
 *  V2 — empty-filter  [CONVERGED — Phase 7]
 *      Expression: { rules: [] }.
 *      Scraper NOW: createNoRulesResult() => matches:FALSE, score 0 (converged).
 *        (Previously matches:TRUE/score 100 — "matches all" — now matches-nothing.)
 *      API     TODAY: matches-nothing => false.
 *      Chosen-correct target: matches-nothing => matches:false. ACHIEVED.
 *
 *  V3 — null-field-not-equals
 *      Expression: deal.merchant absent; merchant '!=' 'Amazon'.
 *      Scraper TODAY: evaluateNullFieldValue() treats !=/NOT_EQUALS/IS_FALSE on a
 *        null field as TRUE => rule matches => matches:TRUE.
 *      API     TODAY: IS_FALSE-only null handling => false.
 *      Chosen-correct target: NOT LOCKED by the plan ("explicit null rules"
 *        without a decided value) => documented as it.todo.
 *
 *  V4 — between-numeric
 *      Expression: currentPrice BETWEEN [500, 1500]; price 1000.
 *      Scraper TODAY: numeric BETWEEN => true.
 *      API     TODAY: date-only BETWEEN handling, numeric path => true.
 *      Chosen-correct target: true.
 *
 *  V5 — between-date
 *      Expression: publishedAt BETWEEN [2025-06-01, 2025-06-30]; date 2025-06-15.
 *      Scraper TODAY: BETWEEN coerces via Number(date) === epoch-ms for BOTH the
 *        field and the bounds, so the date comparison actually works => true.
 *        *** SURPRISE vs the "scraper has no date BETWEEN branch, so it fails"
 *        expectation: Number(Date) coercion makes it succeed. ***
 *      API     TODAY: dedicated date BETWEEN branch => true.
 *      Chosen-correct target: true.
 *
 *  V6 — weighted-score-scale  [CONVERGED — Phase 7]
 *      Expression: scoreMode 'weighted', minScore 0, two weight-1.0 rules, one
 *        matches one doesn't.
 *      Scraper TODAY: score normalized to 0-100 => totalScore 100 / maxPossible
 *        200 * 100 = 50.
 *      API     NOW: 'weighted' normalized 0-100 (converged; was raw earned weight).
 *      Chosen-correct target: normalized 0-100 => score 50. ACHIEVED both sides.
 * ============================================================================
 */

import { Test, TestingModule } from '@nestjs/testing';
import { RuleEngineService } from '../../../src/filter-matching/rule-engine.service';
import { RawDeal, RuleBasedFilterExpression } from '../../../src/common/interfaces';

describe('filter-engine divergence vectors (scraper)', () => {
  let service: RuleEngineService;

  /**
   * Genuine RawDeal — every required field present with a real value:
   * externalId, title, category, categoryPath, url, isExpired, source, isActive.
   * `merchant` is intentionally absent so V3 exercises the null-field path.
   */
  const baseDeal: RawDeal = {
    externalId: 'deal-divergence-1',
    title: 'Gaming Laptop ASUS ROG',
    category: 'laptops',
    categoryPath: ['tech', 'laptops', 'gaming'],
    currentPrice: 1000,
    temperature: 150,
    publishedAt: new Date('2025-06-15T00:00:00Z'),
    url: 'https://example.com/deal',
    isExpired: false,
    source: 'dealabs',
    isActive: true,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RuleEngineService],
    }).compile();

    service = module.get<RuleEngineService>(RuleEngineService);
  });

  // ==========================================================================
  // Current scraper behavior — these assert what the engine does TODAY and
  // MUST stay green. Each value was confirmed by actually running the vector.
  // ==========================================================================
  describe('current scraper behavior (characterization — asserts what the engine does TODAY)', () => {
    it('V1 NOT-semantics: NOR (none-true) => matches:false', async () => {
      const expression: RuleBasedFilterExpression = {
        matchLogic: 'NOT',
        rules: [
          { field: 'temperature', operator: '>=', value: 100 },
          { field: 'temperature', operator: '>=', value: 99999 },
        ],
      };

      const result = await service.evaluateFilterExpression(expression, baseDeal);

      // One child true (150 >= 100), one false: NOT(some-true) => false.
      expect(result.matches).toBe(false);
    });

    it('V3 null-field-not-equals: absent merchant != "Amazon" => matches:TRUE', async () => {
      const expression: RuleBasedFilterExpression = {
        rules: [{ field: 'merchant', operator: '!=', value: 'Amazon' }],
      };

      const result = await service.evaluateFilterExpression(expression, baseDeal);

      // evaluateNullFieldValue() treats != on a null/undefined field as true,
      // so the rule matches and the single-rule AND passes.
      expect(result.matches).toBe(true);
    });

    it('V4 between-numeric: currentPrice 1000 BETWEEN [500,1500] => matches:TRUE', async () => {
      const expression: RuleBasedFilterExpression = {
        rules: [{ field: 'currentPrice', operator: 'BETWEEN', value: [500, 1500] }],
      };

      const result = await service.evaluateFilterExpression(expression, baseDeal);

      expect(result.matches).toBe(true);
    });

    it('V5 between-date: publishedAt 2025-06-15 BETWEEN [Jun 1, Jun 30] => matches:TRUE (SURPRISE — works via Number(date))', async () => {
      const expression: RuleBasedFilterExpression = {
        rules: [
          {
            field: 'publishedAt',
            operator: 'BETWEEN',
            value: [new Date('2025-06-01'), new Date('2025-06-30')],
          },
        ],
      };

      const result = await service.evaluateFilterExpression(expression, baseDeal);

      // SURPRISE: BETWEEN has no dedicated date branch, but Number(Date) coerces
      // both the field value and the bounds to epoch-ms, so the comparison works
      // and the date actually falls inside the range => true.
      expect(result.matches).toBe(true);
    });
  });

  // ==========================================================================
  // Phase 7 target (chosen-correct semantics) — skipped until the migration
  // lands. These document the post-migration goal without failing now.
  // ==========================================================================
  describe('Phase 7 target (chosen-correct semantics) — skipped until migration', () => {
    it.skip('V1 NOT-semantics target: NOR (none-true) => matches:false', async () => {
      const expression: RuleBasedFilterExpression = {
        matchLogic: 'NOT',
        rules: [
          { field: 'temperature', operator: '>=', value: 100 },
          { field: 'temperature', operator: '>=', value: 99999 },
        ],
      };

      const result = await service.evaluateFilterExpression(expression, baseDeal);

      expect(result.matches).toBe(false);
    });

    it('V2 empty-filter target: empty rules => matches-nothing => matches:false', async () => {
      const expression: RuleBasedFilterExpression = { rules: [] };

      const result = await service.evaluateFilterExpression(expression, baseDeal);

      expect(result.matches).toBe(false);
      expect(result.score).toBe(0);
    });

    // V3 target is NOT LOCKED by the plan — null-field semantics are undecided.
    it.todo('V3 null-field-not-equals target: explicit null-rule semantics (undecided)');

    it.skip('V4 between-numeric target: currentPrice 1000 BETWEEN [500,1500] => matches:true', async () => {
      const expression: RuleBasedFilterExpression = {
        rules: [{ field: 'currentPrice', operator: 'BETWEEN', value: [500, 1500] }],
      };

      const result = await service.evaluateFilterExpression(expression, baseDeal);

      expect(result.matches).toBe(true);
    });

    it.skip('V5 between-date target: publishedAt 2025-06-15 BETWEEN [Jun 1, Jun 30] => matches:true', async () => {
      const expression: RuleBasedFilterExpression = {
        rules: [
          {
            field: 'publishedAt',
            operator: 'BETWEEN',
            value: [new Date('2025-06-01'), new Date('2025-06-30')],
          },
        ],
      };

      const result = await service.evaluateFilterExpression(expression, baseDeal);

      expect(result.matches).toBe(true);
    });

    it('V6 weighted-score-scale target: normalized 0-100 => score 50 (CONVERGED both engines)', async () => {
      const expression: RuleBasedFilterExpression = {
        scoreMode: 'weighted',
        minScore: 0,
        rules: [
          { field: 'temperature', operator: '>=', value: 100, weight: 1.0 },
          { field: 'temperature', operator: '>=', value: 99999, weight: 1.0 },
        ],
      };

      const result = await service.evaluateFilterExpression(expression, baseDeal);

      expect(result.score).toBe(50);
    });
  });
});
