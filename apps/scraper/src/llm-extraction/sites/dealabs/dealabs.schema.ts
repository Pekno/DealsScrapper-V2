import type { UniversalListing, DealabsData } from '@dealscrapper/shared-types';
import { SiteSource } from '@dealscrapper/shared-types';
import { LlmValidationError } from '../llm.errors.js';

export const DEALABS_JSON_SCHEMA = {
  type: 'object',
  // `temperature` is forced into the required set so Ollama's structured-output
  // grammar always emits the key (value may still be null). This guarantees a
  // stable shape for the deterministic temperature backfill below.
  required: ['externalId', 'title', 'url', 'temperature'],
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

/**
 * Resolves `publishedAt` to a Date or null. Accepts the raw LLM shape (ISO string
 * or null) and, for idempotency, an already-parsed Date — so re-validating an
 * extracted UniversalListing (whose `publishedAt` is a Date) never fails.
 */
function resolvePublishedAt(val: unknown): Date | null {
  if (val === null || val === undefined) return null;
  if (val instanceof Date) {
    if (Number.isNaN(val.getTime())) throw new LlmValidationError('publishedAt is not a valid date');
    return val;
  }
  if (typeof val !== 'string') throw new LlmValidationError('publishedAt must be a string or null');
  const parsed = new Date(val);
  if (Number.isNaN(parsed.getTime())) throw new LlmValidationError('publishedAt is not a valid date string');
  return parsed;
}

/**
 * Resolves the canonical Dealabs externalId.
 *
 * A Dealabs deal's externalId is, by definition, the numeric suffix of its URL
 * (e.g. ".../samsung-s26-ultra-3317035" → "3317035"). The small LLM extracts the
 * URL reliably but sometimes hallucinates the externalId, so the URL suffix is
 * the authoritative source. We fall back to the LLM-provided value only when the
 * URL has no numeric suffix.
 */
function resolveExternalId(llmExternalId: string, url: string): string {
  const match = /-(\d+)(?:[/?#].*)?$/.exec(url) ?? /\/(\d+)(?:[/?#].*)?$/.exec(url);
  return match ? match[1]! : llmExternalId;
}

/**
 * Deterministically recovers the Dealabs community heat score from the prepared
 * Markdown. The score is always rendered as a standalone `<number>°` token on a
 * Dealabs card (e.g. "221°"). The small reader model frequently omits it, but it
 * is trivially regex-extractable, so we backfill it when the LLM returned null.
 *
 * Used only as a fallback — an LLM-provided temperature is trusted as-is. Returns
 * null when no `<number>°` token exists, never a fabricated value.
 */
function recoverTemperature(markdown: string | undefined): number | null {
  if (!markdown) return null;
  const match = /(-?\d+)\s*°/.exec(markdown);
  return match ? Number.parseInt(match[1]!, 10) : null;
}

/**
 * Detects the Dealabs "free deal" pattern in the prepared Markdown. A free deal
 * renders "Gratuit" in PLACE of the current price, directly followed by the
 * crossed-out original price (e.g. "Gratuit2,99€" → currentPrice 0, originalPrice
 * 2.99). The reader model often mis-parses this, putting the crossed-out price
 * into currentPrice.
 *
 * Crucially this must NOT trigger on a paid deal that merely mentions "Gratuit"
 * for free shipping (e.g. "961,30€Gratuit" or a standalone "Gratuit" line below a
 * real price). We therefore require "Gratuit" to be immediately followed by a
 * digit — the free-deal layout where the original price abuts the word.
 */
function isFreeDeal(markdown: string | undefined): boolean {
  if (!markdown) return false;
  return /Gratuit\s*\d/i.test(markdown);
}

/**
 * Deterministically recovers the comment count from the prepared Markdown. On a
 * Dealabs card the count renders as a Markdown link whose href anchors the
 * comments section: `[9](https://www.dealabs.com/bons-plans/...#comments ...)`.
 * The reader model frequently drops or mis-copies this number, but the
 * `#comments` anchor makes it unambiguous. Returns null when no such link exists;
 * never fabricates.
 */
function recoverCommentCount(markdown: string | undefined): number | null {
  if (!markdown) return null;
  const match = /\[(\d+)\]\([^)]*#comments/.exec(markdown);
  return match ? Number.parseInt(match[1]!, 10) : null;
}

/**
 * Reads an integer field (e.g. `temperature`, `commentCount`) from the nested
 * `siteSpecificData` of an already-extracted UniversalListing. Keeps
 * {@link validateDealabsListing} idempotent when re-validating its own output.
 */
function nestedDealabsInt(r: Record<string, unknown>, field: string): number | null {
  const data = r['siteSpecificData'];
  if (typeof data !== 'object' || data === null) return null;
  const value = (data as Record<string, unknown>)[field];
  return typeof value === 'number' && Number.isInteger(value) ? value : null;
}

export function validateDealabsListing(raw: unknown, markdown?: string): UniversalListing {
  if (typeof raw !== 'object' || raw === null) {
    throw new LlmValidationError('output is not an object');
  }

  const r = raw as Record<string, unknown>;

  if (typeof r['externalId'] !== 'string') throw new LlmValidationError('missing or invalid externalId');
  if (typeof r['title'] !== 'string') throw new LlmValidationError('missing or invalid title');
  if (typeof r['url'] !== 'string') throw new LlmValidationError('missing or invalid url');

  let currentPrice = assertNullableFloat(r['currentPrice'], 'currentPrice');
  let originalPrice = assertNullableFloat(r['originalPrice'], 'originalPrice');
  let temperature = assertNullableInt(r['temperature'], 'temperature');

  // Deterministic recovery for the free-deal pattern ("Gratuit"). currentPrice is
  // 0; any positive price the model produced is actually the crossed-out original.
  if (isFreeDeal(markdown) && currentPrice !== 0) {
    if (originalPrice === null && currentPrice !== null && currentPrice > 0) {
      originalPrice = currentPrice;
    }
    currentPrice = 0;
  }

  // Deterministic recovery for the heat score the reader model tends to drop.
  // Falls back to the nested value so re-validating an extracted listing keeps it.
  if (temperature === null) {
    temperature = recoverTemperature(markdown) ?? nestedDealabsInt(r, 'temperature');
  }
  // The #comments anchor in the Markdown is authoritative; the reader model both
  // drops and mis-copies this number. Prefer the deterministic value, falling
  // back to the LLM (or the nested value when re-validating a UniversalListing).
  const llmCommentCount = assertNullableInt(r['commentCount'], 'commentCount')
    ?? nestedDealabsInt(r, 'commentCount');
  const commentCount = recoverCommentCount(markdown) ?? llmCommentCount;
  const description = assertNullableString(r['description'], 'description');
  const imageUrl = assertNullableString(r['imageUrl'], 'imageUrl');
  const merchant = assertNullableString(r['merchant'], 'merchant');

  const publishedAt = resolvePublishedAt(r['publishedAt']);

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

  const url = r['url'] as string;

  return {
    externalId: resolveExternalId(r['externalId'] as string, url),
    title: r['title'] as string,
    description,
    url,
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
