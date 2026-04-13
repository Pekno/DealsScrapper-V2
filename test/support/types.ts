/**
 * Shared TypeScript interfaces and types for Cypress E2E tests
 */

/**
 * Test User interface
 */
export interface TestUser {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

/**
 * Test Filter Rule interface
 */
export interface TestFilterRule {
  field: string;
  operator: string;
  value: string;
  weight: number;
}

/**
 * Site Source type matching backend SiteSource enum
 */
export type TestSiteSource = 'dealabs' | 'vinted' | 'leboncoin';

/**
 * Test Filter interface
 */
export interface TestFilter {
  name: string;
  description?: string;
  categories: string[];
  rules: TestFilterRule[];
  immediateNotifications?: boolean;
  /** Sites to enable for this filter (multi-site support) */
  enabledSites?: TestSiteSource[];
}

/**
 * Fixture Article interface for database validation
 * Represents an article loaded from fixture data
 */
export interface FixtureArticle {
  title: string;
  currentPrice: number;
  merchant: string;
  temperature: number;
  externalId: string;
  category?: {
    name: string;
  };
}
