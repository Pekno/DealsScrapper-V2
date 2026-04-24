import { SiteSource } from '@dealscrapper/shared-types';
import { validateVintedListing } from '../vinted.schema.js';
import { LlmValidationError } from '../../llm.errors.js';

describe('validateVintedListing', () => {
  const baseValid = {
    externalId: 'vinted-42',
    title: 'Nike Air Max 90',
    url: 'https://vinted.fr/items/42',
    description: 'Good condition',
    imageUrl: 'https://vinted.fr/img/42.jpg',
    currentPrice: 3500,
    publishedAt: '2025-04-21T12:30:00.000Z',
    favoriteCount: 12,
    brand: 'Nike',
    size: '42',
    condition: 'Very good',
  };

  it('returns a fully populated listing when every field is present', () => {
    const result = validateVintedListing(baseValid);

    expect(result.externalId).toBe('vinted-42');
    expect(result.currentPrice).toBe(3500);
    expect(result.publishedAt).toEqual(new Date('2025-04-21T12:30:00.000Z'));
    expect(result.siteId).toBe(SiteSource.VINTED);
    if (result.siteSpecificData.type === SiteSource.VINTED) {
      expect(result.siteSpecificData.favoriteCount).toBe(12);
      expect(result.siteSpecificData.brand).toBe('Nike');
      expect(result.siteSpecificData.size).toBe('42');
      expect(result.siteSpecificData.itemCondition).toBe('Very good');
    }
  });

  it('propagates null for nullable fields without fabrication', () => {
    const result = validateVintedListing({
      ...baseValid,
      publishedAt: null,
      favoriteCount: null,
      brand: null,
      size: null,
    });

    expect(result.publishedAt).toBeNull();
    if (result.siteSpecificData.type === SiteSource.VINTED) {
      expect(result.siteSpecificData.favoriteCount).toBeNull();
      expect(result.siteSpecificData.brand).toBeNull();
      expect(result.siteSpecificData.size).toBeNull();
      // condition is required and therefore must flow through untouched
      expect(result.siteSpecificData.itemCondition).toBe('Very good');
    }
  });

  it('throws LlmValidationError when a required field is missing', () => {
    const { url: _url, ...withoutUrl } = baseValid;
    expect(() => validateVintedListing(withoutUrl)).toThrow(LlmValidationError);
  });

  it('throws LlmValidationError when condition is null (required for Vinted)', () => {
    expect(() => validateVintedListing({ ...baseValid, condition: null })).toThrow(
      LlmValidationError
    );
  });

  it('throws LlmValidationError when publishedAt is not a valid date string', () => {
    expect(() =>
      validateVintedListing({ ...baseValid, publishedAt: 'not-a-date' })
    ).toThrow(LlmValidationError);
  });
});
