import type { UniversalListing, DealabsData } from '@dealscrapper/shared-types';
import { SiteSource } from '@dealscrapper/shared-types';
import { LlmValidationError } from '../llm.errors.js';

export const DEALABS_JSON_SCHEMA = {
  type: 'object',
  required: ['externalId', 'title', 'url'],
  properties: {
    externalId:    { type: 'string' },
    title:         { type: 'string' },
    description:   { type: ['string', 'null'] },
    url:           { type: 'string' },
    imageUrl:      { type: ['string', 'null'] },
    currentPrice:  { type: ['integer', 'null'] },
    originalPrice: { type: ['integer', 'null'] },
    merchant:      { type: ['string', 'null'] },
    publishedAt:   { type: ['string', 'null'] },
    temperature:   { type: ['integer', 'null'] },
    commentCount:  { type: ['integer', 'null'] },
  },
  additionalProperties: false,
} as const;

function assertNullableString(val: unknown, field: string): string | null {
  if (val === null || val === undefined) return null;
  if (typeof val !== 'string') throw new LlmValidationError(`${field} must be a string or null`);
  return val;
}

function assertNullableInt(val: unknown, field: string): number | null {
  if (val === null || val === undefined) return null;
  if (typeof val !== 'number' || !Number.isInteger(val)) {
    throw new LlmValidationError(`${field} must be an integer or null`);
  }
  return val;
}

function parseNullableDate(val: string | null): Date | null {
  if (val === null) return null;
  const parsed = new Date(val);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function validateDealabsListing(raw: unknown): UniversalListing {
  if (typeof raw !== 'object' || raw === null) {
    throw new LlmValidationError('output is not an object');
  }

  const r = raw as Record<string, unknown>;

  if (typeof r['externalId'] !== 'string') throw new LlmValidationError('missing or invalid externalId');
  if (typeof r['title'] !== 'string') throw new LlmValidationError('missing or invalid title');
  if (typeof r['url'] !== 'string') throw new LlmValidationError('missing or invalid url');

  const currentPrice = assertNullableInt(r['currentPrice'], 'currentPrice');
  const originalPrice = assertNullableInt(r['originalPrice'], 'originalPrice');
  const temperature = assertNullableInt(r['temperature'], 'temperature');
  const commentCount = assertNullableInt(r['commentCount'], 'commentCount');
  const description = assertNullableString(r['description'], 'description');
  const imageUrl = assertNullableString(r['imageUrl'], 'imageUrl');
  const merchant = assertNullableString(r['merchant'], 'merchant');
  const publishedAtRaw = typeof r['publishedAt'] === 'string' ? r['publishedAt'] : null;

  const publishedAt = parseNullableDate(publishedAtRaw);

  const siteSpecificData: DealabsData = {
    type: SiteSource.DEALABS,
    temperature,
    commentCount,
    communityVerified: false,
    freeShipping: false,
    isCoupon: false,
    discountPercentage: originalPrice !== null && currentPrice !== null && originalPrice > 0
      ? Math.round(((originalPrice - currentPrice) / originalPrice) * 100)
      : null,
    expiresAt: null,
  };

  return {
    externalId: r['externalId'] as string,
    title: r['title'] as string,
    description,
    url: r['url'] as string,
    imageUrl,
    siteId: SiteSource.DEALABS,
    currentPrice,
    originalPrice,
    merchant,
    location: null,
    publishedAt,
    isActive: true,
    categorySlug: '',
    siteSpecificData,
  };
}
