/**
 * FilterCard - Display filter information with metrics and actions
 * Based on the view_filters.png mockup design
 * Now supports async stats loading with beautiful loading indicators
 */
import React from 'react';
import * as styles from './FilterCard.css';
import { MetricsBadge } from './MetricsBadge';
import { CategoryTags } from './CategoryTags';
import Button from '@/shared/ui/Button';
import { useFilterStats } from '@/features/filters/hooks/useFilterStats';
import type { Filter } from '@/features/filters/types/filter.types';
import { dataCy } from '@/shared/lib/test-utils';

export interface FilterCardProps {
  /** Filter data to display */
  filter: Filter;
  /** Callback when card is clicked */
  onClick?: () => void;
  /** Callback when edit button is clicked */
  onEdit?: () => void;
  /** Callback when delete button is clicked */
  onDelete?: () => void;
  /** Loading state for the card itself */
  loading?: boolean;
  /** Whether to load stats asynchronously */
  enableAsyncStats?: boolean;
  /** Additional class name */
  className?: string;
  /** Inline styles for animations */
  style?: React.CSSProperties;
}

// Icon components
const EditIcon: React.FC = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const DeleteIcon: React.FC = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="3,6 5,6 21,6" />
    <path d="m19,6v14c0,1-1,2-2,2H7c-1,0-2-1-2-2V6m3,0V4c0-1,1-2,2-2h4c0-1,1-2,2-2v2" />
    <line x1="10" y1="11" x2="10" y2="17" />
    <line x1="14" y1="11" x2="14" y2="17" />
  </svg>
);

const SmallClockIcon: React.FC = () => (
  <svg
    width="10"
    height="10"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10" />
    <polyline points="12,6 12,12 16,14" />
  </svg>
);

export const FilterCard: React.FC<FilterCardProps> = ({
  filter,
  onClick,
  onEdit,
  onDelete,
  loading = false,
  enableAsyncStats = true,
  className = '',
  style,
}) => {
  // Load stats asynchronously
  const { stats, isLoading: statsLoading } = useFilterStats(filter.id, {
    enabled: enableAsyncStats,
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchOnWindowFocus: false,
  });

  // Determine metrics to display - only use async stats (no fallback to avoid flashing)
  const showStatsLoading = enableAsyncStats && statsLoading && !stats;
  const totalDeals = stats?.totalMatches ?? 0;
  const newDeals = stats?.matchesLast24h ?? 0;

  // Handle action button clicks (prevent event bubbling to card click)
  const handleActionClick = (e: React.MouseEvent, action: () => void): void => {
    e.stopPropagation();
    action();
  };

  // Handle card click
  const handleCardClick = (): void => {
    if (onClick && !loading) {
      onClick();
    }
  };

  // Determine if the card should have click cursor
  const isClickable = onClick && !loading;

  return (
    <div
      className={`${styles.card.base} ${isClickable ? styles.card.clickable : ''} ${loading ? styles.card.loading : ''} ${className}`}
      onClick={handleCardClick}
      role={isClickable ? 'button' : 'article'}
      tabIndex={isClickable ? 0 : undefined}
      style={style}
      onKeyDown={(e) => {
        if (isClickable && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          handleCardClick();
        }
      }}
      aria-label={
        isClickable ? `View details for ${filter.name} filter` : undefined
      }
      {...dataCy('filter-card')}
    >
      {/* Card Header */}
      <div className={styles.card.header}>
        <div className={styles.card.titleSection}>
          <h3 className={styles.card.title}>
            {filter.name}
            {!filter.active && (
              <span
                className={styles.card.inactiveIndicator}
                aria-label="Inactive filter"
              >
                (Inactive)
              </span>
            )}
          </h3>
          {filter.description && (
            <p className={styles.card.description}>{filter.description}</p>
          )}
        </div>

        {/* Metrics Section */}
        <div className={styles.card.metricsSection}>
          <div className={styles.card.metricsContainer}>
            <div className={styles.card.totalBadgeWrapper}>
              <MetricsBadge
                label="Total"
                value={totalDeals}
                variant="total"
                loading={showStatsLoading}
                className={styles.card.totalMetric}
              />
              {!showStatsLoading && newDeals > 0 && (
                <span
                  className={styles.card.newCountBadge}
                  title={`${newDeals} new deals in the last 24 hours`}
                >
                  <SmallClockIcon />+{newDeals}
                </span>
              )}
              {enableAsyncStats && statsLoading && !stats && (
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <SmallClockIcon />
                  <span>Loading...</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Card Body */}
      <div className={styles.card.body}>
        {/* Categories */}
        {filter.categories.length > 0 && (
          <div className={styles.card.categoriesSection}>
            <CategoryTags
              categories={filter.categories}
              maxVisible={3}
              size="sm"
            />
          </div>
        )}
      </div>

      {/* Card Actions */}
      <div className={styles.card.actions}>
        {onEdit && (
          <Button
            variant="ghost"
            size="sm"
            icon={<EditIcon />}
            onClick={(e) => handleActionClick(e, onEdit)}
            disabled={loading}
            aria-label={`Edit ${filter.name} filter`}
            {...dataCy('edit-filter-button')}
          >
            Edit
          </Button>
        )}

        {onDelete && (
          <Button
            variant="danger"
            size="sm"
            icon={<DeleteIcon />}
            onClick={(e) => handleActionClick(e, onDelete)}
            disabled={loading}
            aria-label={`Delete ${filter.name} filter`}
            {...dataCy('delete-filter-button')}
          >
            Delete
          </Button>
        )}
      </div>

      {/* Loading Overlay */}
      {loading && (
        <div className={styles.card.loadingOverlay} aria-live="polite">
          <div className={styles.card.spinner} />
        </div>
      )}
    </div>
  );
};

export default FilterCard;
