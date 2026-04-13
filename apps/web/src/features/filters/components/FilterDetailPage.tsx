/**
 * FilterDetailPage - Display detailed filter information and matching products
 * Based on the wireframe design provided in the requirements
 * Now uses TanStack Query for optimized data fetching and caching
 */
import React from 'react';
import { formatAbsoluteDate } from '@/shared/lib/date-utils';
import * as styles from './FilterDetailPage.css';
import { Button } from '@/shared/ui/Button';
import { Badge } from '@/shared/ui/Badge';
import { Section } from '@/shared/ui/Section';
import Input from '@/shared/ui/Input';
import FormField from '@/shared/ui/FormField';
import SiteSelector from './SiteSelector';
import CategorySelector from './CategorySelector';
import { ProductsTable } from './ProductsTable/ProductsTable';
import type { Filter } from '../types/filter.types';
import type { ArticleListResponse } from '@/shared/types/article';
import { useFilterDetail } from '../hooks/useFilterDetail';
import { SmartScrapingStatus, SmartPollingData } from './SmartScrapingStatus';
import { dataCy } from '@/shared/lib/test-utils';
import { SiteSource } from '@dealscrapper/shared-types';
import * as createStyles from './CreateFilterForm.css';

// Props interface for the FilterDetailPage component
export interface FilterDetailPageProps {
  /** Filter ID to display */
  filterId: string;
  /** Optional initial filter data (for SSR or prefetching) */
  initialFilter?: Filter;
  /** Optional initial articles data */
  initialArticles?: ArticleListResponse;
  /** Optional article filter */
  articleFilter?: string;
  /** Smart polling data for real-time job status */
  smartPollingData?: SmartPollingData;
}

/**
 * FilterDetailPage Component
 *
 * Displays comprehensive filter information including:
 * - Filter metadata (name, description, creation date, categories)
 * - Edit button for filter modification
 * - Searchable and sortable table of matching products
 * - Pagination controls
 */
export const FilterDetailPage: React.FC<FilterDetailPageProps> = ({
  filterId,
  initialFilter,
  initialArticles,
  articleFilter,
  smartPollingData,
}) => {
  // Use custom hook for all business logic
  const {
    filter,
    matches,
    pagination,
    sorting,
    search,
    ui,
    showExpired,
    actions,
  } = useFilterDetail({
    filterId,
    initialFilter,
    articleFilter,
  });

  // Destructure hook values for cleaner usage
  const { currentPage: queryCurrentPage, totalPages, itemsPerPage, totalItems } = pagination;
  const { searchTerm } = search;
  const { loading, error, matchesLoading } = ui;
  const {
    handleSearch: handleSearchChange,
    handleClearSearch,
    handlePageChange,
    handleItemsPerPageChange,
    handleSort: handleSortChange,
    handleBackToFilters,
    handleToggleExpired,
  } = actions;

  // Format dates using centralized utilities
  const formatDate = (dateString: string | Date) => {
    return formatAbsoluteDate(dateString);
  };

  // Loading state
  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingContainer}>
          <div className={styles.spinner} />
          <p className={styles.loadingText}>Loading filter details...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.errorContainer}>
          <h2 className={styles.errorTitle}>Error Loading Filter</h2>
          <p className={styles.errorMessage}>{error}</p>
          <div className={styles.errorActions}>
            <Button variant="primary" onClick={() => window.location.reload()}>
              Try Again
            </Button>
            <Button variant="secondary" onClick={handleBackToFilters}>
              Back to Filters
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Not found state
  if (!filter) {
    return (
      <div className={styles.container}>
        <div className={styles.errorContainer}>
          <h2 className={styles.errorTitle}>Filter Not Found</h2>
          <p className={styles.errorMessage}>
            The filter you&apos;re looking for doesn&apos;t exist or you
            don&apos;t have permission to view it.
          </p>
          <Button variant="primary" onClick={handleBackToFilters}>
            Back to Filters
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container} {...dataCy('filter-detail-page')}>
      {/* Filter Information Section - Using Collapsible Section Component */}
      <Section
        icon={
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        }
        title="General"
        collapsible={true}
        defaultCollapsed={true}
        className={styles.filterInfoSection}
        testId="general"
      >
        {/* Filter Name */}
        <FormField label="Name" required>
          <Input
            value={filter.name}
            readOnly
            disabled
            {...dataCy('filter-title')}
          />
        </FormField>

        {/* Filter Description */}
        <FormField
          label="Description"
          description="A brief description of what this filter is for"
        >
          <textarea
            value={filter.description ?? ''}
            readOnly
            disabled
            rows={3}
            className={createStyles.createFilterForm.textarea}
          />
        </FormField>

        {/* Enabled Sites */}
        <SiteSelector
          value={(filter.enabledSites ?? []) as SiteSource[]}
          onChange={() => {}}
          disabled
        />

        {/* Categories */}
        <FormField label="Categories" required>
          <CategorySelector
            selectedCategories={filter.categories ?? []}
            onCategoryAdd={() => {}}
            onCategoryRemove={() => {}}
            searchValue=""
            onSearchChange={() => {}}
            enabledSites={filter.enabledSites ?? []}
            disabled
            maxSelections={10}
            placeholder="No categories"
          />
        </FormField>

        {/* Filter Status */}
        <div className={styles.generalField}>
          <label className={styles.generalFieldLabel}>Status</label>
          <div className={styles.generalFieldValue}>
            <Badge variant={filter.active ? 'success' : 'warning'} size="sm">
              {filter.active ? 'Active' : 'Inactive'}
            </Badge>
          </div>
        </div>

        {/* Creation Date */}
        <FormField label="Created">
          <Input
            value={formatDate(filter.createdAt)}
            readOnly
            disabled
          />
        </FormField>
      </Section>

      {/* Matching Products Section */}
      <section className={styles.productsSection}>
        <div className={styles.productsCard}>
          <div className={styles.productsHeader}>
            <h2 className={styles.productsTitle}>Matching Products</h2>
            <div className={styles.headerActions}>
              {smartPollingData && (
                <SmartScrapingStatus smartPollingData={smartPollingData} />
              )}
            </div>
          </div>

          <ProductsTable
            articles={matches}
            loading={matchesLoading}
            totalItems={totalItems}
            currentPage={queryCurrentPage}
            totalPages={totalPages}
            itemsPerPage={itemsPerPage}
            searchTerm={searchTerm}
            onSearchChange={handleSearchChange}
            onClearSearch={handleClearSearch}
            onPageChange={handlePageChange}
            onItemsPerPageChange={handleItemsPerPageChange}
            onSortChange={handleSortChange}
            showExpired={showExpired}
            onToggleExpired={handleToggleExpired}
            siteIds={filter.enabledSites}
          />
        </div>
      </section>
    </div>
  );
};

export default FilterDetailPage;
