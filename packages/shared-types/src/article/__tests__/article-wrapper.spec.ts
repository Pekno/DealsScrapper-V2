import type { PrismaClient } from '@prisma/client';
import type {
  Article,
  ArticleDealabs,
  ArticleVinted,
  ArticleLeBonCoin,
  Category,
} from '@prisma/client';
import {
  ArticleWrapper,
  SiteSource,
  ArticleNotFoundException,
} from '../article-wrapper.js';

/**
 * Mock PrismaClient for testing ArticleWrapper
 */
const createMockPrismaClient = (): PrismaClient => {
  return {
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
  } as unknown as PrismaClient;
};

describe('ArticleWrapper', () => {
  let mockPrisma: PrismaClient;

  // Test fixtures
  const mockCategory: Category = {
    id: 'cat-1',
    slug: 'electronics',
    name: 'Electronics',
    siteId: 'dealabs',
    sourceUrl: 'https://dealabs.com/electronics',
    parentId: null,
    level: 1,
    description: 'Electronics category',
    dealCount: 100,
    avgTemperature: 150,
    popularBrands: ['Samsung', 'Apple'],
    isActive: true,
    userCount: 50,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  };

  const mockDealabsArticle: Article & { category: Category } = {
    id: 'article-1',
    externalId: 'thread_123',
    siteId: 'dealabs',
    title: 'Great laptop deal',
    description: 'Amazing laptop at low price',
    url: 'https://dealabs.com/deals/123',
    imageUrl: 'https://example.com/image.jpg',
    currentPrice: 599.99,
    categoryId: 'cat-1',
    categoryPath: ['Home', 'Electronics', 'Laptops'],
    isActive: true,
    isExpired: false,
    location: null,
    publishedAt: new Date('2025-01-15'),
    scrapedAt: new Date('2025-01-15'),
    updatedAt: new Date('2025-01-15'),
    category: mockCategory,
  };

  const mockDealabsExtension: ArticleDealabs = {
    articleId: 'article-1',
    temperature: 200,
    commentCount: 45,
    communityVerified: true,
    originalPrice: 999.99,
    discountPercentage: 40,
    merchant: 'Amazon',
    freeShipping: true,
    isCoupon: false,
    expiresAt: new Date('2025-01-20'),
    createdAt: new Date('2025-01-15'),
    updatedAt: new Date('2025-01-15'),
  };

  const mockVintedArticle: Article & { category: Category } = {
    id: 'article-2',
    externalId: 'item_456',
    siteId: 'vinted',
    title: 'Vintage jacket',
    description: 'Beautiful vintage jacket',
    url: 'https://vinted.fr/items/456',
    imageUrl: 'https://example.com/jacket.jpg',
    currentPrice: 25.0,
    categoryId: 'cat-1',
    categoryPath: ['Fashion', 'Jackets'],
    isActive: true,
    isExpired: false,
    location: null,
    publishedAt: null,
    scrapedAt: new Date('2025-01-15'),
    updatedAt: new Date('2025-01-15'),
    category: mockCategory,
  };

  const mockVintedExtension: ArticleVinted = {
    articleId: 'article-2',
    favoriteCount: 12,
    viewCount: 150,
    boosted: false,
    brand: 'Levi\'s',
    size: 'M',
    color: 'Blue',
    condition: 'Très bon état',
    sellerName: 'fashionista',
    sellerRating: 4.8,
    buyerProtectionFee: 0.75,
    createdAt: new Date('2025-01-15'),
    updatedAt: new Date('2025-01-15'),
  };

  const mockLeBonCoinArticle: Article & { category: Category } = {
    id: 'article-3',
    externalId: 'ad_789',
    siteId: 'leboncoin',
    title: 'Apartment in Paris',
    description: 'Beautiful apartment',
    url: 'https://leboncoin.fr/ads/789',
    imageUrl: 'https://example.com/apartment.jpg',
    currentPrice: 1500.0,
    categoryId: 'cat-1',
    categoryPath: ['Real Estate', 'Rentals'],
    isActive: true,
    isExpired: false,
    location: 'Paris 75001',
    publishedAt: new Date('2025-01-14'),
    scrapedAt: new Date('2025-01-15'),
    updatedAt: new Date('2025-01-15'),
    category: mockCategory,
  };

  const mockLeBonCoinExtension: ArticleLeBonCoin = {
    articleId: 'article-3',
    city: 'Paris',
    postcode: '75001',
    department: 'Paris',
    region: 'Île-de-France',
    proSeller: true,
    sellerName: 'RealEstate Agency',
    urgentFlag: false,
    topAnnonce: true,
    deliveryOptions: ['hand_delivery'],
    shippingCost: null,
    condition: null,
    attributes: { rooms: 3, surface: 75 },
    createdAt: new Date('2025-01-15'),
    updatedAt: new Date('2025-01-15'),
  };

  beforeEach(() => {
    mockPrisma = createMockPrismaClient();
    jest.clearAllMocks();
  });

  describe('load() - Single article loading', () => {
    it('should load Dealabs article with extension', async () => {
      // Arrange
      jest.mocked(mockPrisma.article.findUnique).mockResolvedValue(
        mockDealabsArticle,
      );
      jest.mocked(mockPrisma.articleDealabs.findUnique).mockResolvedValue(
        mockDealabsExtension,
      );

      // Act
      const wrapper = await ArticleWrapper.load('article-1', mockPrisma);

      // Assert
      expect(wrapper.base.id).toBe('article-1');
      expect(wrapper.source).toBe(SiteSource.DEALABS);
      expect(wrapper.extension).toEqual(mockDealabsExtension);
      expect(mockPrisma.article.findUnique).toHaveBeenCalledWith({
        where: { id: 'article-1' },
        include: { category: true },
      });
      expect(mockPrisma.articleDealabs.findUnique).toHaveBeenCalledWith({
        where: { articleId: 'article-1' },
      });
    });

    it('should load Vinted article with extension', async () => {
      // Arrange
      jest.mocked(mockPrisma.article.findUnique).mockResolvedValue(
        mockVintedArticle,
      );
      jest.mocked(mockPrisma.articleVinted.findUnique).mockResolvedValue(
        mockVintedExtension,
      );

      // Act
      const wrapper = await ArticleWrapper.load('article-2', mockPrisma);

      // Assert
      expect(wrapper.base.id).toBe('article-2');
      expect(wrapper.source).toBe(SiteSource.VINTED);
      expect(wrapper.extension).toEqual(mockVintedExtension);
      expect(mockPrisma.articleVinted.findUnique).toHaveBeenCalledWith({
        where: { articleId: 'article-2' },
      });
    });

    it('should load LeBonCoin article with extension', async () => {
      // Arrange
      jest.mocked(mockPrisma.article.findUnique).mockResolvedValue(
        mockLeBonCoinArticle,
      );
      jest.mocked(mockPrisma.articleLeBonCoin.findUnique).mockResolvedValue(
        mockLeBonCoinExtension,
      );

      // Act
      const wrapper = await ArticleWrapper.load('article-3', mockPrisma);

      // Assert
      expect(wrapper.base.id).toBe('article-3');
      expect(wrapper.source).toBe(SiteSource.LEBONCOIN);
      expect(wrapper.extension).toEqual(mockLeBonCoinExtension);
      expect(mockPrisma.articleLeBonCoin.findUnique).toHaveBeenCalledWith({
        where: { articleId: 'article-3' },
      });
    });

    it('should throw ArticleNotFoundException if article not found', async () => {
      // Arrange
      jest.mocked(mockPrisma.article.findUnique).mockResolvedValue(null);

      // Act & Assert
      await expect(
        ArticleWrapper.load('non-existent', mockPrisma),
      ).rejects.toThrow(ArticleNotFoundException);
      await expect(
        ArticleWrapper.load('non-existent', mockPrisma),
      ).rejects.toThrow('Article with id "non-existent" not found');
    });

    it('should throw ArticleNotFoundException if extension not found', async () => {
      // Arrange
      jest.mocked(mockPrisma.article.findUnique).mockResolvedValue(
        mockDealabsArticle,
      );
      jest.mocked(mockPrisma.articleDealabs.findUnique).mockResolvedValue(null);

      // Act & Assert
      await expect(ArticleWrapper.load('article-1', mockPrisma)).rejects.toThrow(
        ArticleNotFoundException,
      );
      await expect(ArticleWrapper.load('article-1', mockPrisma)).rejects.toThrow(
        'ArticleDealabs extension for article "article-1" not found',
      );
    });

    it('should throw ArticleNotFoundException for unknown siteId', async () => {
      // Arrange
      const articleWithBadSiteId = {
        ...mockDealabsArticle,
        siteId: 'unknown-site',
      };
      jest.mocked(mockPrisma.article.findUnique).mockResolvedValue(
        articleWithBadSiteId,
      );

      // Act & Assert
      await expect(ArticleWrapper.load('article-1', mockPrisma)).rejects.toThrow(
        'Unknown article siteId: unknown-site',
      );
    });
  });

  describe('loadMany() - Batch loading', () => {
    it('should load multiple articles from different sites', async () => {
      // Arrange
      jest.mocked(mockPrisma.article.findMany).mockResolvedValue([
        mockDealabsArticle,
        mockVintedArticle,
        mockLeBonCoinArticle,
      ]);

      jest.mocked(mockPrisma.articleDealabs.findMany).mockResolvedValue([
        mockDealabsExtension,
      ]);
      jest.mocked(mockPrisma.articleVinted.findMany).mockResolvedValue([
        mockVintedExtension,
      ]);
      jest.mocked(mockPrisma.articleLeBonCoin.findMany).mockResolvedValue([
        mockLeBonCoinExtension,
      ]);

      // Act
      const wrappers = await ArticleWrapper.loadMany(
        ['article-1', 'article-2', 'article-3'],
        mockPrisma,
      );

      // Assert
      expect(wrappers).toHaveLength(3);
      expect(wrappers[0].source).toBe(SiteSource.DEALABS);
      expect(wrappers[1].source).toBe(SiteSource.VINTED);
      expect(wrappers[2].source).toBe(SiteSource.LEBONCOIN);
    });

    it('should preserve input order', async () => {
      // Arrange
      jest.mocked(mockPrisma.article.findMany).mockResolvedValue([
        mockVintedArticle, // Returns in different order
        mockDealabsArticle,
      ]);

      jest.mocked(mockPrisma.articleDealabs.findMany).mockResolvedValue([
        mockDealabsExtension,
      ]);
      jest.mocked(mockPrisma.articleVinted.findMany).mockResolvedValue([
        mockVintedExtension,
      ]);

      // Act
      const wrappers = await ArticleWrapper.loadMany(
        ['article-1', 'article-2'], // Request Dealabs first, then Vinted
        mockPrisma,
      );

      // Assert
      expect(wrappers[0].base.id).toBe('article-1'); // Dealabs
      expect(wrappers[1].base.id).toBe('article-2'); // Vinted
    });

    it('should return empty array for empty input', async () => {
      // Act
      const wrappers = await ArticleWrapper.loadMany([], mockPrisma);

      // Assert
      expect(wrappers).toEqual([]);
      expect(mockPrisma.article.findMany).not.toHaveBeenCalled();
    });

    it('should throw ArticleNotFoundException if any article missing', async () => {
      // Arrange
      jest.mocked(mockPrisma.article.findMany).mockResolvedValue([
        mockDealabsArticle, // Only 1 article found, expected 2
      ]);

      // Act & Assert
      await expect(
        ArticleWrapper.loadMany(['article-1', 'article-2'], mockPrisma),
      ).rejects.toThrow(ArticleNotFoundException);
      await expect(
        ArticleWrapper.loadMany(['article-1', 'article-2'], mockPrisma),
      ).rejects.toThrow('Articles not found: article-2');
    });

    it('should throw ArticleNotFoundException if any extension missing', async () => {
      // Arrange
      jest.mocked(mockPrisma.article.findMany).mockResolvedValue([
        mockDealabsArticle,
        mockVintedArticle,
      ]);

      jest.mocked(mockPrisma.articleDealabs.findMany).mockResolvedValue([
        mockDealabsExtension,
      ]);
      jest.mocked(mockPrisma.articleVinted.findMany).mockResolvedValue([]);
      // Vinted extension missing

      // Act & Assert
      await expect(
        ArticleWrapper.loadMany(['article-1', 'article-2'], mockPrisma),
      ).rejects.toThrow('Some ArticleVinted extensions not found');
    });
  });

  describe('Type guards', () => {
    it('isDealabs() should return true for Dealabs articles', async () => {
      // Arrange
      jest.mocked(mockPrisma.article.findUnique).mockResolvedValue(
        mockDealabsArticle,
      );
      jest.mocked(mockPrisma.articleDealabs.findUnique).mockResolvedValue(
        mockDealabsExtension,
      );

      // Act
      const wrapper = await ArticleWrapper.load('article-1', mockPrisma);

      // Assert
      expect(wrapper.isDealabs()).toBe(true);
      expect(wrapper.isVinted()).toBe(false);
      expect(wrapper.isLeBonCoin()).toBe(false);

      // TypeScript type narrowing should work
      if (wrapper.isDealabs()) {
        expect(wrapper.extension.temperature).toBe(200);
        expect(wrapper.extension.commentCount).toBe(45);
      }
    });

    it('isVinted() should return true for Vinted articles', async () => {
      // Arrange
      jest.mocked(mockPrisma.article.findUnique).mockResolvedValue(
        mockVintedArticle,
      );
      jest.mocked(mockPrisma.articleVinted.findUnique).mockResolvedValue(
        mockVintedExtension,
      );

      // Act
      const wrapper = await ArticleWrapper.load('article-2', mockPrisma);

      // Assert
      expect(wrapper.isVinted()).toBe(true);
      expect(wrapper.isDealabs()).toBe(false);
      expect(wrapper.isLeBonCoin()).toBe(false);

      if (wrapper.isVinted()) {
        expect(wrapper.extension.favoriteCount).toBe(12);
        expect(wrapper.extension.condition).toBe('Très bon état');
      }
    });

    it('isLeBonCoin() should return true for LeBonCoin articles', async () => {
      // Arrange
      jest.mocked(mockPrisma.article.findUnique).mockResolvedValue(
        mockLeBonCoinArticle,
      );
      jest.mocked(mockPrisma.articleLeBonCoin.findUnique).mockResolvedValue(
        mockLeBonCoinExtension,
      );

      // Act
      const wrapper = await ArticleWrapper.load('article-3', mockPrisma);

      // Assert
      expect(wrapper.isLeBonCoin()).toBe(true);
      expect(wrapper.isDealabs()).toBe(false);
      expect(wrapper.isVinted()).toBe(false);

      if (wrapper.isLeBonCoin()) {
        expect(wrapper.extension.city).toBe('Paris');
        expect(wrapper.extension.proSeller).toBe(true);
      }
    });
  });

  describe('ArticleNotFoundException', () => {
    it('should have correct name property', () => {
      const error = new ArticleNotFoundException('Test error');
      expect(error.name).toBe('ArticleNotFoundException');
      expect(error.message).toBe('Test error');
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('SiteSource enum', () => {
    it('should have correct values', () => {
      expect(SiteSource.DEALABS).toBe('dealabs');
      expect(SiteSource.VINTED).toBe('vinted');
      expect(SiteSource.LEBONCOIN).toBe('leboncoin');
    });
  });
});
