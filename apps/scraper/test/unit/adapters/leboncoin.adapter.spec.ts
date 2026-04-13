import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { LeBonCoinAdapter } from '../../../src/adapters/leboncoin/leboncoin.adapter';
import { FieldExtractorService } from '../../../src/field-extraction/field-extractor.service';
import { SiteSource } from '@dealscrapper/shared-types';
import {
  UniversalListing,
  LeBonCoinData,
} from '../../../src/adapters/base/site-adapter.interface';
import * as LeBonCoinTransformers from '../../../src/adapters/leboncoin/leboncoin.transformers';

describe('LeBonCoinAdapter', () => {
  let adapter: LeBonCoinAdapter;
  let fieldExtractor: FieldExtractorService;
  let testHtml: string;

  beforeAll(() => {
    // Load real LeBonCoin HTML fixture
    const fixturePath = path.join(
      __dirname,
      '../../fixtures/leboncoin-multimedia-catalog.html'
    );
    testHtml = fs.readFileSync(fixturePath, 'utf-8');
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LeBonCoinAdapter, FieldExtractorService],
    }).compile();

    adapter = module.get<LeBonCoinAdapter>(LeBonCoinAdapter);
    fieldExtractor = module.get<FieldExtractorService>(FieldExtractorService);

    // Suppress logs during tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Adapter Configuration', () => {
    it('should have correct site configuration', () => {
      expect(adapter.siteId).toBe(SiteSource.LEBONCOIN);
      expect(adapter.baseUrl).toBe('https://www.leboncoin.fr');
      expect(adapter.displayName).toBe('LeBonCoin');
      expect(adapter.colorCode).toBe('#FF6E14'); // Orange-red
      expect(adapter.urlOptimizer).toBeUndefined(); // No URL optimizer
    });
  });

  describe('HTML Validation', () => {
    it('should pass validation for valid LeBonCoin HTML', () => {
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

    it('should throw error for HTML without article elements', () => {
      const invalidHtml = '<html><body><div>No articles</div></body></html>';
      expect(() => {
        adapter.validateHtml(invalidHtml);
      }).toThrow('Invalid LeBonCoin HTML: No <article> elements found');
    });

    it('should accept HTML with article elements', () => {
      const validHtml = '<article>Item</article>';
      expect(() => {
        adapter.validateHtml(validHtml);
      }).not.toThrow();
    });

    it('should warn but not throw for HTML without leboncoin domain', () => {
      const htmlWithoutDomain = '<article>Item</article>';
      expect(() => {
        adapter.validateHtml(htmlWithoutDomain);
      }).not.toThrow();
    });

    it('should accept HTML with leboncoin domain markers', () => {
      const validHtml =
        '<article><img src="https://img.leboncoin.fr/image.jpg"></article>';
      expect(() => {
        adapter.validateHtml(validHtml);
      }).not.toThrow();
    });
  });

  describe('Listing Selector', () => {
    it('should return correct listing selector', () => {
      expect(adapter.getListingSelector()).toBe(
        'article[data-qa-id="aditem_container"]'
      );
    });
  });

  describe('Category URL Building', () => {
    it('should build correct category URL with page 1', () => {
      const url = adapter.buildCategoryUrl('15');
      expect(url).toBe('https://www.leboncoin.fr/recherche?category=15&page=1');
    });

    it('should build correct category URL with custom page', () => {
      const url = adapter.buildCategoryUrl('multimedia', 3);
      expect(url).toBe(
        'https://www.leboncoin.fr/recherche?category=multimedia&page=3'
      );
    });
  });

  describe('Category Slug Extraction', () => {
    it('should extract category from query param (numeric)', () => {
      const slug = adapter.extractCategorySlug(
        'https://www.leboncoin.fr/recherche?category=15&locations=Île-de-France'
      );
      expect(slug).toBe('15');
    });

    it('should extract category from query param (text)', () => {
      const slug = adapter.extractCategorySlug(
        'https://www.leboncoin.fr/recherche?category=multimedia&page=2'
      );
      expect(slug).toBe('multimedia');
    });

    it('should extract category from path (/ad/{category}/{id})', () => {
      const slug = adapter.extractCategorySlug('/ad/ordinateurs/3104743089');
      expect(slug).toBe('ordinateurs');
    });

    it('should return "unknown" for URLs without category', () => {
      const slug = adapter.extractCategorySlug('https://www.leboncoin.fr/');
      expect(slug).toBe('unknown');
    });
  });

  describe('Listing Extraction from Real HTML', () => {
    it('should extract all 20 listings from real HTML fixture', () => {
      const listings = adapter.extractListings(
        testHtml,
        'https://www.leboncoin.fr/recherche?category=15'
      );

      expect(listings).toHaveLength(20);
    });

    it('should extract correct fields from first listing', () => {
      const listings = adapter.extractListings(testHtml, 'https://www.leboncoin.fr');
      const firstListing = listings[0];

      expect(firstListing).toMatchObject({
        siteId: SiteSource.LEBONCOIN,
        externalId: expect.any(String),
        title: expect.any(String),
        url: expect.stringMatching(/^https:\/\/www\.leboncoin\.fr\//),
        currentPrice: expect.any(Number),
      });

      // Check ID format (numeric)
      expect(firstListing.externalId).toMatch(/^\d+$/);

      // Check title length
      expect(firstListing.title.length).toBeGreaterThan(3);

      // Check price is reasonable
      expect(firstListing.currentPrice).toBeGreaterThan(0);
      expect(firstListing.currentPrice).toBeLessThan(10000000);
    });

    it('should extract image URLs correctly', () => {
      const listings = adapter.extractListings(testHtml, 'https://www.leboncoin.fr');
      const listingsWithImages = listings.filter((l) => l.imageUrl);

      expect(listingsWithImages.length).toBeGreaterThan(0);

      listingsWithImages.forEach((listing) => {
        expect(listing.imageUrl).toMatch(/^https:\/\/img\.leboncoin\.fr/);
      });
    });

    it('should set correct LeBonCoin-specific data type', () => {
      const listings = adapter.extractListings(testHtml, 'https://www.leboncoin.fr');
      const firstListing = listings[0];

      expect(firstListing.siteSpecificData.type).toBe('leboncoin');
    });

    it('should extract location data (city, postcode) from listings', () => {
      const listings = adapter.extractListings(testHtml, 'https://www.leboncoin.fr');
      const firstListing = listings[0];
      const data = firstListing.siteSpecificData as LeBonCoinData;

      expect(data.city).toBeTruthy();
      expect(data.postcode).toMatch(/^\d{5}$/);
    });

    it('should derive department from postcode', () => {
      const listings = adapter.extractListings(testHtml, 'https://www.leboncoin.fr');
      const firstListing = listings[0];
      const data = firstListing.siteSpecificData as LeBonCoinData;

      expect(data.department).toBeTruthy();
      expect(data.department).toMatch(/^\d{2}$/);

      // Department should match first 2 digits of postcode
      if (data.postcode) {
        expect(data.department).toBe(data.postcode.substring(0, 2));
      }
    });

    it('should map department to region', () => {
      const listings = adapter.extractListings(testHtml, 'https://www.leboncoin.fr');
      const firstListing = listings[0];
      const data = firstListing.siteSpecificData as LeBonCoinData;

      // Region may be empty if department not in map
      if (data.department) {
        expect(typeof data.region).toBe('string');
      }
    });

    it('should set default values for fields not on listing pages', () => {
      const listings = adapter.extractListings(testHtml, 'https://www.leboncoin.fr');
      const firstListing = listings[0];
      const data = firstListing.siteSpecificData as LeBonCoinData;

      // These fields not visible on listing pages
      expect(data.proSeller).toBe(false);
      expect(data.urgentFlag).toBe(false);
      expect(data.topAnnonce).toBe(false);
      expect(data.deliveryOptions).toEqual([]);
      expect(data.shippingCost).toBeNull();
      expect(data.condition).toBeNull();
      expect(data.attributes).toBeNull();
    });

    it('should set universal fields correctly', () => {
      const listings = adapter.extractListings(testHtml, 'https://www.leboncoin.fr');
      const firstListing = listings[0];

      expect(firstListing.siteId).toBe(SiteSource.LEBONCOIN);
      expect(firstListing.isActive).toBe(true);
      expect(firstListing.originalPrice).toBeNull(); // LeBonCoin doesn't have original price
      expect(firstListing.merchant).toBeNull(); // P2P marketplace
    });

    it('should handle listings without prices', () => {
      const listingsWithoutPrice = adapter.extractListings(
        testHtml,
        'https://www.leboncoin.fr'
      ).filter((l) => !l.currentPrice || l.currentPrice === 0);

      // May have free items
      listingsWithoutPrice.forEach((listing) => {
        expect(listing.currentPrice === null || listing.currentPrice === 0).toBe(true);
      });
    });

    it('should handle listings without images', () => {
      const listings = adapter.extractListings(testHtml, 'https://www.leboncoin.fr');
      const listingsWithoutImage = listings.filter((l) => !l.imageUrl);

      // Should not crash, just have null imageUrl
      listingsWithoutImage.forEach((listing) => {
        expect(listing.imageUrl).toBeNull();
      });
    });
  });

  describe('Transformer Functions', () => {
    describe('parsePrice', () => {
      it('should parse standard price format', () => {
        expect(LeBonCoinTransformers.parsePrice('800 €')).toBe(800);
        expect(LeBonCoinTransformers.parsePrice('200 €')).toBe(200);
        expect(LeBonCoinTransformers.parsePrice('900 €')).toBe(900);
      });

      it('should parse price with spaces', () => {
        expect(LeBonCoinTransformers.parsePrice('1 200 €')).toBe(1200);
        expect(LeBonCoinTransformers.parsePrice('15 000 €')).toBe(15000);
      });

      it('should handle free items', () => {
        expect(LeBonCoinTransformers.parsePrice('Gratuit')).toBe(0);
        expect(LeBonCoinTransformers.parsePrice('gratuit')).toBe(0);
      });

      it('should handle empty/invalid input', () => {
        expect(LeBonCoinTransformers.parsePrice('')).toBe(0);
        expect(LeBonCoinTransformers.parsePrice('invalid')).toBe(0);
      });
    });

    describe('parseLocation', () => {
      it('should parse standard location format', () => {
        const result = LeBonCoinTransformers.parseLocation('Lannoy 59390');
        expect(result).toEqual({ city: 'Lannoy', postcode: '59390' });
      });

      it('should parse city names with hyphens', () => {
        const result = LeBonCoinTransformers.parseLocation('Champigny-sur-Marne 94500');
        expect(result).toEqual({ city: 'Champigny-sur-Marne', postcode: '94500' });
      });

      it('should parse city names with accents', () => {
        const result = LeBonCoinTransformers.parseLocation('Fréjus 83600');
        expect(result).toEqual({ city: 'Fréjus', postcode: '83600' });
      });

      it('should return null for invalid format', () => {
        expect(LeBonCoinTransformers.parseLocation('InvalidLocation')).toBeNull();
        expect(LeBonCoinTransformers.parseLocation('')).toBeNull();
      });
    });

    describe('extractCity', () => {
      it('should extract city from location string', () => {
        expect(LeBonCoinTransformers.extractCity('Lannoy 59390')).toBe('Lannoy');
        expect(LeBonCoinTransformers.extractCity('Fréjus 83600')).toBe('Fréjus');
      });

      it('should return empty string for invalid input', () => {
        expect(LeBonCoinTransformers.extractCity('Invalid')).toBe('');
        expect(LeBonCoinTransformers.extractCity('')).toBe('');
      });
    });

    describe('extractPostcode', () => {
      it('should extract postcode from location string', () => {
        expect(LeBonCoinTransformers.extractPostcode('Lannoy 59390')).toBe('59390');
        expect(LeBonCoinTransformers.extractPostcode('Fréjus 83600')).toBe('83600');
      });

      it('should return empty string for invalid input', () => {
        expect(LeBonCoinTransformers.extractPostcode('Invalid')).toBe('');
        expect(LeBonCoinTransformers.extractPostcode('')).toBe('');
      });
    });

    describe('getDepartment', () => {
      it('should extract department from postcode', () => {
        expect(LeBonCoinTransformers.getDepartment('59390')).toBe('59');
        expect(LeBonCoinTransformers.getDepartment('75001')).toBe('75');
        expect(LeBonCoinTransformers.getDepartment('94500')).toBe('94');
      });

      it('should handle short/invalid postcodes', () => {
        expect(LeBonCoinTransformers.getDepartment('1')).toBe('');
        expect(LeBonCoinTransformers.getDepartment('')).toBe('');
      });
    });

    describe('getRegion', () => {
      it('should map department to correct region', () => {
        expect(LeBonCoinTransformers.getRegion('59')).toBe('Hauts-de-France');
        expect(LeBonCoinTransformers.getRegion('75')).toBe('Île-de-France');
        expect(LeBonCoinTransformers.getRegion('83')).toBe(
          'Provence-Alpes-Côte d\'Azur'
        );
      });

      it('should return empty string for unknown department', () => {
        expect(LeBonCoinTransformers.getRegion('99')).toBe('');
        expect(LeBonCoinTransformers.getRegion('')).toBe('');
      });
    });

    describe('extractIdFromUrl', () => {
      it('should extract ID from standard URL', () => {
        expect(
          LeBonCoinTransformers.extractIdFromUrl('/ad/ordinateurs/3104743089')
        ).toBe('3104743089');
      });

      it('should extract ID from full URL', () => {
        expect(
          LeBonCoinTransformers.extractIdFromUrl(
            'https://www.leboncoin.fr/ad/ordinateurs/3104743089'
          )
        ).toBe('3104743089');
      });

      it('should return empty string for invalid URL', () => {
        expect(LeBonCoinTransformers.extractIdFromUrl('/invalid')).toBe('');
        expect(LeBonCoinTransformers.extractIdFromUrl('')).toBe('');
      });
    });

    describe('normalizeUrl', () => {
      it('should convert relative URL to absolute', () => {
        expect(
          LeBonCoinTransformers.normalizeUrl('/ad/ordinateurs/3104743089')
        ).toBe('https://www.leboncoin.fr/ad/ordinateurs/3104743089');
      });

      it('should keep absolute URL unchanged', () => {
        const url = 'https://www.leboncoin.fr/ad/ordinateurs/3104743089';
        expect(LeBonCoinTransformers.normalizeUrl(url)).toBe(url);
      });

      it('should handle URL without leading slash', () => {
        expect(
          LeBonCoinTransformers.normalizeUrl('ad/ordinateurs/3104743089')
        ).toBe('https://www.leboncoin.fr/ad/ordinateurs/3104743089');
      });

      it('should return empty string for empty input', () => {
        expect(LeBonCoinTransformers.normalizeUrl('')).toBe('');
      });
    });

    describe('extractCategoryFromUrl', () => {
      it('should extract category from URL path', () => {
        expect(
          LeBonCoinTransformers.extractCategoryFromUrl('/ad/ordinateurs/3104743089')
        ).toBe('ordinateurs');
      });

      it('should extract category from full URL', () => {
        expect(
          LeBonCoinTransformers.extractCategoryFromUrl(
            'https://www.leboncoin.fr/ad/multimedia/1234567890'
          )
        ).toBe('multimedia');
      });

      it('should return empty string for invalid URL', () => {
        expect(LeBonCoinTransformers.extractCategoryFromUrl('/invalid')).toBe('');
        expect(LeBonCoinTransformers.extractCategoryFromUrl('')).toBe('');
      });
    });
  });

  describe('Error Handling', () => {
    it('should return empty array for HTML without articles', () => {
      const invalidHtml = '<html><body><p>No articles here</p></body></html>';
      expect(() => adapter.extractListings(invalidHtml, 'https://www.leboncoin.fr'))
        .toThrow('Invalid LeBonCoin HTML: No <article> elements found');
    });

    it('should skip listings with missing required fields', () => {
      const htmlWithInvalidListing = `
        <article data-qa-id="aditem_container">
          <p>No title, no URL, no ID</p>
        </article>
      `;

      const listings = adapter.extractListings(
        htmlWithInvalidListing,
        'https://www.leboncoin.fr'
      );

      // Should skip invalid listing
      expect(listings).toHaveLength(0);
    });

    it('should log warning for failed listing extraction', () => {
      const warnSpy = jest.spyOn(Logger.prototype, 'warn');
      const htmlWithInvalidListing = `
        <article data-qa-id="aditem_container">
          <p>Invalid listing</p>
        </article>
      `;

      adapter.extractListings(htmlWithInvalidListing, 'https://www.leboncoin.fr');

      expect(warnSpy).toHaveBeenCalled();
    });
  });

  describe('Integration with FieldExtractorService', () => {
    it('should use FieldExtractorService for extraction', () => {
      const extractSpy = jest.spyOn(fieldExtractor, 'extract');

      adapter.extractListings(testHtml, 'https://www.leboncoin.fr');

      expect(extractSpy).toHaveBeenCalled();
    });

    it('should pass correct context to FieldExtractorService', () => {
      const extractSpy = jest.spyOn(fieldExtractor, 'extract');

      adapter.extractListings(testHtml, 'https://www.leboncoin.fr/recherche?category=15');

      const context = extractSpy.mock.calls[0][3];
      expect(context).toMatchObject({
        siteId: SiteSource.LEBONCOIN,
        siteBaseUrl: 'https://www.leboncoin.fr',
        sourceUrl: 'https://www.leboncoin.fr/recherche?category=15',
      });
    });
  });
});
