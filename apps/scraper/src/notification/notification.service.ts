import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { PrismaService } from '@dealscrapper/database';
import type { Article, Filter, Match } from '@dealscrapper/database';
import {
  NotificationPriority,
  QUEUE_PRIORITIES,
} from '@dealscrapper/shared-types';
import { createServiceLogger } from '@dealscrapper/shared-logging';
import { extractErrorMessage } from '@dealscrapper/shared';
import { scraperLogConfig } from '../config/logging.config.js';
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
  /**
   * Event-granular idempotency key, identical to the Bull jobId for this enqueue.
   * The notifier dedups on `(userId, dedupKey)` so a price-drop re-alert is not
   * swallowed by the earlier match notification:
   * - `deal-match-${matchId}` for the initial match
   * - `deal-match-${matchId}-drop-${price}` for a price-drop re-alert
   */
  readonly dedupKey?: string;
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
  private readonly logger = createServiceLogger(scraperLogConfig);

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

      // The Bull jobId and the notifier's event-granular dedupKey are the SAME
      // string, so the queue-level dedup and the notifier-level dedup agree.
      const jobId = this.buildJobId(dedupKey ?? match.id);
      const notificationPayload = this.createNotificationPayload(match, jobId);
      const jobOptions = this.createJobOptions(
        jobId,
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
   * Builds the deterministic Bull jobId / notifier dedupKey from the inner key.
   * For a plain deal match the inner key is the match id; for a price-drop
   * re-alert it also encodes the dropped price (`${matchId}-drop-${price}`) so
   * the SAME price won't re-fire but a new lower price will (value-edge dedup).
   */
  private buildJobId(innerKey: string): string {
    return `deal-match-${innerKey}`;
  }

  /**
   * Creates notification payload from match data
   * @param match - The match with associated filter and article data
   * @param dedupKey - Event-granular key, identical to the Bull jobId, so the
   *   notifier can dedup a drop re-alert distinctly from the initial match
   * @returns Structured notification payload for external service
   */
  private createNotificationPayload(
    match: Match & { filter: Filter; article: Article },
    dedupKey: string
  ): ExternalNotificationPayload {
    return {
      matchId: match.id,
      userId: match.filter.userId,
      filterId: match.filter.id,
      dedupKey,
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
   * Creates queue job options for an already-built jobId.
   * @param jobId - Deterministic Bull jobId (also the notifier dedupKey)
   * @param priority - Notification priority level
   * @returns Queue job configuration options
   */
  private createJobOptions(
    jobId: string,
    priority: NotificationPriority
  ): NotificationJobOptions {
    return {
      jobId,
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
          `Notification was already queued; NOT re-throwing. ` +
          `A re-queue on upstream retry is harmless: the notifier dedups idempotently ` +
          `on (userId, dedupKey), so the duplicate is caught downstream and never re-sent.`
      );
      // Intentionally do not re-throw: re-throwing would trigger an upstream
      // retry that re-enqueues the notification. The notifier's (userId, dedupKey)
      // dedup makes that re-enqueue a no-op, so swallowing here cannot cause a
      // duplicate notification — it only leaves the `notified` flag stale, which
      // is logged at error level above for visibility.
    }
  }
}
