import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@dealscrapper/database';
import type { Article } from '@dealscrapper/database';
import type { ArticleDealabs, ArticleVinted } from '@prisma/client';
import {
  RuleBasedFilterExpression,
  FilterRule,
  FilterRuleGroup,
} from '@dealscrapper/shared-types';
import {
  ArticleWrapper,
  SiteSource,
} from '@dealscrapper/shared-types/article';
import { FilterMatcherService } from '../../../src/filters/services/filter-matcher.service.js';

// Type-safe mock helpers for test data
type MockArticleBase = Partial<Article> & Pick<Article, 'id' | 'siteId' | 'title' | 'url' | 'categoryId' | 'scrapedAt' | 'updatedAt'>;
type MockDealabsExtension = Partial<ArticleDealabs> & Pick<ArticleDealabs, 'articleId'>;
type MockVintedExtension = Partial<ArticleVinted> & Pick<ArticleVinted, 'articleId'>;

// Filter with categories relation for test mocks
interface MockFilterCategory {
  id: string;
  filterId: string;
  categoryId: string;
  category: {
    id: string;
    siteId: string;
    site: { id: string };
  };
}

interface MockFilterWithCategories {
  id: string;
  name: string;
  userId: string;
  active: boolean;
  filterExpression: RuleBasedFilterExpression;
  categories?: MockFilterCategory[];
  enabledSites?: string[];
  description?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

describe('FilterMatcherService', () => {
  let service: FilterMatcherService;
  let mockPrisma: jest.Mocked<PrismaService>;

  // Mock test data - Dealabs article
  const mockDealabsArticleBase: MockArticleBase = {
    id: 'article-1',
    externalId: 'thread_123',
    siteId: 'dealabs',
    title: 'RTX 4090 Gaming GPU',
    description: 'High-end graphics card',
    url: 'https://dealabs.com/deals/123',
    imageUrl: 'https://example.com/gpu.jpg',
    currentPrice: 1200,
    categoryId: 'cat-1',
    categoryPath: ['Electronics', 'PC Components'],
    isActive: true,
    isExpired: false,
    location: null,
    publishedAt: new Date('2025-01-15T10:00:00Z'),
    scrapedAt: new Date('2025-01-15T10:30:00Z'),
    updatedAt: new Date('2025-01-15T10:30:00Z'),
  };

  const mockDealabsExtension: MockDealabsExtension = {
    articleId: 'article-1',
    temperature: 150,
    commentCount: 50,
    communityVerified: true,
    originalPrice: 1600,
    discountPercentage: 25,
    merchant: 'Amazon',
    freeShipping: true,
    isCoupon: false,
    expiresAt: new Date('2025-01-20'),
    createdAt: new Date('2025-01-15'),
    updatedAt: new Date('2025-01-15'),
  };

  const mockDealabsArticle = new ArticleWrapper(
    mockDealabsArticleBase as Article,
    mockDealabsExtension as ArticleDealabs,
    SiteSource.DEALABS,
  );

  // Mock test data - Vinted article
  const mockVintedArticleBase: MockArticleBase = {
    id: 'article-2',
    externalId: 'item_456',
    siteId: 'vinted',
    title: 'Nike Air Max Shoes',
    description: 'Gently used Nike shoes',
    url: 'https://vinted.fr/items/456',
    imageUrl: 'https://example.com/shoes.jpg',
    currentPrice: 45,
    categoryId: 'cat-2',
    categoryPath: ['Fashion', 'Shoes'],
    isActive: true,
    isExpired: false,
    location: null,
    publishedAt: null,
    scrapedAt: new Date('2025-01-15T11:00:00Z'),
    updatedAt: new Date('2025-01-15T11:00:00Z'),
  };

  const mockVintedExtension: MockVintedExtension = {
    articleId: 'article-2',
    favoriteCount: 20,
    viewCount: 200,
    boosted: false,
    brand: 'Nike',
    size: '42',
    color: 'Black',
    condition: 'Tres bon etat',
    sellerName: 'sneaker_fan',
    sellerRating: 4.9,
    buyerProtectionFee: 1.5,
    createdAt: new Date('2025-01-15'),
    updatedAt: new Date('2025-01-15'),
  };

  const mockVintedArticle = new ArticleWrapper(
    mockVintedArticleBase as Article,
    mockVintedExtension as ArticleVinted,
    SiteSource.VINTED,
  );

  beforeEach(async () => {
    // Create mock PrismaService
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

    // Suppress logger output during tests
    module.useLogger(false);

    service = module.get<FilterMatcherService>(FilterMatcherService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('matchArticle - Basic Filter Matching', () => {
    it('should match Dealabs article with Dealabs-enabled filter', async () => {
      // Arrange
      const filter: MockFilterWithCategories = {
        id: 'filter-1',
        name: 'GPU Deals',
        userId: 'user-1',
        active: true,
        filterExpression: {
          rules: [
            { field: 'currentPrice', operator: '<=', value: 1500 },
            { field: 'title', operator: 'CONTAINS', value: 'RTX', caseSensitive: false },
          ],
          matchLogic: 'AND',
        },
        categories: [
          {
            id: 'fc-1',
            filterId: 'filter-1',
            categoryId: 'cat-1',
            category: { id: 'cat-1', siteId: 'dealabs', site: { id: 'dealabs' } },
          },
        ],
      };

      mockPrisma.filter.findMany.mockResolvedValue([filter]);

      // Act
      const matches = await service.matchArticle(mockDealabsArticle);

      // Assert
      expect(matches).toHaveLength(1);
      expect(matches[0].id).toBe('filter-1');
      expect(mockPrisma.filter.findMany).toHaveBeenCalledWith({
        where: {
          active: true,
          categories: {
            some: {
              category: {
                siteId: 'dealabs',
              },
            },
          },
        },
        include: {
          categories: {
            include: {
              category: {
                include: {
                  site: true,
                },
              },
            },
          },
        },
      });
    });

    it('should match Vinted article with Vinted-enabled filter', async () => {
      // Arrange
      const filter: MockFilterWithCategories = {
        id: 'filter-2',
        name: 'Nike Shoes',
        userId: 'user-1',
        active: true,
        filterExpression: {
          rules: [
            { field: 'currentPrice', operator: '<=', value: 50 },
            { field: 'title', operator: 'CONTAINS', value: 'Nike', caseSensitive: false },
          ],
          matchLogic: 'AND',
        },
        categories: [
          {
            id: 'fc-2',
            filterId: 'filter-2',
            categoryId: 'cat-2',
            category: { id: 'cat-2', siteId: 'vinted', site: { id: 'vinted' } },
          },
        ],
      };

      mockPrisma.filter.findMany.mockResolvedValue([filter]);

      // Act
      const matches = await service.matchArticle(mockVintedArticle);

      // Assert
      expect(matches).toHaveLength(1);
      expect(matches[0].id).toBe('filter-2');
    });

    it('should not match when site is not in filter categories', async () => {
      // Arrange - Dealabs filter (via categories), but article is Vinted
      // Prisma will filter by categories.category.siteId, returning empty

      mockPrisma.filter.findMany.mockResolvedValue([]); // Prisma filters by site

      // Act
      const matches = await service.matchArticle(mockVintedArticle);

      // Assert
      expect(matches).toHaveLength(0);
      expect(mockPrisma.filter.findMany).toHaveBeenCalledWith({
        where: {
          active: true,
          categories: {
            some: {
              category: {
                siteId: 'vinted',
              },
            },
          },
        },
        include: {
          categories: {
            include: {
              category: {
                include: {
                  site: true,
                },
              },
            },
          },
        },
      });
    });

    it('should match multiple filters for same article', async () => {
      // Arrange
      const filter1: MockFilterWithCategories = {
        id: 'filter-1',
        name: 'Budget GPU',
        userId: 'user-1',
        enabledSites: ['dealabs'],
        active: true,
        filterExpression: {
          rules: [{ field: 'currentPrice', operator: '<=', value: 1500 }],
          matchLogic: 'AND',
        },
      };

      const filter2: MockFilterWithCategories = {
        id: 'filter-2',
        name: 'High Temperature',
        userId: 'user-1',
        enabledSites: ['dealabs'],
        active: true,
        filterExpression: {
          rules: [{ field: 'temperature', operator: '>=', value: 100 }],
          matchLogic: 'AND',
        },
      };

      mockPrisma.filter.findMany.mockResolvedValue([filter1, filter2]);

      // Act
      const matches = await service.matchArticle(mockDealabsArticle);

      // Assert
      expect(matches).toHaveLength(2);
      expect(matches.map((f) => f.id)).toEqual(['filter-1', 'filter-2']);
    });

    it('should return empty array when no filters match', async () => {
      // Arrange - filter requires price <= 100, but article is 1200
      const filter: MockFilterWithCategories = {
        id: 'filter-1',
        name: 'Budget Only',
        userId: 'user-1',
        enabledSites: ['dealabs'],
        active: true,
        filterExpression: {
          rules: [{ field: 'currentPrice', operator: '<=', value: 100 }],
          matchLogic: 'AND',
        },
      };

      mockPrisma.filter.findMany.mockResolvedValue([filter]);

      // Act
      const matches = await service.matchArticle(mockDealabsArticle);

      // Assert
      expect(matches).toHaveLength(0);
    });

    it('should not match when filter is inactive', async () => {
      // Arrange
      mockPrisma.filter.findMany.mockResolvedValue([]); // No active filters

      // Act
      const matches = await service.matchArticle(mockDealabsArticle);

      // Assert
      expect(matches).toHaveLength(0);
    });
  });

  describe('Site-Specific Rule Logic', () => {
    it('should match temperature rule for Dealabs article', async () => {
      // Arrange
      const filter: MockFilterWithCategories = {
        id: 'filter-1',
        name: 'Hot Dealabs Deals',
        userId: 'user-1',
        enabledSites: ['dealabs'],
        active: true,
        filterExpression: {
          rules: [
            {
              field: 'temperature',
              operator: '>=',
              value: 100,
              siteSpecific: 'dealabs',
            } as FilterRule,
          ],
          matchLogic: 'AND',
        },
      };

      mockPrisma.filter.findMany.mockResolvedValue([filter]);

      // Act
      const matches = await service.matchArticle(mockDealabsArticle);

      // Assert
      expect(matches).toHaveLength(1);
      expect(matches[0].id).toBe('filter-1');
    });

    it('should skip temperature rule for Vinted article (site-specific field)', async () => {
      // Arrange - temperature rule exists but is marked as Dealabs-only
      const filter: MockFilterWithCategories = {
        id: 'filter-1',
        name: 'Multi-site filter',
        userId: 'user-1',
        enabledSites: ['dealabs', 'vinted'],
        active: true,
        filterExpression: {
          rules: [
            {
              field: 'temperature',
              operator: '>=',
              value: 100,
              siteSpecific: 'dealabs',
            } as FilterRule,
          ],
          matchLogic: 'AND',
        },
      };

      mockPrisma.filter.findMany.mockResolvedValue([filter]);

      // Act
      const matches = await service.matchArticle(mockVintedArticle);

      // Assert
      // Rule is skipped (returns true), so filter still matches
      expect(matches).toHaveLength(1);
    });

    it('should match favoriteCount rule for Vinted article', async () => {
      // Arrange
      const filter: MockFilterWithCategories = {
        id: 'filter-1',
        name: 'Popular Vinted Items',
        userId: 'user-1',
        enabledSites: ['vinted'],
        active: true,
        filterExpression: {
          rules: [
            {
              field: 'favoriteCount',
              operator: '>=',
              value: 10,
              siteSpecific: 'vinted',
            } as FilterRule,
          ],
          matchLogic: 'AND',
        },
      };

      mockPrisma.filter.findMany.mockResolvedValue([filter]);

      // Act
      const matches = await service.matchArticle(mockVintedArticle);

      // Assert
      expect(matches).toHaveLength(1);
      expect(matches[0].id).toBe('filter-1');
    });

    it('should skip favoriteCount rule for Dealabs article', async () => {
      // Arrange
      const filter: MockFilterWithCategories = {
        id: 'filter-1',
        name: 'Multi-site filter',
        userId: 'user-1',
        enabledSites: ['dealabs', 'vinted'],
        active: true,
        filterExpression: {
          rules: [
            {
              field: 'favoriteCount',
              operator: '>=',
              value: 10,
              siteSpecific: 'vinted',
            } as FilterRule,
          ],
          matchLogic: 'AND',
        },
      };

      mockPrisma.filter.findMany.mockResolvedValue([filter]);

      // Act
      const matches = await service.matchArticle(mockDealabsArticle);

      // Assert
      // Rule is skipped, so filter matches
      expect(matches).toHaveLength(1);
    });

    it('should handle multi-site filter with mixed site-specific and universal rules', async () => {
      // Arrange
      const filter: MockFilterWithCategories = {
        id: 'filter-1',
        name: 'Multi-site with mixed rules',
        userId: 'user-1',
        enabledSites: ['dealabs', 'vinted'],
        active: true,
        filterExpression: {
          rules: [
            { field: 'currentPrice', operator: '<=', value: 100 }, // Universal
            {
              field: 'temperature',
              operator: '>=',
              value: 100,
              siteSpecific: 'dealabs',
            } as FilterRule, // Dealabs only
            {
              field: 'favoriteCount',
              operator: '>=',
              value: 10,
              siteSpecific: 'vinted',
            } as FilterRule, // Vinted only
          ],
          matchLogic: 'AND',
        },
      };

      mockPrisma.filter.findMany.mockResolvedValue([filter]);

      // Act - Test with Vinted article
      const vintedMatches = await service.matchArticle(mockVintedArticle);

      // Assert
      // currentPrice: 45 <= 100 ✓
      // temperature: skipped (Dealabs only) ✓
      // favoriteCount: 20 >= 10 ✓
      expect(vintedMatches).toHaveLength(1);
    });

    it('should match universal field (price) for all sites', async () => {
      // Arrange
      const filter: MockFilterWithCategories = {
        id: 'filter-1',
        name: 'Budget filter',
        userId: 'user-1',
        enabledSites: ['dealabs', 'vinted'],
        active: true,
        filterExpression: {
          rules: [{ field: 'currentPrice', operator: '<=', value: 1500 }],
          matchLogic: 'AND',
        },
      };

      mockPrisma.filter.findMany.mockResolvedValue([filter]);

      // Act - Test with both articles
      const dealabsMatches = await service.matchArticle(mockDealabsArticle);
      mockPrisma.filter.findMany.mockResolvedValue([filter]);
      const vintedMatches = await service.matchArticle(mockVintedArticle);

      // Assert
      expect(dealabsMatches).toHaveLength(1); // 1200 <= 1500
      expect(vintedMatches).toHaveLength(1); // 45 <= 1500
    });

    it('should apply explicit siteSpecific property', async () => {
      // Arrange
      const filter: MockFilterWithCategories = {
        id: 'filter-1',
        name: 'Explicit site filter',
        userId: 'user-1',
        enabledSites: ['dealabs', 'vinted'],
        active: true,
        filterExpression: {
          rules: [
            {
              field: 'currentPrice',
              operator: '<=',
              value: 100,
              siteSpecific: 'vinted', // Explicitly only for Vinted
            } as FilterRule,
          ],
          matchLogic: 'AND',
        },
      };

      mockPrisma.filter.findMany.mockResolvedValue([filter]);

      // Act
      const dealabsMatches = await service.matchArticle(mockDealabsArticle);
      mockPrisma.filter.findMany.mockResolvedValue([filter]);
      const vintedMatches = await service.matchArticle(mockVintedArticle);

      // Assert
      expect(dealabsMatches).toHaveLength(1); // Rule skipped, filter matches
      expect(vintedMatches).toHaveLength(1); // Rule applies: 45 <= 100
    });
  });

  describe('Filter Operators', () => {
    describe('Numeric Operators', () => {
      it('should match with = operator', async () => {
        const result = service.evaluateRule(
          { field: 'currentPrice', operator: '=', value: 1200 },
          mockDealabsArticle,
        );
        expect(result).toBe(true);
      });

      it('should match with != operator', async () => {
        const result = service.evaluateRule(
          { field: 'currentPrice', operator: '!=', value: 1000 },
          mockDealabsArticle,
        );
        expect(result).toBe(true);
      });

      it('should match with > operator', async () => {
        const result = service.evaluateRule(
          { field: 'currentPrice', operator: '>', value: 1000 },
          mockDealabsArticle,
        );
        expect(result).toBe(true);
      });

      it('should match with >= operator', async () => {
        const result = service.evaluateRule(
          { field: 'currentPrice', operator: '>=', value: 1200 },
          mockDealabsArticle,
        );
        expect(result).toBe(true);
      });

      it('should match with < operator', async () => {
        const result = service.evaluateRule(
          { field: 'currentPrice', operator: '<', value: 1500 },
          mockDealabsArticle,
        );
        expect(result).toBe(true);
      });

      it('should match with <= operator', async () => {
        const result = service.evaluateRule(
          { field: 'currentPrice', operator: '<=', value: 1200 },
          mockDealabsArticle,
        );
        expect(result).toBe(true);
      });

      it('should not match when numeric comparison fails', async () => {
        const result = service.evaluateRule(
          { field: 'currentPrice', operator: '>', value: 1500 },
          mockDealabsArticle,
        );
        expect(result).toBe(false);
      });
    });

    describe('String Operators', () => {
      it('should match with CONTAINS operator (case-insensitive)', async () => {
        const result = service.evaluateRule(
          {
            field: 'title',
            operator: 'CONTAINS',
            value: 'rtx',
            caseSensitive: false,
          },
          mockDealabsArticle,
        );
        expect(result).toBe(true);
      });

      it('should match with CONTAINS operator (case-sensitive)', async () => {
        const result = service.evaluateRule(
          {
            field: 'title',
            operator: 'CONTAINS',
            value: 'RTX',
            caseSensitive: true,
          },
          mockDealabsArticle,
        );
        expect(result).toBe(true);
      });

      it('should not match CONTAINS with wrong case when case-sensitive', async () => {
        const result = service.evaluateRule(
          {
            field: 'title',
            operator: 'CONTAINS',
            value: 'rtx',
            caseSensitive: true,
          },
          mockDealabsArticle,
        );
        expect(result).toBe(false);
      });

      it('should match with STARTS_WITH operator', async () => {
        const result = service.evaluateRule(
          {
            field: 'title',
            operator: 'STARTS_WITH',
            value: 'RTX',
            caseSensitive: false,
          },
          mockDealabsArticle,
        );
        expect(result).toBe(true);
      });

      it('should match with ENDS_WITH operator', async () => {
        const result = service.evaluateRule(
          {
            field: 'title',
            operator: 'ENDS_WITH',
            value: 'GPU',
            caseSensitive: false,
          },
          mockDealabsArticle,
        );
        expect(result).toBe(true);
      });

      it('should match with REGEX operator', async () => {
        const result = service.evaluateRule(
          {
            field: 'title',
            operator: 'REGEX',
            value: '^RTX.*GPU$',
            caseSensitive: false,
          },
          mockDealabsArticle,
        );
        expect(result).toBe(true);
      });

      it('should handle invalid regex gracefully', async () => {
        const result = service.evaluateRule(
          {
            field: 'title',
            operator: 'REGEX',
            value: '[invalid(',
            caseSensitive: false,
          },
          mockDealabsArticle,
        );
        expect(result).toBe(false);
      });

      it('should match with EQUALS operator (case-insensitive)', async () => {
        const result = service.evaluateRule(
          {
            field: 'merchant',
            operator: 'EQUALS',
            value: 'amazon',
            caseSensitive: false,
          },
          mockDealabsArticle,
        );
        expect(result).toBe(true);
      });

      it('should match with NOT_EQUALS operator', async () => {
        const result = service.evaluateRule(
          {
            field: 'merchant',
            operator: 'NOT_EQUALS',
            value: 'eBay',
            caseSensitive: false,
          },
          mockDealabsArticle,
        );
        expect(result).toBe(true);
      });
    });

    describe('Array Operators', () => {
      it('should match with IN operator', async () => {
        const result = service.evaluateRule(
          {
            field: 'merchant',
            operator: 'IN',
            value: ['Amazon', 'eBay', 'Walmart'],
            caseSensitive: false,
          },
          mockDealabsArticle,
        );
        expect(result).toBe(true);
      });

      it('should not match with IN operator when value not in array', async () => {
        const result = service.evaluateRule(
          {
            field: 'merchant',
            operator: 'IN',
            value: ['eBay', 'Walmart'],
            caseSensitive: false,
          },
          mockDealabsArticle,
        );
        expect(result).toBe(false);
      });

      it('should match with NOT_IN operator', async () => {
        const result = service.evaluateRule(
          {
            field: 'merchant',
            operator: 'NOT_IN',
            value: ['eBay', 'Walmart'],
            caseSensitive: false,
          },
          mockDealabsArticle,
        );
        expect(result).toBe(true);
      });

      it('should match with INCLUDES_ANY operator', async () => {
        const articleWithArray = new ArticleWrapper(
          {
            ...mockDealabsArticle.base,
            categoryPath: ['Electronics', 'PC Components', 'GPU'],
          } as Article,
          mockDealabsArticle.extension,
          SiteSource.DEALABS,
        );

        const result = service.evaluateRule(
          {
            field: 'categoryPath',
            operator: 'INCLUDES_ANY',
            value: ['GPU', 'CPU'],
            caseSensitive: false,
          },
          articleWithArray,
        );
        expect(result).toBe(true);
      });

      it('should match with INCLUDES_ALL operator', async () => {
        const articleWithArray = new ArticleWrapper(
          {
            ...mockDealabsArticle.base,
            categoryPath: ['Electronics', 'PC Components', 'GPU'],
          } as Article,
          mockDealabsArticle.extension,
          SiteSource.DEALABS,
        );

        const result = service.evaluateRule(
          {
            field: 'categoryPath',
            operator: 'INCLUDES_ALL',
            value: ['Electronics', 'GPU'],
            caseSensitive: false,
          },
          articleWithArray,
        );
        expect(result).toBe(true);
      });

      it('should not match INCLUDES_ALL when missing element', async () => {
        const articleWithArray = new ArticleWrapper(
          {
            ...mockDealabsArticle.base,
            categoryPath: ['Electronics', 'PC Components'],
          } as Article,
          mockDealabsArticle.extension,
          SiteSource.DEALABS,
        );

        const result = service.evaluateRule(
          {
            field: 'categoryPath',
            operator: 'INCLUDES_ALL',
            value: ['Electronics', 'GPU'],
            caseSensitive: false,
          },
          articleWithArray,
        );
        expect(result).toBe(false);
      });
    });

    describe('Boolean Operators', () => {
      it('should match with IS_TRUE operator', async () => {
        const result = service.evaluateRule(
          { field: 'freeShipping', operator: 'IS_TRUE', value: true },
          mockDealabsArticle,
        );
        expect(result).toBe(true);
      });

      it('should match with IS_FALSE operator', async () => {
        const result = service.evaluateRule(
          { field: 'isCoupon', operator: 'IS_FALSE', value: false },
          mockDealabsArticle,
        );
        expect(result).toBe(true);
      });

      it('should match IS_FALSE for null values', async () => {
        const articleWithNull = new ArticleWrapper(
          {
            ...mockDealabsArticle.base,
            location: null,
          } as Article,
          mockDealabsArticle.extension,
          SiteSource.DEALABS,
        );

        const result = service.evaluateRule(
          { field: 'location', operator: 'IS_FALSE', value: false },
          articleWithNull,
        );
        expect(result).toBe(true);
      });
    });

    describe('Date Operators', () => {
      it('should match with BEFORE operator', async () => {
        const result = service.evaluateRule(
          {
            field: 'publishedAt',
            operator: 'BEFORE',
            value: new Date('2025-01-16'),
          },
          mockDealabsArticle,
        );
        expect(result).toBe(true);
      });

      it('should match with AFTER operator', async () => {
        const result = service.evaluateRule(
          {
            field: 'publishedAt',
            operator: 'AFTER',
            value: new Date('2025-01-14'),
          },
          mockDealabsArticle,
        );
        expect(result).toBe(true);
      });

      it('should match with BETWEEN operator', async () => {
        const result = service.evaluateRule(
          {
            field: 'publishedAt',
            operator: 'BETWEEN',
            value: [new Date('2025-01-14'), new Date('2025-01-16')],
          },
          mockDealabsArticle,
        );
        expect(result).toBe(true);
      });

      it('should match with OLDER_THAN operator', async () => {
        // Article published ~1 hour ago, test for older than 0.5 hours
        const result = service.evaluateRule(
          {
            field: 'scrapedAt',
            operator: 'OLDER_THAN',
            value: 0.01, // 0.01 hours = ~36 seconds
          },
          mockDealabsArticle,
        );
        expect(result).toBe(true);
      });

      it('should match with NEWER_THAN operator', async () => {
        // Create a fresh article with recent scrapedAt
        const recentArticle = new ArticleWrapper(
          {
            ...mockDealabsArticle.base,
            scrapedAt: new Date(Date.now() - 1000 * 60 * 60 * 0.5), // 0.5 hours ago
          } as Article,
          mockDealabsArticle.extension,
          SiteSource.DEALABS,
        );

        const result = service.evaluateRule(
          {
            field: 'scrapedAt',
            operator: 'NEWER_THAN',
            value: 1, // 1 hour
          },
          recentArticle,
        );
        expect(result).toBe(true);
      });
    });
  });

  describe('Logical Groups', () => {
    it('should match with AND logic when all rules pass', async () => {
      const expression: RuleBasedFilterExpression = {
        rules: [
          { field: 'currentPrice', operator: '<=', value: 1500 },
          { field: 'temperature', operator: '>=', value: 100 },
        ],
        matchLogic: 'AND',
      };

      const result = service.evaluateFilterExpression(
        expression,
        mockDealabsArticle,
      );
      expect(result).toBe(true);
    });

    it('should not match with AND logic when one rule fails', async () => {
      const expression: RuleBasedFilterExpression = {
        rules: [
          { field: 'currentPrice', operator: '<=', value: 1500 },
          { field: 'temperature', operator: '>=', value: 200 }, // Fails: 150 < 200
        ],
        matchLogic: 'AND',
      };

      const result = service.evaluateFilterExpression(
        expression,
        mockDealabsArticle,
      );
      expect(result).toBe(false);
    });

    it('should match with OR logic when at least one rule passes', async () => {
      const expression: RuleBasedFilterExpression = {
        rules: [
          { field: 'currentPrice', operator: '<=', value: 100 }, // Fails
          { field: 'temperature', operator: '>=', value: 100 }, // Passes
        ],
        matchLogic: 'OR',
      };

      const result = service.evaluateFilterExpression(
        expression,
        mockDealabsArticle,
      );
      expect(result).toBe(true);
    });

    it('should not match with OR logic when all rules fail', async () => {
      const expression: RuleBasedFilterExpression = {
        rules: [
          { field: 'currentPrice', operator: '<=', value: 100 },
          { field: 'temperature', operator: '>=', value: 200 },
        ],
        matchLogic: 'OR',
      };

      const result = service.evaluateFilterExpression(
        expression,
        mockDealabsArticle,
      );
      expect(result).toBe(false);
    });

    it('should match with NOT logic when rules do not all pass', async () => {
      const expression: RuleBasedFilterExpression = {
        rules: [
          { field: 'currentPrice', operator: '<=', value: 100 }, // Fails
        ],
        matchLogic: 'NOT',
      };

      const result = service.evaluateFilterExpression(
        expression,
        mockDealabsArticle,
      );
      expect(result).toBe(true); // NOT negates: false becomes true
    });

    it('should handle nested groups (AND inside OR)', async () => {
      const expression: RuleBasedFilterExpression = {
        rules: [
          {
            logic: 'AND',
            rules: [
              { field: 'currentPrice', operator: '<=', value: 1500 },
              { field: 'temperature', operator: '>=', value: 100 },
            ],
          } as FilterRuleGroup,
          { field: 'freeShipping', operator: 'IS_TRUE', value: true },
        ],
        matchLogic: 'OR',
      };

      const result = service.evaluateFilterExpression(
        expression,
        mockDealabsArticle,
      );
      expect(result).toBe(true);
    });

    it('should return true for empty rule groups', async () => {
      const expression: RuleBasedFilterExpression = {
        rules: [
          {
            logic: 'AND',
            rules: [],
          } as FilterRuleGroup,
        ],
        matchLogic: 'AND',
      };

      const result = service.evaluateFilterExpression(
        expression,
        mockDealabsArticle,
      );
      expect(result).toBe(true);
    });

    it('should return false when no rules exist in expression', async () => {
      const expression: RuleBasedFilterExpression = {
        rules: [],
        matchLogic: 'AND',
      };

      const result = service.evaluateFilterExpression(
        expression,
        mockDealabsArticle,
      );
      expect(result).toBe(false);
    });
  });

  describe('Scoring Logic', () => {
    it('should calculate weighted score and match when above threshold', async () => {
      const expression: RuleBasedFilterExpression = {
        rules: [
          { field: 'currentPrice', operator: '<=', value: 1500, weight: 2.0 }, // Passes
          { field: 'temperature', operator: '>=', value: 100, weight: 3.0 }, // Passes
          { field: 'freeShipping', operator: 'IS_TRUE', value: true, weight: 1.0 }, // Passes
        ],
        minScore: 5.0,
        scoreMode: 'weighted',
        matchLogic: 'AND',
      };

      const result = service.evaluateFilterExpression(
        expression,
        mockDealabsArticle,
      );
      // Total score: 2.0 + 3.0 + 1.0 = 6.0, threshold is 5.0
      expect(result).toBe(true);
    });

    it('should not match when weighted score below threshold', async () => {
      const expression: RuleBasedFilterExpression = {
        rules: [
          { field: 'currentPrice', operator: '<=', value: 1500, weight: 1.0 }, // Passes
          { field: 'temperature', operator: '>=', value: 200, weight: 3.0 }, // Fails
        ],
        minScore: 3.0,
        scoreMode: 'weighted',
        matchLogic: 'AND',
      };

      const result = service.evaluateFilterExpression(
        expression,
        mockDealabsArticle,
      );
      // Total score: 1.0 (only first rule passes), threshold is 3.0
      expect(result).toBe(false);
    });

    it('should calculate percentage score correctly', async () => {
      const expression: RuleBasedFilterExpression = {
        rules: [
          { field: 'currentPrice', operator: '<=', value: 1500, weight: 1.0 }, // Passes
          { field: 'temperature', operator: '>=', value: 100, weight: 1.0 }, // Passes
          { field: 'freeShipping', operator: 'IS_TRUE', value: true, weight: 1.0 }, // Passes
          { field: 'isCoupon', operator: 'IS_TRUE', value: true, weight: 1.0 }, // Fails
        ],
        minScore: 70, // 70%
        scoreMode: 'percentage',
        matchLogic: 'AND',
      };

      const result = service.evaluateFilterExpression(
        expression,
        mockDealabsArticle,
      );
      // Earned: 3.0, Total: 4.0 = 75% >= 70%
      expect(result).toBe(true);
    });

    it('should not match when percentage score below threshold', async () => {
      const expression: RuleBasedFilterExpression = {
        rules: [
          { field: 'currentPrice', operator: '<=', value: 1500, weight: 1.0 }, // Passes
          { field: 'temperature', operator: '>=', value: 200, weight: 1.0 }, // Fails
          { field: 'freeShipping', operator: 'IS_TRUE', value: true, weight: 1.0 }, // Passes
          { field: 'isCoupon', operator: 'IS_TRUE', value: true, weight: 1.0 }, // Fails
        ],
        minScore: 60, // 60%
        scoreMode: 'percentage',
        matchLogic: 'AND',
      };

      const result = service.evaluateFilterExpression(
        expression,
        mockDealabsArticle,
      );
      // Earned: 2.0, Total: 4.0 = 50% < 60%
      expect(result).toBe(false);
    });

    it('should calculate points score (same as weighted)', async () => {
      const expression: RuleBasedFilterExpression = {
        rules: [
          { field: 'currentPrice', operator: '<=', value: 1500, weight: 10 }, // Passes
          { field: 'temperature', operator: '>=', value: 100, weight: 5 }, // Passes
        ],
        minScore: 12,
        scoreMode: 'points',
        matchLogic: 'AND',
      };

      const result = service.evaluateFilterExpression(
        expression,
        mockDealabsArticle,
      );
      // Points: 10 + 5 = 15 >= 12
      expect(result).toBe(true);
    });

    it('should default weight to 1.0 when not specified', async () => {
      const expression: RuleBasedFilterExpression = {
        rules: [
          { field: 'currentPrice', operator: '<=', value: 1500 }, // No weight
          { field: 'temperature', operator: '>=', value: 100 }, // No weight
        ],
        minScore: 1.5,
        scoreMode: 'weighted',
        matchLogic: 'AND',
      };

      const result = service.evaluateFilterExpression(
        expression,
        mockDealabsArticle,
      );
      // Default weight 1.0 each: 1.0 + 1.0 = 2.0 >= 1.5
      expect(result).toBe(true);
    });

    it('should handle partial matches with scoring', async () => {
      const expression: RuleBasedFilterExpression = {
        rules: [
          { field: 'currentPrice', operator: '<=', value: 1500, weight: 2.0 }, // Passes
          { field: 'temperature', operator: '>=', value: 200, weight: 1.0 }, // Fails
          { field: 'freeShipping', operator: 'IS_TRUE', value: true, weight: 2.0 }, // Passes
        ],
        minScore: 3.0,
        scoreMode: 'weighted',
        matchLogic: 'AND',
      };

      const result = service.evaluateFilterExpression(
        expression,
        mockDealabsArticle,
      );
      // Earned: 2.0 + 2.0 = 4.0 >= 3.0
      expect(result).toBe(true);
    });

    it('should skip scoring when minScore is 0 or undefined', async () => {
      const expression: RuleBasedFilterExpression = {
        rules: [
          { field: 'currentPrice', operator: '<=', value: 1500, weight: 1.0 },
          { field: 'temperature', operator: '>=', value: 100, weight: 1.0 },
        ],
        minScore: 0,
        scoreMode: 'weighted',
        matchLogic: 'AND',
      };

      const result = service.evaluateFilterExpression(
        expression,
        mockDealabsArticle,
      );
      // Should use boolean evaluation (AND logic) instead of scoring
      expect(result).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle null field values gracefully', async () => {
      const articleWithNull = new ArticleWrapper(
        {
          ...mockDealabsArticle.base,
          description: null,
        } as Article,
        mockDealabsArticle.extension,
        SiteSource.DEALABS,
      );

      const result = service.evaluateRule(
        {
          field: 'description',
          operator: 'CONTAINS',
          value: 'test',
          caseSensitive: false,
        },
        articleWithNull,
      );
      expect(result).toBe(false);
    });

    it('should handle undefined field values', async () => {
      const result = service.evaluateRule(
        {
          field: 'nonExistentField' as FilterRule['field'],
          operator: '=',
          value: 'test',
        },
        mockDealabsArticle,
      );
      expect(result).toBe(false);
    });

    it('should handle case-insensitive matching by default', async () => {
      const result = service.evaluateRule(
        {
          field: 'title',
          operator: 'CONTAINS',
          value: 'GAMING',
          // caseSensitive not specified, defaults to false
        },
        mockDealabsArticle,
      );
      expect(result).toBe(true);
    });

    it('should log error and continue when filter evaluation fails', async () => {
      // Arrange - filter with invalid expression structure
      const badFilter: MockFilterWithCategories = {
        id: 'bad-filter',
        name: 'Bad Filter',
        userId: 'user-1',
        enabledSites: ['dealabs'],
        active: true,
        filterExpression: null as unknown as RuleBasedFilterExpression, // Invalid
      };

      mockPrisma.filter.findMany.mockResolvedValue([badFilter]);

      // Act - should not throw, should log error and return empty array
      const matches = await service.matchArticle(mockDealabsArticle);

      // Assert
      expect(matches).toHaveLength(0);
    });

    it('should handle unknown field names gracefully', async () => {
      const result = service.evaluateRule(
        {
          field: 'unknownField' as FilterRule['field'],
          operator: '=',
          value: 'test',
        },
        mockDealabsArticle,
      );
      expect(result).toBe(false);
    });

    it('should handle computed field: age', async () => {
      // age is computed as hours since scrapedAt
      const result = service.evaluateRule(
        {
          field: 'age',
          operator: '>=',
          value: 0,
        },
        mockDealabsArticle,
      );
      expect(result).toBe(true);
    });

    it('should handle computed field: discountPercent', async () => {
      // discountPercent computed from originalPrice/currentPrice
      const result = service.evaluateRule(
        {
          field: 'discountPercent',
          operator: '>=',
          value: 20,
        },
        mockDealabsArticle,
      );
      expect(result).toBe(true); // (1600-1200)/1600 * 100 = 25%
    });

    it('should handle alias field: heat (alias for temperature)', async () => {
      const result = service.evaluateRule(
        {
          field: 'heat',
          operator: '>=',
          value: 100,
        },
        mockDealabsArticle,
      );
      expect(result).toBe(true);
    });

    it('should handle alias field: price (alias for currentPrice)', async () => {
      const result = service.evaluateRule(
        {
          field: 'price',
          operator: '<=',
          value: 1500,
        },
        mockDealabsArticle,
      );
      expect(result).toBe(true);
    });

    it('should return null for site-specific alias on wrong site', async () => {
      // temperature doesn't exist on Vinted, heat should return null
      const result = service.evaluateRule(
        {
          field: 'heat',
          operator: '>=',
          value: 100,
        },
        mockVintedArticle,
      );
      expect(result).toBe(false); // null fails numeric comparison
    });
  });
});
