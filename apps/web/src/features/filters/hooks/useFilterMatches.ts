/**
 * useFilterMatches Hook - TanStack Query hook for fetching filter matches
 * Provides smart caching, background refetching, and optimized query management
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { apiClient, type BackendMatchListResponseDto } from '@/shared/lib/api';
import { SiteSource } from '@dealscrapper/shared-types';
import type {
  ArticleWithMatch,
  ArticleListResponse,
  ArticleQuery,
  ArticleSortField,
} from '@/shared/types/article';

export interface UseFilterMatchesParams {
  filterId: string;
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: ArticleSortField;
  sortOrder?: 'asc' | 'desc';
  enabled?: boolean;
}

export interface UseFilterMatchesResult {
  // Data
  data: ArticleListResponse | undefined;
  matches: ArticleWithMatch[];

  // States
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  error: Error | null;

  // Pagination info
  totalItems: number;
  currentPage: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;

  // Actions
  refetch: () => void;
  prefetchNextPage: () => void;
  prefetchPreviousPage: () => void;

  // Query key for cache invalidation
  queryKey: string[];
}

/**
 * Transform backend match response to frontend article format
 */
const transformMatchesToArticles = (
  backendData: BackendMatchListResponseDto
): ArticleListResponse => {
  return {
    articles: backendData.matches.map((match): ArticleWithMatch => {
      const article = match.article;
      return {
        // Basic article fields
        id: article.id,
        externalId: article.id,
        title: article.title,
        description: '',
        model: '',
        category: article.category,
        categoryPath: [article.category],
        currentPrice: article.currentPrice,
        originalPrice: article.originalPrice || article.currentPrice,
        discountPercentage:
          article.originalPrice && article.originalPrice > article.currentPrice
            ? Math.round(
                ((article.originalPrice - article.currentPrice) /
                  article.originalPrice) *
                  100
              )
            : 0,
        discountAmount:
          article.originalPrice && article.originalPrice > article.currentPrice
            ? article.originalPrice - article.currentPrice
            : 0,
        merchant: article.merchant,
        storeLocation: '',
        freeShipping: false,
        geographicRestrictions: [],
        membershipRequired: false,
        temperature: article.temperature,
        commentCount: 0,
        communityVerified: false,
        publishedAt: article.publishedAt
          ? new Date(article.publishedAt)
          : new Date(article.scrapedAt),
        expiresAt: article.expiresAt ? new Date(article.expiresAt) : undefined,
        url: article.url,
        imageUrl: article.imageUrl,
        isExpired: article.expiresAt
          ? new Date(article.expiresAt) < new Date()
          : false,
        isCoupon: false,
        siteId: article.siteId || SiteSource.DEALABS,
        isActive: true,

        // Computed fields
        age: Math.floor(
          (Date.now() - new Date(article.scrapedAt).getTime()) /
            (1000 * 60 * 60)
        ),
        heat: article.temperature,
        price: article.currentPrice,
        createdAt: new Date(article.scrapedAt),
        updatedAt: new Date(article.scrapedAt),

        // Match-specific fields
        matchScore: match.score || 0,
        matchedRules: [],
        matchedAt: new Date(match.createdAt),
      };
    }),
    total: backendData.total,
    page: backendData.page,
    limit: backendData.limit,
    totalPages: backendData.totalPages,
    hasNext: backendData.page < backendData.totalPages,
    hasPrev: backendData.page > 1,
  };
};

/**
 * Generate consistent query key for caching
 */
const createQueryKey = (params: UseFilterMatchesParams): string[] => {
  const { filterId, page = 1, limit = 10, search, sortBy, sortOrder } = params;

  return [
    'filter-matches',
    filterId,
    {
      page,
      limit,
      search: search || '',
      sortBy: sortBy || 'score',
      sortOrder: sortOrder || 'desc',
    },
  ].filter(Boolean) as string[];
};

/**
 * useFilterMatches Hook
 *
 * Provides TanStack Query-powered data fetching for filter matches with:
 * - Smart caching based on filterId + query params
 * - Background refetching for fresh data
 * - Optimistic pagination with prefetching
 * - Automatic error handling and retries
 * - Request deduplication
 */
