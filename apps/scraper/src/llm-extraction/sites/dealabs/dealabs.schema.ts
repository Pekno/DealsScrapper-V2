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
    currentPrice:  { type: ['number', 'null'] },
    originalPrice: { type: ['number', 'null'] },
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

function assertNullableFloat(val: unknown, field: string): number | null {
  if (val === null || val === undefined) return null;
  if (typeof val !== 'number') {
    throw new LlmValidationError(`${field} must be a float or null`);
  }
  return val;
}

function assertNullableInt(val: unknown, field: string): number | null {
  if (val === null || val === undefined) return null;
  if (typeof val !== 'number' || !Number.isInteger(val)) {
    throw new LlmValidationError(`${field} must be an integer or null`);
  }
  return val;
}

function parseValidatedDate(val: string | null, field: string): Date | null {
  if (val === null) return null;
  const parsed = new Date(val);
  if (Number.isNaN(parsed.getTime())) throw new LlmValidationError(`${field} is not a valid date string`);
  return parsed;
}

export function validateDealabsListing(raw: unknown): UniversalListing {
  if (typeof raw !== 'object' || raw === null) {
    throw new LlmValidationError('output is not an object');
  }

  const r = raw as Record<string, unknown>;

  if (typeof r['externalId'] !== 'string') throw new LlmValidationError('missing or invalid externalId');
  if (typeof r['title'] !== 'string') throw new LlmValidationError('missing or invalid title');
  if (typeof r['url'] !== 'string') throw new LlmValidationError('missing or invalid url');

  const currentPrice = assertNullableFloat(r['currentPrice'], 'currentPrice');
  const originalPrice = assertNullableFloat(r['originalPrice'], 'originalPrice');
  const temperature = assertNullableInt(r['temperature'], 'temperature');
  const commentCount = assertNullableInt(r['commentCount'], 'commentCount');
  const description = assertNullableString(r['description'], 'description');
  const imageUrl = assertNullableString(r['imageUrl'], 'imageUrl');
  const merchant = assertNullableString(r['merchant'], 'merchant');
  const publishedAtRaw = assertNullableString(r['publishedAt'], 'publishedAt');

  const publishedAt = parseValidatedDate(publishedAtRaw, 'publishedAt');

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
