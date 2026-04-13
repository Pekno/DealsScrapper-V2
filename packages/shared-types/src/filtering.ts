// Filtering-related types shared across services
// These types are used by both API and Scraper services for filter processing

import { RawDeal } from './deals.js';

export type FilterValue =
  | string
  | number
  | boolean
  | Date
  | string[]
  | number[];

/**
 * @deprecated Use `RuleBasedFilterExpression` instead.
 * This legacy tree-based filter expression format is being phased out.
 * New code should use the modern rule-based system with `RuleBasedFilterExpression`.
 *
 * Migration guide:
 * - Replace `type: 'GROUP'` with `FilterRuleGroup.logic` (AND/OR)
 * - Replace `type: 'CONDITION'` with `FilterRule`
 * - Use `RuleBasedFilterExpression.rules` array instead of nested `children`
 */
export interface LegacyFilterExpression {
  type: 'GROUP' | 'CONDITION';
  operator?: 'AND' | 'OR';
  field?: string;
  comparison?: '>' | '<' | '=' | '>=' | '<=' | 'CONTAINS' | 'REGEX';
  value?: FilterValue;
  children?: LegacyFilterExpression[];
}

/**
 * @deprecated Alias for backwards compatibility. Use `RuleBasedFilterExpression` instead.
 */
export type FilterExpression = LegacyFilterExpression;

export interface CategorySelection {
  category: string;
  subcategories: string[];
  sourceUrls: string[];
}

export interface FilterConfiguration {
  id: string;
  name: string;
  userId: string;
  monitoredCategories: CategorySelection[];
  filterExpression: FilterExpression;
  notifications: {
    immediate: boolean;
    digest: 'hourly' | 'daily' | 'weekly' | 'disabled';
  };
}

// === MODERN RULE-BASED FILTER SYSTEM ===
// These types provide comprehensive filtering capabilities

// Derive filterable fields directly from RawDeal interface (used during scraping)
export type RawDealField = keyof RawDeal;

// Extended fields that include computed/derived values
export type ComputedField =
  | 'age' // Computed from scrapedAt
  | 'discountPercent' // Computed from originalPrice/currentPrice
  | 'heat' // Alias for temperature
  | 'price' // Alias for currentPrice
  | 'stock' // Alias for stockLevel
  | 'availability' // Alias for stockLevel
  | 'rating' // Alias for merchantRating
  | 'specs'; // Alias for metadata

// Site-specific fields from extension tables
export type VintedSpecificField =
  | 'favoriteCount'
  | 'viewCount'
  | 'boosted'
  | 'brand'
  | 'size'
  | 'color'
  | 'condition'
  | 'sellerName'
  | 'sellerRating'
  | 'buyerProtectionFee';

export type LeBonCoinSpecificField =
  | 'city'
  | 'postcode'
  | 'department'
  | 'region'
  | 'proSeller'
  | 'urgentFlag'
  | 'topAnnonce'
  | 'deliveryOptions'
  | 'shippingCost'
  | 'attributes';

// All available filterable fields (direct RawDeal fields + computed fields + site-specific fields)
export type FilterableField =
  | RawDealField
  | ComputedField
  | VintedSpecificField
  | LeBonCoinSpecificField;

// Type mapping for field validation
export interface FieldTypeMap {
  // String fields
  id: string;
  externalId: string;
  title: string;
  description: string | null;
  brand: string | null;
  model: string | null;
  sku: string | null;
  category: string;
  subcategory: string | null;
  productType: string | null;
  merchant: string | null;
  merchantType: string | null;
  dealType: string | null;
  exclusivityLevel: string | null;
  urgencyLevel: string | null;
  stockLevel: string | null;
  url: string;
  imageUrl: string | null;
  storeLocation: string | null;

  // Numeric fields
  currentPrice: number | null;
  originalPrice: number | null;
  discountPercentage: number | null;
  discountAmount: number | null;
  cashbackAmount: number | null;
  temperature: number;
  merchantRating: number | null;
  loyaltyPoints: number | null;
  shippingCost: number | null;

