/**
 * Business-focused test data factories for scraping jobs
 */

export const createGamingCategoryJob = (overrides: Partial<any> = {}) => ({
  categoryId: 'cat-gaming-hw',
  categoryUrl: 'https://www.dealabs.com/groupe/gaming-hardware',
  categorySlug: 'gaming-hardware',
  maxPages: 2,
  delayBetweenRequests: 1000,
  useProxy: false,
  forceFullScrape: false,
  ...overrides,
});

export const createTechDealsJob = (overrides: Partial<any> = {}) => ({
  categoryId: 'cat-tech-gadgets',
  categorySlug: 'tech-gadgets',
  priority: 'normal',
  source: 'user_request',
  ...overrides,
});

export const createLaptopScrapingJob = (overrides: Partial<any> = {}) => ({
  categoryId: 'cat-laptops',
  categoryUrl: 'https://www.dealabs.com/groupe/laptops',
  categorySlug: 'laptops',
  maxPages: 3,
  delayBetweenRequests: 800,
  useProxy: false,
  forceFullScrape: false,
  ...overrides,
});

export const createSmartphoneJob = (overrides: Partial<any> = {}) => ({
  categoryId: 'cat-smartphones',
  categoryUrl: 'https://www.dealabs.com/groupe/smartphones',
  categorySlug: 'smartphones',
  maxPages: 1,
  delayBetweenRequests: 500,
  useProxy: false,
  forceFullScrape: false,
  ...overrides,
});

export const createHighValueJob = (overrides: Partial<any> = {}) => ({
  categoryId: 'cat-high-value',
  categorySlug: 'high-value-deals',
  priority: 'high',
  source: 'automatic',
  urgency: 'immediate',
  ...overrides,
});

export const createBulkScrapingJob = (overrides: Partial<any> = {}) => ({
  categoryId: 'cat-bulk',
  categoryUrl: 'https://www.dealabs.com/groupe/bulk-category',
  categorySlug: 'bulk-category',
  maxPages: 5,
  delayBetweenRequests: 2000,
  useProxy: true,
  forceFullScrape: true,
  batchSize: 100,
  ...overrides,
});
