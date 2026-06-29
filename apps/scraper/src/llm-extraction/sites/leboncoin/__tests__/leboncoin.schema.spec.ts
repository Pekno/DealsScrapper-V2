import { SiteSource } from '@dealscrapper/shared-types';
import { validateLeBonCoinListing } from '../leboncoin.schema.js';
import { LlmValidationError } from '../../llm.errors.js';

describe('validateLeBonCoinListing', () => {
  const baseValid = {
    externalId: 'lbc-999',
    title: 'iPhone 13 Pro',
    url: 'https://leboncoin.fr/ad/999',
    description: 'État neuf',
    imageUrl: 'https://leboncoin.fr/img/999.jpg',
    currentPrice: 75000,
    publishedAt: '2025-04-22T09:15:00.000Z',
    location: 'Paris 75011',
    city: 'Paris',
    postcode: '75011',
    sellerName: 'Jean',
    proSeller: false,
    urgentFlag: true,
  };

  it('returns a fully populated listing when every field is present', () => {
    const result = validateLeBonCoinListing(baseValid);

    // externalId is derived from the URL's numeric segment, not the raw LLM value.
    expect(result.externalId).toBe('999');
    expect(result.currentPrice).toBe(75000);
    expect(result.publishedAt).toEqual(new Date('2025-04-22T09:15:00.000Z'));
    expect(result.location).toBe('Paris 75011');
    expect(result.siteId).toBe(SiteSource.LEBONCOIN);
    if (result.siteSpecificData.type === SiteSource.LEBONCOIN) {
      expect(result.siteSpecificData.city).toBe('Paris');
      expect(result.siteSpecificData.proSeller).toBe(false);
      expect(result.siteSpecificData.urgentFlag).toBe(true);
    }
  });

  it('propagates null for nullable fields without fabrication', () => {
    const result = validateLeBonCoinListing({
      ...baseValid,
      publishedAt: null,
      city: null,
      postcode: null,
      sellerName: null,
      proSeller: null,
      urgentFlag: null,
    });

    expect(result.publishedAt).toBeNull();
    if (result.siteSpecificData.type === SiteSource.LEBONCOIN) {
      expect(result.siteSpecificData.city).toBeNull();
      expect(result.siteSpecificData.postcode).toBeNull();
      expect(result.siteSpecificData.sellerName).toBeNull();
      expect(result.siteSpecificData.proSeller).toBeNull();
      expect(result.siteSpecificData.urgentFlag).toBeNull();
    }
  });

  it('throws LlmValidationError when a required field is missing', () => {
    const { externalId: _externalId, ...withoutId } = baseValid;
    expect(() => validateLeBonCoinListing(withoutId)).toThrow(LlmValidationError);
  });

  it('throws LlmValidationError when publishedAt is not a valid date string', () => {
    expect(() =>
      validateLeBonCoinListing({ ...baseValid, publishedAt: 'not-a-date' })
    ).toThrow(LlmValidationError);
  });
});
