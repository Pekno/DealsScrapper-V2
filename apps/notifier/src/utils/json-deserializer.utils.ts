/**
 * Type-safe JSON deserialization utilities for Prisma Json types
 *
 * These utilities provide runtime validation when deserializing Prisma.JsonValue
 * to specific TypeScript types, avoiding unsafe `as unknown as` casts.
 */
import { Prisma } from '@prisma/client';
import { UnifiedNotificationPayload, NotificationType } from '@dealscrapper/shared-types';

/**
 * Result of a deserialization operation
 */
export type DeserializeResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

/**
 * Validates that a value is a non-null object
 */
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Validates that a value is a valid NotificationType
 */
function isValidNotificationType(value: unknown): value is NotificationType {
  return (
    typeof value === 'string' &&
    ['DEAL_MATCH', 'SYSTEM', 'VERIFICATION', 'WELCOME', 'DIGEST', 'REMINDER'].includes(value)
  );
}

/**
 * Deserializes a Prisma JSON value to UnifiedNotificationPayload with runtime validation
 *
 * @param json - The Prisma JSON value to deserialize
 * @returns DeserializeResult with either the validated payload or an error message
 */
export function deserializeNotificationPayload(
  json: Prisma.JsonValue | null | undefined
): DeserializeResult<UnifiedNotificationPayload> {
  if (json === null || json === undefined) {
    return { success: false, error: 'Payload is null or undefined' };
  }

  if (!isObject(json)) {
    return { success: false, error: 'Payload is not an object' };
  }

  // Validate required fields
  if (typeof json.id !== 'string') {
    return { success: false, error: 'Missing or invalid id field' };
  }

  if (!isValidNotificationType(json.type)) {
    return { success: false, error: `Invalid notification type: ${String(json.type)}` };
  }

  if (typeof json.title !== 'string') {
    return { success: false, error: 'Missing or invalid title field' };
  }

  if (typeof json.message !== 'string') {
    return { success: false, error: 'Missing or invalid message field' };
  }

  if (typeof json.userId !== 'string') {
    return { success: false, error: 'Missing or invalid userId field' };
  }

  // The payload passes validation - return it as the expected type
  // The structure has been validated, so this cast is now safe
  return { success: true, data: json as unknown as UnifiedNotificationPayload };
}

/**
 * Deserializes a Prisma JSON value to UnifiedNotificationPayload,
 * returning null if validation fails (for use in contexts where errors are logged separately)
 *
 * @param json - The Prisma JSON value to deserialize
 * @param onError - Optional callback for error handling
 * @returns The validated payload or null
 */
export function deserializeNotificationPayloadOrNull(
  json: Prisma.JsonValue | null | undefined,
  onError?: (error: string) => void
): UnifiedNotificationPayload | null {
  const result = deserializeNotificationPayload(json);
  if (!result.success) {
    onError?.(result.error);
    return null;
  }
  return result.data;
}

/**
 * Converts a UnifiedNotificationPayload to Prisma.InputJsonValue for storage
 * This provides type safety when writing to Prisma Json fields
 *
 * @param payload - The notification payload to serialize
 * @returns The payload as Prisma.InputJsonValue
 */
export function serializeNotificationPayload(
  payload: UnifiedNotificationPayload
): Prisma.InputJsonValue {
  // The payload structure is compatible with JSON, so this cast is safe
  return payload as unknown as Prisma.InputJsonValue;
}

/**
 * Notification metadata structure stored in the metadata field
 */
export interface NotificationMetadataJson {
  priority: string;
  notificationType: string;
  deliveryTracking: boolean;
  filterId?: string;
  matchId?: string;
  deliveryAttempts?: number;
  finalStatus?: string;
  emailSent?: boolean | null;
  websocketSent?: boolean | null;
}

/**
 * Converts notification metadata to Prisma.InputJsonValue for storage
 *
 * @param metadata - The metadata object to serialize
 * @returns The metadata as Prisma.InputJsonValue
 */
export function serializeNotificationMetadata(
  metadata: NotificationMetadataJson
): Prisma.InputJsonValue {
  return metadata as unknown as Prisma.InputJsonValue;
}
