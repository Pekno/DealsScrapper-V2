/**
 * Notification Factories for Business Testing
 *
 * Creates realistic notification scenarios that users would actually encounter.
 * Focus on business-relevant notification types and user interactions.
 */

/**
 * Deal-match notification payload data. Includes the canonical processor keys
 * (`title`, `price`, `url`, ...) plus the alternate keys some tests provide
 * (`dealTitle`, `currentPrice`, `dealUrl`, `store`, ...), which the test helper
 * normalizes before building the queue job.
 */
export interface DealMatchNotificationData {
  title?: string;
  price?: number;
  originalPrice?: number;
  currentPrice?: number;
  discountPercentage?: number;
  merchant?: string;
  store?: string;
  url?: string;
  dealUrl?: string;
  dealTitle?: string;
  score?: number;
  category?: string;
  expiresAt?: Date;
  matchedFilterId?: string;
  imageUrl?: string;
  temperature?: number;
  // Tests attach scenario-specific extra fields (e.g. matchScore, auditRequired).
  [key: string]: unknown;
}

export interface DealMatchNotification {
  type: string;
  title: string;
  message: string;
  channels: string[];
  priority: string;
  data: DealMatchNotificationData;
}

export const createDealMatchNotification = (
  overrides: Partial<DealMatchNotification> = {}
): DealMatchNotification => ({
  type: 'deal-match',
  title: 'Great Gaming Laptop Deal Found!',
  message: 'MSI Gaming Laptop - RTX 4060, 16GB RAM - Now €799 (was €1099)',
  channels: ['email', 'websocket'],
  priority: 'high',
  ...overrides,
  data: {
    title: 'MSI Gaming Laptop GF63 Thin 15.6"', // Required for processor
    price: 799, // Required for processor (maps to currentPrice)
    originalPrice: 1099,
    discountPercentage: 27,
    merchant: 'TechStore', // Required for processor (was 'store')
    url: 'https://example.com/deal/gaming-laptop-deal', // Required for processor (was 'dealUrl')
    score: 85, // Required for processor (default score)
    category: 'Gaming Laptops',
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    matchedFilterId: '123e4567-e89b-12d3-a456-426614174000',
    imageUrl: 'https://example.com/laptop.jpg',
    ...overrides.data,
  },
});

export const createPriceDropNotification = (overrides = {}) => ({
  type: 'price-drop',
  title: 'Price Drop Alert!',
  message: "The iPhone 15 you're watching dropped by €150",
  channels: ['email'],
  priority: 'medium',
  data: {
    dealTitle: 'Apple iPhone 15 128GB',
    originalPrice: 949,
    currentPrice: 799,
    discountPercentage: 16,
    previousPrice: 899,
    priceDropAmount: 100,
    store: 'ElectroShop',
    category: 'Smartphones',
  },
  ...overrides,
});

export const createDigestNotification = (overrides = {}) => ({
  type: 'daily-digest',
  title: 'Your Daily Deal Digest',
  message: '5 new deals matching your interests',
  channels: ['email'],
  priority: 'low',
  data: {
    dealCount: 5,
    topCategories: ['Gaming', 'Tech', 'Home'],
    bestDiscount: 45,
    digestDate: new Date().toISOString().split('T')[0],
    deals: [
      {
        title: 'Gaming Headset - SteelSeries Arctis 7',
        discount: 35,
        currentPrice: 129,
      },
      {
        title: 'Samsung 27" Monitor 4K',
        discount: 25,
        currentPrice: 299,
      },
    ],
  },
  ...overrides,
});

export const createWelcomeNotification = (overrides = {}) => ({
  type: 'welcome',
  title: 'Welcome to DealScrapper!',
  message: 'Start finding amazing deals with your first filter',
  channels: ['email'],
  priority: 'medium',
  data: {
    userName: 'Alex',
    onboardingStep: 'welcome',
    nextAction: 'create-first-filter',
    helpUrl: 'https://help.dealscrapper.com/getting-started',
  },
  ...overrides,
});

export const createEmailVerificationNotification = (overrides = {}) => ({
  type: 'email-verification',
  title: 'Verify Your Email Address',
  message: 'Please verify your email to start receiving deal notifications',
  channels: ['email'],
  priority: 'high',
  data: {
    verificationToken: 'verify_123456789abcdef',
    verificationUrl:
      'https://dealscrapper.com/verify?token=verify_123456789abcdef',
    expiresIn: '24 hours',
  },
  ...overrides,
});

export const createSpamTestNotification = (overrides = {}) => ({
  type: 'deal-match',
  title: 'Spam Test Notification',
  message: 'This is for testing rate limiting',
  channels: ['email', 'websocket'],
  priority: 'low',
  data: {
    title: 'Test Deal', // Required for processor
    price: 99, // Required for processor
    merchant: 'TestStore', // Required for processor
    url: 'https://example.com/test-deal', // Required for processor
    score: 50, // Required for processor (low score for spam test)
  },
  ...overrides,
});
