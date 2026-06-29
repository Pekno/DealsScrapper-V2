import type { UniversalListing, LeBonCoinData } from '@dealscrapper/shared-types';
import { SiteSource } from '@dealscrapper/shared-types';
import { LlmValidationError } from '../llm.errors.js';

export const LEBONCOIN_JSON_SCHEMA = {
  type: 'object',
  required: ['externalId', 'title', 'url'],
  properties: {
    externalId:  { type: 'string' },
    title:       { type: 'string' },
    description: { type: ['string', 'null'] },
    url:         { type: 'string' },
    imageUrl:    { type: ['string', 'null'] },
    currentPrice:{ type: ['number', 'null'] },
    originalPrice:{ type: ['number', 'null'] },
    merchant:    { type: ['string', 'null'] },
    publishedAt: { type: ['string', 'null'] },
    location:    { type: ['string', 'null'] },
    city:        { type: ['string', 'null'] },
    postcode:    { type: ['string', 'null'] },
    sellerName:  { type: ['string', 'null'] },
    proSeller:   { type: ['boolean', 'null'] },
    urgentFlag:  { type: ['boolean', 'null'] },
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

function assertNullableBool(val: unknown, field: string): boolean | null {
  if (val === null || val === undefined) return null;
  if (typeof val !== 'boolean') throw new LlmValidationError(`${field} must be a boolean or null`);
  return val;
}

function parseValidatedDate(val: string | null, field: string): Date | null {
  if (val === null) return null;
  const parsed = new Date(val);
  if (Number.isNaN(parsed.getTime())) throw new LlmValidationError(`${field} is not a valid date string`);
  return parsed;
}

/**
 * Resolves the canonical LeBonCoin externalId from the ad URL.
 *
 * A LeBonCoin ad's externalId is the numeric segment at the end of the URL path
 * (e.g. "/ad/accessoires_informatique/3155664945" → "3155664945"). The small LLM
 * extracts the URL reliably but can hallucinate the externalId, so the URL is the
 * authoritative source. Falls back to the LLM value when no match is found.
 */
function resolveExternalId(llmExternalId: string, url: string): string {
  const match = /\/(\d+)(?:[/?#].*)?$/.exec(url);
  return match ? match[1]! : llmExternalId;
}

export function validateLeBonCoinListing(raw: unknown): UniversalListing {
  if (typeof raw !== 'object' || raw === null) {
    throw new LlmValidationError('output is not an object');
  }

  const r = raw as Record<string, unknown>;

  if (typeof r['externalId'] !== 'string') throw new LlmValidationError('missing or invalid externalId');
  if (typeof r['title'] !== 'string') throw new LlmValidationError('missing or invalid title');
  if (typeof r['url'] !== 'string') throw new LlmValidationError('missing or invalid url');

  const currentPrice = assertNullableFloat(r['currentPrice'], 'currentPrice');
  const description = assertNullableString(r['description'], 'description');
  const imageUrl = assertNullableString(r['imageUrl'], 'imageUrl');
  const publishedAtRaw = assertNullableString(r['publishedAt'], 'publishedAt');
  const location = assertNullableString(r['location'], 'location');
  const city = assertNullableString(r['city'], 'city');
  const postcode = assertNullableString(r['postcode'], 'postcode');
  const sellerName = assertNullableString(r['sellerName'], 'sellerName');
  const proSeller = assertNullableBool(r['proSeller'], 'proSeller');
  const urgentFlag = assertNullableBool(r['urgentFlag'], 'urgentFlag');

  const publishedAt = parseValidatedDate(publishedAtRaw, 'publishedAt');

  const siteSpecificData: LeBonCoinData = {
    type: SiteSource.LEBONCOIN,
    city,
    postcode,
    department: null,
    region: null,
    proSeller,
    sellerName,
    urgentFlag,
    topAnnonce: null,
    deliveryOptions: [],
    shippingCost: null,
    condition: null,
    attributes: null,
  };

  const url = r['url'] as string;

  return {
    externalId: resolveExternalId(r['externalId'] as string, url),
    title: r['title'] as string,
    description,
    url,
    imageUrl,
    siteId: SiteSource.LEBONCOIN,
    currentPrice,
    originalPrice: null,
    merchant: null,
    location,
    publishedAt,
    isActive: true,
    categorySlug: '',
    siteSpecificData,
  };
}
