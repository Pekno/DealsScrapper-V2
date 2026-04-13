import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import AppLayout from '@/shared/layout/AppLayout';
import { FilterGrid } from '@/features/filters/components/FilterGrid';
import { Button } from '@/shared/ui/Button';
import { DeleteConfirmationModal } from '@/shared/ui/DeleteConfirmationModal';
import { PageHeader } from '@/shared/ui/PageHeader';
import { SearchInput } from '@/shared/ui/SearchInput';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { apiClient } from '@/shared/lib/api';
import type { Filter } from '@/features/filters/types/filter.types';
import { LoadingSpinner } from '@/shared/ui/LoadingSpinner';
import { dataCy } from '@/shared/lib/test-utils';
import { useToast } from '@/shared/lib/toast-context';

function FiltersContent() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [filters, setFilters] = useState<Filter[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(
    searchParams.get('search') || ''
  );
  const [error, setError] = useState<string | null>(null);

  // Delete confirmation modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [filterToDelete, setFilterToDelete] = useState<Filter | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);


  // Load filters on mount
  useEffect(() => {
    const loadFilters = async () => {
      if (!user) return;

      setLoading(true);
      setError(null);

      try {
        const response = await apiClient.getFilters({
          page: 1,
          limit: 50, // Load more filters for better UX
          sortBy: 'updatedAt',
          sortOrder: 'desc',
        });

        if (response.success && response.data) {
          // Use filters directly without transformation - stats will load asynchronously
          setFilters(response.data.filters);
        } else {
          setError(response.error || 'Failed to load filters');
          setFilters([]);
        }
      } catch (err) {
        console.error('Failed to load filters:', err);
        setError(
          'Failed to connect to the server. Please check your connection and try again.'
        );
        setFilters([]);
      } finally {
        setLoading(false);
      }
    };

    loadFilters();
  }, [user]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login');
    }
  }, [user, authLoading, navigate]);

  // Filter filters based on search query
  const filteredFilters = filters.filter(
    (filter) =>
      filter.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (filter.description &&
        filter.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleFilterClick = (filterId: string) => {
    navigate(`/filters/${filterId}`);
  };

  const handleFilterEdit = (filterId: string) => {
    navigate(`/filters/${filterId}/edit`);
  };

  const handleFilterDelete = (filterId: string) => {
    const filter = filters.find((f) => f.id === filterId);
    if (!filter) return;

    setFilterToDelete(filter);
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!filterToDelete) return;

    setDeleteLoading(true);
    setError(null);

    try {
      const response = await apiClient.deleteFilter(filterToDelete.id);

      if (response.success) {
        setFilters((prev) => prev.filter((f) => f.id !== filterToDelete.id));
        setDeleteModalOpen(false);
        setFilterToDelete(null);
        toast.success(`Filter "${filterToDelete.name}" deleted successfully!`, {
          title: 'Filter Deleted',
          duration: 4000,
        });
      } else {
        setError(response.error || 'Failed to delete filter');
        // Keep modal open on error so user can retry
      }
    } catch (err) {
      console.error('Failed to delete filter:', err);
      setError(
        'Failed to delete filter. Please check your connection and try again.'
      );
      // Keep modal open on error so user can retry
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteModalOpen(false);
    setFilterToDelete(null);
    setDeleteLoading(false);
  };

  const handleCreateFilter = () => {
    navigate('/filters/create');
  };

  if (authLoading) {
    return (
      <AppLayout currentPath={pathname}>
        <div className="flex items-center justify-center h-64">
          <div className="flex items-center space-x-2">
            <LoadingSpinner size="medium" variant="primary" />
            <span className="text-gray-600">Loading filters...</span>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <AppLayout currentPath={pathname}>
      <div className="flex flex-col h-full">
        {/* Header */}
        <PageHeader
          title="My Filters"
          description="Manage your deal filters and track performance"
          actions={
            <Button
              variant="primary"
              size="md"
              onClick={handleCreateFilter}
              className="flex-shrink-0"
              {...dataCy('create-filter-button')}
            >
              Create Filter
            </Button>
          }
        >
          {/* Search */}
          <div className="max-w-md">
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search filters..."
              className="w-full"
              {...dataCy('filter-search-input')}
            />
          </div>


          {/* Error Notice */}
          {error && (
            <div
              className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3"
              {...dataCy('filter-error-message')}
            >
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg
                    className="h-5 w-5 text-red-400"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-red-800">{error}</p>
                </div>
                <div className="ml-auto pl-3">
                  <div className="-mx-1.5 -my-1.5">
                    <button
                      onClick={() => setError(null)}
                      className="inline-flex bg-red-50 rounded-md p-1.5 text-red-500 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-red-50 focus:ring-red-600"
                    >
                      <svg
                        className="h-3 w-3"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </PageHeader>

        {/* Main Content */}
        <div className="flex-1 px-8 py-6 overflow-auto">
          {filters.length === 0 && !loading && !error && (
            <div className="text-center py-12">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1}
                  d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
                />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">
                No filters yet
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                Create your first filter to start monitoring deals.
              </p>
              <div className="mt-6">
                <Button
                  variant="primary"
                  size="md"
                  onClick={handleCreateFilter}
                  {...dataCy('create-first-filter-button')}
                >
                  Create Your First Filter
                </Button>
              </div>
            </div>
          )}

          {(filters.length > 0 || loading) && (
            <div {...dataCy('filter-grid')}>
              <FilterGrid
                filters={filteredFilters}
                loading={loading}
                enableAsyncStats={true}
                onFilterClick={handleFilterClick}
                onFilterEdit={handleFilterEdit}
                onFilterDelete={handleFilterDelete}
                onCreateFilter={handleCreateFilter}
              />
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <div {...dataCy('delete-confirmation-modal')}>
        <DeleteConfirmationModal
          isOpen={deleteModalOpen}
          onClose={handleDeleteCancel}
          onConfirm={handleDeleteConfirm}
          itemName={filterToDelete?.name || ''}
          itemType="filter"
          loading={deleteLoading}
          warningMessage={
            filterToDelete
              ? `Are you sure you want to delete the filter "${filterToDelete.name}"? This will stop monitoring all deals that match this filter and cannot be undone.`
              : ''
          }
        />
      </div>
    </AppLayout>
  );
}

export default function FiltersPage() {
  return <FiltersContent />;
}
