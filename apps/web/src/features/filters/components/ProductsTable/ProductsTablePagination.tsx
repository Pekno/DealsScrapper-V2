/**
 * ProductsTablePagination - Pagination component for the products table
 * Handles page navigation and displays result information
 */
import React, { useMemo } from 'react';
import * as tableStyles from '../MatchesTable.css';
import { Button } from '@/shared/ui/Button';
import { Dropdown } from '@/shared/ui/Dropdown';

export interface ProductsTablePaginationProps {
  /** Total number of items */
  totalItems: number;
  /** Current page number */
  currentPage: number;
  /** Total number of pages */
  totalPages: number;
  /** Items per page */
  itemsPerPage: number;
  /** Page change handler */
  onPageChange: (page: number) => void;
  /** Items per page change handler */
  onItemsPerPageChange: (itemsPerPage: number) => void;
}

export const ProductsTablePagination: React.FC<
  ProductsTablePaginationProps
> = ({
  totalItems,
  currentPage,
  totalPages,
  itemsPerPage,
  onPageChange,
  onItemsPerPageChange,
}) => {
  // Generate page numbers for pagination
  const pageNumbers = useMemo(() => {
    const pages: (number | string)[] = [];
    const showEllipsis = totalPages > 7;

    if (!showEllipsis) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Show: 1 ... currentPage-1 currentPage currentPage+1 ... totalPages
      if (currentPage <= 4) {
        for (let i = 1; i <= 5; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 3) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push('...');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      }
    }

    return pages;
  }, [currentPage, totalPages]);

  return (
    <div className={tableStyles.pagination}>
      {/* Results Info and Items Per Page */}
      <div className={tableStyles.paginationInfo}>
        <div className={tableStyles.itemsPerPageContainer}>
          <span>Show:</span>
          <Dropdown
            options={[
              { value: '10', label: '10' },
              { value: '25', label: '25' },
              { value: '50', label: '50' },
              { value: '100', label: '100' },
            ]}
            value={itemsPerPage.toString()}
            onChange={(selectedValue: string | string[]) =>
              onItemsPerPageChange(Number(selectedValue))
            }
            className={tableStyles.itemsPerPageSelect}
            size="sm"
            placeholder="Per page"
            aria-label="Items per page"
          />
        </div>
        <span>
          Showing {(currentPage - 1) * itemsPerPage + 1}-
          {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems}{' '}
          results
        </span>
      </div>

      {/* Pagination Controls */}
      <div className={tableStyles.paginationControls}>
        <Button
          variant="secondary"
          size="sm"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          className={tableStyles.pageButton}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M15 18L9 12L15 6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Button>

        <div className={tableStyles.pageNumbers}>
          {pageNumbers.map((page, index) => (
            <React.Fragment key={index}>
              {page === '...' ? (
                <span className={tableStyles.pageEllipsis}>...</span>
              ) : (
                <button
                  className={
                    page === currentPage
                      ? tableStyles.pageButtonActive
                      : tableStyles.pageButton
                  }
                  onClick={() => onPageChange(page as number)}
                >
                  {page}
                </button>
              )}
            </React.Fragment>
          ))}
        </div>

        <Button
          variant="secondary"
          size="sm"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          className={tableStyles.pageButton}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M9 18L15 12L9 6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Button>
      </div>
    </div>
  );
};

export default ProductsTablePagination;
