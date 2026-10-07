/**
 * useSuggestions Hook - TanStack Query hook for cross-site product suggestions
 * Lazily fetches "also found on" matches for an article when its table row is expanded.
 */
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/shared/lib/api';
import type { ProductSuggestion } from '@dealscrapper/shared-types';

export interface UseSuggestionsResult {
  suggestions: ProductSuggestion[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
}

/**
 * Fetch cross-site product suggestions for a given article.
 *
 * @param articleId - Article CUID to find similar listings for
 * @param enabled - Only fetches when true (e.g. when the row is expanded)
 */
export const useSuggestions = (
  articleId: string,
  enabled: boolean
): UseSuggestionsResult => {
  const query = useQuery({
    queryKey: ['suggestions', articleId],
    queryFn: async (): Promise<ProductSuggestion[]> => {
      const response = await apiClient.getProductSuggestions(articleId);

      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch suggestions');
      }

      return response.data ?? [];
    },
    enabled: enabled && !!articleId,
    // Backend caches similar results for 10 minutes — match that to avoid redundant fetches.
    staleTime: 10 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 2,
  });

  return {
    suggestions: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
  };
};

export default useSuggestions;
