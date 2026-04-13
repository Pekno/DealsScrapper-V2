/**
 * Business-focused test data factories for categories and scraping contexts
 */

export const createGamingCategory = (overrides: Partial<any> = {}) => ({
  name: 'Gaming Hardware',
  slug: 'gaming-hardware',
  description:
    'High-performance gaming hardware and accessories for enthusiasts',
  siteId: 'dealabs',
  sourceUrl: 'https://www.dealabs.com/groupe/gaming-hardware',
  isActive: true,
  userCount: 125,
  avgTemperature: 450,
  popularBrands: ['ASUS', 'MSI', 'NVIDIA', 'AMD'],
  ...overrides,
});

export const createTechCategory = (overrides: Partial<any> = {}) => ({
  name: 'Tech Gadgets',
  slug: 'tech-gadgets',
  description: 'Latest technology gadgets and innovative electronic devices',
  siteId: 'dealabs',
  sourceUrl: 'https://www.dealabs.com/groupe/tech-gadgets',
  isActive: true,
  userCount: 89,
  avgTemperature: 320,
  popularBrands: ['Samsung', 'Apple', 'Google', 'Sony'],
  ...overrides,
});

export const createLaptopCategory = (overrides: Partial<any> = {}) => ({
  name: 'Laptops',
  slug: 'laptops',
  description: 'Portable computers for work, gaming, and productivity',
  siteId: 'dealabs',
  sourceUrl: 'https://www.dealabs.com/groupe/laptops',
  isActive: true,
  userCount: 156,
  avgTemperature: 380,
  popularBrands: ['Dell', 'HP', 'Lenovo', 'ASUS'],
  ...overrides,
});

export const createSmartphoneCategory = (overrides: Partial<any> = {}) => ({
  name: 'Smartphones',
  slug: 'smartphones',
  description: 'Latest smartphones and mobile devices from top manufacturers',
  siteId: 'dealabs',
  sourceUrl: 'https://www.dealabs.com/groupe/smartphones',
  isActive: true,
  userCount: 203,
  avgTemperature: 410,
  popularBrands: ['iPhone', 'Samsung', 'Google', 'OnePlus'],
  ...overrides,
});

export const createHighDemandCategory = (overrides: Partial<any> = {}) => ({
  name: 'High Demand Electronics',
  slug: 'high-demand-electronics',
  description: 'Popular electronics with high user interest and frequent deals',
  siteId: 'dealabs',
  sourceUrl: 'https://www.dealabs.com/groupe/high-demand-electronics',
  isActive: true,
  userCount: 500, // High demand
  avgTemperature: 600,
  popularBrands: ['Apple', 'Samsung', 'NVIDIA', 'Sony'],
  priority: 'high',
  ...overrides,
});

export const createNicheCategory = (overrides: Partial<any> = {}) => ({
  name: 'Niche Electronics',
  slug: 'niche-electronics',
  description: 'Specialized electronics for enthusiasts and professionals',
  siteId: 'dealabs',
  sourceUrl: 'https://www.dealabs.com/groupe/niche-electronics',
  isActive: true,
  userCount: 15, // Low demand
  avgTemperature: 180,
  popularBrands: ['Specialized Brand A', 'Specialized Brand B'],
  priority: 'low',
  ...overrides,
});
