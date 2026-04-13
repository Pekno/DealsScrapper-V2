// Shared enums used across services

export enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN',
}

export enum ScrapeJobStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export enum DealType {
  DIRECT = 'direct',
  COUPON = 'coupon',
  CASHBACK = 'cashback',
  BUNDLE = 'bundle',
}

export enum ExclusivityLevel {
  PUBLIC = 'public',
  MEMBER_ONLY = 'member-only',
  APP_EXCLUSIVE = 'app-exclusive',
}

export enum UrgencyLevel {
  FLASH = 'flash',
  LIMITED = 'limited',
  ENDING_SOON = 'ending-soon',
  NORMAL = 'normal',
}

export enum StockLevel {
  IN_STOCK = 'in-stock',
  LOW_STOCK = 'low-stock',
  PRE_ORDER = 'pre-order',
  OUT_OF_STOCK = 'out-of-stock',
}

export enum MerchantType {
  OFFICIAL = 'official',
  THIRD_PARTY = 'third-party',
  MARKETPLACE = 'marketplace',
}

export enum DigestFrequency {
  HOURLY = 'hourly',
  DAILY = 'daily',
  WEEKLY = 'weekly',
  DISABLED = 'disabled',
}

export enum NotificationType {
  EMAIL = 'email',
  IN_APP = 'in-app',
  WEBHOOK = 'webhook',
}

export enum NotificationPriority {
  HIGH = 'high',
  NORMAL = 'normal',
  LOW = 'low',
}

export enum ServiceType {
  API = 'api',
  SCRAPER = 'scraper',
  NOTIFIER = 'notifier',
  FRONTEND = 'frontend',
}

/**
 * Queue priority constants for Bull jobs
 * Higher numbers = higher priority in Bull queue processing
 */
export const QUEUE_PRIORITIES = {
  [NotificationPriority.HIGH]: 10,
  [NotificationPriority.NORMAL]: 5,
  [NotificationPriority.LOW]: 1,
} as const;
