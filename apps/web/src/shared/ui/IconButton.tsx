/**
 * IconButton - Icon-only button component with notification indicators
 * Optimized for icons with consistent sizing and accessibility
 * Follows the design system from the create filter mockup
 */
import React from 'react';
import * as styles from './IconButton.css';
import { LoadingSpinner } from './LoadingSpinner';

export interface IconButtonProps
  extends Omit<
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    'children' | 'disabled'
  > {
  /** Icon element to display in the button */
  icon: React.ReactNode;
  /** Button visual style variant */
  variant?: 'default' | 'ghost' | 'outline' | 'danger';
  /** Button size */
  size?: 'sm' | 'md' | 'lg';
  /** Show notification indicator (red dot) */
  notification?: boolean;
  /** Notification count (if provided, shows number badge instead of dot) */
  notificationCount?: number;
  /** Maximum count to display (shows "99+" for counts above this) */
  maxNotificationCount?: number;
  /** Loading state */
  loading?: boolean;
  /** Disabled state */
  disabled?: boolean;
  /** Callback when button is clicked */
  onClick?: () => void;
  /** Additional class name */
  className?: string;
  /** Accessible label for screen readers (required) */
  'aria-label': string;
  /** Tooltip text on hover */
  title?: string;
}

/**
 * Notification badge component for showing counts
 */
const NotificationBadge: React.FC<{
  count: number;
  maxCount: number;
  size: 'sm' | 'md' | 'lg';
}> = ({ count, maxCount, size }) => {
  const displayCount = count > maxCount ? `${maxCount}+` : count.toString();

  return (
    <span
      className={`${styles.iconButton.notificationBadge.base} ${styles.iconButton.notificationBadge.sizes[size]}`}
      aria-label={`${count} notifications`}
    >
      {displayCount}
    </span>
  );
};

/**
 * Simple notification dot for boolean notifications
 */
const NotificationDot: React.FC<{ size: 'sm' | 'md' | 'lg' }> = ({ size }) => (
  <span
    className={`${styles.iconButton.notificationDot.base} ${styles.iconButton.notificationDot.sizes[size]}`}
    aria-label="Has notifications"
  />
);

export const IconButton: React.FC<IconButtonProps> = ({
  icon,
  variant = 'default',
  size = 'md',
  notification = false,
  notificationCount,
  maxNotificationCount = 99,
  loading = false,
  disabled = false,
  onClick,
  className = '',
  title,
  'aria-label': ariaLabel,
  type = 'button',
  ...props
}) => {
  // Build button classes
  const buttonClasses = [
    styles.iconButton.base,
    styles.iconButton.variants[variant],
    styles.iconButton.sizes[size],
    disabled || loading ? styles.iconButton.disabled : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  // Determine notification display
  const hasNotificationCount =
    typeof notificationCount === 'number' && notificationCount > 0;
  const hasNotification = notification || hasNotificationCount;

  // Enhanced aria-label with notification info
  let enhancedAriaLabel = ariaLabel;
  if (hasNotificationCount) {
    enhancedAriaLabel += ` (${notificationCount} notifications)`;
  } else if (notification) {
    enhancedAriaLabel += ' (has notifications)';
  }
  if (loading) {
    enhancedAriaLabel += ' (loading)';
  }

  return (
    <button
      type={type}
      className={buttonClasses}
      disabled={disabled || loading}
      onClick={onClick}
      aria-label={enhancedAriaLabel}
      title={title}
      {...props}
    >
      {/* Icon container */}
      <span className={styles.iconButton.iconContainer} aria-hidden="true">
        {loading ? (
          <LoadingSpinner
            size={size === 'sm' ? 'small' : size === 'md' ? 'medium' : 'large'}
            variant="primary"
          />
        ) : (
          icon
        )}
      </span>

      {/* Notification indicators */}
      {hasNotification && !loading && (
        <>
          {hasNotificationCount ? (
            <NotificationBadge
              count={notificationCount}
              maxCount={maxNotificationCount}
              size={size}
            />
          ) : (
            <NotificationDot size={size} />
          )}
        </>
      )}
    </button>
  );
};

export default IconButton;
