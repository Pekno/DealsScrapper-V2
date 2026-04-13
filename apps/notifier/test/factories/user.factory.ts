/**
 * User Factories for Notification Business Scenarios
 *
 * These factories create realistic user personas for testing notification workflows.
 * Focus on notification-relevant characteristics and preferences.
 */

export const createNotificationUser = (overrides = {}) => ({
  email: `deal.hunter.${Date.now()}@example.com`,
  password: 'SecureP@ss123',
  firstName: 'Alex',
  lastName: 'Notifications',
  // ⚠️ CRITICAL: Only include fields accepted by API DTOs
  // Remove any fields that cause validation errors
  ...overrides,
});

export const createBargainSeeker = (overrides = {}) => ({
  email: `bargain.seeker.${Date.now()}@example.com`,
  password: 'BargainHunt2024!',
  firstName: 'Emma',
  lastName: 'Seeker',
  ...overrides,
});

export const createTechEnthusiast = (overrides = {}) => ({
  email: `tech.fan.${Date.now()}@example.com`,
  password: 'TechDeals2024!',
  firstName: 'Marcus',
  lastName: 'Tech',
  ...overrides,
});

export const createQuietHoursUser = (overrides = {}) => ({
  email: `quiet.user.${Date.now()}@example.com`,
  password: 'QuietTime123!',
  firstName: 'Sophia',
  lastName: 'Quiet',
  ...overrides,
});

export const createSpamProtectedUser = (overrides = {}) => ({
  email: `protected.user.${Date.now()}@example.com`,
  password: 'NoSpam2024!',
  firstName: 'James',
  lastName: 'Protected',
  ...overrides,
});
