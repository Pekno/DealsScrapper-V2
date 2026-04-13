/**
 * Shared Filterable Fields
 * Fields used by multiple sites but not universal
 */
import { SiteFilterableField } from './base/filterable-field.decorator.js';

export class SharedFilterSchema {
  @SiteFilterableField({
    label: 'Condition',
    type: 'string',
    description: 'Item condition',
    operators: ['EQUALS', 'NOT_EQUALS', 'IN'],
    sites: ['vinted', 'leboncoin'], // Shared between these sites
  })
  condition!: string;
}
