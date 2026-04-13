import { Processor, Process, OnQueueActive, OnQueueCompleted, OnQueueFailed, OnQueueError } from '@nestjs/bull';
import { createServiceLogger } from '@dealscrapper/shared-logging';
import { UnifiedNotificationPayload, SiteSource } from '@dealscrapper/shared-types';
import type { Job } from 'bull';
import { PrismaService } from '@dealscrapper/database';
import { NotificationGateway } from '../websocket/notification.gateway.js';
import { extractErrorMessage } from '../utils/error-handling.utils.js';
import { UserStatusService } from '../services/user-status.service.js';
import {
  NotificationPreferencesService,
  NotificationContext,
} from '../services/notification-preferences.service.js';
import { DeliveryTrackingService } from '../services/delivery-tracking.service.js';
import { EmailService } from '../channels/email.service.js';
import { TemplateService } from '../templates/template.service.js';
import { ChannelHealthService } from '../services/channel-health.service.js';
import { notifierLogConfig } from '../config/logging.config.js';
import { deserializeNotificationPayloadOrNull } from '../utils/json-deserializer.utils.js';

import { withErrorHandling } from '../utils/error-handling.utils.js';

/**
 * TODO: Add dedicated unit tests for NotificationProcessor
 *
 * Priority: Medium
 * Impact: Core notification delivery logic is not directly tested
 *
 * Recommended test coverage:
 * - processNotification: job processing with valid/invalid payloads
 * - retryNotification: retry logic with different delivery states
 * - sendViaChannels: channel selection and fallback behavior
 * - shouldSendEmail: email eligibility logic
 * - Queue event handlers (OnQueueActive, OnQueueCompleted, OnQueueFailed)
 *
 * Current mitigation: Integration tests cover end-to-end flows
 * See: apps/notifier/test/unit/ for related service tests
 */

export interface DealMatchNotificationData {
  matchId: string;
  userId: string;
  filterId: string;
  dealData: {
    title: string;
    price: number;
    url: string;
    imageUrl?: string;
    score: number;
    merchant: string;
    temperature?: number;
    discountPercentage?: number;
    originalPrice?: number;
    // Site identification (REQUIRED for multi-site support)
    siteId: SiteSource;
    // Site-specific fields (Vinted)
    brand?: string;
    // Site-specific fields (LeBonCoin)
    city?: string;
    sellerName?: string;
  };
  priority: 'high' | 'normal' | 'low';
  timestamp: Date;
}

/**
 * Email verification notification data structure
 */
export interface EmailVerificationNotificationData {
  readonly userId: string;
  readonly email: string;
  readonly token: string;
  readonly verificationUrl: string;
  readonly type: 'verification';
  readonly timestamp: Date;
}

export interface PasswordResetNotificationData {
  readonly userId: string;
  readonly email: string;
  readonly resetUrl: string;
  readonly timestamp: Date;
  readonly expiresIn?: string;
}

interface ProcessorNotificationContext {
  isOnline: boolean;
  isActive: boolean;
  deviceType: 'web' | 'mobile';
  lastActivity: Date;
  preferences: {
    email?: boolean;
    inApp?: boolean;
    frequency?: string;
    quietHours?: {
      enabled: boolean;
      start: string;
      end: string;
    };
  };
  priority: string;
  timeOfDay: number;
  isQuietHours: boolean;
}

@Processor('notifications')
export class NotificationProcessor {
  private readonly logger = createServiceLogger(notifierLogConfig);

  constructor(
    private readonly websocketGateway: NotificationGateway,
    private readonly userStatusService: UserStatusService,
    private readonly notificationPreferencesService: NotificationPreferencesService,
    private readonly deliveryTracking: DeliveryTrackingService,
    private readonly emailService: EmailService,
    private readonly templateService: TemplateService,
    private readonly channelHealthService: ChannelHealthService,
    private readonly prisma: PrismaService
  ) {
    this.logger.log('NotificationProcessor initialized');
  }

