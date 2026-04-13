/**
 * SmartScrapingStatus - Display smart scraping status with live updates
 * Shows scraping status, countdown timers, and per-category details
 */
import React, { useState, useEffect } from 'react';
import moment from 'moment';
import { formatAbsoluteDate } from '@/shared/lib/date-utils';
import { getCategoryColorById } from './CategoryTags';
import { dataCy } from '@/shared/lib/test-utils';
import * as styles from './FilterDetailPage.css';
import type { CategoryScrapingStatus, FilterScrapingStatus } from '@/features/filters/types/filter.types';

/** Polling mode types for the smart polling state machine */
type PollingMode = 'idle' | 'scheduled' | 'active' | 'cooldown';

/** Simplified polling state for display purposes */
interface DisplayPollingState {
  mode: PollingMode;
  [key: string]: unknown;
}

/** Smart polling data structure from useSmartFilterPolling/useSmartFilterScrapingStatus */
export interface SmartPollingData {
  pollingState: DisplayPollingState;
  data: FilterScrapingStatus | null | undefined;
  isActivelyScrapingAny: boolean;
  [key: string]: unknown; // Allow other properties from the hook
}

export interface SmartScrapingStatusProps {
  /** Smart polling data for real-time job status */
  smartPollingData?: SmartPollingData;
}

/**
 * SmartScrapingStatus Component
 *
 * Displays real-time scraping status with:
 * - Live countdown timers
 * - Job status indicators (running, scheduled, completed)
 * - Per-category status breakdown in tooltip
 */
