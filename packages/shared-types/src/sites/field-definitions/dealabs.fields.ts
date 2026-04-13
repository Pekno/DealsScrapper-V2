/**
 * Dealabs-Specific Filterable Fields
 */
import { SiteFilterableField } from './base/filterable-field.decorator.js';

export class DealabsFilterSchema {
  @SiteFilterableField({
    label: 'Temperature',
    type: 'number',
    description: 'Community heat score',
    operators: ['=', '!=', '>', '>=', '<', '<='],
    sites: ['dealabs'],
    aliases: ['heat'], // 'heat' resolves to 'temperature'
    min: -100,
    max: 10000,
    urlParam: { type: 'range', min: 'temperatureFrom', max: 'temperatureTo', buffer: 5 },
  })
  temperature!: number;

  @SiteFilterableField({
    label: 'Merchant',
    type: 'string',
    description: 'Store name',
    operators: ['EQUALS', 'NOT_EQUALS', 'CONTAINS', 'IN'],
    sites: ['dealabs'],
    urlParam: {
      type: 'set',
      param: 'retailers',
      idMap: {
        amazon: '1',
        fnac: '45',
        cdiscount: '78',
        boulanger: '102',
        darty: '67',
      },
    },
  })
  merchant!: string;

  @SiteFilterableField({
    label: 'Original Price',
    type: 'number',
    description: 'Price before discount',
    operators: ['=', '!=', '<', '<=', '>', '>='],
    sites: ['dealabs'],
    min: 0,
    step: 0.01,
    precision: 2,
  })
  originalPrice!: number;

  @SiteFilterableField({
    label: 'Discount %',
    type: 'number',
    description: 'Discount percentage',
    operators: ['=', '!=', '>', '>=', '<', '<='],
    sites: ['dealabs'],
    min: 0,
    max: 100,
  })
  discountPercentage!: number;

  @SiteFilterableField({
    label: 'Free Shipping',
    type: 'boolean',
    description: 'Has free shipping',
    operators: ['IS_TRUE', 'IS_FALSE'],
    sites: ['dealabs'],
  })
  freeShipping!: boolean;

  @SiteFilterableField({
    label: 'Is Coupon',
    type: 'boolean',
    description: 'Is a coupon deal',
    operators: ['IS_TRUE', 'IS_FALSE'],
    sites: ['dealabs'],
  })
  isCoupon!: boolean;

  @SiteFilterableField({
    label: 'Comment Count',
    type: 'number',
    description: 'Number of comments',
    operators: ['=', '!=', '>', '>=', '<', '<='],
    sites: ['dealabs'],
    min: 0,
  })
  commentCount!: number;
}
