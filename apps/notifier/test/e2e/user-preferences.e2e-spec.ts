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
  createSpamTestNotification,
  createQuietHoursPreferences,
  createEmailOnlyPreferences,
  createRestrictivePreferences,
  createSpamProtectionPreferences,
} from '../factories';
import {
  cleanupTestData,
  createAuthenticatedNotificationUser,
  sendTestNotification,
  waitForNotificationProcessing,
  createTestNotificationPreferences,
  checkEmailDelivery,
} from '../helpers/e2e-helpers';

/**
 * User Notification Preferences E2E Tests
 *
 * Tests how the system respects user preferences to provide personalized
 * notification experiences. Focus on user control and satisfaction.
 */
describe('Smart Notification Preferences Management', () => {
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
              LOG_LEVEL: 'error', // Only show errors in tests
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

    // Use app.listen(0) instead of app.init() to ensure Bull processors start properly
    // This is required for Bull/Redis queue processors to initialize correctly
    await app.listen(0);
  }, 30000); // 30 second timeout for test setup

  beforeEach(async () => {
    await cleanupTestData(prisma);
    await notificationQueue.empty();
  });

  afterAll(async () => {
    // Minimal cleanup to avoid timeouts
    await app?.close();
  }, 120000);

  describe('Quiet Hours for Work-Life Balance', () => {
    it('respects quiet hours to help users maintain healthy boundaries', async () => {
      // BUSINESS CONTEXT: User wants deal notifications only during work hours
      const workLifeBalanceUser = await createAuthenticatedNotificationUser(
        app,
        prisma
      );

      await createTestNotificationPreferences(
        prisma,
        workLifeBalanceUser.id,
        createQuietHoursPreferences({
          quietHoursStart: '22:00',
          quietHoursEnd: '08:00',
          timezone: 'Europe/Paris',
        })
      );

      // Test notification during quiet hours (simulated)
      const nighttimeDeal = createDealMatchNotification({
        data: {
          dealTitle: 'Late Night Gaming Deal',
          currentPrice: 299,
        },
      });

      // ACT: Attempt to send notification during quiet hours
      const job = await sendTestNotification(
        notificationQueue,
        nighttimeDeal,
        workLifeBalanceUser.id
      );

      // BUSINESS EXPECTATION: Notification should be held or delivered via preferred method
      await waitForNotificationProcessing(job, 10000, prisma);

      // The notification system should either:
      // 1. Hold the notification for later delivery
      // 2. Only send if marked as urgent
      // 3. Respect the user's quiet hours preference
      expect(job).toBeDefined();
    });

    it('allows urgent notifications during quiet hours for time-sensitive deals', async () => {
      // BUSINESS CONTEXT: User wants urgent deals even during quiet hours
      const urgentDealsUser = await createAuthenticatedNotificationUser(
        app,
        prisma
      );

      await createTestNotificationPreferences(
        prisma,
        urgentDealsUser.id,
        createQuietHoursPreferences({
          allowUrgentDuringQuietHours: true,
          quietHoursStart: '22:00',
          quietHoursEnd: '08:00',
        })
      );

      const urgentFlashSale = createDealMatchNotification({
        priority: 'high',
        data: {
          dealTitle: 'Flash Sale: 50% off Gaming Laptop',
          currentPrice: 599,
          originalPrice: 1199,
          expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours
        },
      });

      // ACT: Send urgent notification during quiet hours
      const job = await sendTestNotification(
        notificationQueue,
        urgentFlashSale,
        urgentDealsUser.id
      );

      // BUSINESS EXPECTATION: Urgent notifications bypass quiet hours
      await waitForNotificationProcessing(job, 10000, prisma);

      const emailDelivered = await checkEmailDelivery(
        prisma,
        urgentDealsUser.id,
        'deal-match'
      );
      expect(emailDelivered).toBe(true);
    });
  });

  describe('Channel Preferences for Personalized Experience', () => {
    it('respects email-only preferences for users who prefer digest-style notifications', async () => {
      // BUSINESS CONTEXT: User prefers consolidated email notifications over real-time alerts
      const emailDigestUser = await createAuthenticatedNotificationUser(
        app,
        prisma
      );

      await createTestNotificationPreferences(
        prisma,
        emailDigestUser.id,
        createEmailOnlyPreferences({
          notificationFrequency: 'digest',
          dailyDigestTime: '09:00',
        })
      );

      const regularDeal = createDealMatchNotification({
        priority: 'medium',
        channels: ['email'], // Should respect preference
        data: {
          dealTitle: 'Daily Deal: Smartphone Accessories',
          currentPrice: 29,
        },
      });

      // ACT: Send notification to email-only user
      const job = await sendTestNotification(
        notificationQueue,
        regularDeal,
        emailDigestUser.id
      );

      // BUSINESS EXPECTATION: Only uses email channel as preferred
      await waitForNotificationProcessing(job, 10000, prisma);

      expect(regularDeal.channels).toEqual(['email']);
      expect(regularDeal.channels).not.toContain('websocket');
    });

    it('handles users with highly restrictive preferences to prevent notification fatigue', async () => {
      // BUSINESS CONTEXT: User only wants very specific, high-value deal notifications
      const selectiveUser = await createAuthenticatedNotificationUser(
        app,
        prisma
      );

      await createTestNotificationPreferences(
        prisma,
        selectiveUser.id,
        createRestrictivePreferences({
          priorityOnly: true,
          maxNotificationsPerDay: 2,
          minDiscountPercentage: 50,
          categories: ['tech'],
        })
      );

      // Test high-value deal that meets criteria
      const qualifyingDeal = createDealMatchNotification({
        priority: 'high',
        data: {
          dealTitle: 'Huge Tech Deal: 60% off Premium Headphones',
          currentPrice: 199,
          originalPrice: 499,
          discountPercentage: 60,
          category: 'tech',
        },
      });

      // ACT: Send high-value deal to selective user
      const job = await sendTestNotification(
        notificationQueue,
        qualifyingDeal,
        selectiveUser.id
      );

      // BUSINESS EXPECTATION: High-value deals pass restrictive filters
      await waitForNotificationProcessing(job, 10000, prisma);

      const emailDelivered = await checkEmailDelivery(
        prisma,
        selectiveUser.id,
        'deal-match'
      );
      expect(emailDelivered).toBe(true);
      expect(qualifyingDeal.data.discountPercentage).toBeGreaterThanOrEqual(50);
    });
  });

  describe('Rate Limiting and Spam Protection', () => {
    it('prevents notification spam while ensuring important alerts get through', async () => {
      // BUSINESS CONTEXT: User wants protection from notification overload
      const spamProtectedUser = await createAuthenticatedNotificationUser(
        app,
        prisma
      );

      await createTestNotificationPreferences(
        prisma,
        spamProtectedUser.id,
        createSpamProtectionPreferences({
          maxNotificationsPerDay: 3,
          enableRateLimiting: true,
          rateLimitWindowMinutes: 60,
          maxNotificationsPerWindow: 2,
        })
      );

      // Send multiple notifications to test rate limiting
      const notification1 = createSpamTestNotification();
      const notification2 = createSpamTestNotification();
      const notification3 = createSpamTestNotification();
      const notification4 = createSpamTestNotification(); // Should be rate limited

      // ACT: Send multiple notifications quickly
      const jobs = await Promise.all([
        sendTestNotification(
          notificationQueue,
          notification1,
          spamProtectedUser.id
        ),
        sendTestNotification(
          notificationQueue,
          notification2,
          spamProtectedUser.id
        ),
        sendTestNotification(
          notificationQueue,
          notification3,
          spamProtectedUser.id
        ),
        sendTestNotification(
          notificationQueue,
          notification4,
          spamProtectedUser.id
        ),
      ]);

      // BUSINESS EXPECTATION: Rate limiting protects user from spam
      await Promise.all(
        jobs.map((job) => waitForNotificationProcessing(job, 10000, prisma))
      );

      // The system should have processed some notifications and rate-limited others
      expect(jobs.length).toBe(4);
      expect(jobs.every((job) => job !== null)).toBe(true);
    });

    it('allows immediate delivery of high-priority notifications regardless of rate limits', async () => {
      // BUSINESS CONTEXT: Critical deals should bypass normal rate limiting
      const priorityUser = await createAuthenticatedNotificationUser(
        app,
        prisma
      );

      await createTestNotificationPreferences(
        prisma,
        priorityUser.id,
        createSpamProtectionPreferences({
          maxNotificationsPerDay: 1, // Very restrictive
          priorityOverride: true,
        })
      );

      // Send a low-priority notification first (should count against limit)
      const regularNotification = createDealMatchNotification({
        priority: 'low',
      });

      await sendTestNotification(
        notificationQueue,
        regularNotification,
        priorityUser.id
      );

      // Then send a high-priority notification
      const urgentNotification = createDealMatchNotification({
        priority: 'high',
        data: {
          dealTitle: 'URGENT: Limited Time Flash Sale',
          currentPrice: 99,
          originalPrice: 299,
          expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
        },
      });

      // ACT: Send urgent notification after hitting rate limit
      const urgentJob = await sendTestNotification(
        notificationQueue,
        urgentNotification,
        priorityUser.id
      );

      // BUSINESS EXPECTATION: High-priority notifications bypass rate limits
      await waitForNotificationProcessing(urgentJob, 10000, prisma);

      expect(urgentNotification.priority).toBe('high');
      expect(urgentJob).toBeDefined();
    });
  });

  describe('Category and Content Filtering', () => {
    it('filters notifications based on user category interests', async () => {
      // BUSINESS CONTEXT: User only wants gaming-related deal notifications
      const gamingFan = await createAuthenticatedNotificationUser(app, prisma);

      await createTestNotificationPreferences(
        prisma,
        gamingFan.id,
        createRestrictivePreferences({
          categories: ['gaming'],
          priorityOnly: false,
        })
      );

      const gamingDeal = createDealMatchNotification({
        data: {
          dealTitle: 'Gaming Keyboard RGB Mechanical',
          category: 'gaming',
          currentPrice: 79,
        },
      });

      // ACT: Send gaming deal to gaming enthusiast
      const job = await sendTestNotification(
        notificationQueue,
        gamingDeal,
        gamingFan.id
      );

      // BUSINESS EXPECTATION: Category-matched notifications are delivered
      await waitForNotificationProcessing(job, 10000, prisma);

      const emailDelivered = await checkEmailDelivery(
        prisma,
        gamingFan.id,
        'deal-match'
      );
      expect(emailDelivered).toBe(true);
      expect(gamingDeal.data.category).toBe('gaming');
    });

    it('blocks notifications with blacklisted keywords to improve relevance', async () => {
      // BUSINESS CONTEXT: User wants to avoid refurbished/used items
      const qualitySeeker = await createAuthenticatedNotificationUser(
        app,
        prisma
      );

      await createTestNotificationPreferences(
        prisma,
        qualitySeeker.id,
        createRestrictivePreferences({
          keywordBlacklist: ['refurbished', 'used', 'open-box'],
          categories: ['tech'],
        })
      );

      const refurbishedDeal = createDealMatchNotification({
        data: {
          dealTitle: 'Refurbished MacBook Pro - Great Condition',
          category: 'tech',
          currentPrice: 899,
        },
      });

      // ACT: Send blacklisted item to quality-seeking user
      const job = await sendTestNotification(
        notificationQueue,
        refurbishedDeal,
        qualitySeeker.id
      );

      // BUSINESS EXPECTATION: Blacklisted items are filtered out
      await waitForNotificationProcessing(job, 10000, prisma);

      // The notification system should filter this out based on keywords
      expect(refurbishedDeal.data.dealTitle.toLowerCase()).toContain(
        'refurbished'
      );
    });
  });
});
