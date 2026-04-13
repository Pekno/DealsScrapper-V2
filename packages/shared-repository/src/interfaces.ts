/**
 * Repository error interface for consistent error handling
 */
export interface RepositoryError {
  operation: string;
  originalError: string;
  context?: Record<string, unknown>;
  timestamp: string;
}

/**
 * Pagination options for repository queries
 */
export interface PaginationOptions {
  page?: number;
  limit?: number;
  offset?: number;
}

/**
 * Paginated result structure
 */
export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

/**
 * Common repository methods for health checks
 */
export interface RepositoryHealthCheck {
  /**
   * Check if the repository connection is healthy
   * @returns True if connection is healthy
   */
  healthCheck(): Promise<boolean>;
}
