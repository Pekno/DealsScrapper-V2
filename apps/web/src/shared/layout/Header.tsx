/**
 * Header component for page-level navigation and actions
 *
 * This component provides:
 * - Page title and optional subtitle
 * - Custom actions (buttons, dropdowns, etc.)
 * - Optional notification indicator
 * - Responsive layout for mobile and desktop
 *
 * Based on the design mockups: create_filter.png and view_filters.png
 */
import React from 'react';
import * as styles from './Header.css';

// Header component props interface
export interface HeaderProps {
  /** Main page title */
  title?: string;
  /** Optional subtitle or description */
  subtitle?: string;
  /** Custom action elements (buttons, dropdowns, etc.) */
  actions?: React.ReactNode;
  /** Whether to show the notification bell */
  showNotifications?: boolean;
  /** Number of unread notifications (0 to hide badge) */
  notificationCount?: number;
  /** Callback when notification bell is clicked */
  onNotificationClick?: () => void;
  /** Custom CSS class name */
  className?: string;
  /** Header variant for different layouts */
  variant?: 'default' | 'compact';
  /** Additional accessibility attributes */
  'aria-label'?: string;
}

/**
 * Header component providing page title, actions, and notifications
 */
export default function Header({
  title,
  subtitle,
  actions,
  showNotifications = true,
  notificationCount = 0,
  onNotificationClick,
  className,
  variant = 'default',
  'aria-label': ariaLabel,
}: HeaderProps): React.ReactElement {
  // Handle notification button click
  const handleNotificationClick = () => {
    if (onNotificationClick) {
      onNotificationClick();
    }
  };

  // Handle keyboard navigation for notification button
  const handleNotificationKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleNotificationClick();
    }
  };

  // Determine header style variant
  const headerStyle =
    variant === 'compact'
      ? styles.headerVariants.compact
      : styles.headerVariants.default;
  const finalClassName = className
    ? `${headerStyle} ${className}`
    : headerStyle;

  return (
    <header
      className={finalClassName}
      role="banner"
      aria-label={ariaLabel || (title ? `${title} page` : 'Page header')}
    >
      {/* Left section: Title and subtitle */}
      <div className={styles.headerLeft}>
        {title && <h1 className={styles.headerTitle}>{title}</h1>}
        {subtitle && <p className={styles.headerSubtitle}>{subtitle}</p>}
      </div>

      {/* Right section: Actions and notifications */}
      <div className={styles.headerRight}>
        {/* Custom actions */}
        {actions && (
          <div
            className={styles.headerActions}
            role="group"
            aria-label="Page actions"
          >
            {actions}
          </div>
        )}

        {/* Notification bell */}
        {showNotifications && (
          <button
            className={styles.notificationButton}
            onClick={handleNotificationClick}
            onKeyDown={handleNotificationKeyDown}
            aria-label={`Notifications${notificationCount > 0 ? ` (${notificationCount} unread)` : ''}`}
            type="button"
          >
            {/* Bell icon */}
            <svg
              className={styles.notificationIcon}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
              />
            </svg>

            {/* Notification count badge */}
            {notificationCount > 0 && (
              <span
                className={styles.notificationBadge}
                data-count={notificationCount}
                aria-hidden="true"
              >
                {notificationCount > 99 ? '99+' : notificationCount}
              </span>
            )}
          </button>
        )}
      </div>
    </header>
  );
}
