/**
 * useNavigationState - Custom hook for managing navigation menu state
 *
 * Handles:
 * - Collapsed items state
 * - Profile dropdown visibility
 * - Logout confirmation modal
 * - Keyboard navigation
 * - Click outside detection
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { NavigationItem } from '@/shared/layout/NavigationTypes';

export interface UseNavigationStateProps {
  /** Navigation items to track */
  items: NavigationItem[];
  /** Whether to collapse items by default */
  collapseByDefault: boolean;
  /** Callback when navigation occurs */
  onNavigate: (path: string) => void;
  /** Callback when logout is confirmed */
  onLogout: () => void;
}

export interface UseNavigationStateReturn {
  // Collapsed items state
  collapsedItems: Set<string>;
  handleGroupToggle: (itemId: string) => void;

  // Navigation handlers
  handleNavigationClick: (item: NavigationItem) => void;
  handleKeyDown: (event: React.KeyboardEvent, action: () => void) => void;

  // Profile dropdown state
  showProfileDropdown: boolean;
  handleProfileToggle: () => void;

  // Logout confirmation state
  showLogoutConfirm: boolean;
  handleLogoutClick: () => void;
  handleLogoutConfirm: () => void;
  handleLogoutCancel: () => void;
}

/**
 * Custom hook for managing navigation menu state and interactions
 */
export function useNavigationState({
  items,
  collapseByDefault,
  onNavigate,
  onLogout,
}: UseNavigationStateProps): UseNavigationStateReturn {
  // Collapsed items state
  const [collapsedItems, setCollapsedItems] = useState<Set<string>>(
    collapseByDefault
      ? new Set(
          items.filter((item) => item.isCollapsible).map((item) => item.id)
        )
      : new Set()
  );

  // Profile dropdown state
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);

  // Logout confirmation state
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const logoutTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // Handle navigation item click
  const handleNavigationClick = useCallback(
    (item: NavigationItem) => {
      onNavigate(item.path);
    },
    [onNavigate]
  );

  // Handle collapsible group toggle
  const handleGroupToggle = useCallback((itemId: string) => {
    setCollapsedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  }, []);

  // Handle profile dropdown toggle
  const handleProfileToggle = useCallback(() => {
    setShowProfileDropdown((prev) => !prev);
  }, []);

  // Handle logout confirmation
  const handleLogoutClick = useCallback(() => {
    setShowLogoutConfirm(true);
    setShowProfileDropdown(false);

    // Auto-cancel after 5 seconds
    logoutTimeoutRef.current = setTimeout(() => {
      setShowLogoutConfirm(false);
    }, 5000);
  }, []);

  // Handle logout confirm
  const handleLogoutConfirm = useCallback(() => {
    if (logoutTimeoutRef.current) {
      clearTimeout(logoutTimeoutRef.current);
    }
    setShowLogoutConfirm(false);
    onLogout();
  }, [onLogout]);

  // Handle logout cancel
  const handleLogoutCancel = useCallback(() => {
    if (logoutTimeoutRef.current) {
      clearTimeout(logoutTimeoutRef.current);
    }
    setShowLogoutConfirm(false);
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent, action: () => void) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        action();
      }
    },
    []
  );

  // Close dropdown on escape key
  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowProfileDropdown(false);
        setShowLogoutConfirm(false);
        if (logoutTimeoutRef.current) {
          clearTimeout(logoutTimeoutRef.current);
        }
      }
    };

    document.addEventListener('keydown', handleEscapeKey);
    return () => document.removeEventListener('keydown', handleEscapeKey);
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (logoutTimeoutRef.current) {
        clearTimeout(logoutTimeoutRef.current);
      }
    };
  }, []);

  return {
    collapsedItems,
    handleGroupToggle,
    handleNavigationClick,
    handleKeyDown,
    showProfileDropdown,
    handleProfileToggle,
    showLogoutConfirm,
    handleLogoutClick,
    handleLogoutConfirm,
    handleLogoutCancel,
  };
}
