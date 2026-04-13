/**
 * Universal Filterable Fields
 * Fields available on ALL sites
 */
import { SiteFilterableField } from './base/filterable-field.decorator.js';

export class UniversalFilterSchema {
  @SiteFilterableField({
    label: 'Title',
    type: 'string',
    description: 'Article title',
    operators: ['CONTAINS', 'NOT_CONTAINS', 'STARTS_WITH', 'ENDS_WITH', 'REGEX', 'EQUALS'],
    sites: 'universal',
  })
  title!: string;

  @SiteFilterableField({
    label: 'Price',
    type: 'number',
    description: 'Current price',
    operators: ['=', '!=', '<', '<=', '>', '>=', 'BETWEEN'],
    sites: 'universal',
    aliases: ['price'], // 'price' resolves to 'currentPrice'
    min: 0,
    max: 100000,
    step: 0.01,
    precision: 2,
  })
  currentPrice!: number;

  @SiteFilterableField({
    label: 'Published Date',
    type: 'date',
    description: 'When the article was published',
    operators: ['BEFORE', 'AFTER', 'BETWEEN', 'OLDER_THAN', 'NEWER_THAN'],
    sites: 'universal',
  })
  publishedAt!: Date;

  @SiteFilterableField({
    label: 'Description',
    type: 'string',
    description: 'Article description',
    operators: ['CONTAINS', 'NOT_CONTAINS', 'REGEX'],
    sites: 'universal',
  })
  description!: string;
}
