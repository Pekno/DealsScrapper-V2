import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaModule, PrismaService } from '@dealscrapper/database';
import { ScheduleModule } from '@nestjs/schedule';

export const createTestingModule = async (
  providers: any[] = [],
  imports: any[] = []
) => {
  const moduleBuilder = Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        envFilePath: '.env.test',
      }),
      ScheduleModule.forRoot(),
      PrismaModule,
      ...imports,
    ],
    providers: [...providers],
  });

  return moduleBuilder.compile();
};

export const mockConfigService = {
  get: jest.fn((key: string, defaultValue?: any) => {
    const config: Record<string, any> = {
      PUPPETEER_MAX_INSTANCES: 3,
      PUPPETEER_TIMEOUT: 30000,
      PUPPETEER_HEADLESS: 'new',
      WORKER_MAX_MEMORY_MB: 1024,
      REDIS_HOST: 'localhost',
      REDIS_PORT: '6379',
    };
    return config[key] || defaultValue;
  }),
};

export const mockPrismaService = {
  // Add common Prisma mock methods here
  $connect: jest.fn(),
  $disconnect: jest.fn(),
  $transaction: jest.fn(),
};

export const MockFactories = {
  createMockPrismaService: () => ({
    category: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue({}),
      count: jest.fn().mockResolvedValue(0),
    },
    scrapeMilestone: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue({}),
    },
    article: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
      update: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue({}),
      count: jest.fn().mockResolvedValue(0),
    },
    scrapeJob: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      delete: jest.fn().mockResolvedValue({}),
    },
    user: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue({}),
    },
    notification: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue({}),
      count: jest.fn().mockResolvedValue(0),
    },
    filter: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue({}),
    },
    match: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue({}),
    },
    categoryTracking: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue({}),
    },
    scrapingJob: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
      upsert: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue({}),
    },
    $connect: jest.fn().mockResolvedValue(undefined),
    $disconnect: jest.fn().mockResolvedValue(undefined),
    $transaction: jest.fn().mockImplementation((fn) => fn(this)),
    $executeRaw: jest.fn().mockResolvedValue([
      {
        total_categories: 1,
        monitored_categories: 1,
        total_users: 1,
        max_users_per_category: 1,
      },
    ]),
    $queryRaw: jest.fn().mockResolvedValue([
      {
        total_categories: 1,
        monitored_categories: 1,
        total_users: 1,
        max_users_per_category: 1,
      },
    ]),
  }),

  createMockScrapeQueue: () => ({
    addJob: jest.fn(),
    addScrapeJob: jest.fn(),
    getJobs: jest.fn(),
    getJob: jest.fn(),
    pauseQueue: jest.fn(),
    resumeQueue: jest.fn(),
    getQueueStats: jest.fn(),
    getRecentJobs: jest.fn(),
    clearCompleted: jest.fn(),
    cleanQueue: jest.fn(),
  }),

  createMockDealExtraction: () => ({
    extractDealsFromPage: jest.fn(),
    extractNextPageUrl: jest.fn(),
    parseHtml: jest.fn(),
  }),

  createMockMilestoneScrapingService: () => ({
    scrapeNewDealsOnly: jest.fn(),
    getOrCreateMilestone: jest.fn(),
    updateMilestone: jest.fn(),
    storeNewDeals: jest.fn(),
  }),

  createMockPuppeteerPool: () => ({
    acquire: jest.fn().mockResolvedValue({
      newPage: jest.fn().mockResolvedValue({
        setUserAgent: jest.fn(),
        setViewport: jest.fn(),
        setRequestInterception: jest.fn(),
        on: jest.fn(),
        goto: jest.fn(),
        waitForSelector: jest
          .fn()
          .mockRejectedValue(new Error('Selector not found')),
        content: jest
          .fn()
          .mockResolvedValue('<html><body>Mock HTML content</body></html>'),
        close: jest.fn(),
      }),
    }),
    release: jest.fn(),
    getBrowser: jest.fn(), // legacy alias for acquire
    releaseBrowser: jest.fn(), // legacy alias for release
    getStats: jest.fn(),
    healthCheck: jest.fn(),
    initialize: jest.fn(),
    onModuleInit: jest.fn(), // legacy alias for initialize
    onModuleDestroy: jest.fn(),
  }),

  createMockAdaptiveScheduler: () => ({
    initializeScheduling: jest.fn(),
    updateCategoryFrequency: jest.fn(),
    getCategorySchedule: jest.fn(),
    pauseCategory: jest.fn(),
    resumeCategory: jest.fn(),
  }),

  // Data factories
  deal: () => ({
    externalId: 'deal-123',
    title: 'Test Deal',
    description: 'Great test deal',
    brand: 'TestBrand',
    category: 'Electronics',
    categoryPath: ['Electronics', 'Smartphones'],
    currentPrice: 299.99,
    originalPrice: 399.99,
    discountPercentage: 25,
    merchant: 'TestMerchant',
    temperature: 100,
    voteCount: 50,
    upvotes: 40,
    downvotes: 10,
    commentCount: 5,
    viewCount: 1000,
    shareCount: 25,
    freeShipping: true,
    pickupAvailable: false,
    deliveryMethods: ['standard'],
    geographicRestrictions: [],
    communityVerified: true,
    publishedAt: new Date(),
    dealAge: 2,
    url: 'https://www.dealabs.com/test-deal',
    keywords: ['test', 'deal'],
    tags: ['electronics'],
    searchTerms: ['test deal'],
    isExpired: false,
    isCoupon: false,
    isSponsored: false,
    siteId: 'dealabs',
    isActive: true,
  }),
};

