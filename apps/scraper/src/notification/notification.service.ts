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
import { DealProcessingUtils, type PriceDrop } from '../common/deal-processing.utils.js';

/**
 * Minimum gap between price-drop alerts for the same match. The time-based
 * anti-spam half of Phase 6's throttle (PriceGhost shipped with none, so an
 * oscillating price spammed). ponytail: a flat constant; make it per-user
 * configurable only when someone asks.
 */
const PRICE_DROP_COOLDOWN_MS = 6 * 60 * 60 * 1000; // 6h

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
  readonly jobId: string;
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
    match: Match & { filter: Filter; article: Article },
    dedupKey?: string
  ): Promise<void> {
    try {
      this.logger.log(
        `Queuing notification for match ${match.id} (filter: ${match.filter.name})`
      );

      const notificationPayload = this.createNotificationPayload(match);
      const jobOptions = this.createJobOptions(
        dedupKey ?? match.id,
        notificationPayload.priority
      );

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
   * Phase 6 alert wiring: turn a detected price drop on an article into
   * throttled drop alerts for that article's existing (active) matches.
   *
   * Throttle = the two anti-spam primitives combined:
   *  - time gate: skip a match still inside the cooldown window (uses the
   *    match's own notifiedAt, no new column needed).
   *  - value edge: the per-price dedupKey means Bull ignores a re-add for a
   *    price already alerted, so an oscillation back up-and-down won't re-fire.
   *
   * Best-effort and isolated per match: one failing enqueue doesn't abort the
   * rest. The caller (scrape write-path) wraps this so a drop alert can never
   * break a scrape.
   *
   * @param articleId - The article whose price just dropped
   * @param drop - The computed drop (carries the new currentPrice for the key)
   * @param now - Injected for deterministic cooldown evaluation
   * @returns Number of alerts actually queued
   */
  async queuePriceDropAlerts(
    articleId: string,
    drop: PriceDrop,
    now: Date = new Date()
  ): Promise<number> {
    const matches = await this.prisma.match.findMany({
      where: { articleId, article: { isActive: true } },
      include: { filter: true, article: true },
    });

    let queued = 0;
    for (const match of matches) {
      if (
        !DealProcessingUtils.cooldownElapsed(
          match.notifiedAt,
          now,
          PRICE_DROP_COOLDOWN_MS
        )
      ) {
        continue; // still inside the cooldown window
      }
      try {
        await this.queueExternalNotification(
          match,
          `${match.id}-drop-${drop.currentPrice}`
        );
        queued++;
      } catch (error) {
        this.logger.error(
          `Failed to queue price-drop alert for match ${match.id}: ${extractErrorMessage(error)}`
        );
      }
    }

    if (queued > 0) {
      this.logger.log(
        `Queued ${queued} price-drop alert(s) for article ${articleId} (-${drop.percentage}%)`
      );
    }
    return queued;
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
   * @param dedupKey - Deterministic Bull jobId key. For a plain deal match this
   *   is the match id (so a retried handler can't duplicate the notification);
   *   for a price-drop re-alert it also encodes the dropped price so the SAME
   *   price won't re-fire but a new lower price will (value-edge dedup).
   * @param priority - Notification priority level
   * @returns Queue job configuration options
   */
  private createJobOptions(
    dedupKey: string,
    priority: NotificationPriority
  ): NotificationJobOptions {
    return {
      jobId: `deal-match-${dedupKey}`,
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
        `Failed to persist 'notified' flag for match ${matchId}: ${errorMessage}. ` +
          `Notification was already queued; NOT re-throwing to avoid re-queuing. ` +
          `If the upstream job is retried, this match may re-fire (duplicate notification) ` +
          `because the notified flag was not written.`
      );
      // Intentionally do not re-throw: the notification was already queued, so
      // re-throwing would trigger an upstream retry that re-sends the same match.
    }
  }
}