  /**
   * Process deal match notifications with unified payload structure
   * Builds the complete notification payload once and stores it in the database
   */
  @Process('deal-match-found')
  async handleDealMatch(job: Job<DealMatchNotificationData>) {
    const { userId, dealData, priority, matchId, filterId } = job.data;

    return withErrorHandling(
      this.logger,
      `processing deal match notification for user ${userId}`,
      async () => {
        this.logger.log(
          `🔔 Processing deal match notification for user ${userId}`
        );

        // 1. Get real-time user status from Redis
        const userStatus = await this.userStatusService.getUserStatus(userId);

        // 2. Build notification context for preferences check
        const notificationContext: NotificationContext = {
          userId,
          notificationType: 'deal-match',
          priority: priority as 'high' | 'normal' | 'low',
          score: dealData.score,
          dealData: {
            title: dealData.title,
            price: dealData.price,
            merchant: dealData.merchant,
            category: 'general',
          },
          userActivity: {
            isOnline: userStatus?.isOnline ?? false,
            isActive: userStatus?.isActive ?? false,
            lastActivity: userStatus?.lastActivity ?? new Date(0),
            deviceType: userStatus?.deviceType ?? 'web',
          },
        };

        // 3. Check if notification should be sent using preferences service
        const permissionResult =
          await this.notificationPreferencesService.shouldSendNotification(
            notificationContext
          );

        if (!permissionResult.allowed) {
          this.logger.debug(
            `❌ Notification blocked for user ${userId}: ${permissionResult.reason}`
          );
          return;
        }

        // 4. Get recommended channels from preferences service and validate with health service
        const preferredChannels = permissionResult.channels;

        if (preferredChannels.length === 0) {
          this.logger.debug(
            `❌ No suitable channels for user ${userId} at this time`
          );
          return;
        }

        // 4.1. Filter channels based on health status and get optimal delivery order
        const healthRecommendedChannels =
          await this.channelHealthService.getRecommendedChannels(
            userId,
            priority as 'high' | 'normal' | 'low',
            userStatus?.isOnline ?? false
          );

        // Intersect preferred channels with healthy channels
        const channels = preferredChannels.filter((channel) =>
          healthRecommendedChannels.includes(channel)
        );

        // If no healthy channels match preferences, use health recommendations for high priority
        if (channels.length === 0) {
          if (priority === 'high') {
            this.logger.warn(
              `⚠️ No healthy channels match preferences for ${userId}, using fallback channels`
            );
            const fallbackChannels = healthRecommendedChannels
              .slice(0, 2)
              .filter(
                (ch): ch is 'email' | 'websocket' =>
                  ch === 'email' || ch === 'websocket'
              );
            channels.push(...fallbackChannels);
          } else {
            this.logger.debug(
              `❌ No healthy channels available for user ${userId}`
            );
            return;
          }
        }

        this.logger.debug(
          `📋 Final channels for ${userId}: ${channels.join(', ')} (preferred: ${preferredChannels.join(', ')}, healthy: ${healthRecommendedChannels.join(', ')})`
        );

        // 5. Build complete unified notification payload (single source of truth)
        const discount = dealData.discountPercentage
          ? ` - ${Math.round(dealData.discountPercentage)}% off`
          : '';
        const priceInfo = dealData.price
          ? `€${dealData.price.toFixed(2)}${discount}`
          : 'Check deal';

        const unifiedNotificationPayload: UnifiedNotificationPayload = {
          id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
          siteId: dealData.siteId,
          type: 'DEAL_MATCH' as const,
          title: `🎯 New Deal: ${dealData.title}`,
          message: `${priceInfo} at ${dealData.merchant}`,
          matchId,
          filterId,
          data: {
            dealData: {
              title: dealData.title,
              price: dealData.price,
              originalPrice: dealData.originalPrice,
              discountPercentage: dealData.discountPercentage,
              merchant: dealData.merchant,
              imageUrl: dealData.imageUrl,
              url: dealData.url,
              temperature: dealData.temperature,
              score: dealData.score,
              // Site-specific fields nested under siteSpecific
              siteSpecific: {
                brand: dealData.brand,
                city: dealData.city,
                sellerName: dealData.sellerName,
              },
            },
          },
          timestamp: new Date().toISOString(),
          read: false,
        };

        // 6. Create delivery tracking record with unified payload
        const deliveryId = await this.deliveryTracking.createDelivery({
          userId,
          type: 'deal-match',
          priority: priority as 'high' | 'normal' | 'low',
          notificationPayload: unifiedNotificationPayload,
        });

        // 7. Send notifications via selected channels with delivery tracking
        const deliveryResults = await this.sendNotificationsWithTracking(
          deliveryId,
          userId,
          channels
        );

        // 8. Record notification sent for analytics
        await this.notificationPreferencesService.recordNotificationSent(
          userId,
          'deal-match',
          channels.join(',')
        );

        // 9. Log results
        const successfulChannels = Object.entries(deliveryResults)
          .filter(([_, success]) => success)
          .map(([channel, _]) => channel);

        if (successfulChannels.length > 0) {
          this.logger.log(
            `✅ Successfully sent notification to ${userId} via: ${successfulChannels.join(', ')} [${deliveryId}]`
          );
        } else {
          this.logger.warn(
            `❌ Failed to deliver notification to ${userId} via any channel [${deliveryId}]`
          );

          // Schedule retry for failed delivery
          await this.deliveryTracking.scheduleRetry(deliveryId, 1); // Retry in 1 minute
        }
      }
      // No fallback - throw error for BullMQ retry mechanism
    );
  }

