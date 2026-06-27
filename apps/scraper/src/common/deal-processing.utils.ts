import type { RawDeal } from '@dealscrapper/shared-types';
import { ArticleWrapper } from '@dealscrapper/shared-types/article';
import type { Article } from '@dealscrapper/database';
import type { ArticleDealabs, ArticleVinted, ArticleLeBonCoin } from '@prisma/client';

/**
 * A detected price drop between two observations of the same article.
 * `amount` and `percentage` are always positive (a drop, not a rise).
 */
export interface PriceDrop {
  readonly previousPrice: number;
  readonly currentPrice: number;
  readonly amount: number; // previousPrice - currentPrice
  readonly percentage: number; // (amount / previousPrice) * 100, 2 decimals
}

/**
 * Utility functions for deal processing shared across multiple services
 * Contains common operations for deal conversion, validation, and utility functions
 */
export class DealProcessingUtils {
  /**
   * Simple delay utility for rate limiting between requests
   * Provides a promise-based delay mechanism for respectful scraping
   * @param ms - Milliseconds to delay
   * @returns Promise that resolves after the specified delay
   */
  static delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Detects a price drop between the last known price and a freshly-scraped one.
   * Returns null when there is no usable drop: missing prices, a rise/no-change,
   * or a non-positive previous price (no meaningful percentage). Foundation for
   * price-drop alerts (Phase 6) and reused by whatever surfaces the drop.
   * @param previous - Last recorded price (e.g. existing Article.currentPrice)
   * @param current - Newly scraped price
   * @returns The drop with amount + rounded percentage, or null if not a drop
   */
  static computePriceDrop(
    previous: number | null | undefined,
    current: number | null | undefined,
  ): PriceDrop | null {
    if (previous == null || current == null) return null;
    if (previous <= 0) return null; // can't derive a percentage from <= 0
    if (current >= previous) return null; // not a drop
    const amount = previous - current;
    const percentage = Math.round((amount / previous) * 10000) / 100;
    return { previousPrice: previous, currentPrice: current, amount, percentage };
  }

  /**
   * Edge-triggered price-threshold crossing — PriceGhost's `target_price` done
   * right, and the anti-spam half of the Phase 6 alert throttle. Returns true
   * ONLY on the transition from at-or-above `threshold` to strictly below it, so
   * a price that stays below (or oscillates while below) does not re-fire. The
   * cooldown is the time-based complement; this is the value-based edge.
   *
   * Conservative on missing input: a first observation (no `previous`) never
   * fires, so an already-cheap newly-discovered item can't spam an alert.
   * @param previous - Last recorded price (null on first sighting)
   * @param current - Newly scraped price
   * @param threshold - Target price the user wants to be alerted below
   * @returns true only when the price just crossed below the threshold
   */
  static crossedBelowThreshold(
    previous: number | null | undefined,
    current: number | null | undefined,
    threshold: number | null | undefined,
  ): boolean {
    if (previous == null || current == null || threshold == null) return false;
    return previous >= threshold && current < threshold;
  }

  /**
   * Time-based anti-spam gate for price-drop alerts — the cooldown complement to
   * the value-based `crossedBelowThreshold` edge. Returns true when a fresh alert
   * MAY fire: either it has never alerted (no `lastNotifiedAt`) or the cooldown
   * window has fully elapsed. A non-positive `cooldownMs` disables throttling
   * (always-elapsed escape hatch). `now` is injected, not read from Date.now(),
   * so the gate stays pure and deterministic for testing.
   * @param lastNotifiedAt - When the last alert fired (null/undefined if never)
   * @param now - Current instant (injected for determinism)
   * @param cooldownMs - Minimum gap between alerts; <= 0 means no throttling
   * @returns true if a new alert may fire now, false while inside the window
   */
  static cooldownElapsed(
    lastNotifiedAt: Date | null | undefined,
    now: Date,
    cooldownMs: number,
  ): boolean {
    if (cooldownMs <= 0) return true; // throttling disabled
    if (lastNotifiedAt == null) return true; // never alerted before
    return now.getTime() - lastNotifiedAt.getTime() >= cooldownMs;
  }

  /**
   * Validates if a raw deal has all required fields
   * @param deal - Raw deal to validate
   * @returns True if deal is valid, false otherwise
   */
  static isValidDeal(deal: RawDeal): boolean {
    return Boolean(
      deal.externalId &&
      deal.title &&
      deal.url &&
      deal.category &&
      deal.source
    );
  }

  /**
   * Normalizes URL to ensure it's absolute
   * @param url - URL to normalize
   * @param baseUrl - Base URL to use if URL is relative
   * @returns Normalized absolute URL
   */
  static normalizeUrl(
    url: string,
    baseUrl = 'https://www.dealabs.com'
  ): string {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    if (url.startsWith('/')) {
      return `${baseUrl}${url}`;
    }
    return url;
  }

  /**
   * Extracts category slug from URL using regex pattern matching
   * Parses Dealabs group URLs to extract the category identifier
   * @param categoryUrl - Full category URL to parse
   * @returns Extracted category slug or 'unknown' if parsing fails
   */
  static extractCategorySlug(categoryUrl: string): string {
    const match = categoryUrl.match(/\/groupe\/([^/?]+)/);
    return match?.[1] ?? 'unknown';
  }

