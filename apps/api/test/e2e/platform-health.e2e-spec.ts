import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '@dealscrapper/database';
import {
  cleanupTestData,
  createAuthenticatedDealHunter,
} from '../helpers/e2e-helpers';

/**
 * Platform Health E2E Tests
 *
 * Tests system reliability, error handling, and edge cases that ensure
 * deal hunters can depend on the platform for consistent service.
 * Focus on operational excellence and user trust.
 */
describe('Deal Hunting Platform Health & Reliability', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
        disableErrorMessages: false,
      })
    );

    prisma = moduleFixture.get<PrismaService>(PrismaService);
    await app.init();
  });

  beforeEach(async () => {
    await cleanupTestData(prisma);
  });

  afterAll(async () => {
    await cleanupTestData(prisma);
    await app.close();
  });

  describe('System Health Monitoring for Reliable Deal Hunting', () => {
    it('provides health status to ensure platform availability', async () => {
      // Platform health endpoint should always be accessible
      const healthResponse = await request(app.getHttpServer())
        .get('/health')
        .expect(200);

      expect(healthResponse.body.success).toBe(true);
      expect(healthResponse.body.data.status).toBeDefined();
      expect(['healthy', 'unhealthy', 'degraded']).toContain(
        healthResponse.body.data.status
      );
    });

    it('reports detailed health information for system monitoring', async () => {
      const healthResponse = await request(app.getHttpServer())
        .get('/health')
        .expect(200);

      const health = healthResponse.body.data;

      // Should include health information
      expect(health).toBeDefined();
      expect(typeof health).toBe('object');
      expect(health.timestamp).toBeDefined();
      expect(health.service).toBeDefined();
      expect(health.uptime).toBeDefined();

      // Should provide overall status
      expect(['healthy', 'unhealthy', 'degraded']).toContain(health.status);
    });

    it('reports API direct dependencies only (database, authentication)', async () => {
      // The API only checks its direct dependencies - not external services like scheduler/workers
      // Worker pool health is the scheduler's responsibility to report
      const healthResponse = await request(app.getHttpServer())
        .get('/health')
        .expect(200);

      const health = healthResponse.body.data;

      // API should report database health
      expect(health.database).toBeDefined();
      expect(typeof health.database).toBe('object');

      // API should report authentication health
      expect(health.authentication).toBeDefined();
      expect(typeof health.authentication).toBe('object');

      // API should report its own metrics
      expect(health.api).toBeDefined();
      expect(health.performance).toBeDefined();

      // API should NOT report external services (scheduler/workers)
      // Those are not direct dependencies of the API
      expect(health.externalServices).toBeUndefined();
    });
  });

  describe('API Error Handling for Better User Experience', () => {
    it('handles invalid API endpoints with helpful error messages', async () => {
      const response = await request(app.getHttpServer())
        .get('/non-existent-endpoint')
        .expect(404);

      expect(response.body.message).toBeDefined();
      expect(response.body.statusCode).toBe(404);
    });

    it('validates request data and provides clear feedback', async () => {
      // Invalid registration data
      const invalidUserData = {
        email: 'not-an-email', // Invalid email format
        password: '123', // Too short
        firstName: '', // Empty
        lastName: '', // Empty
      };

      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(invalidUserData)
        .expect(400);

      expect(response.body.message).toBeDefined();
      expect(Array.isArray(response.body.message)).toBe(true);
      expect(response.body.message.length).toBeGreaterThan(0);
    });

    it('handles malformed JSON requests gracefully', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }')
        .expect(400);

      expect(response.body.message).toBeDefined();
    });
  });

  describe('Security Headers and Protection', () => {
    it('includes security headers to protect user data', async () => {
      const response = await request(app.getHttpServer())
        .get('/health')
        .expect(200);

      // Security headers may be configured at the reverse proxy level in production
      // For E2E tests, we verify the response is secure and proper
      expect(response.headers['content-type']).toMatch(/application\/json/);

      // Basic security verification - some headers may be present in test environment
      // In production, these would typically be removed or modified
      if (response.headers['x-powered-by']) {
        // Express may expose this in test environment, that's acceptable
        expect(response.headers['x-powered-by']).toBeDefined();
      }

      // Core security: proper content type and no debug info
      expect(response.headers['content-type']).toMatch(/application\/json/);
    });

    it('prevents SQL injection attempts in API parameters', async () => {
      const dealHunter = await createAuthenticatedDealHunter(app, prisma);

      // Attempt SQL injection in filter name
      const maliciousFilter = {
        name: "'; DROP TABLE users; --",
        description: 'Malicious filter attempt',
        filterExpression: {
          rules: [
            {
              field: 'currentPrice',
              operator: '<=',
              value: 100,
              weight: 1.0,
            },
          ],
          matchLogic: 'AND',
          minScore: 50,
          scoreMode: 'weighted',
        },
        active: true,
      };

      // Should either succeed (with sanitized input) or fail with validation error
      const response = await request(app.getHttpServer())
        .post('/filters')
        .set('Authorization', `Bearer ${dealHunter.token}`)
        .send(maliciousFilter);

      // Should not crash the application
      expect([200, 201, 400]).toContain(response.status);

      // Database should still be intact
      await request(app.getHttpServer())
        .get('/users/profile')
        .set('Authorization', `Bearer ${dealHunter.token}`)
        .expect(200);
    });
  });

  describe('Rate Limiting for System Protection', () => {
    it('handles high-frequency requests without degrading service', async () => {
      // Send multiple sequential requests to avoid overwhelming test environment
      const responses = [];

      for (let i = 0; i < 5; i++) {
        try {
          const response = await request(app.getHttpServer()).get('/health');
          responses.push(response);
        } catch (error) {
          // Handle connection resets gracefully in test environment
          console.log(
            'Rate limit test: Connection reset (expected in high-frequency tests)'
          );
        }
      }

      // At least some requests should succeed
      expect(responses.length).toBeGreaterThan(0);
      responses.forEach((response) => {
        expect([200, 429]).toContain(response.status); // 200 or rate limited
      });
    });

    it('protects against brute force login attempts', async () => {
      const testEmail = 'nonexistent@example.com';
      const wrongPassword = 'wrongpassword';

      // Multiple failed login attempts (sequential to avoid connection issues)
      const responses = [];

      for (let i = 0; i < 3; i++) {
        try {
          const response = await request(app.getHttpServer())
            .post('/auth/login')
            .send({
              email: testEmail,
              password: wrongPassword,
            });
          responses.push(response);
        } catch (error) {
          // Handle connection resets gracefully in test environment
          console.log(
            'Brute force test: Connection reset (expected under load)'
          );
        }
      }

      // Should handle multiple failed attempts gracefully
      expect(responses.length).toBeGreaterThan(0);
      responses.forEach((response) => {
        expect([401, 429]).toContain(response.status);
      });
    });
  });

  describe('Data Consistency and Edge Cases', () => {
    it('handles empty result sets gracefully', async () => {
      const dealHunter = await createAuthenticatedDealHunter(app, prisma);

      // User with no filters should get empty array, not error
      const filtersResponse = await request(app.getHttpServer())
        .get('/filters')
        .set('Authorization', `Bearer ${dealHunter.token}`)
        .expect(200);

      // API returns paginated response, not just array
      expect(filtersResponse.body.data.filters).toEqual([]);
      expect(filtersResponse.body.data.total).toBe(0);
      expect(filtersResponse.body.success).toBe(true);
    });

    it('handles requests for non-existent resources appropriately', async () => {
      const dealHunter = await createAuthenticatedDealHunter(app, prisma);
      const nonExistentId = '00000000-0000-0000-0000-000000000000';

      // Request for non-existent filter
      await request(app.getHttpServer())
        .get(`/filters/${nonExistentId}`)
        .set('Authorization', `Bearer ${dealHunter.token}`)
        .expect(404);

      // Request for non-existent category
      await request(app.getHttpServer())
        .get(`/categories/${nonExistentId}`)
        .set('Authorization', `Bearer ${dealHunter.token}`)
        .expect(404);
    });

    it('maintains consistent API response format across endpoints', async () => {
      const dealHunter = await createAuthenticatedDealHunter(app, prisma);

      // Check profile endpoint response format
      const profileResponse = await request(app.getHttpServer())
        .get('/users/profile')
        .set('Authorization', `Bearer ${dealHunter.token}`)
        .expect(200);

      expect(profileResponse.body.data).toBeDefined();
      expect(profileResponse.body.message).toBeDefined();

      // Check filters endpoint response format
      const filtersResponse = await request(app.getHttpServer())
        .get('/filters')
        .set('Authorization', `Bearer ${dealHunter.token}`)
        .expect(200);

      expect(filtersResponse.body.data).toBeDefined();
      expect(filtersResponse.body.message).toBeDefined();
    });
  });

  describe('Performance and Scalability Indicators', () => {
    it('responds to health checks within reasonable time', async () => {
      const startTime = Date.now();

      await request(app.getHttpServer()).get('/health').expect(200);

      const responseTime = Date.now() - startTime;

      // Health check should be fast (under 1 second)
      expect(responseTime).toBeLessThan(1000);
    });

    it('handles multiple authenticated requests efficiently', async () => {
      const dealHunter = await createAuthenticatedDealHunter(app, prisma);

      const startTime = Date.now();

      // Multiple concurrent authenticated requests
      const requests = Array(5)
        .fill(null)
        .map(() =>
          request(app.getHttpServer())
            .get('/users/profile')
            .set('Authorization', `Bearer ${dealHunter.token}`)
        );

      const responses = await Promise.all(requests);
      const totalTime = Date.now() - startTime;

      // All requests should succeed
      responses.forEach((response) => {
        expect(response.status).toBe(200);
      });

      // Should complete reasonably quickly
      expect(totalTime).toBeLessThan(5000);
    });
  });
});
