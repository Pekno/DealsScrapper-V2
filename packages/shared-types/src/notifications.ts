/**
 * Shared notification type definitions for DealsScapper
 * Used across Notifier, Web, and API services
 */

import { SiteSource } from './site-source.js';

/**
 * Site-specific deal data extension for notifications.
 * Contains optional fields that are only relevant for certain sites.
 */
export interface NotificationSiteSpecificData {
  /** Brand name (Vinted, LeBonCoin) */
  brand?: string;
  /** City location (LeBonCoin) */
  city?: string;
  /** Seller name (Vinted) */
  sellerName?: string;
  /** Item condition (Vinted) */
  condition?: string;
  /** Number of favorites (Vinted) */
  favoriteCount?: number;
}

/**
 * Deal data included in notification payloads.
 */
export interface NotificationDealData {
  /** Deal title */
  title: string;
  /** Current price */
  price?: number;
  /** Original price before discount */
  originalPrice?: number;
  /** Discount percentage */
  discountPercentage?: number;
  /** Merchant/seller name */
  merchant?: string;
  /** Image URL */
  imageUrl?: string;
  /** Deal URL */
  url?: string;
  /** Community temperature/heat score (Dealabs) */
  temperature?: number;
  /** Filter match score */
  score?: number;
  /** Site-specific extension fields */
  siteSpecific?: NotificationSiteSpecificData;
}

/**
 * Unified notification payload for WebSocket and email notifications
 *
 * @remarks
 * This is the standard format for all notifications sent through the system,
 * whether via WebSocket real-time updates or email delivery.
 *
 * @property {string} id - Unique notification identifier
 * @property {SiteSource} siteId - Source site identifier (REQUIRED)
 * @property {string} type - Notification type (DEAL_MATCH, SYSTEM, ALERT)
 * @property {string} title - Notification title
 * @property {string} message - Notification message content
 * @property {string} [filterId] - Associated filter ID (for DEAL_MATCH type)
 * @property {object} data - Structured notification data
 * @property {NotificationDealData} [data.dealData] - Deal information (for DEAL_MATCH type)
 * @property {string} timestamp - ISO 8601 timestamp
 * @property {boolean} read - Read status (updated by frontend/API)
 */
export interface UnifiedNotificationPayload {
  /** Unique notification identifier */
  id: string;
  /** Source site identifier - indicates which site the deal/notification originated from */
  siteId: SiteSource;
  /** Notification type */
  type: 'DEAL_MATCH' | 'SYSTEM' | 'ALERT';
  /** Notification title */
  title: string;
  /** Notification message content */
  message: string;
  /** Foreign key to Match (for DEAL_MATCH notifications only) */
  matchId?: string;
  /** Associated filter ID (for DEAL_MATCH type) */
  filterId?: string;
  /** Structured notification data */
  data: {
    /** Deal information (for DEAL_MATCH type) */
    dealData?: NotificationDealData;
    /** Allow additional custom data */
    [key: string]: unknown;
  };
  /** ISO 8601 timestamp */
  timestamp: string;
  /** Read status (updated by frontend/API) */
  read: boolean;
}
