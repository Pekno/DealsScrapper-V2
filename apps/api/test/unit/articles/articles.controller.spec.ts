import { Test, TestingModule } from '@nestjs/testing';
import { ArticlesController } from '../../../src/articles/articles.controller';
import { ArticlesService } from '../../../src/articles/articles.service';
import { SearchArticlesDto } from '../../../src/articles/dto/search-articles.dto';
import { ArticleListResponseDto, ArticleResponseDto } from '../../../src/articles/dto/article-response.dto';
import { SiteSource } from '@dealscrapper/shared-types/article';

describe('ArticlesController - Article Search API', () => {
  let controller: ArticlesController;
  let articlesService: jest.Mocked<ArticlesService>;

  const mockDealabsArticleResponse: ArticleResponseDto = {
    base: {
      id: 'article-1',
      externalId: 'deal-123',
      source: SiteSource.DEALABS,
      title: 'RTX 4090 Gaming GPU',
      description: 'High-end graphics card deal',
      url: 'https://dealabs.com/deals/123',
      imageUrl: 'https://example.com/gpu.jpg',
      currentPrice: 1200,
      categoryId: 'cat-1',
      location: null,
      publishedAt: new Date('2025-01-15T10:00:00Z'),
      scrapedAt: new Date('2025-01-15T10:30:00Z'),
      isActive: true,
      isExpired: false,
    },
    source: SiteSource.DEALABS,
    dealabsExtension: {
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
  };

  const mockVintedArticleResponse: ArticleResponseDto = {
    base: {
      id: 'article-2',
      externalId: 'item-456',
      source: SiteSource.VINTED,
      title: 'Nike Air Max Shoes',
      description: 'Gently used sneakers',
      url: 'https://vinted.fr/items/456',
      imageUrl: 'https://example.com/shoes.jpg',
      currentPrice: 45,
      categoryId: 'cat-2',
      location: null,
      publishedAt: null,
      scrapedAt: new Date('2025-01-15T11:00:00Z'),
      isActive: true,
      isExpired: false,
    },
    source: SiteSource.VINTED,
    vintedExtension: {
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
  };

  const mockArticleListResponse: ArticleListResponseDto = {
    articles: [mockDealabsArticleResponse, mockVintedArticleResponse],
    total: 2,
    from: 0,
    size: 20,
  };

  const mockArticlesService = {
    search: jest.fn(),
    getById: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ArticlesController],
      providers: [
        {
          provide: ArticlesService,
          useValue: mockArticlesService,
        },
      ],
    }).compile();

    controller = module.get<ArticlesController>(ArticlesController);
    articlesService = module.get(ArticlesService);
  });

  describe('search', () => {
    it('should search articles and return successful response', async () => {
      // Arrange
      const searchDto: SearchArticlesDto = {
        q: 'gaming',
        size: 20,
        from: 0,
      };
      mockArticlesService.search.mockResolvedValue(mockArticleListResponse);

      // Act
      const result = await controller.search(searchDto);

      // Assert
      expect(result.success).toBe(true);
      expect(result.message).toBe('Articles retrieved successfully');
      expect(result.data.articles).toHaveLength(2);
      expect(result.data.total).toBe(2);
      expect(mockArticlesService.search).toHaveBeenCalledWith(searchDto);
    });

    it('should return empty results when no articles match', async () => {
      // Arrange
      const searchDto: SearchArticlesDto = { q: 'nonexistent' };
      const emptyResponse: ArticleListResponseDto = {
        articles: [],
        total: 0,
        from: 0,
        size: 20,
      };
      mockArticlesService.search.mockResolvedValue(emptyResponse);

      // Act
      const result = await controller.search(searchDto);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data.articles).toHaveLength(0);
      expect(result.data.total).toBe(0);
    });

    it('should pass site filters to service', async () => {
      // Arrange
      const searchDto: SearchArticlesDto = {
        sites: [SiteSource.DEALABS, SiteSource.VINTED],
      };
      mockArticlesService.search.mockResolvedValue(mockArticleListResponse);

      // Act
      await controller.search(searchDto);

      // Assert
      expect(mockArticlesService.search).toHaveBeenCalledWith(
        expect.objectContaining({
          sites: [SiteSource.DEALABS, SiteSource.VINTED],
        }),
      );
    });

    it('should pass price range filters to service', async () => {
      // Arrange
      const searchDto: SearchArticlesDto = {
        priceMin: 50,
        priceMax: 500,
      };
      mockArticlesService.search.mockResolvedValue(mockArticleListResponse);

      // Act
      await controller.search(searchDto);

      // Assert
      expect(mockArticlesService.search).toHaveBeenCalledWith(
        expect.objectContaining({
          priceMin: 50,
          priceMax: 500,
        }),
      );
    });

    it('should pass Dealabs-specific filters to service', async () => {
      // Arrange
      const searchDto: SearchArticlesDto = {
        dealabs_temperatureMin: 100,
        dealabs_communityVerified: true,
        dealabs_freeShipping: true,
      };
      mockArticlesService.search.mockResolvedValue(mockArticleListResponse);

      // Act
      await controller.search(searchDto);

      // Assert
      expect(mockArticlesService.search).toHaveBeenCalledWith(
        expect.objectContaining({
          dealabs_temperatureMin: 100,
          dealabs_communityVerified: true,
          dealabs_freeShipping: true,
        }),
      );
    });

    it('should pass Vinted-specific filters to service', async () => {
      // Arrange
      const searchDto: SearchArticlesDto = {
        vinted_brand: 'Nike',
        vinted_size: '42',
        vinted_condition: 'new_with_tags',
      };
      mockArticlesService.search.mockResolvedValue(mockArticleListResponse);

      // Act
      await controller.search(searchDto);

      // Assert
      expect(mockArticlesService.search).toHaveBeenCalledWith(
        expect.objectContaining({
          vinted_brand: 'Nike',
          vinted_size: '42',
          vinted_condition: 'new_with_tags',
        }),
      );
    });

    it('should pass pagination parameters to service', async () => {
      // Arrange
      const searchDto: SearchArticlesDto = {
        from: 20,
        size: 50,
      };
      mockArticlesService.search.mockResolvedValue(mockArticleListResponse);

      // Act
      await controller.search(searchDto);

      // Assert
      expect(mockArticlesService.search).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 20,
          size: 50,
        }),
      );
    });
  });

  describe('getById', () => {
    it('should return single article with successful response', async () => {
      // Arrange
      mockArticlesService.getById.mockResolvedValue(mockDealabsArticleResponse);

      // Act
      const result = await controller.getById('article-1');

      // Assert
      expect(result.success).toBe(true);
      expect(result.message).toBe('Article retrieved successfully');
      expect(result.data.base.id).toBe('article-1');
      expect(result.data.source).toBe(SiteSource.DEALABS);
      expect(mockArticlesService.getById).toHaveBeenCalledWith('article-1');
    });

    it('should return Vinted article with extension data', async () => {
      // Arrange
      mockArticlesService.getById.mockResolvedValue(mockVintedArticleResponse);

      // Act
      const result = await controller.getById('article-2');

      // Assert
      expect(result.success).toBe(true);
      expect(result.data.source).toBe(SiteSource.VINTED);
      expect(result.data.vintedExtension).toBeDefined();
      expect(result.data.vintedExtension?.brand).toBe('Nike');
    });

    it('should propagate service errors', async () => {
      // Arrange
      mockArticlesService.getById.mockRejectedValue(new Error('Article not found'));

      // Act & Assert
      await expect(controller.getById('nonexistent')).rejects.toThrow('Article not found');
    });
  });
});
