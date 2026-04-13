/**
 * Polling Utilities for Smart Scraping Status Polling
 *
 * Provides utility functions for calculating polling states, execution time estimates,
 * and managing the smart polling state machine transitions.
 */

import type {
  PollingMode,
  PollingState,
  FilterScrapingStatus,
  CategoryScrapingStatus,
} from '@/features/filters/types/filter.types';

/**
 * Calculate the execution time estimate for a filter based on latest execution data
 * Uses only the most recent execution data with a buffer, no historical storage
 */
export const getExecutionTimeEstimate = (
  categories: CategoryScrapingStatus[]
): number => {
  const executionTimes = categories
    .filter((cat) => cat.latestExecution?.executionTimeMs)
    .map((cat) => cat.latestExecution!.executionTimeMs);

  if (executionTimes.length === 0) {
    return 60000; // Default to 60 seconds if no data
  }

  const maxLatestExecution = Math.max(...executionTimes);
  // Apply 1.5x buffer, minimum 30 seconds
  return Math.max(maxLatestExecution * 1.5, 30000);
};

/**
 * Determine the appropriate polling mode based on job scheduling and execution estimates
 */
export const calculatePollingMode = (
  scrapingData: FilterScrapingStatus | null,
  currentMode: PollingMode,
  lastModeChange: Date
): PollingMode => {
  if (!scrapingData || !scrapingData.nextScrapingAt) {
    return 'idle';
  }

  const now = new Date();
  const nextScrapingAt = new Date(scrapingData.nextScrapingAt);
  const timeUntilNext = nextScrapingAt.getTime() - now.getTime();
  const executionEstimate = getExecutionTimeEstimate(scrapingData.categories);

  // State transition logic
  if (timeUntilNext > 2 * 60 * 1000) {
    // More than 2 minutes until next job → IDLE
    return 'idle';
  } else if (timeUntilNext > 0) {
    // Jobs starting within 2 minutes → SCHEDULED
    return 'scheduled';
  } else if (Math.abs(timeUntilNext) <= executionEstimate) {
    // Jobs should be running now (within execution estimate) → ACTIVE
    return 'active';
  } else if (Math.abs(timeUntilNext) <= executionEstimate + 2 * 60 * 1000) {
    // Jobs recently finished, poll for 2 minutes → COOLDOWN
    return 'cooldown';
  } else {
    // Long overdue, assume failed → IDLE
    return 'idle';
  }
};

/**
 * Get the polling interval in milliseconds for the current mode
 */
export const getPollingInterval = (mode: PollingMode): number => {
  switch (mode) {
    case 'idle':
      return 5 * 60 * 1000; // 5 minutes
    case 'scheduled':
      return 30 * 1000; // 30 seconds
    case 'active':
      return 5 * 1000; // 5 seconds
    case 'cooldown':
      return 15 * 1000; // 15 seconds
    default:
      return 60 * 1000; // Fallback to 60 seconds
  }
};

/**
 * Calculate time until next poll based on current state
 */
export const getTimeUntilNextPoll = (
  mode: PollingMode,
  lastPoll: Date
): number => {
  const interval = getPollingInterval(mode);
  const elapsed = Date.now() - lastPoll.getTime();
  return Math.max(0, interval - elapsed);
};

/**
 * Format time until next event for display
 */
export const formatTimeUntilNext = (nextDate: Date | null): string => {
  if (!nextDate) return 'Not scheduled';

  const now = Date.now();
  const diff = nextDate.getTime() - now;

  if (diff < 0) {
    const overdue = Math.abs(diff);
    if (overdue < 60000) return 'Overdue';
    if (overdue < 3600000) return `Overdue by ${Math.floor(overdue / 60000)}m`;
    return `Overdue by ${Math.floor(overdue / 3600000)}h`;
  }

  if (diff < 60000) return `${Math.floor(diff / 1000)}s`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
  if (diff < 86400000)
    return `${Math.floor(diff / 3600000)}h ${Math.floor((diff % 3600000) / 60000)}m`;
  return `${Math.floor(diff / 86400000)}d`;
};

/**
 * Get active categories (currently running or about to run)
 */
export const getActiveCategories = (
  scrapingData: FilterScrapingStatus | null
): Set<string> => {
  if (!scrapingData) return new Set();

  const now = new Date();
  const activeCategories = new Set<string>();

  scrapingData.categories.forEach((category) => {
    if (!category.scheduledJob?.nextScheduledAt) return;

    const nextRun = new Date(category.scheduledJob.nextScheduledAt);
    const timeUntilNext = nextRun.getTime() - now.getTime();
    const executionEstimate =
      category.latestExecution?.executionTimeMs || 60000;

    // Category is active if it's running or about to run within 5 minutes
    if (
      Math.abs(timeUntilNext) <=
      Math.max(executionEstimate * 1.5, 5 * 60 * 1000)
    ) {
      activeCategories.add(category.categoryId);
    }
  });

  return activeCategories;
};

/**
 * Calculate polling efficiency compared to dumb polling
 */
export const calculatePollingEfficiency = (
  totalRequests: number,
  savedRequests: number,
  sessionStartTime: Date
): number => {
  const sessionDurationHours =
    (Date.now() - sessionStartTime.getTime()) / (1000 * 60 * 60);
  const dumbPollingRequests = Math.floor(sessionDurationHours * 120); // 120 requests per hour (30s intervals)

  if (dumbPollingRequests === 0) return 0;

  const efficiency = (savedRequests / dumbPollingRequests) * 100;
  return Math.min(99, Math.max(0, efficiency));
};

/**
 * Get human-readable polling mode description
 */
export const getPollingModeDescription = (mode: PollingMode): string => {
  switch (mode) {
    case 'idle':
      return 'No jobs scheduled within 2 minutes';
    case 'scheduled':
      return 'Jobs starting soon, monitoring closely';
    case 'active':
      return 'Jobs should be running now';
    case 'cooldown':
      return 'Jobs recently finished, monitoring for results';
    default:
      return 'Unknown polling mode';
  }
};

/**
 * Check if a state transition should trigger immediate polling
 */
export const shouldPollImmediately = (
  oldMode: PollingMode,
  newMode: PollingMode
): boolean => {
  // Poll immediately when transitioning to more active states
  if (oldMode === 'idle' && newMode === 'scheduled') return true;
  if (oldMode === 'scheduled' && newMode === 'active') return true;
  if (oldMode === 'active' && newMode === 'cooldown') return true;

  return false;
};

/**
 * Get the next state transition time based on scraping data
 */
export const getNextStateTransitionTime = (
  scrapingData: FilterScrapingStatus | null,
  currentMode: PollingMode
): Date | null => {
  if (!scrapingData?.nextScrapingAt) return null;

  const nextScrapingAt = new Date(scrapingData.nextScrapingAt);
  const executionEstimate = getExecutionTimeEstimate(scrapingData.categories);

  switch (currentMode) {
    case 'idle':
      // Transition to scheduled when job is within 2 minutes
      return new Date(nextScrapingAt.getTime() - 2 * 60 * 1000);

    case 'scheduled':
      // Transition to active when job should start
      return nextScrapingAt;

    case 'active':
      // Transition to cooldown when job should finish
      return new Date(nextScrapingAt.getTime() + executionEstimate);

    case 'cooldown':
      // Transition to idle after 2 minutes of cooldown
      return new Date(
        nextScrapingAt.getTime() + executionEstimate + 2 * 60 * 1000
      );

    default:
      return null;
  }
};
