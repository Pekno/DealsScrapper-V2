/**
 * useFilterDetail - Custom hook for FilterDetailPage business logic
 *
 * Encapsulates all state management, data fetching, and business logic
 * for the filter detail page, leaving the component to focus on rendering.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { apiClient } from '@/shared/lib/api';
import { useDebounced } from '@/shared/hooks/useDebounced';
import { useFilterMatches } from './useFilterMatches';
import { useRealTimeFilterRefresh } from './useRealTimeFilterRefresh';
import { loggers } from '@/shared/lib/debug';
import type { Filter } from '@/features/filters/types/filter.types';
import type { ArticleSortField, ArticleWithMatch } from '@/shared/types/article';
import type { EnhancedWebSocketNotification } from '@/shared/lib/websocket';

const log = loggers.filters;

// ============================================================================
// Type Definitions
// ============================================================================

export interface UseFilterDetailParams {
  /** Filter ID to display */
  filterId: string;
  /** Optional initial filter data (for SSR or prefetching) */
  initialFilter?: Filter | null;
  /** Optional article filter from URL */
  articleFilter?: string;
}

export interface PaginationState {
  currentPage: number;
  totalPages: number;
  itemsPerPage: number;
  totalItems: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface SortingState {
  sortBy: ArticleSortField;
  sortOrder: 'asc' | 'desc';
}

export interface SearchState {
  searchTerm: string;
  debouncedSearchTerm: string;
}

export interface UIState {
  loading: boolean;
  error: string | null;
  matchesLoading: boolean;
  matchesFetching: boolean;
  matchesError: boolean;
}

export interface FilterDetailActions {
  handleSort: (field: ArticleSortField, order: 'asc' | 'desc') => void;
  handleSearch: (term: string) => void;
  handleClearSearch: () => void;
  handlePageChange: (page: number) => void;
  handleItemsPerPageChange: (items: number) => void;
  handleEditFilter: () => void;
  handleBackToFilters: () => void;
  handleToggleExpired: () => void;
  refetchFilter: () => Promise<void>;
  refetchMatches: () => void;
}

export interface UseFilterDetailResult {
  // Data
  filter: Filter | null;
  matches: ArticleWithMatch[];

  // Pagination
  pagination: PaginationState;

  // Sorting
  sorting: SortingState;

  // Search
  search: SearchState;

  // UI State
  ui: UIState;

  // Expired Products Toggle
  showExpired: boolean;

