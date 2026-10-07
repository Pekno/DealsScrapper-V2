import type { FilterOperator } from '@dealscrapper/shared-types';

/**
 * Type categories used to validate (field, operator) pairings.
 *
 * These mirror the value shapes the matching engine actually reasons about in
 * {@link FilterMatcherService.evaluateOperator}: numbers, strings, booleans,
 * dates, arrays, and opaque JSON blobs.
 */
export type FieldTypeCategory =
  | 'string'
  | 'number'
  | 'boolean'
  | 'date'
  | 'array'
  | 'json';

/**
 * Runtime field -> type-category map.
 *
 * This is the load-bearing counterpart to the compile-time `FieldTypeMap`
 * interface in `@dealscrapper/shared-types`. The interface documents field
 * types but is erased at runtime; this map lets the DTO boundary actually
 * reject nonsensical (field, operator) pairs.
 *
 * Kept inside the API validation layer (not shared-types) so the blast radius
 * stays API-only. Mirrors `FieldTypeMap` field-for-field, plus the computed
 * aliases whose categories follow their source field.
 *
 * Fields NOT present here are treated as unknown and fail OPEN — the
 * site-fields validator already handles unknown/site-specific fields, so this
 * map intentionally only covers fields whose engine type is well-defined.
 */
export const FIELD_TYPE_CATEGORIES: Readonly<
  Record<string, FieldTypeCategory>
> = {
  // String fields
  id: 'string',
  externalId: 'string',
  title: 'string',
  description: 'string',
  brand: 'string',
  model: 'string',
  sku: 'string',
  category: 'string',
  subcategory: 'string',
  productType: 'string',
  merchant: 'string',
  merchantType: 'string',
  dealType: 'string',
  exclusivityLevel: 'string',
  urgencyLevel: 'string',
  stockLevel: 'string',
  url: 'string',
  imageUrl: 'string',
  storeLocation: 'string',

  // Numeric fields
  currentPrice: 'number',
  originalPrice: 'number',
  discountPercentage: 'number',
  discountAmount: 'number',
  cashbackAmount: 'number',
  temperature: 'number',
  merchantRating: 'number',
  loyaltyPoints: 'number',
  shippingCost: 'number',

  // Boolean fields
  freeShipping: 'boolean',
  pickupAvailable: 'boolean',
  isActive: 'boolean',

  // Date fields
  publishedAt: 'date',
  expiresAt: 'date',
  scrapedAt: 'date',
  createdAt: 'date',
  updatedAt: 'date',

  // Array fields
  categoryPath: 'array',
  keywords: 'array',

  // JSON fields
  metadata: 'json',

  // Computed fields / aliases (category follows the source field)
  age: 'number', // hours since scrapedAt
  discountPercent: 'number', // calculated percentage
  heat: 'number', // alias for temperature
  price: 'number', // alias for currentPrice
  stock: 'string', // alias for stockLevel
  availability: 'string', // alias for stockLevel
  rating: 'number', // alias for merchantRating
  specs: 'json', // alias for metadata
};