  @Process('system-notification')
  async handleSystemNotification(job: Job<any>) {
    const { userId, subject, message, priority, type } = job.data;

    return withErrorHandling(
      this.logger,
      `processing system notification for user ${userId}`,
      async () => {
        this.logger.log(
          `📢 Processing system notification for user ${userId}: ${subject}`
        );

        // Build unified notification payload for system notification
        // System notifications use DEALABS as default siteId (not site-specific)
        const unifiedNotificationPayload: UnifiedNotificationPayload = {
          id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
          siteId: SiteSource.DEALABS, // Default for system notifications
          type: 'SYSTEM',
          title: subject || 'System Notification',
          message: message || 'You have a new system notification',
          data: {
            systemType: type,
          },
          timestamp: new Date().toISOString(),
          read: false,
        };

        // Create delivery tracking for system notifications
        const deliveryId = await this.deliveryTracking.createDelivery({
          userId,
          type: 'system',
          priority: (priority as 'high' | 'normal' | 'low') || 'normal',
          notificationPayload: unifiedNotificationPayload,
        });

        // Get user status to determine best delivery strategy
        const userStatus = await this.userStatusService.getUserStatus(userId);
        const isUserOnline = userStatus?.isOnline ?? false;

        // For system notifications, use different channel priority based on urgency
        const channels: Array<'websocket' | 'email'> = [];

        if (priority === 'high') {
          // High priority: try both channels regardless of user status
          channels.push(isUserOnline ? 'websocket' : 'email');
          channels.push(isUserOnline ? 'email' : 'websocket');
        } else {
          // Normal/Low priority: prefer WebSocket if online, email if offline
          channels.push(isUserOnline ? 'websocket' : 'email');
        }

        this.logger.debug(
          `📋 System notification channels for ${userId}: ${channels.join(' → ')} (priority: ${priority})`
        );

        const results: Record<string, boolean> = {};
        let notificationSent = false;

        for (const channel of channels) {
          try {
            const success = await this.sendSystemNotificationViaChannel(
              channel,
              userId,
              { subject, message, type, priority }
            );

            results[channel] = success;

            // Record delivery attempt
            await this.deliveryTracking.recordAttempt(
              deliveryId,
              channel,
              success ? 'delivered' : 'failed',
              success ? undefined : 'System notification delivery failed'
            );

            if (success) {
              notificationSent = true;
              this.logger.log(
                `✅ System notification sent via ${channel} to ${userId} [${deliveryId}]`
              );

              // For high priority notifications, continue to try other channels
              if (priority !== 'high') {
                break; // Stop after first successful delivery for normal priority
              }
            } else {
              this.logger.warn(
                `❌ System notification failed via ${channel} for ${userId}`
              );
            }
          } catch (error) {
            this.logger.error(
              `❌ ${channel} system notification failed for ${userId}:`,
              error
            );
            results[channel] = false;

            // Record failed attempt
            await this.deliveryTracking.recordAttempt(
              deliveryId,
              channel,
              'failed',
              extractErrorMessage(error)
            );
          }
        }

        if (!notificationSent) {
          this.logger.warn(
            `❌ System notification failed via all channels for ${userId} [${deliveryId}]`
          );

          // For high priority notifications, schedule retry
          if (priority === 'high') {
            await this.deliveryTracking.scheduleRetry(deliveryId, 5); // Retry in 5 minutes
            this.logger.log(
              `🔄 Scheduled retry for high priority system notification [${deliveryId}]`
            );
          }
        }
      }
    );
  }

  private async sendSystemNotificationViaChannel(
    channel: 'websocket' | 'email',
    userId: string,
    notificationData: {
      subject: string;
      message: string;
      type?: string;
      priority?: string;
    }
  ): Promise<boolean> {
    switch (channel) {
      case 'websocket':
        try {
          // Build unified payload for WebSocket system notification
          // System notifications use DEALABS as default siteId (not site-specific)
          const systemPayload: UnifiedNotificationPayload = {
            id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
            siteId: SiteSource.DEALABS, // Default for system notifications
            type: 'SYSTEM',
            title: notificationData.subject || 'System Notification',
            message: notificationData.message || 'You have a new system notification',
            data: {
              systemType: notificationData.type,
            },
            timestamp: new Date().toISOString(),
            read: false,
          };

          return await this.websocketGateway.sendToUser(userId, systemPayload);
        } catch (error) {
          this.logger.error(`🔌 WebSocket system notification error:`, error);
          return false;
        }

      case 'email':
        try {
          const preferences =
            await this.notificationPreferencesService.getUserPreferences(
              userId
            );
          const userEmail = preferences?.channels.email.address;

          if (!userEmail || !preferences?.channels.email.verified) {
            this.logger.debug(
              `📧 No verified email for system notification to ${userId}`
            );
            return false;
          }

          return await this.emailService.sendSystemNotification(
            userEmail,
            notificationData.subject || 'System Notification',
            notificationData.message,
            userId
          );
        } catch (error) {
          this.logger.error(`📧 Email system notification error:`, error);
          return false;
        }

      default:
        this.logger.warn(`Unknown system notification channel: ${channel}`);
        return false;
    }
  }