export const TestData = {
  createMockCategory: (overrides = {}) => ({
    id: 'cat-1',
    name: 'Smartphones',
    slug: 'smartphones',
    url: 'https://www.dealabs.com/groupe/smartphones',
    parent_id: null,
    children: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  createMockArticle: (overrides = {}) => ({
    id: 'article-1',
    title: 'Test Deal',
    dealabs_id: 'deal-12345',
    url: 'https://www.dealabs.com/bons-plans/test-deal-12345',
    price: 299.99,
    original_price: 399.99,
    discount_percentage: 25,
    category_id: 'cat-1',
    source_site: 'dealabs',
    temperature: 100,
    published_at: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  createMockScrapeMilestone: (overrides = {}) => ({
    id: 'milestone-1',
    category_id: 'cat-1',
    last_scraped_id: 'deal-12345',
    last_scraped_timestamp: new Date(),
    total_deals_scraped: 100,
    average_deals_per_hour: 10,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  generateUniqueScrapeJob: () => ({
    categorySlug: 'smartphones',
    categoryUrl: 'https://www.dealabs.com/groupe/smartphones',
    priority: 'normal' as const,
    source: 'manual' as const,
  }),

  createMilestone: (overrides = {}) => ({
    id: 'milestone-1',
    categoryUrl: 'https://www.dealabs.com/groupe/smartphones',
    categorySlug: 'smartphones',
    categoryName: 'Smartphones',
    lastSeenDealId: 'deal-123',
    lastSeenTimestamp: new Date(),
    lastScrapeAt: new Date(),
    scrapeCount: 5,
    totalDealsFound: 50,
    newDealsInLast24h: 10,
    avgDealsPerHour: 2.5,
    scrapeFrequency: 10,
    activeUserCount: 25,
    isActive: true,
    errorCount: 0,
    ...overrides,
  }),

  createDeal: (overrides = {}) => ({
    externalId: 'deal-456',
    title: 'Another Test Deal',
    description: 'Another great deal for testing',
    brand: 'TestBrand2',
    category: 'Electronics',
    categoryPath: ['Electronics', 'Tablets'],
    currentPrice: 199.99,
    originalPrice: 299.99,
    discountPercentage: 33,
    merchant: 'TestMerchant2',
    temperature: 80,
    voteCount: 30,
    upvotes: 25,
    downvotes: 5,
    commentCount: 3,
    viewCount: 750,
    shareCount: 15,
    freeShipping: true,
    pickupAvailable: true,
    deliveryMethods: ['express', 'standard'],
    geographicRestrictions: [],
    communityVerified: false,
    publishedAt: new Date(),
    dealAge: 1,
    url: 'https://www.dealabs.com/test-deal-2',
    keywords: ['test', 'deal', 'tablet'],
    tags: ['electronics', 'tablets'],
    searchTerms: ['test tablet deal'],
    isExpired: false,
    isCoupon: false,
    isSponsored: false,
    siteId: 'dealabs',
    isActive: true,
    ...overrides,
  }),
};

export class TestApp {
  static async createTestApp(extraProviders = [], extraImports = []) {
    const module = await createTestingModule(extraProviders, extraImports);
    return module;
  }
}