/**
 * Operator -> allowed type-categories table.
 *
 * Derived directly from the engine semantics in
 * {@link FilterMatcherService.evaluateOperator}, NOT from guesses:
 *
 * - `=` / `!=`: strict `===` / `!==` — type-agnostic, so allowed for every
 *   category (the engine never type-gates these).
 * - `>` `>=` `<` `<=`: the engine returns `false` unless BOTH operands are
 *   `number` -> numeric only.
 * - String ops (`CONTAINS`, `NOT_CONTAINS`, `STARTS_WITH`, `ENDS_WITH`,
 *   `EQUALS`, `NOT_EQUALS`, `REGEX`, `NOT_REGEX`): the engine does
 *   `String(fieldValue)` coercion. While that technically "works" on any
 *   stringifiable value, it is only meaningful for strings, and applying it to
 *   non-strings is exactly the silent never-match / nonsense this item targets
 *   (e.g. `temperature REGEX`, `freeShipping CONTAINS`) -> string only.
 * - `IN` / `NOT_IN`: the engine coerces the field via `String(fieldValue)` and
 *   compares against an array literal -> string or number fields.
 * - `INCLUDES_ANY` / `INCLUDES_ALL` / `NOT_INCLUDES_ANY`: the engine does
 *   substring matching with `String(fieldValue).includes(...)` (the array guard
 *   is on the RULE value, not the field). This is meaningful for string fields
 *   (the documented `title INCLUDES_ANY [...]` usage) and for array fields
 *   (which stringify to a comma-joined list) -> string or array. Numeric/
 *   boolean/date/json fields would only ever produce nonsense substring matches,
 *   so they stay rejected.
 * - `IS_TRUE` / `IS_FALSE`: `=== true` / `=== false` -> boolean only.
 * - `BEFORE` / `AFTER` / `OLDER_THAN` / `NEWER_THAN`: the engine returns
 *   `false` unless `fieldValue instanceof Date` -> date only.
 * - `BETWEEN`: the engine has a numeric branch and a Date branch -> number or
 *   date.
 */
const ALL_CATEGORIES: readonly FieldTypeCategory[] = [
  'string',
  'number',
  'boolean',
  'date',
  'array',
  'json',
];

export const OPERATOR_ALLOWED_CATEGORIES: Readonly<
  Record<FilterOperator, readonly FieldTypeCategory[]>
> = {
  // Equality — type-agnostic strict comparison in the engine
  '=': ALL_CATEGORIES,
  '!=': ALL_CATEGORIES,

  // Numeric comparison — engine requires both operands to be numbers
  '>': ['number'],
  '>=': ['number'],
  '<': ['number'],
  '<=': ['number'],

  // String operators — String() coercion, meaningful for strings only
  CONTAINS: ['string'],
  NOT_CONTAINS: ['string'],
  STARTS_WITH: ['string'],
  ENDS_WITH: ['string'],
  REGEX: ['string'],
  NOT_REGEX: ['string'],
  EQUALS: ['string'],
  NOT_EQUALS: ['string'],

  // Membership — scalar field tested against an array literal
  IN: ['string', 'number'],
  NOT_IN: ['string', 'number'],

  // Substring overlap — engine does String(fieldValue).includes(...), so it
  // works on string fields (documented `title INCLUDES_ANY [...]` usage) and on
  // array fields (which stringify to a comma-joined list)
  INCLUDES_ANY: ['string', 'array'],
  INCLUDES_ALL: ['string', 'array'],
  NOT_INCLUDES_ANY: ['string', 'array'],

  // Boolean predicates
  IS_TRUE: ['boolean'],
  IS_FALSE: ['boolean'],

  // Date operators — engine requires Date operands
  BEFORE: ['date'],
  AFTER: ['date'],
  BETWEEN: ['number', 'date'],
  OLDER_THAN: ['date'],
  NEWER_THAN: ['date'],
};

/**
 * Looks up a field's type category, returning `undefined` for unknown fields.
 *
 * Unknown fields (site-specific fields like `favoriteCount`, `size`, `city`)
 * are intentionally absent so callers can fail OPEN and defer to the
 * site-fields validator.
 *
 * @param field - Field name from a filter rule
 * @returns The field's type category, or `undefined` if not mapped
 */
export function getFieldTypeCategory(
  field: string
): FieldTypeCategory | undefined {
  return FIELD_TYPE_CATEGORIES[field];
}

/**
 * Checks whether an operator is valid for a given type category.
 *
 * @param operator - The filter operator
 * @param category - The field's type category
 * @returns True if the engine can meaningfully evaluate this pairing
 */
export function isOperatorAllowedForCategory(
  operator: FilterOperator,
  category: FieldTypeCategory
): boolean {
  const allowed = OPERATOR_ALLOWED_CATEGORIES[operator];
  // Unknown operator -> fail open (other validators / the engine handle it)
  if (!allowed) {
    return true;
  }
  return allowed.includes(category);
}
