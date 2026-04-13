import React, { useState, useEffect } from 'react';
import { websocketService } from '@/shared/lib/websocket';
import { useAuth } from '@/features/auth/hooks/useAuth';
import {
  decodeJWT,
  generateJWTReport,
  isJWTExpired,
  extractUserIdFromJWT,
  createMockJWT,
  debugJWT,
  type JWTAnalysis,
} from '@/shared/lib/jwt-debug';

interface WebSocketDebugInfo {
  isConnected: boolean;
  connectionAttempts: number;
  lastError: string | null;
  tokenInfo: {
    hasToken: boolean;
    tokenLength: number | null;
    tokenFormat: string | null;
    isValidJWT: boolean;
  } | null;
  jwtAnalysis: JWTAnalysis | null;
  events: Array<{
    timestamp: string;
    type: string;
    data: any;
  }>;
}

export default function WebSocketDebug() {
  const { user } = useAuth();
  const [debugInfo, setDebugInfo] = useState<WebSocketDebugInfo>({
    isConnected: false,
    connectionAttempts: 0,
    lastError: null,
    tokenInfo: null,
    jwtAnalysis: null,
    events: [],
  });

  const [isManualMode, setIsManualMode] = useState(false);
  const [showJWTDetails, setShowJWTDetails] = useState(false);
  const [showJWTReport, setShowJWTReport] = useState(false);
  const [customTokenInput, setCustomTokenInput] = useState('');

  const addEvent = (type: string, data: any) => {
    setDebugInfo((prev) => ({
      ...prev,
      events: [
        {
          timestamp: new Date().toISOString(),
          type,
          data,
        },
        ...prev.events.slice(0, 19), // Keep last 20 events
      ],
    }));
  };

  const analyzeToken = (tokenOverride?: string) => {
    try {
      const token = tokenOverride || localStorage.getItem('auth_token');
      if (!token) {
        setDebugInfo((prev) => ({
          ...prev,
          jwtAnalysis: null,
        }));
        return {
          hasToken: false,
          tokenLength: null,
          tokenFormat: null,
          isValidJWT: false,
        };
      }

      // Use comprehensive JWT analysis
      const analysis = decodeJWT(token);

      // Store the detailed analysis
      setDebugInfo((prev) => ({
        ...prev,
        jwtAnalysis: analysis,
      }));

      // Debug log the token for development
      debugJWT(token, 'WebSocket Debug Token');

      const parts = token.split('.');
      let tokenFormat = 'unknown';

      if (parts.length === 3) {
        if (analysis.header?.alg) {
          tokenFormat = `JWT (alg: ${analysis.header.alg})`;
          if (analysis.info.isExpired) {
            tokenFormat += ' (EXPIRED)';
          }
        } else {
          tokenFormat = 'JWT (no algorithm)';
        }
      } else {
        tokenFormat = `${parts.length} parts (should be 3)`;
      }

      // Log comprehensive analysis
      addEvent('COMPREHENSIVE_TOKEN_ANALYSIS', {
        analysis: {
          valid: analysis.valid,
          hasValidFormat: analysis.info.hasValidFormat,
          hasUserIdentifier: analysis.info.hasUserIdentifier,
          userIdSource: analysis.info.userIdSource,
          userId: analysis.info.userId,
          isExpired: analysis.info.isExpired,
          timeUntilExpiry: analysis.info.timeUntilExpiry,
          tokenLength: analysis.info.tokenLength,
          errors: analysis.errors,
          warnings: analysis.warnings,
        },
        header: analysis.header,
        payload: analysis.payload,
        backendCompatibility: {
          hasSubClaim: !!analysis.payload?.sub,
          hasUserIdClaim: !!analysis.payload?.userId,
          recommendation: analysis.payload?.sub
            ? 'Backend should use "sub" claim (standard JWT)'
            : analysis.payload?.userId
              ? 'Backend should use "userId" claim (legacy)'
              : 'Token missing user identifier - authentication will fail',
        },
      });

      return {
        hasToken: true,
        tokenLength: token.length,
        tokenFormat,
        isValidJWT: analysis.valid,
      };
    } catch (error) {
      addEvent('TOKEN_ANALYSIS_ERROR', error);
      return {
        hasToken: false,
        tokenLength: null,
        tokenFormat: 'error reading token',
        isValidJWT: false,
      };
    }
  };

  const connectWebSocket = () => {
    addEvent('CONNECT_ATTEMPT', { manual: isManualMode });

    // Prevalidate token before attempting connection
    const shouldProceed = prevalidateBeforeConnection();

    if (!shouldProceed) {
      addEvent('CONNECTION_ABORTED', {
        reason: 'Token prevalidation failed',
        suggestion: 'Check token analysis for issues before connecting',
      });
      // Still allow connection for testing purposes, but warn user
    }

    setDebugInfo((prev) => ({
      ...prev,
      connectionAttempts: prev.connectionAttempts + 1,
      tokenInfo: analyzeToken(),
    }));

    websocketService.setHandlers({
      onConnect: () => {
        addEvent('WS_CONNECTED', {});
        setDebugInfo((prev) => ({
          ...prev,
          isConnected: true,
          lastError: null,
        }));
      },
      onDisconnect: () => {
        addEvent('WS_DISCONNECTED', {});
        setDebugInfo((prev) => ({ ...prev, isConnected: false }));
      },
      onError: (error) => {
        addEvent('WS_ERROR', { message: error.message });
        setDebugInfo((prev) => ({ ...prev, lastError: error.message }));
      },
      onNotification: (notification) => {
        addEvent('WS_NOTIFICATION', notification);
      },
    });

    websocketService.connect();
  };

  const disconnectWebSocket = () => {
    addEvent('DISCONNECT_MANUAL', {});
    websocketService.disconnect();
    setDebugInfo((prev) => ({ ...prev, isConnected: false }));
  };

  const testNotification = () => {
    addEvent('TEST_NOTIFICATION_REQUEST', {});
    websocketService.requestTestNotification();
  };

  const manualAuth = () => {
    addEvent('MANUAL_AUTH_ATTEMPT', {});
    websocketService.authenticate();
  };

  const testTokenWithAPI = async () => {
    addEvent('API_TOKEN_TEST_START', {});

    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        addEvent('API_TOKEN_TEST_ERROR', { error: 'No token found' });
        return;
      }

      // Test token with API endpoint
      const response = await fetch('http://localhost:3001/users/profile', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      addEvent('API_TOKEN_TEST_RESULT', {
        status: response.status,
        statusText: response.statusText,
        success: response.ok,
        result: result,
      });
    } catch (error) {
      addEvent('API_TOKEN_TEST_ERROR', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  const testCustomToken = () => {
    if (!customTokenInput.trim()) {
      addEvent('CUSTOM_TOKEN_TEST_ERROR', { error: 'No token provided' });
      return;
    }

    addEvent('CUSTOM_TOKEN_TEST_START', {
      tokenLength: customTokenInput.length,
    });

    const analysis = analyzeToken(customTokenInput);

    addEvent('CUSTOM_TOKEN_TEST_RESULT', {
      analysis,
      recommendation: analysis.isValidJWT
        ? 'Token appears valid for WebSocket authentication'
        : 'Token has issues and will likely fail WebSocket authentication',
    });
  };

  const createAndTestMockToken = () => {
    const mockToken = createMockJWT({
      sub: user?.id || 'mock-user-id',
      email: user?.email || 'mock@example.com',
      emailVerified: true,
    });

    setCustomTokenInput(mockToken);

    addEvent('MOCK_TOKEN_CREATED', {
      tokenLength: mockToken.length,
      userId: user?.id || 'mock-user-id',
      email: user?.email || 'mock@example.com',
    });

    // Auto-analyze the mock token
    setTimeout(() => analyzeToken(mockToken), 100);
  };

  const generateDetailedJWTReport = () => {
    const token = customTokenInput.trim() || localStorage.getItem('auth_token');
    if (!token) {
      addEvent('JWT_REPORT_ERROR', { error: 'No token available' });
      return;
    }

    const report = generateJWTReport(token);

    addEvent('JWT_DETAILED_REPORT', {
      report,
      timestamp: new Date().toISOString(),
    });
  };

  const prevalidateBeforeConnection = () => {
    const token = localStorage.getItem('auth_token');

    if (!token) {
      addEvent('PREVALIDATION_FAILED', { error: 'No token found' });
      return false;
    }

    const analysis = decodeJWT(token);

    addEvent('PREVALIDATION_RESULTS', {
      hasValidFormat: analysis.info.hasValidFormat,
      hasUserIdentifier: analysis.info.hasUserIdentifier,
      isExpired: analysis.info.isExpired,
      errors: analysis.errors,
      warnings: analysis.warnings,
      recommendation: analysis.valid
        ? 'Token should work for WebSocket authentication'
        : 'Token will likely fail WebSocket authentication',
      shouldProceed:
        analysis.valid &&
        !analysis.info.isExpired &&
        analysis.info.hasUserIdentifier,
    });

    return (
      analysis.valid &&
      !analysis.info.isExpired &&
      analysis.info.hasUserIdentifier
    );
  };

  useEffect(() => {
    // Initial token analysis
    setDebugInfo((prev) => ({
      ...prev,
      tokenInfo: analyzeToken(),
      isConnected: websocketService.isSocketConnected(),
    }));
  }, [user]);

  return (
    <div className="p-6 bg-gray-50 rounded-lg space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">
          WebSocket Debug Console
        </h2>
        <div className="flex items-center space-x-2">
          <div
            className={`w-3 h-3 rounded-full ${
              debugInfo.isConnected ? 'bg-green-500' : 'bg-red-500'
            }`}
          />
          <span className="text-sm text-gray-600">
            {debugInfo.isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>

      {/* Connection Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded border">
          <h3 className="font-semibold text-gray-800 mb-2">
            Connection Status
          </h3>
          <div className="space-y-1 text-sm">
            <div>
              Status:{' '}
              <span
                className={`font-medium ${
                  debugInfo.isConnected ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {debugInfo.isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            <div>
              Attempts:{' '}
              <span className="font-medium">
                {debugInfo.connectionAttempts}
              </span>
            </div>
            {debugInfo.lastError && (
              <div className="text-red-600">Error: {debugInfo.lastError}</div>
            )}
          </div>
        </div>

        <div className="bg-white p-4 rounded border">
          <h3 className="font-semibold text-gray-800 mb-2">Token Analysis</h3>
          {debugInfo.tokenInfo ? (
            <div className="space-y-1 text-sm">
              <div>
                Has Token:{' '}
                <span
                  className={`font-medium ${
                    debugInfo.tokenInfo.hasToken
                      ? 'text-green-600'
                      : 'text-red-600'
                  }`}
                >
                  {debugInfo.tokenInfo.hasToken ? 'Yes' : 'No'}
                </span>
              </div>
              {debugInfo.tokenInfo.hasToken && (
                <>
                  <div>
                    Length:{' '}
                    <span className="font-medium">
                      {debugInfo.tokenInfo.tokenLength}
                    </span>
                  </div>
                  <div>
                    Format:{' '}
                    <span className="font-medium">
                      {debugInfo.tokenInfo.tokenFormat}
                    </span>
                  </div>
                  <div>
                    Valid JWT:{' '}
                    <span
                      className={`font-medium ${
                        debugInfo.tokenInfo.isValidJWT
                          ? 'text-green-600'
                          : 'text-red-600'
                      }`}
                    >
                      {debugInfo.tokenInfo.isValidJWT ? 'Yes' : 'No'}
                    </span>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="text-gray-500 text-sm">Analyzing...</div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white p-4 rounded border">
        <h3 className="font-semibold text-gray-800 mb-3">Controls</h3>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={connectWebSocket}
            disabled={debugInfo.isConnected}
            className="px-4 py-2 bg-blue-600 text-white rounded disabled:bg-gray-400 disabled:cursor-not-allowed hover:bg-blue-700"
          >
            Connect WebSocket
          </button>
          <button
            onClick={disconnectWebSocket}
            disabled={!debugInfo.isConnected}
            className="px-4 py-2 bg-red-600 text-white rounded disabled:bg-gray-400 disabled:cursor-not-allowed hover:bg-red-700"
          >
            Disconnect
          </button>
          <button
            onClick={manualAuth}
            disabled={!debugInfo.isConnected}
            className="px-4 py-2 bg-yellow-600 text-white rounded disabled:bg-gray-400 disabled:cursor-not-allowed hover:bg-yellow-700"
          >
            Manual Auth
          </button>
          <button
            onClick={testNotification}
            disabled={!debugInfo.isConnected}
            className="px-4 py-2 bg-green-600 text-white rounded disabled:bg-gray-400 disabled:cursor-not-allowed hover:bg-green-700"
          >
            Test Notification
          </button>
          <button
            onClick={testTokenWithAPI}
            className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
          >
            Test Token vs API
          </button>
          <button
            onClick={() => setDebugInfo((prev) => ({ ...prev, events: [] }))}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
          >
            Clear Events
          </button>
        </div>
      </div>

      {/* JWT Debug Controls */}
      <div className="bg-white p-4 rounded border">
        <h3 className="font-semibold text-gray-800 mb-3">
          JWT Debugging Tools
        </h3>
        <div className="space-y-4">
          {/* Token Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Test Custom Token
            </label>
            <textarea
              value={customTokenInput}
              onChange={(e) => setCustomTokenInput(e.target.value)}
              placeholder="Paste JWT token here to analyze..."
              className="w-full p-3 border border-gray-300 rounded-md text-sm font-mono resize-y"
              rows={3}
            />
          </div>

          {/* JWT Controls */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={testCustomToken}
              disabled={!customTokenInput.trim()}
              className="px-4 py-2 bg-indigo-600 text-white rounded disabled:bg-gray-400 disabled:cursor-not-allowed hover:bg-indigo-700"
            >
              Analyze Custom Token
            </button>
            <button
              onClick={createAndTestMockToken}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              Create Mock Token
            </button>
            <button
              onClick={generateDetailedJWTReport}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Generate JWT Report
            </button>
            <button
              onClick={prevalidateBeforeConnection}
              className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700"
            >
              Prevalidate Token
            </button>
            <button
              onClick={() => setShowJWTDetails(!showJWTDetails)}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              {showJWTDetails ? 'Hide' : 'Show'} JWT Details
            </button>
          </div>
        </div>
      </div>

      {/* Detailed JWT Analysis */}
      {showJWTDetails && debugInfo.jwtAnalysis && (
        <div className="bg-white p-4 rounded border">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-800">
              Detailed JWT Analysis
            </h3>
            <button
              onClick={() => setShowJWTReport(!showJWTReport)}
              className="px-3 py-1 bg-blue-100 text-blue-700 rounded text-sm hover:bg-blue-200"
            >
              {showJWTReport ? 'Hide' : 'Show'} Full Report
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            {/* Validation Status */}
            <div className="p-3 bg-gray-50 rounded">
              <h4 className="font-medium text-gray-800 mb-2">
                Validation Status
              </h4>
              <div className="space-y-1 text-sm">
                <div>
                  Valid:{' '}
                  <span
                    className={`font-medium ${
                      debugInfo.jwtAnalysis.valid
                        ? 'text-green-600'
                        : 'text-red-600'
                    }`}
                  >
                    {debugInfo.jwtAnalysis.valid ? 'Yes' : 'No'}
                  </span>
                </div>
                <div>
                  Format:{' '}
                  <span
                    className={`font-medium ${
                      debugInfo.jwtAnalysis.info.hasValidFormat
                        ? 'text-green-600'
                        : 'text-red-600'
                    }`}
                  >
                    {debugInfo.jwtAnalysis.info.hasValidFormat
                      ? 'Valid'
                      : 'Invalid'}
                  </span>
                </div>
                <div>
                  Expired:{' '}
                  <span
                    className={`font-medium ${
                      debugInfo.jwtAnalysis.info.isExpired
                        ? 'text-red-600'
                        : 'text-green-600'
                    }`}
                  >
                    {debugInfo.jwtAnalysis.info.isExpired ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>
            </div>

            {/* User Identification */}
            <div className="p-3 bg-gray-50 rounded">
              <h4 className="font-medium text-gray-800 mb-2">
                User ID Analysis
              </h4>
              <div className="space-y-1 text-sm">
                <div>
                  Has User ID:{' '}
                  <span
                    className={`font-medium ${
                      debugInfo.jwtAnalysis.info.hasUserIdentifier
                        ? 'text-green-600'
                        : 'text-red-600'
                    }`}
                  >
                    {debugInfo.jwtAnalysis.info.hasUserIdentifier
                      ? 'Yes'
                      : 'No'}
                  </span>
                </div>
                <div>
                  Source:{' '}
                  <span className="font-medium text-gray-700">
                    {debugInfo.jwtAnalysis.info.userIdSource}
                  </span>
                </div>
                {debugInfo.jwtAnalysis.info.userId && (
                  <div>
                    User ID:{' '}
                    <span className="font-medium text-gray-700 break-all">
                      {debugInfo.jwtAnalysis.info.userId}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Timing Info */}
            <div className="p-3 bg-gray-50 rounded">
              <h4 className="font-medium text-gray-800 mb-2">Timing Info</h4>
              <div className="space-y-1 text-sm">
                {debugInfo.jwtAnalysis.info.issuedAt && (
                  <div>
                    Issued:{' '}
                    <span className="font-medium text-gray-700">
                      {new Date(
                        debugInfo.jwtAnalysis.info.issuedAt
                      ).toLocaleString()}
                    </span>
                  </div>
                )}
                {debugInfo.jwtAnalysis.info.expiresAt && (
                  <div>
                    Expires:{' '}
                    <span className="font-medium text-gray-700">
                      {new Date(
                        debugInfo.jwtAnalysis.info.expiresAt
                      ).toLocaleString()}
                    </span>
                  </div>
                )}
                {debugInfo.jwtAnalysis.info.timeUntilExpiry &&
                  !debugInfo.jwtAnalysis.info.isExpired && (
                    <div>
                      Time Left:{' '}
                      <span className="font-medium text-green-600">
                        {debugInfo.jwtAnalysis.info.timeUntilExpiry}
                      </span>
                    </div>
                  )}
              </div>
            </div>
          </div>

          {/* Errors and Warnings */}
          {(debugInfo.jwtAnalysis.errors.length > 0 ||
            debugInfo.jwtAnalysis.warnings.length > 0) && (
            <div className="mb-4">
              {debugInfo.jwtAnalysis.errors.length > 0 && (
                <div className="mb-2">
                  <h4 className="font-medium text-red-800 mb-1">Errors:</h4>
                  <div className="space-y-1">
                    {debugInfo.jwtAnalysis.errors.map((error, index) => (
                      <div
                        key={index}
                        className="text-sm text-red-600 bg-red-50 p-2 rounded"
                      >
                        ❌ {error}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {debugInfo.jwtAnalysis.warnings.length > 0 && (
                <div>
                  <h4 className="font-medium text-yellow-800 mb-1">
                    Warnings:
                  </h4>
                  <div className="space-y-1">
                    {debugInfo.jwtAnalysis.warnings.map((warning, index) => (
                      <div
                        key={index}
                        className="text-sm text-yellow-600 bg-yellow-50 p-2 rounded"
                      >
                        ⚠️ {warning}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Backend Compatibility Check */}
          <div className="p-3 bg-blue-50 rounded">
            <h4 className="font-medium text-blue-800 mb-2">
              Backend Compatibility
            </h4>
            <div className="text-sm space-y-1">
              <div>
                Has 'sub' claim:{' '}
                <span
                  className={`font-medium ${
                    debugInfo.jwtAnalysis.payload?.sub
                      ? 'text-green-600'
                      : 'text-red-600'
                  }`}
                >
                  {debugInfo.jwtAnalysis.payload?.sub ? 'Yes ✅' : 'No ❌'}
                </span>
              </div>
              <div>
                Has 'userId' claim:{' '}
                <span
                  className={`font-medium ${
                    debugInfo.jwtAnalysis.payload?.userId
                      ? 'text-green-600'
                      : 'text-red-600'
                  }`}
                >
                  {debugInfo.jwtAnalysis.payload?.userId ? 'Yes ✅' : 'No ❌'}
                </span>
              </div>
              <div className="mt-2 p-2 bg-blue-100 rounded">
                <strong>Recommendation:</strong>{' '}
                {debugInfo.jwtAnalysis.payload?.sub
                  ? 'Backend should use "sub" claim (standard JWT) ✅'
                  : debugInfo.jwtAnalysis.payload?.userId
                    ? 'Backend should use "userId" claim (legacy) ⚠️'
                    : 'Token missing user identifier - authentication will fail ❌'}
              </div>
            </div>
          </div>

          {/* Full JWT Report */}
          {showJWTReport && (
            <div className="mt-4">
              <h4 className="font-medium text-gray-800 mb-2">
                Complete JWT Report
              </h4>
              <pre className="bg-gray-100 p-4 rounded text-xs overflow-x-auto whitespace-pre-wrap font-mono">
                {generateJWTReport(
                  localStorage.getItem('auth_token') || customTokenInput
                )}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Event Log */}
      <div className="bg-white p-4 rounded border">
        <h3 className="font-semibold text-gray-800 mb-3">Event Log</h3>
        <div className="max-h-96 overflow-y-auto space-y-2">
          {debugInfo.events.length === 0 ? (
            <div className="text-gray-500 text-sm">No events logged yet</div>
          ) : (
            debugInfo.events.map((event, index) => (
              <div key={index} className="p-2 bg-gray-50 rounded text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-blue-600">
                    {event.type}
                  </span>
                  <span className="text-gray-500 text-xs">
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                {event.data && (
                  <pre className="mt-1 text-xs text-gray-700 overflow-x-auto">
                    {JSON.stringify(event.data, null, 2)}
                  </pre>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* User Info */}
      <div className="bg-white p-4 rounded border">
        <h3 className="font-semibold text-gray-800 mb-2">User Context</h3>
        <div className="text-sm">
          {user ? (
            <div className="space-y-1">
              <div>
                Email: <span className="font-medium">{user.email}</span>
              </div>
              <div>
                User ID: <span className="font-medium">{user.id}</span>
              </div>
              <div>
                Authenticated:{' '}
                <span className="text-green-600 font-medium">Yes</span>
              </div>
            </div>
          ) : (
            <div className="text-red-600">Not authenticated</div>
          )}
        </div>
      </div>
    </div>
  );
}