  @Process('retry-notification')
  async handleRetryNotification(job: Job<{ deliveryId: string }>) {
    const { deliveryId } = job.data;

    return withErrorHandling(
      this.logger,
      `processing notification retry for delivery ${deliveryId}`,
      async () => {
        this.logger.log(
          `🔄 Processing notification retry for delivery ${deliveryId}`
        );

        const delivery = await this.deliveryTracking.getDelivery(deliveryId);
        if (!delivery) {
          this.logger.warn(`Delivery ${deliveryId} not found for retry`);
          return;
        }

        // Check if we should still retry
        if (delivery.finalStatus !== 'pending' || delivery.attempts.length >= 3) {
          this.logger.debug(
            `Delivery ${deliveryId} cannot be retried (status: ${delivery.finalStatus}, attempts: ${delivery.attempts.length})`
          );
          return;
        }

        // Get unified payload from delivery (already properly typed)
        const unifiedPayload = delivery.notificationPayload;

        if (!unifiedPayload) {
          this.logger.error(
            `❌ Delivery ${deliveryId} has no notification payload, cannot retry`
          );
          return;
        }

        // Get user context again for retry
        const userStatus = await this.userStatusService.getUserStatus(
          delivery.userId
        );

        // Build notification context for preferences check using unified payload data
        const dealData = unifiedPayload.data?.dealData;
        const retryContext: NotificationContext = {
          userId: delivery.userId,
          notificationType: 'deal-match', // Most retries are for deal matches
          priority: delivery.priority as 'high' | 'normal' | 'low',
          dealData: {
            title: dealData?.title || 'Deal Alert',
            price: dealData?.price || 0,
            merchant: dealData?.merchant || 'Unknown',
            category: 'general',
          },
          userActivity: {
            isOnline: userStatus?.isOnline ?? false,
            isActive: userStatus?.isActive ?? false,
            lastActivity: userStatus?.lastActivity ?? new Date(0),
            deviceType: userStatus?.deviceType ?? 'web',
          },
        };

        // Check if notification should be sent for retry
        const permissionResult =
          await this.notificationPreferencesService.shouldSendNotification(
            retryContext
          );

        if (!permissionResult.allowed) {
          this.logger.debug(
            `❌ Retry blocked for delivery ${deliveryId}: ${permissionResult.reason}`
          );
          return;
        }

        const channels = permissionResult.channels;

        if (channels.length === 0) {
          this.logger.debug(
            `No suitable channels for retry of delivery ${deliveryId}`
          );
          return;
        }

        // Retry sending using existing delivery ID (which has the unified payload stored)
        const deliveryResults = await this.sendNotificationsWithTracking(
          deliveryId,
          delivery.userId,
          [...channels] // Convert readonly array to mutable array
        );

        const successfulChannels = Object.entries(deliveryResults)
          .filter(([_, success]) => success)
          .map(([channel, _]) => channel);

        if (successfulChannels.length > 0) {
          this.logger.log(
            `✅ Retry successful for delivery ${deliveryId} via: ${successfulChannels.join(', ')}`
          );
        } else {
          this.logger.warn(`❌ Retry failed for delivery ${deliveryId}`);
        }
      }
    );
  }

  @Process('digest-notification')
  async handleDigestNotification(job: Job<any>) {
    const { userId, matches, frequency } = job.data;

    return withErrorHandling(
      this.logger,
      `processing ${frequency} digest notification for user ${userId}`,
      async () => {
        this.logger.log(
          `📊 Processing ${frequency} digest for user ${userId} with ${matches.length} matches`
        );

        if (matches.length === 0) {
          this.logger.debug(`No matches to include in digest for user ${userId}`);
          return;
        }

        // Get user preferences and email
        const emailPreferences =
          await this.notificationPreferencesService.getUserPreferences(userId);
        const userEmail = emailPreferences?.channels.email.address;

        if (!userEmail || !emailPreferences?.channels.email.verified) {
          this.logger.debug(`📧 No verified email for digest for user ${userId}`);
          return;
        }

        // Check if user wants digest emails
        if (!emailPreferences.categories.digest) {
          this.logger.debug(`📧 Digest emails disabled for user ${userId}`);
          return;
        }

        // Transform matches for email template
        interface EmailMatch {
          article?: { title?: string; currentPrice?: number; url?: string; merchant?: string };
          dealData?: { title?: string; price?: number; url?: string; merchant?: string };
          score?: number;
          filter?: { name?: string };
        }

        const emailMatches = matches.map((match: EmailMatch) => ({
          title: match.article?.title || match.dealData?.title || 'Deal Alert',
          price: match.article?.currentPrice || match.dealData?.price || 0,
          url: match.article?.url || match.dealData?.url || '#',
          score: match.score || 0,
          merchant:
            match.article?.merchant || match.dealData?.merchant || 'Unknown',
          filterName: match.filter?.name || 'Deal Filter',
        }));

        // Send digest email
        const success = await this.emailService.sendDigestEmail(
          userEmail,
          emailMatches,
          frequency as 'daily' | 'weekly',
          userId
        );

        if (success) {
          this.logger.log(`✅ ${frequency} digest email sent to user ${userId}`);
        } else {
          this.logger.error(
            `❌ Failed to send ${frequency} digest email to user ${userId}`
          );
          throw new Error('Digest email sending failed');
        }
      }
    );
  }

