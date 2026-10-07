import { Test, TestingModule } from '@nestjs/testing';
import { VintedAdapter } from '../vinted.adapter';
import { LlmExtractionService } from '../../../llm-extraction/llm-extraction.service';
import { SiteSource } from '@dealscrapper/shared-types';
import type { UniversalListing } from '@dealscrapper/shared-types';

const mockUniversalListing: UniversalListing = {
  externalId: '8675512211',
  title: 'School Days Kotonoha Katsura Tapis de Souris',
  description: null,
  url: 'https://www.vinted.fr/items/8675512211-school-days-kotonoha-katsura-tapis-de-souris',
  imageUrl: 'https://images1.vinted.net/t/image.webp',
  siteId: SiteSource.VINTED,
  currentPrice: 2500,
  originalPrice: null,
  merchant: null,
  location: null,
  publishedAt: new Date(0),
  isActive: true,
  categorySlug: '',
  siteSpecificData: {
    type: SiteSource.VINTED,
    favoriteCount: 18,
    viewCount: 0,
    itemCondition: 'Très bon état',
    brand: null,
    size: null,
    color: null,
    sellerRating: null,
    sellerName: null,
  },
};

describe('VintedAdapter', () => {
  let adapter: VintedAdapter;
  let llmExtractionService: jest.Mocked<LlmExtractionService>;

  beforeEach(async () => {
    llmExtractionService = {
      extract: jest.fn().mockResolvedValue({ listing: mockUniversalListing, ollamaMs: 42 }),
    } as unknown as jest.Mocked<LlmExtractionService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VintedAdapter,
        { provide: LlmExtractionService, useValue: llmExtractionService },
      ],
    }).compile();

    adapter = module.get<VintedAdapter>(VintedAdapter);
  });

  it('should be defined', () => {
    expect(adapter).toBeDefined();
  });

  describe('Site metadata', () => {
    it('should have correct site ID', () => {
      expect(adapter.siteId).toBe(SiteSource.VINTED);
    });

    it('should have correct base URL', () => {
      expect(adapter.baseUrl).toBe('https://www.vinted.fr');
    });

    it('should have display name', () => {
      expect(adapter.displayName).toBe('Vinted');
    });
  });

  describe('buildCategoryUrl()', () => {
    it('should build catalog URL with page', () => {
      expect(adapter.buildCategoryUrl('1904-women', 2)).toBe(
        'https://www.vinted.fr/catalog/1904-women?page=2&order=newest_first',
      );
    });

    it('should default to page 1', () => {
      expect(adapter.buildCategoryUrl('1904-women')).toBe(
        'https://www.vinted.fr/catalog/1904-women?page=1&order=newest_first',
      );
    });
  });

  describe('extractCategorySlug()', () => {
    it('should extract slug from path', () => {
      expect(
        adapter.extractCategorySlug('https://www.vinted.fr/catalog/1904-women?page=1'),
      ).toBe('1904-women');
    });

    it('should extract slug from query parameter', () => {
      expect(
        adapter.extractCategorySlug('https://www.vinted.fr/catalog?catalog[]=1904'),
      ).toBe('1904');
    });
  });

  describe('getListingSelector()', () => {
    it('should return correct selector', () => {
      expect(adapter.getListingSelector()).toBe('.feed-grid__item');
    });
  });

  describe('extractListings()', () => {
    it('should call LlmExtractionService.extract for each listing element', async () => {
      const html = `
        <div>
          <div class="feed-grid__item">item 1</div>
          <div class="feed-grid__item">item 2</div>
        </div>
      `;
      const listings = await adapter.extractListings(
        html,
        'https://www.vinted.fr/catalog/1904-women',
      );
      expect(llmExtractionService.extract).toHaveBeenCalledTimes(2);
      expect(listings.listings).toHaveLength(2);
    });

    it('should skip listings where LLM extraction fails', async () => {
      llmExtractionService.extract.mockRejectedValueOnce(new Error('LLM error'));

      const html = `
        <div>
          <div class="feed-grid__item">item 1</div>
          <div class="feed-grid__item">item 2</div>
        </div>
      `;
      const listings = await adapter.extractListings(
        html,
        'https://www.vinted.fr/catalog/1904-women',
      );
      expect(listings.listings).toHaveLength(1);
    });
  });

  describe('validateHtml()', () => {
    it('should accept HTML with feed-grid__item', () => {
      expect(() =>
        adapter.validateHtml('<div class="feed-grid__item"></div>'),
      ).not.toThrow();
    });

    it('should throw for empty HTML', () => {
      expect(() => adapter.validateHtml('')).toThrow('Empty HTML content');
    });

    it('should throw for HTML without Vinted markers', () => {
      expect(() =>
        adapter.validateHtml('<div>Random content</div>'),
      ).toThrow('Invalid Vinted HTML structure');
    });
  });
});
