import { SiteSource, type UrlParamConfig } from '@dealscrapper/shared-types';

/**
 * URL mapping for a universal field on a specific site.
 * Universal fields (title, currentPrice, etc.) need different URL param
 * mappings per site, so they can't use the @SiteFilterableField urlParam directly.
 */
export interface UniversalFieldUrlMapping {
  /** Canonical field key from SiteFieldDefinition (e.g. 'currentPrice', 'title') */
  fieldKey: string;
  /** URL param configuration for this field on this site */
  urlParam: UrlParamConfig;
}

/**
 * Per-site URL optimization configuration.
 * Defines how universal fields map to URL params and which params are always appended.
 */
export interface SiteUrlConfig {
  /** URL param mappings for universal fields on this site */
  universalFieldMappings: UniversalFieldUrlMapping[];
  /** Query params always appended to the URL (e.g. sort order) */
  universalParams: Record<string, string>;
}

/**
 * Per-site URL optimization configurations.
 *
 * Site-specific fields (temperature, proSeller, etc.) declare their urlParam
 * directly on @SiteFilterableField in shared-types.
 *
 * Universal fields (currentPrice, title, etc.) declare per-site mappings here
 * because one field definition can't hold different configs for each site.
 *
 * To add URL optimization for a new field:
 * - Site-specific field → add urlParam to its @SiteFilterableField decorator
 * - Universal field → add an entry to universalFieldMappings below
 */
export const SITE_URL_CONFIGS: Record<SiteSource, SiteUrlConfig> = {
  [SiteSource.DEALABS]: {
    universalFieldMappings: [
      {
        fieldKey: 'currentPrice',
        urlParam: { type: 'range', min: 'priceFrom', max: 'priceTo' },
      },
    ],
    universalParams: {
      hide_expired: 'true',
      hide_local: 'true',
      sortBy: 'new',
    },
  },

  [SiteSource.LEBONCOIN]: {
    universalFieldMappings: [
      {
        fieldKey: 'title',
        urlParam: { type: 'text', param: 'text' },
      },
      {
        fieldKey: 'currentPrice',
        urlParam: {
          type: 'custom_range',
          param: 'price',
          minLiteral: 'min',
          maxLiteral: 'max',
        },
      },
    ],
    universalParams: {
      sort: 'time',
      order: 'desc',
    },
  },

  [SiteSource.VINTED]: {
    universalFieldMappings: [
      {
        fieldKey: 'currentPrice',
        urlParam: { type: 'range', min: 'price_from', max: 'price_to' },
      },
    ],
    universalParams: {
      currency: 'EUR',
      order: 'newest_first',
    },
  },
};
