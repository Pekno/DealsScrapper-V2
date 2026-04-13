import { Injectable } from '@nestjs/common';
import { createServiceLogger } from '@dealscrapper/shared-logging';
import { PrismaService } from '@dealscrapper/database';
import { withErrorHandling } from '../utils/error-handling.utils.js';
import type { NotificationMetadata } from '../templates/template.interfaces.js';
import { notifierLogConfig } from '../config/logging.config.js';

/**
 * Digest frequency options
 */
export enum DigestFrequency {
  HOURLY = 'hourly',
  DAILY = 'daily',
  WEEKLY = 'weekly',
  DISABLED = 'disabled',
}

/**
 * User notification preferences configuration interface
 */
export interface NotificationPreferences {
  readonly email: boolean;
  readonly inApp: boolean;
  readonly frequency: DigestFrequency | 'immediate';
  readonly quietHours: QuietHoursConfig;
  readonly categories: NotificationCategorySettings;
  readonly filters: NotificationFilterSettings;
  readonly channels: NotificationChannelSettings;
}

/**
 * Quiet hours configuration for notifications
 */
export interface QuietHoursConfig {
  readonly enabled: boolean;
  readonly start: string; // HH:MM format
  readonly end: string; // HH:MM format
  readonly timezone?: string;
}

/**
 * Notification category enable/disable settings
 */
export interface NotificationCategorySettings {
  readonly dealMatch: boolean;
  readonly digest: boolean;
  readonly system: boolean;
  readonly priceAlert: boolean;
  readonly stockAlert: boolean;
}

/**
 * Notification filtering and throttling settings
 */
export interface NotificationFilterSettings {
  readonly minScore: number;
  readonly maxPerDay: number;
  readonly preferredMerchants: readonly string[];
  readonly blockedKeywords: readonly string[];
  readonly priorityOnly: boolean;
}

/**
 * Notification channel configurations
 */
export interface NotificationChannelSettings {
  readonly email: {
    readonly address: string;
    readonly verified: boolean;
  };
}

/**
 * Context information for notification decision making
 */
export interface NotificationContext {
  readonly userId: string;
  readonly notificationType: NotificationMetadata['type'];
  readonly priority: NotificationMetadata['priority'];
  readonly score?: number;
  readonly dealData?: DealNotificationData;
  readonly userActivity: UserActivityContext;
}

/**
 * Deal-specific data for notifications
 */
export interface DealNotificationData {
  readonly title: string;
  readonly price: number;
  readonly merchant: string;
  readonly category: string;
}

/**
 * User activity context for notification delivery decisions
 */
export interface UserActivityContext {
  readonly isOnline: boolean;
  readonly isActive: boolean;
  readonly lastActivity: Date;
  readonly deviceType: 'web' | 'mobile';
}

/**
 * Result of notification permission check
 */
export interface NotificationPermissionResult {
  readonly allowed: boolean;
  readonly channels: readonly ('websocket' | 'email')[];
  readonly reason?: string;
}

