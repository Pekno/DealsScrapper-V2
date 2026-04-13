import { SiteSource } from '@dealscrapper/shared-types';

/**
 * Site-specific fields mapping
 *
 * Maps each site to its exclusive fields (fields that ONLY exist on that site).
 * These fields come from the extension tables (ArticleDealabs, ArticleVinted, ArticleLeBonCoin).
 *
 * **Usage**:
 * - Validate filter rules to ensure site-specific fields are only used when the corresponding site is enabled
 * - Provide user-friendly error messages when validation fails
 */
export const SITE_SPECIFIC_FIELDS = {
  [SiteSource.DEALABS]: [
    // Community engagement
    'temperature',
    'heat', // Alias for temperature
    'commentCount',
    'communityVerified',

    // Deal metadata
    'originalPrice',
    'discountPercentage',
    'merchant',

    // Deal features
    'freeShipping',
    'isCoupon',
    'expiresAt',
  ],

  [SiteSource.VINTED]: [
    // Engagement metrics
    'favoriteCount',
    'viewCount',
    'boosted',

    // Fashion/item metadata
    'brand',
    'size',
    'color',
    'condition',

    // Seller info
    'sellerName',
    'sellerRating',

    // Vinted-specific pricing
    'buyerProtectionFee',
  ],

  [SiteSource.LEBONCOIN]: [
    // Location details
    'city',
    'postcode',
    'department',
    'region',

    // Seller type
    'proSeller',
    'sellerName',

    // Ad features
    'urgentFlag',
    'topAnnonce',

    // Delivery
    'deliveryOptions',
    'shippingCost',

    // Item condition
    'condition',

    // Flexible attributes
    'attributes',
  ],
} as const;

/**
 * Universal fields that exist on ALL sites
 *
 * These fields come from the base Article model and can be used in filters
 * regardless of which sites are enabled.
 */
export const UNIVERSAL_FIELDS = [
  // Core identification
  'id',
  'externalId',
  'source',

  // Content
  'title',
  'description',
  'url',
  'imageUrl',

  // Pricing
  'currentPrice',
  'price', // Alias for currentPrice

  // Categorization
  'category',
  'categoryId',
  'categoryPath',

  // Status
  'isActive',
  'isExpired',

  // Semi-universal (not all sites, but common)
  'location',
  'publishedAt',

  // Timestamps
  'scrapedAt',
  'updatedAt',

  // Computed fields (calculated at runtime, not stored)
  'age', // Time since publishedAt/scrapedAt
] as const;

/**
 * Type for all site-specific field names
 */
export type SiteSpecificField =
  | (typeof SITE_SPECIFIC_FIELDS)[SiteSource.DEALABS][number]
  | (typeof SITE_SPECIFIC_FIELDS)[SiteSource.VINTED][number]
  | (typeof SITE_SPECIFIC_FIELDS)[SiteSource.LEBONCOIN][number];

/**
 * Type for all universal field names
 */
export type UniversalField = (typeof UNIVERSAL_FIELDS)[number];

/**
 * Type for all filterable field names
 */
export type AllFilterableFields = SiteSpecificField | UniversalField;

/**
 * Helper function to check if a field is universal (available on all sites)
 *
 * @param field - Field name to check
 * @returns True if the field exists on all sites, false if it's site-specific
 */
export function isUniversalField(field: string): field is UniversalField {
  return UNIVERSAL_FIELDS.includes(field as UniversalField);
}

/**
 * Helper function to determine which site(s) a field belongs to
 *
 * @param field - Field name to check
 * @returns Array of sites that have this field, empty array if universal
 */
export function getFieldSites(field: string): SiteSource[] {
  const sites: SiteSource[] = [];

  for (const [site, fields] of Object.entries(SITE_SPECIFIC_FIELDS)) {
    if (fields.includes(field as never)) {
      sites.push(site as SiteSource);
    }
  }

  return sites;
}

/**
 * Helper function to get a user-friendly site name
 *
 * @param site - Site source enum value
 * @returns Capitalized site name
 */
export function getSiteName(site: SiteSource): string {
  switch (site) {
    case SiteSource.DEALABS:
      return 'Dealabs';
    case SiteSource.VINTED:
      return 'Vinted';
    case SiteSource.LEBONCOIN:
      return 'LeBonCoin';
    default:
      return site;
  }
}
