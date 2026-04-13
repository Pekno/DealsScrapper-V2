/**
 * SmartPollingDebugContent - Debug information for smart polling system
 * Displays polling state, intervals, efficiency metrics, and category status
 */
import React from 'react';
import moment from 'moment';
import * as styles from '../ui/DebugPanel.css';
import { getCategoryColorById } from '@/features/filters/components/CategoryTags';

interface SmartPollingDebugProps {
  /** Smart polling data from useSmartFilterScrapingStatus hook */
  smartPollingData: any;
}

/**
 * SmartPollingDebugContent Component
 *
 * Provides detailed smart polling debugging information including:
 * - Current polling mode and intervals
 * - Efficiency metrics and request savings
 * - Per-category scraping status
 * - Next scraping schedules
 */
export const SmartPollingDebugContent: React.FC<SmartPollingDebugProps> = ({
  smartPollingData,
}) => {
  if (!smartPollingData) {
    return (
      <div className={styles.debugField}>
        <span className={styles.debugFieldValue}>
          No smart polling data available
        </span>
      </div>
    );
  }

  const {
    pollingState,
    data: scrapingData,
    isActivelyScrapingAny,
    efficiency,
    debugInfo,
    isLoading,
    error,
  } = smartPollingData;

  // Get polling mode status badge
  const getPollingModeBadge = (mode: string) => {
    switch (mode) {
      case 'active':
        return <span className={styles.debugStatusSuccess}>Active</span>;
      case 'scheduled':
        return <span className={styles.debugStatusWarning}>Scheduled</span>;
      case 'cooldown':
        return <span className={styles.debugStatusInfo}>Cooldown</span>;
      case 'idle':
      default:
        return <span className={styles.debugStatusError}>Idle</span>;
    }
  };

  // Format interval display
  const formatInterval = (intervalMs: number | false) => {
    if (intervalMs === false) return 'Disabled';
    if (intervalMs < 1000) return `${intervalMs}ms`;
    return `${Math.round(intervalMs / 1000)}s`;
  };

  // Format next poll time
  const formatNextPoll = (nextPollIn: number) => {
    if (nextPollIn <= 0) return 'Now';
    if (nextPollIn < 60000) return `${Math.round(nextPollIn / 1000)}s`;
    return `${Math.round(nextPollIn / 60000)}m`;
  };

  return (
    <div>
      {/* Overall Status */}
      <div className={styles.debugField}>
        <span className={styles.debugFieldLabel}>Status</span>
        <span className={styles.debugFieldValue}>
          {isLoading && <span className={styles.debugStatusInfo}>Loading</span>}
          {error && <span className={styles.debugStatusError}>Error</span>}
          {!isLoading && !error && (
            <>
              {getPollingModeBadge(pollingState?.mode || 'unknown')}
              {isActivelyScrapingAny && (
                <span
                  className={styles.debugStatusSuccess}
                  style={{ marginLeft: '8px' }}
                >
                  Scraping Active
                </span>
              )}
            </>
          )}
        </span>
      </div>

      {/* Polling Details */}
      {debugInfo && (
        <>
          <div className={styles.debugField}>
            <span className={styles.debugFieldLabel}>Mode</span>
            <span className={styles.debugFieldValue}>{debugInfo.mode}</span>
          </div>

          <div className={styles.debugField}>
            <span className={styles.debugFieldLabel}>Interval</span>
            <span className={styles.debugFieldValue}>
              {formatInterval(debugInfo.interval)}
            </span>
          </div>

          <div className={styles.debugField}>
            <span className={styles.debugFieldLabel}>Next Poll</span>
            <span className={styles.debugFieldValue}>
              {formatNextPoll(debugInfo.nextPollIn)}
            </span>
          </div>

          <div className={styles.debugField}>
            <span className={styles.debugFieldLabel}>Requests</span>
            <span className={styles.debugFieldValue}>
              {debugInfo.requestCount}
              {pollingState?.savedRequests > 0 && (
                <span style={{ color: '#22c55e', marginLeft: '8px' }}>
                  (Saved: {pollingState.savedRequests})
                </span>
              )}
            </span>
          </div>

          <div className={styles.debugField}>
            <span className={styles.debugFieldLabel}>Efficiency</span>
            <span className={styles.debugFieldValue}>
              {debugInfo.efficiency}%
            </span>
          </div>
        </>
      )}

      {/* Next Scraping Time */}
      {scrapingData?.nextScrapingAt && (
        <div className={styles.debugField}>
          <span className={styles.debugFieldLabel}>Next Run</span>
          <span className={styles.debugFieldValue}>
            {moment(scrapingData.nextScrapingAt).format('MM/DD HH:mm:ss')}{' '}
            <span style={{ color: '#888' }}>
              ({moment(scrapingData.nextScrapingAt).fromNow()})
            </span>
          </span>
        </div>
      )}

      {/* Active Categories */}
      {debugInfo?.activeCategories && debugInfo.activeCategories.length > 0 && (
        <div className={styles.debugField}>
          <span className={styles.debugFieldLabel}>Active</span>
          <span className={styles.debugFieldValue}>
            {debugInfo.activeCategories.join(', ')}
          </span>
        </div>
      )}

      {/* Tracked Job IDs */}
      {debugInfo?.trackedJobIds &&
        Object.keys(debugInfo.trackedJobIds).length > 0 && (
          <div className={styles.debugField}>
            <span className={styles.debugFieldLabel}>Tracked Jobs</span>
            <div className={styles.debugFieldValue}>
              <div className={styles.debugPreview}>
                {Object.entries(debugInfo.trackedJobIds).map(
                  ([categoryId, jobId]: [string, any]) => (
                    <div
                      key={categoryId}
                      style={{
                        marginBottom: '2px',
                        fontSize: '9px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <span
                        style={{
                          color: '#888',
                          minWidth: '40px',
                          fontWeight: '500',
                        }}
                      >
                        {categoryId}:
                      </span>
                      <span
                        style={{
                          color: '#93c5fd',
                          fontFamily: 'monospace',
                          fontSize: '8px',
                        }}
                      >
                        {jobId}
                      </span>
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        )}

      {/* Category Details */}
      {scrapingData?.categories && scrapingData.categories.length > 0 && (
        <div className={styles.debugField}>
          <span className={styles.debugFieldLabel}>Categories</span>
          <div className={styles.debugFieldValue}>
            <div className={styles.debugPreview}>
              {scrapingData.categories.map((category: any) => {
                const [bgColor] = getCategoryColorById(category.categoryId);

                let status = 'No schedule';
                if (category.latestExecution?.status === 'processing') {
                  status = 'Processing';
                } else if (category.scheduledJob?.nextScheduledAt) {
                  const nextTime = moment(
                    category.scheduledJob.nextScheduledAt
                  );
                  const diffMinutes = nextTime.diff(moment(), 'minutes');

                  if (diffMinutes < 0) {
                    status = `Overdue ${Math.abs(diffMinutes)}m`;
                  } else if (diffMinutes < 60) {
                    status = `Next in ${diffMinutes}m`;
                  } else {
                    status = `Next at ${nextTime.format('HH:mm')}`;
                  }
                }

                return (
                  <div
                    key={category.categoryId}
                    style={{
                      marginBottom: '4px',
                      fontSize: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <span
                      style={{
                        color: bgColor,
                        fontWeight: '600',
                        minWidth: '100px',
                      }}
                    >
                      {category.categoryName}
                    </span>
                    <span style={{ color: '#ccc' }}>{status}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className={styles.debugField}>
          <span className={styles.debugFieldLabel}>Error</span>
          <span className={styles.debugFieldValue} style={{ color: '#ef4444' }}>
            {error.message || error}
          </span>
        </div>
      )}
    </div>
  );
};

export default SmartPollingDebugContent;
