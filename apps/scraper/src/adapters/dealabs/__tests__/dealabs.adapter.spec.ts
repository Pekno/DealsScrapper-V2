import { Test, TestingModule } from '@nestjs/testing';
import { DealabsAdapter } from '../dealabs.adapter';
import { DealabsUrlOptimizer } from '../dealabs-url-optimizer';
import { DealabsExpiryResolver } from '../dealabs-expiry-resolver';
import { LlmExtractionService } from '../../../llm-extraction/llm-extraction.service';
import { SiteSource } from '@dealscrapper/shared-types';
import type { UniversalListing } from '@dealscrapper/shared-types';

const mockUniversalListing: UniversalListing = {
  externalId: '3297895',
  title: 'Apple MacBook Air M2',
  description: 'MacBook Air with M2 chip',
  url: 'https://www.dealabs.com/bons-plans/apple-macbook-air-m2-3297895',
  imageUrl: 'https://static.dealabs.com/threads/raw/f5y/3297895_1/re720x720.jpg',
  siteId: SiteSource.DEALABS,
  currentPrice: 99900,
  originalPrice: 119900,
  merchant: 'Amazon',
  location: null,
  publishedAt: new Date('2024-01-15T10:30:00+01:00'),
  isActive: true,
  categorySlug: 'high-tech',
  siteSpecificData: {
    type: SiteSource.DEALABS,
    temperature: 425,
    commentCount: 42,
    communityVerified: false,
    freeShipping: false,
    isCoupon: false,
    discountPercentage: 17,
    expiresAt: null,
  },
};

describe('DealabsAdapter', () => {
  let adapter: DealabsAdapter;
  let llmExtractionService: jest.Mocked<LlmExtractionService>;

  beforeEach(async () => {
    llmExtractionService = {
      extract: jest.fn().mockResolvedValue(mockUniversalListing),
    } as unknown as jest.Mocked<LlmExtractionService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DealabsAdapter,
        DealabsUrlOptimizer,
        DealabsExpiryResolver,
        { provide: LlmExtractionService, useValue: llmExtractionService },
      ],
    }).compile();

    adapter = module.get<DealabsAdapter>(DealabsAdapter);
  });

  it('should be defined', () => {
    expect(adapter).toBeDefined();
  });

  describe('Site metadata', () => {
    it('should have correct site ID', () => {
      expect(adapter.siteId).toBe(SiteSource.DEALABS);
    });

    it('should have correct base URL', () => {
      expect(adapter.baseUrl).toBe('https://www.dealabs.com');
    });

    it('should have display name', () => {
      expect(adapter.displayName).toBe('Dealabs');
    });

    it('should have color code', () => {
      expect(adapter.colorCode).toBe('#FF6B35');
    });

    it('should have URL optimizer', () => {
      expect(adapter.urlOptimizer).toBeDefined();
    });
  });

  describe('buildCategoryUrl()', () => {
    it('should build regular category URL', () => {
      expect(adapter.buildCategoryUrl('high-tech', 1)).toBe(
        'https://www.dealabs.com/groupe/high-tech?page=1',
      );
    });

    it('should build hub category URL', () => {
      expect(adapter.buildCategoryUrl('hub-gaming', 2)).toBe(
        'https://www.dealabs.com/groupe/hub/gaming?page=2',
      );
    });

    it('should default to page 1', () => {
      expect(adapter.buildCategoryUrl('high-tech')).toBe(
        'https://www.dealabs.com/groupe/high-tech?page=1',
      );
    });
  });

  describe('extractCategorySlug()', () => {
    it('should extract regular category slug', () => {
      expect(
        adapter.extractCategorySlug('https://www.dealabs.com/groupe/high-tech?page=1'),
      ).toBe('high-tech');
    });

    it('should extract hub category slug', () => {
      expect(
        adapter.extractCategorySlug('https://www.dealabs.com/groupe/hub/gaming?page=1'),
      ).toBe('hub-gaming');
    });

    it('should throw for invalid URL', () => {
      expect(() =>
        adapter.extractCategorySlug('https://www.dealabs.com/invalid'),
      ).toThrow('Cannot extract category slug');
    });
  });

  describe('getListingSelector()', () => {
    it('should return correct selector', () => {
      expect(adapter.getListingSelector()).toBe(
        'article.thread, article[data-thread-id], article[id^="thread_"]',
      );
    });
  });

  describe('extractListings()', () => {
    it('should call LlmExtractionService.extract for each listing element and return results', async () => {
      const html = `
        <div>
          <article class="thread" data-thread-id="thread_123">
            <a href="/bons-plans/test-123">Test Deal 1</a>
          </article>
          <article class="thread" data-thread-id="thread_456">
            <a href="/bons-plans/test-456">Test Deal 2</a>
          </article>
        </div>
      `;
      const listings = await adapter.extractListings(
        html,
        'https://www.dealabs.com/groupe/high-tech',
      );
      expect(llmExtractionService.extract).toHaveBeenCalledTimes(2);
      expect(listings).toHaveLength(2);
      expect(listings[0]).toEqual(mockUniversalListing);
    });

    it('should return empty array for HTML with no matching elements', async () => {
      const listings = await adapter.extractListings(
        '<div data-thread-id="x"></div>',
        'https://www.dealabs.com/groupe/high-tech',
      );
      expect(listings).toHaveLength(0);
      expect(llmExtractionService.extract).not.toHaveBeenCalled();
    });

    it('should skip listings where LLM extraction fails', async () => {
      llmExtractionService.extract.mockRejectedValueOnce(new Error('LLM error'));

      const html = `
        <div>
          <article class="thread" data-thread-id="thread_123">content</article>
          <article class="thread" data-thread-id="thread_456">content</article>
        </div>
      `;
      const listings = await adapter.extractListings(
        html,
        'https://www.dealabs.com/groupe/high-tech',
      );
      expect(listings).toHaveLength(1);
    });
  });

  describe('validateHtml()', () => {
    it('should accept HTML with data-thread-id', () => {
      expect(() =>
        adapter.validateHtml(
          '<div class="threadGrid"><article data-thread-id="123"></article></div>',
        ),
      ).not.toThrow();
    });

    it('should accept HTML with id="thread_" pattern', () => {
      expect(() =>
        adapter.validateHtml(
          '<article id="thread_3297895" class="thread cept-thread-item"></article>',
        ),
      ).not.toThrow();
    });

    it('should throw for empty HTML', () => {
      expect(() => adapter.validateHtml('')).toThrow('Empty HTML content');
    });

    it('should throw for HTML without thread markers', () => {
      expect(() =>
        adapter.validateHtml('<div>Random content without thread markers</div>'),
      ).toThrow('Invalid Dealabs HTML structure');
    });
  });

  describe('extractElementCount()', () => {
    it('should extract element count from HTML', () => {
      expect(
        adapter.extractElementCount(
          '<div class="threadGrid-headerMeta">123 deals trouvés</div>',
        ),
      ).toBe(123);
    });

    it('should return undefined if count not found', () => {
      expect(adapter.extractElementCount('<div>No count here</div>')).toBeUndefined();
    });
  });
});
