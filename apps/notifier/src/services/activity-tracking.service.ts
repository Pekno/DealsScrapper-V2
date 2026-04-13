import { Injectable, Inject } from '@nestjs/common';
import { createServiceLogger } from '@dealscrapper/shared-logging';
import { Redis } from 'ioredis';
import { notifierLogConfig } from '../config/logging.config.js';
import { ActivityMetadata } from '../websocket/notification.gateway.js';

import { withErrorHandling, handleServiceError } from '../utils/error-handling.utils.js';
import {
  zaddRedisJson,
  zrevrangebyscoreRedisJson,
  getRedisJson,
  setRedisJson,
  scanKeys,
} from '../utils/redis-helpers.utils.js';

export interface UserActivity {
  userId: string;
  activityType:
    | 'mouse'
    | 'keyboard'
    | 'scroll'
    | 'click'
    | 'focus'
    | 'blur'
    | 'visibility_change';
  timestamp: Date;
  metadata?: ActivityMetadata;
}

export interface ActivityPattern {
  userId: string;
  timeRange: {
    start: Date;
    end: Date;
  };
  totalActivityCount: number;
  activityTypes: Record<string, number>;
  peakActivityPeriods: Array<{
    start: Date;
    end: Date;
    intensity: number;
  }>;
  inactivePeriods: Array<{
    start: Date;
    end: Date;
    duration: number;
  }>;
  averageSessionLength: number;
  deviceBreakdown: Record<string, number>;
}

@Injectable()
export class ActivityTrackingService {
  private readonly logger = createServiceLogger(notifierLogConfig);
  private readonly ACTIVITY_BUFFER_SIZE = 1000;
  private readonly ACTIVITY_TTL = 86400 * 7; // 7 days
  private readonly PATTERN_CACHE_TTL = 3600; // 1 hour

  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {}

  async recordActivity(activity: UserActivity): Promise<void> {
    await withErrorHandling(
      this.logger,
      `recording activity for user ${activity.userId}`,
      async () => {
        const key = `user_activity:${activity.userId}`;
        const timestamp = activity.timestamp.getTime();

        const activityRecord = {
          type: activity.activityType,
          timestamp: timestamp,
          metadata: activity.metadata || {},
        };

        // Add to sorted set with timestamp as score
        await zaddRedisJson(this.redis, key, timestamp, activityRecord);

        // Maintain buffer size - remove old entries
        const count = await this.redis.zcard(key);
        if (count > this.ACTIVITY_BUFFER_SIZE) {
          const removeCount = count - this.ACTIVITY_BUFFER_SIZE;
          await this.redis.zremrangebyrank(key, 0, removeCount - 1);
        }

        // Set TTL
        await this.redis.expire(key, this.ACTIVITY_TTL);

        // Update real-time activity indicators
        await this.updateRealTimeIndicators(
          activity.userId,
          activity.activityType
        );
      },
      { throwOnError: false }
    );
  }

  async getRecentActivity(
    userId: string,
    since: Date,
    limit: number = 100
  ): Promise<UserActivity[]> {
    return withErrorHandling(
      this.logger,
      `getting recent activity for user ${userId}`,
      async () => {
        const key = `user_activity:${userId}`;
        const sinceTimestamp = since.getTime();

        const activities = await zrevrangebyscoreRedisJson<{
          type: string;
          timestamp: number;
          metadata?: Record<string, unknown>;
        }>(this.redis, key, '+inf', sinceTimestamp, {
          withScores: true,
          limit: { offset: 0, count: limit },
        });

        const result: UserActivity[] = activities.map(({ value, score }) => ({
          userId,
          activityType: value.type as UserActivity['activityType'],
          timestamp: new Date(score ?? value.timestamp),
          metadata: value.metadata as ActivityMetadata | undefined,
        }));

        return result.reverse(); // Most recent first
      },
      { fallbackValue: [], throwOnError: false }
    );
  }

  async analyzeActivityPattern(
    userId: string,
    timeRange: { start: Date; end: Date }
  ): Promise<ActivityPattern> {
    return withErrorHandling(
      this.logger,
      `analyzing activity pattern for user ${userId}`,
      async () => {
        const cacheKey = `activity_pattern:${userId}:${timeRange.start.getTime()}-${timeRange.end.getTime()}`;

        // Check cache first
        const cached = await getRedisJson<ActivityPattern>(
          this.redis,
          cacheKey,
          this.logger
        );
        if (cached) {
          return cached;
        }

        const activities = await this.getRecentActivity(userId, timeRange.start);
        const filteredActivities = activities.filter(
          (a) => a.timestamp >= timeRange.start && a.timestamp <= timeRange.end
        );

        const pattern = this.computeActivityPattern(
          userId,
          timeRange,
          filteredActivities
        );

        // Cache the result
        await setRedisJson(
          this.redis,
          cacheKey,
          pattern,
          this.PATTERN_CACHE_TTL
        );

        return pattern;
      },
      { fallbackValue: this.getEmptyPattern(userId, timeRange), throwOnError: false }
    );
  }

