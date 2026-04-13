/**
 * Utility functions for pagination calculations
 */

/**
 * Calculate the offset for pagination based on page number and limit
 * @param page - The current page number (1-indexed)
 * @param limit - The number of items per page
 * @returns The offset value for database queries
 * @example
 * calculatePaginationOffset(1, 20) // Returns 0
 * calculatePaginationOffset(2, 20) // Returns 20
 * calculatePaginationOffset(3, 10) // Returns 20
 */
export function calculatePaginationOffset(page: number, limit: number): number {
  return (page - 1) * limit;
}

/**
 * Calculate the total number of pages based on total items and limit
 * @param total - Total number of items
 * @param limit - Number of items per page
 * @returns Total number of pages
 */
export function calculateTotalPages(total: number, limit: number): number {
  return Math.ceil(total / limit);
}