  // Boolean fields
  freeShipping: boolean;
  pickupAvailable: boolean;
  isActive: boolean;

  // Date fields
  publishedAt: Date | null;
  expiresAt: Date | null;
  scrapedAt: Date;
  createdAt: Date;
  updatedAt: Date;

  // Array fields
  categoryPath: string[];
  keywords: string[];

  // JSON fields
  metadata: Record<string, unknown>;

  // Computed fields
  age: number; // hours since scrapedAt
  discountPercent: number; // calculated percentage
  heat: number; // alias for temperature
  price: number; // alias for currentPrice
  stock: string; // alias for stockLevel
  availability: string; // alias for stockLevel
  rating: number; // alias for merchantRating
  specs: Record<string, unknown>; // alias for metadata
}

// Supported operators for different field types
export type FilterOperator =
  // Numeric operators
  | '='
  | '!='
  | '>'
  | '>='
  | '<'
  | '<='
  // String operators
  | 'CONTAINS'
  | 'NOT_CONTAINS'
  | 'STARTS_WITH'
  | 'ENDS_WITH'
  | 'REGEX'
  | 'NOT_REGEX'
  | 'EQUALS'
  | 'NOT_EQUALS'
  // Array operators
  | 'IN'
  | 'NOT_IN'
  | 'INCLUDES_ANY'
  | 'INCLUDES_ALL'
  | 'NOT_INCLUDES_ANY'
  // Boolean operators
  | 'IS_TRUE'
  | 'IS_FALSE'
  // Date operators
  | 'BEFORE'
  | 'AFTER'
  | 'BETWEEN'
  | 'OLDER_THAN'
  | 'NEWER_THAN';

// Logical operators for combining rules
export type LogicalOperator = 'AND' | 'OR' | 'NOT';

// Base filter rule interface
export interface FilterRule {
  field: FilterableField;
  operator: FilterOperator;
  value: string | number | boolean | string[] | number[] | Date | Date[]; // Can be string, number, boolean, array, or Date
  caseSensitive?: boolean; // For string operations
  weight?: number; // Scoring weight (default: 1.0)
  siteSpecific?: string; // Site-specific rule (e.g., 'dealabs', 'vinted', 'leboncoin'). If not specified, applies to all sites.
}

// Logical group of rules
export interface FilterRuleGroup {
  logic: LogicalOperator;
  rules: (FilterRule | FilterRuleGroup)[];
  weight?: number; // Group scoring weight
}

// Modern rule-based FilterExpression (clean, no legacy fields)
export interface RuleBasedFilterExpression {
  // Rule-based system
  rules: (FilterRule | FilterRuleGroup)[];

  // Global settings
  matchLogic?: LogicalOperator; // How to combine rules (default: AND)
  minScore?: number; // Minimum score threshold
  scoreMode?: 'weighted' | 'percentage' | 'points'; // Scoring method
}

// Filter expression input type for API
export interface FilterExpressionInput extends RuleBasedFilterExpression {
  // This is the interface used by the API for input validation
}

// Common filterable fields list
export const COMMON_FILTERABLE_FIELDS: FilterableField[] = [
  // Core deal fields (from RawDeal interface)
  'externalId',
  'title',
  'description',
  'category',
  'categoryPath',

  // Pricing fields
  'currentPrice',
  'originalPrice',
  'discountPercentage',
  'discountAmount',

  // Merchant fields
  'merchant',
  'storeLocation',

  // Deal metadata
  'freeShipping',

  // Community fields
  'temperature',
  'commentCount',
  'communityVerified',

  // Temporal fields
  'publishedAt',
  'expiresAt',

  // Content fields
  'url',
  'imageUrl',

  // Status fields
  'isExpired',
  'isCoupon',
  'source',
  'isActive',

  // Computed fields
  'age',
  'discountPercent',
  'heat',
  'price',
  'stock',
  'availability',
  'rating',
  'specs',
];
