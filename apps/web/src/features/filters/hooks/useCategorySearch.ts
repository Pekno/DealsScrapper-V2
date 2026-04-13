/**
 * useCategorySearch - Custom hook for debounced category search
 * Handles API calls, loading states, and request cancellation
 */
import { useState, useEffect, useRef } from 'react';
import { apiClient } from '@/shared/lib/api';
import { getRuntimeConfig } from '@/shared/lib/runtime-config';
import type { Category } from '@/features/filters/types/filter.types';

interface UseCategorySearchResult {
  data: Category[];
  loading: boolean;
  error: string | null;
}

/**
 * Custom hook for searching categories with debouncing and cancellation.
 * Categories are filtered by the selected site IDs.
 *
 * @param query - The search query string
 * @param siteIds - Optional array of site IDs to filter categories by (e.g., ['dealabs', 'vinted'])
 * @returns Object containing search results, loading state, and error
 *
 * @example
 * ```tsx
 * const { data, loading, error } = useCategorySearch(searchQuery, ['dealabs']);
 * ```
 */
export function useCategorySearch(
  query: string,
  siteIds?: string[]
): UseCategorySearchResult {
  const [data, setData] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Stringify siteIds for dependency comparison
  const siteIdsKey = siteIds?.sort().join(',') ?? '';

  useEffect(() => {
    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Don't search for empty queries or queries shorter than 3 characters
    if (!query.trim() || query.trim().length < 3) {
      setData([]);
      setLoading(false);
      setError(null);
      return;
    }

    // Don't search if no siteIds are selected
    if (!siteIds || siteIds.length === 0) {
      setData([]);
      setLoading(false);
      setError(null);
      return;
    }

    const searchCategories = async () => {
      abortControllerRef.current = new AbortController();
      setLoading(true);
      setError(null);

      try {
        const API_BASE_URL = getRuntimeConfig().API_URL;
        const siteIdParam = siteIds.join(',');
        const url = `${API_BASE_URL}/categories?find=${encodeURIComponent(query.trim())}&siteId=${encodeURIComponent(siteIdParam)}`;
        const token = apiClient.getToken();

        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          signal: abortControllerRef.current.signal,
        });

        if (!abortControllerRef.current.signal.aborted) {
          const responseData = await response.json();

          if (response.ok && responseData.success && responseData.data) {
            setData(responseData.data);
          } else {
            setError(
              responseData.error ||
                responseData.message ||
                'Failed to search categories'
            );
            setData([]);
          }
        }
      } catch (error: unknown) {
        // Don't show error if request was aborted (normal behavior)
        const isAbortError = error instanceof Error && error.name === 'AbortError';
        if (
          !isAbortError &&
          !abortControllerRef.current?.signal.aborted
        ) {
          setError('Failed to search categories');
          setData([]);
        }
      } finally {
        if (!abortControllerRef.current?.signal.aborted) {
          setLoading(false);
        }
      }
    };

    // Debounce search by 300ms
    const timeoutId = setTimeout(() => {
      searchCategories();
    }, 300);

    return () => {
      clearTimeout(timeoutId);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [query, siteIdsKey]);

  return { data, loading, error };
}
