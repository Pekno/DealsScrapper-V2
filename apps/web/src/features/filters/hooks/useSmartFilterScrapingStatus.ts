/**
 * Smart polling hook for filter scraping status
 * Implements intelligent polling intervals based on job scheduling
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/shared/lib/api';

type PollingMode = 'idle' | 'scheduled' | 'active' | 'cooldown';

interface PollingState {
  mode: PollingMode;
  activeCategories: Set<string>;
  nextPollAt: Date | null;
  requestCount: number;
  savedRequests: number;
  lastStateChange: Date;
  // Track job IDs to detect actual execution vs rescheduling
  trackedJobIds: Map<string, string>; // categoryId -> latestExecution.id
}

interface CategoryScrapingData {
  categoryId: string;
  categoryName: string;
  scheduledJob: {
    id: string;
    nextScheduledAt: string;
    isActive: boolean;
  } | null;
  latestExecution: {
    id: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    createdAt: string;
    updatedAt: string;
    executionTimeMs: number;
    dealsFound: number;
    dealsProcessed: number;
  } | null;
}

interface ScrapingStatusResponse {
  categories: CategoryScrapingData[];
  nextScrapingAt: string | null;
}

/**
 * Get execution time estimate from latest execution with safety buffer
 */
const getExecutionTimeEstimate = (
  categories: CategoryScrapingData[]
): number => {
  const executionTimes = categories
    .map((cat) => cat.latestExecution?.executionTimeMs)
    .filter((time): time is number => time !== null && time !== undefined);

  if (executionTimes.length === 0) {
    return 60000; // Default 1 minute
  }

  const maxExecution = Math.max(...executionTimes);
  // Add 50% buffer, minimum 30 seconds
  return Math.max(maxExecution * 1.5, 30000);
};

/**
 * Check if any jobs actually executed (new execution IDs)
 * This is needed because scheduler schedules next job BEFORE creating execution record
 */
const detectNewExecutions = (
  categories: CategoryScrapingData[],
  trackedJobIds: Map<string, string>
): { hasNewExecutions: boolean; newJobIds: Map<string, string> } => {
  const newJobIds = new Map<string, string>();
  let hasNewExecutions = false;

  categories.forEach((category) => {
    if (category.latestExecution?.id) {
      const previousJobId = trackedJobIds.get(category.categoryId);
      const currentJobId = category.latestExecution.id;

      // Track new job ID
      newJobIds.set(category.categoryId, currentJobId);

      // Detect if job ID changed (new execution)
      if (previousJobId && previousJobId !== currentJobId) {
        hasNewExecutions = true;
      }
    }
  });

  return { hasNewExecutions, newJobIds };
};

/**
 * Determine polling state based on job timing and actual execution status
 */
const determinePollingState = (
  scrapingData: ScrapingStatusResponse | undefined,
  trackedJobIds: Map<string, string>
): PollingMode => {
  if (!scrapingData) {
    return 'idle';
  }

  // Rule 0: Check for new job executions (job ID changed)
  const { hasNewExecutions } = detectNewExecutions(
    scrapingData.categories,
    trackedJobIds
  );

  // Rule 1: Check for actual processing jobs (highest priority)
  const hasProcessingJobs = scrapingData.categories.some(
    (category) => category.latestExecution?.status === 'processing'
  );

  if (hasProcessingJobs) {
    return 'active';
  }

  // Rule 2: Check for new executions to trigger cooldown phase
  // Cooldown should happen after any new execution is detected (from scheduled mode)
  if (hasNewExecutions) {
    return 'cooldown';
  }

  // Rule 3: Normal scheduler behavior - next job is scheduled BEFORE current job execution is recorded
  // Keep polling until we see the new execution ID
  if (!scrapingData.nextScrapingAt) {
    return 'idle';
  }

  const now = new Date();
  const nextRun = new Date(scrapingData.nextScrapingAt);
  const timeUntilNext = nextRun.getTime() - now.getTime();
  const executionEstimate = getExecutionTimeEstimate(scrapingData.categories);

  // Rule 2.5: If next job is in the future, stay idle - NO PREMATURE POLLING
  if (timeUntilNext > 0) {
    return 'idle';
  }

  // Rule 4: When scheduled time has passed, start polling to detect execution
  // This handles the normal case where scheduler updates nextScrapingAt before creating execution record
  const timeSinceScheduled = Math.abs(timeUntilNext);
  if (timeSinceScheduled <= 5 * 60 * 1000) {
    // 5 minutes grace period after scheduled time
    // This is NORMAL: nextScrapingAt updated but latestExecution.id hasn't changed yet
    if (trackedJobIds.size > 0 && !hasNewExecutions) {
      return 'scheduled'; // Keep polling - job should be running but execution not recorded yet
    }
  }

  // REMOVED Rule 7: Don't assume "active" just because we're within execution window
  // Only show "active" when there are actual processing jobs (handled by Rule 1)

  // Note: Cooldown is now handled by Rule 2 based on actual completion timestamp
  // This prevents the system from getting stuck in cooldown based on estimated timing

  // Rule 9: Long overdue = IDLE (assume failed)
  return 'idle';
};

