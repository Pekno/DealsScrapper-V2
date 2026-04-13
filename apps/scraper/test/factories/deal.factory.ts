/**
 * Business-focused test data factories for deals and articles
 */

export const createLaptopDeal = (overrides: Partial<any> = {}) => ({
  externalId: `laptop-deal-${Date.now()}`,
  title: 'Gaming Laptop RTX 4070 - Special Offer',
  description: 'High-performance gaming laptop with RTX 4070 graphics card',
  brand: 'ASUS',
  model: 'ROG Strix G15',
  currentPrice: 1299,
  originalPrice: 1799,
  discountPercentage: 27.79,
  discountAmount: 500,
  temperature: 850,
  merchant: 'TechStore',
  category: 'laptops',
  subcategory: 'gaming-laptops',
  url: `https://example.com/laptop-deal-${Date.now()}`,
  imageUrl: 'https://example.com/laptop-image.jpg',
  publishedAt: new Date(),
  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
  freeShipping: true,
  keywords: ['gaming', 'laptop', 'rtx', '4070', 'asus'],
  tags: ['high-performance', 'gaming', 'graphics'],
  ...overrides,
});

export const createSmartphoneDeal = (overrides: Partial<any> = {}) => ({
  externalId: `smartphone-deal-${Date.now()}`,
  title: 'iPhone 15 Pro Max - Latest Model',
  description: 'Latest iPhone with titanium design and advanced camera system',
  brand: 'Apple',
  model: 'iPhone 15 Pro Max',
  currentPrice: 999,
  originalPrice: 1199,
  discountPercentage: 16.68,
  discountAmount: 200,
  temperature: 650,
  merchant: 'Apple Store',
  category: 'smartphones',
  subcategory: 'iphone',
  url: `https://example.com/iphone-deal-${Date.now()}`,
  imageUrl: 'https://example.com/iphone-image.jpg',
  publishedAt: new Date(),
  expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000), // 12 hours
  freeShipping: true,
  keywords: ['iphone', 'apple', 'smartphone', '15', 'pro'],
  tags: ['premium', 'flagship', 'titanium'],
  ...overrides,
});

export const createGamingAccessoryDeal = (overrides: Partial<any> = {}) => ({
  externalId: `gaming-accessory-${Date.now()}`,
  title: 'Wireless Gaming Mouse RGB Pro',
  description:
    'Professional wireless gaming mouse with customizable RGB lighting',
  brand: 'Logitech',
  model: 'G Pro X Superlight',
  currentPrice: 89,
  originalPrice: 149,
  discountPercentage: 40.27,
  discountAmount: 60,
  temperature: 420,
  merchant: 'Gaming World',
  category: 'gaming-accessories',
  subcategory: 'gaming-mice',
  url: `https://example.com/mouse-deal-${Date.now()}`,
  imageUrl: 'https://example.com/mouse-image.jpg',
  publishedAt: new Date(),
  expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000), // 6 hours
  freeShipping: false,
  keywords: ['gaming', 'mouse', 'wireless', 'rgb', 'logitech'],
  tags: ['gaming', 'peripherals', 'wireless'],
  ...overrides,
});

export const createTechGadgetDeal = (overrides: Partial<any> = {}) => ({
  externalId: `tech-gadget-${Date.now()}`,
  title: 'Smart Watch Series 9 - Health & Fitness Tracker',
  description:
    'Advanced smart watch with comprehensive health monitoring features',
  brand: 'Samsung',
  model: 'Galaxy Watch 6',
  currentPrice: 199,
  originalPrice: 299,
  discountPercentage: 33.44,
  discountAmount: 100,
  temperature: 380,
  merchant: 'Electronics Hub',
  category: 'tech-gadgets',
  subcategory: 'smartwatches',
  url: `https://example.com/watch-deal-${Date.now()}`,
  imageUrl: 'https://example.com/watch-image.jpg',
  publishedAt: new Date(),
  expiresAt: new Date(Date.now() + 18 * 60 * 60 * 1000), // 18 hours
  freeShipping: true,
  keywords: ['smartwatch', 'samsung', 'fitness', 'health', 'galaxy'],
  tags: ['wearable', 'fitness', 'smart'],
  ...overrides,
});

export const createSmartphoneDeals = (count: number = 3) => {
  return Array.from({ length: count }, (_, i) =>
    createSmartphoneDeal({
      externalId: `smartphone-${i}-${Date.now()}`,
      title: `Smartphone Deal ${i + 1} - Premium Model`,
      currentPrice: 500 + i * 200,
      originalPrice: 700 + i * 200,
      temperature: 300 + i * 100,
    })
  );
};

export const createLaptopDeals = (count: number = 3) => {
  return Array.from({ length: count }, (_, i) =>
    createLaptopDeal({
      externalId: `laptop-${i}-${Date.now()}`,
      title: `Laptop Deal ${i + 1} - Gaming Edition`,
      currentPrice: 1000 + i * 300,
      originalPrice: 1400 + i * 300,
      temperature: 600 + i * 150,
    })
  );
};
