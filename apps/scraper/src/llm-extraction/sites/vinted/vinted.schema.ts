import type { UniversalListing, VintedData } from '@dealscrapper/shared-types';
import { SiteSource } from '@dealscrapper/shared-types';
import { LlmValidationError } from '../llm.errors.js';

export const VINTED_JSON_SCHEMA = {
  type: 'object',
  // `condition` is required: every Vinted card encodes it ("état: …") and the
  // validator rejects a listing without it. Forcing it into Ollama's
  // structured-output grammar stops the reader model from silently omitting the
  // key, which previously caused every extraction to fail validation.
  required: ['externalId', 'title', 'url', 'condition'],
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

function assertRequiredString(val: unknown, field: string): string {
  if (typeof val !== 'string') throw new LlmValidationError(`${field} is required and must be a string`);
  return val;
}

function parseValidatedDate(val: string | null, field: string): Date | null {
  if (val === null) return null;
  const parsed = new Date(val);
  if (Number.isNaN(parsed.getTime())) throw new LlmValidationError(`${field} is not a valid date string`);
  return parsed;
}

/**
 * Resolves the canonical Vinted externalId from the item URL.
 *
 * A Vinted item's externalId is the numeric segment right after "/items/"
 * (e.g. "/items/8675512211-school-days-..." → "8675512211"). The small LLM
 * extracts the URL reliably but can hallucinate the externalId, so the URL is
 * the authoritative source. Falls back to the LLM value when no match is found.
 */
function resolveExternalId(llmExternalId: string, url: string): string {
  const match = /\/items\/(\d+)/.exec(url);
  return match ? match[1]! : llmExternalId;
}

/**
 * Vinted catalog cards encode the item's metadata in the thumbnail image alt
 * text with a rigid pattern:
 *   "<title>, marque: <brand>, état: <condition>, <price> €, <total> € Protection acheteurs incluse"
 * (the "marque: <brand>" segment is omitted when the seller set no brand).
 *
 * The small reader model is unreliable here — it routinely returns the whole alt
 * string as the title, drops the price, or omits the brand. Because the pattern
 * is fixed, parsing it deterministically is both more accurate and cheaper than
 * coaxing the model. These helpers extract each field from the prepared Markdown
 * and are used only to backfill / correct what the LLM got wrong — never to
 * fabricate values absent from the source.
 */
function firstImageAlt(markdown: string): string | null {
  const match = /!\[([^\]]*)\]\(/.exec(markdown);
  return match ? match[1]! : null;
}

function parsePriceToken(token: string | undefined): number | null {
  if (!token) return null;
  const normalised = token.replace(/\s/g, '').replace(',', '.');
  const value = Number.parseFloat(normalised);
  return Number.isFinite(value) ? value : null;
}

interface VintedAltFields {
  title: string | null;
  brand: string | null;
  condition: string | null;
  currentPrice: number | null;
}

/**
 * Recovers the favourites count from the prepared Markdown. On a Vinted catalog
 * card the count renders as a standalone integer line (the favourites button's
 * accessible "ajouté aux favoris par N utilisateurs" label is reduced to the bare
 * count "N" during Markdown conversion). It is the first digits-only line and
 * appears before any euro price, so we read the first standalone-integer line.
 * Returns null when none is present; never fabricates.
 */
function recoverFavoriteCount(markdown: string | undefined): number | null {
  if (!markdown) return null;
  for (const line of markdown.split('\n')) {
    if (/^\d+$/.test(line.trim())) return Number.parseInt(line.trim(), 10);
  }
  return null;
}

function parseVintedAlt(markdown: string | undefined): VintedAltFields {
  const empty: VintedAltFields = { title: null, brand: null, condition: null, currentPrice: null };
  if (!markdown) return empty;
  const alt = firstImageAlt(markdown);
  if (!alt) return empty;

  // Title is everything before the first ", marque:" or ", état:" separator.
  const titleMatch = /^(.*?)(?:,\s*(?:marque|état):)/i.exec(alt);
  const title = titleMatch ? titleMatch[1]!.trim() : null;

  const brandMatch = /marque:\s*(.*?)\s*(?:,\s*(?:état:|\d)|$)/i.exec(alt);
  const brand = brandMatch ? brandMatch[1]!.trim() : null;

  const conditionMatch = /état:\s*(.*?)\s*(?:,|$)/i.exec(alt);
  const condition = conditionMatch ? conditionMatch[1]!.trim() : null;

  // The first euro amount in the alt is the item price; the second is the total
  // with buyer protection — we deliberately take only the first.
  const priceMatch = /(\d+(?:[.,]\d+)?)\s*€/.exec(alt);
  const currentPrice = priceMatch ? parsePriceToken(priceMatch[1]) : null;

  return { title, brand, condition, currentPrice };
}

/**
 * Reads `siteSpecificData.itemCondition` from an already-extracted
 * UniversalListing. Lets {@link validateVintedListing} re-validate its own output
 * (where condition lives nested, not as a flat `condition` field).
 */
function nestedItemCondition(r: Record<string, unknown>): string | null {
  const data = r['siteSpecificData'];
  if (typeof data !== 'object' || data === null) return null;
  const itemCondition = (data as Record<string, unknown>)['itemCondition'];
  return typeof itemCondition === 'string' && itemCondition !== 'unknown' ? itemCondition : null;
}

export function validateVintedListing(raw: unknown, markdown?: string): UniversalListing {
  if (typeof raw !== 'object' || raw === null) {
    throw new LlmValidationError('output is not an object');
  }

  const r = raw as Record<string, unknown>;

  if (typeof r['externalId'] !== 'string') throw new LlmValidationError('missing or invalid externalId');
  if (typeof r['title'] !== 'string') throw new LlmValidationError('missing or invalid title');
  if (typeof r['url'] !== 'string') throw new LlmValidationError('missing or invalid url');

  // Authoritative deterministic parse of the Vinted alt-text pattern. Where it
  // yields a value we trust it over the reader model, which is unreliable for
  // these fields (it often returns the whole alt as the title or drops the price).
  const alt = parseVintedAlt(markdown);

  const llmCurrentPrice = assertNullableFloat(r['currentPrice'], 'currentPrice');
  const currentPrice = alt.currentPrice ?? llmCurrentPrice;
  const llmFavoriteCount = assertNullableInt(r['favoriteCount'], 'favoriteCount');
  const favoriteCount = llmFavoriteCount ?? recoverFavoriteCount(markdown);
  const description = assertNullableString(r['description'], 'description');
  const imageUrl = assertNullableString(r['imageUrl'], 'imageUrl');
  const publishedAtRaw = assertNullableString(r['publishedAt'], 'publishedAt');
  const llmBrand = assertNullableString(r['brand'], 'brand');
  const brand = alt.brand ?? llmBrand;
  const size = assertNullableString(r['size'], 'size');
  const llmCondition = assertNullableString(r['condition'], 'condition');
  // Resolution order: deterministic alt parse → raw LLM `condition` → the nested
  // `siteSpecificData.itemCondition` of an already-extracted UniversalListing.
  // The last fallback keeps the validator idempotent so re-validating its own
  // output (as the live specs do) never spuriously fails.
  const condition = assertRequiredString(
    alt.condition ?? llmCondition ?? nestedItemCondition(r),
    'condition',
  );
  const title = alt.title ?? assertRequiredString(r['title'], 'title');
  const publishedAt = parseValidatedDate(publishedAtRaw, 'publishedAt');

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

  const url = r['url'] as string;

  return {
    externalId: resolveExternalId(r['externalId'] as string, url),
    title,
    description,
    url,
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
