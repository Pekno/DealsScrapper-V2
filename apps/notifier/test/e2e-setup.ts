import { config } from 'dotenv';
import { PrismaService } from '@dealscrapper/database';
import { type GenericRedisClientType, createClient } from 'redis';

// Load test environment variables
config({ path: '../../.env.test' });

let prisma: PrismaService;
let redisClient: GenericRedisClientType;

/**
 * E2E Test Setup with Real Services
 * This setup uses actual database and Redis instances for comprehensive testing
 */

// Global setup before all tests
beforeAll(async () => {
  console.log = (...args) => {
    // Mute console.log output
  };

  // 1. Setup Test Database
  await setupTestDatabase();

  // 2. Setup Test Redis
  await setupTestRedis();

  // 3. Clear any existing test data
  await cleanupTestData();
}, 30000); // 30 second timeout for setup

// Cleanup after each test
afterEach(async () => {
  // Clean test data but keep schema
  await cleanupTestData();

  // Clear Redis cache
  if (redisClient?.isOpen) {
    await redisClient.flushAll();
  }
});

// Global cleanup after all tests
afterAll(async () => {
  await cleanupTestServices();
}, 10000);

/**
 * Setup test database connection
 */
async function setupTestDatabase() {
  const databaseUrl = process.env.DATABASE_URL;

  // Initialize Prisma client for tests
  prisma = new PrismaService();

  try {
    await prisma.$connect();
  } catch (error) {
    console.error('❌ Failed to connect to test database:', error.message);
    console.error(
      'Make sure to run: npm run test:db:setup first (from project root)'
    );
    throw error;
  }

  // Make Prisma available globally for tests
  (global as any).testPrisma = prisma;
}

/**
 * Setup test Redis instance
 */
async function setupTestRedis() {
  const redisUrl =
    `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}` ||
    'redis://localhost:6380';

  redisClient = createClient({ url: redisUrl });

  redisClient.on('error', (err: Error) => {
    console.warn('Redis test client error:', err);
  });

  try {
    await redisClient.connect();
    await redisClient.flushAll();
  } catch (error) {
    console.warn('Redis setup warning:', error.message);
    // Continue without Redis if not available
  }

  // Make Redis available globally for tests
  (global as any).testRedis = redisClient;
}

/**
 * Clean up test data while preserving schema
 */
async function cleanupTestData() {
  if (!prisma) return;

  try {
    // Clean up in reverse dependency order
    await prisma.category.deleteMany({});
    await prisma.filter.deleteMany({});
    await prisma.filterCategory.deleteMany({});
    await prisma.match.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.userSession.deleteMany({});
    await prisma.notification.deleteMany({});
    await prisma.scrapingJob.deleteMany({});
    await prisma.scheduledJob.deleteMany({});

    // Reset sequences/auto-increment if needed
    await prisma.$executeRaw`ALTER SEQUENCE IF EXISTS "User_id_seq" RESTART WITH 1;`;
    await prisma.$executeRaw`ALTER SEQUENCE IF EXISTS "Notification_id_seq" RESTART WITH 1;`;
  } catch (error) {
    console.warn('Cleanup warning:', error.message);
  }
}

/**
 * Cleanup test services
 */
async function cleanupTestServices() {
  try {
    if (redisClient?.isOpen) {
      await redisClient.quit();
    }

    if (prisma) {
      await prisma.$disconnect();
    }
  } catch (error) {
    console.warn('Service cleanup warning:', error.message);
  }
}

/**
 * Utility functions for tests
 */
export const testHelpers = {
  /**
   * Create a test user with preferences
   */
  async createTestUser(userData: Partial<any> = {}) {
    return await prisma.user.create({
      data: {
        email: `test-${Date.now()}@example.com`,
        password: userData.password || 'StrongP@ssw0rd',
        firstName: 'Test',
        lastName: 'User',
        emailVerified: true,
        ...userData,
      },
    });
  },

  /**
   * Wait for async operations (queue processing, etc.)
   */
  async waitFor(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  },

  /**
   * Get Redis test client
   */
  getRedisClient() {
    return redisClient;
  },

  /**
   * Get Prisma test client
   */
  getPrismaClient() {
    return prisma;
  },
};

// Extend Jest matchers for better assertions
expect.extend({
  toBeValidDate(received) {
    const pass = received instanceof Date && !isNaN(received.getTime());
    return {
      message: () =>
        pass
          ? `expected ${received} not to be a valid date`
          : `expected ${received} to be a valid date`,
      pass,
    };
  },

  async toExistInDatabase(received, tableName: string) {
    const record = await prisma[tableName].findUnique({
      where: { id: received },
    });

    return {
      message: () =>
        record
          ? `expected record with id ${received} not to exist in ${tableName}`
          : `expected record with id ${received} to exist in ${tableName}`,
      pass: !!record,
    };
  },
});

// Type declarations
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidDate(): R;
      toExistInDatabase(tableName: string): Promise<R>;
    }
  }

  var testPrisma: PrismaClient;
  var testRedis: any;
}
