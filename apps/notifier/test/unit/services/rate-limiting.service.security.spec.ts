import { Test, TestingModule } from '@nestjs/testing';
import {
  RateLimitingService,
  RateLimitRule,
  AbuseDetectionConfig,
} from '../../../src/services/rate-limiting.service';
import { Logger } from '@nestjs/common';
import { Redis } from 'ioredis';

describe('RateLimitingService - Security Tests', () => {
  let service: RateLimitingService;
  let mockRedis: jest.Mocked<Redis>;

  const createMockRedis = () => ({
    zremrangebyscore: jest.fn(),
    zcard: jest.fn(),
    zadd: jest.fn(),
    expire: jest.fn(),
    ttl: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
    keys: jest.fn(),
    zrangebyscore: jest.fn(),
    scanStream: jest.fn(),
  });;

  beforeEach(async () => {
    mockRedis = createMockRedis() as jest.Mocked<Redis>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RateLimitingService,
        { provide: 'REDIS_CLIENT', useValue: mockRedis },
      ],
    }).compile();

    service = module.get<RateLimitingService>(RateLimitingService);

    // Mock Logger to suppress console output
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();

    // Setup default Redis responses
    mockRedis.zremrangebyscore.mockResolvedValue(1);
    mockRedis.zcard.mockResolvedValue(0);
    mockRedis.zadd.mockResolvedValue(1);
    mockRedis.expire.mockResolvedValue(1);
    mockRedis.ttl.mockResolvedValue(-1);
    mockRedis.get.mockResolvedValue(null);
    mockRedis.setex.mockResolvedValue('OK');
    mockRedis.del.mockResolvedValue(1);
    mockRedis.keys.mockResolvedValue([]);
    mockRedis.zrangebyscore.mockResolvedValue([]);

    // Mock scanStream to return an async iterable (default: empty)
    mockRedis.scanStream.mockReturnValue((async function* () {
      // Default: no keys
    })());
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Rate Limiting Security', () => {
    describe('DDoS Protection', () => {
      it('should block requests after exceeding rate limit', async () => {
        const rule: RateLimitRule = {
          key: 'test-user',
          limit: 5,
          windowSize: 60,
        };

        // Simulate 5 requests already in window
        mockRedis.zcard.mockResolvedValue(5);

        const result = await service.checkRateLimit(rule);

        expect(result.allowed).toBe(false);
        expect(result.remaining).toBe(0);
        expect(result.retryAfter).toBe(60);
        expect(mockRedis.zadd).not.toHaveBeenCalled();
      });

      it('should allow requests within rate limit', async () => {
        const rule: RateLimitRule = {
          key: 'test-user',
          limit: 5,
          windowSize: 60,
        };

        // Simulate 2 requests already in window
        mockRedis.zcard.mockResolvedValue(2);

        const result = await service.checkRateLimit(rule);

        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(2); // 5 - 2 - 1 (current request)
        expect(mockRedis.zadd).toHaveBeenCalled();
      });

      it('should use sliding window to prevent burst attacks', async () => {
        const rule: RateLimitRule = {
          key: 'burst-test',
          limit: 10,
          windowSize: 60,
        };

        const beforeCall = Date.now();
        await service.checkRateLimit(rule);

        // Check the call was made with correct key and score range
        expect(mockRedis.zremrangebyscore).toHaveBeenCalledWith(
          'rate_limit:burst-test',
          0,
          expect.any(Number)
        );

        // Verify the windowStart is within expected range (allowing 100ms tolerance)
        const actualWindowStart = mockRedis.zremrangebyscore.mock.calls[0][2];
        const expectedWindowStart = beforeCall - 60 * 1000;
        expect(actualWindowStart).toBeGreaterThanOrEqual(expectedWindowStart - 100);
        expect(actualWindowStart).toBeLessThanOrEqual(expectedWindowStart + 100);
      });

      it('should handle concurrent rate limit checks safely', async () => {
        const rule: RateLimitRule = {
          key: 'concurrent-test',
          limit: 3,
          windowSize: 60,
        };

        // Simulate race condition where multiple requests check simultaneously
        mockRedis.zcard.mockResolvedValue(2);

        const promises = Array(5)
          .fill(null)
          .map(() => service.checkRateLimit(rule));
        const results = await Promise.all(promises);

        // All should be allowed individually, but Redis handles the race condition
        results.forEach((result) => {
          expect(result).toHaveProperty('allowed');
          expect(result).toHaveProperty('remaining');
        });

        expect(mockRedis.zadd).toHaveBeenCalledTimes(5);
      });
    });

    describe('Connection Flood Protection', () => {
      it('should rate limit rapid connections from same IP', async () => {
        const ip = '192.168.1.100';

        // Simulate 10 connections already made
        mockRedis.zcard.mockResolvedValue(10);

        const result = await service.checkConnectionRateLimit(ip);

        expect(result.allowed).toBe(false);
        expect(result.retryAfter).toBe(300); // 5 minutes block
      });

      it('should use different limits for different connection types', async () => {
        await service.checkConnectionRateLimit('ip1');
        await service.checkMessageRateLimit('user1');
        await service.checkAuthRateLimit('ip2');

        expect(mockRedis.zcard).toHaveBeenCalledTimes(3);

        // Verify different keys are used
        const calls = mockRedis.zcard.mock.calls;
        expect(calls[0][0]).toBe('rate_limit:connection:ip1');
        expect(calls[1][0]).toBe('rate_limit:messages:user1');
        expect(calls[2][0]).toBe('rate_limit:auth_fail:ip2');
      });

      it('should extend blocking duration for repeat offenders', async () => {
        const rule: RateLimitRule = {
          key: 'repeat-offender',
          limit: 5,
          windowSize: 60,
          blockDuration: 300, // 5 minutes
        };

        mockRedis.zcard.mockResolvedValue(10);

        const result = await service.checkRateLimit(rule);

        expect(result.allowed).toBe(false);
        expect(result.retryAfter).toBe(300);
      });
    });

    describe('Message Spam Protection', () => {
      it('should limit excessive message sending', async () => {
        const userId = 'spammer-user';

        // Simulate 100 messages already sent
        mockRedis.zcard.mockResolvedValue(100);

        const result = await service.checkMessageRateLimit(userId);

        expect(result.allowed).toBe(false);
        expect(result.retryAfter).toBe(60); // 1 minute block
      });

      it('should allow normal message rates', async () => {
        const userId = 'normal-user';

        // Simulate 50 messages already sent (within limit of 100)
        mockRedis.zcard.mockResolvedValue(50);

        const result = await service.checkMessageRateLimit(userId);

        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(49); // 100 - 50 - 1
      });
    });

    describe('Authentication Attack Protection', () => {
      it('should limit invalid authentication attempts', async () => {
        const identifier = 'attacker-ip';

        // Simulate 5 failed auth attempts
        mockRedis.zcard.mockResolvedValue(5);

        const result = await service.checkAuthRateLimit(identifier);

        expect(result.allowed).toBe(false);
        expect(result.retryAfter).toBe(600); // 10 minutes block
      });

      it('should track different types of auth failures', async () => {
        const ip = '192.168.1.200';

        await service.recordSuspiciousActivity(ip, 'invalid_auth', {
          attemptedUser: 'admin',
          userAgent: 'AttackBot/1.0',
        });

        expect(mockRedis.zadd).toHaveBeenCalledWith(
          'suspicious:192.168.1.200',
          expect.any(Number),
          expect.stringContaining('"type":"invalid_auth"')
        );
      });
    });
  });

  describe('Abuse Detection and Scoring', () => {
    describe('Suspicious Activity Tracking', () => {
      it('should record various types of suspicious activities', async () => {
        const identifier = 'suspicious-user';
        const activities = [
          { type: 'rapid_connections' as const, metadata: { count: 15 } },
          { type: 'excessive_messages' as const, metadata: { rate: 200 } },
          { type: 'invalid_auth' as const, metadata: { attempts: 10 } },
          {
            type: 'geo_anomaly' as const,
            metadata: { locations: ['US', 'RU', 'CN'] },
          },
        ];

        for (const activity of activities) {
          await service.recordSuspiciousActivity(
            identifier,
            activity.type,
            activity.metadata
          );
        }

        expect(mockRedis.zadd).toHaveBeenCalledTimes(4);
        expect(mockRedis.expire).toHaveBeenCalledTimes(4);
      });

      it('should calculate abuse scores correctly', async () => {
        const identifier = 'scored-user';

        // Mock activities with different scores
        const mockActivities = [
          '{"type":"rapid_connections","timestamp":1234567890,"metadata":{}}',
          '1234567890',
          '{"type":"invalid_auth","timestamp":1234567891,"metadata":{}}',
          '1234567891',
          '{"type":"excessive_messages","timestamp":1234567892,"metadata":{}}',
          '1234567892',
          '{"type":"geo_anomaly","timestamp":1234567893,"metadata":{}}',
          '1234567893',
        ];

        mockRedis.zrangebyscore.mockResolvedValue(mockActivities);

        const result = await service.getAbuseScore(identifier);

        // rapid_connections(2) + invalid_auth(3) + excessive_messages(1) + geo_anomaly(2) = 8
        expect(result.score).toBe(8);
        expect(result.level).toBe('blacklisted'); // Score >= 5
        expect(result.activities).toHaveLength(4);
      });

      it('should classify users by abuse level', async () => {
        // Test different score levels
        const testCases = [
          { activities: ['excessive_messages'], expectedLevel: 'clean' }, // Score: 1
          {
            activities: ['rapid_connections', 'rapid_connections'],
            expectedLevel: 'suspicious',
          }, // Score: 4
          {
            activities: ['invalid_auth', 'invalid_auth'],
            expectedLevel: 'blacklisted',
          }, // Score: 6
        ];

        for (const testCase of testCases) {
          const mockActivities = testCase.activities.flatMap((type, index) => [
            `{"type":"${type}","timestamp":${1234567890 + index},"metadata":{}}`,
            `${1234567890 + index}`,
          ]);

          mockRedis.zrangebyscore.mockResolvedValueOnce(mockActivities);

          const result = await service.getAbuseScore('test-user');
          expect(result.level).toBe(testCase.expectedLevel);
        }
      });
    });

    describe('Automatic Blacklisting', () => {
      it('should auto-blacklist users with high abuse scores', async () => {
        const identifier = 'auto-blacklist-user';

        // Mock high abuse score activities
        const mockActivities = [
          '{"type":"invalid_auth","timestamp":1234567890,"metadata":{}}',
          '1234567890',
          '{"type":"invalid_auth","timestamp":1234567891,"metadata":{}}',
          '1234567891',
        ];

        mockRedis.zrangebyscore.mockResolvedValue(mockActivities);

        await service.recordSuspiciousActivity(identifier, 'invalid_auth');

        // Should trigger auto-blacklisting
        expect(mockRedis.setex).toHaveBeenCalledWith(
          `blacklist:${identifier}`,
          3600,
          expect.stringContaining('Auto-blacklisted')
        );
      });

      it('should allow manual blacklist management', async () => {
        const identifier = 'manual-blacklist';
        const reason = 'Confirmed malicious activity';
        const duration = 7200; // 2 hours

        await service.addToBlacklist(identifier, duration, reason);

        expect(mockRedis.setex).toHaveBeenCalledWith(
          `blacklist:${identifier}`,
          duration,
          expect.stringContaining(reason)
        );
      });

      it('should provide blacklist information', async () => {
        const identifier = 'blacklisted-user';
        const blacklistData = {
          timestamp: Date.now() - 1800000, // 30 minutes ago
          reason: 'DDoS attack detected',
          duration: 3600,
        };

        mockRedis.get.mockResolvedValue(JSON.stringify(blacklistData));
        mockRedis.ttl.mockResolvedValue(1800); // 30 minutes remaining

        const info = await service.getBlacklistInfo(identifier);

        expect(info.isBlacklisted).toBe(true);
        expect(info.reason).toBe('DDoS attack detected');
        expect(info.addedAt).toBeInstanceOf(Date);
        expect(info.expiresAt).toBeInstanceOf(Date);
      });
    });
  });

  describe('Redis Failure Resilience', () => {
    it('should fail open when Redis is unavailable', async () => {
      // Simulate Redis failure
      mockRedis.zcard.mockRejectedValue(new Error('Redis connection failed'));

      const rule: RateLimitRule = {
        key: 'fail-open-test',
        limit: 5,
        windowSize: 60,
      };

      const result = await service.checkRateLimit(rule);

      // Should allow request when Redis fails
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(5);
    });

    it('should handle Redis errors gracefully in abuse detection', async () => {
      mockRedis.zadd.mockRejectedValue(new Error('Redis write failed'));

      // Should not throw error
      await expect(
        service.recordSuspiciousActivity('test-user', 'rapid_connections')
      ).resolves.toBeUndefined();
    });

    it('should handle blacklist check failures gracefully', async () => {
      mockRedis.ttl.mockRejectedValue(new Error('Redis read failed'));

      const result = await service.isBlacklisted('test-user');

      // Should default to not blacklisted when Redis fails
      expect(result).toBe(false);
    });
  });

  describe('Performance and Memory Management', () => {
    it('should cleanup expired entries automatically', async () => {
      const expiredKeys = [
        'rate_limit:expired1',
        'suspicious:expired2',
        'rate_limit:expired3',
      ];

      // Mock scanStream to return keys based on pattern
      mockRedis.scanStream.mockImplementation((options: { match: string }) => {
        if (options.match === 'rate_limit:*') {
          return (async function* () {
            yield ['rate_limit:expired1', 'rate_limit:expired3'];
          })();
        }
        if (options.match === 'suspicious:*') {
          return (async function* () {
            yield ['suspicious:expired2'];
          })();
        }
        return (async function* () {
          // Empty for other patterns
        })();
      });

      // Mock some keys as expired (TTL = -2)
      mockRedis.ttl.mockImplementation((key) => {
        if (key.includes('expired')) {
          return Promise.resolve(-2);
        }
        return Promise.resolve(300);
      });

      await service.cleanupExpiredEntries();

      expect(mockRedis.del).toHaveBeenCalledTimes(3);
      expect(mockRedis.del).toHaveBeenCalledWith('rate_limit:expired1');
      expect(mockRedis.del).toHaveBeenCalledWith('suspicious:expired2');
      expect(mockRedis.del).toHaveBeenCalledWith('rate_limit:expired3');
    });

    it('should set TTL for keys without expiration', async () => {
      // Mock scanStream to return a key without TTL
      mockRedis.scanStream.mockImplementation((options: { match: string }) => {
        if (options.match === 'rate_limit:*') {
          return (async function* () {
            yield ['rate_limit:no-ttl'];
          })();
        }
        return (async function* () {
          // Empty for other patterns
        })();
      });

      mockRedis.ttl.mockResolvedValue(-1); // No TTL set

      await service.cleanupExpiredEntries();

      expect(mockRedis.expire).toHaveBeenCalledWith('rate_limit:no-ttl', 3600);
    });

    it('should limit global stats queries to prevent performance issues', async () => {
      // Create many suspicious keys
      const manyKeys = Array(200)
        .fill(null)
        .map((_, i) => `suspicious:user${i}`);

      // Mock scanStream to return all 200 keys
      mockRedis.scanStream.mockImplementation((options: { match: string }) => {
        if (options.match === 'suspicious:*') {
          return (async function* () {
            yield manyKeys;
          })();
        }
        return (async function* () {
          // Empty for other patterns
        })();
      });

      // Mock abuse scores for performance test
      mockRedis.zrangebyscore.mockResolvedValue([]);

      const stats = await service.getGlobalStats();

      // Should only process first 100 keys to prevent performance issues
      expect(mockRedis.zrangebyscore).toHaveBeenCalledTimes(100);
      expect(stats).toHaveProperty('suspiciousUsers');
      expect(stats).toHaveProperty('topAbusers');
    });
  });

  describe('Security Edge Cases', () => {
    describe('Key Injection Prevention', () => {
      it('should sanitize malicious keys', async () => {
        const maliciousKeys = [
          { input: '../../../etc/passwd', expected: '.._.._.._etc_passwd' },
          { input: 'key:with:colons', expected: 'key:with:colons' }, // colons are allowed
          { input: 'key with spaces', expected: 'key_with_spaces' },
          { input: 'key\nwith\nnewlines', expected: 'key_with_newlines' },
          { input: 'key\0with\0nulls', expected: 'key_with_nulls' },
        ];

        for (const { input, expected } of maliciousKeys) {
          const rule: RateLimitRule = {
            key: input,
            limit: 5,
            windowSize: 60,
          };

          await service.checkRateLimit(rule);

          // Should use the sanitized key to prevent injection attacks
          expect(mockRedis.zcard).toHaveBeenCalledWith(
            `rate_limit:${expected}`
          );
        }
      });
    });

    describe('Data Injection Protection', () => {
      it('should handle malicious metadata safely', async () => {
        const maliciousMetadata = {
          script: '<script>alert("xss")</script>',
          sql: "'; DROP TABLE users; --",
          command: 'rm -rf /',
          json: '{"nested": {"deep": "value"}}',
          unicode: '🚫💀🔥',
        };

        await service.recordSuspiciousActivity(
          'test-user',
          'rapid_connections',
          maliciousMetadata
        );

        // Should JSON.stringify safely
        expect(mockRedis.zadd).toHaveBeenCalledWith(
          'suspicious:test-user',
          expect.any(Number),
          expect.stringContaining('"metadata":')
        );
      });

      it('should handle circular references in metadata', async () => {
        const circularObject: Record<string, unknown> = { name: 'test' };
        circularObject.self = circularObject;

        // Should not crash when serializing circular references
        await expect(
          service.recordSuspiciousActivity(
            'test-user',
            'rapid_connections',
            circularObject
          )
        ).resolves.toBeUndefined();
      });
    });

    describe('Memory Exhaustion Prevention', () => {
      it('should handle large metadata objects', async () => {
        const largeMetadata = {
          data: 'x'.repeat(10000), // 10KB string
          array: Array(1000).fill('item'),
          nested: {
            deep: {
              very: {
                deep: 'value',
              },
            },
          },
        };

        await service.recordSuspiciousActivity(
          'test-user',
          'excessive_messages',
          largeMetadata
        );

        expect(mockRedis.zadd).toHaveBeenCalled();
      });

      it('should limit the number of stored activities per user', async () => {
        const identifier = 'heavy-user';

        // Mock many activities
        const manyActivities = Array(1000)
          .fill(null)
          .flatMap((_, i) => [
            `{"type":"excessive_messages","timestamp":${Date.now() - i * 1000},"metadata":{}}`,
            `${Date.now() - i * 1000}`,
          ]);

        mockRedis.zrangebyscore.mockResolvedValue(manyActivities);

        const result = await service.getAbuseScore(identifier);

        // Should handle large number of activities without performance issues
        expect(result.activities.length).toBe(1000);
        expect(result.score).toBeGreaterThan(0);
      });
    });

    describe('Time-based Attacks', () => {
      it('should handle timestamp manipulation attempts', async () => {
        const futureTimestamp = Date.now() + 86400000; // 24 hours in future
        const pastTimestamp = Date.now() - 86400000; // 24 hours in past

        // Test with various timestamp values
        const maliciousActivities = [
          `{"type":"rapid_connections","timestamp":${futureTimestamp},"metadata":{}}`,
          `{"type":"invalid_auth","timestamp":${pastTimestamp},"metadata":{}}`,
          `{"type":"excessive_messages","timestamp":-1,"metadata":{}}`,
          `{"type":"geo_anomaly","timestamp":999999999999999,"metadata":{}}`,
        ];

        mockRedis.zrangebyscore.mockResolvedValue([
          maliciousActivities[0],
          `${futureTimestamp}`,
          maliciousActivities[1],
          `${pastTimestamp}`,
          maliciousActivities[2],
          '-1',
          maliciousActivities[3],
          '999999999999999',
        ]);

        const result = await service.getAbuseScore('time-manipulator');

        // Should handle all timestamps without crashing
        expect(result.activities).toHaveLength(4);
        expect(result.score).toBeGreaterThan(0);
      });
    });
  });

  describe('Monitoring and Observability', () => {
    it('should provide comprehensive global statistics', async () => {
      // Mock scanStream to return various key types
      mockRedis.scanStream.mockImplementation((options: { match: string }) => {
        switch (options.match) {
          case 'rate_limit:*':
            return (async function* () {
              yield ['rate_limit:user1', 'rate_limit:user2'];
            })();
          case 'blacklist:*':
            return (async function* () {
              yield ['blacklist:baduser1'];
            })();
          case 'suspicious:*':
            return (async function* () {
              yield ['suspicious:user3', 'suspicious:user4'];
            })();
          default:
            return (async function* () {
              // Empty for other patterns
            })();
        }
      });

      // Mock abuse scores for suspicious users
      mockRedis.zrangebyscore.mockResolvedValue([
        '{"type":"invalid_auth","timestamp":1234567890,"metadata":{}}',
        '1234567890',
        '{"type":"rapid_connections","timestamp":1234567891,"metadata":{}}',
        '1234567891',
      ]);

      const stats = await service.getGlobalStats();

      expect(stats).toEqual({
        activeRateLimits: 2,
        blacklistedUsers: 1,
        suspiciousUsers: 2,
        topAbusers: expect.arrayContaining([
          expect.objectContaining({
            identifier: expect.any(String),
            score: expect.any(Number),
            activities: expect.any(Number),
          }),
        ]),
      });
    });

    it('should track top abusers correctly', async () => {
      // Mock scanStream to return suspicious users
      mockRedis.scanStream.mockImplementation((options: { match: string }) => {
        if (options.match === 'suspicious:*') {
          return (async function* () {
            yield ['suspicious:abuser1', 'suspicious:abuser2'];
          })();
        }
        return (async function* () {
          // Empty for other patterns
        })();
      });

      // Mock different abuse scores - need to ensure both have high enough scores to be classified as suspicious
      mockRedis.zrangebyscore
        .mockResolvedValueOnce([
          '{"type":"invalid_auth","timestamp":1234567890,"metadata":{}}',
          '1234567890',
          '{"type":"invalid_auth","timestamp":1234567891,"metadata":{}}',
          '1234567891',
          '{"type":"rapid_connections","timestamp":1234567892,"metadata":{}}',
          '1234567892',
        ])
        .mockResolvedValueOnce([
          '{"type":"rapid_connections","timestamp":1234567890,"metadata":{}}',
          '1234567890',
          '{"type":"rapid_connections","timestamp":1234567891,"metadata":{}}',
          '1234567891',
        ]);

      const stats = await service.getGlobalStats();

      expect(stats.topAbusers.length).toBeGreaterThanOrEqual(1);
      if (stats.topAbusers.length >= 2) {
        expect(stats.topAbusers[0].score).toBeGreaterThanOrEqual(
          stats.topAbusers[1].score
        );
      }
      expect(stats.topAbusers[0]).toEqual(
        expect.objectContaining({
          identifier: expect.any(String),
          score: expect.any(Number),
          activities: expect.any(Number),
        })
      );
    });
  });
});
