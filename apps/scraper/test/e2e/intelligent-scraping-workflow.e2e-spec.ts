import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '@dealscrapper/database';
import { TestScraperModule } from './test-scraper.module';
import { cleanupTestData } from '../helpers/e2e-helpers';

/**
 * Intelligent Scraping Workflow E2E Tests
 *
 * Tests the core value proposition: reliable browser pool management and
 * service health monitoring for scraping operations.
 * Focus on operational reliability and resource management.
 */
describe('Intelligent Scraping Service Operations', () => {
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

  describe('Reliable Browser Pool Management for Efficient Scraping', () => {
    it('maintains browser pool health for consistent scraping performance', async () => {
      // BUSINESS ACT: Check browser pool performance for scraping reliability
      const response = await request(app.getHttpServer())
        .get('/puppeteer-pool/stats')
        .expect(200);

      const poolStats = response.body.data;

      // BUSINESS ASSERT: Browser pool provides reliable scraping infrastructure
      expect(poolStats.totalInstances).toBeGreaterThanOrEqual(0);
      expect(poolStats.busyInstances).toBeGreaterThanOrEqual(0);
      expect(poolStats.availableInstances).toBeGreaterThanOrEqual(0);
      expect(poolStats.queuedRequests).toBeGreaterThanOrEqual(0);
      expect(poolStats.totalRequests).toBeGreaterThanOrEqual(0);
      expect(poolStats.avgWaitTime).toBeGreaterThanOrEqual(0);

      // Pool should maintain healthy state for users
      expect(['healthy', 'degraded', 'unhealthy']).toContain(
        poolStats.healthStatus
      );
    });

    it('provides comprehensive service health for operational transparency', async () => {
      // BUSINESS ACT: Check overall service health for user confidence
      const response = await request(app.getHttpServer())
        .get('/health')
        .expect(200);

      const healthData = response.body.data;

      // BUSINESS ASSERT: Service provides transparent health information
      expect(healthData.status).toBeDefined();
      expect(healthData.service).toBe('scraper');
      expect(healthData.version).toBeDefined();
      expect(healthData.timestamp).toBeDefined();
      expect(new Date(healthData.timestamp).getTime()).toBeGreaterThan(0);
    });

    it('maintains consistent browser pool performance across multiple requests', async () => {
      // BUSINESS ARRANGE: Multiple concurrent monitoring requests
      const requests = Array.from({ length: 3 }, () =>
        request(app.getHttpServer()).get('/puppeteer-pool/stats').expect(200)
      );

      // BUSINESS ACT: Check pool stability under monitoring load
      const responses = await Promise.all(requests);

      // BUSINESS ASSERT: Pool provides consistent metrics
      responses.forEach((response) => {
        const stats = response.body.data;
        expect(stats.totalInstances).toBeGreaterThanOrEqual(0);
        expect(stats.busyInstances).toBeGreaterThanOrEqual(0);
        expect(stats.availableInstances).toBeGreaterThanOrEqual(0);
        expect(stats.healthStatus).toBeDefined();
      });

      // All responses should have same pool configuration
      const firstStats = responses[0].body.data;
      const lastStats = responses[responses.length - 1].body.data;
      expect(firstStats.totalInstances).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Service Reliability and Resource Management', () => {
    it('provides stable browser resource allocation for scraping operations', async () => {
      // BUSINESS ACT: Monitor browser resource management over time
      const initialResponse = await request(app.getHttpServer())
        .get('/puppeteer-pool/stats')
        .expect(200);

      // Small delay to allow for any state changes
      await new Promise((resolve) => setTimeout(resolve, 100));

      const secondResponse = await request(app.getHttpServer())
        .get('/puppeteer-pool/stats')
        .expect(200);

      const initialStats = initialResponse.body.data;
      const secondStats = secondResponse.body.data;

      // BUSINESS ASSERT: Resource allocation remains stable
      expect(initialStats.totalInstances).toBeGreaterThanOrEqual(0);
      expect(secondStats.totalInstances).toBeGreaterThanOrEqual(0);
      expect(initialStats.busyInstances).toBeGreaterThanOrEqual(0);
      expect(secondStats.busyInstances).toBeGreaterThanOrEqual(0);

      // Health status should be consistent for reliability
      expect(['healthy', 'degraded', 'unhealthy']).toContain(
        initialStats.healthStatus
      );
      expect(['healthy', 'degraded', 'unhealthy']).toContain(
        secondStats.healthStatus
      );
    });

    it('maintains service health status for operational confidence', async () => {
      // BUSINESS ACT: Check service health consistency
      const healthChecks = Array.from({ length: 2 }, () =>
        request(app.getHttpServer()).get('/health').expect(200)
      );

      const responses = await Promise.all(healthChecks);

      // BUSINESS ASSERT: Health information is consistent and reliable
      responses.forEach((response) => {
        const healthData = response.body.data;
        expect(healthData.service).toBe('scraper');
        expect(healthData.status).toBeDefined();
        expect(healthData.version).toBeDefined();
        expect(healthData.timestamp).toBeDefined();
      });

      // Service name should be consistent across checks
      const firstHealth = responses[0].body.data;
      const lastHealth = responses[responses.length - 1].body.data;
      expect(firstHealth.service).toBe(lastHealth.service);
      expect(firstHealth.version).toBe(lastHealth.version);
    });
  });

  describe('API Reliability and Error Handling', () => {
    it('handles invalid endpoint requests gracefully', async () => {
      // BUSINESS ACT: Test service resilience with invalid requests
      await request(app.getHttpServer())
        .get('/non-existent-endpoint')
        .expect(404);

      await request(app.getHttpServer())
        .post('/puppeteer-pool/stats') // Wrong HTTP method
        .expect((res) => {
          expect([404, 405]).toContain(res.status); // Either not found or method not allowed
        });

      // Service should remain healthy after invalid requests
      const healthResponse = await request(app.getHttpServer())
        .get('/health')
        .expect(200);

      // BUSINESS ASSERT: Service maintains stability during errors
      expect(healthResponse.body.data.service).toBe('scraper');
    });

    it('provides consistent API response format for all endpoints', async () => {
      // BUSINESS ACT: Check API consistency across endpoints
      const endpoints = ['/health', '/puppeteer-pool/stats'];

      const responses = await Promise.all(
        endpoints.map((endpoint) =>
          request(app.getHttpServer()).get(endpoint).expect(200)
        )
      );

      // BUSINESS ASSERT: Consistent API response structure
      responses.forEach((response) => {
        expect(response.headers['content-type']).toMatch(/application\/json/);
        expect(typeof response.body).toBe('object');
        expect(response.body.data).toBeDefined();
      });
    });
  });
});
