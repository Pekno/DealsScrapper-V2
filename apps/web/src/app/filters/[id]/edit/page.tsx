/**
 * Edit Filter Page - Reuses CreateFilterForm component for editing existing filters
 */
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import AppLayout from '@/shared/layout/AppLayout';
import CreateFilterForm from '@/features/filters/components/CreateFilterForm';
import { CreateFilterFormData } from '@/features/filters/hooks/useFilterForm';
import { PageHeader } from '@/shared/ui/PageHeader';
import { LoadingSpinner } from '@/shared/ui/LoadingSpinner';
import { Filter, UpdateFilterRequest, Category } from '@/features/filters/types/filter.types';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { apiClient } from '@/shared/lib/api';
import { useToast } from '@/shared/lib/toast-context';
import { useInvalidateFilterMatches } from '@/features/filters/hooks/useFilterMatches';
import DealsRadarLoader from '@/shared/ui/DealsRadarLoader';
import { dataCy } from '@/shared/lib/test-utils';

export default function EditFilterPage() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { id: filterId } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const invalidateFilterMatches = useInvalidateFilterMatches();

  const [filter, setFilter] = useState<Filter | null>(null);
  const [initialData, setInitialData] = useState<
    Partial<CreateFilterFormData> | undefined
  >();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login', { replace: true });
    }
  }, [user, authLoading, navigate]);

  // Load filter data
  useEffect(() => {
    if (!filterId || authLoading || !user) return;

    const loadFilter = async () => {
      try {
        setIsLoading(true);
        setError(undefined);

        const response = await apiClient.getFilter(filterId);

        if (response.success && response.data) {
          const filterData = response.data;
          setFilter(filterData);

          // Transform filter data to form data with proper null handling
          const formData: Partial<CreateFilterFormData> = {
            name: filterData.name,
            description: filterData.description || '',
            categories: filterData.categories.map((category: Category) => ({
              ...category,
              // Ensure description is either string or undefined, not null
              description: category.description || undefined,
              // Ensure parentId handles null values properly
              parentId: category.parentId || undefined,
              // Ensure dates are properly handled for form validation
              createdAt: typeof category.createdAt === 'string' ? new Date(category.createdAt) : category.createdAt,
              updatedAt: typeof category.updatedAt === 'string' ? new Date(category.updatedAt) : category.updatedAt,
            })),
            enabledSites: filterData.enabledSites,
            rules: filterData.filterExpression.rules, // Rules are properly typed as (FilterRule | FilterRuleGroup)[]
            notifications: {
              immediate: filterData.immediateNotifications,
              dailyDigest: filterData.digestFrequency === 'daily',
              weeklyDigest: filterData.digestFrequency === 'weekly',
              monthlyDigest: false, // Not supported in current schema
            },
          };

          setInitialData(formData);
        } else {
          setError(response.error || 'Failed to load filter');
        }
      } catch (err) {
        console.error('Error loading filter:', err);
        setError(
          'Failed to load filter. Please check your connection and try again.'
        );
      } finally {
        setIsLoading(false);
      }
    };

    loadFilter();
  }, [filterId, authLoading, user]);

  const handleUpdate = async (
    filterId: string,
    filterData: UpdateFilterRequest
  ) => {
    setIsSubmitting(true);
    setError(undefined);

    try {
      const response = await apiClient.updateFilter(filterId, filterData);

      if (response.success && response.data) {
        // Remove filter matches cache entirely since filter criteria may have changed
        // Using remove: true ensures user sees loading state, not stale matches
        invalidateFilterMatches(filterId, { remove: true });

        // Show success toast that persists across navigation
        toast.success(
          `Filter "${filterData.name || filter?.name}" updated successfully!`,
          {
            title: 'Filter Updated',
            duration: 4000,
          }
        );

        // Navigate with success message
        navigate('/filters');
        return;
      } else {
        setError(
          response.error || 'Failed to update filter. Please try again.'
        );
        toast.error(
          response.error || 'Failed to update filter. Please try again.',
          {
            title: 'Update Failed',
          }
        );
        setIsSubmitting(false);
      }
    } catch (err) {
      console.error('Error updating filter:', err);
      const errorMessage =
        'Failed to update filter. Please check your connection and try again.';
      setError(errorMessage);
      toast.error(errorMessage, {
        title: 'Network Error',
      });
      setIsSubmitting(false);
    }
  };

  // Show full-page loading for auth scenarios only
  if (authLoading || (!authLoading && !user)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <DealsRadarLoader
          message={authLoading ? 'Loading...' : 'Session expired'}
          subtext={
            authLoading ? 'Checking authentication' : 'Redirecting to login...'
          }
          size="md"
        />
      </div>
    );
  }

  // Show error if filter not found or failed to load
  if (error && !isSubmitting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 text-red-500">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.996-.833-2.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Error Loading Filter
          </h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => navigate('/filters')}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Back to Filters
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleNavigate = (path: string) => {
    navigate(path);
  };



  const userProfile = user
    ? {
        name: `${user.firstName || 'User'} ${user.lastName || ''}`.trim(),
        email: user.email,
        initials:
          `${(user.firstName || 'U').charAt(0)}${(user.lastName || 'U').charAt(0)}`.toUpperCase(),
      }
    : undefined;

  return (
    <AppLayout
      currentPath={pathname}
      userProfile={userProfile}
      onNavigate={handleNavigate}
    >
      {/* Page Header */}
      <PageHeader
        title={`Edit Filter: ${filter?.name || 'Loading...'}`}
        description="Update your filter criteria and settings."
        actions={
          <div className="flex gap-2">
            <button
              onClick={() => navigate(`/filters/${filterId}`)}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              {...dataCy('cancel-edit-button')}
            >
              Cancel
            </button>
          </div>
        }
      />

      {/* Show content-area loading for data loading */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="flex items-center space-x-2">
            <LoadingSpinner size="medium" variant="primary" />
            <span className="text-gray-600">Loading filter...</span>
          </div>
        </div>
      ) : (
        /* Filter Form - Pre-populated with existing data */
        initialData && (
          <div {...dataCy('filter-form')}>
            <CreateFilterForm
              onUpdate={handleUpdate}
              initialData={initialData}
              filterId={filterId}
              isEditMode={true}
              loading={isSubmitting}
              error={error}
            />
          </div>
        )
      )}
    </AppLayout>
  );
}
