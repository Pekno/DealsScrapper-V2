/**
 * NotificationBell - Specialized notification component with bell icon and smart badge
 *
 * A sophisticated notification indicator that combines IconButton and Badge components
 * with bell-specific animations, accessibility features, and intelligent count display.
 * Designed for DealsScrapper's real-time notification system.
 *
 * Features:
 * - Bell ring animation on notification updates
 * - Smart count display with 99+ overflow
 * - Bounce animation for new notifications
 * - Full accessibility support with screen reader announcements
 * - Respects prefers-reduced-motion settings
 * - Mobile-friendly touch targets
 * - Integration ready for WebSocket updates
 */
import React, { useEffect, useRef, useState } from 'react';
import { IconButton } from '@/shared/ui/IconButton';
import * as styles from './NotificationBell.css';

export interface NotificationBellProps {
  /** Number of unread notifications */
  count: number;
  /** Callback when bell is clicked */
  onClick: () => void;
  /** Maximum count to display before showing "99+" */
  maxCount?: number;
  /** Button size */
  size?: 'sm' | 'md' | 'lg';
  /** Button variant */
  variant?: 'default' | 'ghost' | 'outline' | 'danger';
  /** Whether to show badge when count is 0 */
  showBadgeWhenZero?: boolean;
  /** Loading state */
  loading?: boolean;
  /** Disabled state */
  disabled?: boolean;
  /** Custom aria-label (will be enhanced with count info) */
  'aria-label'?: string;
  /** Additional CSS class */
  className?: string;
  /** Tooltip text */
  title?: string;
  /** Whether to animate bell on count increases */
  animateOnUpdate?: boolean;
  /** Whether to bounce badge on new notifications */
  bounceBadgeOnUpdate?: boolean;
}

/**
 * Custom Bell SVG Icon optimized for notifications
 * Consistent styling with clean lines and proper accessibility
 */
const BellIcon: React.FC<{ size: 'sm' | 'md' | 'lg'; className?: string }> = ({
  size,
  className = '',
}) => (
  <svg
    className={`${styles.notificationBell.bellSizes[size]} ${styles.notificationBell.bellSvg} ${className}`}
    fill="currentColor"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path
      fillRule="evenodd"
      d="M5.25 9a6.75 6.75 0 0113.5 0v.75c0 2.123.8 4.057 2.118 5.52a.75.75 0 01-.297 1.206c-1.544.57-3.16.99-4.831 1.243a3.75 3.75 0 11-7.48 0 24.585 24.585 0 01-4.831-1.243.75.75 0 01-.298-1.205A8.217 8.217 0 005.25 9.75V9zm4.502 8.9a2.25 2.25 0 104.496 0 25.057 25.057 0 01-4.496 0z"
      clipRule="evenodd"
    />
  </svg>
);

/**
 * Hook to manage notification animations and state changes
 */
const useNotificationAnimations = (
  count: number,
  animateOnUpdate: boolean,
  bounceBadgeOnUpdate: boolean
) => {
  const [isRinging, setIsRinging] = useState(false);
  const [isBadgeBouncing, setIsBadgeBouncing] = useState(false);
  const prevCountRef = useRef(count);
  const animationTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const badgeTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  useEffect(() => {
    const prevCount = prevCountRef.current;
    const hasIncreased = count > prevCount;

    // Trigger bell ring animation on count increase
    if (animateOnUpdate && hasIncreased && count > 0) {
      setIsRinging(true);

      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }

      animationTimeoutRef.current = setTimeout(() => {
        setIsRinging(false);
      }, 1000); // Animation duration
    }

    // Trigger badge bounce on new notifications
    if (bounceBadgeOnUpdate && hasIncreased && count > 0) {
      setIsBadgeBouncing(true);

      if (badgeTimeoutRef.current) {
        clearTimeout(badgeTimeoutRef.current);
      }

      badgeTimeoutRef.current = setTimeout(() => {
        setIsBadgeBouncing(false);
      }, 600); // Bounce duration
    }

    prevCountRef.current = count;

    // Cleanup on unmount
    return () => {
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }
      if (badgeTimeoutRef.current) {
        clearTimeout(badgeTimeoutRef.current);
      }
    };
  }, [count, animateOnUpdate, bounceBadgeOnUpdate]);

  return { isRinging, isBadgeBouncing };
};

/**
 * Generate accessible aria-label with notification context
 */
