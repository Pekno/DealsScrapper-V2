/**
 * ProductsTableHeader - Header component for the products table
 * Handles search functionality and items per page selection
 */
import React from 'react';
import * as tableStyles from '../MatchesTable.css';
import { Input } from '@/shared/ui/Input';

// Eye icons for toggle button
const EyeIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOffIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

export interface ProductsTableHeaderProps {
  /** Current search term */
  searchTerm: string;
  /** Search change handler */
  onSearchChange: (searchTerm: string) => void;
  /** Clear search handler */
  onClearSearch?: () => void;
  /** Show expired products */
  showExpired: boolean;
  /** Toggle expired products visibility */
  onToggleExpired: () => void;
}

export const ProductsTableHeader: React.FC<ProductsTableHeaderProps> = ({
  searchTerm,
  onSearchChange,
  onClearSearch,
  showExpired,
  onToggleExpired,
}) => {
  return (
    <div className={tableStyles.tableHeader}>
      <div className={tableStyles.headerControlsGroup}>
        <div className={tableStyles.searchContainer}>
          <Input
            type="text"
            placeholder="Search products..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className={tableStyles.searchInput}
          />
          <div className={tableStyles.searchIcon}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
          {searchTerm && onClearSearch && (
            <button
              className={tableStyles.searchClearButton}
              onClick={onClearSearch}
              aria-label="Clear search"
              type="button"
            >
              ×
            </button>
          )}
        </div>
        <button
          className={
            showExpired
              ? tableStyles.toggleExpiredButtonActive
              : tableStyles.toggleExpiredButton
          }
          onClick={onToggleExpired}
          aria-label={showExpired ? 'Hide expired products' : 'Show expired products'}
          title={showExpired ? 'Hide expired products' : 'Show expired products'}
          type="button"
          data-cy="toggle-expired-button"
        >
          {showExpired ? <EyeIcon /> : <EyeOffIcon />}
        </button>
      </div>
    </div>
  );
};

export default ProductsTableHeader;
