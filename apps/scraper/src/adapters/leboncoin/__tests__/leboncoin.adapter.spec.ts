import { Test, TestingModule } from '@nestjs/testing';
import { LeBonCoinAdapter } from '../leboncoin.adapter';
import { LlmExtractionService } from '../../../llm-extraction/llm-extraction.service';
import { SiteSource } from '@dealscrapper/shared-types';
import type { UniversalListing } from '@dealscrapper/shared-types';

const mockUniversalListing: UniversalListing = {
  externalId: '3155664945',
  title: 'Routeur mobile M1 MR1100 NETGEAR',
  description: null,
  url: 'https://www.leboncoin.fr/ad/accessoires_informatique/3155664945',
  imageUrl: 'https://img.leboncoin.fr/api/v1/image.jpg',
  siteId: SiteSource.LEBONCOIN,
  currentPrice: 19500,
  originalPrice: null,
  merchant: null,
  location: 'Le Cannet 06110',
  publishedAt: new Date(0),
  isActive: true,
  categorySlug: '',
  siteSpecificData: {
    type: SiteSource.LEBONCOIN,
    city: 'Le Cannet',
    postcode: '06110',
    department: null,
    region: null,
    proSeller: false,
    sellerName: null,
    urgentFlag: false,
    topAnnonce: false,
    deliveryOptions: [],
    shippingCost: null,
    condition: null,
    attributes: null,
  },
};

describe('LeBonCoinAdapter', () => {
  let adapter: LeBonCoinAdapter;
  let llmExtractionService: jest.Mocked<LlmExtractionService>;

  beforeEach(async () => {
    llmExtractionService = {
      extract: jest.fn().mockResolvedValue({ listing: mockUniversalListing, ollamaMs: 42 }),
    } as unknown as jest.Mocked<LlmExtractionService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeBonCoinAdapter,
        { provide: LlmExtractionService, useValue: llmExtractionService },
      ],
    }).compile();

    adapter = module.get<LeBonCoinAdapter>(LeBonCoinAdapter);
  });

  it('should be defined', () => {
    expect(adapter).toBeDefined();
  });

  describe('Site metadata', () => {
    it('should have correct site ID', () => {
      expect(adapter.siteId).toBe(SiteSource.LEBONCOIN);
    });

    it('should have correct base URL', () => {
      expect(adapter.baseUrl).toBe('https://www.leboncoin.fr');
    });

    it('should have display name', () => {
      expect(adapter.displayName).toBe('LeBonCoin');
    });
  });

  describe('buildCategoryUrl()', () => {
    it('should build search URL', () => {
      expect(adapter.buildCategoryUrl('15', 1)).toBe(
        'https://www.leboncoin.fr/recherche?category=15&page=1',
      );
    });
  });

  describe('extractCategorySlug()', () => {
    it('should extract slug from query param', () => {
      expect(
        adapter.extractCategorySlug('https://www.leboncoin.fr/recherche?category=15&page=1'),
      ).toBe('15');
    });

    it('should extract slug from ad path', () => {
      expect(
        adapter.extractCategorySlug('https://www.leboncoin.fr/ad/accessoires_informatique/3155664945'),
      ).toBe('accessoires_informatique');
    });
  });

  describe('getListingSelector()', () => {
    it('should return selector without article tag (div or article both match)', () => {
      expect(adapter.getListingSelector()).toBe('[data-qa-id="aditem_container"]');
    });
  });

  describe('extractListings()', () => {
    it('should call LlmExtractionService.extract for each listing element', async () => {
      const html = `
        <div>
          <div data-qa-id="aditem_container">item 1</div>
          <div data-qa-id="aditem_container">item 2</div>
        </div>
      `;
      const listings = await adapter.extractListings(
        html,
        'https://www.leboncoin.fr/recherche?category=15',
      );
      expect(llmExtractionService.extract).toHaveBeenCalledTimes(2);
      expect(listings.listings).toHaveLength(2);
    });

    it('should skip listings where LLM extraction fails', async () => {
      llmExtractionService.extract.mockRejectedValueOnce(new Error('LLM error'));

      const html = `
        <div>
          <div data-qa-id="aditem_container">item 1</div>
          <div data-qa-id="aditem_container">item 2</div>
        </div>
      `;
      const listings = await adapter.extractListings(
        html,
        'https://www.leboncoin.fr/recherche?category=15',
      );
      expect(listings.listings).toHaveLength(1);
    });
  });

  describe('validateHtml()', () => {
    it('should accept HTML with data-qa-id', () => {
      expect(() =>
        adapter.validateHtml('<div data-qa-id="aditem_container" class="leboncoin">item</div>'),
      ).not.toThrow();
    });

    it('should throw for empty HTML', () => {
      expect(() => adapter.validateHtml('')).toThrow('Empty HTML content');
    });

    it('should throw for HTML without article or aditem elements', () => {
      expect(() =>
        adapter.validateHtml('<div>Random content without markers</div>'),
      ).toThrow('Invalid LeBonCoin HTML');
    });
  });
});
