import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '@dealscrapper/database';
import { createGamingFilter, createTechDealsFilter } from '../factories';
import {
  cleanupTestData,
  createAuthenticatedDealHunter,
  createTestCategory,
} from '../helpers/e2e-helpers';

/**
 * Deal Hunting Workflow E2E Tests
 *
 * Tests the core value proposition: helping users create filters,
 * find relevant deals, and get notified about great opportunities.
 * Focus on the complete deal hunting experience.
 */
describe('Smart Deal Hunting Workflows', () => {
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

  describe('Smart Filter Creation for Personalized Deal Discovery', () => {
    it('helps gaming enthusiasts find laptops within their budget', async () => {
      const dealHunter = await createAuthenticatedDealHunter(app, prisma);

      // Create gaming category for filtering
      const gamingCategory = await createTestCategory(prisma, {
        name: 'Gaming Laptops',
        slug: 'gaming-laptops',
        description: 'High-performance gaming laptops and accessories',
      });

      const gamingFilter = createGamingFilter({
        categoryIds: [gamingCategory.id],
      });

      // User creates a filter to find gaming laptops under €800
      const filterResponse = await request(app.getHttpServer())
        .post('/filters')
        .set('Authorization', `Bearer ${dealHunter.token}`)
        .send(gamingFilter)
        .expect(201);

      const createdFilter = filterResponse.body.data;
      expect(createdFilter.name).toBe('Gaming Laptop Deals Under €800');
      expect(createdFilter.active).toBe(true);
      expect(createdFilter.immediateNotifications).toBe(true);
      expect(createdFilter.filterExpression.rules).toHaveLength(2);

      // Filter should have price rule ≤ €800
      const priceRule = createdFilter.filterExpression.rules.find(
        (rule) => rule.field === 'currentPrice'
      );
      expect(priceRule.operator).toBe('<=');
      expect(priceRule.value).toBe(800);
    });

    it('prevents users from creating filters with invalid business rules', async () => {
      const dealHunter = await createAuthenticatedDealHunter(app, prisma);

      // Invalid filter: negative price
      const invalidFilter = createGamingFilter({
        filterExpression: {
          rules: [
            {
              field: 'currentPrice',
              operator: '<=',
              value: -100, // Invalid negative price
              weight: 2.0,
            },
          ],
        },
      });

      const response = await request(app.getHttpServer())
        .post('/filters')
        .set('Authorization', `Bearer ${dealHunter.token}`)
        .send(invalidFilter)
        .expect(400);

      expect(response.body.message).toBeDefined();
    });

    it('allows tech enthusiasts to find high-end deals with significant discounts', async () => {
      const dealHunter = await createAuthenticatedDealHunter(app, prisma);

      const techCategory = await createTestCategory(prisma, {
        name: 'High-Tech',
        slug: 'high-tech',
        description: 'Premium technology products and gadgets',
      });

      const techFilter = createTechDealsFilter({
        categoryIds: [techCategory.id],
      });

      // User creates filter for premium tech deals with 25%+ discounts
      const filterResponse = await request(app.getHttpServer())
        .post('/filters')
        .set('Authorization', `Bearer ${dealHunter.token}`)
        .send(techFilter)
        .expect(201);

      const createdFilter = filterResponse.body.data;
      expect(createdFilter.name).toBe('Premium Tech Deals Over €200');

      // Should have discount rule ≥ 25%
      const discountRule = createdFilter.filterExpression.rules.find(
        (rule) => rule.field === 'discountPercentage'
      );
      expect(discountRule.value).toBe(25);
      expect(discountRule.operator).toBe('>=');
    });
  });

  describe('Filter Management for Active Deal Hunting', () => {
    it('allows deal hunters to view and manage all their active filters', async () => {
      const dealHunter = await createAuthenticatedDealHunter(app, prisma);

      // Create categories
      const gamingCategory = await createTestCategory(prisma, {
        name: 'Gaming',
        slug: 'gaming',
      });

      const techCategory = await createTestCategory(prisma, {
        name: 'Tech',
        slug: 'tech',
      });

      // User creates multiple filters for different interests
      const gamingFilter = createGamingFilter({
        categoryIds: [gamingCategory.id],
      });
      const techFilter = createTechDealsFilter({
        categoryIds: [techCategory.id],
      });

      await request(app.getHttpServer())
        .post('/filters')
        .set('Authorization', `Bearer ${dealHunter.token}`)
        .send(gamingFilter)
        .expect(201);

      await request(app.getHttpServer())
        .post('/filters')
        .set('Authorization', `Bearer ${dealHunter.token}`)
        .send(techFilter)
        .expect(201);

      // User can view all their filters
      const filtersResponse = await request(app.getHttpServer())
        .get('/filters')
        .set('Authorization', `Bearer ${dealHunter.token}`)
        .expect(200);

      const filters = filtersResponse.body.data.filters;
      expect(filters).toHaveLength(2);
      expect(filters.some((f) => f.name.includes('Gaming'))).toBe(true);
      expect(filters.some((f) => f.name.includes('Premium Tech'))).toBe(true);
    });

    it('allows users to pause filters when they want to reduce notifications', async () => {
      const dealHunter = await createAuthenticatedDealHunter(app, prisma);

      const category = await createTestCategory(prisma, {
        name: 'Gaming',
        slug: 'gaming',
      });

      // Create and get filter ID
      const filterResponse = await request(app.getHttpServer())
        .post('/filters')
        .set('Authorization', `Bearer ${dealHunter.token}`)
        .send(createGamingFilter({ categoryIds: [category.id] }))
        .expect(201);

      const filterId = filterResponse.body.data.id;

      // User pauses filter to reduce notification volume
      const toggleResponse = await request(app.getHttpServer())
        .post(`/filters/${filterId}/toggle`)
        .set('Authorization', `Bearer ${dealHunter.token}`)
        .expect(200);

      expect(toggleResponse.body.data.active).toBe(false);
    });

    it('allows users to delete filters they no longer need', async () => {
      const dealHunter = await createAuthenticatedDealHunter(app, prisma);

      const category = await createTestCategory(prisma, {
        name: 'Gaming',
        slug: 'gaming',
      });

      // Create filter
      const filterResponse = await request(app.getHttpServer())
        .post('/filters')
        .set('Authorization', `Bearer ${dealHunter.token}`)
        .send(createGamingFilter({ categoryIds: [category.id] }))
        .expect(201);

      const filterId = filterResponse.body.data.id;

      // User deletes filter they no longer want
      await request(app.getHttpServer())
        .delete(`/filters/${filterId}`)
        .set('Authorization', `Bearer ${dealHunter.token}`)
        .expect(200);

      // Filter should no longer exist
      await request(app.getHttpServer())
        .get(`/filters/${filterId}`)
        .set('Authorization', `Bearer ${dealHunter.token}`)
        .expect(404);
    });
  });

  describe('Deal Discovery and Matching', () => {
    it('helps users discover available categories for deal hunting', async () => {
      const dealHunter = await createAuthenticatedDealHunter(app, prisma);

      // Create some categories that represent different deal hunting opportunities
      await createTestCategory(prisma, {
        name: 'Gaming Laptops',
        slug: 'gaming-laptops',
        description: 'High-performance gaming computers',
      });

      await createTestCategory(prisma, {
        name: 'Smartphones',
        slug: 'smartphones',
        description: 'Latest mobile devices and accessories',
      });

      // User explores available categories for deal hunting
      const categoriesResponse = await request(app.getHttpServer())
        .get('/categories')
        .set('Authorization', `Bearer ${dealHunter.token}`)
        .expect(200);

      const categories = categoriesResponse.body.data;
      expect(categories.length).toBeGreaterThanOrEqual(2);
      expect(categories.some((c) => c.name === 'Gaming Laptops')).toBe(true);
      expect(categories.some((c) => c.name === 'Smartphones')).toBe(true);
    });
  });

  describe('User Experience and Security', () => {
    it('protects user filters from unauthorized access', async () => {
      const dealHunter1 = await createAuthenticatedDealHunter(app, prisma);
      const dealHunter2 = await createAuthenticatedDealHunter(app, prisma, {
        email: 'another.hunter@example.com',
      });

      const category = await createTestCategory(prisma, {
        name: 'Gaming',
        slug: 'gaming',
      });

      // User 1 creates a private filter
      const filterResponse = await request(app.getHttpServer())
        .post('/filters')
        .set('Authorization', `Bearer ${dealHunter1.token}`)
        .send(createGamingFilter({ categoryIds: [category.id] }))
        .expect(201);

      const filterId = filterResponse.body.data.id;

      // User 2 cannot access User 1's private filter
      await request(app.getHttpServer())
        .get(`/filters/${filterId}`)
        .set('Authorization', `Bearer ${dealHunter2.token}`)
        .expect(404);

      // User 2 cannot modify User 1's filter
      await request(app.getHttpServer())
        .put(`/filters/${filterId}`)
        .set('Authorization', `Bearer ${dealHunter2.token}`)
        .send({ active: false })
        .expect(404);
    });

    it('requires authentication for all deal hunting features', async () => {
      // Unauthenticated users cannot create filters
      await request(app.getHttpServer())
        .post('/filters')
        .send(createGamingFilter())
        .expect(401);

      // Unauthenticated users cannot view filters
      await request(app.getHttpServer()).get('/filters').expect(401);

      // Unauthenticated users cannot access profile
      await request(app.getHttpServer()).get('/users/profile').expect(401);
    });
  });
});
