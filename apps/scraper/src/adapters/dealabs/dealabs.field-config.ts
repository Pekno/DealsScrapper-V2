import type { FieldMappingConfig } from '../../field-extraction/field-mapping-config.interface.js';
import { DealabsTransformers } from './dealabs.transformers.js';

/**
 * Dealabs field extraction configuration.
 * Zero extraction code - just declarative config!
 *
 * This configuration replaces 500+ lines of imperative extraction code
 * with ~50 lines of declarative rules.
 */
export const dealabsFieldConfig: FieldMappingConfig = {
  // ========================================
  // UNIVERSAL FIELDS (exist on all sites)
  // ========================================

  externalId: {
    // Use a child element selector that will always exist, then extract from root article
    // The transform extracts from the root $element (the article) which has the id
    selectors: ['.thread-content', '.thread-title', 'div', '*'], // Find any child
    strategy: 'text', // Doesn't matter - we ignore this in transform
    required: true,
    transform: [
      // Extract thread ID from the root article element (both data-thread-id and id attrs)
      (_value: unknown, context): string => {
        const $article = context.$element;
        // Try data-thread-id first (production), then id (test fixtures)
        return $article.attr('data-thread-id') || $article.attr('id') || '';
      },
      DealabsTransformers.extractThreadId,
    ],
  },

  title: {
    selectors: [
      'a.thread-link--title',
      '.thread-title a', // Also get link text within thread-title for fixtures
      '.thread-title',
      '[data-t="threadTitle"]',
      'a.cept-tt',
      'a.thread-link', // Fixture selector
    ],
    strategy: 'text',
    required: true,
    transform: ['sanitize', 'trim'],
    validator: { minLength: 3, maxLength: 500 },
  },

  description: {
    selectors: [
      'div.userHtml-content > div',
      '.thread-description',
      '.cept-description-container',
    ],
    strategy: 'text',
    required: false,
    transform: ['sanitize', 'trim'],
    validator: { maxLength: 5000 },
  },

  url: {
    selectors: [
      'a.thread-link--title[href]',
      '[data-t="threadTitle"][href]',
      'a.cept-tt[href]',
      'a.thread-link[href]', // Fixture selector
    ],
    strategy: 'attribute',
    attribute: 'href',
    required: true,
    transform: ['sanitize', 'trim', DealabsTransformers.normalizeUrl],
  },

  imageUrl: {
    selectors: [
      'img.thread-image[src]',
      '.thread-img[src]',
      'img.threadGrid-image[src]',
    ],
    strategy: 'attribute',
    attribute: 'src',
    required: false,
    transform: ['trim', DealabsTransformers.normalizeUrl],
  },

  currentPrice: {
    selectors: [
      'span.thread-price',
      'span.vAlign--all-tt',
      '[data-t="threadPrice"]',
      '.cept-deal-price',
    ],
    strategy: 'text',
    required: false,
    parser: 'price',
    validator: { min: 0, max: 1000000 },
  },

  originalPrice: {
    selectors: ['span.text--lineThrough', '.thread-original-price'],
    strategy: 'text',
    required: false,
    parser: 'price',
    validator: { min: 0, max: 1000000 },
  },

  merchant: {
    selectors: [
      'a[data-t="merchantLink"]',
      'span.thread-merchant',
      '[data-t="threadMerchant"]',
      'a.cept-merchant-name',
      '.merchant-title',
      'span.cept-merchant', // Fixture selector
      '.cept-merchant', // Fixture selector alternative
    ],
    strategy: 'text',
    required: false,
    transform: ['trim'],
  },

  publishedAt: {
    selectors: [
      '.threadListCard-header > span.chip span',
      'span.chip span',
      'time[datetime]',
      '.thread-timestamp',
      'span.chip--time', // Fixture selector
      'span.chip.chip--time', // Fixture selector (multi-class)
    ],
    strategy: 'text',
    required: false,
    transform: ['trim', DealabsTransformers.parseRelativeDate],
  },

  // ========================================
  // DEALABS-SPECIFIC FIELDS
  // ========================================

  temperature: {
    selectors: [
      'button.cept-vote-temp',
      '[data-t="voteButton"]',
      'span.vote-temp',
    ],
    strategy: 'text',
    required: false,
    parser: 'integer',
    validator: { min: -100, max: 10000 },
    default: 0,
  },

  commentCount: {
    selectors: [
      'a[data-t="commentsLink"]',
      '.thread-comments',
      'span.cept-comment-count',
    ],
    strategy: 'text',
    required: false,
    parser: 'integer',
    validator: { min: 0, max: 100000 },
    default: 0,
  },

  communityVerified: {
    selectors: [
      'span.color--text-TranslucentSecondary svg.icon--verified',
      'svg.icon--verified',
      '[data-verified="true"]',
    ],
    strategy: 'text',
    required: false,
    transform: [(value) => !!value], // Convert presence to boolean
    default: false,
  },

  freeShipping: {
    selectors: [
      'span:contains("Livraison gratuite")',
      'span:contains("Gratuit")',
      '[data-t="freeShipping"]',
      'span.icon--shipping',
      'svg.icon--truck',
    ],
    strategy: 'text',
    required: false,
    transform: [(value) => !!value],
    default: false,
  },

  isCoupon: {
    selectors: ['div.voucher', '[data-t="voucherBadge"]', '.cept-voucher'],
    strategy: 'text',
    required: false,
    transform: [(value) => !!value],
    default: false,
  },

  discountPercentage: {
    selectors: [
      'div.textBadge--green',
      '.discount-badge',
      'span.cept-discount-percentage',
    ],
    strategy: 'regex',
    regex: /-?(\d+)%/,
    regexGroup: 1,
    required: false,
    parser: 'integer',
    validator: { min: 0, max: 100 },
  },

  expiresAt: {
    selectors: [
      'span:contains("Expire")',
      '[data-expires]',
      '.thread-expiration',
    ],
    strategy: 'text',
    required: false,
    transform: ['trim', DealabsTransformers.parseExpirationDate],
  },
};
