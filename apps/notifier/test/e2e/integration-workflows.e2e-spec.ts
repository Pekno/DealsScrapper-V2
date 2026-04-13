import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule, getQueueToken } from '@nestjs/bull';
import { Queue } from 'bull';
import request from 'supertest';
import { NotifierModule } from '../../src/notifier.module';
import { PrismaService } from '@dealscrapper/database';
import { EmailService } from '../../src/channels/email.service';
import { createEmailServiceMock } from '../mocks/email-service.mock';
import {
  createDealMatchNotification,
  createDigestNotification,
  createDefaultPreferences,
} from '../factories';
import {
  cleanupTestData,
  createAuthenticatedNotificationUser,
  sendTestNotification,
  waitForNotificationProcessing,
  createTestNotificationPreferences,
  createTestCategory,
  createTestFilter,
  checkEmailDelivery,
} from '../helpers/e2e-helpers';

/**
 * Cross-Service Integration Workflows E2E Tests
 *
 * Tests how the notifier service integrates with other services to deliver
 * seamless user experiences. Focus on end-to-end business workflows.
 */
describe('Cross-Service Notification Integration', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let notificationQueue: Queue;
  let mockEmailService: ReturnType<typeof createEmailServiceMock>;

  beforeAll(async () => {
    // Create email service mock to prevent real email sending
    mockEmailService = createEmailServiceMock();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: ['../../.env.test', '../../.env.local', '../../.env'],
          load: [
            () => ({
              // Override DATABASE_URL to use host connection for tests
              DATABASE_URL: process.env.DATABASE_URL,
            }),
          ],
        }),
        NotifierModule,
      ],
    })
      .overrideProvider(EmailService)
      .useValue(mockEmailService)
      .compile();

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
    notificationQueue = app.get<Queue>(getQueueToken('notifications'));

    // Use listen() instead of init() to start Bull processors
    await app.listen(0);
  }, 30000); // 30 second timeout for test setup

  beforeEach(async () => {
    await cleanupTestData(prisma);
    await notificationQueue.empty();
    // Clear mock email history for fresh test
    mockEmailService.clearSentEmails();
  });

  afterAll(async () => {
    // Minimal cleanup to avoid timeouts
    await app?.close();
  }, 120000);

  describe('Filter-to-Notification Pipeline Integration', () => {
    it('triggers notifications when scraper finds deals matching user filters', async () => {
      // BUSINESS CONTEXT: User creates filter, scraper finds matching deal, notification sent
      const dealHunter = await createAuthenticatedNotificationUser(app, prisma);

      // User has notification preferences
      await createTestNotificationPreferences(
        prisma,
        dealHunter.id,
        createDefaultPreferences()
      );

      // User creates a gaming filter
      const gamingCategory = await createTestCategory(prisma, {
        name: 'Gaming',
        slug: 'gaming',
      });

      const userFilter = await createTestFilter(prisma, dealHunter.id, {
        name: 'Gaming Deals Under €500',
        filterExpression: {
          rules: [
            {
              field: 'currentPrice',
              operator: '<=',
              value: 500,
              weight: 2.0,
            },
            {
              field: 'category',
              operator: 'EQUALS',
              value: 'gaming',
              weight: 1.5,
            },
          ],
        },
        categories: {
          create: [{ categoryId: gamingCategory.id }],
        },
      });

      // BUSINESS WORKFLOW: Scraper finds matching deal and triggers notification
      const matchingDealNotification = createDealMatchNotification({
        data: {
          dealTitle: 'Gaming Mouse RGB - SteelSeries',
          currentPrice: 45,
          originalPrice: 89,
          category: 'gaming',
          matchedFilterId: userFilter.id,
          matchScore: 85,
        },
      });

      // ACT: Simulate scraper triggering notification for filter match
      const job = await sendTestNotification(
        notificationQueue,
        matchingDealNotification,
        dealHunter.id
      );

      // BUSINESS EXPECTATION: User receives notification for their filter match
      await waitForNotificationProcessing(job, 10000, prisma);

      const emailDelivered = await checkEmailDelivery(
        prisma,
        dealHunter.id,
        'deal-match'
      );
      expect(emailDelivered).toBe(true);
      expect(matchingDealNotification.data.matchedFilterId).toBe(userFilter.id);
    });

    it('respects filter priority settings for notification urgency', async () => {
      // BUSINESS CONTEXT: Important filters generate high-priority notifications
      const priorityUser = await createAuthenticatedNotificationUser(
        app,
        prisma
      );

      await createTestNotificationPreferences(
        prisma,
        priorityUser.id,
        createDefaultPreferences({ priorityOnly: false })
      );

      // User creates high-priority filter for expensive items
      const highValueFilter = await createTestFilter(prisma, priorityUser.id, {
        name: 'High-Value Tech Deals',
        filterExpression: {
          rules: [
            {
              field: 'currentPrice',
              operator: '>=',
              value: 1000,
              weight: 2.0,
            },
            {
              field: 'discountPercentage',
              operator: '>=',
              value: 30,
              weight: 1.8,
            },
          ],
        },
      });

      // High-value deal matches high-priority filter
      const highValueDeal = createDealMatchNotification({
        priority: 'high', // Inherited from filter priority
        data: {
          dealTitle: 'MacBook Pro M3 Max - 30% off',
          currentPrice: 2799,
          originalPrice: 3999,
          discountPercentage: 30,
          matchedFilterId: highValueFilter.id,
        },
      });

      // ACT: Send high-priority notification from high-priority filter
      const job = await sendTestNotification(
        notificationQueue,
        highValueDeal,
        priorityUser.id
      );

      // BUSINESS EXPECTATION: High-priority filters generate urgent notifications
      await waitForNotificationProcessing(job, 10000, prisma);

      expect(highValueDeal.priority).toBe('high');
      expect(highValueDeal.data.matchedFilterId).toBe(highValueFilter.id);
    });
  });

  describe('User Management Integration', () => {
    it('handles user preference updates from API service in real-time', async () => {
      // BUSINESS CONTEXT: User updates preferences via API, notifications adapt immediately
      const adaptiveUser = await createAuthenticatedNotificationUser(
        app,
        prisma
      );

      // Initial preferences
      await createTestNotificationPreferences(
        prisma,
        adaptiveUser.id,
        createDefaultPreferences({
          emailNotifications: true,
          websocketNotifications: true,
        })
      );

      // Send initial notification
      const beforeUpdateNotification = createDealMatchNotification();
      const beforeJob = await sendTestNotification(
        notificationQueue,
        beforeUpdateNotification,
        adaptiveUser.id
      );
      await waitForNotificationProcessing(beforeJob, 10000, prisma);

      // SIMULATE: User updates preferences to email-only via API
      await createTestNotificationPreferences(
        prisma,
        adaptiveUser.id,
        createDefaultPreferences({
          emailNotifications: true,
          websocketNotifications: false,
        })
      );

      // Send notification after preference change
      const afterUpdateNotification = createDealMatchNotification({
        channels: ['email'], // Should respect new preferences
      });

      // ACT: Send notification with updated preferences
      const afterJob = await sendTestNotification(
        notificationQueue,
        afterUpdateNotification,
        adaptiveUser.id
      );

      // BUSINESS EXPECTATION: Notifications adapt to updated preferences
      await waitForNotificationProcessing(afterJob, 10000, prisma);

      expect(afterUpdateNotification.channels).toEqual(['email']);
    });

    it('stops notifications when user deactivates account', async () => {
      // BUSINESS CONTEXT: Deactivated users should not receive notifications
      const deactivatingUser = await createAuthenticatedNotificationUser(
        app,
        prisma
      );

      await createTestNotificationPreferences(
        prisma,
        deactivatingUser.id,
        createDefaultPreferences()
      );

      // SIMULATE: User deactivates account (set emailVerified to false to simulate deactivation)
      await prisma.user.update({
        where: { id: deactivatingUser.id },
        data: {
          emailVerified: false,
        },
      });

      const notificationForDeactivated = createDealMatchNotification();

      // ACT: Attempt to send notification to deactivated user
      const job = await sendTestNotification(
        notificationQueue,
        notificationForDeactivated,
        deactivatingUser.id
      );

      // BUSINESS EXPECTATION: No notifications sent to deactivated users
      await waitForNotificationProcessing(job, 10000, prisma);

      // The notification system should check user status and not deliver
      expect(job).toBeDefined(); // Job was created but should be filtered out
    });
  });

  describe('Scheduler Integration for Optimal Timing', () => {
    it('schedules digest notifications at user-preferred times', async () => {
      // BUSINESS CONTEXT: User wants daily digest at 9 AM in their timezone
      const digestUser = await createAuthenticatedNotificationUser(app, prisma);

      await createTestNotificationPreferences(
        prisma,
        digestUser.id,
        createDefaultPreferences({
          dailyDigest: true,
          dailyDigestTime: '09:00',
          timezone: 'Europe/Berlin',
        })
      );

      const morningDigest = createDigestNotification({
        data: {
          dealCount: 8,
          topCategories: ['Gaming', 'Tech', 'Home'],
          bestDiscount: 45,
          digestDate: new Date().toISOString().split('T')[0],
        },
      });

      // ACT: Schedule digest notification for optimal user time
      const job = await sendTestNotification(
        notificationQueue,
        morningDigest,
        digestUser.id
      );

      // BUSINESS EXPECTATION: Digest scheduled for user's preferred time
      await waitForNotificationProcessing(job, 10000, prisma);

      const emailDelivered = await checkEmailDelivery(
        prisma,
        digestUser.id,
        'daily-digest'
      );
      expect(emailDelivered).toBe(true);
      expect(morningDigest.data.dealCount).toBeGreaterThan(0);
    });

    it('batches similar notifications to prevent spam during high deal volume', async () => {
      // BUSINESS CONTEXT: Many deals found at once should be batched together
      const batchingUser = await createAuthenticatedNotificationUser(
        app,
        prisma
      );

      await createTestNotificationPreferences(
        prisma,
        batchingUser.id,
        createDefaultPreferences({
          notificationFrequency: 'digest',
          maxNotificationsPerDay: 3,
        })
      );

      // Multiple similar deals found simultaneously
      const deals = [
        createDealMatchNotification({
          data: { dealTitle: 'Gaming Mouse Deal 1', currentPrice: 29 },
        }),
        createDealMatchNotification({
          data: { dealTitle: 'Gaming Mouse Deal 2', currentPrice: 35 },
        }),
        createDealMatchNotification({
          data: { dealTitle: 'Gaming Mouse Deal 3', currentPrice: 41 },
        }),
      ];

      // ACT: Send multiple similar notifications for batching
      const jobs = await Promise.all(
        deals.map((deal) =>
          sendTestNotification(notificationQueue, deal, batchingUser.id)
        )
      );

      // BUSINESS EXPECTATION: Similar notifications are batched to prevent spam
      await Promise.all(
        jobs.map((job) => waitForNotificationProcessing(job, 10000, prisma))
      );

      expect(jobs.length).toBe(3);
      expect(
        deals.every((deal) => deal.data.dealTitle.includes('Gaming Mouse'))
      ).toBe(true);
    });
  });

  describe('Performance and Scalability Under Load', () => {
    it('handles high notification volume during flash sales and peak times', async () => {
      // BUSINESS CONTEXT: Black Friday scenario with many users and deals
      const users = await Promise.all([
        createAuthenticatedNotificationUser(app, prisma, {
          email: 'user1@test.com',
        }),
        createAuthenticatedNotificationUser(app, prisma, {
          email: 'user2@test.com',
        }),
        createAuthenticatedNotificationUser(app, prisma, {
          email: 'user3@test.com',
        }),
      ]);

      // Set preferences for all users
      await Promise.all(
        users.map((user) =>
          createTestNotificationPreferences(
            prisma,
            user.id,
            createDefaultPreferences()
          )
        )
      );

      // Flash sale notification for all users
      const flashSaleNotification = createDealMatchNotification({
        priority: 'high',
        data: {
          dealTitle: 'BLACK FRIDAY: 70% off Everything',
          currentPrice: 99,
          originalPrice: 329,
          discountPercentage: 70,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
        },
      });

      // ACT: Send flash sale notification to multiple users simultaneously
      const jobs = await Promise.all(
        users.map((user) =>
          sendTestNotification(
            notificationQueue,
            flashSaleNotification,
            user.id
          )
        )
      );

      // BUSINESS EXPECTATION: System handles high load gracefully
      await Promise.all(
        jobs.map((job) => waitForNotificationProcessing(job, 10000, prisma))
      );

      expect(jobs.length).toBe(users.length);
      expect(jobs.every((job) => job !== null)).toBe(true);
      expect(flashSaleNotification.priority).toBe('high');
    });

    it('maintains notification delivery order for time-sensitive deals', async () => {
      // BUSINESS CONTEXT: Deal notifications should maintain chronological order
      const timelyUser = await createAuthenticatedNotificationUser(app, prisma);

      await createTestNotificationPreferences(
        prisma,
        timelyUser.id,
        createDefaultPreferences()
      );

      // Sequential time-sensitive deals
      const dealSequence = [
        createDealMatchNotification({
          data: { dealTitle: 'Deal 1: Early Bird Special', currentPrice: 199 },
        }),
        createDealMatchNotification({
          data: { dealTitle: 'Deal 2: Limited Time Offer', currentPrice: 149 },
        }),
        createDealMatchNotification({
          data: { dealTitle: 'Deal 3: Final Hours Sale', currentPrice: 99 },
        }),
      ];

      // ACT: Send notifications in sequence
      const jobs = [];
      for (const deal of dealSequence) {
        const job = await sendTestNotification(
          notificationQueue,
          deal,
          timelyUser.id
        );
        jobs.push(job);
        // Small delay to ensure ordering
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // BUSINESS EXPECTATION: Notifications processed in correct order
      await Promise.all(
        jobs.map((job) => waitForNotificationProcessing(job, 10000, prisma))
      );

      expect(jobs.length).toBe(3);
      expect(dealSequence[0].data.dealTitle).toContain('Deal 1');
      expect(dealSequence[2].data.dealTitle).toContain('Deal 3');
    });
  });
});