  /**
   * Processes email verification notifications with high priority delivery
   * @param job - Email verification job containing user and verification data
   */
  @Process('email-verification')
  async handleEmailVerification(job: Job<EmailVerificationNotificationData>) {
    const { userId, email, verificationUrl, timestamp } = job.data;

    return withErrorHandling(
      this.logger,
      `processing email verification for user ${userId}`,
      async () => {
        this.logger.log(
          `Processing email verification for user ${userId} (${email})`
        );

        // Build unified notification payload for email verification
        // System notifications use DEALABS as default siteId (not site-specific)
        const requestedAt = timestamp instanceof Date ? timestamp.toISOString() : timestamp;

        const unifiedNotificationPayload: UnifiedNotificationPayload = {
          id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
          siteId: SiteSource.DEALABS, // Default for system notifications
          type: 'SYSTEM',
          title: 'Verify your email address',
          message: 'Please click the link in your email to verify your account',
          data: {
            email,
            verificationUrl,
            requestedAt,
          },
          timestamp: new Date().toISOString(),
          read: false,
        };

        // Create delivery tracking for verification email
        const deliveryId = await this.deliveryTracking.createDelivery({
          userId,
          type: 'verification',
          priority: 'high',
          notificationPayload: unifiedNotificationPayload,
        });

        // Attempt email delivery with retry logic
        let emailSent = false;
        const maxRetries = 3;
        let attemptCount = 0;

        while (!emailSent && attemptCount < maxRetries) {
          attemptCount++;

          try {
            this.logger.debug(
              `Email verification attempt ${attemptCount}/${maxRetries} for ${email}`
            );

            emailSent = await this.emailService.sendEmailVerification(
              email,
              verificationUrl,
              userId
            );

            // Record delivery attempt
            await this.deliveryTracking.recordAttempt(
              deliveryId,
              'email',
              emailSent ? 'delivered' : 'failed',
              emailSent ? undefined : `Delivery attempt ${attemptCount} failed`
            );

            if (emailSent) {
              this.logger.log(
                `Email verification sent successfully to ${email} [${deliveryId}]`
              );
              break;
            } else {
              this.logger.warn(
                `Email verification attempt ${attemptCount} failed for ${email}`
              );

              // Exponential backoff for retries
              if (attemptCount < maxRetries) {
                const backoffDelay = Math.pow(2, attemptCount) * 1000; // 2s, 4s, 8s
                await new Promise((resolve) => setTimeout(resolve, backoffDelay));
              }
            }
          } catch (attemptError) {
            this.logger.error(
              `Email verification attempt ${attemptCount} error for ${email}:`,
              attemptError
            );

            // Record failed attempt with error details
            await this.deliveryTracking.recordAttempt(
              deliveryId,
              'email',
              'failed',
              attemptError instanceof Error
                ? attemptError.message
                : 'Unknown error'
            );

            if (attemptCount >= maxRetries) {
              throw attemptError;
            }

            // Exponential backoff for retries
            const backoffDelay = Math.pow(2, attemptCount) * 1000;
            await new Promise((resolve) => setTimeout(resolve, backoffDelay));
          }
        }

        if (!emailSent) {
          this.logger.error(
            `Failed to send email verification to ${email} after ${maxRetries} attempts [${deliveryId}]`
          );

          // Schedule retry for later
          await this.deliveryTracking.scheduleRetry(deliveryId, 300); // Retry in 5 minutes
          throw new Error(
            `Email verification delivery failed after ${maxRetries} attempts`
          );
        }

        // Record successful verification email send for analytics
        await this.notificationPreferencesService.recordNotificationSent(
          userId,
          'email-verification',
          'email'
        );

        this.logger.log(
          `Email verification processing completed for user ${userId} [${deliveryId}]`
        );

        return { success: true, deliveryId };
      }
    );
  }

