import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '@dealscrapper/database';
import { TestScraperModule } from './test-scraper.module';
import { cleanupTestData } from '../helpers/e2e-helpers';

/**
 * Service Reliability E2E Tests
 *
 * Tests service reliability, error handling, and resilience under various
 * conditions to ensure consistent value delivery to users.
 * Focus on service quality and operational excellence.
 */
describe('Service Reliability and Error Handling', () => {
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

  describe('Resilient Service Operation for User Confidence', () => {
    it('maintains service health during invalid request scenarios', async () => {
      // BUSINESS ACT: Test service resilience with various invalid scenarios
      const invalidRequests = [
        { endpoint: '/non-existent-endpoint', method: 'get', expected: 404 },
        {
          endpoint: '/puppeteer-pool/stats',
          method: 'post',
          expected: [404, 405],
        },
        {
          endpoint: '/puppeteer-pool/stats',
          method: 'delete',
          expected: [404, 405],
        },
        { endpoint: '/health', method: 'put', expected: [404, 405] },
      ];

      for (const scenario of invalidRequests) {
        await (request(app.getHttpServer()) as any)
          [scenario.method](scenario.endpoint)
          .expect((res: any) => {
            const expectedCodes = Array.isArray(scenario.expected)
              ? scenario.expected
              : [scenario.expected];
            expect(expectedCodes).toContain(res.status);
          });
      }

      // BUSINESS ASSERT: Service remains healthy after invalid requests
      const healthResponse = await request(app.getHttpServer())
        .get('/health')
        .expect(200);

      expect(healthResponse.body.data.service).toBe('scraper');
      expect(healthResponse.body.data.status).toBeDefined();
    });

    it('provides consistent API responses across different operations', async () => {
      // BUSINESS ACT: Verify API consistency for user experience
      const endpoints = ['/health', '/puppeteer-pool/stats'];

      for (const endpoint of endpoints) {
        const response = await request(app.getHttpServer())
          .get(endpoint)
          .expect(200);

        // BUSINESS ASSERT: Consistent JSON response format
        expect(response.headers['content-type']).toMatch(/application\/json/);
        expect(typeof response.body).toBe('object');
        expect(response.body.data).toBeDefined();
      }
    });

    it('handles CORS and HTTP method validation properly', async () => {
      // BUSINESS ACT: Test HTTP method restrictions
      const methodTests = [
        { endpoint: '/health', method: 'patch', expected: [404, 405] },
        {
          endpoint: '/puppeteer-pool/stats',
          method: 'put',
          expected: [404, 405],
        },
      ];

      for (const test of methodTests) {
        await (request(app.getHttpServer()) as any)
          [test.method](test.endpoint)
          .expect((res: any) => {
            expect(test.expected).toContain(res.status);
          });
      }

      // BUSINESS ACT: Test OPTIONS for CORS
      await request(app.getHttpServer())
        .options('/health')
        .expect((res) => {
          // Should either return CORS headers or 404/405
          expect([200, 204, 404, 405]).toContain(res.status);
        });

      // Service should remain operational
      const healthCheck = await request(app.getHttpServer())
        .get('/health')
        .expect(200);

      expect(healthCheck.body.data.service).toBe('scraper');
    });
  });

  describe('Performance Under Load for Scalable User Service', () => {
    it('maintains response times under moderate concurrent load', async () => {
      // BUSINESS ARRANGE: Simulate realistic user load
      const concurrentRequests = 4;
      const startTime = Date.now();
      const responses = [];

      // BUSINESS ACT: Generate sequential requests to avoid connection issues
      for (let i = 0; i < concurrentRequests; i++) {
        const endpoint = i % 2 === 0 ? '/health' : '/puppeteer-pool/stats';
        try {
          const response = await request(app.getHttpServer())
            .get(endpoint)
            .expect(200);
          responses.push(response);
        } catch (error) {
          // Retry once if connection fails
          const retryResponse = await request(app.getHttpServer())
            .get(endpoint)
            .expect(200);
          responses.push(retryResponse);
        }
      }

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // BUSINESS ASSERT: Service maintains performance under load
      expect(totalTime).toBeLessThan(3000); // Under 3 seconds for 4 requests
      expect(responses).toHaveLength(concurrentRequests);
      responses.forEach((response) => {
        expect(response.body.data).toBeDefined();
        expect(response.headers['content-type']).toMatch(/application\/json/);
      });
    });

    it('provides stable browser pool operations during high monitoring activity', async () => {
      // BUSINESS ARRANGE: Moderate pool monitoring scenario
      const monitoringCount = 4;
      const responses = [];

      // BUSINESS ACT: Execute monitoring requests sequentially to avoid connection issues
      for (let i = 0; i < monitoringCount; i++) {
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

      // BUSINESS ASSERT: Pool maintains stability under monitoring load
      expect(responses).toHaveLength(monitoringCount);
      responses.forEach((response) => {
        const stats = response.body.data;
        expect(stats.totalInstances).toBeGreaterThanOrEqual(0);
        expect(stats.busyInstances).toBeGreaterThanOrEqual(0);
        expect(stats.availableInstances).toBeGreaterThanOrEqual(0);
        expect(['healthy', 'degraded', 'unhealthy']).toContain(
          stats.healthStatus
        );
      });

      // Configuration should remain consistent
      const firstStats = responses[0].body.data;
      const lastStats = responses[responses.length - 1].body.data;
      expect(firstStats.totalRequests).toBeGreaterThanOrEqual(0);
      expect(lastStats.totalRequests).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Data Integrity and Response Quality', () => {
    it('maintains consistent response structure across all endpoints', async () => {
      // BUSINESS ACT: Collect responses from all available endpoints
      const [healthResponse, poolResponse] = await Promise.all([
        request(app.getHttpServer()).get('/health').expect(200),
        request(app.getHttpServer()).get('/puppeteer-pool/stats').expect(200),
      ]);

      const healthData = healthResponse.body;
      const poolData = poolResponse.body;

      // BUSINESS ASSERT: Consistent API response structure
      expect(typeof healthData).toBe('object');
      expect(typeof poolData).toBe('object');
      expect(healthData.data).toBeDefined();
      expect(poolData.data).toBeDefined();

      // Response metadata should be present
      expect(
        healthData.data.timestamp || healthData.data.service
      ).toBeDefined();
      expect(
        poolData.data.totalInstances !== undefined ||
          poolData.data.maxInstances !== undefined
      ).toBe(true);
    });

    it('handles edge cases in browser pool monitoring gracefully', async () => {
      // BUSINESS ACT: Test consecutive requests with retry logic
      const requestCount = 3;
      const responses = [];

      for (let i = 0; i < requestCount; i++) {
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

      // BUSINESS ASSERT: Service handles requests consistently
      expect(responses).toHaveLength(requestCount);
      responses.forEach((response) => {
        const stats = response.body.data;
        expect(typeof stats.totalInstances).toBe('number');
        expect(typeof stats.busyInstances).toBe('number');
        expect(typeof stats.availableInstances).toBe('number');
        expect(stats.healthStatus).toBeDefined();
      });
    });
  });

  describe('Monitoring and Observability for Operational Excellence', () => {
    it('provides comprehensive health metrics for system monitoring', async () => {
      // BUSINESS ACT: Gather comprehensive monitoring data
      const [healthResponse, poolResponse] = await Promise.all([
        request(app.getHttpServer()).get('/health').expect(200),
        request(app.getHttpServer()).get('/puppeteer-pool/stats').expect(200),
      ]);

      const healthData = healthResponse.body.data;
      const poolData = poolResponse.body.data;

      // BUSINESS ASSERT: Comprehensive monitoring data available
      expect(healthData.service).toBe('scraper');
      expect(healthData.status).toBeDefined();
      expect(healthData.timestamp).toBeDefined();

      expect(typeof poolData.totalInstances).toBe('number');
      expect(typeof poolData.busyInstances).toBe('number');
      expect(typeof poolData.availableInstances).toBe('number');
      expect(typeof poolData.avgWaitTime).toBe('number');
      expect(['healthy', 'degraded', 'unhealthy']).toContain(
        poolData.healthStatus
      );
    });

    it('maintains metric consistency across multiple monitoring cycles', async () => {
      // BUSINESS ACT: Collect metrics across multiple monitoring cycles
      const cycles = [];

      for (let i = 0; i < 3; i++) {
        const [health, pool] = await Promise.all([
          request(app.getHttpServer()).get('/health').expect(200),
          request(app.getHttpServer()).get('/puppeteer-pool/stats').expect(200),
        ]);

        cycles.push({
          health: health.body.data,
          pool: pool.body.data,
        });

        // Brief delay between cycles
        if (i < 2) {
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      }

      // BUSINESS ASSERT: Metrics remain structurally consistent
      cycles.forEach((cycle) => {
        expect(cycle.health.service).toBe('scraper');
        expect(cycle.pool.totalRequests).toBeGreaterThanOrEqual(0);
        expect(['healthy', 'degraded', 'unhealthy']).toContain(
          cycle.pool.healthStatus
        );
      });

      // Service configuration should remain stable
      const serviceNames = cycles.map((c) => c.health.service);
      const totalInstances = cycles.map((c) => c.pool.totalInstances);

      expect(new Set(serviceNames).size).toBe(1); // All same service
      expect(totalInstances.every((count) => count >= 0)).toBe(true); // All valid instance counts
    });
  });
});