/**
 * Calculate polling interval based on current state
 * Only poll when jobs are actually running or just finished
 */
const calculatePollingInterval = (
  mode: PollingMode,
  nextScrapingAt?: string
): number | false => {
  switch (mode) {
    case 'idle':
      // Never poll when idle - we know the schedule
      return false;

    case 'scheduled':
      // Light polling to detect when job starts (only used briefly after timer activation)
      return 30 * 1000; // 30 seconds

    case 'active':
      return 3 * 1000; // 3 seconds when jobs are processing

    case 'cooldown':
      return false; // No polling during cooldown - timer will handle exit to idle

    default:
      return false;
  }
};

/**
 * Detect which categories should be considered active
 * Enhanced logic to check actual execution status
 */
const detectActiveCategories = (
  categories: CategoryScrapingData[],
  executionEstimate: number
): Set<string> => {
  const activeCategories = new Set<string>();
  const now = new Date();

  categories.forEach((category) => {
    // Check if latest execution is currently processing
    if (category.latestExecution?.status === 'processing') {
      activeCategories.add(category.categoryId);
      return;
    }

    // Check if job is scheduled and should be running
    if (!category.scheduledJob?.nextScheduledAt) return;

    const nextRun = new Date(category.scheduledJob.nextScheduledAt);
    const timeSinceScheduled = now.getTime() - nextRun.getTime();

    // Consider active if:
    // 1. Job is overdue and within execution window
    // 2. Latest execution is recent and might still be running
    if (timeSinceScheduled >= 0 && timeSinceScheduled <= executionEstimate) {
      // Additional check: if we have a recent execution, check if it's likely still running
      if (category.latestExecution) {
        const executionAge =
          now.getTime() -
          new Date(category.latestExecution.createdAt).getTime();
        const maxExecutionTime = Math.max(
          executionEstimate,
          category.latestExecution.executionTimeMs * 2
        );

        // Only consider active if execution is recent enough to be current
        if (executionAge <= maxExecutionTime) {
          activeCategories.add(category.categoryId);
        }
      } else {
        // No execution data, assume active if within scheduled window
        activeCategories.add(category.categoryId);
      }
    }
  });

  return activeCategories;
};

/**
 * Smart polling hook for filter scraping status
 */
