import React, { useState, useEffect } from 'react';
import { useAuthDebug } from '@/features/auth/hooks/useAuth';

/**
 * Development-only component for debugging authentication state.
 * Shows real-time auth status, token presence, and state changes.
 */
export function AuthDebugPanel(): React.ReactElement | null {
  const { user, loading, hasToken, tokenPreview } = useAuthDebug();
  const [isClient, setIsClient] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string>('');

  // Handle hydration
  useEffect(() => {
    setIsClient(true);
    setLastUpdate(new Date().toLocaleTimeString());
  }, []);

  // Update timestamp when auth state changes
  useEffect(() => {
    if (isClient) {
      setLastUpdate(new Date().toLocaleTimeString());
    }
  }, [user, loading, hasToken, isClient]);

  // Only show in development (temporarily disabled for testing)
  // TODO: Re-enable this check after testing
  // if (process.env.NODE_ENV !== 'development') {
  //   return null;
  // }

  // Don't render until client hydration is complete
  if (!isClient) {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 20,
        right: 20,
        background: 'rgba(0, 0, 0, 0.8)',
        color: 'white',
        padding: 12,
        borderRadius: 8,
        fontSize: 12,
        fontFamily: 'monospace',
        maxWidth: 300,
        zIndex: 9999,
        border: '1px solid #333',
      }}
    >
      <div style={{ marginBottom: 8, fontWeight: 'bold', color: '#4ADE80' }}>
        🔐 Auth Debug Panel (ACTIVE)
      </div>

      <div style={{ marginBottom: 4 }}>
        <strong>Loading:</strong>{' '}
        <span style={{ color: loading ? '#F87171' : '#4ADE80' }}>
          {loading ? 'YES' : 'NO'}
        </span>
      </div>

      <div style={{ marginBottom: 4 }}>
        <strong>User:</strong>{' '}
        <span style={{ color: user ? '#4ADE80' : '#F87171' }}>
          {user ? user.email : 'NONE'}
        </span>
      </div>

      <div style={{ marginBottom: 4 }}>
        <strong>Token:</strong>{' '}
        <span style={{ color: hasToken ? '#4ADE80' : '#F87171' }}>
          {hasToken ? 'PRESENT' : 'MISSING'}
        </span>
      </div>

      {tokenPreview && (
        <div style={{ marginBottom: 4, fontSize: 10 }}>
          <strong>Preview:</strong>{' '}
          <span style={{ color: '#94A3B8' }}>{tokenPreview}...</span>
        </div>
      )}

      <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 8 }}>
        Last update: {lastUpdate}
      </div>
    </div>
  );
}
