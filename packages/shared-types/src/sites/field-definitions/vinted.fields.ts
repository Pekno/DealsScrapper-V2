/**
 * Vinted-Specific Filterable Fields
 */
import { SiteFilterableField } from './base/filterable-field.decorator.js';

export class VintedFilterSchema {
  @SiteFilterableField({
    label: 'Brand',
    type: 'string',
    description: 'Item brand',
    operators: ['EQUALS', 'NOT_EQUALS', 'CONTAINS', 'IN'],
    sites: ['vinted'],
  })
  brand!: string;

  @SiteFilterableField({
    label: 'Size',
    type: 'string',
    description: 'Item size',
    operators: ['EQUALS', 'NOT_EQUALS', 'IN'],
    sites: ['vinted'],
  })
  size!: string;

  // Note: 'condition' is in SharedFilterSchema (shared with leboncoin)

  @SiteFilterableField({
    label: 'Favorites',
    type: 'number',
    description: 'Number of favorites',
    operators: ['=', '!=', '>', '>=', '<', '<='],
    sites: ['vinted'],
    min: 0,
  })
  favoriteCount!: number;

  @SiteFilterableField({
    label: 'Color',
    type: 'string',
    description: 'Item color',
    operators: ['EQUALS', 'NOT_EQUALS', 'IN'],
    sites: ['vinted'],
  })
  color!: string;

  @SiteFilterableField({
    label: 'Seller Rating',
    type: 'number',
    description: 'Seller rating',
    operators: ['=', '!=', '>', '>=', '<', '<='],
    sites: ['vinted'],
    min: 0,
    max: 5,
    step: 0.1,
    precision: 1,
  })
  sellerRating!: number;

  @SiteFilterableField({
    label: 'Boosted',
    type: 'boolean',
    description: 'Is a boosted listing',
    operators: ['IS_TRUE', 'IS_FALSE'],
    sites: ['vinted'],
  })
  boosted!: boolean;
}
