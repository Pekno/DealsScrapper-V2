/**
 * @fileoverview Extractor service request/response contracts
 *
 * Shared types for the extractor microservice. The scraper produces
 * {@link ExtractRequest} payloads and consumes {@link ExtractResponse}
 * responses; the extractor implements the inverse.
 *
 * Note: {@link UniversalListing} is intentionally defined here (and not
 * imported from the scraper) so this contract has no runtime dependency
 * on service code. Its shape mirrors the scraper's internal
 * `UniversalListing` interface — keep them in sync when either changes.
 */

import { SiteSource } from './site-source.js';

/**
 * Site discriminator used in extractor payloads.
 * Re-exported alias of {@link SiteSource} so the plan's naming ("SiteId")
 * is available without duplicating the underlying enum.
 */
export type SiteId = SiteSource;

/**
 * Dealabs-specific extracted fields.
 */
export interface DealabsData {
  readonly type: typeof SiteSource.DEALABS;
  readonly temperature: number | null;
  readonly commentCount: number | null;
  readonly communityVerified: boolean;
  readonly freeShipping: boolean;
  readonly isCoupon: boolean;
  readonly discountPercentage: number | null;
  readonly expiresAt: Date | null;
}

/**
 * Vinted-specific extracted fields.
 */
export interface VintedData {
  readonly type: typeof SiteSource.VINTED;
  readonly favoriteCount: number | null;
  readonly viewCount: number | null;
  readonly itemCondition: string;
  readonly brand: string | null;
  readonly size: string | null;
  readonly color: string | null;
  readonly sellerRating: number | null;
  readonly sellerName: string | null;
}

/**
 * LeBonCoin-specific extracted fields.
 */
export interface LeBonCoinData {
  readonly type: typeof SiteSource.LEBONCOIN;
  readonly city: string | null;
  readonly postcode: string | null;
  readonly department: string | null;
  readonly region: string | null;
  readonly proSeller: boolean | null;
  readonly sellerName: string | null;
  readonly urgentFlag: boolean | null;
  readonly topAnnonce: boolean | null;
  readonly deliveryOptions: string[];
  readonly shippingCost: number | null;
  readonly condition: string | null;
  readonly attributes: unknown | null;
}

/**
 * Discriminated union of site-specific data blocks.
 * Disambiguate with the `type` field.
 */
export type SiteSpecificData = DealabsData | VintedData | LeBonCoinData;

/**
 * Universal listing shape produced by the extractor.
 * Mirrors the scraper's internal `UniversalListing` interface; any change
 * here must be reflected in `apps/scraper/src/adapters/base/site-adapter.interface.ts`.
 */
export interface UniversalListing {
  readonly externalId: string;
  readonly title: string;
  readonly description: string | null;
  readonly url: string;
  readonly imageUrl: string | null;
  readonly siteId: SiteId;
  readonly currentPrice: number | null;
  readonly originalPrice: number | null;
  readonly merchant: string | null;
  readonly location: string | null;
  readonly publishedAt: Date | null;
  readonly isActive: boolean;
  readonly categorySlug: string;
  readonly siteSpecificData: SiteSpecificData;
}

