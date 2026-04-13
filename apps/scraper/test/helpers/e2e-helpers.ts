/**
 * Business-focused E2E test helpers for scraper service
 */
import { PrismaService } from '@dealscrapper/database';

/**
 * Get default site configuration for test data creation
 */
function getSiteDefaults(siteId: string): {
  id: string;
  name: string;
  baseUrl: string;
  categoryDiscoveryUrl: string;
  color: string;
  isActive: boolean;
} {
  const siteConfigs: Record<
    string,
    { name: string; baseUrl: string; categoryDiscoveryUrl: string; color: string }
  > = {
    dealabs: {
      name: 'Dealabs',
      baseUrl: 'https://www.dealabs.com',
      categoryDiscoveryUrl: 'https://www.dealabs.com/groupe/',
      color: '#FF7900',
    },
    vinted: {
      name: 'Vinted',
      baseUrl: 'https://www.vinted.fr',
      categoryDiscoveryUrl: 'https://www.vinted.fr/catalog',
      color: '#09B1BA',
    },
    leboncoin: {
      name: 'LeBonCoin',
      baseUrl: 'https://www.leboncoin.fr',
      categoryDiscoveryUrl: 'https://www.leboncoin.fr/recherche',
      color: '#FF6E14',
    },
  };

  const config = siteConfigs[siteId] || {
    name: siteId.charAt(0).toUpperCase() + siteId.slice(1),
    baseUrl: `https://www.${siteId}.com`,
    categoryDiscoveryUrl: `https://www.${siteId}.com/categories`,
    color: '#FF7900',
  };

  return {
    id: siteId,
    ...config,
    isActive: true,
  };
}

/**
 * Creates a test category for scraping scenarios
 */
export async function createTestCategory(
  prisma: PrismaService,
  categoryData: {
    name: string;
    slug: string;
    description?: string;
    sourceUrl?: string;
    siteId?: string;
    isActive?: boolean;
    userCount?: number;
    avgTemperature?: number;
    popularBrands?: string[];
  }
) {
  const siteId = categoryData.siteId || 'dealabs';

  // Ensure site exists
  const siteDefaults = getSiteDefaults(siteId);
  await prisma.site.upsert({
    where: { id: siteId },
    update: {},
    create: siteDefaults,
  });

  return prisma.category.create({
    data: {
      name: categoryData.name,
      slug: categoryData.slug,
      description:
        categoryData.description || `Test category: ${categoryData.name}`,
      siteId,
      sourceUrl:
        categoryData.sourceUrl ||
        `${siteDefaults.baseUrl}/groupe/${categoryData.slug}`,
      isActive: categoryData.isActive !== false,
      userCount: categoryData.userCount || 0,
      avgTemperature: categoryData.avgTemperature || 200,
      popularBrands: categoryData.popularBrands || [],
    },
  });
}

/**
 * Creates a scraping job for testing purposes
 */
export async function createTestScrapingJob(
  prisma: PrismaService,
  jobData: {
    scheduledJobId: string;
    status?: string;
    attempts?: number;
    dealsFound?: number;
    dealsProcessed?: number;
  }
) {
  return prisma.scrapingJob.create({
    data: {
      scheduledJobId: jobData.scheduledJobId,
      status: jobData.status || 'pending',
      attempts: jobData.attempts || 0,
      dealsFound: jobData.dealsFound,
      dealsProcessed: jobData.dealsProcessed,
    },
  });
}

/**
 * Creates a scraping job for testing
 */
export async function createScrapingJob(
  prisma: PrismaService,
  jobData: {
    scheduledJobId: string;
    status?: string;
    attempts?: number;
    dealsFound?: number;
    dealsProcessed?: number;
  }
) {
  return prisma.scrapingJob.create({
    data: {
      scheduledJobId: jobData.scheduledJobId,
      status: jobData.status || 'pending',
      attempts: jobData.attempts || 0,
      dealsFound: jobData.dealsFound,
      dealsProcessed: jobData.dealsProcessed,
    },
  });
}

/**
 * Creates test deals/articles for processing scenarios
 * Note: Site-specific fields (temperature, merchant, etc.) are in extension tables
 */
export async function createTestDeal(
  prisma: PrismaService,
  dealData: {
    externalId?: string;
    title: string;
    currentPrice: number;
    categoryId?: string;
    siteId?: string;
  }
) {
  const siteId = dealData.siteId || 'dealabs';

  // Ensure site exists
  const siteDefaults = getSiteDefaults(siteId);
  await prisma.site.upsert({
    where: { id: siteId },
    update: {},
    create: siteDefaults,
  });

  return prisma.article.create({
    data: {
      externalId: dealData.externalId || `test-deal-${Date.now()}`,
      title: dealData.title,
      description: `Test deal: ${dealData.title}`,
      currentPrice: dealData.currentPrice,
      categoryId: dealData.categoryId || 'test-category-id',
      siteId,
      url: `https://example.com/deal-${Date.now()}`,
      imageUrl: 'https://example.com/image.jpg',
      categoryPath: ['Test', 'Category'],
      publishedAt: new Date(),
      scrapedAt: new Date(),
      isActive: true,
    },
  });
}

/**
 * Simulates scraped deals for processing tests
 */
export async function simulateScrapedDeals(
  prisma: PrismaService,
  count: number = 3,
  categoryId: string = 'test-category-id'
) {
  const deals = [];
  for (let i = 0; i < count; i++) {
    const deal = await createTestDeal(prisma, {
      title: `Test Deal ${i + 1}`,
      currentPrice: 100 + i * 50,
      categoryId,
    });
    deals.push(deal);
  }
  return deals;
}

/**
 * Waits for a job to complete or timeout
 */
export async function waitForJobCompletion(
  prisma: PrismaService,
  jobId: string,
  timeoutMs: number = 10000
): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    try {
      const job = await prisma.scrapingJob.findUnique({
        where: { id: jobId },
      });

      if (job && (job.status === 'completed' || job.status === 'failed')) {
        return job.status === 'completed';
      }

      await new Promise((resolve) => setTimeout(resolve, 500)); // Wait 500ms
    } catch (error) {
      // Job might not exist yet, continue waiting
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  return false; // Timeout
}

/**
 * Simulates high load conditions for testing
 */
export async function simulateHighLoad(
  requests: Array<() => Promise<any>>,
  concurrency: number = 5
): Promise<any[]> {
  const results = [];

  for (let i = 0; i < requests.length; i += concurrency) {
    const batch = requests.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map((request) => request().catch((error) => ({ error })))
    );
    results.push(...batchResults);
  }

  return results;
}

/**
 * Cleans test data between tests - follows dependency order
 */
export async function cleanupTestData(prisma: PrismaService): Promise<void> {
  // Clean in dependency order to avoid foreign key constraints
  try {
    await prisma.match.deleteMany({});
    await prisma.scrapingJob.deleteMany({});
    await prisma.article.deleteMany({});
    await prisma.category.deleteMany({});
  } catch (error) {
    // Log error but don't fail the test
    console.warn('Cleanup warning:', error);
  }
}
