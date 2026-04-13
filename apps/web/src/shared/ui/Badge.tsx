/**
 * Badge - Status indicators, category tags, and metrics display
 * Follows the design system from the create filter mockup
 */
import React from 'react';
import * as styles from './Badge.css';

export interface BadgeProps {
  /** Badge visual style variant */
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'accent';
  /** Badge size */
  size?: 'sm' | 'md' | 'lg';
  /** Icon to display before the text */
  icon?: React.ReactNode;
  /** Badge content */
  children: React.ReactNode;
  /** Whether the badge can be removed */
  removable?: boolean;
  /** Callback when remove button is clicked */
  onRemove?: () => void;
  /** Callback when badge is clicked */
  onClick?: () => void;
  /** Additional class name */
  className?: string;
  /** Inline styles */
  style?: React.CSSProperties;
}

// Remove icon component
const RemoveIcon: React.FC = () => (
  <svg
    className={styles.badge.removeIcon}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M6 18L18 6M6 6l12 12"
    />
  </svg>
);

export const Badge: React.FC<BadgeProps> = ({
  variant = 'default',
  size = 'md',
  icon,
  children,
  removable = false,
  onRemove,
  onClick,
  className = '',
  style,
  ...rest
}) => {
  const badgeClass = [
    styles.badge.base,
    styles.badge.variants[variant],
    styles.badge.sizes[size],
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const handleRemove = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onRemove?.();
  };

  const handleClick = (e: React.MouseEvent) => {
    if (onClick && !removable) {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <span
      className={`${badgeClass} ${onClick ? 'cursor-pointer hover:opacity-80' : ''}`}
      style={style}
      onClick={handleClick}
      {...rest}
    >
      {icon && <span className={styles.badge.icon}>{icon}</span>}

      <span className={styles.badge.text}>{children}</span>

      {removable && onRemove && (
        <button
          type="button"
          className={styles.badge.removeButton}
          onClick={handleRemove}
          aria-label="Remove"
          data-testid="badge-remove"
        >
          <RemoveIcon />
        </button>
      )}
    </span>
  );
};

export default Badge;
