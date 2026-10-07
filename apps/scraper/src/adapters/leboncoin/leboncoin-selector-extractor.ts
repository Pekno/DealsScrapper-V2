import type { CheerioAPI, Cheerio } from 'cheerio';
import type { Element } from 'domhandler';
import { SiteSource } from '@dealscrapper/shared-types';
import type { UniversalListing, LeBonCoinData } from '../base/site-adapter.interface.js';

/** Origin used to absolutize the relative `/ad/...` hrefs, matching the LLM output. */
const LEBONCOIN_BASE_URL = 'https://www.leboncoin.fr';

/**
 * Per-site CSS selectors for the LeBonCoin classified-ad card. Unlike Vinted —
 * whose fields are crammed into image alt-text — LeBonCoin exposes the stable
 * gate fields as structured elements: the ad link carries the id in its href and
 * the price lives in a dedicated `Generic_price` paragraph. The `Generic_*`
 * prefixes are the site's own semantic class names (the `__hash` suffix is a
 * volatile CSS-module artefact), so we match on the stable prefix.
 */
export const LEBONCOIN_CARD_SELECTORS = {
  /** The full-card overlay link, e.g. href="/ad/accessoires_informatique/3155664945". */
  link: 'a[href^="/ad/"]',
  /** Price paragraph, aria-hidden to avoid the duplicated sr-only "Prix: ..." text. */
  price: 'p[class*="Generic_price"]',
  /** Bold, line-clamped title paragraph. */
  title: 'p[class*="line-clamp"]',
  image: 'img[src*="ad-image"]',
  /** Location paragraph, aria-hidden to avoid the sr-only "Située à ..." duplicate. */
  location: 'p[class*="Generic_location"]',
  /** Seller display name lives in the vendor-details group. */
  sellerName: 'span[class*="font-bold"]',
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
 * Parses a French-formatted LeBonCoin price string into a number.
 * Handles thousands separators (spaces / NBSP) and comma decimals:
 *   "195 €" -> 195, "1 450 €" -> 1450, "12,50 €" -> 12.50.
 * Returns null when no numeric value is present (e.g. "Gratuit").
 */
function parseFrenchPrice(raw: string | undefined): number | null {
  if (!raw) {
    return null;
  }
  const normalized = raw
    .replace(/[\s  ]/g, '')
    .replace(',', '.')
    .replace(/[^0-9.]/g, '');
  if (normalized.length === 0) {
    return null;
  }
  const value = Number.parseFloat(normalized);
  return Number.isNaN(value) ? null : value;
}

/** Collapses the runs of whitespace the indented card markup leaves in text nodes. */
function normalizeWhitespace(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim();
}

/** Extracts the trailing numeric ad id from an /ad/<slug>/<id> href. */
function extractExternalId(href: string | undefined): string | null {
  if (!href) {
    return null;
  }
  const match = href.match(/\/ad\/[^/]+\/(\d+)/);
  return match ? match[1] : null;
}

/** Splits a "Le Cannet 06110" location string into city and 5-digit postcode. */
function splitLocation(location: string | null): { city: string | null; postcode: string | null } {
  if (location === null) {
    return { city: null, postcode: null };
  }
  const match = location.match(/^(.*?)\s*(\d{5})\s*$/);
  if (!match) {
    return { city: location, postcode: null };
  }
  return { city: match[1].trim() || null, postcode: match[2] };
}

/**
 * Pure selector-first extraction for a single LeBonCoin classified-ad card.
 *
 * The gate requires the three stable fields — `externalId`, `url`,
 * `currentPrice` — to all be present. Priced ads expose all three via structured
 * elements and skip the LLM entirely; ads without a parseable price (e.g. free
 * listings) make the gate report `allRequiredPresent: false`, so the caller
 * falls back to the LLM.
 *
 * No I/O, no LLM: given a loaded cheerio context it returns synchronously. The
 * produced listing matches `validateLeBonCoinListing()` output exactly.
 */
export function extractLeBonCoinListingFromSelectors(
  $: CheerioAPI,
  $element: Cheerio<Element>,
): SelectorExtractionResult {
  const href = $element.find(LEBONCOIN_CARD_SELECTORS.link).first().attr('href') ?? undefined;
  const externalId = extractExternalId(href);
  const currentPrice = parseFrenchPrice(
    $element.find(LEBONCOIN_CARD_SELECTORS.price).first().text(),
  );

  if (externalId === null || href === undefined || currentPrice === null) {
    return { listing: null, allRequiredPresent: false };
  }

  const url = `${LEBONCOIN_BASE_URL}${href}`;
  const title = normalizeWhitespace($element.find(LEBONCOIN_CARD_SELECTORS.title).first().text());
  const imageUrl = $element.find(LEBONCOIN_CARD_SELECTORS.image).first().attr('src') ?? null;
  const location =
    normalizeWhitespace($element.find(LEBONCOIN_CARD_SELECTORS.location).first().text()) || null;
  const sellerName =
    normalizeWhitespace($element.find(LEBONCOIN_CARD_SELECTORS.sellerName).first().text()) || null;
  const { city, postcode } = splitLocation(location);

  const siteSpecificData: LeBonCoinData = {
    type: SiteSource.LEBONCOIN,
    city,
    postcode,
    department: null,
    region: null,
    proSeller: null,
    sellerName,
    urgentFlag: null,
    topAnnonce: null,
    deliveryOptions: [],
    shippingCost: null,
    condition: null,
    attributes: null,
  };

  const listing: UniversalListing = {
    externalId,
    title,
    description: null,
    url,
    imageUrl,
    siteId: SiteSource.LEBONCOIN,
    currentPrice,
    originalPrice: null,
    merchant: null,
    location,
    publishedAt: null,
    isActive: true,
    categorySlug: '',
    siteSpecificData,
  };

  return { listing, allRequiredPresent: true };
}
