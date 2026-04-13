/**
 * EmptyState - Versatile empty state component
 * Provides consistent empty state experiences across the DealsScrapper application
 */
import React from 'react';
import * as styles from './EmptyState.css';
import Button, { type ButtonProps } from './Button';

export interface EmptyStateProps {
  /** Main title text */
  title: string;
  /** Descriptive text to help users understand the situation */
  description: string;
  /** Custom icon or illustration */
  icon?: React.ReactNode;
  /** Optional action button configuration */
  action?: {
    label: string;
    onClick: () => void;
    variant?: ButtonProps['variant'];
    loading?: boolean;
  };
  /** Component size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Additional CSS class name */
  className?: string;
  /** Built-in icon variant for common scenarios */
  iconType?:
    | 'filter'
    | 'search'
    | 'notification'
    | 'error'
    | 'empty'
    | 'success';
  /** Secondary action (optional) */
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
}

// Default icon components for common scenarios
const DefaultIcons = {
  filter: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={styles.emptyState.icon.svg}
    >
      <path d="M3 6h18l-7 7v8l-4-2v-6L3 6z" />
      <circle cx="12" cy="12" r="1" />
    </svg>
  ),

  search: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={styles.emptyState.icon.svg}
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  ),

  notification: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={styles.emptyState.icon.svg}
    >
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      <circle cx="18" cy="8" r="3" fill="currentColor" />
    </svg>
  ),

  error: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={styles.emptyState.icon.svg}
    >
      <path d="M12 9v4" />
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <circle cx="12" cy="17" r="1" fill="currentColor" />
    </svg>
  ),

  empty: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={styles.emptyState.icon.svg}
    >
      <path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z" />
      <path d="M12 8v8" />
      <path d="M8 12h8" />
    </svg>
  ),

  success: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={styles.emptyState.icon.svg}
    >
      <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  ),
};

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon,
  action,
  size = 'md',
  className = '',
  iconType = 'empty',
  secondaryAction,
}) => {
  // Determine which icon to use
  const iconElement = icon || DefaultIcons[iconType];

  // Get CSS classes based on size
  const containerClass = styles.emptyState.container[size];
  const iconClass = `${styles.emptyState.icon.base[size]} ${styles.emptyState.icon.variants[iconType]}`;
  const titleClass = styles.emptyState.title[size];
  const descriptionClass = styles.emptyState.description[size];

  return (
    <div
      className={`${containerClass} ${className}`}
      role="region"
      aria-label={`Empty state: ${title}`}
    >
      <div className={styles.emptyState.content}>
        {/* Icon/Illustration */}
        <div className={iconClass} aria-hidden="true">
          {iconElement}
        </div>

        {/* Text Content */}
        <div>
          <h3 className={titleClass}>{title}</h3>

          <p className={descriptionClass}>{description}</p>
        </div>

        {/* Action Buttons */}
        {(action || secondaryAction) && (
          <div className="flex flex-col sm:flex-row gap-3 items-center">
            {action && (
              <Button
                variant={action.variant || 'primary'}
                size={size}
                onClick={action.onClick}
                loading={action.loading}
                className={styles.emptyState.actionButton}
              >
                {action.label}
              </Button>
            )}

            {secondaryAction && (
              <Button
                variant="ghost"
                size={size}
                onClick={secondaryAction.onClick}
              >
                {secondaryAction.label}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default EmptyState;
