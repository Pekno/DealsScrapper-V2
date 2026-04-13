/**
 * Business-focused category factories for scheduler e2e tests
 * Creates realistic product categories with real engagement metrics
 */

import { Category } from '@dealscrapper/database';

/**
 * Creates a high-engagement gaming category
 * Represents popular categories like gaming laptops with many users and high activity
 */
export const createGamingCategory = (
  overrides: Partial<Category> = {}
): Omit<Category, 'id' | 'createdAt' | 'updatedAt'> => ({
  name: 'Gaming Laptops',
  slug: 'gaming-laptops',
  siteId: 'dealabs',
  parentId: null, // Explicit null for required field
  level: 0,
  sourceUrl: 'https://www.dealabs.com/groupe/pc-portables-gaming',
  description: null, // Explicit null for nullable field
  dealCount: 45,
  avgTemperature: 85.5, // Hot category
  popularBrands: ['HP', 'Lenovo', 'Asus'], // Array field
  isActive: true,
  userCount: 150, // High user engagement
  ...overrides,
});

/**
 * Creates a niche home category
 * Represents specialized categories with moderate engagement
 */
export const createHomeCategory = (
  overrides: Partial<Category> = {}
): Omit<Category, 'id' | 'createdAt' | 'updatedAt'> => ({
  name: 'Smart Home Devices',
  slug: 'smart-home',
  siteId: 'dealabs',
  parentId: null,
  level: 0,
  sourceUrl: 'https://www.dealabs.com/groupe/domotique',
  description: null,
  dealCount: 12,
  avgTemperature: 65.2, // Warm category
  popularBrands: ['Philips', 'Amazon', 'Google'],
  isActive: true,
  userCount: 35, // Moderate user engagement
  ...overrides,
});

/**
 * Creates a low-engagement category
 * Represents categories with minimal user activity
 */
export const createLowEngagementCategory = (
  overrides: Partial<Category> = {}
): Omit<Category, 'id' | 'createdAt' | 'updatedAt'> => ({
  name: 'Office Supplies',
  slug: 'office-supplies',
  siteId: 'dealabs',
  parentId: null,
  level: 0,
  sourceUrl: 'https://www.dealabs.com/groupe/bureautique',
  description: null,
  dealCount: 3,
  avgTemperature: 45.0, // Cool category
  popularBrands: ['Bic', 'Staples', 'Canon'],
  isActive: true,
  userCount: 5, // Low user engagement
  ...overrides,
});

/**
 * Creates an inactive category for testing cleanup workflows
 */
export const createInactiveCategory = (
  overrides: Partial<Category> = {}
): Omit<Category, 'id' | 'createdAt' | 'updatedAt'> => ({
  name: 'Discontinued Electronics',
  slug: 'discontinued-electronics',
  siteId: 'dealabs',
  parentId: null,
  level: 0,
  sourceUrl: 'https://www.dealabs.com/groupe/electronics-legacy',
  description: null,
  dealCount: 0,
  avgTemperature: 0.0,
  popularBrands: [],
  isActive: false, // Inactive category
  userCount: 0,
  ...overrides,
});
