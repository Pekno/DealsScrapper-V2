/**
 * Notification Preferences Factories
 *
 * Creates realistic user notification preference scenarios for testing
 * business workflows around notification management and customization.
 */

export const createDefaultPreferences = (overrides = {}) => ({
  emailNotifications: true,
  websocketNotifications: true,
  dailyDigest: true,
  quietHoursEnabled: false,
  maxNotificationsPerDay: 10,
  priorityOnly: false,
  notificationFrequency: 'immediate',
  categories: ['gaming', 'tech', 'home'],
  ...overrides,
});

export const createQuietHoursPreferences = (overrides = {}) => ({
  emailNotifications: true,
  websocketNotifications: true,
  dailyDigest: true,
  quietHoursEnabled: true,
  quietHoursStart: '22:00',
  quietHoursEnd: '08:00',
  timezone: 'Europe/Paris',
  allowUrgentDuringQuietHours: true,
  maxNotificationsPerDay: 5,
  ...overrides,
});

export const createEmailOnlyPreferences = (overrides = {}) => ({
  emailNotifications: true,
  websocketNotifications: false,
  dailyDigest: true,
  dailyDigestTime: '09:00',
  notificationFrequency: 'digest',
  categories: ['fashion', 'home', 'beauty'],
  maxNotificationsPerDay: 3,
  ...overrides,
});

export const createHighVolumePreferences = (overrides = {}) => ({
  emailNotifications: true,
  websocketNotifications: true,
  dailyDigest: false,
  notificationFrequency: 'immediate',
  maxNotificationsPerDay: 50,
  priorityOnly: false,
  categories: ['gaming', 'tech', 'sports', 'home', 'fashion', 'automotive'],
  minDiscountPercentage: 10,
  ...overrides,
});

export const createRestrictivePreferences = (overrides = {}) => ({
  emailNotifications: true,
  websocketNotifications: false,
  dailyDigest: false,
  priorityOnly: true,
  maxNotificationsPerDay: 2,
  notificationFrequency: 'urgent-only',
  categories: ['tech'],
  minDiscountPercentage: 50,
  keywordBlacklist: ['refurbished', 'used', 'open-box'],
  ...overrides,
});

export const createBusinessHoursPreferences = (overrides = {}) => ({
  emailNotifications: true,
  websocketNotifications: true,
  quietHoursEnabled: true,
  quietHoursStart: '18:00',
  quietHoursEnd: '09:00',
  timezone: 'Europe/London',
  allowUrgentDuringQuietHours: false,
  weekendNotifications: false,
  maxNotificationsPerDay: 8,
  ...overrides,
});

export const createSpamProtectionPreferences = (overrides = {}) => ({
  emailNotifications: true,
  websocketNotifications: true,
  maxNotificationsPerDay: 3,
  priorityOnly: false,
  notificationFrequency: 'digest',
  enableRateLimiting: true,
  rateLimitWindowMinutes: 60,
  maxNotificationsPerWindow: 2,
  duplicateDetection: true,
  ...overrides,
});