  async isUserCurrentlyActive(
    userId: string,
    thresholdMinutes: number = 5
  ): Promise<boolean> {
    try {
      const since = new Date(Date.now() - thresholdMinutes * 60 * 1000);
      const recentActivities = await this.getRecentActivity(userId, since, 1);

      return recentActivities.length > 0;
    } catch (error) {
      this.logger.error(`Error checking if user ${userId} is active:`, error);
      return false;
    }
  }

  async getUserEngagementScore(
    userId: string,
    timeRange: { start: Date; end: Date }
  ): Promise<number> {
    try {
      const pattern = await this.analyzeActivityPattern(userId, timeRange);

      // Calculate engagement score based on various factors
      const timeRangeHours =
        (timeRange.end.getTime() - timeRange.start.getTime()) /
        (1000 * 60 * 60);
      const activityRate =
        pattern.totalActivityCount / Math.max(timeRangeHours, 1);

      // Factors that increase engagement score:
      // - High activity rate
      // - Variety of activity types
      // - Consistent engagement (fewer long inactive periods)
      // - Longer session lengths

      const varietyScore = Object.keys(pattern.activityTypes).length * 10;
      const consistencyScore = Math.max(
        0,
        100 - pattern.inactivePeriods.length * 5
      );
      const sessionScore = Math.min(pattern.averageSessionLength / 60, 60); // Cap at 60 minutes
      const rateScore = Math.min(activityRate * 2, 50);

      const engagementScore = Math.round(
        (varietyScore + consistencyScore + sessionScore + rateScore) / 4
      );

      return Math.max(0, Math.min(100, engagementScore));
    } catch (error) {
      this.logger.error(
        `Error calculating engagement score for user ${userId}:`,
        error
      );
      return 0;
    }
  }

  async getBatchEngagementScores(
    userIds: string[],
    timeRange: { start: Date; end: Date }
  ): Promise<Map<string, number>> {
    const scores = new Map<string, number>();

    // Process in parallel for better performance
    const promises = userIds.map(async (userId) => {
      const score = await this.getUserEngagementScore(userId, timeRange);
      return { userId, score };
    });

    const results = await Promise.allSettled(promises);

    results.forEach((result) => {
      if (result.status === 'fulfilled') {
        scores.set(result.value.userId, result.value.score);
      }
    });

    return scores;
  }

  async getActivityHeatmap(
    userId: string,
    days: number = 7
  ): Promise<Array<{ hour: number; day: number; activity: number }>> {
    try {
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const activities = await this.getRecentActivity(userId, since, 10000);

      // Create 24x7 heatmap (24 hours x 7 days)
      const heatmap = Array.from({ length: 24 }, (_, hour) =>
        Array.from({ length: 7 }, (_, day) => ({
          hour,
          day,
          activity: 0,
        }))
      ).flat();

      // Count activities by hour and day of week
      activities.forEach((activity) => {
        const hour = activity.timestamp.getHours();
        const day = activity.timestamp.getDay();

        const cell = heatmap.find((h) => h.hour === hour && h.day === day);
        if (cell) {
          cell.activity++;
        }
      });

      return heatmap;
    } catch (error) {
      this.logger.error(
        `Error generating activity heatmap for user ${userId}:`,
        error
      );
      return [];
    }
  }

  async cleanupOldActivities(): Promise<void> {
    try {
      const pattern = 'user_activity:*';
      // Use SCAN instead of KEYS to prevent blocking Redis in production
      const keys = await scanKeys(this.redis, pattern);

      const cutoff = Date.now() - this.ACTIVITY_TTL * 1000;

      for (const key of keys) {
        // Remove activities older than TTL
        await this.redis.zremrangebyscore(key, 0, cutoff);

        // Remove empty keys
        const count = await this.redis.zcard(key);
        if (count === 0) {
          await this.redis.del(key);
        }
      }

      this.logger.debug(
        `🧹 Cleaned up old activities for ${keys.length} users`
      );
    } catch (error) {
      this.logger.error('Error cleaning up old activities:', error);
    }
  }

  // Private helper methods

  private async updateRealTimeIndicators(
    userId: string,
    activityType: string
  ): Promise<void> {
    await withErrorHandling(
      this.logger,
      'updating real-time indicators',
      async () => {
        const key = `user_realtime:${userId}`;
        const now = Date.now();

        // Update last activity timestamp
        await this.redis.hset(key, 'lastActivity', now.toString());

        // Update activity type counter
        await this.redis.hincrby(key, `count_${activityType}`, 1);

        // Set TTL for cleanup
        await this.redis.expire(key, 300); // 5 minutes
      },
      { throwOnError: false }
    );
  }

