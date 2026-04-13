/**
 * Business-focused scheduled job factories for scheduler e2e tests
 * Creates realistic scraping job schedules with real execution patterns
 */

import { ScheduledJob } from '@dealscrapper/database';

/**
 * Creates a high-priority scheduled job for popular categories
 * Represents frequently executed jobs with good success rates
 */
export const createHighPriorityJob = (
  categoryId: string,
  overrides: Partial<ScheduledJob> = {}
): Omit<ScheduledJob, 'id' | 'createdAt' | 'updatedAt'> => ({
  categoryId,
  isActive: true,
  filterCount: 25, // Many users monitoring this category
  nextScheduledAt: new Date(Date.now() + 15 * 60 * 1000), // Next run in 15 minutes
  totalExecutions: 150,
  successfulRuns: 142, // 94.7% success rate
  lastExecutionAt: new Date(Date.now() - 10 * 60 * 1000), // Last run 10 minutes ago
  lastSuccessAt: new Date(Date.now() - 10 * 60 * 1000),
  avgExecutionTimeMs: 4500, // 4.5 second average
  maxRetries: 3,
  timeoutMs: 30000, // 30 second timeout
  optimizedQuery: 'sort=recent&price_max=1000&temp_min=50', // Optimized for deals
  optimizationUpdatedAt: null,
  ...overrides,
});

/**
 * Creates a standard scheduled job for moderate engagement categories
 */
export const createStandardJob = (
  categoryId: string,
  overrides: Partial<ScheduledJob> = {}
): Omit<ScheduledJob, 'id' | 'createdAt' | 'updatedAt'> => ({
  categoryId,
  isActive: true,
  filterCount: 8, // Moderate user interest
  nextScheduledAt: new Date(Date.now() + 45 * 60 * 1000), // Next run in 45 minutes
  totalExecutions: 48,
  successfulRuns: 45, // 93.75% success rate
  lastExecutionAt: new Date(Date.now() - 30 * 60 * 1000), // Last run 30 minutes ago
  lastSuccessAt: new Date(Date.now() - 30 * 60 * 1000),
  avgExecutionTimeMs: 6200, // 6.2 second average
  maxRetries: 3,
  timeoutMs: 30000,
  optimizedQuery: 'sort=hot&temp_min=60', // Basic optimization
  optimizationUpdatedAt: null,
  ...overrides,
});

/**
 * Creates a low-priority scheduled job for niche categories
 */
export const createLowPriorityJob = (
  categoryId: string,
  overrides: Partial<ScheduledJob> = {}
): Omit<ScheduledJob, 'id' | 'createdAt' | 'updatedAt'> => ({
  categoryId,
  isActive: true,
  filterCount: 2, // Low user interest
  nextScheduledAt: new Date(Date.now() + 3 * 60 * 60 * 1000), // Next run in 3 hours
  totalExecutions: 12,
  successfulRuns: 11, // 91.7% success rate
  lastExecutionAt: new Date(Date.now() - 4 * 60 * 60 * 1000), // Last run 4 hours ago
  lastSuccessAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
  avgExecutionTimeMs: 8500, // 8.5 second average
  maxRetries: 3,
  timeoutMs: 30000,
  optimizedQuery: 'sort=recent', // Minimal optimization
  optimizationUpdatedAt: null,
  ...overrides,
});

/**
 * Creates an inactive scheduled job for testing cleanup workflows
 */
export const createInactiveJob = (
  categoryId: string,
  overrides: Partial<ScheduledJob> = {}
): Omit<ScheduledJob, 'id' | 'createdAt' | 'updatedAt'> => ({
  categoryId,
  isActive: false, // Inactive job
  filterCount: 0, // No active filters
  nextScheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Far future
  totalExecutions: 5,
  successfulRuns: 3,
  lastExecutionAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last run 7 days ago
  lastSuccessAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
  avgExecutionTimeMs: 12000, // Slow execution
  maxRetries: 3,
  timeoutMs: 30000,
  optimizedQuery: null, // No optimization
  optimizationUpdatedAt: null,
  ...overrides,
});

/**
 * Creates a job ready for execution (due now)
 */
export const createJobDueForExecution = (
  categoryId: string,
  overrides: Partial<ScheduledJob> = {}
): Omit<ScheduledJob, 'id' | 'createdAt' | 'updatedAt'> => ({
  categoryId,
  isActive: true,
  filterCount: 12,
  nextScheduledAt: new Date(Date.now() - 2 * 60 * 1000), // Due 2 minutes ago
  totalExecutions: 24,
  successfulRuns: 23,
  lastExecutionAt: new Date(Date.now() - 32 * 60 * 1000), // Last run 32 minutes ago
  lastSuccessAt: new Date(Date.now() - 32 * 60 * 1000),
  avgExecutionTimeMs: 5200,
  maxRetries: 3,
  timeoutMs: 30000,
  optimizedQuery: 'sort=hot&price_max=500',
  optimizationUpdatedAt: null,
  ...overrides,
});