  /**
   * Processes password reset notifications for both admin-initiated resets
   * and user-initiated forgot-password flows.
   * @param job - Password reset job containing user and secure reset URL data
   */
  @Process('password-reset')
  async handlePasswordReset(job: Job<PasswordResetNotificationData>) {
    const { userId, email, resetUrl, timestamp, expiresIn } = job.data;

    return withErrorHandling(
      this.logger,
      `processing password reset for user ${userId}`,
      async () => {
        this.logger.log(`Processing password reset for user ${userId} (${email})`);

        const requestedAt = timestamp instanceof Date ? timestamp.toISOString() : timestamp;

        const unifiedNotificationPayload: UnifiedNotificationPayload = {
          id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
          siteId: SiteSource.DEALABS,
          type: 'SYSTEM',
          title: 'Reset your DealScrapper password',
          message: 'A password reset link has been sent to your email',
          data: {
            email,
            resetUrl,
            requestedAt,
          },
          timestamp: new Date().toISOString(),
          read: false,
        };

        const deliveryId = await this.deliveryTracking.createDelivery({
          userId,
          type: 'password-reset',
          priority: 'high',
          notificationPayload: unifiedNotificationPayload,
        });

        let emailSent = false;
        const maxRetries = 3;
        let attemptCount = 0;

        while (!emailSent && attemptCount < maxRetries) {
          attemptCount++;

          try {
            this.logger.debug(
              `Password reset email attempt ${attemptCount}/${maxRetries} for ${email}`
            );

            emailSent = await this.emailService.sendPasswordReset(email, resetUrl, userId, expiresIn);

            await this.deliveryTracking.recordAttempt(
              deliveryId,
              'email',
              emailSent ? 'delivered' : 'failed',
              emailSent ? undefined : `Delivery attempt ${attemptCount} failed`
            );

            if (emailSent) {
              this.logger.log(
                `Password reset email sent successfully to ${email} [${deliveryId}]`
              );
              break;
            } else {
              this.logger.warn(
                `Password reset email attempt ${attemptCount} failed for ${email}`
              );

              if (attemptCount < maxRetries) {
                const backoffDelay = Math.pow(2, attemptCount) * 1000;
                await new Promise((resolve) => setTimeout(resolve, backoffDelay));
              }
            }
          } catch (attemptError) {
            this.logger.error(
              `Password reset email attempt ${attemptCount} error for ${email}:`,
              attemptError
            );

            await this.deliveryTracking.recordAttempt(
              deliveryId,
              'email',
              'failed',
              attemptError instanceof Error ? attemptError.message : 'Unknown error'
            );

            if (attemptCount >= maxRetries) {
              throw attemptError;
            }

            const backoffDelay = Math.pow(2, attemptCount) * 1000;
            await new Promise((resolve) => setTimeout(resolve, backoffDelay));
          }
        }

        if (!emailSent) {
          this.logger.error(
            `Failed to send password reset email to ${email} after ${maxRetries} attempts [${deliveryId}]`
          );

          await this.deliveryTracking.scheduleRetry(deliveryId, 60);
          throw new Error(
            `Password reset email delivery failed after ${maxRetries} attempts`
          );
        }

        await this.notificationPreferencesService.recordNotificationSent(
          userId,
          'password-reset',
          'email'
        );

        this.logger.log(`Password reset processing completed for user ${userId} [${deliveryId}]`);
        return { success: true, deliveryId };
      }
    );
  }

  // Legacy helper methods (deprecated)
  private shouldSendNotification(preferences: { email?: boolean; inApp?: boolean }): boolean {
    return preferences?.email || preferences?.inApp || false;
  }

