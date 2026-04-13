/**
 * Database entity types - only extend Prisma models when adding computed fields or relations
 *
 * USAGE GUIDELINES:
 * - For most use cases, import generated types directly from '@dealscrapper/database'
 * - Use Prisma's built-in relation types: Prisma.CategorySelect, Prisma.CategoryInclude
 * - Use Prisma.FilterGetPayload<{ include: { categories: true } }> for relations
 * - Only extend types here when adding computed/business fields
 */
import type {
  Category,
  Filter,
  User,
  Article,
  Match,
  Notification,
  ScheduledJob,
  ScrapingJob,
  FilterCategory,
  UserSession,
} from '@prisma/client';

// Re-export standard Prisma types directly (use these in application code)
export type {
  Category,
  Filter,
  User,
  Article,
  Match,
  Notification,
  ScheduledJob,
  ScrapingJob,
  FilterCategory,
  UserSession,
};

// Only extend Prisma types when you actually need computed fields or specific relations
// For most cases, use Prisma's built-in relation types like:
// - Prisma.CategorySelect, Prisma.CategoryInclude
// - Prisma.FilterGetPayload<{ include: { categories: true } }>

/**
 * Extended category with computed monitoring statistics
 * Only use this when you need the computed fields - for basic category data, use Category directly
 */
export interface CategoryWithStats extends Category {
  /** Whether this category should be actively monitored based on user activity and status */
  readonly shouldMonitor: boolean; // userCount > 0 && isActive
  /** Priority level for monitoring based on activity metrics */
  readonly priorityLevel: 'high' | 'normal' | 'low';
}
