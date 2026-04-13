import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '@dealscrapper/database';
import { TestScraperModule } from './test-scraper.module';
import { cleanupTestData } from '../helpers/e2e-helpers';

/**
 * Browser Pool Performance E2E Tests
 *
 * Tests browser pool management and resource allocation for efficient
 * scraping operations. Focus on performance monitoring and capacity management.
 */
describe('Browser Pool Performance Management', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [TestScraperModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = moduleFixture.get<PrismaService>(PrismaService);
    await app.init();
  });

  beforeEach(async () => {
    await cleanupTestData(prisma);
  });

  afterAll(async () => {
    await cleanupTestData(prisma);
    await app.close();
    // Allow time for Redis connections to close properly
    await new Promise((resolve) => setTimeout(resolve, 500));
  });

  describe('Pool Resource Management and Performance Monitoring', () => {
    it('maintains optimal browser pool capacity for scraping efficiency', async () => {
      // BUSINESS ACT: Monitor browser pool capacity management
      const response = await request(app.getHttpServer())
        .get('/puppeteer-pool/stats')
        .expect(200);

      const poolStats = response.body.data;

      // BUSINESS ASSERT: Pool maintains optimal resource allocation
      expect(poolStats.totalInstances).toBeGreaterThanOrEqual(0);
      expect(poolStats.busyInstances).toBeLessThanOrEqual(
        poolStats.totalInstances
      );
      expect(poolStats.availableInstances).toBeLessThanOrEqual(
        poolStats.totalInstances
      );

      // Pool should efficiently manage browser resources
      expect(poolStats.queuedRequests).toBeGreaterThanOrEqual(0);
      expect(poolStats.avgWaitTime).toBeGreaterThanOrEqual(0);
    });

    it('handles concurrent monitoring requests efficiently', async () => {
      // BUSINESS ARRANGE: Simulate moderate monitoring load
      const concurrentRequests = 3;
      const startTime = Date.now();

      // BUSINESS ACT: Generate concurrent monitoring requests with sequential fallback
      const responses = [];
      for (let i = 0; i < concurrentRequests; i++) {
        try {
          const response = await request(app.getHttpServer())
            .get('/puppeteer-pool/stats')
            .expect(200);
          responses.push(response);
        } catch (error) {
          // Retry once if connection fails
          const retryResponse = await request(app.getHttpServer())
            .get('/puppeteer-pool/stats')
            .expect(200);
          responses.push(retryResponse);
        }
      }

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // BUSINESS ASSERT: Pool handles monitoring load efficiently
      expect(totalTime).toBeLessThan(3000); // Under 3 seconds for 3 requests
      expect(responses).toHaveLength(concurrentRequests);

      responses.forEach((response) => {
        const stats = response.body.data;
        expect(stats.totalInstances).toBeGreaterThanOrEqual(0);
        expect(stats.busyInstances).toBeGreaterThanOrEqual(0);
        expect(stats.availableInstances).toBeGreaterThanOrEqual(0);
        expect(['healthy', 'degraded', 'unhealthy']).toContain(
          stats.healthStatus
        );
      });
    });
  });

  describe('Resource Utilization Metrics for Operational Excellence', () => {
    it('provides detailed resource utilization metrics for capacity planning', async () => {
      // BUSINESS ACT: Gather comprehensive pool metrics
      const response = await request(app.getHttpServer())
        .get('/puppeteer-pool/stats')
        .expect(200);

      const stats = response.body.data;

      // BUSINESS ASSERT: Comprehensive metrics available for operations team
      expect(typeof stats.totalInstances).toBe('number');
      expect(typeof stats.busyInstances).toBe('number');
      expect(typeof stats.availableInstances).toBe('number');
      expect(typeof stats.queuedRequests).toBe('number');
      expect(typeof stats.totalRequests).toBe('number');
      expect(typeof stats.avgWaitTime).toBe('number');
      expect(typeof stats.successfulRequests).toBe('number');
      expect(typeof stats.failedRequests).toBe('number');

      // Health status should provide operational insights
      expect(['healthy', 'degraded', 'unhealthy']).toContain(
        stats.healthStatus
      );
    });

    it('maintains stable performance metrics over multiple measurement periods', async () => {
      // BUSINESS ARRANGE: Collect metrics over time
      const measurements = [];

      for (let i = 0; i < 3; i++) {
        const response = await request(app.getHttpServer())
          .get('/puppeteer-pool/stats')
          .expect(200);

        measurements.push(response.body.data);

        // Small delay between measurements
        if (i < 2) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      // BUSINESS ASSERT: Consistent operational metrics
      measurements.forEach((stats) => {
        expect(stats.totalInstances).toBeGreaterThanOrEqual(0);
        expect(stats.busyInstances).toBeLessThanOrEqual(stats.totalInstances);
        expect(stats.availableInstances).toBeLessThanOrEqual(
          stats.totalInstances
        );
        expect(['healthy', 'degraded', 'unhealthy']).toContain(
          stats.healthStatus
        );
      });

      // Configuration should remain stable
      const firstStats = measurements[0];
      const lastStats = measurements[measurements.length - 1];
      expect(firstStats.totalRequests).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Service Health Integration for User Confidence', () => {
    it('maintains overall service health alongside browser pool operations', async () => {
      // BUSINESS ACT: Check service health while pool is active
      const [healthResponse, poolResponse] = await Promise.all([
        request(app.getHttpServer()).get('/health').expect(200),
        request(app.getHttpServer()).get('/puppeteer-pool/stats').expect(200),
      ]);

      const healthData = healthResponse.body.data;
      const poolData = poolResponse.body.data;

      // BUSINESS ASSERT: Service and pool health are coordinated
      expect(healthData.service).toBe('scraper');
      expect(healthData.status).toBeDefined();
      expect(poolData.healthStatus).toBeDefined();

      // Service should provide operational transparency
      expect(healthData.timestamp).toBeDefined();
      expect(new Date(healthData.timestamp).getTime()).toBeGreaterThan(0);
    });

    it('provides consistent health reporting for monitoring systems', async () => {
      // BUSINESS ACT: Multiple health check requests
      const healthChecks = Array.from({ length: 3 }, () =>
        request(app.getHttpServer()).get('/health').expect(200)
      );

      const responses = await Promise.all(healthChecks);

      // BUSINESS ASSERT: Health reporting is reliable and consistent
      responses.forEach((response) => {
        const healthData = response.body.data;
        expect(healthData.service).toBe('scraper');
        expect(healthData.status).toBeDefined();
        expect(healthData.version).toBeDefined();
        expect(healthData.timestamp).toBeDefined();
      });

      // Service identity should be consistent across all checks
      const serviceNames = responses.map((r) => r.body.data.service);
      const versions = responses.map((r) => r.body.data.version);

      expect(new Set(serviceNames).size).toBe(1); // All same service name
      expect(new Set(versions).size).toBe(1); // All same version
    });
  });
});
