/**
 * useAppLayout - Custom hook for managing AppLayout state and handlers
 *
 * Extracts all state management, event handlers, and side effects from AppLayout
 * to improve maintainability and testability.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useNotifications } from '@/features/notifications/hooks/useNotifications';
import type { NavigationItem } from '@/shared/layout/AppLayout';
import type { UserMenuAction } from '@/shared/ui/UserMenu';
import type { EnhancedWebSocketNotification } from '@/shared/lib/websocket';
import type { User } from '@/shared/lib/api';

export interface UseAppLayoutOptions {
  /** Current active path for navigation highlighting */
  currentPath?: string;
  /** Navigation items for the sidebar */
  navigationItems: NavigationItem[];
  /** Callback when navigation item is clicked */
  onNavigate?: (path: string) => void;
  /** Callback when logout is triggered */
  onLogout?: () => void;
}

export interface UseAppLayoutResult {
  // Mobile menu state
  isMobileMenuOpen: boolean;
  toggleMobileMenu: () => void;
  handleBackdropClick: () => void;

  // Settings modal state
  isSettingsModalOpen: boolean;
  handleOpenSettings: () => void;
  handleCloseSettings: () => void;

  // Notification panel state
  isNotificationPanelOpen: boolean;
  handleToggleNotifications: () => void;
  handleCloseNotifications: () => void;
  handleNotificationClick: (
    notification: EnhancedWebSocketNotification
  ) => void;

  // Navigation state
  isNavigating: boolean;
  navigationTarget: string;
  handleNavigationClick: (item: NavigationItem) => void;
  getNavigationTargetName: (path: string) => string;
  activeNavItems: NavigationItem[];

  // User menu
  handleLogout: () => Promise<void>;
  userMenuActions: UserMenuAction[];

  // Notifications (WebSocket)
  notifications: EnhancedWebSocketNotification[];
  isConnected: boolean;
  connect: () => void;
  disconnect: () => void;
  authenticate: (userId: string) => void;
  markAsRead: (notificationId: string) => void;
  clearAll: () => void;
  requestTest: () => void;
  unreadCount: number;
  isLoading: boolean;
  isError: boolean;
  refreshNotifications: () => void;
  hasConnectionIssue: boolean;

  // Auth
  user: User | null;

  // Keyboard navigation
  handleKeyDown: (event: React.KeyboardEvent, action: () => void) => void;
}

/**
 * Custom hook for AppLayout component
 */
