/**
 * NotificationPanel - Dropdown panel for displaying real-time notifications
 *
 * Displays a list of notifications with actions to mark as read, clear all,
 * and connect to WebSocket for real-time updates.
 */
import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { EnhancedWebSocketNotification } from '@/shared/lib/websocket';
import { Button } from '@/shared/ui/Button';
import { NotificationItem } from './NotificationItem';

export interface NotificationPanelProps {
  notifications: EnhancedWebSocketNotification[];
  isOpen: boolean;
  onClose: () => void;
  onMarkAsRead: (id: string) => void;
  onClearAll: () => void;
  onNotificationClick?: (notification: EnhancedWebSocketNotification) => void;
  isConnected: boolean;
  onConnect: () => void;
  unreadCount: number;
  isLoading?: boolean;
  hasConnectionIssue?: boolean;
  onRefresh?: () => void;
}

export const NotificationPanel: React.FC<NotificationPanelProps> = ({
  notifications,
  isOpen,
  onClose,
  onMarkAsRead,
  onClearAll,
  onNotificationClick,
  isConnected,
  onConnect,
  unreadCount,
  isLoading = false,
  hasConnectionIssue = false,
  onRefresh,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  /**
   * Handle navigation to filter page
   */
  const handleNavigateToFilter = (filterId: string) => {
    try {
      navigate(`/filters/${filterId}`);
      onClose(); // Close the notification panel after navigation
    } catch (error) {
      console.error('Failed to navigate to filter:', error);
      // Could show a toast notification here for error handling
    }
  };

  // Close panel when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () =>
        document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, onClose]);

  // Close panel on escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={panelRef}
      className="absolute top-0 right-0 w-96 max-w-sm bg-white rounded-lg shadow-lg border border-gray-200 flex flex-col overflow-hidden"
      style={{
        maxHeight: 'calc(100vh - 80px)',
        zIndex: 1100,
      }}
      role="dialog"
      aria-labelledby="notifications-title"
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div
              className={`w-2 h-2 rounded-full mr-2 ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}
            />
            <h2
              id="notifications-title"
              className="text-lg font-semibold text-gray-900"
            >
              Notifications
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1"
            aria-label="Close notifications"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        {/* Connection status and actions */}
        {(!isConnected || hasConnectionIssue) && (
          <div className="mt-2 flex gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={onConnect}
              className="text-xs text-gray-600"
            >
              {isConnected ? 'Retry Connection' : 'Reconnect'}
            </Button>
            {onRefresh && hasConnectionIssue && (
              <Button
                size="sm"
                variant="ghost"
                onClick={onRefresh}
                className="text-xs text-blue-600"
                title="Refresh notifications from server"
              >
                Refresh
              </Button>
            )}
          </div>
        )}

        {/* Loading indicator */}
        {isLoading && (
          <div className="mt-2 flex items-center text-xs text-gray-500">
            <div className="animate-spin w-3 h-3 border border-gray-300 border-t-blue-500 rounded-full mr-2"></div>
            Loading notifications...
          </div>
        )}
      </div>

      {/* Notifications List */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {notifications.length === 0 ? (
          <div className="p-8 text-center">
            <div className="mb-4">
              <svg
                className="w-12 h-12 text-gray-300 mx-auto"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                />
              </svg>
            </div>
            <p className="text-gray-500 text-sm mb-2">No notifications yet</p>
            <p className="text-gray-400 text-xs">
              You'll see deal matches here when they're found
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100" role="list">
            {notifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onMarkAsRead={onMarkAsRead}
                onNavigateToFilter={handleNavigateToFilter}
                onNotificationClick={onNotificationClick}
              />
            ))}
          </ul>
        )}
      </div>

      {/* Footer */}
      {notifications.length > 0 && (
        <div className="p-3 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500">
              {notifications.length} notification
              {notifications.length !== 1 ? 's' : ''}
              {unreadCount > 0 && (
                <span className="ml-1 font-medium text-blue-600">
                  ({unreadCount} unread)
                </span>
              )}
            </p>
            <Button
              size="sm"
              variant="ghost"
              onClick={onClearAll}
              className="text-xs text-gray-600 hover:text-gray-800"
            >
              Clear All
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationPanel;
