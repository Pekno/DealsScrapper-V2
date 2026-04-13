/**
 * StateDebugContent - Debug information for page and application state
 * Displays current page state, filters, loading states, and React Query cache info
 */

import React from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import * as styles from '../ui/DebugPanel.css';

interface StateDebugProps {
  /** Current page-specific state data */
  pageState?: {
    filterId?: string;
    filter?: any;
    articles?: any;
    loading?: boolean;
    error?: string | null;
    searchTerm?: string;
    [key: string]: any;
  };
}

/**
 * StateDebugContent Component
 *
 * Provides detailed state debugging information including:
 * - Current route and navigation state
 * - Page-specific state variables
 * - React Query cache information
 * - URL parameters and search state
 */
export const StateDebugContent: React.FC<StateDebugProps> = ({
  pageState = {},
}) => {
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();

  // Get React Query cache information
  const queryCache = queryClient.getQueryCache();
  const queries = queryCache.getAll();
  const activeQueries = queries.filter(
    (query) => query.getObserversCount() > 0
  );

  // Format query key for display
  const formatQueryKey = (queryKey: readonly unknown[]) => {
    return [...queryKey]
      .map((key) =>
        typeof key === 'object' ? JSON.stringify(key) : String(key)
      )
      .join(' | ');
  };

  // Get memory usage (if available)
  const getMemoryInfo = () => {
    if (
      typeof window !== 'undefined' &&
      'performance' in window &&
      'memory' in (window.performance as any)
    ) {
      const memory = (window.performance as any).memory;
      return {
        used: Math.round(memory.usedJSHeapSize / 1024 / 1024),
        total: Math.round(memory.totalJSHeapSize / 1024 / 1024),
        limit: Math.round(memory.jsHeapSizeLimit / 1024 / 1024),
      };
    }
    return null;
  };

  const memoryInfo = getMemoryInfo();

  // Get loading status badge
  const getLoadingBadge = (isLoading: boolean) => {
    return isLoading ? (
      <span className={styles.debugStatusWarning}>Loading</span>
    ) : (
      <span className={styles.debugStatusSuccess}>Ready</span>
    );
  };

  return (
    <div>
      {/* Navigation State */}
      <div className={styles.debugField}>
        <span className={styles.debugFieldLabel}>Route</span>
        <span className={styles.debugFieldValue}>{pathname}</span>
      </div>

      {/* URL Parameters */}
      {searchParams && Array.from(searchParams.entries()).length > 0 && (
        <div className={styles.debugField}>
          <span className={styles.debugFieldLabel}>Params</span>
          <div className={styles.debugFieldValue}>
            <div className={styles.debugPreview}>
              {Array.from(searchParams.entries()).map(([key, value]) => (
                <div
                  key={key}
                  style={{ marginBottom: '2px', fontSize: '10px' }}
                >
                  <span style={{ color: '#888' }}>{key}:</span>
                  <span style={{ color: '#fff', marginLeft: '4px' }}>
                    {decodeURIComponent(value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Page State */}
      {Object.keys(pageState).length > 0 && (
        <>
          <div className={styles.debugField}>
            <span className={styles.debugFieldLabel}>Page Status</span>
            <span className={styles.debugFieldValue}>
              {getLoadingBadge(pageState.loading || false)}
              {pageState.error && (
                <span
                  className={styles.debugStatusError}
                  style={{ marginLeft: '8px' }}
                >
                  Error
                </span>
              )}
            </span>
          </div>

          {pageState.filterId && (
            <div className={styles.debugField}>
              <span className={styles.debugFieldLabel}>Filter ID</span>
              <span className={styles.debugFieldValue}>
                {pageState.filterId}
              </span>
            </div>
          )}

          {pageState.filter && (
            <div className={styles.debugField}>
              <span className={styles.debugFieldLabel}>Filter Name</span>
              <span className={styles.debugFieldValue}>
                {pageState.filter.name || 'Unnamed'}
                {pageState.filter.active !== undefined && (
                  <span style={{ marginLeft: '8px' }}>
                    {pageState.filter.active ? (
                      <span className={styles.debugStatusSuccess}>Active</span>
                    ) : (
                      <span className={styles.debugStatusWarning}>
                        Inactive
                      </span>
                    )}
                  </span>
                )}
              </span>
            </div>
          )}

          {pageState.articles && (
            <div className={styles.debugField}>
              <span className={styles.debugFieldLabel}>Articles</span>
              <span className={styles.debugFieldValue}>
                {pageState.articles.articles?.length || 0} /{' '}
                {pageState.articles.total || 0}
                <span style={{ color: '#888', marginLeft: '8px' }}>
                  (Page {pageState.articles.page || 1})
                </span>
              </span>
            </div>
          )}

          {pageState.searchTerm && (
            <div className={styles.debugField}>
              <span className={styles.debugFieldLabel}>Search</span>
              <span className={styles.debugFieldValue}>
                "{pageState.searchTerm}"
              </span>
            </div>
          )}

          {pageState.error && (
            <div className={styles.debugField}>
              <span className={styles.debugFieldLabel}>Error</span>
              <span
                className={styles.debugFieldValue}
                style={{ color: '#ef4444' }}
              >
                {pageState.error}
              </span>
            </div>
          )}
        </>
      )}

      {/* React Query State */}
      <div className={styles.debugField}>
        <span className={styles.debugFieldLabel}>Queries</span>
        <span className={styles.debugFieldValue}>
          {activeQueries.length} active / {queries.length} total
        </span>
      </div>

      {activeQueries.length > 0 && (
        <div className={styles.debugField}>
          <span className={styles.debugFieldLabel}>Active Queries</span>
          <div className={styles.debugFieldValue}>
            <div className={styles.debugPreview}>
              {activeQueries.slice(0, 5).map((query, index) => {
                const state = query.state;
                let statusBadge;

                if (state.fetchStatus === 'fetching') {
                  statusBadge = (
                    <span className={styles.debugStatusWarning}>Fetching</span>
                  );
                } else if (state.status === 'error') {
                  statusBadge = (
                    <span className={styles.debugStatusError}>Error</span>
                  );
                } else if (state.status === 'success') {
                  statusBadge = (
                    <span className={styles.debugStatusSuccess}>Success</span>
                  );
                } else {
                  statusBadge = (
                    <span className={styles.debugStatusInfo}>Idle</span>
                  );
                }

                return (
                  <div
                    key={index}
                    style={{
                      marginBottom: '4px',
                      fontSize: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    {statusBadge}
                    <span
                      style={{
                        color: '#ccc',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        flex: 1,
                      }}
                    >
                      {formatQueryKey(query.queryKey)}
                    </span>
                  </div>
                );
              })}
              {activeQueries.length > 5 && (
                <div
                  style={{ fontSize: '10px', color: '#888', marginTop: '4px' }}
                >
                  ... and {activeQueries.length - 5} more
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Memory Information */}
      {memoryInfo && (
        <div className={styles.debugField}>
          <span className={styles.debugFieldLabel}>Memory</span>
          <span className={styles.debugFieldValue}>
            {memoryInfo.used}MB / {memoryInfo.total}MB
            <span style={{ color: '#888', marginLeft: '8px' }}>
              (Limit: {memoryInfo.limit}MB)
            </span>
          </span>
        </div>
      )}

      {/* Environment Info */}
      <div className={styles.debugField}>
        <span className={styles.debugFieldLabel}>Environment</span>
        <span className={styles.debugFieldValue}>
          {process.env.NODE_ENV}
          {typeof window !== 'undefined' && (
            <span style={{ color: '#888', marginLeft: '8px' }}>Client</span>
          )}
        </span>
      </div>
    </div>
  );
};

export default StateDebugContent;
