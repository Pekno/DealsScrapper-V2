/**
 * ProductsTable - Interactive table for displaying matching products/articles
 * Features: dynamic columns based on site selection, sorting, pagination, search, responsive design
 * Uses shared-types column definitions for consistency with backend
 */
import React, { useState, useCallback } from 'react';
import * as tableStyles from '../MatchesTable.css';
import type {
  ArticleWithMatch,
  ArticleSortField,
  SortConfig,
} from '@/shared/types/article';
import { useTableColumns } from '../../hooks/useTableColumns';
import { useSiteRegistry } from '@/shared/hooks';

// Import sub-components
import ProductsTableHeader from './ProductsTableHeader';
import ProductsTableHead from './ProductsTableHead';
import ProductsTableRow from './ProductsTableRow';
import ProductsTablePagination from './ProductsTablePagination';
import { LoadingState, EmptyState } from './ProductsTableStates';

export interface ProductsTableProps {
  /** Articles to display */
  articles: ArticleWithMatch[];
  /** Loading state */
  loading?: boolean;
  /** Total number of items (for pagination) */
  totalItems: number;
  /** Current page number */
  currentPage: number;
  /** Total number of pages */
  totalPages: number;
  /** Items per page */
  itemsPerPage: number;
  /** Current search term */
  searchTerm: string;
  /** Search change handler */
  onSearchChange: (searchTerm: string) => void;
  /** Clear search handler */
  onClearSearch?: () => void;
  /** Page change handler */
  onPageChange: (page: number) => void;
  /** Items per page change handler */
  onItemsPerPageChange: (itemsPerPage: number) => void;
  /** Sort change handler */
  onSortChange: (sortBy: ArticleSortField, sortOrder: 'asc' | 'desc') => void;
  /** Show expired products */
  showExpired: boolean;
  /** Toggle expired products visibility */
  onToggleExpired: () => void;
  /** Site IDs for dynamic column display (e.g., ['dealabs', 'vinted']) */
  siteIds?: string[];
}

/**
 * Main ProductsTable component
 */
export const ProductsTable: React.FC<ProductsTableProps> = ({
  articles,
  loading = false,
  totalItems,
  currentPage,
  totalPages,
  itemsPerPage,
  searchTerm,
  onSearchChange,
  onClearSearch,
  onPageChange,
  onItemsPerPageChange,
  onSortChange,
  showExpired,
  onToggleExpired,
  siteIds = [],
}) => {
  // Get dynamic columns based on selected sites
  const { visibleColumns } = useTableColumns(siteIds);

  // Single registry instance for the entire table — passed down to each row
  const { getSiteByName } = useSiteRegistry();

  // State for sorting
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    field: 'score',
    direction: 'desc',
  });

  // Handle sort change
  const handleSort = useCallback(
    (field: ArticleSortField) => {
      const newDirection: 'asc' | 'desc' =
        sortConfig.field === field && sortConfig.direction === 'asc'
          ? 'desc'
          : 'asc';

      const newSortConfig = { field, direction: newDirection };
      setSortConfig(newSortConfig);
      onSortChange(field, newDirection);
    },
    [sortConfig, onSortChange]
  );

  // Filter articles based on showExpired state
  const filteredArticles = showExpired
    ? articles
    : articles.filter((article) => !article.isExpired);

  return (
    <div className={tableStyles.tableContainer}>
      {/* Header Section with Search and Controls */}
      <ProductsTableHeader
        searchTerm={searchTerm}
        onSearchChange={onSearchChange}
        onClearSearch={onClearSearch}
        showExpired={showExpired}
        onToggleExpired={onToggleExpired}
      />

      {/* Table Section */}
      <div className={tableStyles.tableWrapper}>
        {loading ? (
          <LoadingState message="Loading products..." />
        ) : filteredArticles.length === 0 ? (
          <EmptyState
            searchTerm={searchTerm}
            onClearSearch={onClearSearch}
            message="No products found matching your criteria."
          />
        ) : (
          <table className={tableStyles.table} data-cy="matching-products-table">
            <ProductsTableHead
              sortConfig={sortConfig}
              onSort={handleSort}
              columns={visibleColumns}
            />
            <tbody>
              {filteredArticles.map((article) => (
                <ProductsTableRow
                  key={article.id}
                  article={article}
                  columns={visibleColumns}
                  getSiteByName={getSiteByName}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination Section */}
      {!loading && filteredArticles.length > 0 && (
        <ProductsTablePagination
          totalItems={totalItems}
          currentPage={currentPage}
          totalPages={totalPages}
          itemsPerPage={itemsPerPage}
          onPageChange={onPageChange}
          onItemsPerPageChange={onItemsPerPageChange}
        />
      )}
    </div>
  );
};

export default ProductsTable;
