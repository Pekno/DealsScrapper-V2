/**
 * Business-focused E2E test helpers
 */
import { INestApplication } from '@nestjs/common';
import { PrismaService } from '@dealscrapper/database';
import { createDealHunter } from '../factories';
import request from 'supertest';

export interface AuthenticatedUser {
  id: string;
  email: string;
  token: string;
  firstName: string;
  lastName: string;
}

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
 * Creates and authenticates a deal hunter user for testing
 */
export async function createAuthenticatedDealHunter(
  app: INestApplication,
  prisma: PrismaService,
  userOverrides = {}
): Promise<AuthenticatedUser> {
  const userData = createDealHunter(userOverrides);

  // Register the user
  const registerResponse = await request(app.getHttpServer())
    .post('/auth/register')
    .send(userData);

  if (registerResponse.status !== 201) {
    throw new Error(
      `Registration failed: ${registerResponse.body?.message || 'Unknown error'}`
    );
  }

  // Get user from database to verify email directly (simulate email verification)
  const user = await prisma.user.findUnique({
    where: { email: userData.email },
  });

  if (!user) {
    throw new Error('User not found after registration');
  }

  // Mark email as verified (simulating email verification flow)
  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerified: true },
  });

  // Login to get JWT token
  const loginResponse = await request(app.getHttpServer())
    .post('/auth/login')
    .send({
      email: userData.email,
      password: userData.password,
    });

  if (loginResponse.status !== 200) {
    throw new Error(
      `Login failed: ${loginResponse.body?.message || 'Unknown error'}`
    );
  }

  return {
    id: user.id,
    email: userData.email,
    token: loginResponse.body.data.access_token,
    firstName: userData.firstName,
    lastName: userData.lastName,
  };
}

/**
 * Creates a test category for deal filtering
 */
export async function createTestCategory(
  prisma: PrismaService,
  categoryData: {
    name: string;
    slug: string;
    description?: string;
    isActive?: boolean;
    siteId?: string;
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
      isActive: categoryData.isActive !== false,
      siteId,
      sourceUrl: `https://www.dealabs.com/groupe/${categoryData.slug}`,
    },
  });
}

/**
 * Cleans test data between tests
 */
export async function cleanupTestData(prisma: PrismaService): Promise<void> {
  // Clean in dependency order to avoid foreign key constraints
  // Delete child records before parent records
  await prisma.match.deleteMany({});
  await prisma.notification.deleteMany({});
  await prisma.filterCategory.deleteMany({});
  await prisma.filter.deleteMany({});
  await prisma.userSession.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.article.deleteMany({}); // Articles reference Category - delete first
  await prisma.category.deleteMany({}); // Then delete Category
  await prisma.scheduledJob.deleteMany({});
  await prisma.scrapingJob.deleteMany({});
}

/**
 * Waits for a condition to be met (useful for async operations)
 */
export async function waitForCondition(
  condition: () => Promise<boolean>,
  maxWaitMs = 5000,
  intervalMs = 100
): Promise<boolean> {
  const start = Date.now();

  while (Date.now() - start < maxWaitMs) {
    if (await condition()) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  return false;
}
