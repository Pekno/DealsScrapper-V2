/**
 * FilterGrid - Responsive grid layout for filter cards
 * Based on the view_filters.png mockup design
 * Now supports async stats loading with progressive enhancement
 */
import React from 'react';
import * as styles from './FilterGrid.css';
import { FilterCard } from './FilterCard';
import { EmptyState } from '@/shared/ui/EmptyState';
import type { Filter } from '../types/filter.types';

export interface FilterGridProps {
  /** Array of filters to display */
  filters: Filter[];
  /** Loading state for the grid itself */
  loading?: boolean;
  /** Whether to enable async stats loading for filter cards */
  enableAsyncStats?: boolean;
  /** Callback when a filter card is clicked */
  onFilterClick: (filterId: string) => void;
  /** Callback when edit button is clicked */
  onFilterEdit: (filterId: string) => void;
  /** Callback when delete button is clicked */
  onFilterDelete: (filterId: string) => void;
  /** Callback when create filter button is clicked (for empty state) */
  onCreateFilter?: () => void;
  /** Additional class name */
  className?: string;
}

// Loading skeleton component for individual cards
const FilterCardSkeleton: React.FC = () => (
  <div className={styles.skeleton.card} aria-hidden="true">
    <div className={styles.skeleton.header}>
      <div className={styles.skeleton.titleArea}>
        <div className={styles.skeleton.title} />
        <div className={styles.skeleton.description} />
      </div>
      <div className={styles.skeleton.metrics}>
        <div className={styles.skeleton.badge} />
        <div className={styles.skeleton.badge} />
      </div>
    </div>
    <div className={styles.skeleton.body}>
      <div className={styles.skeleton.date} />
      <div className={styles.skeleton.tags}>
        <div className={styles.skeleton.tag} />
        <div className={styles.skeleton.tag} />
        <div className={styles.skeleton.tag} />
      </div>
    </div>
    <div className={styles.skeleton.actions}>
      <div className={styles.skeleton.button} />
      <div className={styles.skeleton.button} />
    </div>
  </div>
);

export const FilterGrid: React.FC<FilterGridProps> = ({
  filters,
  loading = false,
  enableAsyncStats = true,
  onFilterClick,
  onFilterEdit,
  onFilterDelete,
  onCreateFilter,
  className = '',
}) => {
  // Generate skeleton cards for loading state
  const renderSkeletonCards = () => {
    const skeletonCount = 6; // Show 6 skeleton cards
    return Array.from({ length: skeletonCount }, (_, index) => (
      <FilterCardSkeleton key={`skeleton-${index}`} />
    ));
  };

  // Handle filter card click
  const handleFilterClick = (filterId: string) => {
    if (!loading) {
      onFilterClick(filterId);
    }
  };

  // Handle edit click
  const handleEditClick = (filterId: string) => {
    if (!loading) {
      onFilterEdit(filterId);
    }
  };

  // Handle delete click
  const handleDeleteClick = (filterId: string) => {
    if (!loading) {
      onFilterDelete(filterId);
    }
  };

  // Show loading state
  if (loading) {
    return (
      <div
        className={`${styles.grid.container} ${className}`}
        role="region"
        aria-label="Loading filters"
        aria-live="polite"
      >
        <div className={styles.grid.base}>{renderSkeletonCards()}</div>
      </div>
    );
  }

  // Show empty state when no filters
  if (filters.length === 0) {
    return (
      <div className={`${styles.grid.container} ${className}`}>
        <EmptyState
          title="No filters yet"
          description="Create your first filter to start receiving personalized deal alerts that match your interests."
          iconType="filter"
          action={
            onCreateFilter
              ? {
                  label: 'Create Your First Filter',
                  onClick: onCreateFilter,
                }
              : undefined
          }
        />
      </div>
    );
  }

  // Render filter cards
  return (
    <div
      className={`${styles.grid.container} ${className}`}
      role="region"
      aria-label={`${filters.length} filter${filters.length === 1 ? '' : 's'}`}
    >
      <div className={styles.grid.base}>
        {filters.map((filter, index) => (
          <FilterCard
            key={filter.id}
            filter={filter}
            onClick={() => handleFilterClick(filter.id)}
            onEdit={() => handleEditClick(filter.id)}
            onDelete={() => handleDeleteClick(filter.id)}
            loading={loading}
            enableAsyncStats={enableAsyncStats}
            className={styles.grid.item}
            style={{
              animationDelay: enableAsyncStats ? `${index * 100}ms` : '0ms',
            }}
          />
        ))}
      </div>
    </div>
  );
};

export default FilterGrid;
