import { SiteSource } from '@dealscrapper/shared-types';
import type { IUrlOptimizer } from './url-optimizer.interface.js';
import type { IExpiryResolver } from './expiry-resolver.interface.js';

export interface ISiteAdapter {
  readonly siteId: SiteSource;
  readonly baseUrl: string;
  readonly displayName: string;
  readonly colorCode: string; // Hex color for frontend

  /**
   * Optional URL optimizer for this site.
   * If undefined, no URL optimization is performed.
   */
  readonly urlOptimizer?: IUrlOptimizer;

  /**
   * Optional expiry date resolver for presence-based expiry detection.
   * If undefined, defaults to new Date() when marking a listing as expired.
   */
  readonly expiryResolver?: IExpiryResolver;

  /**
   * Extracts listings from HTML page.
   * @param html - Raw HTML content
   * @param sourceUrl - URL of the scraped page
   * @returns Array of universal listings with site-specific data
   */
  extractListings(html: string, sourceUrl: string): UniversalListing[];

  /**
   * Builds category URL for scraping.
   * @param categorySlug - Category identifier
   * @param page - Page number (1-indexed)
   */
  buildCategoryUrl(categorySlug: string, page?: number): string;

  /**
   * Extracts category slug from URL.
   * @param url - Category page URL
   */
  extractCategorySlug(url: string): string;

  /**
   * Extracts total element count from listing page.
   * @param html - HTML content
   */
  extractElementCount(html: string): number | undefined;

  /**
   * Returns CSS selector for listing elements.
   */
  getListingSelector(): string;

  /**
   * Validates that HTML contains expected structure.
   * @throws {Error} if validation fails
   */
  validateHtml(html: string): void;
}

export interface UniversalListing {
  readonly externalId: string;
  readonly title: string;
  readonly description: string | null;
  readonly url: string;
  readonly imageUrl: string | null;
  readonly siteId: SiteSource;
  readonly currentPrice: number | null;
  readonly originalPrice: number | null;
  readonly merchant: string | null;
  readonly location: string | null;
  readonly publishedAt: Date;
  readonly isActive: boolean;
  readonly categorySlug: string;
  readonly siteSpecificData: SiteSpecificData;
}

export type SiteSpecificData = DealabsData | VintedData | LeBonCoinData;

export interface DealabsData {
  type: typeof SiteSource.DEALABS;
  temperature: number;
  commentCount: number;
  communityVerified: boolean;
  freeShipping: boolean;
  isCoupon: boolean;
  discountPercentage: number | null;
  expiresAt: Date | null;
}

export interface VintedData {
  type: typeof SiteSource.VINTED;
  favoriteCount: number;
  viewCount: number;
  itemCondition: string;
  brand: string | null;
  size: string | null;
  color: string | null;
  sellerRating: number | null;
  sellerName: string | null;
}

export interface LeBonCoinData {
  type: typeof SiteSource.LEBONCOIN;
  city: string | null;
  postcode: string | null;
  department: string | null;
  region: string | null;
  proSeller: boolean;
  sellerName: string | null;
  urgentFlag: boolean;
  topAnnonce: boolean;
  deliveryOptions: string[];
  shippingCost: number | null;
  condition: string | null;
  attributes: unknown | null;
}
