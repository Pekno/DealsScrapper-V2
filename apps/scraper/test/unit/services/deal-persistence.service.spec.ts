import { Test, TestingModule } from '@nestjs/testing';
import { DealPersistenceService } from '../../../src/services/deal-persistence.service';
import { ArticleRepository } from '../../../src/repositories/article.repository';
import { FilterRepository } from '../../../src/repositories/filter.repository';
import { CategoryRepository } from '../../../src/repositories/category.repository';
import { FilterEvaluationService } from '../../../src/services/filter-evaluation.service';
import { DealElasticSearchService } from '../../../src/elasticsearch/services/deal-elasticsearch.service';
import type { ISiteAdapter } from '../../../src/adapters/base/site-adapter.interface';

describe('DealPersistenceService - Hidden Expired Deals Detection', () => {
  let service: DealPersistenceService;
  let mockArticleRepository: jest.Mocked<ArticleRepository>;
  let mockFilterRepository: jest.Mocked<FilterRepository>;
  let mockCategoryRepository: jest.Mocked<CategoryRepository>;
  let mockFilterEvaluationService: jest.Mocked<FilterEvaluationService>;
  let mockDealElasticSearchService: jest.Mocked<DealElasticSearchService>;
  let mockAdapter: jest.Mocked<ISiteAdapter>;

  beforeEach(async () => {
    // Create comprehensive mocks for all dependencies
    mockArticleRepository = {
      findMany: jest.fn(),
      updateMany: jest.fn(),
      existsByExternalId: jest.fn(),
      findByExternalId: jest.fn(),
      createFromRawDeal: jest.fn(),
      upsertFromRawDeal: jest.fn(),
      createManyFromRawDeals: jest.fn(),
      upsertManyFromRawDeals: jest.fn(),
      checkExistenceByExternalIds: jest.fn(),
      findRecent: jest.fn(),
    } as any;

    mockFilterRepository = {
      findActiveByCategorySlug: jest.fn(),
      findActiveByCategoryId: jest.fn(),
    } as any;

    mockCategoryRepository = {
      findCategoryIdByName: jest.fn(),
      findCategoryIdBySlug: jest.fn(),
    } as any;

    mockFilterEvaluationService = {
      evaluateFilter: jest.fn(),
      findMatchingDeals: jest.fn(),
    } as any;

    mockDealElasticSearchService = {
      processBatchedDeals: jest.fn(),
      checkExistingDeals: jest.fn(),
    } as any;

    mockAdapter = {
      expiryResolver: undefined,
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DealPersistenceService,
        {
          provide: ArticleRepository,
          useValue: mockArticleRepository,
        },
        {
          provide: FilterRepository,
          useValue: mockFilterRepository,
        },
        {
          provide: CategoryRepository,
          useValue: mockCategoryRepository,
        },
        {
          provide: FilterEvaluationService,
          useValue: mockFilterEvaluationService,
        },
        {
          provide: DealElasticSearchService,
          useValue: mockDealElasticSearchService,
        },
      ],
    }).compile();

    service = module.get<DealPersistenceService>(DealPersistenceService);
  });

  describe('markHiddenExpiredDeals', () => {
    it('should mark articles as expired when they are no longer on the page', async () => {
      // Arrange
      const categorySlug = 'gaming';
      const categoryId = 'test-category-id';
      const extractedExternalIds = new Set(['deal1', 'deal2', 'deal3']);

      // Mock category resolution
      mockCategoryRepository.findCategoryIdBySlug.mockResolvedValue(categoryId);

      // Mock existing articles (some visible, some hidden)
      const existingArticles = [
        { externalId: 'deal1', isActive: true, categoryId: categoryId }, // Still visible
        { externalId: 'deal2', isActive: true, categoryId: categoryId }, // Still visible
        { externalId: 'deal4', isActive: true, categoryId: categoryId }, // Hidden (not in extracted IDs)
        { externalId: 'deal5', isActive: true, categoryId: categoryId }, // Hidden (not in extracted IDs)
      ];

      mockArticleRepository.findMany.mockResolvedValue(existingArticles as any);
      mockArticleRepository.updateMany.mockResolvedValue(2); // 2 articles updated

      // Act
      const result = await service.markHiddenExpiredDeals(
        categorySlug,
        extractedExternalIds,
        mockAdapter,
      );

      // Assert
      expect(result).toBe(2);

      // Verify category resolution was called
      expect(mockCategoryRepository.findCategoryIdBySlug).toHaveBeenCalledWith(
        categorySlug
      );

      // Verify findMany was called with correct parameters
      expect(mockArticleRepository.findMany).toHaveBeenCalledWith({
        categoryId: categoryId,
        isActive: true,
      });

      // Verify updateMany was called to mark hidden articles as expired (no expiryResolver → bulk update)
      expect(mockArticleRepository.updateMany).toHaveBeenCalledWith(
        { externalId: { in: ['deal4', 'deal5'] } },
        expect.objectContaining({ isActive: false, isExpired: true }),
      );
    });

    it('should return 0 when no articles are hidden', async () => {
      // Arrange
      const categorySlug = 'smartphones';
      const categoryId = 'smartphones-category-id';
      const extractedExternalIds = new Set(['deal1', 'deal2']);

      // Mock category resolution
      mockCategoryRepository.findCategoryIdBySlug.mockResolvedValue(categoryId);

      // All existing articles are still visible
      const existingArticles = [
        { externalId: 'deal1', isActive: true, categoryId: categoryId },
        { externalId: 'deal2', isActive: true, categoryId: categoryId },
      ];

      mockArticleRepository.findMany.mockResolvedValue(existingArticles as any);

      // Act
      const result = await service.markHiddenExpiredDeals(
        categorySlug,
        extractedExternalIds,
        mockAdapter,
      );

      // Assert
      expect(result).toBe(0);
      expect(mockCategoryRepository.findCategoryIdBySlug).toHaveBeenCalledWith(
        categorySlug
      );
      expect(mockArticleRepository.updateMany).not.toHaveBeenCalled();
    });

    it('should return 0 when no active articles exist', async () => {
      // Arrange
      const categorySlug = 'high-tech';
      const categoryId = 'high-tech-category-id';
      const extractedExternalIds = new Set(['deal1', 'deal2']);

      // Mock category resolution
      mockCategoryRepository.findCategoryIdBySlug.mockResolvedValue(categoryId);
      mockArticleRepository.findMany.mockResolvedValue([]); // No articles found

      // Act
      const result = await service.markHiddenExpiredDeals(
        categorySlug,
        extractedExternalIds,
        mockAdapter,
      );

      // Assert
      expect(result).toBe(0);
      expect(mockCategoryRepository.findCategoryIdBySlug).toHaveBeenCalledWith(
        categorySlug
      );
      expect(mockArticleRepository.updateMany).not.toHaveBeenCalled();
    });

    it('should resolve category IDs from slugs correctly', async () => {
      // Arrange
      const testCases = [
        { slug: 'accessoires-gaming', categoryId: 'accessoires-gaming-id' },
        { slug: 'smartphones', categoryId: 'smartphones-id' },
        { slug: 'high-tech', categoryId: 'high-tech-id' },
        { slug: 'consoles-jeux-video', categoryId: 'consoles-jeux-video-id' },
        { slug: 'unknown-category', categoryId: 'unknown-category-id' },
      ];

      for (const testCase of testCases) {
        mockCategoryRepository.findCategoryIdBySlug.mockClear();
        mockArticleRepository.findMany.mockClear();

        // Mock category resolution
        mockCategoryRepository.findCategoryIdBySlug.mockResolvedValue(
          testCase.categoryId
        );
        mockArticleRepository.findMany.mockResolvedValue([]);

        // Act
        await service.markHiddenExpiredDeals(testCase.slug, new Set(), mockAdapter);

        // Assert
        expect(
          mockCategoryRepository.findCategoryIdBySlug
        ).toHaveBeenCalledWith(testCase.slug);
        expect(mockArticleRepository.findMany).toHaveBeenCalledWith({
          categoryId: testCase.categoryId,
          isActive: true,
        });
      }
    });

    it('should handle errors gracefully and return 0', async () => {
      // Arrange
      const categorySlug = 'gaming';
      const categoryId = 'gaming-category-id';
      const extractedExternalIds = new Set(['deal1']);

      // Mock category resolution to succeed but findMany to fail
      mockCategoryRepository.findCategoryIdBySlug.mockResolvedValue(categoryId);
      mockArticleRepository.findMany.mockRejectedValue(
        new Error('Database error')
      );

      // Act
      const result = await service.markHiddenExpiredDeals(
        categorySlug,
        extractedExternalIds,
        mockAdapter,
      );

      // Assert
      expect(result).toBe(0);
      expect(mockCategoryRepository.findCategoryIdBySlug).toHaveBeenCalledWith(
        categorySlug
      );
    });
  });
});
