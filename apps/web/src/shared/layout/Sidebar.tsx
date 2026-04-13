/**
 * Sidebar - Standalone sidebar navigation component
 *
 * This component can be used independently or integrated within AppLayout.
 * Provides the sidebar navigation structure with logo, menu items, and user profile.
 */
import React, { useCallback } from 'react';
import * as styles from './AppLayout.css'; // Reuse the same styles
import { NavigationItem, UserProfile } from './AppLayout';

export interface SidebarProps {
  /** Whether the sidebar is open (for mobile) */
  isOpen?: boolean;
  /** Callback to toggle sidebar visibility */
  onToggle?: () => void;
  /** Current active path for navigation highlighting */
  currentPath: string;
  /** Navigation items for the sidebar */
  navigationItems?: NavigationItem[];
  /** User profile information */
  userProfile?: UserProfile;
  /** Callback when navigation item is clicked */
  onNavigate?: (path: string) => void;
  /** Callback when user profile is clicked */
  onUserProfileClick?: () => void;
  /** Custom class name for the sidebar container */
  className?: string;
}

// Default navigation items (same as AppLayout)
const DEFAULT_NAVIGATION: NavigationItem[] = [
  {
    id: 'filters',
    label: 'Filters',
    href: '/filters',
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
  },
  {
    id: 'analytics',
    label: 'Analytics',
    href: '/analytics',
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
    href: '/settings',
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
];

// Default user profile
const DEFAULT_USER_PROFILE: UserProfile = {
  name: 'John Doe',
  email: 'john.doe@example.com',
  initials: 'JD',
};

/**
 * Standalone Sidebar component
 */
export default function Sidebar({
  isOpen = true,
  onToggle,
  currentPath,
  navigationItems = DEFAULT_NAVIGATION,
  userProfile = DEFAULT_USER_PROFILE,
  onNavigate,
  onUserProfileClick,
  className,
}: SidebarProps): React.ReactElement {
  // Handle navigation item click
  const handleNavigationClick = useCallback(
    (item: NavigationItem) => {
      if (onNavigate) {
        onNavigate(item.href);
      }
      if (onToggle) {
        onToggle(); // Close mobile menu on navigation
      }
    },
    [onNavigate, onToggle]
  );

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

  // Determine active navigation items
  const activeNavItems = navigationItems.map((item) => ({
    ...item,
    active:
      currentPath === item.href ||
      (item.href !== '/' && currentPath.startsWith(item.href)),
  }));

  // Determine sidebar variant based on open state
  const sidebarClassName = isOpen
    ? styles.sidebarVariants.mobileVisible
    : styles.sidebarVariants.mobileHidden;

  return (
    <aside
      className={
        className ? `${sidebarClassName} ${className}` : sidebarClassName
      }
      role="navigation"
      aria-label="Main navigation"
    >
      {/* Sidebar Header - Logo */}
      <div className="p-4 border-b border-gray-200">
        <div className={styles.logoContainer}>
          <div className={styles.logoIcon}>
            <div className={styles.logoIconInner} />
          </div>
          <h1 className={styles.logoText}>DealScraper</h1>
        </div>
      </div>

      {/* Navigation */}
      <nav
        className={styles.sidebarNav}
        role="navigation"
        aria-label="Primary navigation"
      >
        <ul className={styles.navList}>
          {activeNavItems.map((item) => (
            <li key={item.id} className={styles.navItem}>
              <a
                href={item.href}
                className={item.active ? styles.navLinkActive : styles.navLink}
                onClick={(e) => {
                  e.preventDefault();
                  handleNavigationClick(item);
                }}
                onKeyDown={(e) =>
                  handleKeyDown(e, () => handleNavigationClick(item))
                }
                role="button"
                tabIndex={0}
                aria-current={item.active ? 'page' : undefined}
              >
                {item.icon}
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {/* User Profile */}
      <div className={styles.sidebarFooter}>
        <div
          className={styles.userProfile}
          onClick={onUserProfileClick}
          onKeyDown={(e) =>
            onUserProfileClick && handleKeyDown(e, onUserProfileClick)
          }
          role="button"
          tabIndex={0}
          aria-label={`User profile: ${userProfile.name}`}
        >
          <div className={styles.userAvatar} aria-hidden="true">
            <span className={styles.userAvatarText}>
              {userProfile.initials}
            </span>
          </div>
          <div className={styles.userInfo}>
            <div className={styles.userName}>{userProfile.name}</div>
            <div className={styles.userEmail}>{userProfile.email}</div>
          </div>
        </div>
      </div>
    </aside>
  );
}

// Types are already exported through AppLayout imports and interface declarations
