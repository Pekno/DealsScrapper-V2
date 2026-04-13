import { Test, TestingModule } from '@nestjs/testing';
import { DealabsAdapter } from '../dealabs.adapter';
import { DealabsUrlOptimizer } from '../dealabs-url-optimizer';
import { FieldExtractorService } from '../../../field-extraction/field-extractor.service';
import { SiteSource } from '@dealscrapper/shared-types';

describe('DealabsAdapter', () => {
  let adapter: DealabsAdapter;
  let fieldExtractor: FieldExtractorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DealabsAdapter,
        DealabsUrlOptimizer,
        FieldExtractorService,
      ],
    }).compile();

    adapter = module.get<DealabsAdapter>(DealabsAdapter);
    fieldExtractor = module.get<FieldExtractorService>(FieldExtractorService);
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
      const url = adapter.buildCategoryUrl('high-tech', 1);
      expect(url).toBe('https://www.dealabs.com/groupe/high-tech?page=1');
    });

    it('should build hub category URL', () => {
      const url = adapter.buildCategoryUrl('hub-gaming', 2);
      expect(url).toBe('https://www.dealabs.com/groupe/hub/gaming?page=2');
    });

    it('should handle default page number', () => {
      const url = adapter.buildCategoryUrl('high-tech');
      expect(url).toBe('https://www.dealabs.com/groupe/high-tech?page=1');
    });
  });

  describe('extractCategorySlug()', () => {
    it('should extract regular category slug', () => {
      const slug = adapter.extractCategorySlug(
        'https://www.dealabs.com/groupe/high-tech?page=1',
      );
      expect(slug).toBe('high-tech');
    });

    it('should extract hub category slug', () => {
      const slug = adapter.extractCategorySlug(
        'https://www.dealabs.com/groupe/hub/gaming?page=1',
      );
      expect(slug).toBe('hub-gaming');
    });

    it('should throw error for invalid URL', () => {
      expect(() => {
        adapter.extractCategorySlug('https://www.dealabs.com/invalid');
      }).toThrow('Cannot extract category slug');
    });
  });

  describe('getListingSelector()', () => {
    it('should return correct selector', () => {
      const selector = adapter.getListingSelector();
      expect(selector).toBe('article.thread, article[data-thread-id], article[id^="thread_"]');
    });
  });

  describe('extractListings()', () => {
    it('should extract listings from HTML fixture', () => {
      const html = `
        <div>
          <article class="thread" data-thread-id="thread_123">
            <a class="thread-link--title" href="/bons-plans/test-deal">Test Deal</a>
            <span class="thread-price">€99.99</span>
            <button class="cept-vote-temp">150°</button>
            <a data-t="commentsLink">42 commentaires</a>
            <img class="thread-image" src="/image.jpg" />
            <span class="thread-merchant">Amazon</span>
            <span class="chip span">il y a 2h</span>
          </article>
          <article class="thread" data-thread-id="thread_456">
            <a class="thread-link--title" href="/bons-plans/another-deal">Another Deal</a>
            <span class="thread-price">€49.99</span>
            <button class="cept-vote-temp">200°</button>
            <a data-t="commentsLink">10 commentaires</a>
          </article>
        </div>
      `;

      const sourceUrl = 'https://www.dealabs.com/groupe/high-tech?page=1';
      const listings = adapter.extractListings(html, sourceUrl);

      expect(listings).toHaveLength(2);
      expect(listings[0].externalId).toBe('123');
      expect(listings[0].title).toBe('Test Deal');
      expect(listings[0].source).toBe(SiteSource.DEALABS);
      expect(listings[0].categorySlug).toBe('high-tech');
      expect(listings[0].siteSpecificData.type).toBe('dealabs');
    });

    it('should handle empty HTML', () => {
      const html = '<div></div>';
      const sourceUrl = 'https://www.dealabs.com/groupe/high-tech?page=1';

      const listings = adapter.extractListings(html, sourceUrl);

      expect(listings).toHaveLength(0);
    });

    it('should skip invalid listings', () => {
      const html = `
        <div>
          <article class="thread" data-thread-id="thread_123">
            <!-- Missing required fields -->
          </article>
          <article class="thread" data-thread-id="thread_456">
            <a class="thread-link--title" href="/bons-plans/valid-deal">Valid Deal</a>
          </article>
        </div>
      `;

      const sourceUrl = 'https://www.dealabs.com/groupe/high-tech?page=1';
      const listings = adapter.extractListings(html, sourceUrl);

      // Only valid listing should be extracted
      expect(listings.length).toBeLessThanOrEqual(1);
    });
  });

  describe('validateHtml()', () => {
    it('should validate valid Dealabs HTML with data-thread-id', () => {
      const html = '<div class="threadGrid"><article data-thread-id="123"></article></div>';

      expect(() => {
        adapter.validateHtml(html);
      }).not.toThrow();
    });

    it('should validate valid Dealabs HTML with id="thread_" pattern', () => {
      const html = '<article id="thread_3297895" class="thread cept-thread-item thread--newCard"></article>';

      expect(() => {
        adapter.validateHtml(html);
      }).not.toThrow();
    });

    it('should throw error for empty HTML', () => {
      expect(() => {
        adapter.validateHtml('');
      }).toThrow('Empty HTML content');
    });

    it('should throw error for invalid structure', () => {
      const html = '<div>Random content without thread markers</div>';

      expect(() => {
        adapter.validateHtml(html);
      }).toThrow('Invalid Dealabs HTML structure');
    });
  });

  describe('extractElementCount()', () => {
    it('should extract element count from HTML', () => {
      const html = '<div class="threadGrid-headerMeta">123 deals trouvés</div>';

      const count = adapter.extractElementCount(html);

      expect(count).toBe(123);
    });

    it('should return undefined if count not found', () => {
      const html = '<div>No count here</div>';

      const count = adapter.extractElementCount(html);

      expect(count).toBeUndefined();
    });
  });
});
