import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import { PrismaService } from '@dealscrapper/database';
import { ArticlesService } from '../../../src/articles/articles.service';
import { SearchArticlesDto } from '../../../src/articles/dto/search-articles.dto';
import { SiteSource } from '@dealscrapper/shared-types/article';

// Mock ArticleWrapper static methods
jest.mock('@dealscrapper/shared-types/article', () => {
  const actual = jest.requireActual('@dealscrapper/shared-types/article');
  return {
    ...actual,
    ArticleWrapper: {
      load: jest.fn(),
      loadMany: jest.fn(),
    },
  };
});

import { ArticleWrapper } from '@dealscrapper/shared-types/article';

describe('ArticlesService - Article Search & Retrieval', () => {
  let service: ArticlesService;
  let elasticsearchService: jest.Mocked<ElasticsearchService>;
  let prismaService: jest.Mocked<PrismaService>;

  // Mock article data
  const mockDealabsArticle = {
    base: {
      id: 'article-1',
      externalId: 'deal-123',
      siteId: 'dealabs',
      title: 'RTX 4090 Gaming GPU',
      description: 'High-end graphics card deal',
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
    },
    extension: {
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
    },
    source: SiteSource.DEALABS,
    isDealabs: () => true,
    isVinted: () => false,
    isLeBonCoin: () => false,
  };

  const mockVintedArticle = {
    base: {
      id: 'article-2',
      externalId: 'item-456',
      siteId: 'vinted',
      title: 'Nike Air Max Shoes',
      description: 'Gently used sneakers',
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
    },
    extension: {
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
    },
    source: SiteSource.VINTED,
    isDealabs: () => false,
    isVinted: () => true,
    isLeBonCoin: () => false,
  };

  const mockElasticsearchService = {
    search: jest.fn(),
  };

  const mockPrismaService = {
    article: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    articleDealabs: {
      findUnique: jest.fn(),
    },
    articleVinted: {
      findUnique: jest.fn(),
    },
    articleLeBonCoin: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArticlesService,
        {
          provide: ElasticsearchService,
          useValue: mockElasticsearchService,
        },
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    // Suppress logger output during tests
    module.useLogger(false);

    service = module.get<ArticlesService>(ArticlesService);
    elasticsearchService = module.get(ElasticsearchService);
    prismaService = module.get(PrismaService);
  });

  describe('search', () => {
    it('should search articles and return results from Elasticsearch', async () => {
      // Arrange
      const searchDto: SearchArticlesDto = {
        q: 'gaming',
        size: 20,
        from: 0,
      };

      const esResponse = {
        hits: {
          hits: [
            { _id: 'article-1' },
            { _id: 'article-2' },
          ],
          total: { value: 2 },
        },
      };

      mockElasticsearchService.search.mockResolvedValue(esResponse);
      (ArticleWrapper.loadMany as jest.Mock).mockResolvedValue([
        mockDealabsArticle,
        mockVintedArticle,
      ]);

      // Act
      const result = await service.search(searchDto);

      // Assert
      expect(result.articles).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.from).toBe(0);
      expect(result.size).toBe(20);
      expect(mockElasticsearchService.search).toHaveBeenCalledWith(
        expect.objectContaining({
          index: 'articles',
          query: expect.objectContaining({
            bool: {
              must: expect.arrayContaining([
                expect.objectContaining({
                  multi_match: expect.objectContaining({
                    query: 'gaming',
                  }),
                }),
              ]),
            },
          }),
        }),
      );
    });

    it('should return empty results when no articles match', async () => {
      // Arrange
      const searchDto: SearchArticlesDto = {
        q: 'nonexistent',
      };

      const esResponse = {
        hits: {
          hits: [],
          total: { value: 0 },
        },
      };

      mockElasticsearchService.search.mockResolvedValue(esResponse);

      // Act
      const result = await service.search(searchDto);

      // Assert
      expect(result.articles).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(ArticleWrapper.loadMany).not.toHaveBeenCalled();
    });

    it('should apply site filter when sites are specified', async () => {
      // Arrange
      const searchDto: SearchArticlesDto = {
        sites: [SiteSource.DEALABS],
      };

      const esResponse = {
        hits: {
          hits: [{ _id: 'article-1' }],
          total: { value: 1 },
        },
      };

      mockElasticsearchService.search.mockResolvedValue(esResponse);
      (ArticleWrapper.loadMany as jest.Mock).mockResolvedValue([mockDealabsArticle]);

      // Act
      await service.search(searchDto);

      // Assert
      expect(mockElasticsearchService.search).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.objectContaining({
            bool: {
              must: expect.arrayContaining([
                expect.objectContaining({
                  terms: { source: [SiteSource.DEALABS] },
                }),
              ]),
            },
          }),
        }),
      );
    });

    it('should apply price range filters', async () => {
      // Arrange
      const searchDto: SearchArticlesDto = {
        priceMin: 50,
        priceMax: 500,
      };

      const esResponse = {
        hits: {
          hits: [{ _id: 'article-2' }],
          total: { value: 1 },
        },
      };

      mockElasticsearchService.search.mockResolvedValue(esResponse);
      (ArticleWrapper.loadMany as jest.Mock).mockResolvedValue([mockVintedArticle]);

      // Act
      await service.search(searchDto);

      // Assert
      expect(mockElasticsearchService.search).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.objectContaining({
            bool: {
              must: expect.arrayContaining([
                expect.objectContaining({
                  range: {
                    currentPrice: { gte: 50, lte: 500 },
                  },
                }),
              ]),
            },
          }),
        }),
      );
    });

    it('should apply Dealabs-specific filters', async () => {
      // Arrange
      const searchDto: SearchArticlesDto = {
        dealabs_temperatureMin: 100,
        dealabs_communityVerified: true,
      };

      const esResponse = {
        hits: {
          hits: [{ _id: 'article-1' }],
          total: { value: 1 },
        },
      };

      mockElasticsearchService.search.mockResolvedValue(esResponse);
      (ArticleWrapper.loadMany as jest.Mock).mockResolvedValue([mockDealabsArticle]);

      // Act
      await service.search(searchDto);

      // Assert
      expect(mockElasticsearchService.search).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.objectContaining({
            bool: {
              must: expect.arrayContaining([
                expect.objectContaining({
                  range: { dealabs_temperature: { gte: 100 } },
                }),
                expect.objectContaining({
                  term: { dealabs_communityVerified: true },
                }),
              ]),
            },
          }),
        }),
      );
    });

    it('should apply Vinted-specific filters', async () => {
      // Arrange
      const searchDto: SearchArticlesDto = {
        vinted_brand: 'Nike',
        vinted_size: '42',
      };

      const esResponse = {
        hits: {
          hits: [{ _id: 'article-2' }],
          total: { value: 1 },
        },
      };

      mockElasticsearchService.search.mockResolvedValue(esResponse);
      (ArticleWrapper.loadMany as jest.Mock).mockResolvedValue([mockVintedArticle]);

      // Act
      await service.search(searchDto);

      // Assert
      expect(mockElasticsearchService.search).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.objectContaining({
            bool: {
              must: expect.arrayContaining([
                expect.objectContaining({
                  term: { vinted_brand: 'Nike' },
                }),
                expect.objectContaining({
                  term: { vinted_size: '42' },
                }),
              ]),
            },
          }),
        }),
      );
    });

    it('should use match_all query when no filters specified', async () => {
      // Arrange
      const searchDto: SearchArticlesDto = {};

      const esResponse = {
        hits: {
          hits: [{ _id: 'article-1' }],
          total: { value: 1 },
        },
      };

      mockElasticsearchService.search.mockResolvedValue(esResponse);
      (ArticleWrapper.loadMany as jest.Mock).mockResolvedValue([mockDealabsArticle]);

      // Act
      await service.search(searchDto);

      // Assert
      expect(mockElasticsearchService.search).toHaveBeenCalledWith(
        expect.objectContaining({
          query: { match_all: {} },
        }),
      );
    });

    it('should handle Elasticsearch errors gracefully', async () => {
      // Arrange
      const searchDto: SearchArticlesDto = { q: 'test' };
      mockElasticsearchService.search.mockRejectedValue(new Error('ES connection failed'));

      // Act & Assert
      await expect(service.search(searchDto)).rejects.toThrow('ES connection failed');
    });
  });

  describe('getById', () => {
    it('should return a single article by ID', async () => {
      // Arrange
      (ArticleWrapper.load as jest.Mock).mockResolvedValue(mockDealabsArticle);

      // Act
      const result = await service.getById('article-1');

      // Assert
      expect(result.base.id).toBe('article-1');
      expect(result.base.title).toBe('RTX 4090 Gaming GPU');
      expect(result.source).toBe(SiteSource.DEALABS);
      expect(result.dealabsExtension).toBeDefined();
      expect(result.dealabsExtension?.temperature).toBe(150);
    });

    it('should return Vinted article with extension data', async () => {
      // Arrange
      (ArticleWrapper.load as jest.Mock).mockResolvedValue(mockVintedArticle);

      // Act
      const result = await service.getById('article-2');

      // Assert
      expect(result.base.id).toBe('article-2');
      expect(result.source).toBe(SiteSource.VINTED);
      expect(result.vintedExtension).toBeDefined();
      expect(result.vintedExtension?.brand).toBe('Nike');
      expect(result.vintedExtension?.size).toBe('42');
    });

    it('should throw NotFoundException when article not found', async () => {
      // Arrange
      const notFoundError = new Error('Article not found');
      notFoundError.name = 'ArticleNotFoundException';
      (ArticleWrapper.load as jest.Mock).mockRejectedValue(notFoundError);

      // Act & Assert
      await expect(service.getById('nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('should rethrow other errors', async () => {
      // Arrange
      (ArticleWrapper.load as jest.Mock).mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(service.getById('article-1')).rejects.toThrow('Database error');
    });
  });
});
