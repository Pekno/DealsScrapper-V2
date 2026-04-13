import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@dealscrapper/database';
import { SiteSource } from '@dealscrapper/shared-types/article';
import { MultiSiteArticleService } from '../../../src/services/multi-site-article.service';
import { ElasticsearchIndexerService } from '../../../src/elasticsearch/services/elasticsearch-indexer.service';
import type {
  UniversalListing,
  DealabsData,
  VintedData,
  LeBonCoinData,
} from '../../../src/adapters/base/site-adapter.interface';

describe('MultiSiteArticleService', () => {
  let service: MultiSiteArticleService;
  let prismaService: jest.Mocked<PrismaService>;
  let elasticsearchIndexer: jest.Mocked<ElasticsearchIndexerService>;

  const mockPrismaService = {
    article: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    articleDealabs: {
      create: jest.fn(),
      update: jest.fn(),
    },
    articleVinted: {
      create: jest.fn(),
      update: jest.fn(),
    },
    articleLeBonCoin: {
      create: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockElasticsearchIndexer = {
    indexArticle: jest.fn(),
    bulkIndex: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MultiSiteArticleService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: ElasticsearchIndexerService,
          useValue: mockElasticsearchIndexer,
        },
      ],
    }).compile();

    service = module.get<MultiSiteArticleService>(MultiSiteArticleService);
    prismaService = module.get(PrismaService);
    elasticsearchIndexer = module.get(ElasticsearchIndexerService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createFromListing', () => {
    const mockDealabsListing: UniversalListing = {
      externalId: 'deal-123',
      title: 'RTX 4090 Graphics Card',
      description: 'High-end gaming GPU',
      url: 'https://dealabs.com/deal/123',
      imageUrl: 'https://example.com/image.jpg',
      siteId: SiteSource.DEALABS,
      currentPrice: 1200,
      originalPrice: 1500,
      merchant: 'Amazon',
      location: null,
      publishedAt: new Date('2025-01-15'),
      isActive: true,
      categorySlug: 'cartes-graphiques',
      siteSpecificData: {
        type: 'dealabs',
        temperature: 250,
        commentCount: 45,
        communityVerified: true,
        freeShipping: true,
        isCoupon: false,
        discountPercentage: 20,
        expiresAt: null,
      } as DealabsData,
    };

    const mockVintedListing: UniversalListing = {
      externalId: 'vinted-456',
      title: 'Nike Air Max 90',
      description: 'Size 42, excellent condition',
      url: 'https://vinted.fr/item/456',
      imageUrl: 'https://example.com/shoes.jpg',
      siteId: SiteSource.VINTED,
      currentPrice: 45,
      originalPrice: null,
      merchant: null,
      location: null,
      publishedAt: new Date('2025-01-14'),
      isActive: true,
      categorySlug: 'chaussures-homme',
      siteSpecificData: {
        type: 'vinted',
        favoriteCount: 12,
        viewCount: 89,
        itemCondition: 'Très bon état',
        brand: 'Nike',
        size: '42',
        color: 'White',
        sellerRating: 4.8,
        sellerName: 'JohnDoe',
      } as VintedData,
    };

    const mockLeBonCoinListing: UniversalListing = {
      externalId: 'lbc-789',
      title: 'iPhone 14 Pro',
      description: 'Barely used, includes charger',
      url: 'https://leboncoin.fr/item/789',
      imageUrl: 'https://example.com/phone.jpg',
      siteId: SiteSource.LEBONCOIN,
      currentPrice: 750,
      originalPrice: null,
      merchant: null,
      location: 'Paris',
      publishedAt: new Date('2025-01-13'),
      isActive: true,
      categorySlug: 'telephones-mobiles',
      siteSpecificData: {
        type: 'leboncoin',
        city: 'Paris',
        postcode: '75001',
        department: 'Paris',
        region: 'Île-de-France',
        proSeller: false,
        sellerName: 'JaneDoe',
        urgentFlag: false,
      } as LeBonCoinData,
    };

    it('should create Dealabs article with extension and index to ES', async () => {
      const mockArticle = { id: 'article-1', ...mockDealabsListing };

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback(mockPrismaService);
      });
      mockPrismaService.article.create.mockResolvedValue(mockArticle);
      mockPrismaService.articleDealabs.create.mockResolvedValue({});
      mockElasticsearchIndexer.indexArticle.mockResolvedValue(undefined);

      // Mock ArticleWrapper.load (this would need proper mocking in real scenario)
      jest.spyOn(require('@dealscrapper/shared-types/article').ArticleWrapper, 'load')
        .mockResolvedValue({ base: mockArticle, source: SiteSource.DEALABS });

      const result = await service.createFromListing(mockDealabsListing, 'cat-1');

      expect(result.article).toBeDefined();
      expect(mockPrismaService.$transaction).toHaveBeenCalled();
    });

    it('should create Vinted article with extension', async () => {
      const mockArticle = { id: 'article-2', ...mockVintedListing };

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback(mockPrismaService);
      });
      mockPrismaService.article.create.mockResolvedValue(mockArticle);
      mockPrismaService.articleVinted.create.mockResolvedValue({});

      jest.spyOn(require('@dealscrapper/shared-types/article').ArticleWrapper, 'load')
        .mockResolvedValue({ base: mockArticle, source: SiteSource.VINTED });

      const result = await service.createFromListing(mockVintedListing, 'cat-2');

      expect(result.article).toBeDefined();
      expect(mockPrismaService.articleVinted.create).toHaveBeenCalled();
    });

    it('should create LeBonCoin article with extension', async () => {
      const mockArticle = { id: 'article-3', ...mockLeBonCoinListing };

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback(mockPrismaService);
      });
      mockPrismaService.article.create.mockResolvedValue(mockArticle);
      mockPrismaService.articleLeBonCoin.create.mockResolvedValue({});

      jest.spyOn(require('@dealscrapper/shared-types/article').ArticleWrapper, 'load')
        .mockResolvedValue({ base: mockArticle, source: SiteSource.LEBONCOIN });

      const result = await service.createFromListing(mockLeBonCoinListing, 'cat-3');

      expect(result.article).toBeDefined();
      expect(mockPrismaService.articleLeBonCoin.create).toHaveBeenCalled();
    });

    it('should handle ES indexing failure gracefully', async () => {
      const mockArticle = { id: 'article-5', ...mockDealabsListing };

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback(mockPrismaService);
      });
      mockPrismaService.article.create.mockResolvedValue(mockArticle);
      mockPrismaService.articleDealabs.create.mockResolvedValue({});

      // Mock ArticleWrapper.load to throw
      jest.spyOn(require('@dealscrapper/shared-types/article').ArticleWrapper, 'load')
        .mockRejectedValue(new Error('ES connection failed'));

      const result = await service.createFromListing(mockDealabsListing, 'cat-1');

      // Should still succeed, but indexed should be false
      expect(result.article).toBeDefined();
      expect(result.indexed).toBe(false);
    });
  });

  describe('createManyFromListings', () => {
    it('should skip duplicate articles', async () => {
      const listings: UniversalListing[] = [
        {
          externalId: 'existing-deal',
          title: 'Existing Deal',
          description: null,
          url: 'https://dealabs.com/deal/existing',
          imageUrl: null,
          siteId: SiteSource.DEALABS,
          currentPrice: 100,
          originalPrice: null,
          merchant: null,
          location: null,
          publishedAt: new Date(),
          isActive: true,
          categorySlug: 'test',
          siteSpecificData: {
            type: 'dealabs',
            temperature: 50,
            commentCount: 5,
            communityVerified: false,
            freeShipping: false,
            isCoupon: false,
            discountPercentage: null,
            expiresAt: null,
          } as DealabsData,
        },
      ];

      mockPrismaService.article.findFirst.mockResolvedValue({ id: 'existing' });

      const result = await service.createManyFromListings(listings, 'cat-1');

      expect(result.skipped).toBe(1);
      expect(result.created).toHaveLength(0);
    });
  });

  describe('upsertFromListing', () => {
    it('should create new article if not exists', async () => {
      const listing: UniversalListing = {
        externalId: 'new-deal',
        title: 'New Deal',
        description: null,
        url: 'https://dealabs.com/deal/new',
        imageUrl: null,
        siteId: SiteSource.DEALABS,
        currentPrice: 200,
        originalPrice: null,
        merchant: null,
        location: null,
        publishedAt: new Date(),
        isActive: true,
        categorySlug: 'test',
        siteSpecificData: {
          type: 'dealabs',
          temperature: 100,
          commentCount: 10,
          communityVerified: true,
          freeShipping: true,
          isCoupon: false,
          discountPercentage: null,
          expiresAt: null,
        } as DealabsData,
      };

      const mockArticle = { id: 'article-new', ...listing };

      mockPrismaService.article.findFirst.mockResolvedValue(null);
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback(mockPrismaService);
      });
      mockPrismaService.article.create.mockResolvedValue(mockArticle);
      mockPrismaService.articleDealabs.create.mockResolvedValue({});

      jest.spyOn(require('@dealscrapper/shared-types/article').ArticleWrapper, 'load')
        .mockResolvedValue({ base: mockArticle, source: SiteSource.DEALABS });

      const result = await service.upsertFromListing(listing, 'cat-1');

      expect(result.article).toBeDefined();
      expect(mockPrismaService.article.create).toHaveBeenCalled();
    });

    it('should update existing article', async () => {
      const listing: UniversalListing = {
        externalId: 'existing-deal',
        title: 'Updated Deal',
        description: 'Updated description',
        url: 'https://dealabs.com/deal/existing',
        imageUrl: null,
        siteId: SiteSource.DEALABS,
        currentPrice: 250,
        originalPrice: null,
        merchant: null,
        location: null,
        publishedAt: new Date(),
        isActive: true,
        categorySlug: 'test',
        siteSpecificData: {
          type: 'dealabs',
          temperature: 150,
          commentCount: 20,
          communityVerified: true,
          freeShipping: true,
          isCoupon: false,
          discountPercentage: null,
          expiresAt: null,
        } as DealabsData,
      };

      const existingArticle = { id: 'existing-article', externalId: 'existing-deal' };
      const updatedArticle = { id: 'existing-article', ...listing };

      mockPrismaService.article.findFirst.mockResolvedValue(existingArticle);
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback(mockPrismaService);
      });
      mockPrismaService.article.update.mockResolvedValue(updatedArticle);
      mockPrismaService.articleDealabs.update.mockResolvedValue({});

      jest.spyOn(require('@dealscrapper/shared-types/article').ArticleWrapper, 'load')
        .mockResolvedValue({ base: updatedArticle, source: SiteSource.DEALABS });

      const result = await service.upsertFromListing(listing, 'cat-1');

      expect(result.article).toBeDefined();
      expect(mockPrismaService.article.update).toHaveBeenCalled();
    });
  });
});
