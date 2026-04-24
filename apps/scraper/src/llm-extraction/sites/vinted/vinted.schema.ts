import type { UniversalListing, VintedData } from '@dealscrapper/shared-types';
import { SiteSource } from '@dealscrapper/shared-types';
import { LlmValidationError } from '../llm.errors.js';

export const VINTED_JSON_SCHEMA = {
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
    favoriteCount: { type: ['integer', 'null'] },
    brand:         { type: ['string', 'null'] },
    size:          { type: ['string', 'null'] },
    condition:     { type: ['string', 'null'] },
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

export function validateVintedListing(raw: unknown): UniversalListing {
  if (typeof raw !== 'object' || raw === null) {
    throw new LlmValidationError('output is not an object');
  }

  const r = raw as Record<string, unknown>;

  if (typeof r['externalId'] !== 'string') throw new LlmValidationError('missing or invalid externalId');
  if (typeof r['title'] !== 'string') throw new LlmValidationError('missing or invalid title');
  if (typeof r['url'] !== 'string') throw new LlmValidationError('missing or invalid url');

  const currentPrice = assertNullableInt(r['currentPrice'], 'currentPrice');
  const favoriteCount = assertNullableInt(r['favoriteCount'], 'favoriteCount');
  const description = assertNullableString(r['description'], 'description');
  const imageUrl = assertNullableString(r['imageUrl'], 'imageUrl');
  const publishedAtRaw = assertNullableString(r['publishedAt'], 'publishedAt');
  const brand = assertNullableString(r['brand'], 'brand');
  const size = assertNullableString(r['size'], 'size');
  const condition = assertNullableString(r['condition'], 'condition');
  const publishedAt = parseNullableDate(publishedAtRaw);

  const siteSpecificData: VintedData = {
    type: SiteSource.VINTED,
    favoriteCount,
    viewCount: null,
    itemCondition: condition ?? 'unknown',
    brand,
    size,
    color: null,
    sellerRating: null,
    sellerName: null,
  };

  return {
    externalId: r['externalId'] as string,
    title: r['title'] as string,
    description,
    url: r['url'] as string,
    imageUrl,
    siteId: SiteSource.VINTED,
    currentPrice,
    originalPrice: null,
    merchant: null,
    location: null,
    publishedAt,
    isActive: true,
    categorySlug: '',
    siteSpecificData,
  };
}
