/**
 * Lightweight hook for notification badge that uses cached data
 * Prevents unnecessary API calls when only the unread count is needed
 */

import { useQueryClient } from '@tanstack/react-query';
import {
  NOTIFICATIONS_QUERY_KEY,
  NotificationsResponse,
} from './useNotificationsQuery';

export interface CachedNotificationBadgeData {
  unreadCount: number;
  hasData: boolean;
}

/**
 * Hook for components that only need the notification badge data
 * Uses cached data without triggering new queries or loading states
 * Perfect for badges that should show persistent counts across navigation
 */
export function useCachedNotificationBadge(): CachedNotificationBadgeData {
  const queryClient = useQueryClient();

  // Get cached data without subscribing to updates
  const cachedData = queryClient.getQueryData<NotificationsResponse>(
    NOTIFICATIONS_QUERY_KEY
  );

  return {
    unreadCount: cachedData?.unreadCount ?? 0,
    hasData: !!cachedData,
  };
}

/**
 * Hook that subscribes to cache changes for real-time badge updates
 * Use this when you want the badge to update immediately when cache changes
 */
export function useRealtimeNotificationBadge(): CachedNotificationBadgeData {
  const queryClient = useQueryClient();

  // This will re-render when the cache data changes
  const cachedData = queryClient.getQueryData<NotificationsResponse>(
    NOTIFICATIONS_QUERY_KEY
  );

  return {
    unreadCount: cachedData?.unreadCount ?? 0,
    hasData: !!cachedData,
  };
}
