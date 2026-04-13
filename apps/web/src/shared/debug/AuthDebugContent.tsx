/**
 * AuthDebugContent - Debug information for authentication state
 * Displays user info, token status, and authentication details
 */
import React from 'react';
import { useAuthDebug } from '@/features/auth/hooks/useAuth';
import * as styles from '../ui/DebugPanel.css';

/**
 * AuthDebugContent Component
 *
 * Provides detailed authentication debugging information including:
 * - User authentication status
 * - Token presence and validity
 * - Token preview (first 20 characters)
 * - Token status messages
 * - Last check timestamp
 */
export const AuthDebugContent: React.FC = () => {
  const { user, loading, hasToken, tokenPreview, tokenStatus, lastChecked } =
    useAuthDebug();

  // Determine status badge based on auth state
  const getStatusBadge = () => {
    if (loading) {
      return <span className={styles.debugStatusInfo}>Loading</span>;
    }
    if (user) {
      return <span className={styles.debugStatusSuccess}>Authenticated</span>;
    }
    if (hasToken) {
      return <span className={styles.debugStatusWarning}>Token Present</span>;
    }
    return <span className={styles.debugStatusError}>Not Authenticated</span>;
  };

  // Format timestamp for display
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <div>
      <div className={styles.debugField}>
        <span className={styles.debugFieldLabel}>Status</span>
        <span className={styles.debugFieldValue}>{getStatusBadge()}</span>
      </div>

      <div className={styles.debugField}>
        <span className={styles.debugFieldLabel}>User ID</span>
        <span className={styles.debugFieldValue}>{user?.id || 'None'}</span>
      </div>

      <div className={styles.debugField}>
        <span className={styles.debugFieldLabel}>Email</span>
        <span className={styles.debugFieldValue}>{user?.email || 'None'}</span>
      </div>

      <div className={styles.debugField}>
        <span className={styles.debugFieldLabel}>Name</span>
        <span className={styles.debugFieldValue}>
          {user
            ? `${user.firstName || ''} ${user.lastName || ''}`.trim() ||
              'Not set'
            : 'None'}
        </span>
      </div>

      <div className={styles.debugField}>
        <span className={styles.debugFieldLabel}>Role</span>
        <span className={styles.debugFieldValue}>{user?.role || 'None'}</span>
      </div>

      <div className={styles.debugField}>
        <span className={styles.debugFieldLabel}>Has Token</span>
        <span className={styles.debugFieldValue}>
          {hasToken ? 'Yes' : 'No'}
        </span>
      </div>

      <div className={styles.debugField}>
        <span className={styles.debugFieldLabel}>Token Status</span>
        <span className={styles.debugFieldValue}>{tokenStatus}</span>
      </div>

      {tokenPreview && (
        <div className={styles.debugField}>
          <span className={styles.debugFieldLabel}>Token Preview</span>
          <div className={styles.debugFieldValue}>
            <div className={styles.debugPreview}>{tokenPreview}...</div>
          </div>
        </div>
      )}

      <div className={styles.debugField}>
        <span className={styles.debugFieldLabel}>Last Refresh</span>
        <span className={styles.debugFieldValue}>
          {user?.updatedAt
            ? new Date(user.updatedAt).toLocaleString()
            : 'Never'}
        </span>
      </div>

      <div className={styles.debugField}>
        <span className={styles.debugFieldLabel}>Last Check</span>
        <span className={styles.debugFieldValue}>
          {formatTimestamp(lastChecked)}
        </span>
      </div>
    </div>
  );
};

export default AuthDebugContent;