export const SmartScrapingStatus: React.FC<SmartScrapingStatusProps> = ({
  smartPollingData,
}) => {
  // Add live countdown timer
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update current time more frequently when close to execution
  useEffect(() => {
    // Check if we're close to execution time to determine update frequency
    const scrapingData = smartPollingData?.data;
    let updateInterval = 30000; // Default: 30 seconds

    if (scrapingData?.nextScrapingAt) {
      const nextRun = moment(scrapingData.nextScrapingAt);
      const now = moment();
      const diffInMinutes = nextRun.diff(now, 'minutes');

      // Update every 5 seconds when under 2 minutes
      if (diffInMinutes < 2) {
        updateInterval = 5000;
      }
    }

    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, updateInterval);

    return () => clearInterval(timer);
  }, [smartPollingData?.data?.nextScrapingAt]);

  if (!smartPollingData) {
    return <span>Status unavailable</span>;
  }

  const {
    pollingState,
    data: scrapingData,
    isActivelyScrapingAny,
  } = smartPollingData;

  // Check if any job is currently running (processing status)
  const isAnyJobRunning = scrapingData?.categories?.some(
    (category: CategoryScrapingStatus) => category.latestExecution?.status === 'processing'
  );

  // Check if any job is starting soon (scheduled to run within 1 minute)
  const isAnyJobStartingSoon = scrapingData?.categories?.some(
    (category: CategoryScrapingStatus) => {
      if (!category.scheduledJob?.nextScheduledAt) return false;
      const nextRun = moment(category.scheduledJob.nextScheduledAt);
      const now = moment(currentTime);
      const diffInMinutes = nextRun.diff(now, 'minutes');
      return diffInMinutes <= 0; // Starting now or overdue
    }
  );

  // Simple CSS spinner component
  const SimpleSpinner = ({ size = '14', color = 'currentColor' }) => (
    <div
      style={{
        width: `${size}px`,
        height: `${size}px`,
        border: '2px solid #f3f3f3',
        borderTop: `2px solid ${color}`,
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
        display: 'inline-block',
        marginRight: '4px',
      }}
    />
  );

  // Determine display text and icon based on polling state and actual job status
  const getStatusDisplay = () => {
    // Priority 1: Check if any job is currently processing
    if (isAnyJobRunning) {
      return {
        text: 'Actively scraping deals...',
        showSpinner: true,
      };
    }

    // Priority 2: Check if any job is starting soon
    if (isAnyJobStartingSoon || pollingState.mode === 'scheduled') {
      return {
        text: 'Starting scraper...',
        showSpinner: true,
      };
    }

    // Priority 3: Check for recently completed jobs (cooldown phase)
    if (pollingState.mode === 'cooldown') {
      const completedJobs =
        scrapingData?.categories?.filter(
          (cat: CategoryScrapingStatus) => cat.latestExecution?.status === 'completed'
        ) || [];

      if (completedJobs.length > 0) {
        return {
          text: (
            <span
              style={{
                color: '#10B981',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M20 6L9 17L4 12"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Scraped successfully
            </span>
          ),
          showSpinner: false,
        };
      }
    }

    // Priority 4: Use the nextScrapingAt from the API response for timing
    if (scrapingData?.nextScrapingAt) {
      const nextRun = moment(scrapingData.nextScrapingAt);
      const now = moment(currentTime); // Use live current time
      const diffInMinutes = nextRun.diff(now, 'minutes');

      // If overdue
      if (diffInMinutes < 0) {
        const overdueMins = Math.abs(diffInMinutes);
        if (overdueMins < 60) {
          return { text: `Overdue by ${overdueMins}m`, showSpinner: false };
        } else {
          const overdueHours = Math.floor(overdueMins / 60);
          return { text: `Overdue by ${overdueHours}h`, showSpinner: false };
        }
      }

      // If less than 1 hour away
      if (diffInMinutes < 60) {
        // Use moment.js to handle the countdown automatically
        const timeUntil = nextRun.from(now, true); // true = remove "in" prefix

        return {
          text: `Next check in ${timeUntil}`,
          showSpinner: false,
        };
      }

      // If less than 24 hours away
      if (diffInMinutes < 24 * 60) {
        const hours = Math.floor(diffInMinutes / 60);
        const mins = diffInMinutes % 60;
        return {
          text:
            mins > 0
              ? `Next check in ${hours}h ${mins}m`
              : `Next check in ${hours}h`,
          showSpinner: false,
        };
      }

      // If less than 7 days away
      const diffInDays = Math.floor(diffInMinutes / (24 * 60));
      if (diffInDays < 7) {
        return { text: `Next check in ${diffInDays}d`, showSpinner: false };
      }

      // Default for longer periods
      return {
        text: `Next check on ${formatAbsoluteDate(scrapingData.nextScrapingAt)}`,
        showSpinner: false,
      };
    }

    // Default fallback if no timing data
    return { text: 'Scheduler inactive', showSpinner: false };
  };

  const { text, showSpinner } = getStatusDisplay();

  return (
    <span className={styles.scrapingStatusContainer}>
      {showSpinner && (
        <div {...dataCy('scraping-status-loader')}>
          <SimpleSpinner />
        </div>
      )}
      {text}

      {/* Add CSS keyframes for spinner animation */}
      <style>{`
        @keyframes spin {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }
      `}</style>

      {/* Detailed Categories Tooltip */}
      {scrapingData?.categories && (
        <div className={styles.smartPollingTooltip}>
          {scrapingData.categories.map((category: CategoryScrapingStatus, index: number) => {
            const [bgColor] = getCategoryColorById(category.categoryId);

            let statusText;
            let showCategorySpinner = false;

            // Check if this specific category's job is currently running
            if (category.latestExecution?.status === 'processing') {
              statusText = 'Running now';
              showCategorySpinner = true;
            } else if (category.scheduledJob?.nextScheduledAt) {
              const nextRun = moment(category.scheduledJob.nextScheduledAt);
              const now = moment(currentTime);
              const diffInMinutes = nextRun.diff(now, 'minutes');

              if (diffInMinutes <= 0) {
                statusText = 'Starting soon';
                showCategorySpinner = true;
              } else if (diffInMinutes < 60) {
                const timeUntil = nextRun.from(now, true);
                statusText = `in ${timeUntil}`;
              } else if (diffInMinutes < 24 * 60) {
                const hours = Math.floor(diffInMinutes / 60);
                const mins = diffInMinutes % 60;
                statusText =
                  mins > 0 ? `in ${hours}h ${mins}m` : `in ${hours}h`;
              } else {
                const days = Math.floor(diffInMinutes / (24 * 60));
                statusText = `in ${days}d`;
              }
            } else {
              statusText = 'Inactive';
            }

            return (
              <div
                key={category.categoryId}
                style={{
                  whiteSpace: 'nowrap',
                  display: 'flex',
                  alignItems: 'center',
                  marginBottom:
                    index < scrapingData.categories.length - 1 ? '4px' : '0',
                }}
              >
                {showCategorySpinner && (
                  <SimpleSpinner size="12" color={bgColor} />
                )}
                <span style={{ color: bgColor, fontWeight: '600' }}>
                  {category.categoryName}
                </span>
                <span style={{ color: 'white' }}>: {statusText}</span>
              </div>
            );
          })}
        </div>
      )}
    </span>
  );
};
