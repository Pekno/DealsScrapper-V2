/**
 * useRealTimeFilterRefresh - Hook for automatic filter refresh on WebSocket notifications
 * Uses unified notification format with direct filterId access for reliable matching
 * Integrates with existing notification system to avoid conflicts
 */
import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useInvalidateFilterMatches } from './useFilterMatches';
import { NOTIFICATIONS_QUERY_KEY, type NotificationsResponse } from '@/features/notifications/hooks/useNotificationsQuery';
import type { EnhancedWebSocketNotification } from '@/shared/lib/websocket';
import { loggers } from '@/shared/lib/debug';

const log = loggers.realTime;

export interface UseRealTimeFilterRefreshOptions {
  /** ID of the current filter being viewed */
  filterId: string;
  /** Whether to enable real-time refresh (default: true) */
  enabled?: boolean;
  /** Custom callback when a matching notification is received */
  onMatchingNotification?: (notification: EnhancedWebSocketNotification) => void;
  /** Debounce delay in ms to prevent excessive refreshes (default: 1000) */
  debounceMs?: number;
}

/**
 * Hook that automatically refreshes filter matches when WebSocket notifications
 * are received for the current filter. Integrates with existing notification system.
 */
export const useRealTimeFilterRefresh = ({
  filterId,
  enabled = true,
  onMatchingNotification,
  debounceMs = 1000,
}: UseRealTimeFilterRefreshOptions) => {
  const queryClient = useQueryClient();
  const invalidateFilterMatches = useInvalidateFilterMatches();
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastRefreshTimeRef = useRef<number>(0);
  const lastNotificationCountRef = useRef<number>(0);

  useEffect(() => {
    if (!enabled || !filterId) {
      log.log(`Real-time filter refresh disabled: enabled=${enabled}, filterId=${filterId}`);
      return;
    }

    log.log(`Starting real-time filter refresh for filter ${filterId}, debounce: ${debounceMs}ms`);

    /**
     * Watch for changes in the notifications cache to detect new notifications
     */
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      // Only listen to updates to the notifications query
      if (
        event.type === 'updated' &&
        event.query.queryKey.join(',') === NOTIFICATIONS_QUERY_KEY.join(',')
      ) {
        const notificationsData = event.query.state.data as NotificationsResponse | undefined;

        if (!notificationsData?.data) {
          return;
        }

        const currentNotificationCount = notificationsData.data.length;

        // Check if new notifications were added
        if (currentNotificationCount > lastNotificationCountRef.current) {
          // Calculate how many new notifications were added
          const newNotificationCount = currentNotificationCount - lastNotificationCountRef.current;

          // Update the count
          lastNotificationCountRef.current = currentNotificationCount;

          // Find the newest notifications (they are added to the beginning of the array)
          const newNotifications = notificationsData.data.slice(0, newNotificationCount);

          log.log(`Detected ${newNotificationCount} new notification(s) for filter ${filterId}`);

          // Process each new notification
          for (const notification of newNotifications) {
            // Only process DEAL_MATCH notifications
            if (notification.type !== 'DEAL_MATCH') {
              continue;
            }

            // Extract filterId from notification (unified format - direct access)
            const notificationFilterId = notification.filterId;

            // Check if this notification is for the current filter
            if (!notificationFilterId || notificationFilterId !== filterId) {
              continue;
            }

            log.log(`Match found for filter ${filterId}, scheduling refresh`);

            // Call custom callback if provided
            onMatchingNotification?.(notification);

            // Debounce the refresh to prevent excessive calls
            if (debounceTimerRef.current) {
              clearTimeout(debounceTimerRef.current);
            }

            debounceTimerRef.current = setTimeout(() => {
              lastRefreshTimeRef.current = Date.now();

              // Invalidate and refresh the filter matches cache
              invalidateFilterMatches(filterId);

              log.log(`Filter matches cache invalidated for ${filterId}`);
            }, debounceMs);

            // Continue processing all matching notifications to ensure debounce captures the full batch
          }
        } else {
          // Update the count even if no new notifications (for initial load)
          lastNotificationCountRef.current = currentNotificationCount;
        }
      }
    });

    // Initialize the notification count
    const currentData = queryClient.getQueryData<NotificationsResponse>(NOTIFICATIONS_QUERY_KEY);
    if (currentData?.data) {
      lastNotificationCountRef.current = currentData.data.length;
    }

    // Cleanup function
    return () => {
      unsubscribe();
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [filterId, enabled, onMatchingNotification, debounceMs, invalidateFilterMatches, queryClient]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return {
    isEnabled: enabled,
    filterId,
  };
};

export default useRealTimeFilterRefresh;