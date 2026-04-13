import { RawDeal, COMMON_FILTERABLE_FIELDS } from '@dealscrapper/shared-types';

/**
 * Type-safe utility to get all RawDeal field names
 * This matches the actual RawDeal interface used during scraping
 */
export function getRawDealFieldNames(): (keyof RawDeal)[] {
  // This list matches the actual RawDeal interface (only fields that exist)
  const rawDealFields: (keyof RawDeal)[] = [
    'externalId',
    'title',
    'description',
    'category',
    'categoryPath',
    'currentPrice',
    'originalPrice',
    'discountPercentage',
    'discountAmount',
    'merchant',
    'storeLocation',
    'freeShipping',
    'temperature',
    'commentCount',
    'communityVerified',
    'publishedAt',
    'expiresAt',
    'url',
    'imageUrl',
    'isExpired',
    'isCoupon',
    'source',
    'isActive',
  ];

  return rawDealFields;
}

/**
 * Computed/alias fields that provide convenience access or calculations
 */
export const COMPUTED_FIELDS = [
  'price', // alias for currentPrice
  'heat', // alias for temperature
  'rating', // alias for merchantRating
  'stock', // alias for stockLevel
  'availability', // alias for stockLevel
  'specs', // alias for additional data (not in RawDeal)
  'age', // computed from publishedAt
  'discountPercent', // computed from price difference
] as const;

/**
 * Get all filterable fields (RawDeal fields + computed fields)
 */
export function getAllFilterableFields(): string[] {
  return [...getRawDealFieldNames().map(String), ...COMPUTED_FIELDS];
}

// COMMON_FILTERABLE_FIELDS is now imported from @dealscrapper/shared-types

/**
 * Validate that a field name is a valid filterable field
 */
export function isValidFilterableField(field: string): boolean {
  const allFields = getAllFilterableFields();
  return allFields.includes(field);
}

/**
 * Get the expected type for a field (for validation)
 */
export function getFieldType(field: string): string {
  // This could be enhanced to return actual TypeScript types
  // for runtime validation
  const stringFields = [
    'title',
    'description',
    'category',
    'brand',
    'merchant',
  ];
  const numberFields = [
    'currentPrice',
    'temperature',
    'age',
    'discountPercent',
  ];
  const booleanFields = ['freeShipping', 'pickupAvailable', 'isActive'];
  const dateFields = ['publishedAt', 'expiresAt', 'scrapedAt'];
  const arrayFields = ['categoryPath', 'keywords'];

  if (stringFields.some((f) => field.includes(f))) return 'string';
  if (numberFields.some((f) => field.includes(f))) return 'number';
  if (booleanFields.includes(field)) return 'boolean';
  if (dateFields.includes(field)) return 'Date';
  if (arrayFields.includes(field)) return 'array';

  return 'unknown';
}