export const useSmartFilterScrapingStatus = (filterId: string) => {
  const [pollingState, setPollingState] = useState<PollingState>({
    mode: 'idle',
    activeCategories: new Set(),
    nextPollAt: null,
    requestCount: 0,
    savedRequests: 0,
    lastStateChange: new Date(),
    trackedJobIds: new Map(),
  });

  // Separate state for polling interval to avoid circular dependency
  const [currentPollingInterval, setCurrentPollingInterval] = useState<
    number | false
  >(false);

  // Clear all timers - use ref to avoid dependency issues
  const timersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const clearAllTimers = useCallback(() => {
    timersRef.current.forEach((timer) => clearTimeout(timer));
    timersRef.current.clear();
  }, []);

  // Check if filterId is valid (not "create", "edit", etc.)
  const isValidFilterId = filterId && !['create', 'edit', 'new'].includes(filterId);

  // Main query with dynamic polling
  const query = useQuery({
    queryKey: ['filter-scraping-status', filterId],
    queryFn: async () => {
      if (!filterId || !isValidFilterId) return null;
      const response = await apiClient.getFilterScrapingStatus(filterId);
      return response.data || null;
    },
    enabled: !!isValidFilterId,
    refetchInterval: currentPollingInterval,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false, // Prevent unwanted calls on window focus
    refetchOnReconnect: false, // Prevent calls on network reconnect
    staleTime: 0, // Always refetch when interval triggers
    // onSuccess is deprecated in newer versions of React Query
    // We'll handle the success case in a useEffect instead
  });

  // Update polling interval whenever state changes
  useEffect(() => {
    const scrapingData = query.data as ScrapingStatusResponse | null;
    const newInterval = calculatePollingInterval(
      pollingState.mode,
      scrapingData?.nextScrapingAt || undefined
    );
    setCurrentPollingInterval(newInterval);
  }, [pollingState.mode, query.data]);

  // Update polling state based on API response
  useEffect(() => {
    if (!query.data) return;

    // Handle request count increment (replacing deprecated onSuccess)
    // Only count requests when we're actively polling (not in idle mode)
    if (query.isSuccess && query.data && currentPollingInterval !== false) {
      setPollingState((prev) => ({
        ...prev,
        requestCount: prev.requestCount + 1,
      }));
    }

    const scrapingData = query.data as ScrapingStatusResponse | null;
    if (!scrapingData) return;

    setPollingState((prev) => {
      // Detect new executions and update tracked job IDs
      const { hasNewExecutions, newJobIds } = detectNewExecutions(
        scrapingData.categories,
        prev.trackedJobIds
      );

      // Determine new mode based on current state and job tracking
      const newMode = determinePollingState(scrapingData, prev.trackedJobIds);
      const executionEstimate = getExecutionTimeEstimate(
        scrapingData.categories
      );
      const newActiveCategories = detectActiveCategories(
        scrapingData.categories,
        executionEstimate
      );

      // Always update tracked job IDs
      const updatedState = {
        ...prev,
        activeCategories: newActiveCategories,
        trackedJobIds: newJobIds,
      };

      // Update mode and timestamp if mode changed
      if (prev.mode !== newMode) {
        return {
          ...updatedState,
          mode: newMode,
          lastStateChange: new Date(),
          nextPollAt: new Date(
            Date.now() +
              (calculatePollingInterval(
                newMode,
                scrapingData.nextScrapingAt || undefined
              ) || 0)
          ),
        };
      }

      return updatedState;
    });
  }, [query.data, query.isSuccess]);

  // Setup smart timer - only activate polling when job should start
  useEffect(() => {
    const scrapingData = query.data as ScrapingStatusResponse | null;
    if (!scrapingData?.nextScrapingAt) return;

    clearAllTimers();

    const nextRun = new Date(scrapingData.nextScrapingAt);
    const now = new Date();
    const timeUntilNext = nextRun.getTime() - now.getTime();

    // Only set timer if job is in the future
    if (timeUntilNext > 0) {
      // Timer to activate polling exactly when job should start
      const jobStartTimer = setTimeout(() => {
        setPollingState((prev) => ({
          ...prev,
          mode: 'scheduled', // Brief scheduled mode to detect job start
          lastStateChange: new Date(),
        }));
        // Don't manually refetch - let React Query polling handle it
      }, timeUntilNext);

      timersRef.current.set('jobStart', jobStartTimer);
    }

    // If job should be running now, check for completion
    if (timeUntilNext <= 0) {
      const executionEstimate = getExecutionTimeEstimate(
        scrapingData.categories
      );
      const timeSinceStart = Math.abs(timeUntilNext);

      // Only set cooldown timer if we're still within execution window
      if (timeSinceStart < executionEstimate) {
        const cooldownTimer = setTimeout(() => {
          setPollingState((prev) => ({
            ...prev,
            mode: 'cooldown',
            lastStateChange: new Date(),
          }));
          // Don't manually refetch - let React Query polling handle it
        }, executionEstimate - timeSinceStart);

        timersRef.current.set('cooldown', cooldownTimer);
      }
    }

    return clearAllTimers;
  }, [query.data, clearAllTimers]);

  // Setup cooldown exit timer
  useEffect(() => {
    if (pollingState.mode === 'cooldown') {
      const cooldownExitTimer = setTimeout(() => {
        setPollingState((prev) => ({
          ...prev,
          mode: 'idle',
          lastStateChange: new Date(),
        }));
      }, 30 * 1000); // Exit cooldown after 30 seconds

      timersRef.current.set('cooldownExit', cooldownExitTimer);

      return () => {
        clearTimeout(cooldownExitTimer);
        timersRef.current.delete('cooldownExit');
      };
    }
  }, [pollingState.mode]);

  // Cleanup timers on unmount
  useEffect(() => {
    return clearAllTimers;
  }, [clearAllTimers]);

  // Calculate efficiency metrics
  const calculateEfficiency = useCallback((): number => {
    const dumbPollingCalls = Math.floor(
      (Date.now() - pollingState.lastStateChange.getTime()) / 30000
    );

    if (dumbPollingCalls === 0) return 100;

    const efficiency = Math.max(
      0,
      ((dumbPollingCalls - pollingState.requestCount) / dumbPollingCalls) * 100
    );

    return Math.round(efficiency);
  }, [pollingState.requestCount, pollingState.lastStateChange]);

  return {
    ...query,
    pollingState: {
      ...pollingState,
      savedRequests: Math.max(
        0,
        Math.floor(
          (Date.now() - pollingState.lastStateChange.getTime()) / 30000
        ) - pollingState.requestCount
      ),
    },
    isActivelyScrapingAny: pollingState.activeCategories.size > 0,
    efficiency: calculateEfficiency(),

    // Debug helpers
    debugInfo:
      process.env.NODE_ENV === 'development'
        ? {
            mode: pollingState.mode,
            interval: calculatePollingInterval(pollingState.mode),
            activeCategories: Array.from(pollingState.activeCategories),
            nextPollIn: pollingState.nextPollAt
              ? Math.max(0, pollingState.nextPollAt.getTime() - Date.now())
              : 0,
            requestCount: pollingState.requestCount,
            efficiency: calculateEfficiency(),
            trackedJobIds: Object.fromEntries(pollingState.trackedJobIds),
          }
        : undefined,
  };
};