@Injectable()
export class NotificationPreferencesService {
  private readonly logger = createServiceLogger(notifierLogConfig);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Retrieves notification preferences for a specific user
   * @param userId - The unique identifier of the user
   * @returns User's notification preferences or null if user not found
   */
  async getUserPreferences(
    userId: string
  ): Promise<NotificationPreferences | null> {
    return withErrorHandling(
      this.logger,
      `retrieving preferences for user ${userId}`,
      async () => {
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
        });

        if (!user) {
          this.logger.warn(`User not found: ${userId}`);
          return null;
        }

        // Create preferences based on actual User model fields
        return this.createPreferencesFromUser(user);
      },
      {
        throwOnError: false,
        fallbackValue: null
      }
    );
  }

  /**
   * Updates notification preferences for a specific user
   * @param userId - The unique identifier of the user
   * @param preferences - Partial preferences object to update
   * @throws Error if user not found or update fails
   */
  async updateUserPreferences(
    userId: string,
    preferences: Partial<NotificationPreferences>
  ): Promise<void> {
    return withErrorHandling(
      this.logger,
      `updating preferences for user ${userId}`,
      async () => {
        // Update the relevant User model fields
        const updateData: Record<string, unknown> = {};

        if (preferences.email !== undefined) {
          updateData.emailNotifications = preferences.email;
        }

        // Note: Other preference fields would require schema changes
        // For now, we only support email notification toggle

        if (Object.keys(updateData).length > 0) {
          await this.prisma.user.update({
            where: { id: userId },
            data: {
              ...updateData,
              updatedAt: new Date(),
            },
          });
        }

        this.logger.log(`Updated notification preferences for user ${userId}`);
      }
    );
  }

  /**
   * Determines if a notification should be sent based on user preferences and context
   * @param context - Notification context including user info, type, and content
   * @returns Permission result with allowed status, channels, and optional reason
   */
  async shouldSendNotification(
    context: NotificationContext
  ): Promise<NotificationPermissionResult> {
    try {
      const preferences = await this.getUserPreferences(context.userId);

      if (!preferences) {
        return { allowed: false, channels: [], reason: 'No preferences found' };
      }

      // Check if notification category is enabled
      const categoryKey = this.mapNotificationTypeToCategory(
        context.notificationType
      );
      if (!preferences.categories[categoryKey]) {
        return {
          allowed: false,
          channels: [],
          reason: `Category ${categoryKey} disabled`,
        };
      }

      // Check frequency settings
      if (preferences.frequency === DigestFrequency.DISABLED) {
        return {
          allowed: false,
          channels: [],
          reason: 'Notifications disabled',
        };
      }

      // Check if user has reached daily limit
      if (
        await this.hasReachedDailyLimit(
          context.userId,
          preferences.filters.maxPerDay
        )
      ) {
        return {
          allowed: false,
          channels: [],
          reason: 'Daily limit reached',
        };
      }

      // Check minimum score requirement
      const scoreCheckResult = this.checkMinimumScore(
        context.score,
        preferences.filters.minScore
      );
      if (!scoreCheckResult.passed) {
        return {
          allowed: false,
          channels: [],
          reason: scoreCheckResult.reason,
        };
      }

      // Check blocked keywords
      const keywordCheckResult = this.checkBlockedKeywords(
        context.dealData?.title,
        preferences.filters.blockedKeywords
      );
      if (!keywordCheckResult.passed) {
        return {
          allowed: false,
          channels: [],
          reason: keywordCheckResult.reason,
        };
      }

      // Check quiet hours
      const quietHoursResult = this.checkQuietHours(
        preferences.quietHours,
        context.priority
      );
      if (!quietHoursResult.passed) {
        return {
          allowed: false,
          channels: [],
          reason: quietHoursResult.reason,
        };
      }

      // Check priority filter
      if (preferences.filters.priorityOnly && context.priority !== 'high') {
        return {
          allowed: false,
          channels: [],
          reason: 'Priority only mode enabled',
        };
      }

      // Determine channels based on user activity and preferences
      const channels = this.selectNotificationChannels(context, preferences);

      return { allowed: true, channels };
    } catch (error) {
      this.logger.error('Failed to check notification permission:', error);
      return {
        allowed: false,
        channels: [],
        reason: 'Error checking permissions',
      };
    }
  }

  /**
   * Records that a notification was sent for analytics and rate limiting
   * @param userId - The unique identifier of the user
   * @param notificationType - Type of notification that was sent
   * @param channel - Channel through which notification was delivered
   */
  async recordNotificationSent(
    userId: string,
    notificationType: string,
    channel: string
  ): Promise<void> {
    await withErrorHandling(
      this.logger,
      'recording notification delivery',
      async () => {
        // TODO: Persist to notification_analytics table when added to schema
        // Currently only logs delivery for debugging purposes
        this.logger.debug(
          `Notification delivered - User: ${userId}, Type: ${notificationType}, Channel: ${channel}`
        );
      },
      {
        throwOnError: false
      }
    );
  }

  // Private helper methods

  /**
   * Creates notification preferences from User model data
   * @param user - User from database
   * @returns Notification preferences based on user data
   */
  private createPreferencesFromUser(user: {
    emailNotifications?: boolean;
    weeklyDigest?: boolean;
    email: string;
    emailVerified?: boolean;
    timezone?: string | null;
  }): NotificationPreferences {
    return {
      email: user.emailNotifications ?? true,
      inApp: true,
      frequency: 'immediate' as const,
      quietHours: {
        enabled: false,
        start: '22:00',
        end: '08:00',
        timezone: user.timezone || 'UTC',
      },
      categories: {
        dealMatch: user.emailNotifications ?? true,
        digest: user.weeklyDigest ?? true,
        system: true,
        priceAlert: user.emailNotifications ?? true,
        stockAlert: user.emailNotifications ?? true,
      },
      filters: {
        minScore: 50,
        maxPerDay: 50,
        preferredMerchants: [],
        blockedKeywords: [],
        priorityOnly: false,
      },
      channels: {
        email: {
          address: user.email,
          verified: user.emailVerified ?? false,
        },
      },
    };
  }

  /**
   * Merges current preferences with partial updates, handling nested objects properly
   * @param current - Current user preferences
   * @param updates - Partial preferences to merge
   * @returns Updated preferences object
   */
  private mergePreferences(
    current: NotificationPreferences,
    updates: Partial<NotificationPreferences>
  ): NotificationPreferences {
    return {
      ...current,
      ...updates,
      // Merge nested objects properly
      quietHours: {
        ...current.quietHours,
        ...updates.quietHours,
      },
      categories: {
        ...current.categories,
        ...updates.categories,
      },
      filters: {
        ...current.filters,
        ...updates.filters,
        // Handle array properties specially to avoid reference issues
        preferredMerchants:
          updates.filters?.preferredMerchants ??
          current.filters.preferredMerchants,
        blockedKeywords:
          updates.filters?.blockedKeywords ?? current.filters.blockedKeywords,
      },
      channels: {
        ...current.channels,
        ...updates.channels,
        email: {
          ...current.channels.email,
          ...updates.channels?.email,
        },
      },
    };
  }

  /**
   * Maps notification type to category key for preference checking
   * @param type - Notification type from metadata
   * @returns Category key for preferences lookup
   */
  private mapNotificationTypeToCategory(
    type: NotificationMetadata['type']
  ): keyof NotificationCategorySettings {
    const categoryMap: Record<
      NotificationMetadata['type'],
      keyof NotificationCategorySettings
    > = {
      'deal-match': 'dealMatch',
      digest: 'digest',
      system: 'system',
      verification: 'system',
      welcome: 'system',
      reminder: 'system',
    };
    return categoryMap[type] ?? 'system';
  }

  /**
   * Checks if user has reached their daily notification limit
   * @param userId - User identifier
   * @param maxPerDay - Maximum notifications allowed per day
   * @returns True if limit reached, false otherwise
   */
  private async hasReachedDailyLimit(
    userId: string,
    maxPerDay: number
  ): Promise<boolean> {
    try {
      // TODO: Implement daily limit checking — requires notification_analytics table
      // Currently always returns false (no limit exceeded) to allow all notifications
      // When implemented: query notification_analytics for today's count per user
      return false;
    } catch (error) {
      this.logger.error('Failed to check daily limit:', error);
      return false; // Fail open to allow notifications
    }
  }

  /**
   * Checks if text contains any blocked keywords
   * @param text - Text to check (optional)
   * @param blockedKeywords - Array of blocked keywords
   * @returns Validation result with passed status and reason
   */
  private checkBlockedKeywords(
    text?: string,
    blockedKeywords: readonly string[] = []
  ): { passed: boolean; reason?: string } {
    if (!text || blockedKeywords.length === 0) {
      return { passed: true };
    }

    const normalizedText = text.toLowerCase();
    const foundKeyword = blockedKeywords.find((keyword) =>
      normalizedText.includes(keyword.toLowerCase())
    );

    return foundKeyword
      ? { passed: false, reason: `Contains blocked keyword: ${foundKeyword}` }
      : { passed: true };
  }

  /**
   * Checks if score meets minimum requirement
   * @param score - Optional score value
   * @param minScore - Minimum required score
   * @returns Validation result with passed status and reason
   */
  private checkMinimumScore(
    score?: number,
    minScore: number = 0
  ): { passed: boolean; reason?: string } {
    if (score === undefined) {
      return { passed: true }; // No score to check
    }

    return score >= minScore
      ? { passed: true }
      : { passed: false, reason: `Score ${score} below minimum ${minScore}` };
  }

  /**
   * Checks if current time is within user's quiet hours
   * @param quietHours - User's quiet hours configuration
   * @param priority - Notification priority level
   * @returns Validation result with passed status and reason
   */
  private checkQuietHours(
    quietHours: QuietHoursConfig,
    priority: NotificationMetadata['priority']
  ): { passed: boolean; reason?: string } {
    if (!quietHours.enabled) {
      return { passed: true };
    }

    const isInQuietPeriod = this.isCurrentTimeInQuietHours(quietHours);

    if (!isInQuietPeriod) {
      return { passed: true };
    }

    // During quiet hours, only allow high priority notifications
    return priority === 'high'
      ? { passed: true }
      : { passed: false, reason: 'In quiet hours (non-priority)' };
  }

  /**
   * Determines if current time falls within quiet hours
   * @param quietHours - Quiet hours configuration
   * @returns True if currently in quiet hours, false otherwise
   */
  private isCurrentTimeInQuietHours(quietHours: QuietHoursConfig): boolean {
    const now = new Date(Date.now());
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const [startHour, startMin] = quietHours.start.split(':').map(Number);
    const [endHour, endMin] = quietHours.end.split(':').map(Number);

    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    // Handle same-day and overnight quiet hours
    return startMinutes <= endMinutes
      ? currentMinutes >= startMinutes && currentMinutes <= endMinutes
      : currentMinutes >= startMinutes || currentMinutes <= endMinutes;
  }

  /**
   * Selects appropriate notification channels based on user activity and preferences
   * @param context - Notification context including user activity
   * @param preferences - User's notification preferences
   * @returns Array of suitable delivery channels
   */
  private selectNotificationChannels(
    context: NotificationContext,
    preferences: NotificationPreferences
  ): readonly ('websocket' | 'email')[] {
    const channels: ('websocket' | 'email')[] = [];

    // WebSocket: if user is online and in-app notifications enabled
    if (context.userActivity.isOnline && preferences.inApp) {
      channels.push('websocket');
    }

    // Email: Always send email if verified and email notifications are enabled
    // This ensures notifications work properly during development and testing
    if (preferences.email && preferences.channels.email.verified) {
      channels.push('email');
    }

    // Note: Removed the user activity check (!context.userActivity.isActive)
    // to ensure email notifications work by default when email is verified
    // This can be re-enabled later when user activity tracking is fully implemented

    return channels;
  }
}
