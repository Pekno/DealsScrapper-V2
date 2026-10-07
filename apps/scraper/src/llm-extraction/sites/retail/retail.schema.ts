import type { UniversalListing, RetailData, RetailSiteSource } from '@dealscrapper/shared-types';
import { LlmValidationError } from '../llm.errors.js';

/**
 * Shared JSON schema for retail product-listing sites (Électro Dépôt today;
 * Fnac/Darty/Boulanger reuse it). Retail cards have no exotic fields like a
 * Dealabs heat score — just product + price + a few signals — so one schema and
 * one validator cover the whole family.
 */
export const RETAIL_JSON_SCHEMA = {
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
    brand:         { type: ['string', 'null'] },
    rating:        { type: ['number', 'null'] },
    reviewCount:   { type: ['integer', 'null'] },
    availability:  { type: ['string', 'null'] },
    ean:           { type: ['string', 'null'] },
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
  if (typeof val !== 'number') throw new LlmValidationError(`${field} must be a number or null`);
  return val;
}

function assertNullableInt(val: unknown, field: string): number | null {
  if (val === null || val === undefined) return null;
  if (typeof val !== 'number' || !Number.isInteger(val)) {
    throw new LlmValidationError(`${field} must be an integer or null`);
  }
  return val;
}

/**
 * Validates and normalises the raw LLM JSON for a retail listing into a
 * {@link UniversalListing}. Idempotent: re-validating its own output (where
 * `currentPrice` etc. are already typed) passes unchanged.
 *
 * `siteId` is supplied by the calling site class so the shared validator serves
 * every retail sibling (Électro Dépôt, Fnac, Darty, Boulanger).
 */
export function validateRetailListing(
  raw: unknown,
  siteId: RetailSiteSource,
  markdown?: string,
): UniversalListing {
  void markdown; // no deterministic backfills needed for retail cards (yet)

  if (typeof raw !== 'object' || raw === null) {
    throw new LlmValidationError('output is not an object');
  }
  const r = raw as Record<string, unknown>;

  if (typeof r['externalId'] !== 'string') throw new LlmValidationError('missing or invalid externalId');
  if (typeof r['title'] !== 'string') throw new LlmValidationError('missing or invalid title');
  if (typeof r['url'] !== 'string') throw new LlmValidationError('missing or invalid url');

  const siteSpecificData: RetailData = {
    type: siteId,
    rating: assertNullableFloat(r['rating'], 'rating'),
    reviewCount: assertNullableInt(r['reviewCount'], 'reviewCount'),
    availability: assertNullableString(r['availability'], 'availability'),
    ean: assertNullableString(r['ean'], 'ean'),
    brand: assertNullableString(r['brand'], 'brand'),
  };

  return {
    externalId: r['externalId'],
    title: r['title'],
    description: assertNullableString(r['description'], 'description'),
    url: r['url'],
    imageUrl: assertNullableString(r['imageUrl'], 'imageUrl'),
    siteId,
    currentPrice: assertNullableFloat(r['currentPrice'], 'currentPrice'),
    originalPrice: assertNullableFloat(r['originalPrice'], 'originalPrice'),
    merchant: assertNullableString(r['merchant'], 'merchant'),
    location: null,
    publishedAt: null,
    isActive: true,
    categorySlug: '',
    siteSpecificData,
  };
}
