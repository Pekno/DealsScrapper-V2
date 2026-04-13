/**
 * Create Filter Page - Complete filter creation form with all sections
 */
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import AppLayout from '@/shared/layout/AppLayout';
import CreateFilterForm from '@/features/filters/components/CreateFilterForm';
import { PageHeader } from '@/shared/ui/PageHeader';
import { CreateFilterRequest } from '@/features/filters/types/filter.types';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { apiClient } from '@/shared/lib/api';
import { useToast } from '@/shared/lib/toast-context';
import DealsRadarLoader from '@/shared/ui/DealsRadarLoader';
import { Button } from '@/shared/ui/Button';
import { dataCy } from '@/shared/lib/test-utils';

export default function CreateFilterPage() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login', { replace: true });
    }
  }, [user, authLoading, navigate]);

  const handleSubmit = async (filterData: CreateFilterRequest) => {
    setIsSubmitting(true);
    setError(undefined);

    try {
      const response = await apiClient.createFilter(filterData);

      if (response.success && response.data) {
        // Show success toast that persists across navigation
        toast.success(`Filter "${filterData.name}" created successfully!`, {
          title: 'Filter Created',
          duration: 4000,
        });

        // Navigate to filters page
        navigate('/filters');
        return;
      } else {
        setError(
          response.error || 'Failed to create filter. Please try again.'
        );
        toast.error(
          response.error || 'Failed to create filter. Please try again.',
          {
            title: 'Creation Failed',
          }
        );
        setIsSubmitting(false);
      }
    } catch (err) {
      console.error('Error creating filter:', err);
      const errorMessage =
        'Failed to create filter. Please check your connection and try again.';
      setError(errorMessage);
      toast.error(errorMessage, {
        title: 'Network Error',
      });
      setIsSubmitting(false);
    }
  };

  // Wait for auth to complete before rendering the form.
  if (authLoading || !user) {
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
        title="Create New Filter"
        description="Set up your criteria to find the perfect deals."
        actions={
          <Button
            variant="outline"
            size="md"
            onClick={() => navigate('/filters')}
          >
            Cancel
          </Button>
        }
      />

      {/* Filter Form - Categories are now loaded on-demand */}
      <div {...dataCy('filter-form')}>
        <CreateFilterForm
          onSubmit={handleSubmit}
          isEditMode={false}
          loading={isSubmitting}
          error={error}
        />
      </div>
    </AppLayout>
  );
}
