// Deal-related types shared across services

import { SiteSource } from './site-source.js';

/**
 * Raw deal data extracted from any supported site.
 *
 * This interface uses a flat structure with optional site-specific fields
 * for simplicity. Fields marked as site-specific may only be present
 * when the deal originates from that particular source.
 *
 * @remarks
 * The `source` field indicates which site the deal came from and can be
 * used to determine which optional fields are expected to be populated.
 */
export interface RawDeal {
  /** Unique identifier from the source site */
  externalId: string;
  /** Deal title/name */
  title: string;
  /** Deal description (optional) */
  description?: string;
  /** Primary category */
  category: string;
  /** Full category path/hierarchy */
  categoryPath: string[];
  /** Current deal price */
  currentPrice?: number;
  /** Original price before discount */
  originalPrice?: number;
  /** Calculated discount percentage */
  discountPercentage?: number;
  /** Absolute discount amount */
  discountAmount?: number;
  /** Merchant/seller name */
  merchant?: string;
  /** Physical store location (if applicable) */
  storeLocation?: string;

  // === Site-specific fields ===
  // These fields are optional and only populated for specific sources.
  // Check the `source` field to determine which fields are relevant.

  /** Free shipping available (Dealabs, Vinted) */
  freeShipping?: boolean;
  /** Community temperature/heat score (Dealabs only) */
  temperature?: number;
  /** Number of comments on the deal (Dealabs only) */
  commentCount?: number;
  /** Whether the deal is community verified (Dealabs only) */
  communityVerified?: boolean;

  // === Common optional fields ===

  /** When the deal was published */
  publishedAt?: Date;
  /** When the deal expires */
  expiresAt?: Date;
  /** URL to the deal page */
  url: string;
  /** URL to the deal image */
  imageUrl?: string;
  /** Whether the deal has expired */
  isExpired: boolean;
  /** Whether this is a coupon/code deal (Dealabs only) */
  isCoupon?: boolean;
  /** Source site identifier (should match SiteSource enum values) */
  source: string;
  /** Whether the deal is currently active */
  isActive: boolean;
}

/**
 * Site-specific extension fields for Dealabs deals.
 * These fields are only populated when source is SiteSource.DEALABS.
 */
export interface DealabsSpecificFields {
  /** Community temperature/heat score */
  temperature: number;
  /** Number of comments on the deal */
  commentCount: number;
  /** Whether the deal is community verified */
  communityVerified: boolean;
  /** Whether this is a coupon/code deal */
  isCoupon: boolean;
}

/**
 * Site-specific extension fields for Vinted deals.
 * These fields are only populated when source is SiteSource.VINTED.
 */
export interface VintedSpecificFields {
  /** Number of favorites on the item */
  favoriteCount?: number;
  /** Number of views on the item */
  viewCount?: number;
  /** Whether the item is boosted */
  boosted?: boolean;
  /** Brand name */
  brand?: string;
  /** Size of the item */
  size?: string;
  /** Color of the item */
  color?: string;
  /** Condition of the item */
  condition?: string;
  /** Seller username */
  sellerName?: string;
  /** Seller rating */
  sellerRating?: number;
}

/**
 * Site-specific extension fields for LeBonCoin deals.
 * These fields are only populated when source is SiteSource.LEBONCOIN.
 */
export interface LeBonCoinSpecificFields {
  /** City where the item is located */
  city?: string;
  /** Postal code */
  postcode?: string;
  /** Department (French administrative region) */
  department?: string;
  /** Region */
  region?: string;
  /** Whether the seller is a professional */
  proSeller?: boolean;
  /** Whether the listing is marked as urgent */
  urgentFlag?: boolean;
  /** Whether this is a featured/top listing */
  topAnnonce?: boolean;
  /** Available delivery options */
  deliveryOptions?: string[];
  /** Shipping cost */
  shippingCost?: number;
}
