/**
 * Shared repository patterns and interfaces for consistent data access across services
 */

export type { BaseRepository } from './base.repository.js';
export { AbstractBaseRepository } from './base.repository.js';

// Category repository base and types
export type {
  IBaseCategoryRepository,
  CategoryStatistics,
} from './category/base-category.repository.js';
export { BaseCategoryRepository } from './category/base-category.repository.js';

// Filter repository base and types
export type {
  IBaseFilterRepository,
  FilterStatistics,
  FilterSearchCriteria,
} from './filter/base-filter.repository.js';
export { BaseFilterRepository } from './filter/base-filter.repository.js';

export type {
  RepositoryError,
  PaginationOptions,
  PaginatedResult,
  RepositoryHealthCheck,
} from './interfaces.js';

// Pagination utilities
export {
  calculatePaginationOffset,
  calculateTotalPages,
} from './utils/pagination.utils.js';
