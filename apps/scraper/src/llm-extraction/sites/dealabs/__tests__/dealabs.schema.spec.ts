import { SiteSource } from '@dealscrapper/shared-types';
import { validateDealabsListing } from '../dealabs.schema.js';
import { LlmValidationError } from '../../llm.errors.js';

describe('validateDealabsListing', () => {
  const baseValid = {
    externalId: 'deal-123',
    title: 'Test Deal',
    url: 'https://dealabs.com/bons-plans/test-123',
    description: 'Great offer',
    imageUrl: 'https://dealabs.com/img/test.jpg',
    currentPrice: 2999,
    originalPrice: 4999,
    merchant: 'Amazon',
    publishedAt: '2025-04-20T10:00:00.000Z',
    temperature: 250,
    commentCount: 17,
  };

  it('returns a fully populated listing when every field is present', () => {
    const result = validateDealabsListing(baseValid);

    expect(result.externalId).toBe('deal-123');
    expect(result.currentPrice).toBe(2999);
    expect(result.originalPrice).toBe(4999);
    expect(result.publishedAt).toEqual(new Date('2025-04-20T10:00:00.000Z'));
    expect(result.siteId).toBe(SiteSource.DEALABS);
    expect(result.siteSpecificData.type).toBe(SiteSource.DEALABS);
    if (result.siteSpecificData.type === SiteSource.DEALABS) {
      expect(result.siteSpecificData.temperature).toBe(250);
      expect(result.siteSpecificData.commentCount).toBe(17);
      expect(result.siteSpecificData.discountPercentage).toBe(40);
    }
  });

  it('propagates null for nullable fields without fabrication', () => {
    const result = validateDealabsListing({
      ...baseValid,
      publishedAt: null,
      temperature: null,
      commentCount: null,
      originalPrice: null,
      merchant: null,
    });

    expect(result.publishedAt).toBeNull();
    expect(result.originalPrice).toBeNull();
    expect(result.merchant).toBeNull();
    if (result.siteSpecificData.type === SiteSource.DEALABS) {
      expect(result.siteSpecificData.temperature).toBeNull();
      expect(result.siteSpecificData.commentCount).toBeNull();
      expect(result.siteSpecificData.discountPercentage).toBeNull();
    }
  });

  it('throws LlmValidationError when a required field is missing', () => {
    const { title: _title, ...withoutTitle } = baseValid;
    expect(() => validateDealabsListing(withoutTitle)).toThrow(LlmValidationError);
  });

  it('throws LlmValidationError when publishedAt is not a valid date string', () => {
    expect(() =>
      validateDealabsListing({ ...baseValid, publishedAt: 'not-a-date' })
    ).toThrow(LlmValidationError);
  });
});
