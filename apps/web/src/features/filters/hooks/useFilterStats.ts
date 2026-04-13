/**
 * useFilterStats - Custom hook for async filter statistics loading
 * Provides intelligent caching, error handling, and loading states
 */
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/shared/lib/api';
import type { FilterStats } from '@/features/filters/types/filter.types';

export interface UseFilterStatsOptions {
  /** Whether to automatically fetch stats */
  enabled?: boolean;
  /** Stale time in milliseconds (default: 2 minutes) */
  staleTime?: number;
  /** Cache time in milliseconds (default: 5 minutes) */
  cacheTime?: number;
  /** Whether to refetch on window focus */
  refetchOnWindowFocus?: boolean;
  /** Refetch interval in milliseconds */
  refetchInterval?: number;
}

export interface UseFilterStatsReturn {
  /** Filter statistics data */
  stats: FilterStats | undefined;
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  isError: boolean;
  /** Error object */
  error: Error | null;
  /** Whether data is currently being fetched */
  isFetching: boolean;
  /** Whether the query is stale */
  isStale: boolean;
  /** Function to manually refetch stats */
  refetch: () => Promise<any>;
}

/**
 * Hook to fetch and manage filter statistics
 *
 * @param filterId - The ID of the filter to fetch stats for
 * @param options - Configuration options
 * @returns Filter stats query state and data
 */
export const useFilterStats = (
  filterId: string,
  options: UseFilterStatsOptions = {}
): UseFilterStatsReturn => {
  const {
    enabled = true,
    staleTime = 2 * 60 * 1000, // 2 minutes
    cacheTime = 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus = false,
    refetchInterval,
  } = options;

  const query = useQuery({
    queryKey: ['filterStats', filterId],
    queryFn: async () => {
      const response = await apiClient.getFilterStats(filterId);

      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch filter stats');
      }

      return response.data;
    },
    enabled: enabled && !!filterId,
    staleTime,
    gcTime: cacheTime,
    refetchOnWindowFocus,
    refetchInterval,
    retry: (failureCount, error) => {
      // Don't retry on authentication errors
      if (
        error?.message?.includes('401') ||
        error?.message?.includes('Unauthorized')
      ) {
        return false;
      }
      // Retry up to 2 times for other errors
      return failureCount < 2;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });

  return {
    stats: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    isFetching: query.isFetching,
    isStale: query.isStale,
    refetch: query.refetch,
  };
};

/**
 * Hook to prefetch filter stats (useful for hover effects or predictive loading)
 */
export const usePrefetchFilterStats = () => {
  return (_filterId: string) => {
    // Note: We would need access to the QueryClient instance to implement prefetching
    // This is a placeholder for future implementation
  };
};

export default useFilterStats;