const generateAriaLabel = (
  baseLabel: string,
  count: number,
  maxCount: number,
  showBadgeWhenZero: boolean
): string => {
  let label = baseLabel;

  if (count === 0) {
    if (showBadgeWhenZero) {
      label += ' (no new notifications)';
    } else {
      label += ' (no notifications)';
    }
  } else if (count === 1) {
    label += ' (1 notification)';
  } else if (count <= maxCount) {
    label += ` (${count} notifications)`;
  } else {
    label += ` (${maxCount}+ notifications)`;
  }

  return label;
};

export const NotificationBell: React.FC<NotificationBellProps> = ({
  count,
  onClick,
  maxCount = 99,
  size = 'md',
  variant = 'ghost',
  showBadgeWhenZero = false,
  loading = false,
  disabled = false,
  'aria-label': baseAriaLabel = 'Notifications',
  className = '',
  title,
  animateOnUpdate = true,
  bounceBadgeOnUpdate = true,
  ...props
}) => {
  const { isRinging, isBadgeBouncing } = useNotificationAnimations(
    count,
    animateOnUpdate,
    bounceBadgeOnUpdate
  );

  // Determine if we should show notifications
  const shouldShowNotification = count > 0 || showBadgeWhenZero;
  const displayCount = count > maxCount ? maxCount : count;

  // Build bell icon with appropriate classes
  const bellIconClass = [
    isRinging
      ? styles.notificationBell.bellIconRinging
      : styles.notificationBell.bellIcon,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  // Create the bell icon element
  const bellIcon = <BellIcon size={size} className={bellIconClass} />;

  // Generate comprehensive aria-label
  const enhancedAriaLabel = generateAriaLabel(
    baseAriaLabel,
    count,
    maxCount,
    showBadgeWhenZero
  );

  // Build enhanced title
  const enhancedTitle =
    title ||
    (count === 0
      ? 'No new notifications'
      : count === 1
        ? '1 new notification'
        : count > maxCount
          ? `${maxCount}+ new notifications`
          : `${count} new notifications`);

  return (
    <div className={styles.notificationBell.accessibleBell}>
      <IconButton
        icon={bellIcon}
        variant={variant}
        size={size}
        loading={loading}
        disabled={disabled}
        onClick={onClick}
        aria-label={enhancedAriaLabel}
        title={enhancedTitle}
        notification={shouldShowNotification}
        notificationCount={count > 0 ? displayCount : undefined}
        maxNotificationCount={maxCount}
        className={`
          ${isBadgeBouncing ? styles.notificationBell.bouncingBadge : ''}
          ${className}
        `.trim()}
        {...props}
      />
    </div>
  );
};

/**
 * Type guards and utilities for NotificationBell
 */

/**
 * Check if count is within valid range
 */
export const isValidNotificationCount = (count: number): boolean => {
  return Number.isInteger(count) && count >= 0 && count <= 99999;
};

/**
 * Format notification count for display
 */
export const formatNotificationCount = (
  count: number,
  maxCount: number = 99
): string => {
  if (count <= 0) return '0';
  if (count <= maxCount) return count.toString();
  return `${maxCount}+`;
};

/**
 * Get notification urgency level based on count
 */
export const getNotificationUrgency = (
  count: number
): 'none' | 'low' | 'medium' | 'high' | 'urgent' => {
  if (count <= 0) return 'none';
  if (count <= 3) return 'low';
  if (count <= 10) return 'medium';
  if (count <= 50) return 'high';
  return 'urgent';
};

/**
 * Hook for managing notification bell state with WebSocket integration
 */
export const useNotificationBell = (initialCount: number = 0) => {
  const [count, setCount] = useState(initialCount);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const updateCount = (newCount: number) => {
    if (isValidNotificationCount(newCount)) {
      setCount(newCount);
      setLastUpdate(new Date());
    }
  };

  const incrementCount = (amount: number = 1) => {
    setCount((prevCount) => {
      const newCount = prevCount + amount;
      if (isValidNotificationCount(newCount)) {
        setLastUpdate(new Date());
        return newCount;
      }
      return prevCount;
    });
  };

  const resetCount = () => {
    setCount(0);
    setLastUpdate(new Date());
  };

  const urgency = getNotificationUrgency(count);
  const formattedCount = formatNotificationCount(count);

  return {
    count,
    formattedCount,
    lastUpdate,
    urgency,
    updateCount,
    incrementCount,
    resetCount,
  };
};

export default NotificationBell;