  // Actions
  actions: FilterDetailActions;
}

// ============================================================================
// Custom Hook Implementation
// ============================================================================

export function useFilterDetail({
  filterId,
  initialFilter,
  articleFilter,
}: UseFilterDetailParams): UseFilterDetailResult {
  // ---------------------------------------------------------------------------
  // Router & Navigation
  // ---------------------------------------------------------------------------
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { pathname } = useLocation();

  // ---------------------------------------------------------------------------
  // Filter State Management
  // ---------------------------------------------------------------------------
  const [filter, setFilter] = useState<Filter | null>(initialFilter || null);
  const [loading, setLoading] = useState(!initialFilter);
  const [error, setError] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Search State Management
  // ---------------------------------------------------------------------------
  const [searchTerm, setSearchTerm] = useState(articleFilter || '');
  const debouncedSearchTerm = useDebounced(searchTerm, 500);

  // ---------------------------------------------------------------------------
  // Pagination State Management
  // ---------------------------------------------------------------------------
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // ---------------------------------------------------------------------------
  // Sorting State Management
  // ---------------------------------------------------------------------------
  const [sortBy, setSortBy] = useState<ArticleSortField>('score');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // ---------------------------------------------------------------------------
  // Expired Products Toggle State
  // ---------------------------------------------------------------------------
  const [showExpired, setShowExpired] = useState(false);

  // ---------------------------------------------------------------------------
  // Filter Data Fetching
  // ---------------------------------------------------------------------------
  const fetchFilter = useCallback(async () => {
    if (initialFilter) return; // Skip if we have initial data

    try {
      setLoading(true);
      setError(null);

      const response = await apiClient.getFilter(filterId);

      if (response.success && response.data) {
        setFilter(response.data);
      } else {
        setError(response.error || 'Failed to load filter details');
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'An unexpected error occurred'
      );
    } finally {
      setLoading(false);
    }
  }, [filterId, initialFilter]);

  // ---------------------------------------------------------------------------
  // Filter Matches Data (TanStack Query)
  // ---------------------------------------------------------------------------
  const {
    data: matchesData,
    matches,
    isLoading: matchesLoading,
    isFetching: matchesFetching,
    isError: matchesError,
    error: matchesErrorObj,
    totalItems,
    currentPage: queryCurrentPage,
    totalPages,
    hasNext,
    hasPrev,
    refetch: refetchMatches,
    prefetchNextPage,
    prefetchPreviousPage,
  } = useFilterMatches({
    filterId,
    page: currentPage,
    limit: itemsPerPage,
    search: debouncedSearchTerm,
    sortBy,
    sortOrder,
    enabled: !!filterId && !!filter, // Only fetch when we have filter data
  });

  // ---------------------------------------------------------------------------
  // Real-Time WebSocket Notifications
  // ---------------------------------------------------------------------------
  const handleMatchingNotification = useCallback(
    (_notification: EnhancedWebSocketNotification) => {
      log.log(`New deal match received for filter "${filter?.name}" (${filterId})`);
    },
    [filter?.name, filterId]
  );

  useRealTimeFilterRefresh({
    filterId,
    enabled: !!filterId && !!filter, // Only enable when we have filter data
    onMatchingNotification: handleMatchingNotification,
    debounceMs: 1500, // Wait 1.5 seconds to batch multiple rapid notifications
  });

  // ---------------------------------------------------------------------------
  // URL Synchronization
  // ---------------------------------------------------------------------------
  const updateUrlWithSearch = useCallback(
    (searchValue: string) => {
      const params = new URLSearchParams(searchParams.toString());

      if (searchValue) {
        params.set('article', searchValue);
      } else {
        params.delete('article');
      }

      const newUrl = `${pathname}${params.toString() ? '?' + params.toString() : ''}`;
      navigate(newUrl, { replace: true });
    },
    [searchParams, pathname, navigate]
  );

  // ---------------------------------------------------------------------------
  // Search Handlers
  // ---------------------------------------------------------------------------
  const handleSearchChange = useCallback(
    (newSearchTerm: string) => {
      setSearchTerm(newSearchTerm);
      updateUrlWithSearch(newSearchTerm);
      setCurrentPage(1); // Reset to first page when searching
    },
    [updateUrlWithSearch]
  );

  const handleClearSearch = useCallback(() => {
    setSearchTerm('');
    updateUrlWithSearch('');
    setCurrentPage(1);
  }, [updateUrlWithSearch]);

  // ---------------------------------------------------------------------------
  // Pagination Handlers
  // ---------------------------------------------------------------------------
  const handlePageChange = useCallback(
    (page: number) => {
      setCurrentPage(page);
      // Prefetch adjacent pages for better UX
      if (page < totalPages) {
        prefetchNextPage();
      }
      if (page > 1) {
        prefetchPreviousPage();
      }
    },
    [totalPages, prefetchNextPage, prefetchPreviousPage]
  );

  const handleItemsPerPageChange = useCallback((limit: number) => {
    setItemsPerPage(limit);
    setCurrentPage(1); // Reset to first page
  }, []);

  // ---------------------------------------------------------------------------
  // Sorting Handlers
  // ---------------------------------------------------------------------------
  const handleSortChange = useCallback(
    (newSortBy: ArticleSortField, newSortOrder: 'asc' | 'desc') => {
      setSortBy(newSortBy);
      setSortOrder(newSortOrder);
      setCurrentPage(1); // Reset to first page
    },
    []
  );

  // ---------------------------------------------------------------------------
  // Navigation Handlers
  // ---------------------------------------------------------------------------
  const handleEditFilter = useCallback(() => {
    navigate(`/filters/${filterId}/edit`);
  }, [navigate, filterId]);

  const handleBackToFilters = useCallback(() => {
    navigate('/filters');
  }, [navigate]);

  // ---------------------------------------------------------------------------
  // Expired Products Toggle Handler
  // ---------------------------------------------------------------------------
  const handleToggleExpired = useCallback(() => {
    setShowExpired((prev) => !prev);
  }, []);

  // ---------------------------------------------------------------------------
  // Effects
  // ---------------------------------------------------------------------------

  // Initial filter data fetch
  useEffect(() => {
    fetchFilter();
  }, [fetchFilter]);

  // Sync URL parameter changes with search term (for navigation from notifications)
  useEffect(() => {
    const currentArticleParam = searchParams.get('article');
    const decodedArticle = currentArticleParam
      ? decodeURIComponent(currentArticleParam)
      : '';

    if (decodedArticle !== searchTerm) {
      setSearchTerm(decodedArticle);
      setCurrentPage(1); // Reset page when URL changes search term
    }
  }, [searchParams, searchTerm]);

  // Reset page when debounced search term changes
  useEffect(() => {
    if (debouncedSearchTerm !== searchTerm) {
      setCurrentPage(1);
    }
  }, [debouncedSearchTerm, searchTerm]);

  // ---------------------------------------------------------------------------
  // Computed State Objects
  // ---------------------------------------------------------------------------

  const pagination: PaginationState = useMemo(
    () => ({
      currentPage: queryCurrentPage,
      totalPages,
      itemsPerPage,
      totalItems,
      hasNext,
      hasPrev,
    }),
    [queryCurrentPage, totalPages, itemsPerPage, totalItems, hasNext, hasPrev]
  );

  const sorting: SortingState = useMemo(
    () => ({
      sortBy,
      sortOrder,
    }),
    [sortBy, sortOrder]
  );

  const searchState: SearchState = useMemo(
    () => ({
      searchTerm,
      debouncedSearchTerm,
    }),
    [searchTerm, debouncedSearchTerm]
  );

  const ui: UIState = useMemo(
    () => ({
      loading,
      error,
      matchesLoading,
      matchesFetching,
      matchesError,
    }),
    [loading, error, matchesLoading, matchesFetching, matchesError]
  );

  const actions: FilterDetailActions = useMemo(
    () => ({
      handleSort: handleSortChange,
      handleSearch: handleSearchChange,
      handleClearSearch,
      handlePageChange,
      handleItemsPerPageChange,
      handleEditFilter,
      handleBackToFilters,
      handleToggleExpired,
      refetchFilter: fetchFilter,
      refetchMatches,
    }),
    [
      handleSortChange,
      handleSearchChange,
      handleClearSearch,
      handlePageChange,
      handleItemsPerPageChange,
      handleEditFilter,
      handleBackToFilters,
      handleToggleExpired,
      fetchFilter,
      refetchMatches,
    ]
  );

  // ---------------------------------------------------------------------------
  // Return Organized State
  // ---------------------------------------------------------------------------

  return {
    // Data
    filter,
    matches,

    // State groups
    pagination,
    sorting,
    search: searchState,
    ui,

    // Expired Products Toggle
    showExpired,

    // Actions
    actions,
  };
}
