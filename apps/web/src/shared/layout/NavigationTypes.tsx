/**
 * Type definitions and default data for NavigationMenu components
 */

import React from 'react';
import * as styles from './NavigationMenu.css';

// Navigation item interface with badge and nesting support
export interface NavigationItem {
  id: string;
  label: string;
  path: string;
  icon?: React.ReactNode;
  badge?: number;
  children?: NavigationItem[];
  isCollapsible?: boolean;
}

// User profile interface
export interface UserProfile {
  id: string;
  name: string;
  email?: string;
  role?: string;
  avatar?: string;
  initials?: string;
}

// Props interface for the NavigationMenu component
export interface NavigationMenuProps {
  /** Navigation items to display */
  items: NavigationItem[];
  /** Current active path for highlighting */
  currentPath: string;
  /** User profile information */
  userProfile: UserProfile;
  /** Callback when navigation item is clicked */
  onNavigate: (path: string) => void;
  /** Callback when logout is triggered */
  onLogout: () => void;
  /** Optional callback for profile actions */
  onProfileView?: () => void;
  /** Optional callback for settings */
  onSettings?: () => void;
  /** Custom className for the menu container */
  className?: string;
  /** Whether to show badges on menu items */
  showBadges?: boolean;
  /** Whether to collapse child items by default */
  collapseByDefault?: boolean;
}

// Default navigation items for DealsScrapper
export const DEFAULT_NAVIGATION_ITEMS: NavigationItem[] = [
  {
    id: 'filters',
    label: 'My Filters',
    path: '/filters',
    badge: 3,
    icon: (
      <svg
        className={styles.navIcon}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.414A1 1 0 013 6.707V4z"
        />
      </svg>
    ),
    isCollapsible: true,
    children: [
      {
        id: 'filters-create',
        label: 'Create Filter',
        path: '/filters/create',
        icon: (
          <svg
            className={styles.navIcon}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 6v6m0 0v6m0-6h6m-6 0H6"
            />
          </svg>
        ),
      },
      {
        id: 'filter-templates',
        label: 'Templates',
        path: '/filters/templates',
        icon: (
          <svg
            className={styles.navIcon}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
            />
          </svg>
        ),
      },
    ],
  },
  {
    id: 'deals',
    label: 'Deal History',
    path: '/deals',
    badge: 12,
    icon: (
      <svg
        className={styles.navIcon}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"
        />
      </svg>
    ),
  },
  {
    id: 'analytics',
    label: 'Analytics',
    path: '/analytics',
    icon: (
      <svg
        className={styles.navIcon}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
        />
      </svg>
    ),
  },
  {
    id: 'settings',
    label: 'Settings',
    path: '/settings',
    icon: (
      <svg
        className={styles.navIcon}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
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
  },
  {
    id: 'help',
    label: 'Help & Support',
    path: '/help',
    icon: (
      <svg
        className={styles.navIcon}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
  },
];

// Default user profile for demo
export const DEFAULT_USER_PROFILE: UserProfile = {
  id: '1',
  name: 'John Doe',
  email: 'john.doe@dealscrapper.com',
  role: 'Premium User',
  initials: 'JD',
};
