/**
 * @fileoverview Standard API response interfaces used across all services
 * Provides consistent response structures for better API design
 */

/**
 * Standard API response interface used across all services
 * Provides consistent structure for all API endpoints
 * @template T Type of the response data
 */
export interface StandardApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

/**
 * Paginated response interface for list endpoints
 * Extends StandardApiResponse with pagination metadata
 * @template T Type of the array items
 */
export interface PaginatedResponse<T> extends StandardApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Creates a successful response
 * Utility function for consistent success responses
 * @param data Response data
 * @param message Optional success message
 * @returns Standardized success response
 */
export function createSuccessResponse<T>(
  data: T,
  message?: string
): StandardApiResponse<T> {
  return { success: true, data, message };
}

/**
 * Creates an error response
 * Utility function for consistent error responses
 * @param message Error message
 * @param error Optional error details
 * @returns Standardized error response
 */
export function createErrorResponse(
  message: string,
  error?: string
): StandardApiResponse<never> {
  return { success: false, message, error };
}
