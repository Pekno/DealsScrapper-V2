/**
 * LeBonCoin-Specific Filterable Fields
 */
import { SiteFilterableField } from './base/filterable-field.decorator.js';

export class LeBonCoinFilterSchema {
  @SiteFilterableField({
    label: 'City',
    type: 'string',
    description: 'Location city',
    operators: ['EQUALS', 'NOT_EQUALS', 'CONTAINS', 'IN'],
    sites: ['leboncoin'],
  })
  city!: string;

  @SiteFilterableField({
    label: 'Professional Seller',
    type: 'boolean',
    description: 'Is a professional seller',
    operators: ['IS_TRUE', 'IS_FALSE'],
    sites: ['leboncoin'],
    urlParam: { type: 'boolean_map', param: 'owner_type', trueValue: 'pro', falseValue: 'private' },
  })
  proSeller!: boolean;

  @SiteFilterableField({
    label: 'Shipping Cost',
    type: 'number',
    description: 'Shipping cost',
    operators: ['=', '!=', '<', '<=', '>', '>='],
    sites: ['leboncoin'],
    min: 0,
    step: 0.01,
    precision: 2,
  })
  shippingCost!: number;

  // Note: 'condition' is in SharedFilterSchema (shared with vinted)

  @SiteFilterableField({
    label: 'Postcode',
    type: 'string',
    description: 'Postal code',
    operators: ['EQUALS', 'NOT_EQUALS', 'STARTS_WITH', 'IN'],
    sites: ['leboncoin'],
  })
  postcode!: string;

  @SiteFilterableField({
    label: 'Region',
    type: 'string',
    description: 'Geographic region',
    operators: ['EQUALS', 'NOT_EQUALS', 'IN'],
    sites: ['leboncoin'],
  })
  region!: string;

  @SiteFilterableField({
    label: 'Urgent',
    type: 'boolean',
    description: 'Has urgent badge',
    operators: ['IS_TRUE', 'IS_FALSE'],
    sites: ['leboncoin'],
  })
  urgentFlag!: boolean;

  @SiteFilterableField({
    label: 'Top Ad',
    type: 'boolean',
    description: 'Is a promoted listing',
    operators: ['IS_TRUE', 'IS_FALSE'],
    sites: ['leboncoin'],
  })
  topAnnonce!: boolean;
}