export function useAppLayout({
  currentPath = '',
  navigationItems,
  onNavigate,
  onLogout,
}: UseAppLayoutOptions): UseAppLayoutResult {
  // State
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isNotificationPanelOpen, setIsNotificationPanelOpen] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [navigationTarget, setNavigationTarget] = useState<string>('');

  // Hooks
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // WebSocket notifications hook with TanStack Query integration
  const {
    notifications,
    isConnected,
    connect,
    disconnect,
    authenticate,
    markAsRead,
    clearAll,
    requestTest,
    unreadCount,
    isLoading,
    isError,
    refreshNotifications,
    hasConnectionIssue,
  } = useNotifications({
    autoConnect: true,
    subscribeToTypes: ['DEAL_MATCH', 'SYSTEM', 'ALERT'],
  });

  // Mobile menu handlers
  const toggleMobileMenu = useCallback(() => {
    setIsMobileMenuOpen((prev) => !prev);
  }, []);

  const handleBackdropClick = useCallback(() => {
    setIsMobileMenuOpen(false);
  }, []);

  // Settings modal handlers
  const handleOpenSettings = useCallback(() => {
    setIsSettingsModalOpen(true);
  }, []);

  const handleCloseSettings = useCallback(() => {
    setIsSettingsModalOpen(false);
  }, []);

  // Notification panel handlers
  const handleToggleNotifications = useCallback(() => {
    setIsNotificationPanelOpen((prev) => !prev);
  }, []);

  const handleCloseNotifications = useCallback(() => {
    setIsNotificationPanelOpen(false);
  }, []);

  const handleNotificationClick = useCallback(
    (_notification: EnhancedWebSocketNotification) => {
      // Handle notification click - could navigate to specific page
      handleCloseNotifications();
    },
    [handleCloseNotifications]
  );

  // Logout handler
  const handleLogout = useCallback(async () => {
    try {
      await logout();
      // Redirect to login with success message
      navigate('/login?logout=success');
      if (onLogout) {
        onLogout();
      }
    } catch (_error) {
      // Logout error - silently handled, user still redirected
    }
  }, [logout, onLogout, navigate]);

  // User menu actions
  const userMenuActions: UserMenuAction[] = [
    {
      id: 'settings',
      label: 'Settings',
      icon: (
        <svg
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      ),
      onClick: handleOpenSettings,
    },
    {
      id: 'logout',
      label: 'Logout',
      icon: (
        <svg
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
          />
        </svg>
      ),
      variant: 'danger' as const,
      onClick: handleLogout,
    },
  ];

  // Navigation handler - ENHANCED: Shows immediate loading feedback
  const handleNavigationClick = useCallback(
    (item: NavigationItem) => {
      // Skip navigation for disabled items or if already navigating
      if (item.disabled || isNavigating) {
        return;
      }

      // Skip navigation if already on the target page
      if (currentPath === item.href) {
        return;
      }

      // Show immediate loading feedback
      setIsNavigating(true);
      setNavigationTarget(item.href);
      setIsMobileMenuOpen(false); // Close mobile menu on navigation

      // Use custom onNavigate if provided (for backward compatibility)
      if (onNavigate) {
        onNavigate(item.href);
      } else {
        // Use router for navigation with loading state
        navigate(item.href);
      }
    },
    [onNavigate, navigate, isNavigating, currentPath]
  );

  // Get friendly name for navigation target
  const getNavigationTargetName = useCallback(
    (path: string) => {
      const item = navigationItems.find((item) => item.href === path);
      return item ? item.label : 'page';
    },
    [navigationItems]
  );

  // Keyboard navigation handler
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent, action: () => void) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        action();
      }
    },
    []
  );

  // Determine active navigation items
  const activeNavItems = navigationItems.map((item) => ({
    ...item,
    active:
      currentPath === item.href ||
      (item.href !== '/' && currentPath.startsWith(item.href)),
  }));

  // Handle escape key to close mobile menu
  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isMobileMenuOpen) {
        setIsMobileMenuOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscapeKey);
    return () => document.removeEventListener('keydown', handleEscapeKey);
  }, [isMobileMenuOpen]);

  // Handle body scroll lock when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.classList.add('sidebar-open');
    } else {
      document.body.classList.remove('sidebar-open');
    }

    return () => {
      document.body.classList.remove('sidebar-open');
    };
  }, [isMobileMenuOpen]);

  // Reset navigation loading state when path changes
  useEffect(() => {
    if (isNavigating && currentPath === navigationTarget) {
      setIsNavigating(false);
      setNavigationTarget('');
    }
  }, [currentPath, navigationTarget, isNavigating]);

  // Fallback timeout to reset navigation state (in case navigation fails)
  useEffect(() => {
    if (isNavigating) {
      const timeout = setTimeout(() => {
        setIsNavigating(false);
        setNavigationTarget('');
      }, 10000); // 10 second timeout

      return () => clearTimeout(timeout);
    }
  }, [isNavigating]);

  return {
    // Mobile menu
    isMobileMenuOpen,
    toggleMobileMenu,
    handleBackdropClick,

    // Settings
    isSettingsModalOpen,
    handleOpenSettings,
    handleCloseSettings,

    // Notifications panel
    isNotificationPanelOpen,
    handleToggleNotifications,
    handleCloseNotifications,
    handleNotificationClick,

    // Navigation
    isNavigating,
    navigationTarget,
    handleNavigationClick,
    getNavigationTargetName,
    activeNavItems,

    // User menu
    handleLogout,
    userMenuActions,

    // Notifications (WebSocket)
    notifications,
    isConnected,
    connect,
    disconnect,
    authenticate,
    markAsRead,
    clearAll,
    requestTest,
    unreadCount,
    isLoading,
    isError,
    refreshNotifications,
    hasConnectionIssue,

    // Auth
    user,

    // Keyboard
    handleKeyDown,
  };
}
