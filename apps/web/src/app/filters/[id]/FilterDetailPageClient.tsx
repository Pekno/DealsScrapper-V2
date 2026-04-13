/**
 * Filter Detail Page Client Component
 * Client component that renders the FilterDetailPage with the specified filter
 * Wrapped with AppLayout for consistent header and sidebar
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useLocation, useSearchParams, useParams } from 'react-router-dom';
import AppLayout from '@/shared/layout/AppLayout';
import FilterDetailPage from '@/features/filters/components/FilterDetailPage';
import { PageHeader } from '@/shared/ui/PageHeader';
import { Button } from '@/shared/ui/Button';
// Debug components are now handled globally by UnifiedDebugBar in AppLayout
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useSmartFilterScrapingStatus } from '@/features/filters/hooks/useSmartFilterScrapingStatus';
import { apiClient } from '@/shared/lib/api';
import DealsRadarLoader from '@/shared/ui/DealsRadarLoader';
import type { Filter } from '@/features/filters/types/filter.types';
import type { ArticleListResponse } from '@/shared/types/article';

/**
 * Client Component - Filter Detail Page
 * Handles authentication, data fetching, and rendering the filter detail page
 */
export default function FilterDetailPageClient() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const { id: filterId } = useParams<{ id: string }>();

  if (!filterId) return null;
  const { user, loading: authLoading } = useAuth();
  const [initialFilter, setInitialFilter] = useState<Filter | undefined>();
  const [initialArticles, setInitialArticles] = useState<
    ArticleListResponse | undefined
  >();
  const [loading, setLoading] = useState(true);

  // Smart polling for scraping status (only for active filters)
  const smartPolling = useSmartFilterScrapingStatus(
    initialFilter?.active ? filterId : ''
  );

  // Handle authentication redirect
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login');
    }
  }, [user, authLoading, navigate]);

  // Handle edit filter button click
  const handleEditFilter = useCallback(() => {
    navigate(`/filters/${filterId}/edit`);
  }, [navigate, filterId]);

  // Handle back to filters list
  const handleBackToFilters = useCallback(() => {
    navigate('/filters');
  }, [navigate]);

  // Pre-fetch filter data
  useEffect(() => {
    const fetchInitialData = async () => {
      if (!user) return;

      try {
        setLoading(true);

        // Fetch filter data
        const filterResponse = await apiClient.getFilter(filterId);

        if (filterResponse.success && filterResponse.data) {
          setInitialFilter(filterResponse.data);

          // Also pre-fetch initial articles data
          const articlesResponse = await apiClient.getFilterMatches(
            filterId,
            1,
            25
          );
          if (articlesResponse.success && articlesResponse.data) {
            // Transform backend response to frontend format
            // The FilterDetailPage component will handle this transformation
            // For now, just pass the raw data and let FilterDetailPage handle it
            setInitialArticles(undefined); // Let FilterDetailPage handle the data fetching and transformation
          }
        } else if (!filterResponse.success) {
          // If filter doesn't exist or user doesn't have access, show not found
          navigate('/not-found', { replace: true });
        }
      } catch (error) {
        console.error('Error fetching filter data:', error);
        // Let the FilterDetailPage component handle the error
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();
  }, [user, filterId]);

  // Show loading while authenticating
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <DealsRadarLoader
          message="Loading..."
          subtext="Checking authentication"
          size="md"
        />
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!user) {
    return null;
  }

  // Show loading while fetching filter data
  if (loading) {
    return (
      <AppLayout currentPath={pathname}>
        <div className="flex items-center justify-center h-64">
          <div className="flex items-center space-x-2">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="text-gray-600">Loading filter details...</span>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout currentPath={pathname}>
      {/* Page Header */}
      <PageHeader
        title="Filter Details"
        description="View matching products and filter performance."
        actions={[
          <Button
            key="edit"
            variant="primary"
            size="md"
            onClick={handleEditFilter}
            data-cy="edit-filter-button"
          >
            Edit Filter
          </Button>,
          <Button
            key="back"
            variant="outline"
            size="md"
            onClick={handleBackToFilters}
          >
            Back
          </Button>,
        ]}
      />
      <FilterDetailPage
        filterId={filterId}
        initialFilter={initialFilter}
        initialArticles={initialArticles}
        articleFilter={searchParams.get('article') || undefined}
        smartPollingData={smartPolling}
      />
      {/* Debug panels are now handled globally by UnifiedDebugBar in AppLayout */}
    </AppLayout>
  );
}
