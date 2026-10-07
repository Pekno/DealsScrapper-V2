/**
 * useSiteRegistry - Hook for fetching available sites with brand colors
 * Provides site metadata for multi-site filter UI components
 * Fetches site data from API with caching support
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect } from 'react';
import { SiteSource } from '@dealscrapper/shared-types';
import { apiClient } from '@/shared/lib/api';

/**
 * Site information returned from the API
 */
export interface SiteInfo {
  id: SiteSource;
  name: string;
  color: string;
  displayName: string;
  isActive: boolean;
  iconUrl?: string | null;
}

/**
 * API response type for sites endpoint
 */
interface SiteApiResponse {
  id: string;
  name: string;
  color: string;
  isActive: boolean;
  iconUrl?: string | null;
}

/**
 * Query key for sites data
 */
const SITES_QUERY_KEY = ['sites'] as const;

/**
 * Transform API response to SiteInfo format
 */
function transformApiResponse(apiSites: SiteApiResponse[]): SiteInfo[] {
  return apiSites.map((site) => ({
    id: site.id as SiteSource,
    name: site.id, // Use id as name for consistency
    displayName: site.name,
    color: site.color,
    isActive: site.isActive,
    iconUrl: site.iconUrl,
  }));
}

/**
 * Fetch sites from API.
 *
 * GET /sites returns `{ sites: [...] }` (not a bare array), so the list lives
 * under the `sites` key. Previously this passed the whole object to
 * transformApiResponse(), which called `.map()` on it and threw — the query
 * always errored and the UI silently fell back to a hardcoded 3-site list.
 */
async function fetchSites(): Promise<SiteInfo[]> {
  const response = await apiClient.get<{ sites: SiteApiResponse[] }>('/sites');

  if (!response.success || !response.data?.sites) {
    throw new Error(response.error || 'Failed to fetch sites');
  }

  return transformApiResponse(response.data.sites);
}

/**
 * Hook to get available sites with metadata
 * Fetches from GET /api/sites with caching
 *
 * @returns Object with sites array and helper functions
 */
export function useSiteRegistry() {
  const queryClient = useQueryClient();

  const {
    data: sites = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: SITES_QUERY_KEY,
    queryFn: fetchSites,
    // Sites come solely from GET /api/sites (the SiteSyncService source of truth).
    // No hardcoded fallback — a hardcoded list silently goes stale every time a
    // site is added. staleTime shortened so a newly-synced site shows promptly.
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 60 * 24, // 24 hours cache time
    refetchOnWindowFocus: true,
    retry: 2,
  });

  // Filter to only active sites
  const activeSites = sites.filter((site) => site.isActive);

  /**
   * Get site by ID (SiteSource enum value)
   */
  const getSiteById = useCallback(
    (id: SiteSource): SiteInfo | undefined => {
      return sites.find((site) => site.id === id);
    },
    [sites]
  );

  /**
   * Get site by name string
   */
  const getSiteByName = useCallback(
    (name: string): SiteInfo | undefined => {
      return sites.find(
        (site) => site.name === name || site.id === name || site.displayName === name
      );
    },
    [sites]
  );

  /**
   * Get site color by ID or name
   */
  const getSiteColor = useCallback(
    (siteIdOrName: string): string => {
      const site = getSiteByName(siteIdOrName);
      return site?.color || '#9CA3AF'; // Default gray
    },
    [getSiteByName]
  );

  /**
   * Invalidate sites cache - call on login/logout
   */
  const invalidateCache = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: SITES_QUERY_KEY });
  }, [queryClient]);

  /**
   * Listen for auth events to invalidate cache
   */
  useEffect(() => {
    // Listen for custom auth events to invalidate cache
    const handleAuthChange = (): void => {
      invalidateCache();
    };

    window.addEventListener('auth:login', handleAuthChange);
    window.addEventListener('auth:logout', handleAuthChange);

    return () => {
      window.removeEventListener('auth:login', handleAuthChange);
      window.removeEventListener('auth:logout', handleAuthChange);
    };
  }, [invalidateCache]);

  return {
    sites,
    activeSites,
    isLoading,
    error: error instanceof Error ? error.message : null,
    getSiteById,
    getSiteByName,
    getSiteColor,
    invalidateCache,
    refetch,
  };
}
