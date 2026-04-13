/**
 * React hook for managing WebSocket notifications with TanStack Query integration
 * Optimized to prevent unnecessary API calls and fix badge flickering
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { apiClient } from '@/shared/lib/api';
import websocketService, {
  EnhancedWebSocketNotification,
  NotificationEventHandlers,
} from '@/shared/lib/websocket';
import { useNotificationsQuery } from './useNotificationsQuery';

interface UseNotificationsOptions {
  autoConnect?: boolean;
  subscribeToTypes?: string[];
}

interface UseNotificationsReturn {
  notifications: EnhancedWebSocketNotification[];
  isConnected: boolean;
  connect: () => void;
  disconnect: () => void;
  authenticate: () => void;
  markAsRead: (id: string) => void;
  clearAll: () => void;
  requestTest: () => void;
  unreadCount: number;
  isLoading: boolean;
  isError: boolean;
  refreshNotifications: () => void;
  hasConnectionIssue: boolean;
}

/**
 * Hook to manage WebSocket notifications with TanStack Query integration
 * Eliminates unnecessary API calls and provides persistent cached data
 */
export function useNotifications(
  options: UseNotificationsOptions = {}
): UseNotificationsReturn {
  const { autoConnect = true, subscribeToTypes = ['DEAL_MATCH', 'SYSTEM'] } =
    options;
  const { user } = useAuth();

  // Use TanStack Query for data management
  const {
    notifications: cachedNotifications,
    unreadCount: cachedUnreadCount,
    isLoading,
    isError,
    markAsRead: queryMarkAsRead,
    markAllAsRead: queryMarkAllAsRead,
    addNotification,
    refreshNotifications,
  } = useNotificationsQuery();

  const [isConnected, setIsConnected] = useState(false);
  const [hasConnectionIssue, setHasConnectionIssue] = useState(false);

  // Track active browser notifications for cleanup
  const activeNotifications = useRef<Notification[]>([]);

  // Handle new notifications - now uses cache mutation instead of local state
  const handleNotification = useCallback(
    (notification: EnhancedWebSocketNotification) => {
      // Add notification to TanStack Query cache
      addNotification(notification);

      // Show browser notification if permission is granted
      if ('Notification' in window && Notification.permission === 'granted') {
        try {
          const browserNotification = new Notification(notification.title, {
            body: notification.message,
            icon: '/favicon.ico',
            badge: '/favicon.ico',
          });

          // Track the notification for cleanup
          activeNotifications.current.push(browserNotification);

          // Auto-close after 5 seconds to prevent buildup
          setTimeout(() => {
            browserNotification.close();
            // Remove from tracking array
            activeNotifications.current = activeNotifications.current.filter(
              (n) => n !== browserNotification
            );
          }, 5000);

          // Handle manual close
          browserNotification.onclose = () => {
            activeNotifications.current = activeNotifications.current.filter(
              (n) => n !== browserNotification
            );
          };
        } catch (error) {
          // Silently fail if notification creation fails
          console.warn('Failed to create browser notification:', error);
        }
      }
    },
    [addNotification]
  );

  // No longer needed - TanStack Query handles data fetching with smart caching

  // Handle connection events
  const handleConnect = useCallback(() => {
    setIsConnected(true);
    setHasConnectionIssue(false);

    // Try manual authentication as fallback if needed
    const token = apiClient.getToken();
    if (token) {
      websocketService.authenticate(token);
    }

    // Subscribe to notification types (after authentication)
    setTimeout(() => {
      if (subscribeToTypes.length > 0) {
        websocketService.subscribe(subscribeToTypes);
      }
    }, 1000); // Wait 1 second for authentication to complete
  }, [subscribeToTypes]);

  const handleDisconnect = useCallback(() => {
    setIsConnected(false);
    setHasConnectionIssue(true);
  }, []);

  const handleError = useCallback((error: Error) => {
    console.error('WebSocket error via hook:', error);
    setIsConnected(false);
    setHasConnectionIssue(true);
  }, []);

  // Set up event handlers
  useEffect(() => {
    const handlers: NotificationEventHandlers = {
      onNotification: handleNotification,
      onConnect: handleConnect,
      onDisconnect: handleDisconnect,
      onError: handleError,
    };

    websocketService.setHandlers(handlers);
  }, [handleNotification, handleConnect, handleDisconnect, handleError]);

  // Auto-connect when user is authenticated
  useEffect(() => {
    if (autoConnect && user && !websocketService.isSocketConnected()) {
      const token = apiClient.getToken();
      if (token) {
        websocketService.connect(token);
      }
    }
  }, [autoConnect, user]);

  // Request notification permissions
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      void Notification.requestPermission();
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Close all active browser notifications before unmounting
      activeNotifications.current.forEach((notification) => {
        try {
          notification.close();
        } catch (error) {
          // Ignore errors when closing notifications
        }
      });
      activeNotifications.current = [];

      // NOTE: We do NOT disconnect the WebSocket here because it's a global singleton
      // service that should persist across page navigations in the SPA.
      // WebSocket should only disconnect on logout or browser close.
    };
  }, []);

  // Manual connect function
  const connect = useCallback(() => {
    const token = apiClient.getToken();
    if (token) {
      websocketService.connect(token);
    }
  }, []);

  // Manual disconnect function
  const disconnect = useCallback(() => {
    websocketService.disconnect();
  }, []);

  // Manual authenticate function
  const authenticate = useCallback(() => {
    const token = apiClient.getToken();
    if (token) {
      websocketService.authenticate(token);
    }
  }, []);

  // Mark notification as read - now uses TanStack Query mutation
  const markAsRead = useCallback(
    async (id: string) => {
      // Use TanStack Query mutation with optimistic updates
      queryMarkAsRead(id);

      // Also update via WebSocket if connected
      if (websocketService.isSocketConnected()) {
        websocketService.markNotificationRead(id);
      }
    },
    [queryMarkAsRead]
  );

  // Clear all notifications (mark all as read) - now uses TanStack Query mutation
  const clearAll = useCallback(() => {
    // Use TanStack Query mutation with optimistic updates
    queryMarkAllAsRead();
  }, [queryMarkAllAsRead]);

  // Request test notification
  const requestTest = useCallback(() => {
    websocketService.requestTestNotification();
  }, []);

  // Return cached data and enhanced functionality
  return {
    notifications: cachedNotifications,
    isConnected,
    connect,
    disconnect,
    authenticate,
    markAsRead,
    clearAll,
    requestTest,
    unreadCount: cachedUnreadCount,
    isLoading,
    isError,
    refreshNotifications,
    hasConnectionIssue,
  };
}
