/**
 * TanStack Query hook for managing notifications with smart caching
 * Prevents unnecessary API calls and provides persistent data across navigation
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { apiClient } from '@/shared/lib/api';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { EnhancedWebSocketNotification } from '@/shared/lib/websocket';
import { loggers } from '@/shared/lib/debug';

const log = loggers.notifications;

export interface NotificationsResponse {
  data: EnhancedWebSocketNotification[];
  totalCount: number;
  unreadCount: number;
  currentPage?: number;
  hasMore?: boolean;
}

export const NOTIFICATIONS_QUERY_KEY = ['notifications', 'unread'] as const;

/**
 * TanStack Query hook for fetching and caching notification data
 * Uses smart caching to prevent unnecessary API calls
 */
export function useNotificationsQuery() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch unread notifications with smart caching
  const query = useQuery({
    queryKey: NOTIFICATIONS_QUERY_KEY,
    queryFn: async (): Promise<NotificationsResponse> => {
      const response = await apiClient.getNotifications<NotificationsResponse>(
        '/notifications?read=false'
      );

      if (!response.success || !response.data) {
        throw new Error('Failed to fetch notifications');
      }

      return response.data;
    },
    enabled: !!user, // Only fetch when user is authenticated
    staleTime: 10 * 60 * 1000, // 10 minutes - notifications don't change frequently
    gcTime: 15 * 60 * 1000, // 15 minutes cache time
    refetchOnWindowFocus: false, // Rely on WebSocket for updates
    refetchOnMount: false, // Use cached data on mount
    refetchInterval: false, // Disable automatic polling
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
  });

  /**
   * Add a new notification to the cache (WebSocket real-time update)
   */
  const addNotification = useCallback(
    (notification: EnhancedWebSocketNotification) => {
      log.log(`Adding notification ${notification.id} to cache`);

      queryClient.setQueryData<NotificationsResponse>(
        NOTIFICATIONS_QUERY_KEY,
        (oldData) => {
          if (!oldData) {
            return {
              data: [notification],
              totalCount: 1,
              unreadCount: notification.read ? 0 : 1,
            };
          }

          // Check if notification already exists
          const existingIndex = oldData.data.findIndex(
            (n) => n.id === notification.id
          );

          if (existingIndex >= 0) {
            // Update existing notification
            const updatedData = [...oldData.data];
            updatedData[existingIndex] = notification;

            return {
              ...oldData,
              data: updatedData,
            };
          }

          // Add new notification to the beginning
          return {
            ...oldData,
            data: [notification, ...oldData.data],
            totalCount: oldData.totalCount + 1,
            unreadCount: notification.read
              ? oldData.unreadCount
              : oldData.unreadCount + 1,
          };
        }
      );
    },
    [queryClient]
  );

  /**
   * Update notification read status in cache
   */
  const updateNotificationReadStatus = useCallback(
    (notificationId: string, read: boolean) => {
      queryClient.setQueryData<NotificationsResponse>(
        NOTIFICATIONS_QUERY_KEY,
        (oldData) => {
          if (!oldData) return oldData;

          const updatedData = oldData.data.map((notification) =>
            notification.id === notificationId
              ? { ...notification, read }
              : notification
          );

          // Calculate new unread count
          const unreadCount = updatedData.filter((n) => !n.read).length;

          return {
            ...oldData,
            data: updatedData,
            unreadCount,
          };
        }
      );
    },
    [queryClient]
  );

  /**
   * Mark notification as read mutation
   */
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const response = await apiClient.putNotification<{ success: boolean }>(
        `/notifications/${notificationId}/read`
      );

      if (!response.success) {
        throw new Error('Failed to mark notification as read');
      }

      return response.data;
    },
    onMutate: async (notificationId) => {
      // Optimistic update
      updateNotificationReadStatus(notificationId, true);
      return { notificationId };
    },
    onError: (error, _notificationId, context) => {
      // Revert optimistic update on error
      if (context?.notificationId) {
        updateNotificationReadStatus(context.notificationId, false);
      }
      log.error('Failed to mark notification as read:', error);
    },
  });

  /**
   * Mark all notifications as read mutation
   */
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.postNotification<{
        success: boolean;
        count: number;
      }>('/notifications/mark-all-read');

      if (!response.success) {
        throw new Error('Failed to mark all notifications as read');
      }

      return response.data;
    },
    onMutate: async () => {
      // Optimistic update - mark all as read
      queryClient.setQueryData<NotificationsResponse>(
        NOTIFICATIONS_QUERY_KEY,
        (oldData) => {
          if (!oldData) return oldData;

          const updatedData = oldData.data.map((notification) => ({
            ...notification,
            read: true,
          }));

          return {
            ...oldData,
            data: updatedData,
            unreadCount: 0,
          };
        }
      );
    },
    onError: (error) => {
      // Refetch data on error to get correct state
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
      log.error('Failed to mark all notifications as read:', error);
    },
  });

  /**
   * Invalidate and refetch notifications (for WebSocket reconnect)
   */
  const refreshNotifications = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
  }, [queryClient]);

  /**
   * Get cached unread count without triggering a refetch
   */
  const getCachedUnreadCount = useCallback((): number => {
    const cachedData = queryClient.getQueryData<NotificationsResponse>(
      NOTIFICATIONS_QUERY_KEY
    );
    return cachedData?.unreadCount ?? 0;
  }, [queryClient]);

  return {
    // Query state
    notifications: query.data?.data ?? [],
    unreadCount: query.data?.unreadCount ?? 0,
    totalCount: query.data?.totalCount ?? 0,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,

    // Cache mutations (for WebSocket integration)
    addNotification,
    updateNotificationReadStatus,

    // Actions
    markAsRead: markAsReadMutation.mutate,
    markAllAsRead: markAllAsReadMutation.mutate,
    refreshNotifications,

    // Utilities
    getCachedUnreadCount,

    // Mutation states
    isMarkingAsRead: markAsReadMutation.isPending,
    isMarkingAllAsRead: markAllAsReadMutation.isPending,
  };
}

/**
 * Helper hook to get cached unread count without subscribing to the query
 * Useful for components that only need the count and don't want to trigger loading states
 */
export function useCachedUnreadCount(): number {
  const queryClient = useQueryClient();
  const cachedData = queryClient.getQueryData<NotificationsResponse>(
    NOTIFICATIONS_QUERY_KEY
  );
  return cachedData?.unreadCount ?? 0;
}
