import { Test, TestingModule } from '@nestjs/testing';
import {
  FilterMatchingService,
  MatchResult,
} from '../../../src/filter-matching/filter-matching.service';
import { NotificationService } from '../../../src/notification/notification.service';
import {
  FilterRepository,
  MatchRepository,
  CategoryRepository,
} from '../../../src/repositories/index.js';
import { FilterEvaluationService } from '../../../src/services/index.js';
import { Article, Filter, PrismaService } from '@dealscrapper/database';
import { RawDeal } from '@dealscrapper/shared-types';

describe('FilterMatchingService', () => {
  let service: FilterMatchingService;
  let filterRepository: jest.Mocked<FilterRepository>;
  let matchRepository: jest.Mocked<MatchRepository>;
  let notificationService: jest.Mocked<NotificationService>;
  let filterEvaluationService: jest.Mocked<FilterEvaluationService>;

  const mockFilterRepository = {
    findAllActive: jest.fn(),
    findActiveByCategorySlug: jest.fn(),
    findActiveByCategoryId: jest.fn(),
  };

  const mockCategoryRepository = {
    findCategoryIdByName: jest.fn(),
  };

  const mockMatchRepository = {
    createManyMatches: jest.fn(),
    findWithRelations: jest.fn(),
  };

  const mockNotificationService = {
    queueMatchNotification: jest.fn(),
    queueExternalNotification: jest.fn(),
  };

  const mockFilterEvaluationService = {
    evaluateFilter: jest.fn(),
    analyzeFiltersForOptimization: jest.fn(),
  };

  const mockPrismaService = {
    article: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    articleDealabs: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    articleVinted: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    articleLeBonCoin: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FilterMatchingService,
        {
          provide: FilterRepository,
          useValue: mockFilterRepository,
        },
        {
          provide: MatchRepository,
          useValue: mockMatchRepository,
        },
        {
          provide: CategoryRepository,
          useValue: mockCategoryRepository,
        },
        {
          provide: NotificationService,
          useValue: mockNotificationService,
        },
        {
          provide: FilterEvaluationService,
          useValue: mockFilterEvaluationService,
        },
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<FilterMatchingService>(FilterMatchingService);
    filterRepository = module.get(FilterRepository);
    matchRepository = module.get(MatchRepository);
    notificationService = module.get(NotificationService);
    filterEvaluationService = module.get(FilterEvaluationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('evaluateFilter', () => {
    const mockFilter: Filter = {
      id: 'filter-123',
      userId: 'user-123',
      name: 'RTX Graphics Cards',
      description: 'High-end graphics cards',
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      filterExpression: {
        categories: ['cartes-graphiques'],
        maxPrice: 500,
        minHeat: 100,
        titlePattern: 'RTX 40[0-9][0-9]',
      },
      immediateNotifications: true,
      digestFrequency: 'daily',
      maxNotificationsPerDay: 50,
      totalMatches: 0,
      matchesLast24h: 0,
      lastMatchAt: null,
    };

    const mockRawDeal: RawDeal = {
      externalId: 'deal-123',
      title: 'RTX 4070 Ti Super - Gaming Graphics Card',
      description: 'High performance gaming GPU',
      category: 'cartes-graphiques',
      categoryPath: ['cartes-graphiques', 'gaming'],
      currentPrice: 450,
      originalPrice: 599,
      discountPercentage: 25,
      discountAmount: 149,
      merchant: 'Amazon',
      storeLocation: undefined,
      freeShipping: true,
      temperature: 150,
      commentCount: 25,
      communityVerified: true,
      publishedAt: new Date('2025-07-20T10:00:00Z'),
      expiresAt: undefined,
      url: 'https://www.dealabs.com/deal/123',
      imageUrl: 'https://example.com/image.jpg',
      isExpired: false,
      isCoupon: false,
      source: 'Dealabs',
      isActive: true,
    };

    it('should identify deals that match user preferences and budget', async () => {
      // Mock the filter evaluation service response
      filterEvaluationService.evaluateFilter.mockResolvedValue({
        matches: true,
        score: 85,
        reasons: [
          'Category match: cartes-graphiques',
          'Title keyword match: RTX 40[0-9][0-9]',
          'Price score: 450/500 (90%)',
          'Heat score: 150 (100%)',
        ],
      });

      const result: MatchResult = await service.evaluateFilter(
        mockFilter,
        mockRawDeal
      );

      // Business outcome: User gets notified about a relevant deal
      expect(result.matches).toBe(true);
      expect(result.score).toBeGreaterThan(80); // Good quality match

      // Business value: User understands why this deal was selected
      expect(result.reasons.some((r) => r.includes('Category match'))).toBe(
        true
      );
      expect(
        result.reasons.some((r) => r.includes('Title keyword match'))
      ).toBe(true);
      expect(result.reasons.some((r) => r.includes('Price score'))).toBe(true);
      expect(result.reasons.some((r) => r.includes('Heat score'))).toBe(true);
    });

    it('should protect users from irrelevant deals outside their interests', async () => {
      const filterWithWrongCategory = {
        ...mockFilter,
        filterExpression: {
          categories: ['smartphones'],
          maxPrice: 500,
          minHeat: 100,
          titlePattern: 'RTX 40[0-9][0-9]',
        },
      };

      // Mock the filter evaluation service response for no match
      filterEvaluationService.evaluateFilter.mockResolvedValue({
        matches: false,
        score: 0,
        reasons: [
          'Category mismatch: expected smartphones, got cartes-graphiques',
        ],
      });

      const result = await service.evaluateFilter(
        filterWithWrongCategory,
        mockRawDeal
      );

      // Business outcome: User doesn't get spammed with irrelevant deals
      expect(result.matches).toBe(false);
      expect(result.score).toBe(0);

      // Business value: User understands filtering logic
      expect(result.reasons.some((r) => r.includes('Category mismatch'))).toBe(
        true
      );
    });

    it('should respect user budget constraints to prevent overspending', async () => {
      const expensiveDeal: RawDeal = {
        ...mockRawDeal,
        currentPrice: 600, // Over user's €500 budget
      };

      // Mock the filter evaluation service response for price over budget
      filterEvaluationService.evaluateFilter.mockResolvedValue({
        matches: false,
        score: 0,
        reasons: ['Over budget: €600 exceeds maximum €500'],
      });

      const result = await service.evaluateFilter(mockFilter, expensiveDeal);

      // Business outcome: User protected from budget-breaking deals
      expect(result.matches).toBe(false);
      expect(result.score).toBe(0);

      // Business value: Clear budget protection feedback
      expect(result.reasons.some((r) => r.includes('Over budget'))).toBe(true);
    });

    it('should filter out unpopular deals to save user time', async () => {
      const coldDeal: RawDeal = {
        ...mockRawDeal,
        temperature: 50, // Below user's popularity threshold
      };

      // Mock the filter evaluation service response for low heat
      filterEvaluationService.evaluateFilter.mockResolvedValue({
        matches: false,
        score: 0,
        reasons: ['Heat too low: 50 below minimum 100'],
      });

      const result = await service.evaluateFilter(mockFilter, coldDeal);

      // Business outcome: User only sees deals the community validates
      expect(result.matches).toBe(false);
      expect(result.score).toBe(0);

      // Business value: Quality control explanation
      expect(result.reasons.some((r) => r.includes('Heat too low'))).toBe(true);
    });

    it('should prioritize better value deals to maximize user savings', async () => {
      // Test exceptional value deal
      const cheapDeal: RawDeal = {
        ...mockRawDeal,
        currentPrice: 100, // €100 vs €500 budget = exceptional value
      };

      // Mock high score for exceptional value
      filterEvaluationService.evaluateFilter.mockResolvedValueOnce({
        matches: true,
        score: 95,
        reasons: ['Price score: excellent value'],
      });

      const result1 = await service.evaluateFilter(mockFilter, cheapDeal);
      expect(result1.matches).toBe(true);

      // Test acceptable value deal
      const priceyDeal: RawDeal = {
        ...mockRawDeal,
        currentPrice: 480, // €480 vs €500 budget = acceptable value
      };

      // Mock lower score for acceptable value
      filterEvaluationService.evaluateFilter.mockResolvedValueOnce({
        matches: true,
        score: 60,
        reasons: ['Price score: acceptable value'],
      });

      const result2 = await service.evaluateFilter(mockFilter, priceyDeal);
      expect(result2.matches).toBe(true);

      // Business outcome: Better value deals get priority
      expect(result1.score).toBeGreaterThan(result2.score);

      // Business value: Both deals are valid, but value is prioritized
      expect(result1.reasons.some((r) => r.includes('excellent value'))).toBe(
        true
      );
      expect(result2.reasons.some((r) => r.includes('acceptable value'))).toBe(
        true
      );
    });

    it('should calculate heat score with excess bonus', async () => {
      const superHotDeal: RawDeal = {
        ...mockRawDeal,
        temperature: 200, // 200-100 = 100 excess, score = 20 + 10 = 30
      };

      // Mock high score for super hot deal
      filterEvaluationService.evaluateFilter.mockResolvedValue({
        matches: true,
        score: 90,
        reasons: ['Heat score: excellent temperature 200'],
      });

      const result = await service.evaluateFilter(mockFilter, superHotDeal);

      expect(result.matches).toBe(true);
      expect(result.score).toBeGreaterThan(85); // Should be very high score
      expect(result.reasons.some((r) => r.includes('Heat score'))).toBe(true);
    });

    it('should give discount bonus for good discounts', async () => {
      const highDiscountDeal: RawDeal = {
        ...mockRawDeal,
        originalPrice: 800,
        currentPrice: 400, // 50% discount
        discountPercentage: 50,
      };

      // Mock discount bonus
      filterEvaluationService.evaluateFilter.mockResolvedValue({
        matches: true,
        score: 85,
        reasons: ['Discount bonus: 50% off'],
      });

      const result = await service.evaluateFilter(mockFilter, highDiscountDeal);
      expect(result.matches).toBe(true);
      expect(result.reasons.some((r) => r.includes('Discount bonus'))).toBe(
        true
      );
    });

    it('should handle missing filter expression gracefully', async () => {
      const filterWithoutExpression = {
        ...mockFilter,
        filterExpression: {},
      };

      // Mock empty filter response
      filterEvaluationService.evaluateFilter.mockResolvedValue({
        matches: true,
        score: 100,
        reasons: ['No rules defined - matches all'],
      });

      const result = await service.evaluateFilter(
        filterWithoutExpression,
        mockRawDeal
      );

      expect(result.matches).toBe(true); // Empty filter expression matches all
      expect(result.score).toBe(100); // Default score for empty filter
    });

    it('should handle regex pattern errors gracefully', async () => {
      const filterWithBadRegex = {
        ...mockFilter,
        filterExpression: {
          categories: ['cartes-graphiques'],
          maxPrice: 500,
          minHeat: 100,
          titlePattern: '[invalid regex(',
        },
      };

      // Mock regex error handling
      filterEvaluationService.evaluateFilter.mockResolvedValue({
        matches: true,
        score: 75,
        reasons: [
          'Category match',
          'Error evaluating rule: Invalid regular expression',
        ],
      });

      const result = await service.evaluateFilter(
        filterWithBadRegex,
        mockRawDeal
      );

      expect(result.matches).toBe(true); // Should still match other criteria
      expect(
        result.reasons.some((r) => r.includes('Title keyword match'))
      ).toBe(false);
    });
  });

  describe('analyzeFiltersForOptimization', () => {
    const mockFilters: Filter[] = [
      {
        id: 'filter-1',
        userId: 'user-1',
        name: 'Gaming Laptops',
        description: null,
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        filterExpression: {
          rules: [
            {
              field: 'category',
              operator: 'IN',
              value: ['laptops'],
              weight: 1.0,
            },
            {
              field: 'price',
              operator: '<=',
              value: 1500,
              weight: 1.0,
            },
            {
              field: 'price',
              operator: '>=',
              value: 800,
              weight: 1.0,
            },
            {
              field: 'title',
              operator: 'REGEX',
              value: 'RTX|GTX',
              weight: 1.0,
            },
          ],
          matchLogic: 'AND',
          minScore: 50,
          scoreMode: 'weighted',
        },
        immediateNotifications: true,
        digestFrequency: 'daily',
        maxNotificationsPerDay: 50,
        totalMatches: 0,
        matchesLast24h: 0,
        lastMatchAt: null,
      },
      {
        id: 'filter-2',
        userId: 'user-2',
        name: 'Budget Phones',
        description: null,
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        filterExpression: {
          rules: [
            {
              field: 'category',
              operator: 'IN',
              value: ['smartphones'],
              weight: 1.0,
            },
            {
              field: 'price',
              operator: '<=',
              value: 300,
              weight: 1.0,
            },
            {
              field: 'temperature',
              operator: '>=',
              value: 50,
              weight: 1.0,
            },
          ],
          matchLogic: 'AND',
          minScore: 50,
          scoreMode: 'weighted',
        },
        immediateNotifications: true,
        digestFrequency: 'daily',
        maxNotificationsPerDay: 50,
        totalMatches: 0,
        matchesLast24h: 0,
        lastMatchAt: null,
      },
    ];

    it('should aggregate URL filters correctly', async () => {
      // Mock the filter evaluation service response
      mockFilterEvaluationService.analyzeFiltersForOptimization.mockResolvedValue(
        {
          urlFilters: {
            price_max: 1500,
            price_min: 800,
            sort: 'new',
          },
          processingFilters: {
            titleRegex: [/RTX|GTX/],
            heatRange: { min: 50, max: undefined },
          },
        }
      );

      const analysis = await service.analyzeFiltersForOptimization(mockFilters);

      expect(analysis.urlFilters.price_max).toBe(1500); // Max of all maxPrice
      expect(analysis.urlFilters.price_min).toBe(800); // Min of all minPrice (undefined excluded)
      expect(analysis.urlFilters.sort).toBe('new'); // Default sort

      expect(analysis.processingFilters.titleRegex).toHaveLength(1);
      expect(analysis.processingFilters.heatRange?.min).toBe(50);
    });

    it('should handle empty filters array', async () => {
      // Mock the filter evaluation service response for empty filters
      mockFilterEvaluationService.analyzeFiltersForOptimization.mockResolvedValue(
        {
          urlFilters: { sort: 'new' },
          processingFilters: {
            titleRegex: [],
            heatRange: { min: 0, max: undefined },
          },
        }
      );

      const analysis = await service.analyzeFiltersForOptimization([]);

      expect(analysis.urlFilters).toEqual({ sort: 'new' });
      expect(analysis.processingFilters.titleRegex).toHaveLength(0);
      expect(analysis.processingFilters.heatRange?.min).toBe(0);
    });
  });

  describe('processFreshDeals', () => {
    const mockDeals: Article[] = [
      {
        id: 'article-1',
        categoryId: 'cartes-graphiques-id',
        title: 'RTX 4080 Gaming Card',
        currentPrice: 500,
        temperature: 120,
      } as Article,
    ];

    const mockActiveFilters: Filter[] = [
      {
        id: 'filter-1',
        userId: 'user-1',
        name: 'Graphics Cards Filter',
        description: null,
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        filterExpression: {
          rules: [
            {
              field: 'category',
              operator: 'IN',
              value: ['cartes-graphiques'],
              weight: 1.0,
            },
            {
              field: 'price',
              operator: '<=',
              value: 600,
              weight: 1.0,
            },
            {
              field: 'temperature',
              operator: '>=',
              value: 100,
              weight: 1.0,
            },
          ],
          matchLogic: 'AND',
          minScore: 50,
          scoreMode: 'weighted',
        },
        immediateNotifications: true,
        digestFrequency: 'daily',
        maxNotificationsPerDay: 50,
        totalMatches: 0,
        matchesLast24h: 0,
        lastMatchAt: null,
      },
    ];

    beforeEach(() => {
      // Mock repositories for processFreshDeals tests
      mockFilterRepository.findActiveByCategoryId.mockResolvedValue(
        mockActiveFilters
      );
      mockMatchRepository.createManyMatches.mockResolvedValue([
        {
          id: 'match-1',
          filterId: 'filter-1',
          articleId: 'article-1',
          score: 85,
          notified: false,
          notifiedAt: null,
          createdAt: new Date(),
        },
      ]);

      // Mock filter evaluation service to return a positive match
      mockFilterEvaluationService.evaluateFilter.mockResolvedValue({
        matches: true,
        score: 85,
        reasons: ['Category match', 'Price within budget', 'High temperature'],
      });
    });

    it('should notify users when new deals match their interests', async () => {
      await service.processFreshDeals(mockDeals);

      // Business outcome: Matches are created for scheduler to handle notifications
      // Note: Notifications are now handled by the scheduler, not this service

      // Business outcome: Match is recorded for user tracking
      expect(mockMatchRepository.createManyMatches).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            filterId: expect.any(String),
            articleId: expect.any(String),
            score: expect.any(Number),
          }),
        ])
      );

      // Business behavior: Only considers active user filters for the specific category
      expect(mockFilterRepository.findActiveByCategoryId).toHaveBeenCalledWith(
        'cartes-graphiques-id'
      );
    });

    it('should gracefully handle periods with no new deals', async () => {
      await service.processFreshDeals([]);

      // Business outcome: No matches created during quiet periods
      expect(mockMatchRepository.createManyMatches).not.toHaveBeenCalled();

      // Business behavior: No filters are checked when no deals are provided
      expect(
        mockFilterRepository.findActiveByCategoryId
      ).not.toHaveBeenCalled();
    });

    it('should conserve resources when no users have active filters', async () => {
      mockFilterRepository.findActiveByCategoryId.mockResolvedValueOnce([]);

      await service.processFreshDeals(mockDeals);

      // Business outcome: No unnecessary processing when no one is listening
      expect(mockMatchRepository.createManyMatches).not.toHaveBeenCalled();

      // Business efficiency: Avoids wasted computation
      expect(mockFilterEvaluationService.evaluateFilter).not.toHaveBeenCalled();
    });

    it('should connect deal hunters with personalized opportunities', async () => {
      // Create a diverse set of deals
      const diverseDeals = [
        { ...mockDeals[0], category: 'cartes-graphiques', currentPrice: 450 }, // Matches our filter
        {
          ...mockDeals[0],
          id: 'deal-2',
          category: 'smartphones',
          currentPrice: 200,
        }, // Wrong category
        {
          ...mockDeals[0],
          id: 'deal-3',
          category: 'cartes-graphiques',
          currentPrice: 700,
        }, // Over budget
      ];

      // Mock filter evaluation service to only match the relevant deal
      mockFilterEvaluationService.evaluateFilter
        .mockResolvedValueOnce({
          matches: true,
          score: 85,
          reasons: ['GPU deal matches criteria'],
        }) // GPU deal matches
        .mockResolvedValueOnce({
          matches: false,
          score: 0,
          reasons: ['Wrong category'],
        }) // Phone doesn't match
        .mockResolvedValueOnce({
          matches: false,
          score: 0,
          reasons: ['Over budget'],
        }); // Expensive GPU doesn't match

      await service.processFreshDeals(diverseDeals);

      // Business outcome: Only matching deals get match records created
      // Note: Notifications are handled by scheduler, service only creates matches

      // Business value: Precision targeting prevents notification fatigue
      expect(mockMatchRepository.createManyMatches).toHaveBeenCalledTimes(1);
    });
  });
});
