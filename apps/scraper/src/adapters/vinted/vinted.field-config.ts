import type { FieldMappingConfig } from '../../field-extraction/field-mapping-config.interface.js';
import { VintedTransformers } from './vinted.transformers.js';

/**
 * Vinted field extraction configuration.
 * Based on real HTML analysis from vinted.fr fixtures (verified 2025-01).
 *
 * Vinted-specific notes:
 * - Uses data-testid attributes with pattern: item-{ID}--{field}
 * - Items displayed as cards in .feed-grid__item or [data-testid="grid-item"] containers
 * - No "original price" concept (secondhand marketplace)
 * - Brand, size, condition packed in subtitle field (needs parsing)
 * - Prices use French format: "30,00 €"
 * - Favorite count format: "4Enlevé !"
 */
export const vintedFieldConfig: FieldMappingConfig = {
  // ========================================
  // UNIVERSAL FIELDS
  // ========================================

  externalId: {
    selectors: [
      '[data-testid^="item-"]',
      'a.new-item-box__overlay[href*="/items/"]',
    ],
    strategy: 'attribute',
    attribute: 'data-testid',
    required: true,
    transform: [VintedTransformers.extractItemId],
  },

  title: {
    selectors: [
      '[data-testid$="--image--img"]',
    ],
    strategy: 'attribute',
    attribute: 'alt',
    required: true,
    transform: [VintedTransformers.extractTitleFromAlt, 'sanitize', 'trim'],
    validator: { minLength: 3, maxLength: 500 },
  },

  description: {
    selectors: [
      '[data-testid$="--description--content"]',
      '[data-testid$="--description"]',
    ],
    strategy: 'text',
    required: false,
    transform: ['sanitize', 'trim'],
    validator: { maxLength: 5000 },
  },

  url: {
    selectors: [
      'a.new-item-box__overlay[href*="/items/"]',
      '[data-testid$="--overlay-link"][href]',
    ],
    strategy: 'attribute',
    attribute: 'href',
    required: true,
    transform: ['sanitize', 'trim', VintedTransformers.normalizeUrl],
  },

  imageUrl: {
    selectors: [
      '[data-testid$="--image--img"]',
      '.new-item-box__image-container img[src]',
    ],
    strategy: 'attribute',
    attribute: 'src',
    required: false,
    transform: ['trim'],
  },

  currentPrice: {
    selectors: [
      '[data-testid$="--price-text"]',
      '.new-item-box__summary [data-testid*="price"]',
    ],
    strategy: 'text',
    required: false,
    transform: [VintedTransformers.parsePrice],
    validator: { min: 0, max: 100000 },
  },

  location: {
    selectors: ['.item-location', '.seller-location', 'span.location'],
    strategy: 'text',
    required: false,
    transform: ['trim'],
    default: null, // Not visible in catalog listings
  },

  publishedAt: {
    selectors: ['time[datetime]', '[data-testid*="date"]'],
    strategy: 'attribute',
    attribute: 'datetime',
    required: false,
    parser: 'date',
    default: null, // Not always available in catalog view
  },

  // ========================================
  // VINTED-SPECIFIC FIELDS
  // ========================================

  favoriteCount: {
    selectors: [
      '[data-testid$="--favourite"]',
      '.new-item-box__image-container [data-testid*="favourite"]',
    ],
    strategy: 'text',
    required: false,
    transform: [VintedTransformers.parseFavoriteCount],
    validator: { min: 0, max: 1000000 },
    default: 0,
  },

  viewCount: {
    selectors: ['[data-testid$="--view-count"]', '.item-views'],
    strategy: 'text',
    required: false,
    parser: 'integer',
    validator: { min: 0, max: 10000000 },
    default: 0, // Not visible in catalog view
  },

  /**
   * NOTE: Brand, size, and condition are packed in subtitle field.
   * Format: "{BRAND}{SIZE} · {CONDITION}"
   * Example: "Wendy TrendyL / 40 / 12 · Très bon état"
   * We extract the subtitle first, then parse it in the adapter.
   */
  subtitle: {
    selectors: [
      '[data-testid$="--description-subtitle"]',
      '.new-item-box__summary [data-testid*="subtitle"]',
    ],
    strategy: 'text',
    required: false,
    transform: ['trim'],
  },

  itemCondition: {
    selectors: [
      '[data-testid$="--description-subtitle"]',
      '.new-item-box__summary [data-testid*="subtitle"]',
    ],
    strategy: 'text',
    required: false,
    transform: [
      'trim',
      VintedTransformers.extractCondition,
      VintedTransformers.normalizeCondition,
    ],
    default: 'unknown',
  },

  brand: {
    selectors: [
      '[data-testid$="--description-subtitle"]',
      '.new-item-box__summary [data-testid*="subtitle"]',
    ],
    strategy: 'text',
    required: false,
    transform: ['trim', VintedTransformers.extractBrand],
  },

  size: {
    selectors: [
      '[data-testid$="--description-subtitle"]',
      '.new-item-box__summary [data-testid*="subtitle"]',
    ],
    strategy: 'text',
    required: false,
    transform: ['trim', VintedTransformers.extractSize],
  },

  color: {
    selectors: ['[data-testid$="--color"]', '.item-color'],
    strategy: 'text',
    required: false,
    transform: ['trim'],
    default: null, // Not visible in catalog view
  },

  sellerRating: {
    selectors: ['[data-testid$="--seller-rating"]', '.seller-rating'],
    strategy: 'text',
    required: false,
    parser: 'float',
    validator: { min: 0, max: 5 },
    default: null, // Not visible in catalog view
  },

  sellerName: {
    selectors: ['[data-testid$="--seller-name"]', '.seller-name'],
    strategy: 'text',
    required: false,
    transform: ['trim'],
    default: null, // Not visible in catalog view
  },
};
