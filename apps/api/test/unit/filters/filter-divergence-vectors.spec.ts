/**
 * Phase 7 characterization: filter-engine divergence vectors
 * ==========================================================
 *
 * BEFORE the API FilterMatcherService and the scraper RuleEngineService are
 * collapsed into a single shared evaluator (Phase 7), this suite PINS the API
 * engine's CURRENT, observable behaviour so any behaviour-flip during the
 * migration is caught.
 *
 * Entry point under characterization (pure, no DB):
 *   FilterMatcherService.evaluateFilterExpression(expression, article): boolean
 *
 * The article under test is a Dealabs `ArticleWrapper` with:
 *   - title         'Gaming Laptop ASUS ROG'   (base)
 *   - currentPrice  1000                        (base)
 *   - publishedAt   2025-06-15T00:00:00Z        (base)
 *   - temperature   150                         (Dealabs extension)
 *   - merchant      null                        (Dealabs extension)
 *
 * The same scenario list (V1..V6) is shared with the scraper engine's
 * characterization spec so the two engines can be diffed vector-by-vector.
 *
 * -----------------------------------------------------------------------------
 * V1 — NOT-semantics
 *   expression: matchLogic 'NOT', rules [ temperature>=100 (TRUE), temperature>=99999 (FALSE) ]
 *   API current      : NAND  -> `!results.every(r)` = `!(true && false)` = TRUE  (matches)
 *   scraper current  : NOR   -> none-true required -> FALSE
 *   chosen-correct   : NOR   -> FALSE   (BEHAVIOUR FLIP for the API engine)
 *
 * V2 — empty-filter
 *   expression: { rules: [] }
 *   API current      : empty rules -> matches nothing -> FALSE
 *   scraper current  : matches-everything -> TRUE
 *   chosen-correct   : FALSE   (already equals API current)
 *
 * V3 — null-field-not-equals  [CONVERGED — Phase 7]
 *   expression: merchant '!=' 'Amazon' on an article whose merchant is null
 *   API NOW          : null matches !=/NOT_EQUALS/IS_FALSE -> '!=' returns TRUE
 *     (Previously null only matched IS_FALSE -> '!=' returned FALSE.)
 *   scraper current  : TRUE for !=/NOT_EQUALS/IS_FALSE on null
 *   chosen-correct   : align to the live scraper engine -> TRUE. ACHIEVED.
 *
 * V4 — between-numeric
 *   expression: currentPrice BETWEEN [500, 1500], price = 1000
 *   API current      : BETWEEN is Date-only (fieldValue must be `instanceof Date`)
 *                      -> numeric value returns FALSE
 *   scraper current  : numeric BETWEEN supported -> TRUE
 *   chosen-correct   : TRUE   (BEHAVIOUR FLIP for the API engine)
 *
 * V5 — between-date
 *   expression: publishedAt BETWEEN [2025-06-01, 2025-06-30], publishedAt = 2025-06-15
 *   API current      : Date-only BETWEEN -> in range -> TRUE
 *   scraper current  : may work via Number() coercion of dates -> TRUE
 *   chosen-correct   : TRUE   (already equals API current)
 *
 * V6 — weighted-score-scale  [CONVERGED — Phase 7]
 *   `calculateScore` is private, but the score *scale* IS observable on the
 *   boolean path by choosing a `minScore` that straddles the raw vs normalized
 *   values: one of two weight-1.0 rules matches => raw 1.0, normalized 50.
 *   With minScore 50, raw (1.0 >= 50 => FALSE) and normalized (50 >= 50 => TRUE)
 *   disagree, so the boolean reveals the scale.
 *   API NOW          : 'weighted' mode normalized 0-100 (converged) => TRUE
 *     (Previously raw earned weight => FALSE.)
 *   scraper current  : normalized 0-100
 *   chosen-correct   : normalized 0-100 => TRUE. ACHIEVED.
 * -----------------------------------------------------------------------------
 */
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@dealscrapper/database';
import type { Article } from '@dealscrapper/database';
import type { ArticleDealabs } from '@prisma/client';
import { RuleBasedFilterExpression } from '@dealscrapper/shared-types';
import { ArticleWrapper, SiteSource } from '@dealscrapper/shared-types/article';
import { FilterMatcherService } from '../../../src/filters/services/filter-matcher.service.js';

// Type-safe mock helpers, mirroring filter-matcher.service.spec.ts
type MockArticleBase = Partial<Article> &
  Pick<Article, 'id' | 'siteId' | 'title' | 'url' | 'categoryId' | 'scrapedAt' | 'updatedAt'>;
type MockDealabsExtension = Partial<ArticleDealabs> & Pick<ArticleDealabs, 'articleId'>;

