import React, { useState, useEffect, useCallback } from 'react';
import { useAuth, useAuthDebug } from '@/features/auth/hooks/useAuth';
import { apiClient } from '@/shared/lib/api';

interface TokenStatusDebugProps {
  title?: string;
  showDetails?: boolean;
  refreshInterval?: number;
  className?: string;
}

interface TokenState {
  token: string | null;
  hasToken: boolean;
  tokenPreview: string | null;
  timestamp: string;
}

export default function TokenStatusDebug({
  title = 'Token Status Debug',
  showDetails = true,
  refreshInterval = 30000, // Reduced to prevent console spam
  className = '',
}: TokenStatusDebugProps) {
  const { user, loading } = useAuth();
  const authDebug = useAuthDebug();

  // Real-time token state
  const [realTimeTokenState, setRealTimeTokenState] = useState<TokenState>({
    token: null,
    hasToken: false,
    tokenPreview: null,
    timestamp: new Date().toISOString(),
  });

  const [tokenConsistency, setTokenConsistency] = useState<
    'Consistent' | 'Inconsistent' | 'Checking...' | 'Unknown'
  >('Unknown');
  const [lastConsistencyCheck, setLastConsistencyCheck] = useState<string>(
    new Date().toISOString()
  );

  // Get real-time token with minimal logging
  const getRealTimeToken = useCallback((): TokenState => {
    if (typeof window === 'undefined') {
      return {
        token: null,
        hasToken: false,
        tokenPreview: null,
        timestamp: new Date().toISOString(),
      };
    }

    const token = apiClient.getToken();
    return {
      token,
      hasToken: !!token,
      tokenPreview: token ? token.substring(0, 20) : null,
      timestamp: new Date().toISOString(),
    };
  }, []);

  // Check token consistency between auth context and real-time check
  const checkTokenConsistency = useCallback(() => {
    const realTimeState = getRealTimeToken();
    setRealTimeTokenState(realTimeState);

    // Compare the actual tokens, not previews or timestamps
    const authContextToken = authDebug.hasToken ? apiClient.getToken() : null;
    const realTimeToken = realTimeState.token;

    // Both should be null or both should be the same string
    let isConsistent: boolean;
    if (authContextToken === null && realTimeToken === null) {
      isConsistent = true; // Both null = consistent
    } else if (authContextToken === null || realTimeToken === null) {
      isConsistent = false; // One null, one not null = inconsistent
    } else {
      isConsistent = authContextToken === realTimeToken; // Compare actual token strings
    }

    setTokenConsistency(isConsistent ? 'Consistent' : 'Inconsistent');
    setLastConsistencyCheck(new Date().toISOString());

    // Only log when inconsistency is detected
    if (!isConsistent && process.env.NODE_ENV === 'development') {
      console.warn('TokenStatusDebug: Token inconsistency detected', {
        authContextHasToken: authDebug.hasToken,
        realTimeHasToken: realTimeState.hasToken,
        authContextPreview: authDebug.tokenPreview,
        realTimePreview: realTimeState.tokenPreview,
        tokensMatch: authContextToken === realTimeToken,
        timestamp: new Date().toISOString(),
      });
    }
  }, [authDebug.hasToken, authDebug.tokenPreview, getRealTimeToken]);

  // Set up polling with proper cleanup
  useEffect(() => {
    // Initial check
    checkTokenConsistency();

    // Set up interval if refreshInterval is provided
    if (refreshInterval > 0) {
      const interval = setInterval(checkTokenConsistency, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [checkTokenConsistency, refreshInterval]);

  // Listen for auth context changes
  useEffect(() => {
    checkTokenConsistency();
  }, [authDebug.hasToken, authDebug.tokenPreview, checkTokenConsistency]);

  const statusColor =
    tokenConsistency === 'Consistent'
      ? 'text-green-600'
      : tokenConsistency === 'Inconsistent'
        ? 'text-red-600'
        : 'text-yellow-600';

  const borderColor =
    tokenConsistency === 'Consistent'
      ? 'border-green-200'
      : tokenConsistency === 'Inconsistent'
        ? 'border-red-200'
        : 'border-yellow-200';

  const bgColor =
    tokenConsistency === 'Consistent'
      ? 'bg-green-50'
      : tokenConsistency === 'Inconsistent'
        ? 'bg-red-50'
        : 'bg-yellow-50';

  return (
    <div
      className={`${bgColor} border ${borderColor} rounded-lg p-4 ${className}`}
    >
      <h3 className="font-semibold text-gray-900 mb-3">{title}</h3>

      {/* Status Overview */}
      <div className="space-y-2 mb-4">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-gray-700">
            Token Status:
          </span>
          <span className={`text-sm font-medium ${statusColor}`}>
            {authDebug.hasToken ? 'Present' : 'Missing'}
          </span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-gray-700">
            User Status:
          </span>
          <span className="text-sm font-medium text-gray-900">
            {loading
              ? 'Loading...'
              : user
                ? 'Authenticated'
                : 'Not Authenticated'}
          </span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-gray-700">
            Token Consistency:
          </span>
          <span className={`text-sm font-medium ${statusColor}`}>
            {tokenConsistency}
          </span>
        </div>
      </div>

      {showDetails && (
        <div className="border-t border-gray-200 pt-3">
          <h4 className="text-sm font-medium text-gray-700 mb-2">
            Debug Details:
          </h4>
          <div className="space-y-1 text-xs text-gray-600">
            <div className="flex justify-between">
              <span>Auth Context Token:</span>
              <span className="font-mono">
                {authDebug.tokenPreview || 'None'}
              </span>
            </div>

            <div className="flex justify-between">
              <span>Real-time Token:</span>
              <span className="font-mono">
                {realTimeTokenState.tokenPreview || 'None'}
              </span>
            </div>

            <div className="flex justify-between">
              <span>Token Status:</span>
              <span>{authDebug.tokenStatus}</span>
            </div>

            <div className="flex justify-between">
              <span>Auth Context Updated:</span>
              <span>
                {new Date(authDebug.lastChecked).toLocaleTimeString()}
              </span>
            </div>

            <div className="flex justify-between">
              <span>Real-time Updated:</span>
              <span>
                {new Date(realTimeTokenState.timestamp).toLocaleTimeString()}
              </span>
            </div>

            <div className="flex justify-between">
              <span>Consistency Check:</span>
              <span>{new Date(lastConsistencyCheck).toLocaleTimeString()}</span>
            </div>

            {refreshInterval > 0 && (
              <div className="flex justify-between">
                <span>Refresh Interval:</span>
                <span>{refreshInterval}ms</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