  /**
   * Format category name from slug for human-readable display
   * Converts kebab-case slugs to title-case names
   * @param slug - Category slug to format
   * @returns Formatted category name
   */
  static formatCategoryName(slug: string): string {
    return slug
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Convert Article entity back to RawDeal format
   * Used for legacy compatibility when persisted articles need filter evaluation
   * @param article - Persisted article to convert
   * @returns RawDeal representation of the article (base fields only)
   * @deprecated Use convertArticleWrapperToRawDeal() instead for full article data including extensions.
   * This method only returns base Article fields - site-specific fields require extension loading.
   */
  static convertArticleToRawDeal(article: Article): RawDeal {
    // NOTE: Site-specific fields (originalPrice, temperature, merchant, etc.)
    // are now stored in extension tables (ArticleDealabs, ArticleVinted, ArticleLeBonCoin)
    // and must be loaded via ArticleWrapper.load() for full data.
    return {
      externalId: article.externalId,
      title: article.title,
      description: article.description ?? undefined,
      category: article.categoryId, // Use categoryId as category for legacy compatibility
      categoryPath: article.categoryPath ?? [],
      currentPrice: article.currentPrice ?? undefined,
      // Site-specific fields - not available on base Article, set to undefined
      originalPrice: undefined,
      discountPercentage: undefined,
      discountAmount: undefined,
      merchant: undefined,
      storeLocation: undefined,
      freeShipping: false, // Default - actual value in extension
      temperature: undefined, // Dealabs-specific - in extension
      commentCount: undefined, // Dealabs-specific - in extension
      communityVerified: false, // Default - actual value in extension
      publishedAt: article.publishedAt ?? undefined,
      expiresAt: undefined, // Dealabs-specific - in extension
      url: article.url,
      imageUrl: article.imageUrl ?? undefined,
      isExpired: article.isExpired,
      isCoupon: false, // Default - actual value in extension
      source: article.siteId,
      isActive: article.isActive,
    };
  }

  /**
   * Convert ArticleWrapper to RawDeal format with full site-specific extension data.
   * This is the recommended method for filter evaluation as it includes all fields.
   * @param wrapper - ArticleWrapper with base article and site-specific extension
   * @returns RawDeal representation with all site-specific fields populated
   */
  static convertArticleWrapperToRawDeal(wrapper: ArticleWrapper): RawDeal {
    const { base, extension } = wrapper;

    // Start with base article fields
    const rawDeal: RawDeal = {
      externalId: base.externalId,
      title: base.title,
      description: base.description ?? undefined,
      category: base.categoryId,
      categoryPath: base.categoryPath ?? [],
      currentPrice: base.currentPrice ?? undefined,
      publishedAt: base.publishedAt ?? undefined,
      url: base.url,
      imageUrl: base.imageUrl ?? undefined,
      isExpired: base.isExpired,
      source: base.siteId,
      isActive: base.isActive,
      // Defaults for site-specific fields (will be overwritten below)
      originalPrice: undefined,
      discountPercentage: undefined,
      discountAmount: undefined,
      merchant: undefined,
      storeLocation: undefined,
      freeShipping: false,
      temperature: undefined,
      commentCount: undefined,
      communityVerified: false,
      expiresAt: undefined,
      isCoupon: false,
    };

    // Add site-specific extension data
    if (wrapper.isDealabs()) {
      const dealabsExt = extension as ArticleDealabs;
      rawDeal.temperature = dealabsExt.temperature ?? undefined;
      rawDeal.commentCount = dealabsExt.commentCount ?? undefined;
      rawDeal.communityVerified = dealabsExt.communityVerified ?? false;
      rawDeal.freeShipping = dealabsExt.freeShipping ?? false;
      rawDeal.isCoupon = dealabsExt.isCoupon ?? false;
      rawDeal.discountPercentage = dealabsExt.discountPercentage ?? undefined;
      rawDeal.originalPrice = dealabsExt.originalPrice ?? undefined;
      rawDeal.merchant = dealabsExt.merchant ?? undefined;
      rawDeal.expiresAt = dealabsExt.expiresAt ?? undefined;
    } else if (wrapper.isVinted()) {
      const vintedExt = extension as ArticleVinted;
      // Vinted-specific fields mapped to RawDeal where applicable
      rawDeal.merchant = vintedExt.sellerName ?? undefined;
      // Note: Vinted has favoriteCount, viewCount, condition, brand, size, color, sellerRating
      // These don't map directly to RawDeal but could be used in filter rules
    } else if (wrapper.isLeBonCoin()) {
      const leboncoinExt = extension as ArticleLeBonCoin;
      // LeBonCoin-specific fields mapped to RawDeal where applicable
      rawDeal.merchant = leboncoinExt.sellerName ?? undefined;
      rawDeal.storeLocation = leboncoinExt.city ?? undefined;
      // Note: LeBonCoin has city, postcode, department, region, proSeller, urgentFlag
    }

    return rawDeal;
  }
}