describe('filter-engine divergence vectors (Phase 7)', () => {
  let service: FilterMatcherService;
  let mockPrisma: jest.Mocked<PrismaService>;

  // Canonical divergence article — IDENTICAL scenario across both engine specs.
  const baseArticle: MockArticleBase = {
    id: 'article-divergence-1',
    externalId: 'thread_divergence',
    siteId: 'dealabs',
    title: 'Gaming Laptop ASUS ROG',
    description: 'High-end gaming laptop',
    url: 'https://dealabs.com/deals/divergence',
    imageUrl: null,
    currentPrice: 1000,
    categoryId: 'cat-1',
    categoryPath: ['Electronics', 'Laptops'],
    isActive: true,
    isExpired: false,
    location: null,
    publishedAt: new Date('2025-06-15T00:00:00Z'),
    scrapedAt: new Date('2025-06-15T00:30:00Z'),
    updatedAt: new Date('2025-06-15T00:30:00Z'),
  };

  const dealabsExtension: MockDealabsExtension = {
    articleId: 'article-divergence-1',
    temperature: 150,
    commentCount: 10,
    communityVerified: true,
    originalPrice: null,
    discountPercentage: null,
    merchant: null,
    freeShipping: false,
    isCoupon: false,
    expiresAt: null,
    createdAt: new Date('2025-06-15'),
    updatedAt: new Date('2025-06-15'),
  };

  const article = new ArticleWrapper(
    baseArticle as Article,
    dealabsExtension as ArticleDealabs,
    SiteSource.DEALABS,
  );

  beforeEach(async () => {
    mockPrisma = {
      filter: {
        findMany: jest.fn(),
      },
    } as unknown as jest.Mocked<PrismaService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FilterMatcherService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    module.useLogger(false);

    service = module.get<FilterMatcherService>(FilterMatcherService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('current API behavior (characterization — asserts what the engine does TODAY)', () => {
    it('V2 empty-filter: empty rules array matches nothing (FALSE)', () => {
      const expression: RuleBasedFilterExpression = { rules: [] };

      const result = service.evaluateFilterExpression(expression, article);

      expect(result).toBe(false);
    });

    it('V5 between-date: date BETWEEN in range -> TRUE', () => {
      const expression: RuleBasedFilterExpression = {
        rules: [
          {
            field: 'publishedAt',
            operator: 'BETWEEN',
            value: [new Date('2025-06-01'), new Date('2025-06-30')],
          },
        ],
      };

      const result = service.evaluateFilterExpression(expression, article);

      expect(result).toBe(true);
    });
  });

  describe('Phase 7 target (chosen-correct semantics) — skipped until migration', () => {
    it('V1 NOT-semantics: NOR -> one child true means no match (FALSE)', () => {
      // After migration, NOT should mean "none of the children match" (NOR).
      const expression: RuleBasedFilterExpression = {
        matchLogic: 'NOT',
        rules: [
          { field: 'temperature', operator: '>=', value: 100 },
          { field: 'temperature', operator: '>=', value: 99999 },
        ],
      };

      const result = service.evaluateFilterExpression(expression, article);

      expect(result).toBe(false);
    });

    it('V2 empty-filter: empty rules -> FALSE (target equals current API behavior)', () => {
      const expression: RuleBasedFilterExpression = { rules: [] };

      const result = service.evaluateFilterExpression(expression, article);

      expect(result).toBe(false);
    });

    it('V3 null-field-not-equals: null merchant with "!=" -> TRUE (converged with scraper)', () => {
      // CONVERGED: an absent field "is not" any concrete value, so '!=' / NOT_EQUALS
      // match on null (and IS_FALSE, since null is falsy) — matching the live scraper
      // engine. Previously the API returned FALSE here; now it agrees with the scrape path.
      const expression: RuleBasedFilterExpression = {
        rules: [{ field: 'merchant', operator: '!=', value: 'Amazon' }],
      };

      const result = service.evaluateFilterExpression(expression, article);

      expect(result).toBe(true);
    });

    it('V4 between-numeric: numeric BETWEEN supported -> TRUE (1000 in [500, 1500])', () => {
      const expression: RuleBasedFilterExpression = {
        rules: [{ field: 'currentPrice', operator: 'BETWEEN', value: [500, 1500] }],
      };

      const result = service.evaluateFilterExpression(expression, article);

      expect(result).toBe(true);
    });

    it('V5 between-date: date BETWEEN in range -> TRUE (target equals current API behavior)', () => {
      const expression: RuleBasedFilterExpression = {
        rules: [
          {
            field: 'publishedAt',
            operator: 'BETWEEN',
            value: [new Date('2025-06-01'), new Date('2025-06-30')],
          },
        ],
      };

      const result = service.evaluateFilterExpression(expression, article);

      expect(result).toBe(true);
    });

    it('V6 weighted-score-scale: normalized 0-100 observable via straddling minScore -> TRUE', () => {
      // One of two weight-1.0 rules matches: raw earned weight = 1.0, normalized = 50.
      // minScore 50 straddles the two scales: raw would be FALSE (1.0 < 50),
      // normalized is TRUE (50 >= 50). Passing proves the API now normalizes.
      const expression: RuleBasedFilterExpression = {
        scoreMode: 'weighted',
        minScore: 50,
        rules: [
          { field: 'temperature', operator: '>=', value: 100, weight: 1.0 }, // 150 >= 100 TRUE
          { field: 'temperature', operator: '>=', value: 99999, weight: 1.0 }, // FALSE
        ],
      };

      const result = service.evaluateFilterExpression(expression, article);

      expect(result).toBe(true);
    });
  });
});
