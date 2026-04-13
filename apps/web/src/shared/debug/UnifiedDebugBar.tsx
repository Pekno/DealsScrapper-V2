/**
 * UnifiedDebugBar - Minimal global debug panel system
 * Shows as a small row of buttons at bottom of screen with expand-on-demand
 */

import React, { useState } from 'react';
import * as styles from './UnifiedDebugBar.css';
import { AuthDebugContent } from './AuthDebugContent';
import { SmartPollingDebugContent } from './SmartPollingDebugContent';
import { ApiDebugContent } from './ApiDebugContent';
import { StateDebugContent } from './StateDebugContent';
import { useSmartFilterScrapingStatus } from '@/features/filters/hooks/useSmartFilterScrapingStatus';

type DebugPanelType = 'auth' | 'polling' | 'api' | 'state' | null;

interface DebugPanelConfig {
  id: DebugPanelType;
  title: string;
  icon: string;
  badge?: string | number;
}

/**
 * UnifiedDebugBar Component
 *
 * Provides a minimal debug interface that:
 * - Shows as small buttons at bottom of screen
 * - Expands individual panels upward on click
 * - Only one panel can be expanded at a time
 * - Automatically hidden in production
 */
export function UnifiedDebugBar(): React.ReactElement | null {
  const [expandedPanel, setExpandedPanel] = useState<DebugPanelType>(null);
  const [isClient, setIsClient] = useState(false);

  // Extract filterId from current path if on a filter detail page
  const [currentFilterId, setCurrentFilterId] = useState<string>('');

  // Smart polling hook for current filter (only if on filter detail page)
  const smartPolling = useSmartFilterScrapingStatus(currentFilterId);

  // Update current filter ID based on route
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      const filterMatch = path.match(/\/filters\/([^\/]+)/);
      setCurrentFilterId(filterMatch ? filterMatch[1] : '');
    }
  }, []);

  // Handle hydration
  React.useEffect(() => {
    setIsClient(true);
  }, []);

  // Only show in true development mode (not in test, production, or CI)
  const isDevelopment = process.env.NODE_ENV === 'development';

  if (!isDevelopment) {
    return null;
  }

  // Don't render until client hydration
  if (!isClient) {
    return null;
  }

  const debugPanels: DebugPanelConfig[] = [
    { id: 'auth', title: 'Auth', icon: '🔧' },
    { id: 'polling', title: 'Smart Poll', icon: '🔄' },
    { id: 'api', title: 'API', icon: '📊' },
    { id: 'state', title: 'State', icon: '💾' },
  ];

  const handlePanelToggle = (panelId: DebugPanelType) => {
    setExpandedPanel(expandedPanel === panelId ? null : panelId);
  };

  const renderPanelContent = (panelId: DebugPanelType) => {
    switch (panelId) {
      case 'auth':
        return <AuthDebugContent />;
      case 'polling':
        return <SmartPollingDebugContent smartPollingData={smartPolling} />;
      case 'api':
        return <ApiDebugContent />;
      case 'state':
        return (
          <StateDebugContent
            pageState={{
              currentPath:
                typeof window !== 'undefined' ? window.location.pathname : '',
              filterId: currentFilterId || undefined,
              timestamp: new Date().toISOString(),
            }}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className={styles.debugBarContainer}>
      {/* Expanded Panel Content (appears above buttons) */}
      {expandedPanel && (
        <div className={styles.expandedPanelContainer}>
          <div className={`${styles.expandedPanel} ${styles.expandAnimation}`}>
            <div className={styles.expandedPanelHeader}>
              <span className={styles.expandedPanelTitle}>
                {debugPanels.find((p) => p.id === expandedPanel)?.icon}{' '}
                {debugPanels.find((p) => p.id === expandedPanel)?.title} Debug
              </span>
              <button
                onClick={() => setExpandedPanel(null)}
                className={styles.closeButton}
                aria-label="Close debug panel"
              >
                ×
              </button>
            </div>
            <div className={styles.expandedPanelContent}>
              {renderPanelContent(expandedPanel)}
            </div>
          </div>
        </div>
      )}

      {/* Debug Buttons Row */}
      <div className={styles.debugButtonsRow}>
        {debugPanels.map((panel) => (
          <button
            key={panel.id}
            onClick={() => handlePanelToggle(panel.id)}
            className={`${styles.debugButton} ${
              expandedPanel === panel.id ? styles.debugButtonActive : ''
            }`}
            title={`${panel.title} Debug Panel`}
          >
            <span className={styles.debugButtonIcon}>{panel.icon}</span>
            <span className={styles.debugButtonTitle}>{panel.title}</span>
            {expandedPanel === panel.id && (
              <span className={styles.debugButtonIndicator}>▲</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

export default UnifiedDebugBar;
