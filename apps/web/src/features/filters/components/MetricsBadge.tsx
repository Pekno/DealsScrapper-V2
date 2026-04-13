/**
 * MetricsBadge - Display deal counts and filter performance metrics
 * Now supports loading states with beautiful skeleton animations
 */
import React from 'react';
import Badge from '@/shared/ui/Badge';
import { Skeleton, LoadingSpinner } from '@/shared/ui/LoadingSpinner';

export interface MetricsBadgeProps {
  /** Metric label */
  label: string;
  /** Metric value */
  value: number | undefined | null;
  /** Badge variant style */
  variant?: 'total' | 'new' | 'active' | 'inactive';
  /** Show icon before the text */
  showIcon?: boolean;
  /** Loading state - shows skeleton when true */
  loading?: boolean;
  /** Additional class name */
  className?: string;
}

// Icon component for metrics
const MetricsIcon: React.FC<{ variant: string }> = ({ variant }) => {
  const iconColor =
    {
      total: '#6B7280',
      new: '#059669',
      active: '#2563EB',
      inactive: '#9CA3AF',
    }[variant] || '#6B7280';

  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke={iconColor}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );
};

export const MetricsBadge: React.FC<MetricsBadgeProps> = ({
  label,
  value,
  variant = 'total',
  showIcon = false,
  loading = false,
  className = '',
}) => {
  // Show skeleton loading state
  if (loading) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Skeleton variant="badge" />
        <LoadingSpinner
          size="small"
          variant="secondary"
          aria-label={`Loading ${label} metric`}
        />
      </div>
    );
  }

  // Map metric variants to badge variants
  const badgeVariantMap = {
    total: 'default' as const,
    new: 'success' as const,
    active: 'info' as const,
    inactive: 'default' as const,
  };

  const badgeVariant = badgeVariantMap[variant];

  // Format value for display with null safety
  const displayValue = (() => {
    if (value === undefined || value === null) return '0';
    return value > 999 ? `${Math.floor(value / 1000)}k+` : value.toString();
  })();

  return (
    <Badge
      variant={badgeVariant}
      size="md"
      icon={showIcon ? <MetricsIcon variant={variant} /> : undefined}
      className={className}
    >
      {label}: {displayValue}
    </Badge>
  );
};

export default MetricsBadge;
