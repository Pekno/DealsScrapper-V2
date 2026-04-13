import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '@dealscrapper/database';
import { cleanupTestData } from '../helpers/e2e-helpers';
import { RateLimitMiddleware } from '../../src/common/middleware/rate-limit.middleware';
import { SharedConfigService } from '@dealscrapper/shared-config';

/**
 * Rate Limiting E2E Tests
 *
 * These tests specifically verify rate limiting functionality by setting
 * TEST_RATE_LIMITING=true to enable rate limiting during tests.
 *
 * Note: Regular tests have rate limiting disabled to prevent interference.
 */
describe('Rate Limiting Protection', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authToken: string;

  beforeAll(async () => {
    // Enable rate limiting for these specific tests
    process.env.TEST_RATE_LIMITING = 'true';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Apply rate limiting middleware (same as in main.ts)
    const sharedConfig =
      moduleFixture.get<SharedConfigService>(SharedConfigService);
    const rateLimitConfig = sharedConfig.getRateLimitConfig();
    app.use(
      new RateLimitMiddleware(rateLimitConfig).use.bind(
        new RateLimitMiddleware(rateLimitConfig)
      )
    );

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

    // Create and login a user to get auth token for testing authenticated endpoints
    const testUser = {
      email: `test.rate.limit.${Date.now()}@example.com`,
      password: 'TestP@ssw0rd123',
      firstName: 'Test',
      lastName: 'User',
    };

    // Register user
    await request(app.getHttpServer())
      .post('/auth/register')
      .send(testUser)
      .expect(201);

    // Verify user email to allow login
    await prisma.user.update({
      where: { email: testUser.email },
      data: { emailVerified: true },
    });

    // Login to get token
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: testUser.email,
        password: testUser.password,
      })
      .expect(200);

    authToken = loginResponse.body.data.access_token;
  });

  beforeEach(async () => {
    await cleanupTestData(prisma);
  });

  afterAll(async () => {
    await cleanupTestData(prisma);
    // Clean up environment variable
    delete process.env.TEST_RATE_LIMITING;
    await app.close();
  });

  describe('Rate Limiting Middleware Integration', () => {
    it('should properly configure rate limiting when TEST_RATE_LIMITING=true', async () => {
      // Verify that the test environment variable is set correctly
      expect(process.env.TEST_RATE_LIMITING).toBe('true');

      // Verify that shared config service recognizes rate limiting should be enabled
      const sharedConfig = app.get(SharedConfigService);
      const rateLimitConfig = sharedConfig.getRateLimitConfig();
      expect(rateLimitConfig.enabled).toBe(true);
      expect(Number(rateLimitConfig.maxRequests)).toBeGreaterThan(0);
      expect(Number(rateLimitConfig.windowMs)).toBeGreaterThan(0);
    });
  });

  describe('Authentication Rate Limiting', () => {
    it('should include rate limit headers for auth endpoints', async () => {
      const invalidCredentials = {
        email: 'nonexistent@example.com',
        password: 'wrongpassword',
      };

      // Make a failed login attempt
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send(invalidCredentials)
        .expect(401);

      // Should have rate limit headers (standard format) from AuthRateLimitGuard
      expect(response.headers['ratelimit-limit']).toBeDefined();
      expect(response.headers['ratelimit-remaining']).toBeDefined();
    });

    it('should include rate limit headers for registration endpoint', async () => {
      const testUser = {
        email: `test.register.${Date.now()}@example.com`,
        password: 'TestP@ssw0rd123',
        firstName: 'Test',
        lastName: 'User',
      };

      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(testUser)
        .expect(201);

      // Should have rate limit headers from AuthRateLimitGuard
      expect(response.headers['ratelimit-limit']).toBeDefined();
      expect(response.headers['ratelimit-remaining']).toBeDefined();
    });
  });

  describe('Rate Limit Configuration Verification', () => {
    it('should have rate limiting enabled when TEST_RATE_LIMITING=true', async () => {
      // Verify that rate limiting is actually enabled in this test environment
      expect(process.env.TEST_RATE_LIMITING).toBe('true');

      // Make a request to any auth endpoint and verify headers are present
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: `test.verify.${Date.now()}@example.com`,
          password: 'TestP@ssw0rd123',
        })
        .expect(201);

      // Verify rate limit headers are present
      expect(response.headers['ratelimit-limit']).toBeDefined();
      expect(response.headers['ratelimit-remaining']).toBeDefined();
      expect(typeof response.headers['ratelimit-limit']).toBe('string');
      expect(typeof response.headers['ratelimit-remaining']).toBe('string');
    });
  });

  describe('Rate Limit Exclusions', () => {
    it('should exclude health endpoints from rate limiting', async () => {
      // Health endpoints should not be rate limited
      for (let i = 0; i < 20; i++) {
        await request(app.getHttpServer()).get('/health').expect(200);
      }

      // All requests should succeed
    });

  });
});