  /**
   * Send notifications via multiple channels with delivery tracking
   * Fetches the unified notification payload from the database and sends it via configured channels
   * @param deliveryId - The delivery tracking ID
   * @param userId - User ID to send notification to
   * @param channels - Array of channels to attempt delivery through
   * @returns Record of channel delivery results (true = delivered, false = failed)
   */
  private async sendNotificationsWithTracking(
    deliveryId: string,
    userId: string,
    channels: Array<'websocket' | 'email'>
  ): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};
    let hasPrimaryChannelSucceeded = false;

    // Fetch the unified notification payload from the database
    let unifiedPayload: UnifiedNotificationPayload | null;
    try {
      const notification = await this.prisma.notification.findUnique({
        where: { id: deliveryId },
      });

      if (!notification) {
        this.logger.error(
          `❌ Notification ${deliveryId} not found in database`
        );
        return results;
      }

      // Deserialize Prisma Json type to UnifiedNotificationPayload with validation
      unifiedPayload = deserializeNotificationPayloadOrNull(
        notification.content,
        (error) => this.logger.error(`Failed to deserialize notification ${deliveryId}: ${error}`)
      );

      if (!unifiedPayload) {
        this.logger.error(
          `❌ Notification ${deliveryId} has no content payload`
        );
        return results;
      }

      this.logger.debug(
        `📦 Fetched unified payload for delivery ${deliveryId}: type=${unifiedPayload.type}, filterId=${unifiedPayload.filterId}`
      );
    } catch (error) {
      this.logger.error(
        `❌ Error fetching notification ${deliveryId}:`,
        error
      );
      return results;
    }

    // Separate primary and fallback channels based on user activity and preferences
    const userStatus = await this.userStatusService.getUserStatus(userId);
    const isUserOnline = userStatus?.isOnline ?? false;

    // Primary channel logic: WebSocket if user is online, Email if offline
    const primaryChannel = isUserOnline ? 'websocket' : 'email';

    // Reorder channels to prioritize primary channel
    const orderedChannels = channels.includes(primaryChannel)
      ? [primaryChannel, ...channels.filter((c) => c !== primaryChannel)]
      : channels;

    this.logger.debug(
      `📋 Channel delivery order for ${userId}: ${orderedChannels.join(' → ')} (primary: ${primaryChannel})`
    );

    for (let i = 0; i < orderedChannels.length; i++) {
      const channel = orderedChannels[i];
      const isPrimary = channel === primaryChannel;
      const isFallback = i > 0 && !hasPrimaryChannelSucceeded;

      try {
        this.logger.debug(
          `📤 Attempting ${isPrimary ? 'primary' : isFallback ? 'fallback' : 'additional'} delivery via ${channel} to ${userId}`
        );

        const success = await this.sendViaChannel(
          channel as 'email' | 'websocket',
          userId,
          unifiedPayload
        );
        results[channel] = success;

        // Record delivery attempt
        await this.deliveryTracking.recordAttempt(
          deliveryId,
          channel,
          success ? 'delivered' : 'failed',
          success ? undefined : 'Delivery failed'
        );

        if (success) {
          if (isPrimary) {
            hasPrimaryChannelSucceeded = true;
            this.logger.debug(
              `✅ Primary channel (${channel}) delivered to ${userId} [${deliveryId}]`
            );

            // For high-priority notifications or when user is active, try additional channels
            const dealScore = unifiedPayload.data?.dealData?.score ?? 0;
            const dealPriority = this.calculateNotificationPriority(dealScore);
            const isHighPriority = dealPriority === 'high';
            const isUserActive = userStatus?.isActive ?? false;

            if (isHighPriority || isUserActive) {
              this.logger.debug(
                `📢 High priority or active user - continuing with additional channels`
              );
              continue; // Continue to send via other channels
            } else {
              this.logger.debug(
                `✅ Primary delivery successful, skipping additional channels for normal priority notification`
              );
              break; // Stop here for normal priority notifications
            }
          } else {
            this.logger.debug(
              `✅ Fallback/additional channel (${channel}) delivered to ${userId} [${deliveryId}]`
            );
            if (!hasPrimaryChannelSucceeded) {
              hasPrimaryChannelSucceeded = true; // Mark as successful via fallback
            }
          }
        } else {
          this.logger.warn(
            `❌ ${isPrimary ? 'Primary' : 'Fallback'} channel (${channel}) failed for ${userId}`
          );
        }
      } catch (error) {
        this.logger.error(
          `❌ ${channel} delivery failed for ${userId}:`,
          error
        );
        results[channel] = false;

        // Record failed attempt with error
        await this.deliveryTracking.recordAttempt(
          deliveryId,
          channel,
          'failed',
          extractErrorMessage(error)
        );
      }
    }

    // Enhanced fallback: If no channels succeeded, try alternative delivery methods
    if (!hasPrimaryChannelSucceeded) {
      this.logger.warn(
        `❌ All configured channels failed for ${userId}, attempting emergency fallback [${deliveryId}]`
      );

      // Emergency fallback: try to store for later delivery when user comes online
      try {
        await this.storeFailedNotificationForRetry(deliveryId, userId);
        this.logger.log(
          `📝 Stored failed notification for future retry [${deliveryId}]`
        );
      } catch (storeError) {
        this.logger.error(
          `❌ Failed to store notification for retry:`,
          storeError
        );
      }
    }

    return results;
  }

  /**
   * Store a failed notification for retry
   * The notification is already in the database, so we just schedule a retry
   * @param deliveryId - The delivery tracking ID
   * @param userId - User ID for logging purposes
   */
  private async storeFailedNotificationForRetry(
    deliveryId: string,
    userId: string
  ): Promise<void> {
    // Schedule retry for failed delivery
    await this.deliveryTracking.scheduleRetry(deliveryId, 60); // Retry in 60 minutes

    // Could also store in Redis for quick lookup when user comes online
    // await this.userStatusService.storePendingNotification(userId, deliveryId);
  }

  /**
   * Send notification via a specific channel using unified payload
   * @param channel - The delivery channel (websocket or email)
   * @param userId - User ID to send notification to
   * @param unifiedPayload - The unified notification payload from database
   * @returns True if delivery succeeded, false otherwise
   */
  private async sendViaChannel(
    channel: 'websocket' | 'email',
    userId: string,
    unifiedPayload: UnifiedNotificationPayload
  ): Promise<boolean> {
    const startTime = Date.now();
    let success = false;

    try {
      switch (channel) {
        case 'websocket':
          success = await this.sendViaWebSocket(userId, unifiedPayload);
          break;

        case 'email':
          success = await this.sendViaEmail(userId, unifiedPayload);
          break;

        default:
          this.logger.warn(`Unknown notification channel: ${channel}`);
          return false;
      }

      const duration = Date.now() - startTime;

      // Record delivery metrics for health monitoring
      await this.channelHealthService.recordDeliveryAttempt(
        channel,
        success,
        duration
      );

      return success;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `❌ ${channel} channel failed for user ${userId} after ${duration}ms:`,
        error
      );

      // Record failed delivery for health monitoring
      await this.channelHealthService.recordDeliveryAttempt(
        channel,
        false,
        duration
      );

      return false;
    }
  }

  /**
   * Send notification via WebSocket using unified payload
   * @param userId - User ID to send notification to
   * @param unifiedPayload - The unified notification payload from database
   * @returns True if delivery succeeded, false otherwise
   */
  private async sendViaWebSocket(
    userId: string,
    unifiedPayload: UnifiedNotificationPayload
  ): Promise<boolean> {
    try {
      // Check if user is online via WebSocket
      const isUserOnline = await this.websocketGateway.isUserOnline(userId);
      if (!isUserOnline) {
        this.logger.debug(`🔌 User ${userId} not connected via WebSocket`);
        return false;
      }

      // Send the unified payload directly to the gateway
      const success = await this.websocketGateway.sendToUser(
        userId,
        unifiedPayload
      );

      if (success) {
        this.logger.debug(
          `🔌 WebSocket notification delivered to user ${userId}`
        );
      }

      return success;
    } catch (error) {
      this.logger.error(
        `🔌 WebSocket delivery error for user ${userId}:`,
        error
      );
      return false;
    }
  }

  /**
   * Send notification via Email using unified payload
   * Extracts deal data from the unified payload and formats it for email template
   * @param userId - User ID to send notification to
   * @param unifiedPayload - The unified notification payload from database
   * @returns True if delivery succeeded, false otherwise
   */
  private async sendViaEmail(
    userId: string,
    unifiedPayload: UnifiedNotificationPayload
  ): Promise<boolean> {
    try {
      // Get user email from preferences service with retry logic
      let preferences;
      let retryCount = 0;
      const maxRetries = 2;

      while (retryCount < maxRetries) {
        try {
          preferences =
            await this.notificationPreferencesService.getUserPreferences(
              userId
            );
          break;
        } catch (error) {
          retryCount++;
          if (retryCount >= maxRetries) {
            throw error;
          }
          this.logger.debug(
            `📧 Retrying preferences fetch for user ${userId} (attempt ${retryCount})`
          );
          await new Promise((resolve) =>
            setTimeout(resolve, 1000 * retryCount)
          ); // Exponential backoff
        }
      }

      const userEmail = preferences?.channels.email.address;

      if (!userEmail) {
        this.logger.debug(`📧 No email address configured for user ${userId}`);
        return false;
      }

      if (!preferences?.channels.email.verified) {
        this.logger.debug(`📧 Email not verified for user ${userId}`);
        return false;
      }

      // DEFERRED: Daily email limit tracking
      // Requires: notification analytics table in database schema
      // When implemented: Track emails sent per day per user and enforce dailyEmailLimit
      const dailyEmailLimit = 10; // Default limit - not yet enforced

      // Extract deal data from unified payload for email template
      const dealData = unifiedPayload.data?.dealData;

      if (!dealData) {
        this.logger.error(
          `📧 No deal data found in unified payload for user ${userId}`
        );
        return false;
      }

      // Validate required fields for email
      if (!dealData.price || !dealData.score || !dealData.url || !dealData.merchant) {
        this.logger.error(
          `📧 Missing required deal data fields for email to user ${userId}`
        );
        return false;
      }

      // Prepare email content with data from unified payload
      // Map unified payload fields to email service expected format
      const emailData = {
        title: dealData.title,
        price: dealData.price,
        url: dealData.url,
        imageUrl: dealData.imageUrl,
        score: dealData.score,
        merchant: dealData.merchant, // Now guaranteed to be string (validated above)
        originalPrice: dealData.originalPrice,
        discountPercentage: dealData.discountPercentage,
      };

      // Send email with retry logic
      let emailSuccess = false;
      retryCount = 0;

      while (retryCount < maxRetries && !emailSuccess) {
        try {
          emailSuccess = await this.emailService.sendDealMatchEmail(
            userEmail,
            emailData,
            unifiedPayload.title, // Use the title from unified payload
            userId
          );

          if (emailSuccess) {
            // DEFERRED: Record email send for analytics
            // Requires: notification analytics table - see daily limit tracking above
            this.logger.debug(
              `📧 Email notification delivered to ${userEmail} for user ${userId}`
            );
          }
        } catch (emailError) {
          retryCount++;
          if (retryCount >= maxRetries) {
            throw emailError;
          }
          this.logger.debug(
            `📧 Retrying email send for user ${userId} (attempt ${retryCount})`
          );
          await new Promise((resolve) =>
            setTimeout(resolve, 2000 * retryCount)
          );
        }
      }

      return emailSuccess;
    } catch (error) {
      this.logger.error(`📧 Email delivery error for user ${userId}:`, error);
      return false;
    }
  }

  private calculateNotificationPriority(
    score: number
  ): 'high' | 'normal' | 'low' {
    if (score >= 90) return 'high';
    if (score >= 70) return 'normal';
    return 'low';
  }
}