  private computeActivityPattern(
    userId: string,
    timeRange: { start: Date; end: Date },
    activities: UserActivity[]
  ): ActivityPattern {
    const activityTypes: Record<string, number> = {};
    const sessions: Array<{
      start: Date;
      end: Date;
      activities: UserActivity[];
    }> = [];
    let currentSession: {
      start: Date;
      end: Date;
      activities: UserActivity[];
    } | null = null;

    // Count activity types and group into sessions
    activities.forEach((activity, index) => {
      // Count activity types
      activityTypes[activity.activityType] =
        (activityTypes[activity.activityType] || 0) + 1;

      // Session grouping (5-minute gaps create new sessions)
      const prevActivity = activities[index - 1];
      const isNewSession =
        !prevActivity ||
        activity.timestamp.getTime() - prevActivity.timestamp.getTime() >
          5 * 60 * 1000;

      if (isNewSession) {
        if (currentSession) {
          sessions.push(currentSession);
        }
        currentSession = {
          start: activity.timestamp,
          end: activity.timestamp,
          activities: [activity],
        };
      } else if (currentSession) {
        currentSession.end = activity.timestamp;
        currentSession.activities.push(activity);
      }
    });

    if (currentSession) {
      sessions.push(currentSession);
    }

    // Calculate peak activity periods (high activity density)
    const peakActivityPeriods = this.findPeakActivityPeriods(activities);

    // Calculate inactive periods
    const inactivePeriods = this.findInactivePeriods(sessions, timeRange);

    // Calculate average session length
    const averageSessionLength =
      sessions.length > 0
        ? sessions.reduce(
            (sum, session) =>
              sum + (session.end.getTime() - session.start.getTime()),
            0
          ) /
          sessions.length /
          1000 /
          60
        : 0;

    // Device breakdown
    const deviceBreakdown: Record<string, number> = {};
    activities.forEach((activity) => {
      const device = activity.metadata?.deviceType || 'unknown';
      deviceBreakdown[device] = (deviceBreakdown[device] || 0) + 1;
    });

    return {
      userId,
      timeRange,
      totalActivityCount: activities.length,
      activityTypes,
      peakActivityPeriods,
      inactivePeriods,
      averageSessionLength,
      deviceBreakdown,
    };
  }

  private findPeakActivityPeriods(
    activities: UserActivity[]
  ): Array<{ start: Date; end: Date; intensity: number }> {
    const periods: Array<{ start: Date; end: Date; intensity: number }> = [];
    const windowSize = 10 * 60 * 1000; // 10 minutes

    for (let i = 0; i < activities.length; i++) {
      const windowStart = activities[i].timestamp;
      const windowEnd = new Date(windowStart.getTime() + windowSize);

      // Count activities in this window
      const activitiesInWindow = activities.filter(
        (a) => a.timestamp >= windowStart && a.timestamp <= windowEnd
      );

      // Consider it a peak if there are more than 10 activities in 10 minutes
      if (activitiesInWindow.length >= 10) {
        const intensity = activitiesInWindow.length;
        const existing = periods.find(
          (p) =>
            Math.abs(p.start.getTime() - windowStart.getTime()) < windowSize / 2
        );

        if (existing) {
          // Merge overlapping periods
          if (intensity > existing.intensity) {
            existing.start = windowStart;
            existing.end = windowEnd;
            existing.intensity = intensity;
          }
        } else {
          periods.push({
            start: windowStart,
            end: windowEnd,
            intensity,
          });
        }
      }
    }

    return periods;
  }

  private findInactivePeriods(
    sessions: Array<{ start: Date; end: Date; activities: UserActivity[] }>,
    timeRange: { start: Date; end: Date }
  ): Array<{ start: Date; end: Date; duration: number }> {
    const inactivePeriods: Array<{ start: Date; end: Date; duration: number }> =
      [];

    for (let i = 0; i < sessions.length - 1; i++) {
      const currentSession = sessions[i];
      const nextSession = sessions[i + 1];

      const gapStart = currentSession.end;
      const gapEnd = nextSession.start;
      const duration = gapEnd.getTime() - gapStart.getTime();

      // Only consider gaps longer than 10 minutes as inactive periods
      if (duration > 10 * 60 * 1000) {
        inactivePeriods.push({
          start: gapStart,
          end: gapEnd,
          duration: duration / 1000 / 60, // Duration in minutes
        });
      }
    }

    return inactivePeriods;
  }

  private getEmptyPattern(
    userId: string,
    timeRange: { start: Date; end: Date }
  ): ActivityPattern {
    return {
      userId,
      timeRange,
      totalActivityCount: 0,
      activityTypes: {},
      peakActivityPeriods: [],
      inactivePeriods: [],
      averageSessionLength: 0,
      deviceBreakdown: {},
    };
  }
}
