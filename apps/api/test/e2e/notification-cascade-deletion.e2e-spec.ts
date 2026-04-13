import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '@dealscrapper/database';
import {
  cleanupTestData,
  createAuthenticatedDealHunter,
  createTestCategory,
} from '../helpers/e2e-helpers';

/**
 * Notification Cascade Deletion E2E Tests
 *
 * Tests the database-level cascade deletion behavior where:
 * - When a Match is deleted → associated Notifications are automatically deleted
 * - System notifications (matchId = null) are NOT affected
 * - Multiple notifications linked to one match are all cascade deleted
 *
 * This verifies the foreign key constraint onDelete: Cascade works correctly.
 */
describe('Notification Cascade Deletion (E2E)', () => {
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

  describe('Match deletion should cascade to notifications', () => {
    it('should automatically delete notification when match is deleted', async () => {
      // 1. Create and authenticate a test user
      const dealHunter = await createAuthenticatedDealHunter(app, prisma);

      // 2. Create a category (required for filter and article)
      const category = await createTestCategory(prisma, {
        name: 'Test Category Cascade',
        slug: 'test-category-cascade',
        description: 'Testing cascade deletion',
      });

      // 3. Create a filter
      const filterResponse = await request(app.getHttpServer())
        .post('/filters')
        .set('Authorization', `Bearer ${dealHunter.token}`)
        .send({
          name: 'Test Filter for Cascade',
          description: 'Testing cascade deletion',
          active: true,
          filterExpression: {
            rules: [
              {
                field: 'currentPrice',
                operator: '<=',
                value: 100,
                weight: 1.0,
              },
            ],
          },
          categoryIds: [category.id],
        })
        .expect(201);

      const filterId = filterResponse.body.data.id;

      // 4. Create an article (deal)
      const article = await prisma.article.create({
        data: {
          externalId: 'cascade-test-deal-001',
          title: 'Test Deal for Cascade',
          siteId: 'dealabs', // Required - Site created by createTestCategory
          categoryId: category.id,
          categoryPath: ['Test Category'],
          currentPrice: 50,
          url: 'https://example.com/deal',
        },
      });

      // 5. Create a match between filter and article
      const match = await prisma.match.create({
        data: {
          filterId,
          articleId: article.id,
          score: 0.95,
          notified: true,
          notifiedAt: new Date(),
        },
      });

      // 6. Create a notification with matchId (simulating what notifier service does)
      const notification = await prisma.notification.create({
        data: {
          userId: dealHunter.id,
          matchId: match.id, // THIS IS THE KEY - foreign key to match
          type: 'DEAL_MATCH',
          subject: 'New Deal Match',
          content: {
            type: 'DEAL_MATCH',
            title: 'Test Deal for Cascade',
            message: 'A deal matched your filter',
            dealData: {
              title: 'Test Deal for Cascade',
              price: 50,
            },
          },
          metadata: {
            filterId,
            matchId: match.id,
          },
          sent: true,
          sentAt: new Date(),
        },
      });

      // 7. Verify notification exists before deletion
      const notificationBeforeDelete = await prisma.notification.findUnique({
        where: { id: notification.id },
      });
      expect(notificationBeforeDelete).not.toBeNull();
      expect(notificationBeforeDelete?.matchId).toBe(match.id);

      // 8. Delete the match
      await prisma.match.delete({
        where: { id: match.id },
      });

      // 9. Verify notification was automatically deleted by cascade
      const notificationAfterDelete = await prisma.notification.findUnique({
        where: { id: notification.id },
      });
      expect(notificationAfterDelete).toBeNull();

      // Clean up
      await prisma.article.delete({ where: { id: article.id } });
      await prisma.filter.delete({ where: { id: filterId } });
      await prisma.category.delete({ where: { id: category.id } });
    });

    it('should NOT delete notification when matchId is null (system notifications)', async () => {
      // Create a test user
      const dealHunter = await createAuthenticatedDealHunter(app, prisma);

      // Create a system notification without matchId
      const systemNotification = await prisma.notification.create({
        data: {
          userId: dealHunter.id,
          matchId: null, // System notification has no match
          type: 'SYSTEM',
          subject: 'System Alert',
          content: {
            type: 'SYSTEM',
            title: 'System Maintenance',
            message: 'Scheduled maintenance tonight',
          },
          sent: true,
          sentAt: new Date(),
        },
      });

      // Verify it exists
      const notificationExists = await prisma.notification.findUnique({
        where: { id: systemNotification.id },
      });
      expect(notificationExists).not.toBeNull();
      expect(notificationExists?.matchId).toBeNull();

      // Create and delete a match to verify system notification remains
      const category = await createTestCategory(prisma, {
        name: 'Test Category',
        slug: 'test-category',
      });

      const filter = await prisma.filter.create({
        data: {
          userId: dealHunter.id,
          name: 'Test Filter',
          filterExpression: { rules: [] },
          categories: {
            create: [{ categoryId: category.id }],
          },
        },
      });

      const article = await prisma.article.create({
        data: {
          externalId: 'test-deal-001',
          title: 'Test Deal',
          siteId: 'dealabs', // Required - Site created by createTestCategory
          categoryId: category.id,
          categoryPath: ['Test'],
          currentPrice: 25,
          url: 'https://example.com/deal',
        },
      });

      const match = await prisma.match.create({
        data: {
          filterId: filter.id,
          articleId: article.id,
          score: 0.8,
        },
      });

      // Delete the match
      await prisma.match.delete({ where: { id: match.id } });

      // System notification should still exist
      const systemNotificationAfterDelete = await prisma.notification.findUnique(
        {
          where: { id: systemNotification.id },
        }
      );
      expect(systemNotificationAfterDelete).not.toBeNull();
      expect(systemNotificationAfterDelete?.matchId).toBeNull();

      // Clean up
      await prisma.notification.delete({ where: { id: systemNotification.id } });
      await prisma.article.delete({ where: { id: article.id } });
      await prisma.filter.delete({ where: { id: filter.id } });
      await prisma.category.delete({ where: { id: category.id } });
    });

    it('should delete multiple notifications when one match is deleted', async () => {
      // 1. Create a test user
      const dealHunter = await createAuthenticatedDealHunter(app, prisma);

      // 2. Create category
      const category = await createTestCategory(prisma, {
        name: 'Test Category Multi',
        slug: 'test-category-multi',
        description: 'Testing multiple notification cascade',
      });

      // 3. Create filter
      const filter = await prisma.filter.create({
        data: {
          userId: dealHunter.id,
          name: 'Multi Notification Test',
          filterExpression: { rules: [] },
          categories: {
            create: [{ categoryId: category.id }],
          },
        },
      });

      // 4. Create article
      const article = await prisma.article.create({
        data: {
          externalId: 'multi-notif-deal-001',
          title: 'Multi Notification Deal',
          siteId: 'dealabs', // Required - Site created by createTestCategory
          categoryId: category.id,
          categoryPath: ['Test'],
          currentPrice: 25,
          url: 'https://example.com/deal2',
        },
      });

      // 5. Create match
      const match = await prisma.match.create({
        data: {
          filterId: filter.id,
          articleId: article.id,
          score: 0.8,
        },
      });

      // 6. Create multiple notifications for the same match
      const notification1 = await prisma.notification.create({
        data: {
          userId: dealHunter.id,
          matchId: match.id,
          type: 'DEAL_MATCH',
          subject: 'First Notification',
          content: {
            type: 'DEAL_MATCH',
            title: 'First',
            message: 'Test notification 1',
          },
        },
      });

      const notification2 = await prisma.notification.create({
        data: {
          userId: dealHunter.id,
          matchId: match.id,
          type: 'DEAL_MATCH',
          subject: 'Second Notification',
          content: {
            type: 'DEAL_MATCH',
            title: 'Second',
            message: 'Test notification 2',
          },
        },
      });

      // 7. Verify both notifications exist
      const countBefore = await prisma.notification.count({
        where: { matchId: match.id },
      });
      expect(countBefore).toBe(2);

      // Verify each notification exists individually
      const notif1Before = await prisma.notification.findUnique({
        where: { id: notification1.id },
      });
      const notif2Before = await prisma.notification.findUnique({
        where: { id: notification2.id },
      });
      expect(notif1Before).not.toBeNull();
      expect(notif2Before).not.toBeNull();

      // 8. Delete the match
      await prisma.match.delete({ where: { id: match.id } });

      // 9. Verify both notifications were cascade deleted
      const countAfter = await prisma.notification.count({
        where: { matchId: match.id },
      });
      expect(countAfter).toBe(0);

      // Verify each notification was deleted individually
      const notif1After = await prisma.notification.findUnique({
        where: { id: notification1.id },
      });
      const notif2After = await prisma.notification.findUnique({
        where: { id: notification2.id },
      });
      expect(notif1After).toBeNull();
      expect(notif2After).toBeNull();

      // Clean up
      await prisma.article.delete({ where: { id: article.id } });
      await prisma.filter.delete({ where: { id: filter.id } });
      await prisma.category.delete({ where: { id: category.id } });
    });

    it('should handle cascade deletion when filter is deleted (filter -> match -> notification)', async () => {
      // Test the full cascade chain: deleting a filter should cascade to matches,
      // which should cascade to notifications

      // 1. Create a test user
      const dealHunter = await createAuthenticatedDealHunter(app, prisma);

      // 2. Create category
      const category = await createTestCategory(prisma, {
        name: 'Full Cascade Test',
        slug: 'full-cascade-test',
      });

      // 3. Create filter
      const filterResponse = await request(app.getHttpServer())
        .post('/filters')
        .set('Authorization', `Bearer ${dealHunter.token}`)
        .send({
          name: 'Filter to Delete',
          active: true,
          filterExpression: {
            rules: [
              {
                field: 'currentPrice',
                operator: '<=',
                value: 200,
                weight: 1.0,
              },
            ],
          },
          categoryIds: [category.id],
        })
        .expect(201);

      const filterId = filterResponse.body.data.id;

      // 4. Create article
      const article = await prisma.article.create({
        data: {
          externalId: 'full-cascade-deal-001',
          title: 'Deal for Full Cascade Test',
          siteId: 'dealabs', // Required - Site created by createTestCategory
          categoryId: category.id,
          categoryPath: ['Test'],
          currentPrice: 150,
          url: 'https://example.com/deal3',
        },
      });

      // 5. Create match
      const match = await prisma.match.create({
        data: {
          filterId,
          articleId: article.id,
          score: 0.9,
          notified: true,
          notifiedAt: new Date(),
        },
      });

      // 6. Create notification linked to match
      const notification = await prisma.notification.create({
        data: {
          userId: dealHunter.id,
          matchId: match.id,
          type: 'DEAL_MATCH',
          subject: 'Full Cascade Test Notification',
          content: {
            type: 'DEAL_MATCH',
            title: 'Deal for Full Cascade Test',
            message: 'Testing full cascade chain',
          },
          sent: true,
          sentAt: new Date(),
        },
      });

      // 7. Verify everything exists
      const matchBefore = await prisma.match.findUnique({
        where: { id: match.id },
      });
      const notificationBefore = await prisma.notification.findUnique({
        where: { id: notification.id },
      });
      expect(matchBefore).not.toBeNull();
      expect(notificationBefore).not.toBeNull();

      // 8. Delete the filter (via API endpoint)
      await request(app.getHttpServer())
        .delete(`/filters/${filterId}`)
        .set('Authorization', `Bearer ${dealHunter.token}`)
        .expect(200);

      // 9. Verify match was cascade deleted
      const matchAfter = await prisma.match.findUnique({
        where: { id: match.id },
      });
      expect(matchAfter).toBeNull();

      // 10. Verify notification was also cascade deleted (through match deletion)
      const notificationAfter = await prisma.notification.findUnique({
        where: { id: notification.id },
      });
      expect(notificationAfter).toBeNull();

      // Clean up
      await prisma.article.delete({ where: { id: article.id } });
      await prisma.category.delete({ where: { id: category.id } });
    });
  });
});
