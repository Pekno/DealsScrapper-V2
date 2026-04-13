/**
 * ProductsTableHead - Table header component with dynamic sortable columns
 * Uses shared-types column definitions for site-specific column display
 */
import React from 'react';
import * as tableStyles from '../MatchesTable.css';
import { SortArrows } from '@/shared/ui/SortArrows';
import type { ArticleSortField, SortConfig } from '@/shared/types/article';
import type { TableColumnDefinition } from '@dealscrapper/shared-types';

export interface ProductsTableHeadProps {
  /** Current sort configuration */
  sortConfig: SortConfig;
  /** Sort change handler */
  onSort: (field: ArticleSortField) => void;
  /** Dynamic columns from shared-types */
  columns: TableColumnDefinition[];
}

/**
 * Check if a column key is a valid ArticleSortField
 */
function isValidSortField(key: string): key is ArticleSortField {
  const sortableFields: ArticleSortField[] = [
    'title',
    'currentPrice',
    'publishedAt',
    'scrapedAt',
    'score',
    'createdAt',
    'temperature',
  ];
  return sortableFields.includes(key as ArticleSortField);
}

export const ProductsTableHead: React.FC<ProductsTableHeadProps> = ({
  sortConfig,
  onSort,
  columns,
}) => {
  /**
   * Handle column header click for sorting
   */
  const handleColumnClick = (column: TableColumnDefinition): void => {
    if (column.sortable && isValidSortField(column.key)) {
      onSort(column.key);
    }
  };

  return (
    <thead>
      <tr className={tableStyles.tableHeaderRow}>
        {columns.map((column) => {
          const isSortable = column.sortable && isValidSortField(column.key);
          const isActiveSort = sortConfig.field === column.key;

          return (
            <th
              key={column.key}
              className={tableStyles.headerCell}
              onClick={isSortable ? () => handleColumnClick(column) : undefined}
              style={{
                width: column.width,
                textAlign: column.align || 'left',
                cursor: isSortable ? 'pointer' : 'default',
              }}
              data-cy={isSortable ? `sort-header-${column.key}` : undefined}
            >
              <div className={tableStyles.headerContent}>
                <span className={tableStyles.headerText}>{column.label}</span>
                {isSortable && (
                  <SortArrows
                    field={column.key as ArticleSortField}
                    activeField={sortConfig.field}
                    direction={sortConfig.direction}
                  />
                )}
              </div>
            </th>
          );
        })}
      </tr>
    </thead>
  );
};

export default ProductsTableHead;