export const useFilterMatches = (
  params: UseFilterMatchesParams
): UseFilterMatchesResult => {
  const {
    filterId,
    page = 1,
    limit = 10,
    search,
    sortBy = 'score',
    sortOrder = 'desc',
    enabled = true,
  } = params;

  const queryClient = useQueryClient();

  // Generate query key for this specific request
  const queryKey = useMemo(() => createQueryKey(params), [params]);

  // Main query for fetching filter matches
  const query = useQuery({
    queryKey,
    queryFn: async (): Promise<ArticleListResponse> => {
      const response = await apiClient.getFilterMatches(
        filterId,
        page,
        limit,
        search,
        sortBy,
        sortOrder
      );

      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch filter matches');
      }

      if (!response.data) {
        // Return empty result instead of throwing
        return {
          articles: [],
          total: 0,
          page: 1,
          limit: 10,
          totalPages: 0,
          hasNext: false,
          hasPrev: false,
        };
      }

      return transformMatchesToArticles(response.data);
    },
    enabled: enabled && !!filterId,
    staleTime: 2 * 60 * 1000, // 2 minutes - matches are relatively dynamic
    gcTime: 5 * 60 * 1000, // 5 minutes in cache
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
  });

  // Prefetch next page for better UX
  const prefetchNextPage = useCallback(() => {
    if (!query.data?.hasNext) return;

    const nextPageKey = createQueryKey({
      ...params,
      page: page + 1,
    });

    queryClient.prefetchQuery({
      queryKey: nextPageKey,
      queryFn: async () => {
        const response = await apiClient.getFilterMatches(
          filterId,
          page + 1,
          limit,
          search,
          sortBy,
          sortOrder
        );

        if (!response.success || !response.data) {
          throw new Error(response.error || 'Failed to prefetch next page');
        }

        return transformMatchesToArticles(response.data);
      },
      staleTime: 2 * 60 * 1000,
    });
  }, [
    queryClient,
    params,
    page,
    filterId,
    limit,
    search,
    sortBy,
    sortOrder,
    query.data?.hasNext,
  ]);

  // Prefetch previous page
  const prefetchPreviousPage = useCallback(() => {
    if (!query.data?.hasPrev || page <= 1) return;

    const prevPageKey = createQueryKey({
      ...params,
      page: page - 1,
    });

    queryClient.prefetchQuery({
      queryKey: prevPageKey,
      queryFn: async () => {
        const response = await apiClient.getFilterMatches(
          filterId,
          page - 1,
          limit,
          search,
          sortBy,
          sortOrder
        );

        if (!response.success || !response.data) {
          throw new Error(response.error || 'Failed to prefetch previous page');
        }

        return transformMatchesToArticles(response.data);
      },
      staleTime: 2 * 60 * 1000,
    });
  }, [
    queryClient,
    params,
    page,
    filterId,
    limit,
    search,
    sortBy,
    sortOrder,
    query.data?.hasPrev,
  ]);

  // Client-side sorting for temperature (site-specific field not sortable server-side)
  const sortedMatches = useMemo(() => {
    const articles = query.data?.articles || [];
    if (sortBy === 'temperature' && articles.length > 0) {
      return [...articles].sort((a, b) => {
        const aTemp = a.temperature ?? 0;
        const bTemp = b.temperature ?? 0;
        return sortOrder === 'asc' ? aTemp - bTemp : bTemp - aTemp;
      });
    }
    return articles;
  }, [query.data?.articles, sortBy, sortOrder]);

  return {
    // Data
    data: query.data,
    matches: sortedMatches,

    // States
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,

    // Pagination info
    totalItems: query.data?.total || 0,
    currentPage: query.data?.page || page,
    totalPages: query.data?.totalPages || 0,
    hasNext: query.data?.hasNext || false,
    hasPrev: query.data?.hasPrev || false,

    // Actions
    refetch: query.refetch,
    prefetchNextPage,
    prefetchPreviousPage,

    // Query key for external cache invalidation
    queryKey,
  };
};

/**
 * Utility hook for invalidating or removing filter matches cache
 * @param options.remove - If true, removes cache entirely (user sees loading state).
 *                         If false/undefined, invalidates cache (shows stale data while refetching).
 */
export const useInvalidateFilterMatches = () => {
  const queryClient = useQueryClient();

  return useCallback(
    (filterId?: string, options?: { remove?: boolean }) => {
      const queryKey = filterId
        ? ['filter-matches', filterId]
        : ['filter-matches'];

      if (options?.remove) {
        // Remove cache entirely - next visit shows loading state, no stale data
        queryClient.removeQueries({ queryKey });
      } else {
        // Invalidate - marks as stale, shows old data while refetching
        queryClient.invalidateQueries({ queryKey });
      }
    },
    [queryClient]
  );
};

/**
 * Utility hook for prefetching filter matches
 */
export const usePrefetchFilterMatches = () => {
  const queryClient = useQueryClient();

  return useCallback(
    (params: UseFilterMatchesParams) => {
      const queryKey = createQueryKey(params);

      queryClient.prefetchQuery({
        queryKey,
        queryFn: async () => {
          const response = await apiClient.getFilterMatches(
            params.filterId,
            params.page || 1,
            params.limit || 10,
            params.search,
            params.sortBy,
            params.sortOrder
          );

          if (!response.success || !response.data) {
            throw new Error(
              response.error || 'Failed to prefetch filter matches'
            );
          }

          return transformMatchesToArticles(response.data);
        },
        staleTime: 2 * 60 * 1000,
      });
    },
    [queryClient]
  );
};

export default useFilterMatches;
