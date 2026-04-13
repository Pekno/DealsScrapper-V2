/**
 * LoadingSpinner - Beautiful loading indicators for async content
 * Supports multiple variants and provides skeleton loading for metrics
 */
import React from 'react';
import * as styles from './LoadingSpinner.css';

export interface LoadingSpinnerProps {
  /** Size of the spinner */
  size?: 'small' | 'medium' | 'large';
  /** Color variant */
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger';
  /** Additional class name */
  className?: string;
  /** Accessible label */
  'aria-label'?: string;
}

export interface SkeletonProps {
  /** Type of skeleton */
  variant?: 'badge' | 'text' | 'metric';
  /** Width override */
  width?: string;
  /** Height override */
  height?: string;
  /** Additional class name */
  className?: string;
}

export interface PulseLoaderProps {
  children: React.ReactNode;
  /** Whether to show pulse animation */
  loading?: boolean;
  /** Additional class name */
  className?: string;
}

/**
 * Circular loading spinner with smooth rotation animation
 */
export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'medium',
  variant = 'primary',
  className = '',
  'aria-label': ariaLabel = 'Loading...',
}) => {
  return (
    <div
      className={`${styles.loadingSpinner.base} ${className}`}
      role="status"
      aria-label={ariaLabel}
    >
      <div
        className={`
          ${styles.loadingSpinner.spinner}
          ${styles.loadingSpinner[size]}
          ${styles.loadingSpinner[variant]}
        `}
      />
    </div>
  );
};

/**
 * Skeleton loading placeholder with shimmer animation
 */
export const Skeleton: React.FC<SkeletonProps> = ({
  variant = 'text',
  width,
  height,
  className = '',
}) => {
  const baseClass = styles.skeleton.base;
  const variantClass = styles.skeleton[variant];

  const customStyles = {
    ...(width && { width }),
    ...(height && { height }),
  };

  return (
    <div
      className={`${baseClass} ${variantClass} ${className}`}
      style={customStyles}
      role="status"
      aria-label="Loading content..."
    />
  );
};

/**
 * Pulse animation wrapper for loading states
 */
export const PulseLoader: React.FC<PulseLoaderProps> = ({
  children,
  loading = false,
  className = '',
}) => {
  return (
    <div className={`${loading ? styles.pulse.container : ''} ${className}`}>
      {children}
    </div>
  );
};

/**
 * Metrics-specific skeleton loader that matches MetricsBadge dimensions
 */
export const MetricsSkeleton: React.FC<{ className?: string }> = ({
  className = '',
}) => {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Skeleton variant="badge" />
      <LoadingSpinner size="small" variant="secondary" />
    </div>
  );
};

export default LoadingSpinner;
