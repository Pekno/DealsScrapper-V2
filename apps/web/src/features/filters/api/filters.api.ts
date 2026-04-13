/**
 * Filters API Module
 * Handles all filter-related API calls
 */

import { apiClient } from '@/shared/lib/api';
import type {
  Filter,
  FilterWithMetrics,
  FilterListResponse,
  CreateFilterRequest,
  UpdateFilterRequest,
  FilterStats,
} from '../types/filter.types';

/**
 * Filters API interface
 */
export const filtersApi = {
  /**
   * Get all filters with optional query parameters
   */
  getFilters: (query?: {
    page?: number;
    limit?: number;
    search?: string;
    active?: boolean;
    sortBy?: string;
    order?: 'asc' | 'desc';
  }) => apiClient.getFilters(query),

  /**
   * Get a single filter by ID
   */
  getFilter: (id: string) => apiClient.getFilter(id),

  /**
   * Create a new filter
   */
  createFilter: (data: CreateFilterRequest) => apiClient.createFilter(data),

  /**
   * Update an existing filter
   */
  updateFilter: (id: string, data: UpdateFilterRequest) =>
    apiClient.updateFilter(id, data),

  /**
   * Delete a filter
   */
  deleteFilter: (id: string) => apiClient.deleteFilter(id),

  /**
   * Toggle filter active status
   */
  toggleFilterActive: (id: string) => apiClient.toggleFilterActive(id),

  /**
   * Get matches for a specific filter
   */
  getFilterMatches: (
    id: string,
    page?: number,
    limit?: number,
    search?: string,
    sortBy?: string,
    sortOrder?: 'asc' | 'desc'
  ) => apiClient.getFilterMatches(id, page, limit, search, sortBy, sortOrder),

  /**
   * Get filter statistics
   */
  getFilterStats: (id: string) => apiClient.getFilterStats(id),
};
