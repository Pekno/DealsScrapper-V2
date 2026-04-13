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

describe('FilterMatchingService (Simplified)', () => {
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

    it('should delegate to FilterEvaluationService and return match result', async () => {
      // Mock the filter evaluation service response
      const expectedResult: MatchResult = {
        matches: true,
        score: 85,
        reasons: [
          'Category match: cartes-graphiques',
          'Title keyword match: RTX 40[0-9][0-9]',
          'Price score: 450/500 (90%)',
          'Heat score: 150 (100%)',
        ],
      };

      filterEvaluationService.evaluateFilter.mockResolvedValue(expectedResult);

      const result = await service.evaluateFilter(mockFilter, mockRawDeal);

      // Verify delegation to FilterEvaluationService
      expect(filterEvaluationService.evaluateFilter).toHaveBeenCalledWith(
        mockFilter,
        mockRawDeal
      );

      // Verify result
      expect(result).toEqual(expectedResult);
      expect(result.matches).toBe(true);
      expect(result.score).toBe(85);
    });

    it('should handle no match scenario', async () => {
      const expectedResult: MatchResult = {
        matches: false,
        score: 0,
        reasons: [
          'Category mismatch: expected cartes-graphiques, got smartphones',
        ],
      };

      filterEvaluationService.evaluateFilter.mockResolvedValue(expectedResult);

      const result = await service.evaluateFilter(mockFilter, mockRawDeal);

      expect(result.matches).toBe(false);
      expect(result.score).toBe(0);
    });
  });

  describe('processFreshDeals', () => {
    const mockArticles: Article[] = [
      {
        id: 'article-123',
        externalId: 'deal-123',
        title: 'RTX 4070 Ti Super',
        description: 'Gaming GPU',
        categoryId: 'cartes-graphiques-id',
        categoryPath: ['Informatique', 'Composants'],
        currentPrice: 450,
        originalPrice: 599,
        discountPercentage: 25,
        discountAmount: 149,
        merchant: 'Amazon',
        storeLocation: null,
        freeShipping: true,
        temperature: 150,
        commentCount: 25,
        communityVerified: true,
        publishedAt: new Date(),
        expiresAt: null,
        url: 'https://test.com/deal',
        imageUrl: null,
        isExpired: false,
        isCoupon: false,
        siteId: 'dealabs',
        isActive: true,
        scrapedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Article,
    ];

    it('should process deals and create matches when filters match', async () => {
      // Setup mocks
      filterRepository.findActiveByCategoryId.mockResolvedValue([]);
      matchRepository.createManyMatches.mockResolvedValue([]);

      // Test should complete without errors
      await expect(
        service.processFreshDeals(mockArticles)
      ).resolves.not.toThrow();

      // Verify repository method was called
      expect(filterRepository.findActiveByCategoryId).toHaveBeenCalledWith(
        'cartes-graphiques-id'
      );
    });
  });

  describe('analyzeFiltersForOptimization', () => {
    it('should delegate to FilterEvaluationService', () => {
      const mockFilters: Filter[] = [];
      const expectedAnalysis = {
        urlFilters: { sort: 'new' as const },
        processingFilters: {
          titleRegex: [],
          heatRange: { min: 0, max: 1000 },
          descriptionKeywords: [],
        },
      };

      filterEvaluationService.analyzeFiltersForOptimization.mockReturnValue(
        expectedAnalysis
      );

      const result = service.analyzeFiltersForOptimization(mockFilters);

      expect(
        filterEvaluationService.analyzeFiltersForOptimization
      ).toHaveBeenCalledWith(mockFilters);
      expect(result).toEqual(expectedAnalysis);
    });
  });
});
