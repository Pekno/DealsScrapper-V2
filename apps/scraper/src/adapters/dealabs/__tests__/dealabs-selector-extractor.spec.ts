import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as cheerio from 'cheerio';
import type { Cheerio, CheerioAPI } from 'cheerio';
import type { Element } from 'domhandler';
import { SiteSource } from '@dealscrapper/shared-types';
import { extractDealabsListingFromSelectors } from '../dealabs-selector-extractor';

const FIXTURE_DIR = join(
  __dirname,
  '..',
  '..',
  '..',
  'llm-extraction',
  'sites',
  'dealabs',
  'fixtures',
);

function loadCard(fixtureName: string): { $: CheerioAPI; $element: Cheerio<Element> } {
  const html = readFileSync(join(FIXTURE_DIR, fixtureName), 'utf-8');
  const $ = cheerio.load(html);
  const $element = $('article').first() as Cheerio<Element>;
  return { $, $element };
}

describe('extractDealabsListingFromSelectors', () => {
  describe('priced deal (dealabs-001) — selector hit', () => {
    it('extracts the required stable fields and reports all present', () => {
      // Arrange
      const { $, $element } = loadCard('dealabs-001.html');

      // Act
      const result = extractDealabsListingFromSelectors($, $element);

      // Assert
      expect(result.allRequiredPresent).toBe(true);
      expect(result.listing).not.toBeNull();
      expect(result.listing?.externalId).toBe('3317035');
      expect(result.listing?.url).toBe(
        'https://www.dealabs.com/bons-plans/samsung-s26-ultra-256go-couleurs-exclusives-3317035',
      );
      expect(result.listing?.currentPrice).toBe(969);
      expect(result.listing?.siteId).toBe(SiteSource.DEALABS);
    });

    it('best-effort extracts originalPrice, merchant, temperature and discount', () => {
      // Arrange
      const { $, $element } = loadCard('dealabs-001.html');

      // Act
      const result = extractDealabsListingFromSelectors($, $element);

      // Assert
      expect(result.listing?.originalPrice).toBe(1469);
      expect(result.listing?.merchant).toBe('Samsung');
      const data = result.listing?.siteSpecificData;
      expect(data?.type).toBe(SiteSource.DEALABS);
      if (data?.type === SiteSource.DEALABS) {
        expect(data.temperature).toBe(221);
        expect(data.commentCount).toBe(9);
        expect(data.discountPercentage).toBe(34);
      }
    });
  });

  describe('comma-decimal price (dealabs-003)', () => {
    it('parses French comma decimals', () => {
      // Arrange
      const { $, $element } = loadCard('dealabs-003.html');

      // Act
      const result = extractDealabsListingFromSelectors($, $element);

      // Assert
      expect(result.allRequiredPresent).toBe(true);
      expect(result.listing?.currentPrice).toBe(961.3);
      expect(result.listing?.externalId).toBe('3316999');
    });
  });

  describe('free deal (dealabs-002) — missing price, must fall back', () => {
    it('reports not all present when the price span is absent', () => {
      // Arrange — fixture 002 is a "Gratuit" deal with no span.thread-price
      const { $, $element } = loadCard('dealabs-002.html');

      // Act
      const result = extractDealabsListingFromSelectors($, $element);

      // Assert
      expect(result.allRequiredPresent).toBe(false);
      expect(result.listing).toBeNull();
    });
  });

  describe('missing required field — card with no id', () => {
    it('reports not all present when externalId cannot be resolved', () => {
      // Arrange
      const $ = cheerio.load(
        '<article class="thread"><a class="cept-tt thread-link" href="/x">x</a>' +
          '<span class="thread-price">10€</span></article>',
      );
      const $element = $('article').first() as Cheerio<Element>;

      // Act
      const result = extractDealabsListingFromSelectors($, $element);

      // Assert
      expect(result.allRequiredPresent).toBe(false);
      expect(result.listing).toBeNull();
    });
  });
});
