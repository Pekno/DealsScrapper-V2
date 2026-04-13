/**
 * ProductsTableStates - Loading and empty state components for the products table
 */
import React from 'react';
import * as tableStyles from '../MatchesTable.css';
import { Button } from '@/shared/ui/Button';

export interface LoadingStateProps {
  /** Optional custom loading message */
  message?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Loading products...',
}) => {
  return (
    <div className={tableStyles.loadingContainer}>
      <div className={tableStyles.spinner} />
      <p className={tableStyles.loadingText}>{message}</p>
    </div>
  );
};

export interface EmptyStateProps {
  /** Current search term */
  searchTerm?: string;
  /** Search clear handler */
  onClearSearch?: () => void;
  /** Optional custom empty message */
  message?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  searchTerm,
  onClearSearch,
  message = 'No products found matching your criteria.',
}) => {
  return (
    <div className={tableStyles.emptyState}>
      <p className={tableStyles.emptyStateText}>{message}</p>
      {searchTerm && onClearSearch && (
        <Button variant="secondary" size="sm" onClick={onClearSearch}>
          Clear Search
        </Button>
      )}
    </div>
  );
};

export default { LoadingState, EmptyState };
