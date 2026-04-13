import { Test, TestingModule } from '@nestjs/testing';
import * as cheerio from 'cheerio';
import { FieldExtractorService } from '../field-extractor.service';
import type { FieldMappingConfig, ExtractionContext } from '../field-mapping-config.interface';
import { SiteSource } from '@dealscrapper/shared-types';

describe('FieldExtractorService', () => {
  let service: FieldExtractorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FieldExtractorService],
    }).compile();

    service = module.get<FieldExtractorService>(FieldExtractorService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('extract()', () => {
    it('should extract text strategy', () => {
      const html = '<div><h1 class="title">Test Title</h1></div>';
      const $ = cheerio.load(html);
      const $element = $('div');

      const config: FieldMappingConfig = {
        title: {
          selectors: ['.title'],
          strategy: 'text',
          required: true,
        },
      };

      const context: Partial<ExtractionContext> = {
        siteId: SiteSource.DEALABS,
        siteBaseUrl: 'https://www.dealabs.com',
        sourceUrl: 'https://www.dealabs.com/test',
      };

      const result = service.extract($, $element, config, context);

      expect(result.title).toBe('Test Title');
    });

    it('should extract attribute strategy', () => {
      const html = '<div><a class="link" href="/test-url">Link</a></div>';
      const $ = cheerio.load(html);
      const $element = $('div');

      const config: FieldMappingConfig = {
        url: {
          selectors: ['.link'],
          strategy: 'attribute',
          attribute: 'href',
          required: true,
        },
      };

      const context: Partial<ExtractionContext> = {
        siteId: SiteSource.DEALABS,
        siteBaseUrl: 'https://www.dealabs.com',
        sourceUrl: 'https://www.dealabs.com/test',
      };

      const result = service.extract($, $element, config, context);

      expect(result.url).toBe('/test-url');
    });

    it('should use fallback selectors', () => {
      const html = '<div><span class="price-alt">€99.99</span></div>';
      const $ = cheerio.load(html);
      const $element = $('div');

      const config: FieldMappingConfig = {
        price: {
          selectors: ['.price-primary', '.price-alt', '.price-fallback'],
          strategy: 'text',
          required: true,
        },
      };

      const context: Partial<ExtractionContext> = {
        siteId: SiteSource.DEALABS,
        siteBaseUrl: 'https://www.dealabs.com',
        sourceUrl: 'https://www.dealabs.com/test',
      };

      const result = service.extract($, $element, config, context);

      expect(result.price).toBe('€99.99');
    });

    it('should apply default value when extraction fails', () => {
      const html = '<div></div>';
      const $ = cheerio.load(html);
      const $element = $('div');

      const config: FieldMappingConfig = {
        temperature: {
          selectors: ['.temperature'],
          strategy: 'text',
          required: false,
          default: 0,
        },
      };

      const context: Partial<ExtractionContext> = {
        siteId: SiteSource.DEALABS,
        siteBaseUrl: 'https://www.dealabs.com',
        sourceUrl: 'https://www.dealabs.com/test',
      };

      const result = service.extract($, $element, config, context);

      expect(result.temperature).toBe(0);
    });

    it('should throw error for required field that fails extraction', () => {
      const html = '<div></div>';
      const $ = cheerio.load(html);
      const $element = $('div');

      const config: FieldMappingConfig = {
        requiredField: {
          selectors: ['.missing'],
          strategy: 'text',
          required: true,
        },
      };

      const context: Partial<ExtractionContext> = {
        siteId: SiteSource.DEALABS,
        siteBaseUrl: 'https://www.dealabs.com',
        sourceUrl: 'https://www.dealabs.com/test',
      };

      expect(() => {
        service.extract($, $element, config, context);
      }).toThrow('Failed to extract required field');
    });
  });

  describe('Built-in transforms', () => {
    it('should apply sanitize transform', () => {
      const html = '<div><p class="text">  Test   with   spaces  </p></div>';
      const $ = cheerio.load(html);
      const $element = $('div');

      const config: FieldMappingConfig = {
        text: {
          selectors: ['.text'],
          strategy: 'text',
          transform: ['sanitize'],
        },
      };

      const context: Partial<ExtractionContext> = {
        siteId: SiteSource.DEALABS,
        siteBaseUrl: 'https://www.dealabs.com',
        sourceUrl: 'https://www.dealabs.com/test',
      };

      const result = service.extract($, $element, config, context);

      expect(result.text).toBe('Test with spaces');
    });

    it('should apply trim transform', () => {
      const html = '<div><p class="text">   Text   </p></div>';
      const $ = cheerio.load(html);
      const $element = $('div');

      const config: FieldMappingConfig = {
        text: {
          selectors: ['.text'],
          strategy: 'text',
          transform: ['trim'],
        },
      };

      const context: Partial<ExtractionContext> = {
        siteId: SiteSource.DEALABS,
        siteBaseUrl: 'https://www.dealabs.com',
        sourceUrl: 'https://www.dealabs.com/test',
      };

      const result = service.extract($, $element, config, context);

      expect(result.text).toBe('Text');
    });

    it('should apply lowercase transform', () => {
      const html = '<div><p class="text">UPPERCASE TEXT</p></div>';
      const $ = cheerio.load(html);
      const $element = $('div');

      const config: FieldMappingConfig = {
        text: {
          selectors: ['.text'],
          strategy: 'text',
          transform: ['lowercase'],
        },
      };

      const context: Partial<ExtractionContext> = {
        siteId: SiteSource.DEALABS,
        siteBaseUrl: 'https://www.dealabs.com',
        sourceUrl: 'https://www.dealabs.com/test',
      };

      const result = service.extract($, $element, config, context);

      expect(result.text).toBe('uppercase text');
    });
  });

  describe('Built-in parsers', () => {
    it('should parse integer', () => {
      const html = '<div><span class="count">123°</span></div>';
      const $ = cheerio.load(html);
      const $element = $('div');

      const config: FieldMappingConfig = {
        count: {
          selectors: ['.count'],
          strategy: 'text',
          parser: 'integer',
        },
      };

      const context: Partial<ExtractionContext> = {
        siteId: SiteSource.DEALABS,
        siteBaseUrl: 'https://www.dealabs.com',
        sourceUrl: 'https://www.dealabs.com/test',
      };

      const result = service.extract($, $element, config, context);

      expect(result.count).toBe(123);
    });

    it('should parse price', () => {
      const html = '<div><span class="price">€99.99</span></div>';
      const $ = cheerio.load(html);
      const $element = $('div');

      const config: FieldMappingConfig = {
        price: {
          selectors: ['.price'],
          strategy: 'text',
          parser: 'price',
        },
      };

      const context: Partial<ExtractionContext> = {
        siteId: SiteSource.DEALABS,
        siteBaseUrl: 'https://www.dealabs.com',
        sourceUrl: 'https://www.dealabs.com/test',
      };

      const result = service.extract($, $element, config, context);

      expect(result.price).toBe(99.99);
    });

    it('should parse boolean', () => {
      const html = '<div><span class="verified">true</span></div>';
      const $ = cheerio.load(html);
      const $element = $('div');

      const config: FieldMappingConfig = {
        verified: {
          selectors: ['.verified'],
          strategy: 'text',
          parser: 'boolean',
        },
      };

      const context: Partial<ExtractionContext> = {
        siteId: SiteSource.DEALABS,
        siteBaseUrl: 'https://www.dealabs.com',
        sourceUrl: 'https://www.dealabs.com/test',
      };

      const result = service.extract($, $element, config, context);

      expect(result.verified).toBe(true);
    });

    it('should parse URL (relative to absolute)', () => {
      const html = '<div><a class="link" href="/test-path">Link</a></div>';
      const $ = cheerio.load(html);
      const $element = $('div');

      const config: FieldMappingConfig = {
        url: {
          selectors: ['.link'],
          strategy: 'attribute',
          attribute: 'href',
          parser: 'url',
        },
      };

      const context: Partial<ExtractionContext> = {
        siteId: SiteSource.DEALABS,
        siteBaseUrl: 'https://www.dealabs.com',
        sourceUrl: 'https://www.dealabs.com/test',
      };

      const result = service.extract($, $element, config, context);

      expect(result.url).toBe('https://www.dealabs.com/test-path');
    });
  });

  describe('Regex extraction', () => {
    it('should extract with regex strategy', () => {
      const html = '<div><span class="discount">-25% de réduction</span></div>';
      const $ = cheerio.load(html);
      const $element = $('div');

      const config: FieldMappingConfig = {
        discountPercentage: {
          selectors: ['.discount'],
          strategy: 'regex',
          regex: /-?(\d+)%/,
          regexGroup: 1,
          parser: 'integer',
        },
      };

      const context: Partial<ExtractionContext> = {
        siteId: SiteSource.DEALABS,
        siteBaseUrl: 'https://www.dealabs.com',
        sourceUrl: 'https://www.dealabs.com/test',
      };

      const result = service.extract($, $element, config, context);

      expect(result.discountPercentage).toBe(25);
    });
  });

  describe('Validation', () => {
    it('should validate min/max for numbers', () => {
      const html = '<div><span class="temp">150</span></div>';
      const $ = cheerio.load(html);
      const $element = $('div');

      const config: FieldMappingConfig = {
        temperature: {
          selectors: ['.temp'],
          strategy: 'text',
          parser: 'integer',
          validator: { min: 0, max: 100 },
        },
      };

      const context: Partial<ExtractionContext> = {
        siteId: SiteSource.DEALABS,
        siteBaseUrl: 'https://www.dealabs.com',
        sourceUrl: 'https://www.dealabs.com/test',
      };

      expect(() => {
        service.extract($, $element, config, context);
      }).toThrow('above maximum');
    });

    it('should validate string length', () => {
      const html = '<div><span class="text">AB</span></div>';
      const $ = cheerio.load(html);
      const $element = $('div');

      const config: FieldMappingConfig = {
        text: {
          selectors: ['.text'],
          strategy: 'text',
          validator: { minLength: 3 },
        },
      };

      const context: Partial<ExtractionContext> = {
        siteId: SiteSource.DEALABS,
        siteBaseUrl: 'https://www.dealabs.com',
        sourceUrl: 'https://www.dealabs.com/test',
      };

      expect(() => {
        service.extract($, $element, config, context);
      }).toThrow('below minimum');
    });
  });
});
