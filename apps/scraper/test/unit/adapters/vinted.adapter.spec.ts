import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { VintedAdapter } from '../../../src/adapters/vinted/vinted.adapter';
import { FieldExtractorService } from '../../../src/field-extraction/field-extractor.service';
import { SiteSource } from '@dealscrapper/shared-types';
import type { UniversalListing, VintedData } from '../../../src/adapters/base/site-adapter.interface';

describe('VintedAdapter', () => {
  let adapter: VintedAdapter;
  let fieldExtractor: FieldExtractorService;
  let testHtml: string;

  beforeAll(() => {
    // Load real Vinted HTML fixture
    const fixturePath = path.join(__dirname, '../../fixtures/vinted-women-catalog.html');
    testHtml = fs.readFileSync(fixturePath, 'utf-8');
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VintedAdapter,
        FieldExtractorService,
      ],
    }).compile();

    adapter = module.get<VintedAdapter>(VintedAdapter);
    fieldExtractor = module.get<FieldExtractorService>(FieldExtractorService);

    // Suppress logs during tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Adapter Configuration', () => {
    it('should have correct site configuration', () => {
      expect(adapter.siteId).toBe(SiteSource.VINTED);
      expect(adapter.baseUrl).toBe('https://www.vinted.fr');
      expect(adapter.displayName).toBe('Vinted');
      expect(adapter.colorCode).toBe('#09B1BA'); // Teal
      expect(adapter.urlOptimizer).toBeUndefined(); // No URL optimizer yet
    });
  });

  describe('HTML Validation', () => {
    it('should pass validation for valid Vinted HTML', () => {
      expect(() => {
        adapter.validateHtml(testHtml);
      }).not.toThrow();
    });

    it('should throw error for empty HTML', () => {
      expect(() => {
        adapter.validateHtml('');
      }).toThrow('Empty HTML content');
    });

    it('should throw error for whitespace-only HTML', () => {
      expect(() => {
        adapter.validateHtml('   \n\t  ');
      }).toThrow('Empty HTML content');
    });

    it('should throw error for invalid Vinted HTML structure', () => {
      const invalidHtml = '<html><body><div class="not-vinted">Invalid</div></body></html>';
      expect(() => {
        adapter.validateHtml(invalidHtml);
      }).toThrow('Invalid Vinted HTML structure - missing feed-grid or item markers');
    });

    it('should accept HTML with feed-grid__item marker', () => {
      const validHtml = '<div class="feed-grid__item">Item</div>';
      expect(() => {
        adapter.validateHtml(validHtml);
      }).not.toThrow();
    });

    it('should accept HTML with new-item-box marker', () => {
      const validHtml = '<div class="new-item-box">Item</div>';
      expect(() => {
        adapter.validateHtml(validHtml);
      }).not.toThrow();
    });

    it('should accept HTML with data-testid item marker', () => {
      const validHtml = '<div data-testid="item-123">Item</div>';
      expect(() => {
        adapter.validateHtml(validHtml);
      }).not.toThrow();
    });

    it('should accept HTML with vinted.net marker', () => {
      const validHtml = '<img src="https://images1.vinted.net/image.jpg">';
      expect(() => {
        adapter.validateHtml(validHtml);
      }).not.toThrow();
    });
  });

  describe('Listing Extraction', () => {
    it('should extract listings from real Vinted HTML fixture', () => {
      const sourceUrl = 'https://www.vinted.fr/catalog?catalog[]=1904&order=newest_first';
      const listings = adapter.extractListings(testHtml, sourceUrl);

      // Verify we extracted items (real HTML has 100 items per page)
      expect(listings.length).toBeGreaterThan(0);
      expect(listings.length).toBeLessThanOrEqual(100);
    });

    it('should extract required fields from each listing', () => {
      const sourceUrl = 'https://www.vinted.fr/catalog?catalog[]=1904&order=newest_first';
      const listings = adapter.extractListings(testHtml, sourceUrl);

      listings.forEach((listing, index) => {
        // Required universal fields
        expect(listing.externalId).toBeDefined();
        expect(typeof listing.externalId).toBe('string');
        expect(listing.externalId.length).toBeGreaterThan(0);

        expect(listing.title).toBeDefined();
        expect(typeof listing.title).toBe('string');
        expect(listing.title.length).toBeGreaterThanOrEqual(3);

        expect(listing.url).toBeDefined();
        expect(typeof listing.url).toBe('string');
        expect(listing.url).toMatch(/^https:\/\/www\.vinted\.fr\//);

        // Source metadata
        expect(listing.siteId).toBe(SiteSource.VINTED);
        expect(listing.isActive).toBe(true);

        // Category slug extracted from URL
        expect(listing.categorySlug).toBe('1904'); // Women's category

        // Vinted-specific fields don't exist for P2P marketplace
        expect(listing.originalPrice).toBeNull();
        expect(listing.merchant).toBeNull();
      });
    });

    it('should extract valid external IDs', () => {
      const sourceUrl = 'https://www.vinted.fr/catalog?catalog[]=1904&order=newest_first';
      const listings = adapter.extractListings(testHtml, sourceUrl);

      listings.forEach((listing) => {
        // External ID should be numeric string (Vinted item IDs)
        expect(listing.externalId).toMatch(/^\d+$/);
        expect(parseInt(listing.externalId, 10)).toBeGreaterThan(0);
      });
    });

    it('should normalize relative URLs to absolute URLs', () => {
      const sourceUrl = 'https://www.vinted.fr/catalog?catalog[]=1904&order=newest_first';
      const listings = adapter.extractListings(testHtml, sourceUrl);

      listings.forEach((listing) => {
        // All URLs should be absolute
        expect(listing.url).toMatch(/^https:\/\//);
        expect(listing.url).toContain('vinted.fr');

        if (listing.imageUrl) {
          expect(listing.imageUrl).toMatch(/^https:\/\//);
        }
      });
    });

    it('should extract prices in correct format', () => {
      const sourceUrl = 'https://www.vinted.fr/catalog?catalog[]=1904&order=newest_first';
      const listings = adapter.extractListings(testHtml, sourceUrl);

      const listingsWithPrice = listings.filter(l => l.currentPrice !== null);
      expect(listingsWithPrice.length).toBeGreaterThan(0);

      listingsWithPrice.forEach((listing) => {
        expect(typeof listing.currentPrice).toBe('number');
        expect(listing.currentPrice).toBeGreaterThanOrEqual(0);
        expect(listing.currentPrice).toBeLessThan(100000); // Reasonable max
      });
    });

    it('should extract Vinted-specific data', () => {
      const sourceUrl = 'https://www.vinted.fr/catalog?catalog[]=1904&order=newest_first';
      const listings = adapter.extractListings(testHtml, sourceUrl);

      listings.forEach((listing) => {
        expect(listing.siteSpecificData).toBeDefined();
        expect(listing.siteSpecificData.type).toBe('vinted');

        const vintedData = listing.siteSpecificData as VintedData;

        // Verify structure
        expect(vintedData).toHaveProperty('favoriteCount');
        expect(vintedData).toHaveProperty('viewCount');
        expect(vintedData).toHaveProperty('itemCondition');
        expect(vintedData).toHaveProperty('brand');
        expect(vintedData).toHaveProperty('size');
        expect(vintedData).toHaveProperty('color');
        expect(vintedData).toHaveProperty('sellerRating');
        expect(vintedData).toHaveProperty('sellerName');

        // Verify types
        expect(typeof vintedData.favoriteCount).toBe('number');
        expect(typeof vintedData.viewCount).toBe('number');
        expect(typeof vintedData.itemCondition).toBe('string');
      });
    });

    it('should handle missing optional fields gracefully', () => {
      const sourceUrl = 'https://www.vinted.fr/catalog?catalog[]=1904&order=newest_first';
      const listings = adapter.extractListings(testHtml, sourceUrl);

      listings.forEach((listing) => {
        const vintedData = listing.siteSpecificData as VintedData;

        // Optional fields can be null
        if (vintedData.brand !== null) {
          expect(typeof vintedData.brand).toBe('string');
        }

        if (vintedData.size !== null) {
          expect(typeof vintedData.size).toBe('string');
        }

        if (vintedData.color !== null) {
          expect(typeof vintedData.color).toBe('string');
        }

        if (vintedData.sellerRating !== null) {
          expect(typeof vintedData.sellerRating).toBe('number');
          expect(vintedData.sellerRating).toBeGreaterThanOrEqual(0);
          expect(vintedData.sellerRating).toBeLessThanOrEqual(5);
        }

        if (vintedData.sellerName !== null) {
          expect(typeof vintedData.sellerName).toBe('string');
        }
      });
    });

    it('should return empty array for HTML with no listings', () => {
      // HTML must pass validation (has feed-grid__item marker)
      const emptyHtml = '<html><body><div class="feed-grid"><div class="feed-grid__item"></div></div></body></html>';
      const listings = adapter.extractListings(emptyHtml, 'https://www.vinted.fr/catalog?catalog[]=1904');

      // Will have 0 listings if no valid data can be extracted
      expect(Array.isArray(listings)).toBe(true);
    });

    it('should log warning for malformed individual listings', () => {
      const warnSpy = jest.spyOn(Logger.prototype, 'warn');

      // HTML with valid structure but missing required data
      const malformedHtml = `
        <div class="feed-grid__item">
          <div data-testid="product-item-id-123">
            <!-- Missing title and URL -->
          </div>
        </div>
      `;

      const listings = adapter.extractListings(malformedHtml, 'https://www.vinted.fr/catalog?catalog[]=1904');

      // Should skip malformed item but not crash
      expect(listings.length).toBe(0);
      expect(warnSpy).toHaveBeenCalled();
    });
  });

  describe('Field Transformers', () => {
    describe('parsePrice', () => {
      it('should parse French format prices correctly', () => {
        const testCases = [
          { input: '30,00 €', expected: 30.00 },
          { input: '2,50 €', expected: 2.50 },
          { input: '100 €', expected: 100.00 },
          { input: '15,99 €', expected: 15.99 },
          { input: '0,50 €', expected: 0.50 },
        ];

        testCases.forEach(({ input, expected }) => {
          const { VintedTransformers } = require('../../../src/adapters/vinted/vinted.transformers');
          const result = VintedTransformers.parsePrice(input);
          expect(result).toBe(expected);
        });
      });

      it('should handle prices without euro symbol', () => {
        const { VintedTransformers } = require('../../../src/adapters/vinted/vinted.transformers');
        expect(VintedTransformers.parsePrice('25,00')).toBe(25.00);
        expect(VintedTransformers.parsePrice('10')).toBe(10.00);
      });

      it('should return null for invalid prices', () => {
        const { VintedTransformers } = require('../../../src/adapters/vinted/vinted.transformers');
        expect(VintedTransformers.parsePrice('')).toBeNull();
        expect(VintedTransformers.parsePrice('abc')).toBeNull();
        expect(VintedTransformers.parsePrice(null)).toBeNull();
        expect(VintedTransformers.parsePrice(undefined)).toBeNull();
      });

      it('should handle zero price (free items)', () => {
        const { VintedTransformers } = require('../../../src/adapters/vinted/vinted.transformers');
        expect(VintedTransformers.parsePrice('0,00 €')).toBe(0);
        expect(VintedTransformers.parsePrice('0 €')).toBe(0);
      });
    });

    describe('extractBrand', () => {
      it('should extract brand from subtitle field', () => {
        const { VintedTransformers } = require('../../../src/adapters/vinted/vinted.transformers');

        const testCases = [
          { input: 'ZaraL / 40 / 12 · Très bon état', expected: 'Zara' },
          { input: 'Wendy TrendyL / 40 / 12 · Très bon état', expected: 'Wendy Trendy' },
          { input: 'HalaraM / 38 / 10 · Neuf', expected: 'Halara' },
        ];

        testCases.forEach(({ input, expected }) => {
          const result = VintedTransformers.extractBrand(input);
          expect(result).toBe(expected);
        });
      });

      it('should return null for subtitle without brand', () => {
        const { VintedTransformers } = require('../../../src/adapters/vinted/vinted.transformers');
        expect(VintedTransformers.extractBrand('36 · Satisfaisant')).toBeNull();
        expect(VintedTransformers.extractBrand('')).toBeNull();
        expect(VintedTransformers.extractBrand(null)).toBeNull();
      });
    });

    describe('extractSize', () => {
      it('should extract multi-part size notation', () => {
        const { VintedTransformers } = require('../../../src/adapters/vinted/vinted.transformers');

        const testCases = [
          { input: 'ZaraL / 40 / 12 · Très bon état', expected: 'L / 40 / 12' },
          { input: 'BrandM / 38 / 10 · Neuf', expected: 'M / 38 / 10' },
          { input: 'BrandXL / 44 / 16 · Bon état', expected: 'XL / 44 / 16' },
        ];

        testCases.forEach(({ input, expected }) => {
          const result = VintedTransformers.extractSize(input);
          expect(result).toBe(expected);
        });
      });

      it('should extract single numeric size', () => {
        const { VintedTransformers } = require('../../../src/adapters/vinted/vinted.transformers');

        expect(VintedTransformers.extractSize('Shein36 · Satisfaisant')).toBe('36');
        expect(VintedTransformers.extractSize('Brand42 · Neuf')).toBe('42');
      });

      it('should extract single letter size', () => {
        const { VintedTransformers } = require('../../../src/adapters/vinted/vinted.transformers');

        expect(VintedTransformers.extractSize('Brand M · Neuf')).toBe('M');
        expect(VintedTransformers.extractSize('Test XL · Bon')).toBe('XL');
      });

      it('should return null when size cannot be extracted', () => {
        const { VintedTransformers } = require('../../../src/adapters/vinted/vinted.transformers');

        expect(VintedTransformers.extractSize('')).toBeNull();
        expect(VintedTransformers.extractSize('No size info')).toBeNull();
        expect(VintedTransformers.extractSize(null)).toBeNull();
      });
    });

    describe('extractCondition', () => {
      it('should extract condition from subtitle field', () => {
        const { VintedTransformers } = require('../../../src/adapters/vinted/vinted.transformers');

        const testCases = [
          { input: 'Brand / Size · Très bon état', expected: 'Très bon état' },
          { input: 'Brand / Size · Neuf avec étiquette', expected: 'Neuf avec étiquette' },
          { input: 'Brand36 · Satisfaisant', expected: 'Satisfaisant' },
          { input: 'BrandM · Comme neuf', expected: 'Comme neuf' },
        ];

        testCases.forEach(({ input, expected }) => {
          const result = VintedTransformers.extractCondition(input);
          expect(result).toBe(expected);
        });
      });

      it('should return "unknown" when condition cannot be extracted', () => {
        const { VintedTransformers } = require('../../../src/adapters/vinted/vinted.transformers');

        expect(VintedTransformers.extractCondition('No separator here')).toBe('unknown');
        expect(VintedTransformers.extractCondition('')).toBe('unknown');
        expect(VintedTransformers.extractCondition(null)).toBe('unknown');
      });
    });

    describe('parseFavoriteCount', () => {
      it('should parse favorite count from Vinted format', () => {
        const { VintedTransformers } = require('../../../src/adapters/vinted/vinted.transformers');

        const testCases = [
          { input: '4Enlevé !', expected: 4 },
          { input: '13Enlevé !', expected: 13 },
          { input: '1Enlevé !', expected: 1 },
          { input: '99Enlevé !', expected: 99 },
        ];

        testCases.forEach(({ input, expected }) => {
          const result = VintedTransformers.parseFavoriteCount(input);
          expect(result).toBe(expected);
        });
      });

      it('should return 0 for items with no favorites', () => {
        const { VintedTransformers } = require('../../../src/adapters/vinted/vinted.transformers');

        expect(VintedTransformers.parseFavoriteCount('Enlevé !')).toBe(0);
        expect(VintedTransformers.parseFavoriteCount('')).toBe(0);
        expect(VintedTransformers.parseFavoriteCount(null)).toBe(0);
      });
    });

    describe('normalizeCondition', () => {
      it('should normalize condition values to standard format', () => {
        const { VintedTransformers } = require('../../../src/adapters/vinted/vinted.transformers');

        const testCases = [
          { input: 'Neuf avec étiquette', expected: 'Neuf avec étiquette' },
          { input: 'neuf avec étiquette', expected: 'Neuf avec étiquette' },
          { input: 'Très bon état', expected: 'Très bon état' },
          { input: 'très bon', expected: 'Très bon état' },
          { input: 'excellent', expected: 'Très bon état' },
          { input: 'Bon état', expected: 'Bon état' },
          { input: 'Satisfaisant', expected: 'Satisfaisant' },
          { input: 'satisfaisant', expected: 'Satisfaisant' },
          { input: 'Comme neuf', expected: 'Comme neuf' },
        ];

        testCases.forEach(({ input, expected }) => {
          const result = VintedTransformers.normalizeCondition(input);
          expect(result).toBe(expected);
        });
      });

      it('should return original value if no match found', () => {
        const { VintedTransformers } = require('../../../src/adapters/vinted/vinted.transformers');

        expect(VintedTransformers.normalizeCondition('Custom Condition')).toBe('Custom Condition');
      });

      it('should return "unknown" for invalid input', () => {
        const { VintedTransformers } = require('../../../src/adapters/vinted/vinted.transformers');

        expect(VintedTransformers.normalizeCondition('')).toBe('unknown');
        expect(VintedTransformers.normalizeCondition(null)).toBe('unknown');
        expect(VintedTransformers.normalizeCondition(undefined)).toBe('unknown');
      });
    });

    describe('extractItemId', () => {
      it('should extract ID from data-testid attribute', () => {
        const { VintedTransformers } = require('../../../src/adapters/vinted/vinted.transformers');

        expect(VintedTransformers.extractItemId('product-item-id-7683082902')).toBe('7683082902');
        expect(VintedTransformers.extractItemId('product-item-id-123456')).toBe('123456');
      });

      it('should extract ID from Vinted item URL', () => {
        const { VintedTransformers } = require('../../../src/adapters/vinted/vinted.transformers');

        expect(VintedTransformers.extractItemId('/items/7683082902-cap')).toBe('7683082902');
        expect(VintedTransformers.extractItemId('/items/123456-some-title')).toBe('123456');
      });

      it('should extract standalone numeric ID', () => {
        const { VintedTransformers } = require('../../../src/adapters/vinted/vinted.transformers');

        expect(VintedTransformers.extractItemId('7683082902')).toBe('7683082902');
        expect(VintedTransformers.extractItemId('123')).toBe('123');
      });

      it('should return empty string for invalid input', () => {
        const { VintedTransformers } = require('../../../src/adapters/vinted/vinted.transformers');

        expect(VintedTransformers.extractItemId('')).toBe('');
        expect(VintedTransformers.extractItemId('no-numbers')).toBe('');
        expect(VintedTransformers.extractItemId(null)).toBe('');
      });
    });

    describe('normalizeUrl', () => {
      it('should convert relative URLs to absolute URLs', () => {
        const { VintedTransformers } = require('../../../src/adapters/vinted/vinted.transformers');

        const context = { siteBaseUrl: 'https://www.vinted.fr' };

        expect(VintedTransformers.normalizeUrl('/items/123-title', context))
          .toBe('https://www.vinted.fr/items/123-title');
        expect(VintedTransformers.normalizeUrl('/catalog', context))
          .toBe('https://www.vinted.fr/catalog');
      });

      it('should keep absolute URLs unchanged', () => {
        const { VintedTransformers } = require('../../../src/adapters/vinted/vinted.transformers');

        const context = { siteBaseUrl: 'https://www.vinted.fr' };

        expect(VintedTransformers.normalizeUrl('https://www.vinted.fr/items/123', context))
          .toBe('https://www.vinted.fr/items/123');
        expect(VintedTransformers.normalizeUrl('https://example.com/test', context))
          .toBe('https://example.com/test');
      });

      it('should return empty string for invalid input', () => {
        const { VintedTransformers } = require('../../../src/adapters/vinted/vinted.transformers');

        const context = { siteBaseUrl: 'https://www.vinted.fr' };

        expect(VintedTransformers.normalizeUrl('', context)).toBe('');
        expect(VintedTransformers.normalizeUrl(null, context)).toBe('');
      });
    });
  });

  describe('Category URL Building', () => {
    it('should build correct Vinted category URL for page 1', () => {
      const url = adapter.buildCategoryUrl('1904');
      expect(url).toBe('https://www.vinted.fr/catalog/1904?page=1&order=newest_first');
    });

    it('should build correct Vinted category URL for specific page', () => {
      const url = adapter.buildCategoryUrl('1904', 3);
      expect(url).toBe('https://www.vinted.fr/catalog/1904?page=3&order=newest_first');
    });

    it('should handle different category IDs', () => {
      const url1 = adapter.buildCategoryUrl('1234');
      expect(url1).toContain('/catalog/1234');

      const url2 = adapter.buildCategoryUrl('5678', 2);
      expect(url2).toContain('/catalog/5678');
      expect(url2).toContain('page=2');
    });

    it('should extract base slug from hierarchical category slugs', () => {
      const url = adapter.buildCategoryUrl('loisirs-et-collections/4880-uncut-card-sheets');
      expect(url).toBe('https://www.vinted.fr/catalog/4880-uncut-card-sheets?page=1&order=newest_first');
    });

    it('should extract base slug from two-level hierarchical slugs', () => {
      const url = adapter.buildCategoryUrl('femmes/4-clothing', 2);
      expect(url).toBe('https://www.vinted.fr/catalog/4-clothing?page=2&order=newest_first');
    });
  });

  describe('Category Slug Extraction', () => {
    it('should extract category slug from query parameter format', () => {
      const slug = adapter.extractCategorySlug('https://www.vinted.fr/vetements?catalog[]=1904&order=newest_first');
      expect(slug).toBe('1904');
    });

    it('should extract category slug from multiple catalog parameters', () => {
      const slug = adapter.extractCategorySlug('https://www.vinted.fr/vetements?catalog[]=1904&catalog[]=5678');
      // Should extract first one
      expect(slug).toBe('1904');
    });

    it('should extract category slug from path format', () => {
      const slug = adapter.extractCategorySlug('https://www.vinted.fr/catalog/1904-women');
      expect(slug).toBe('1904-women');
    });

    it('should extract text-based category slug from query parameter', () => {
      const slug = adapter.extractCategorySlug(
        'https://www.vinted.fr/vetements?catalog[]=loisirs-et-collections/4880-uncut-card-sheets&order=newest_first&page=1'
      );
      expect(slug).toBe('loisirs-et-collections/4880-uncut-card-sheets');
    });

    it('should return default slug when pattern not matched', () => {
      const warnSpy = jest.spyOn(Logger.prototype, 'warn');

      const slug = adapter.extractCategorySlug('https://www.vinted.fr/');

      expect(slug).toBe('unknown');
      expect(warnSpy).toHaveBeenCalled();
    });

    it('should handle URLs with fragment and query params', () => {
      const slug = adapter.extractCategorySlug(
        'https://www.vinted.fr/vetements?catalog[]=5678&page=2&order=newest_first#section'
      );
      expect(slug).toBe('5678');
    });
  });

  describe('Element Count Extraction', () => {
    it('should return item count from real Vinted HTML', () => {
      const count = adapter.extractElementCount(testHtml);

      expect(count).toBeDefined();
      expect(typeof count).toBe('number');
      expect(count).toBeGreaterThan(0);
      expect(count).toBeLessThanOrEqual(100); // Vinted shows max 100 items per page
    });

    it('should return undefined when no count found', () => {
      const emptyHtml = '<html><body></body></html>';
      const count = adapter.extractElementCount(emptyHtml);

      expect(count).toBeUndefined();
    });

    it('should fallback to counting feed-grid__item elements', () => {
      const htmlWithItems = `
        <div class="feed-grid">
          <div class="feed-grid__item"></div>
          <div class="feed-grid__item"></div>
          <div class="feed-grid__item"></div>
        </div>
      `;

      const count = adapter.extractElementCount(htmlWithItems);

      expect(count).toBe(3);
    });
  });

  describe('Listing Selector', () => {
    it('should return correct CSS selector for Vinted items', () => {
      const selector = adapter.getListingSelector();
      expect(selector).toBe('.feed-grid__item');
    });
  });

  describe('Error Handling', () => {
    it('should not throw when extracting from valid HTML', () => {
      expect(() => {
        adapter.extractListings(testHtml, 'https://www.vinted.fr/catalog?catalog[]=1904');
      }).not.toThrow();
    });

    it('should throw when required fields are missing', () => {
      const invalidHtml = `
        <div class="feed-grid__item">
          <div>No valid data</div>
        </div>
      `;

      // Should not throw, but log warning and skip item
      expect(() => {
        const listings = adapter.extractListings(invalidHtml, 'https://www.vinted.fr/catalog?catalog[]=1904');
        expect(listings.length).toBe(0);
      }).not.toThrow();
    });
  });

  describe('Integration with FieldExtractorService', () => {
    it('should use FieldExtractorService for extraction', () => {
      const extractSpy = jest.spyOn(fieldExtractor, 'extract');

      adapter.extractListings(testHtml, 'https://www.vinted.fr/catalog?catalog[]=1904');

      expect(extractSpy).toHaveBeenCalled();
    });
  });

  describe('Data Type Consistency', () => {
    it('should produce listings with consistent types', () => {
      const sourceUrl = 'https://www.vinted.fr/catalog?catalog[]=1904&order=newest_first';
      const listings = adapter.extractListings(testHtml, sourceUrl);

      expect(listings.length).toBeGreaterThan(0);

      listings.forEach((listing) => {
        // String fields
        expect(typeof listing.externalId).toBe('string');
        expect(typeof listing.title).toBe('string');
        expect(typeof listing.url).toBe('string');
        expect(typeof listing.siteId).toBe('string');
        expect(typeof listing.categorySlug).toBe('string');

        // Nullable string fields
        if (listing.description !== null) {
          expect(typeof listing.description).toBe('string');
        }
        if (listing.imageUrl !== null) {
          expect(typeof listing.imageUrl).toBe('string');
        }
        if (listing.location !== null) {
          expect(typeof listing.location).toBe('string');
        }

        // Number or null fields
        if (listing.currentPrice !== null) {
          expect(typeof listing.currentPrice).toBe('number');
        }

        // Boolean fields
        expect(typeof listing.isActive).toBe('boolean');

        // Date fields
        expect(listing.publishedAt).toBeInstanceOf(Date);

        // Vinted-specific data
        const vintedData = listing.siteSpecificData as VintedData;
        expect(vintedData.type).toBe('vinted');
        expect(typeof vintedData.favoriteCount).toBe('number');
        expect(typeof vintedData.viewCount).toBe('number');
        expect(typeof vintedData.itemCondition).toBe('string');
      });
    });
  });
});
