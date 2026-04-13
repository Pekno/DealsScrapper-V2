/**
 * ApiDebugContent - Debug information for API calls
 * Displays recent API calls, response times, error rates, and service status
 */
import React, { useState, useEffect } from 'react';
import * as styles from '../ui/DebugPanel.css';

interface ApiCall {
  id: string;
  url: string;
  method: string;
  status: number;
  responseTime: number;
  timestamp: Date;
  error?: string;
}

interface ApiStats {
  totalCalls: number;
  successRate: number;
  averageResponseTime: number;
  errorCount: number;
  lastCallTime?: Date;
}

/**
 * ApiDebugContent Component
 *
 * Provides detailed API debugging information including:
 * - Recent API call history
 * - Response time metrics
 * - Success/error rates
 * - Service availability status
 */
export const ApiDebugContent: React.FC = () => {
  const [apiCalls, setApiCalls] = useState<ApiCall[]>([]);
  const [apiStats, setApiStats] = useState<ApiStats>({
    totalCalls: 0,
    successRate: 0,
    averageResponseTime: 0,
    errorCount: 0,
  });

  // Service endpoints to monitor
  const services = [
    { name: 'API', url: 'http://localhost:3001/health' },
    { name: 'Scraper', url: 'http://localhost:3002/health' },
    { name: 'Notifier', url: 'http://localhost:3003/health' },
    { name: 'Scheduler', url: 'http://localhost:3004/health' },
  ];

  // Intercept fetch calls for monitoring (development only)
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;

    const originalFetch = window.fetch;

    window.fetch = async (...args) => {
      const startTime = performance.now();
      const url = args[0] as string;
      const options = args[1];
      const method = options?.method || 'GET';

      try {
        const response = await originalFetch(...args);
        const endTime = performance.now();
        const responseTime = Math.round(endTime - startTime);

        // Only track API calls to our services
        if (url.includes('localhost:300') || url.includes('/api/')) {
          const apiCall: ApiCall = {
            id: Date.now().toString(),
            url: url.replace(/^https?:\/\/[^\/]+/, ''), // Remove domain
            method,
            status: response.status,
            responseTime,
            timestamp: new Date(),
          };

          setApiCalls((prev) => [apiCall, ...prev.slice(0, 19)]); // Keep last 20
        }

        return response;
      } catch (error) {
        const endTime = performance.now();
        const responseTime = Math.round(endTime - startTime);

        if (url.includes('localhost:300') || url.includes('/api/')) {
          const apiCall: ApiCall = {
            id: Date.now().toString(),
            url: url.replace(/^https?:\/\/[^\/]+/, ''),
            method,
            status: 0,
            responseTime,
            timestamp: new Date(),
            error: error instanceof Error ? error.message : 'Network error',
          };

          setApiCalls((prev) => [apiCall, ...prev.slice(0, 19)]);
        }

        throw error;
      }
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  // Calculate stats from recent API calls
  useEffect(() => {
    const successfulCalls = apiCalls.filter(
      (call) => call.status >= 200 && call.status < 300
    );
    const errorCalls = apiCalls.filter(
      (call) => call.status >= 400 || call.error
    );

    setApiStats({
      totalCalls: apiCalls.length,
      successRate:
        apiCalls.length > 0
          ? Math.round((successfulCalls.length / apiCalls.length) * 100)
          : 0,
      averageResponseTime:
        apiCalls.length > 0
          ? Math.round(
              apiCalls.reduce((sum, call) => sum + call.responseTime, 0) /
                apiCalls.length
            )
          : 0,
      errorCount: errorCalls.length,
      lastCallTime: apiCalls[0]?.timestamp,
    });
  }, [apiCalls]);

  // Get status badge for HTTP status code
  const getStatusBadge = (status: number, error?: string) => {
    if (error) {
      return <span className={styles.debugStatusError}>Error</span>;
    }
    if (status >= 200 && status < 300) {
      return <span className={styles.debugStatusSuccess}>{status}</span>;
    }
    if (status >= 400) {
      return <span className={styles.debugStatusError}>{status}</span>;
    }
    return (
      <span className={styles.debugStatusWarning}>{status || 'Unknown'}</span>
    );
  };

  // Format response time with color coding
  const formatResponseTime = (time: number) => {
    let color = '#22c55e'; // Green for fast
    if (time > 1000)
      color = '#ef4444'; // Red for slow
    else if (time > 500) color = '#f59e0b'; // Yellow for medium

    return <span style={{ color }}>{time}ms</span>;
  };

  return (
    <div>
      {/* API Statistics */}
      <div className={styles.debugField}>
        <span className={styles.debugFieldLabel}>Total Calls</span>
        <span className={styles.debugFieldValue}>{apiStats.totalCalls}</span>
      </div>

      <div className={styles.debugField}>
        <span className={styles.debugFieldLabel}>Success Rate</span>
        <span className={styles.debugFieldValue}>
          {apiStats.successRate}%
          {apiStats.errorCount > 0 && (
            <span
              className={styles.debugStatusError}
              style={{ marginLeft: '8px' }}
            >
              {apiStats.errorCount} errors
            </span>
          )}
        </span>
      </div>

      <div className={styles.debugField}>
        <span className={styles.debugFieldLabel}>Avg Response</span>
        <span className={styles.debugFieldValue}>
          {formatResponseTime(apiStats.averageResponseTime)}
        </span>
      </div>

      {apiStats.lastCallTime && (
        <div className={styles.debugField}>
          <span className={styles.debugFieldLabel}>Last Call</span>
          <span className={styles.debugFieldValue}>
            {apiStats.lastCallTime.toLocaleTimeString('en-US', {
              hour12: false,
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })}
          </span>
        </div>
      )}

      {/* Recent API Calls */}
      {apiCalls.length > 0 && (
        <div className={styles.debugField}>
          <span className={styles.debugFieldLabel}>Recent Calls</span>
          <div className={styles.debugFieldValue}>
            <div className={styles.debugPreview}>
              {apiCalls.slice(0, 8).map((call) => (
                <div
                  key={call.id}
                  style={{
                    marginBottom: '4px',
                    fontSize: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <span
                    style={{
                      color: '#888',
                      minWidth: '45px',
                      fontSize: '9px',
                    }}
                  >
                    {call.timestamp
                      .toLocaleTimeString('en-US', {
                        hour12: false,
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })
                      .substring(0, 5)}
                  </span>
                  <span
                    style={{
                      color: '#fff',
                      minWidth: '35px',
                      fontSize: '9px',
                    }}
                  >
                    {call.method}
                  </span>
                  {getStatusBadge(call.status, call.error)}
                  {formatResponseTime(call.responseTime)}
                  <span
                    style={{
                      color: '#ccc',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      flex: 1,
                    }}
                  >
                    {call.url}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Service Status */}
      <div className={styles.debugField}>
        <span className={styles.debugFieldLabel}>Services</span>
        <div className={styles.debugFieldValue}>
          <div className={styles.debugPreview}>
            {services.map((service) => {
              const recentCall = apiCalls.find(
                (call) =>
                  call.url.includes('/health') &&
                  call.url.includes(service.url.split(':')[2]?.split('/')[0])
              );

              let status = 'Unknown';
              let statusStyle = styles.debugStatusWarning;

              if (recentCall) {
                if (recentCall.status >= 200 && recentCall.status < 300) {
                  status = 'Online';
                  statusStyle = styles.debugStatusSuccess;
                } else {
                  status = 'Error';
                  statusStyle = styles.debugStatusError;
                }
              }

              return (
                <div
                  key={service.name}
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
                      color: '#fff',
                      minWidth: '70px',
                      fontWeight: '600',
                    }}
                  >
                    {service.name}
                  </span>
                  <span className={statusStyle}>{status}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApiDebugContent;
