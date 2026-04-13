import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { PrismaService } from '@dealscrapper/database';
import type { Article, Filter, Match } from '@dealscrapper/database';
import {
  NotificationPriority,
  QUEUE_PRIORITIES,
} from '@dealscrapper/shared-types';
import { extractErrorMessage } from '@dealscrapper/shared';

/**
 * Notification data payload for external notifier service
 */
export interface ExternalNotificationPayload {
  readonly matchId: string;
  readonly userId: string;
  readonly filterId: string;
  readonly dealData: DealNotificationDetails;
  readonly priority: NotificationPriority;
  readonly timestamp: Date;
}

/**
 * Deal details for notification context
 * NOTE: Site-specific fields (merchant, temperature, discountPercentage) are now optional
 * since they live in extension tables and may not always be loaded.
 */
export interface DealNotificationDetails {
  readonly title: string;
  readonly price: number;
  readonly url: string;
  readonly imageUrl?: string;
  readonly score: number;
  readonly merchant?: string;
  readonly temperature?: number;
  readonly discountPercentage?: number;
}

/**
 * @deprecated Use NotificationPriority from @dealscrapper/shared-types instead
 */
export type NotificationPriorityLegacy = 'high' | 'normal' | 'low';

/**
 * Queue job options configuration
 */
export interface NotificationJobOptions {
  readonly priority: number;
  readonly attempts: number;
  readonly backoff: {
    readonly type: 'exponential';
    readonly delay: number;
  };
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('notifications')
    private readonly externalNotificationQueue: Queue
  ) {}

  /**
   * Queues a notification to the external notifier service for a matched deal
   * @param match - The match with associated filter and article data
   * @throws Error if notification queuing fails
   */
  async queueExternalNotification(
    match: Match & { filter: Filter; article: Article }
  ): Promise<void> {
    try {
      this.logger.log(
        `Queuing notification for match ${match.id} (filter: ${match.filter.name})`
      );

      const notificationPayload = this.createNotificationPayload(match);
      const jobOptions = this.createJobOptions(notificationPayload.priority);

      await this.externalNotificationQueue.add(
        'deal-match-found',
        notificationPayload,
        jobOptions
      );

      await this.markMatchAsNotified(match.id);

      this.logger.log(`Successfully queued notification for match ${match.id}`);
    } catch (error) {
      const errorMessage = extractErrorMessage(error);
      this.logger.error(
        `Failed to queue notification for match ${match.id}: ${errorMessage}`
      );
      throw error;
    }
  }

  /**
   * Creates notification payload from match data
   * @param match - The match with associated filter and article data
   * @returns Structured notification payload for external service
   */
  private createNotificationPayload(
    match: Match & { filter: Filter; article: Article }
  ): ExternalNotificationPayload {
    return {
      matchId: match.id,
      userId: match.filter.userId,
      filterId: match.filter.id,
      dealData: {
        title: match.article.title,
        price: match.article.currentPrice ?? 0,
        url: match.article.url,
        imageUrl: match.article.imageUrl ?? undefined,
        score: match.score,
        // NOTE: Extension fields (merchant, temperature, discountPercentage) are now in
        // site-specific tables. Use ArticleWrapper.load() for full data.
        // TODO: Load extension data via ArticleWrapper.load() to populate merchant, temperature, discountPercentage
        merchant: 'Unknown',
        temperature: undefined,
        discountPercentage: undefined,
      },
      priority: this.calculateNotificationPriority(match.score),
      timestamp: new Date(),
    };
  }

  /**
   * Creates queue job options based on notification priority
   * @param priority - Notification priority level
   * @returns Queue job configuration options
   */
  private createJobOptions(
    priority: NotificationPriority
  ): NotificationJobOptions {
    return {
      priority: QUEUE_PRIORITIES[priority],
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    };
  }

  /**
   * Calculates notification priority based on match score
   * @param score - The match score value
   * @returns Priority level for the notification
   */
  private calculateNotificationPriority(score: number): NotificationPriority {
    if (score >= 80) return NotificationPriority.HIGH;
    if (score >= 60) return NotificationPriority.NORMAL;
    return NotificationPriority.LOW;
  }

  /**
   * Marks a match as notified in the database
   * @param matchId - The unique identifier of the match
   */
  private async markMatchAsNotified(matchId: string): Promise<void> {
    try {
      await this.prisma.match.update({
        where: { id: matchId },
        data: {
          notified: true,
          notifiedAt: new Date(),
        },
      });
    } catch (error) {
      const errorMessage = extractErrorMessage(error);
      this.logger.error(
        `Failed to mark match ${matchId} as notified: ${errorMessage}`
      );
      // Don't throw - notification was already queued successfully
    }
  }
}
