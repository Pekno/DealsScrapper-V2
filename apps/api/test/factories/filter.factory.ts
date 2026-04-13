/**
 * Business-focused test data factories for deal filters
 */
import { CreateFilterRequest } from '@dealscrapper/database';

type FilterCreateData = CreateFilterRequest;

export const createGamingFilter = (
  overrides: Partial<FilterCreateData> = {}
): FilterCreateData => ({
  name: 'Gaming Laptop Deals Under €800',
  description: 'Great gaming laptops for budget-conscious gamers',
  filterExpression: {
    rules: [
      {
        field: 'currentPrice',
        operator: '<=',
        value: 800,
        weight: 2.0,
      },
      {
        field: 'title',
        operator: 'CONTAINS',
        value: 'gaming',
        caseSensitive: false,
        weight: 1.5,
      },
    ],
    matchLogic: 'AND',
    minScore: 50,
    scoreMode: 'weighted',
  },
  immediateNotifications: true,
  digestFrequency: 'daily',
  maxNotificationsPerDay: 5,
  active: true,
  categoryIds: [], // Required field - must be provided via overrides
  ...overrides,
});

export const createTechDealsFilter = (
  overrides: Partial<FilterCreateData> = {}
): FilterCreateData => ({
  name: 'Premium Tech Deals Over €200',
  description: 'High-end tech products with significant discounts',
  filterExpression: {
    rules: [
      {
        field: 'currentPrice',
        operator: '>=',
        value: 200,
        weight: 1.0,
      },
      {
        // Site-specific field: discountPercentage is Dealabs-only
        field: 'discountPercentage',
        operator: '>=',
        value: 25,
        weight: 2.0,
        siteSpecific: 'dealabs',
      },
      {
        // Site-specific field: temperature is Dealabs-only
        field: 'temperature',
        operator: '>=',
        value: 100,
        weight: 1.5,
        siteSpecific: 'dealabs',
      },
    ],
    matchLogic: 'AND',
    minScore: 70,
    scoreMode: 'weighted',
  },
  immediateNotifications: false,
  digestFrequency: 'weekly',
  maxNotificationsPerDay: 2,
  active: true,
  categoryIds: [], // Required field - must be provided via overrides
  ...overrides,
});

export const createBargainFilter = (
  overrides: Partial<FilterCreateData> = {}
): FilterCreateData => ({
  name: 'Super Bargain Alerts - Under €50',
  description: 'Amazing deals under 50 euros for budget shoppers',
  filterExpression: {
    rules: [
      {
        field: 'currentPrice',
        operator: '<=',
        value: 50,
        weight: 3.0,
      },
      {
        // Site-specific field: temperature is Dealabs-only
        field: 'temperature',
        operator: '>=',
        value: 200,
        weight: 2.0,
        siteSpecific: 'dealabs',
      },
    ],
    matchLogic: 'AND',
    minScore: 80,
    scoreMode: 'weighted',
  },
  immediateNotifications: true,
  digestFrequency: 'immediately',
  maxNotificationsPerDay: 15,
  active: true,
  categoryIds: [], // Required field - must be provided via overrides
  ...overrides,
});
