import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as cheerio from 'cheerio';
import type { Cheerio, CheerioAPI } from 'cheerio';
import type { Element } from 'domhandler';
import { SiteSource } from '@dealscrapper/shared-types';
import { extractLeBonCoinListingFromSelectors } from '../leboncoin-selector-extractor';

const FIXTURE_DIR = join(
  __dirname,
  '..',
  '..',
  '..',
  'llm-extraction',
  'sites',
  'leboncoin',
  'fixtures',
);

function loadCard(fixtureName: string): { $: CheerioAPI; $element: Cheerio<Element> } {
  const html = readFileSync(join(FIXTURE_DIR, fixtureName), 'utf-8');
  const $ = cheerio.load(html);
  const $element = $('[data-qa-id="aditem_container"]').first() as Cheerio<Element>;
  return { $, $element };
}

describe('extractLeBonCoinListingFromSelectors', () => {
  describe('priced ad (leboncoin-001) — selector hit', () => {
    it('extracts the required stable fields and reports all present', () => {
      // Arrange
      const { $, $element } = loadCard('leboncoin-001.html');

      // Act
      const result = extractLeBonCoinListingFromSelectors($, $element);

      // Assert
      expect(result.allRequiredPresent).toBe(true);
      expect(result.listing).not.toBeNull();
      expect(result.listing?.externalId).toBe('3155664945');
      expect(result.listing?.url).toBe(
        'https://www.leboncoin.fr/ad/accessoires_informatique/3155664945',
      );
      expect(result.listing?.currentPrice).toBe(195);
      expect(result.listing?.siteId).toBe(SiteSource.LEBONCOIN);
    });

    it('best-effort extracts title, location, city, postcode and sellerName', () => {
      // Arrange
      const { $, $element } = loadCard('leboncoin-001.html');

      // Act
      const result = extractLeBonCoinListingFromSelectors($, $element);

      // Assert
      expect(result.listing?.title).toContain('Routeur');
      expect(result.listing?.location).toBe('Le Cannet 06110');
      const data = result.listing?.siteSpecificData;
      expect(data?.type).toBe(SiteSource.LEBONCOIN);
      if (data?.type === SiteSource.LEBONCOIN) {
        expect(data.city).toBe('Le Cannet');
        expect(data.postcode).toBe('06110');
        expect(data.sellerName).toBe('marcopolo437');
      }
    });
  });

  describe('priced ad without text-success span (leboncoin-003)', () => {
    it('still parses the price from the Generic_price paragraph', () => {
      // Arrange — fixture 003's price span has no text-success class
      const { $, $element } = loadCard('leboncoin-003.html');

      // Act
      const result = extractLeBonCoinListingFromSelectors($, $element);

      // Assert
      expect(result.allRequiredPresent).toBe(true);
      expect(result.listing?.currentPrice).toBe(165);
      expect(result.listing?.externalId).toBe('3181601795');
    });
  });

  describe('missing required field — card with no price', () => {
    it('reports not all present when the price cannot be parsed', () => {
      // Arrange — ad link present, but no Generic_price paragraph
      const $ = cheerio.load(
        '<div data-qa-id="aditem_container">' +
          '<a href="/ad/voitures/123456789">x</a>' +
          '</div>',
      );
      const $element = $('[data-qa-id="aditem_container"]').first() as Cheerio<Element>;

      // Act
      const result = extractLeBonCoinListingFromSelectors($, $element);

      // Assert
      expect(result.allRequiredPresent).toBe(false);
      expect(result.listing).toBeNull();
    });
  });

  describe('missing required field — card with no ad link', () => {
    it('reports not all present when externalId cannot be resolved', () => {
      // Arrange — price present, but no /ad/ href to source the id/url from
      const $ = cheerio.load(
        '<div data-qa-id="aditem_container">' +
          '<p class="Generic_price__x">195&nbsp;€</p>' +
          '</div>',
      );
      const $element = $('[data-qa-id="aditem_container"]').first() as Cheerio<Element>;

      // Act
      const result = extractLeBonCoinListingFromSelectors($, $element);

      // Assert
      expect(result.allRequiredPresent).toBe(false);
      expect(result.listing).toBeNull();
    });
  });
});
