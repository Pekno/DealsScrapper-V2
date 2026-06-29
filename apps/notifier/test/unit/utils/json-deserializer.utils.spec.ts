import { Prisma } from '@prisma/client';
import { UnifiedNotificationPayload, SiteSource } from '@dealscrapper/shared-types';
import {
  deserializeNotificationPayload,
  deserializeNotificationPayloadOrNull,
} from '../../../src/utils/json-deserializer.utils.js';

/**
 * Builds a valid deal-match payload exactly as the scraper producer persists it:
 * a `UnifiedNotificationPayload` with NO `userId` field (the owning user lives on
 * the `Notification.userId` column, not in the content blob).
 */
function buildDealMatchPayload(): UnifiedNotificationPayload {
  return {
    id: 'notif_1234567890_abcdef',
    siteId: SiteSource.DEALABS,
    type: 'DEAL_MATCH',
    title: '🎯 New Deal: Test Item',
    message: '€19.99 - 50% off at TestMerchant',
    matchId: 'match-123',
    dedupKey: 'deal-match-match-123',
    filterId: 'filter-123',
    data: {
      dealData: {
        title: 'Test Item',
        price: 19.99,
        merchant: 'TestMerchant',
        score: 85,
      },
    },
    timestamp: new Date().toISOString(),
    read: false,
  };
}

describe('json-deserializer.utils', () => {
  describe('deserializeNotificationPayload', () => {
    it('deserializes a deal-match payload that has no userId field (regression: delivery-blocking bug)', () => {
      // Arrange
      const payload = buildDealMatchPayload();
      expect('userId' in payload).toBe(false);
      const stored = payload as unknown as Prisma.JsonValue;

      // Act
      const result = deserializeNotificationPayload(stored);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.type).toBe('DEAL_MATCH');
        expect(result.data.id).toBe('notif_1234567890_abcdef');
        expect(result.data.dedupKey).toBe('deal-match-match-123');
      }
    });

    it('accepts SYSTEM payloads (email-verification / password-reset are persisted as SYSTEM)', () => {
      // Arrange
      const payload = {
        ...buildDealMatchPayload(),
        type: 'SYSTEM',
      } as unknown as Prisma.JsonValue;

      // Act
      const result = deserializeNotificationPayload(payload);

      // Assert
      expect(result.success).toBe(true);
    });

    it('accepts ALERT payloads (valid member of the UnifiedNotificationPayload type union)', () => {
      // Arrange
      const payload = {
        ...buildDealMatchPayload(),
        type: 'ALERT',
      } as unknown as Prisma.JsonValue;

      // Act
      const result = deserializeNotificationPayload(payload);

      // Assert
      expect(result.success).toBe(true);
    });

    it('rejects notification types that never get persisted as a payload type', () => {
      // Arrange
      const payload = {
        ...buildDealMatchPayload(),
        type: 'VERIFICATION',
      } as unknown as Prisma.JsonValue;

      // Act
      const result = deserializeNotificationPayload(payload);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Invalid notification type');
      }
    });

    it('still rejects payloads missing the required id field', () => {
      // Arrange
      const { id: _omitted, ...withoutId } = buildDealMatchPayload();
      const payload = withoutId as unknown as Prisma.JsonValue;

      // Act
      const result = deserializeNotificationPayload(payload);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Missing or invalid id field');
      }
    });

    it('still rejects payloads missing the required message field', () => {
      // Arrange
      const { message: _omitted, ...withoutMessage } = buildDealMatchPayload();
      const payload = withoutMessage as unknown as Prisma.JsonValue;

      // Act
      const result = deserializeNotificationPayload(payload);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Missing or invalid message field');
      }
    });

    it('rejects null content', () => {
      // Act
      const result = deserializeNotificationPayload(null);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Payload is null or undefined');
      }
    });
  });

  describe('deserializeNotificationPayloadOrNull', () => {
    it('returns the payload (not null) for a deal-match content without userId', () => {
      // Arrange
      const stored = buildDealMatchPayload() as unknown as Prisma.JsonValue;
      const onError = jest.fn();

      // Act
      const result = deserializeNotificationPayloadOrNull(stored, onError);

      // Assert
      expect(result).not.toBeNull();
      expect(result?.type).toBe('DEAL_MATCH');
      expect(onError).not.toHaveBeenCalled();
    });

    it('invokes the error callback and returns null for invalid content', () => {
      // Arrange
      const onError = jest.fn();

      // Act
      const result = deserializeNotificationPayloadOrNull(null, onError);

      // Assert
      expect(result).toBeNull();
      expect(onError).toHaveBeenCalledWith('Payload is null or undefined');
    });
  });
});
