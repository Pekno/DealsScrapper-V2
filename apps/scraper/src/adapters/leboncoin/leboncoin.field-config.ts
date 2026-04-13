import type { FieldMappingConfig } from '../../field-extraction/field-mapping-config.interface.js';
import * as LeBonCoinTransformers from './leboncoin.transformers.js';

/**
 * LeBonCoin field extraction configuration with verified selectors.
 *
 * LeBonCoin Structure Notes:
 * - Uses <article> elements for each ad listing
 * - No data-qa-id for content fields (only for interactive elements)
 * - Relies on semantic HTML + content filtering
 * - Location format: "City Postcode" (e.g., "Lannoy 59390")
 * - Price format: "800 €" or "Gratuit"
 * - Many site-specific fields NOT visible on listing pages (pro seller, urgent, etc.)
 *
 * Extraction Strategy:
 * - Title: From aria-label or h3
 * - Price: Filter <p> elements containing "€" (handled in adapter)
 * - Location: Filter <p> elements matching "City Postcode" pattern (handled in adapter)
 * - ID: Extract from URL
 * - URL: From <a href="/ad/...">
 *
 * Note: Price and location require custom filtering logic in the adapter
 * since the generic field extractor can't filter by content patterns.
 *
 * @see docs/LEBONCOIN_SELECTORS.md for detailed documentation
 */
export const leboncoinFieldConfig: FieldMappingConfig = {
  // ========================================
  // UNIVERSAL FIELDS
  // ========================================

  externalId: {
    selectors: ['a[href*="/ad/"]'],
    strategy: 'attribute',
    attribute: 'href',
    required: true,
    transform: [LeBonCoinTransformers.extractIdFromUrl],
    validator: { pattern: /^\d+$/ },
  },

  title: {
    selectors: [
      // Primary: aria-label on article (won't work from $element.find(), handled in adapter)
      'h3', // Fallback: h3 text (works from $element.find())
    ],
    strategy: 'text',
    required: true,
    transform: ['sanitize', 'trim'],
    validator: { minLength: 3, maxLength: 500 },
  },

  description: {
    // Not available on listing pages
    selectors: [],
    strategy: 'text',
    required: false,
    default: null,
  },

  url: {
    selectors: ['a[href*="/ad/"]'],
    strategy: 'attribute',
    attribute: 'href',
    required: true,
    transform: [LeBonCoinTransformers.normalizeUrl],
    parser: 'url',
  },

  imageUrl: {
    selectors: ['img'],
    strategy: 'attribute',
    attribute: 'src',
    required: false,
    transform: ['trim'],
    parser: 'url',
  },

  currentPrice: {
    // Handled specially in adapter (needs to filter <p> by pattern)
    selectors: [],
    strategy: 'text',
    required: false,
    default: null,
  },

  location: {
    // Handled specially in adapter (needs to filter <p> by pattern)
    selectors: [],
    strategy: 'text',
    required: false,
    default: null,
  },

  publishedAt: {
    // Not available on listing pages
    selectors: [],
    strategy: 'text',
    required: false,
    default: null,
  },

  // ========================================
  // LEBONCOIN-SPECIFIC FIELDS
  // ========================================
  // Note: Most of these are handled in the adapter's extractSingleListing()
  // method since they derive from location or aren't in the HTML

  city: {
    selectors: [],
    strategy: 'text',
    required: false,
    default: null,
  },

  postcode: {
    selectors: [],
    strategy: 'text',
    required: false,
    default: null,
  },

  department: {
    selectors: [],
    strategy: 'text',
    required: false,
    default: null,
  },

  region: {
    selectors: [],
    strategy: 'text',
    required: false,
    default: null,
  },

  // Fields not visible on listing pages - set defaults

  proSeller: {
    selectors: [],
    strategy: 'text',
    required: false,
    default: false,
  },

  sellerName: {
    selectors: [],
    strategy: 'text',
    required: false,
    default: null,
  },

  urgentFlag: {
    selectors: [],
    strategy: 'text',
    required: false,
    default: false,
  },

  topAnnonce: {
    selectors: [],
    strategy: 'text',
    required: false,
    default: false,
  },

  deliveryOptions: {
    selectors: [],
    strategy: 'text',
    required: false,
    default: [],
  },

  shippingCost: {
    selectors: [],
    strategy: 'text',
    required: false,
    default: null,
  },

  condition: {
    selectors: [],
    strategy: 'text',
    required: false,
    default: null,
  },

  attributes: {
    selectors: [],
    strategy: 'text',
    required: false,
    default: null,
  },
};
