import type { CheerioAPI, Cheerio } from 'cheerio';
import type { Element } from 'domhandler';
import { SiteSource } from '@dealscrapper/shared-types';
import type { UniversalListing, DealabsData } from '../base/site-adapter.interface.js';

/**
 * Per-site CSS selectors for the Dealabs listing card. Kept as a small config
 * object so the extraction logic stays declarative and the selectors are easy
 * to audit against the live markup. Only Dealabs supplies a map today — the
 * other sites cram their fields into alt-text and remain LLM-only.
 */
export const DEALABS_CARD_SELECTORS = {
  /** Numeric thread id lives in the article id, e.g. id="thread_3317035". */
  url: 'a.cept-tt.thread-link',
  price: 'span.thread-price',
  originalPrice: 'span.text--lineThrough',
  title: 'a.js-thread-title',
  image: 'img.thread-image',
  merchant: 'a[data-t="merchantLink"]',
  temperature: 'button.cept-vote-temp',
  comments: 'a[data-t="commentsLink"]',
} as const;

/**
 * Result of a selector-first extraction attempt for a single card.
 * When {@link allRequiredPresent} is false, the caller must fall back to the LLM.
 */
export interface SelectorExtractionResult {
  /** Fully-formed listing when all required stable fields were found, else null. */
  readonly listing: UniversalListing | null;
  /** True when externalId, url and currentPrice were all extracted from selectors. */
  readonly allRequiredPresent: boolean;
}

/**
 * Parses a French-formatted Dealabs price string into a number.
 * Handles thousands separators (spaces / NBSP) and comma decimals:
 *   "969€" -> 969, "1 469€" -> 1469, "961,30€" -> 961.30.
 * Returns null when no numeric value is present (e.g. "Gratuit").
 */
function parseFrenchPrice(raw: string | undefined): number | null {
  if (!raw) {
    return null;
  }
  const normalized = raw
    .replace(/[\s  ]/g, '')
    .replace(',', '.')
    .replace(/[^0-9.]/g, '');
  if (normalized.length === 0) {
    return null;
  }
  const value = Number.parseFloat(normalized);
  return Number.isNaN(value) ? null : value;
}

/** Extracts the numeric thread id from the article id attribute (thread_3317035 -> 3317035). */
function extractExternalId($element: Cheerio<Element>): string | null {
  const id = $element.attr('id') ?? '';
  const match = id.match(/(\d+)/);
  return match ? match[1] : null;
}

function parseIntOrNull(raw: string | undefined): number | null {
  if (!raw) {
    return null;
  }
  const match = raw.replace(/[\s  ]/g, '').match(/\d+/);
  return match ? Number.parseInt(match[0], 10) : null;
}

/**
 * Pure selector-first extraction for a single Dealabs listing card.
 *
 * The gate requires the three stable fields — `externalId`, `url`,
 * `currentPrice` — to all be present. Priced deals expose all three and skip
 * the LLM entirely; free/coupon-only deals lack a `.thread-price` span, so the
 * gate reports `allRequiredPresent: false` and the caller falls back to the LLM.
 *
 * No I/O, no LLM: given a loaded cheerio context it returns synchronously.
 */
export function extractDealabsListingFromSelectors(
  $: CheerioAPI,
  $element: Cheerio<Element>,
): SelectorExtractionResult {
  const externalId = extractExternalId($element);
  const url = $element.find(DEALABS_CARD_SELECTORS.url).attr('href') ?? null;
  const currentPrice = parseFrenchPrice(
    $element.find(DEALABS_CARD_SELECTORS.price).first().text(),
  );

  if (externalId === null || url === null || currentPrice === null) {
    return { listing: null, allRequiredPresent: false };
  }

  const title =
    $element.find(DEALABS_CARD_SELECTORS.title).attr('title') ??
    $element.find(DEALABS_CARD_SELECTORS.title).text().trim();
  const imageUrl = $element.find(DEALABS_CARD_SELECTORS.image).attr('src') ?? null;
  const merchant = $element.find(DEALABS_CARD_SELECTORS.merchant).first().text().trim() || null;
  const originalPrice = parseFrenchPrice(
    $element.find(DEALABS_CARD_SELECTORS.originalPrice).first().text(),
  );
  const temperature = parseIntOrNull(
    $element.find(DEALABS_CARD_SELECTORS.temperature).first().text(),
  );
  const commentCount = parseIntOrNull(
    $element.find(DEALABS_CARD_SELECTORS.comments).first().text(),
  );

  const siteSpecificData: DealabsData = {
    type: SiteSource.DEALABS,
    temperature,
    commentCount,
    communityVerified: false,
    freeShipping: false,
    isCoupon: false,
    discountPercentage:
      originalPrice !== null && currentPrice !== null && originalPrice > 0
        ? Math.round(((originalPrice - currentPrice) / originalPrice) * 100)
        : null,
    expiresAt: null,
  };

  const listing: UniversalListing = {
    externalId,
    title,
    description: null,
    url,
    imageUrl,
    siteId: SiteSource.DEALABS,
    currentPrice,
    originalPrice,
    merchant,
    location: null,
    publishedAt: null,
    isActive: true,
    categorySlug: '',
    siteSpecificData,
  };

  return { listing, allRequiredPresent: true };
}
