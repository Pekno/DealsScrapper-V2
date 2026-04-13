import { Logger } from '@nestjs/common';
import { Redis } from 'ioredis';
import type { IEnhancedLogger } from '@dealscrapper/shared-logging';

/**
 * Store object as JSON in Redis with optional TTL.
 * Automatically serializes to JSON.
 *
 * @param redis - Redis client instance
 * @param key - Redis key
 * @param value - Value to store (will be JSON serialized)
 * @param ttl - Optional time-to-live in seconds
 *
 * @example
 * ```typescript
 * await setRedisJson(this.redis, `user:${userId}`, userData, 3600);
 * ```
 */
export async function setRedisJson<T>(
  redis: Redis,
  key: string,
  value: T,
  ttl?: number
): Promise<void> {
  const json = JSON.stringify(value);
  if (ttl) {
    await redis.setex(key, ttl, json);
  } else {
    await redis.set(key, json);
  }
}

/**
 * Retrieve and parse JSON from Redis.
 * Returns null if key doesn't exist or parsing fails.
 *
 * @param redis - Redis client instance
 * @param key - Redis key
 * @param logger - Optional logger for parse errors
 * @returns Parsed object or null
 *
 * @example
 * ```typescript
 * const user = await getRedisJson<User>(this.redis, `user:${userId}`, this.logger);
 * if (!user) {
 *   throw new NotFoundException('User not found');
 * }
 * ```
 */
export async function getRedisJson<T>(
  redis: Redis,
  key: string,
  logger?: Logger | IEnhancedLogger
): Promise<T | null> {
  try {
    const data = await redis.get(key);
    if (!data) return null;
    return JSON.parse(data) as T;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (logger) {
      const errorStr = `Error parsing JSON from Redis key "${key}": ${errorMessage}`;
      if (error instanceof Error && error.stack) {
        logger.error(errorStr, error.stack);
      } else {
        logger.error(errorStr);
      }
    }
    return null;
  }
}

/**
 * Add object to Redis sorted set with JSON serialization.
 *
 * @param redis - Redis client instance
 * @param key - Sorted set key
 * @param score - Score for sorted set ordering
 * @param value - Value to store (will be JSON serialized)
 *
 * @example
 * ```typescript
 * await zaddRedisJson(this.redis, 'user_activity:123', Date.now(), activity);
 * ```
 */
export async function zaddRedisJson<T>(
  redis: Redis,
  key: string,
  score: number,
  value: T
): Promise<void> {
  await redis.zadd(key, score, JSON.stringify(value));
}

/**
 * Retrieve and parse objects from Redis sorted set.
 *
 * @param redis - Redis client instance
 * @param key - Sorted set key
 * @param start - Start index or score
 * @param stop - Stop index or score
 * @param options - Range options
 * @returns Array of parsed objects with optional scores
 *
 * @example
 * ```typescript
 * const activities = await zrangeRedisJson<Activity>(
 *   this.redis,
 *   'user_activity:123',
 *   0,
 *   -1,
 *   { withScores: true }
 * );
 * ```
 */
export async function zrangeRedisJson<T>(
  redis: Redis,
  key: string,
  start: number | string,
  stop: number | string,
  options?: { withScores?: boolean; rev?: boolean }
): Promise<Array<{ value: T; score?: number }>> {
  const args: Array<string | number> = [key, start, stop];
  if (options?.rev) args.push('REV');
  if (options?.withScores) args.push('WITHSCORES');

  const results = await redis.zrange(...(args as [string, number | string, number | string]));
  const parsed: Array<{ value: T; score?: number }> = [];

  const step = options?.withScores ? 2 : 1;
  for (let i = 0; i < results.length; i += step) {
    try {
      const value = JSON.parse(results[i]) as T;
      const score = options?.withScores ? parseFloat(results[i + 1]) : undefined;
      parsed.push({ value, score });
    } catch {
      // Skip malformed entries
      continue;
    }
  }

  return parsed;
}

/**
 * Retrieve and parse objects from Redis sorted set by score range (reverse order).
 *
 * @param redis - Redis client instance
 * @param key - Sorted set key
 * @param max - Maximum score (or '+inf')
 * @param min - Minimum score (or '-inf')
 * @param options - Range and limit options
 * @returns Array of parsed objects with optional scores
 *
 * @example
 * ```typescript
 * const recentActivities = await zrevrangebyscoreRedisJson<Activity>(
 *   this.redis,
 *   'user_activity:123',
 *   '+inf',
 *   sinceTimestamp,
 *   { withScores: true, limit: { offset: 0, count: 100 } }
 * );
 * ```
 */
export async function zrevrangebyscoreRedisJson<T>(
  redis: Redis,
  key: string,
  max: number | string,
  min: number | string,
  options?: {
    withScores?: boolean;
    limit?: { offset: number; count: number };
  }
): Promise<Array<{ value: T; score?: number }>> {
  const args: Array<string | number> = [key, max, min];

  if (options?.withScores) {
    args.push('WITHSCORES');
  }

  if (options?.limit) {
    args.push('LIMIT', options.limit.offset, options.limit.count);
  }

  const results = await redis.zrevrangebyscore(
    ...(args as [string, number | string, number | string])
  );
  const parsed: Array<{ value: T; score?: number }> = [];

  const step = options?.withScores ? 2 : 1;
  for (let i = 0; i < results.length; i += step) {
    try {
      const value = JSON.parse(results[i]) as T;
      const score = options?.withScores ? parseFloat(results[i + 1]) : undefined;
      parsed.push({ value, score });
    } catch {
      // Skip malformed entries
      continue;
    }
  }

  return parsed;
}

/**
 * Safe JSON.parse with error handling.
 * Returns fallback value on parse error.
 *
 * @param json - JSON string to parse
 * @param fallback - Fallback value on error
 * @param logger - Optional logger
 * @returns Parsed value or fallback
 *
 * @example
 * ```typescript
 * const config = safeJsonParse(rawConfig, {}, this.logger);
 * ```
 */
export function safeJsonParse<T>(
  json: string,
  fallback: T,
  logger?: Logger | IEnhancedLogger
): T {
  try {
    return JSON.parse(json) as T;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (logger) {
      const errorStr = `JSON parse error: ${errorMessage}`;
      if (error instanceof Error && error.stack) {
        logger.error(errorStr, error.stack);
      } else {
        logger.error(errorStr);
      }
    }
    return fallback;
  }
}

/**
 * Scan Redis keys matching pattern (non-blocking alternative to KEYS).
 *
 * Uses SCAN instead of KEYS to prevent blocking Redis in production.
 * KEYS is O(N) and blocks the entire Redis server, while SCAN is O(1) per call
 * and allows interleaving with other operations.
 *
 * @param redis - Redis client instance
 * @param pattern - Key pattern to match (e.g., 'user_activity:*')
 * @param count - Batch size hint for SCAN (default: 100)
 * @returns Array of matching keys
 *
 * @example
 * ```typescript
 * // Scan all user activity keys
 * const keys = await scanKeys(this.redis, 'user_activity:*');
 *
 * // Scan with custom batch size
 * const keys = await scanKeys(this.redis, 'delivery:*', 50);
 * ```
 */
export async function scanKeys(
  redis: Redis,
  pattern: string,
  count: number = 100
): Promise<string[]> {
  const stream = redis.scanStream({ match: pattern, count });
  const keys: string[] = [];

  for await (const keyBatch of stream) {
    keys.push(...keyBatch);
  }

  return keys;
}
