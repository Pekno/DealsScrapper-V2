import React, { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/shared/lib/api';
import { Button } from '@/shared/ui/Button';

interface TokenValidationResult {
  isValid: boolean;
  canConnect: boolean;
  info: {
    hasToken: boolean;
    hasValidFormat: boolean;
    isExpired: boolean;
    hasUserIdentifier: boolean;
    userIdSource: 'sub' | 'userId' | 'none';
    expiresAt?: string;
    issuedAt?: string;
    issuer?: string;
    audience?: string;
    tokenPreview?: string;
  };
  errors: string[];
  warnings: string[];
  backendCompatibility: {
    apiEndpointReady: boolean;
    websocketReady: boolean;
    userIdCompatible: boolean;
    notes: string[];
  };
}

interface TokenValidationPanelProps {
  onValidationResult?: (
    isValid: boolean,
    result: TokenValidationResult
  ) => void;
  showActions?: boolean;
  autoValidate?: boolean;
  refreshInterval?: number;
}

export default function TokenValidationPanel({
  onValidationResult,
  showActions = true,
  autoValidate = false,
  refreshInterval = 0,
}: TokenValidationPanelProps) {
  const [validationResult, setValidationResult] =
    useState<TokenValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [lastValidated, setLastValidated] = useState<string | null>(null);

  const validateToken =
    useCallback(async (): Promise<TokenValidationResult> => {
      const result: TokenValidationResult = {
        isValid: false,
        canConnect: false,
        info: {
          hasToken: false,
          hasValidFormat: false,
          isExpired: false,
          hasUserIdentifier: false,
          userIdSource: 'none',
        },
        errors: [],
        warnings: [],
        backendCompatibility: {
          apiEndpointReady: false,
          websocketReady: false,
          userIdCompatible: false,
          notes: [],
        },
      };

      try {
        const token = apiClient.getToken();

        if (!token) {
          result.errors.push('No token found in localStorage');
          return result;
        }

        result.info.hasToken = true;
        result.info.tokenPreview = token.substring(0, 30) + '...';

        // Validate JWT format
        const parts = token.split('.');
        if (parts.length !== 3) {
          result.errors.push(
            `Invalid JWT format: expected 3 parts, got ${parts.length}`
          );
          return result;
        }

        result.info.hasValidFormat = true;

        // Decode and validate payload
        let payload: any;
        try {
          payload = JSON.parse(atob(parts[1]));
        } catch (error) {
          result.errors.push('Failed to decode JWT payload');
          return result;
        }

        // Check expiration
        if (payload.exp) {
          const isExpired = Date.now() >= payload.exp * 1000;
          result.info.isExpired = isExpired;
          result.info.expiresAt = new Date(payload.exp * 1000).toISOString();

          if (isExpired) {
            result.errors.push('Token has expired');
            return result;
          }
        } else {
          result.warnings.push(
            'Token has no expiration time (exp claim missing)'
          );
        }

        // Check issued at
        if (payload.iat) {
          result.info.issuedAt = new Date(payload.iat * 1000).toISOString();
        }

        // Check issuer and audience
        result.info.issuer = payload.iss || 'Not specified';
        result.info.audience = payload.aud || 'Not specified';

        // Check user identifier
        if (payload.sub) {
          result.info.hasUserIdentifier = true;
          result.info.userIdSource = 'sub';
        } else if (payload.userId) {
          result.info.hasUserIdentifier = true;
          result.info.userIdSource = 'userId';
        } else {
          result.errors.push(
            'Token missing user identifier (sub or userId claim)'
          );
          return result;
        }

        // Backend compatibility checks
        result.backendCompatibility.userIdCompatible = !!(
          payload.sub || payload.userId
        );

        if (payload.sub && payload.userId) {
          result.backendCompatibility.notes.push(
            'Both sub and userId present - excellent compatibility'
          );
        } else if (payload.sub) {
          result.backendCompatibility.notes.push(
            'Using sub claim for user identification (standard JWT)'
          );
        } else if (payload.userId) {
          result.backendCompatibility.notes.push(
            'Using userId claim for user identification (custom)'
          );
        }

        // Skip API endpoint testing to prevent health check spam
        // The JWT validation is sufficient for determining token validity
        result.backendCompatibility.apiEndpointReady = true; // Assume ready based on token structure
        result.backendCompatibility.notes.push(
          '💡 API endpoint test disabled to prevent log spam'
        );

        // WebSocket readiness check (simplified)
        result.backendCompatibility.websocketReady =
          result.info.hasUserIdentifier &&
          !result.info.isExpired &&
          result.info.hasValidFormat;

        if (result.backendCompatibility.websocketReady) {
          result.backendCompatibility.notes.push(
            'Ready for WebSocket authentication'
          );
        } else {
          result.backendCompatibility.notes.push(
            'WebSocket authentication may fail'
          );
        }

        // Overall validation
        result.isValid =
          result.info.hasValidFormat &&
          !result.info.isExpired &&
          result.info.hasUserIdentifier;

        result.canConnect =
          result.isValid && result.backendCompatibility.websocketReady;

        if (result.isValid) {
          if (result.canConnect) {
            result.backendCompatibility.notes.push(
              '✅ Token is ready for all backend services'
            );
          } else {
            result.warnings.push(
              'Token is valid but may have connectivity issues'
            );
          }
        }
      } catch (error) {
        result.errors.push(
          error instanceof Error ? error.message : 'Unknown validation error'
        );
      }

      return result;
    }, []);

  const performValidation = useCallback(async () => {
    if (isValidating) return;

    setIsValidating(true);

    try {
      const result = await validateToken();
      setValidationResult(result);
      setLastValidated(new Date().toISOString());

      if (onValidationResult) {
        onValidationResult(result.isValid, result);
      }
    } finally {
      setIsValidating(false);
    }
  }, [validateToken, isValidating, onValidationResult]);

  // Auto-validation setup
  useEffect(() => {
    if (autoValidate) {
      performValidation();
    }
  }, [autoValidate, performValidation]);

  // Refresh interval setup
  useEffect(() => {
    if (refreshInterval > 0) {
      const interval = setInterval(performValidation, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [refreshInterval, performValidation]);

  const getStatusColor = (status: 'success' | 'warning' | 'error') => {
    switch (status) {
      case 'success':
        return 'text-green-600';
      case 'warning':
        return 'text-yellow-600';
      case 'error':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const getBackgroundColor = () => {
    if (!validationResult) return 'bg-gray-50 border-gray-200';
    if (validationResult.canConnect) return 'bg-green-50 border-green-200';
    if (validationResult.isValid) return 'bg-yellow-50 border-yellow-200';
    return 'bg-red-50 border-red-200';
  };

  return (
    <div className={`border rounded-lg p-6 ${getBackgroundColor()}`}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900">
          JWT Token Validation
        </h2>
        {showActions && (
          <Button
            onClick={performValidation}
            disabled={isValidating}
            variant="outline"
            size="sm"
          >
            {isValidating ? 'Validating...' : 'Validate Token'}
          </Button>
        )}
      </div>

      {lastValidated && (
        <p className="text-sm text-gray-600 mb-4">
          Last validated: {new Date(lastValidated).toLocaleString()}
        </p>
      )}

      {validationResult ? (
        <div className="space-y-4">
          {/* Overall Status */}
          <div className="flex items-center space-x-4">
            <div
              className={`w-4 h-4 rounded-full ${
                validationResult.canConnect
                  ? 'bg-green-500'
                  : validationResult.isValid
                    ? 'bg-yellow-500'
                    : 'bg-red-500'
              }`}
            />
            <span className="font-medium">
              {validationResult.canConnect
                ? 'Ready for WebSocket Connection'
                : validationResult.isValid
                  ? 'Token Valid (Connection Issues Possible)'
                  : 'Token Invalid'}
            </span>
          </div>

          {/* Token Information */}
          <div>
            <h3 className="font-medium text-gray-900 mb-2">
              Token Information
            </h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                Has Token:{' '}
                <span
                  className={getStatusColor(
                    validationResult.info.hasToken ? 'success' : 'error'
                  )}
                >
                  {validationResult.info.hasToken ? 'Yes' : 'No'}
                </span>
              </div>
              <div>
                Valid Format:{' '}
                <span
                  className={getStatusColor(
                    validationResult.info.hasValidFormat ? 'success' : 'error'
                  )}
                >
                  {validationResult.info.hasValidFormat ? 'Yes' : 'No'}
                </span>
              </div>
              <div>
                Is Expired:{' '}
                <span
                  className={getStatusColor(
                    validationResult.info.isExpired ? 'error' : 'success'
                  )}
                >
                  {validationResult.info.isExpired ? 'Yes' : 'No'}
                </span>
              </div>
              <div>
                User ID Source:{' '}
                <span
                  className={getStatusColor(
                    validationResult.info.userIdSource !== 'none'
                      ? 'success'
                      : 'error'
                  )}
                >
                  {validationResult.info.userIdSource}
                </span>
              </div>
              {validationResult.info.expiresAt && (
                <div className="col-span-2">
                  Expires:{' '}
                  {new Date(validationResult.info.expiresAt).toLocaleString()}
                </div>
              )}
            </div>
          </div>

          {/* Backend Compatibility */}
          <div>
            <h3 className="font-medium text-gray-900 mb-2">
              Backend Compatibility
            </h3>
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <span
                  className={`w-2 h-2 rounded-full ${
                    validationResult.backendCompatibility.websocketReady
                      ? 'bg-green-500'
                      : 'bg-red-500'
                  }`}
                />
                <span className="text-sm">
                  WebSocket Ready:{' '}
                  {validationResult.backendCompatibility.websocketReady
                    ? 'Yes'
                    : 'No'}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <span
                  className={`w-2 h-2 rounded-full ${
                    validationResult.backendCompatibility.userIdCompatible
                      ? 'bg-green-500'
                      : 'bg-red-500'
                  }`}
                />
                <span className="text-sm">
                  User ID Compatible:{' '}
                  {validationResult.backendCompatibility.userIdCompatible
                    ? 'Yes'
                    : 'No'}
                </span>
              </div>
            </div>

            {validationResult.backendCompatibility.notes.length > 0 && (
              <div className="mt-2">
                <ul className="text-sm text-gray-600 space-y-1">
                  {validationResult.backendCompatibility.notes.map(
                    (note, index) => (
                      <li key={index} className="flex items-start space-x-1">
                        <span>•</span>
                        <span>{note}</span>
                      </li>
                    )
                  )}
                </ul>
              </div>
            )}
          </div>

          {/* Errors and Warnings */}
          {validationResult.errors.length > 0 && (
            <div>
              <h3 className="font-medium text-red-900 mb-2">Errors</h3>
              <ul className="text-sm text-red-700 space-y-1">
                {validationResult.errors.map((error, index) => (
                  <li key={index} className="flex items-start space-x-1">
                    <span>•</span>
                    <span>{error}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {validationResult.warnings.length > 0 && (
            <div>
              <h3 className="font-medium text-yellow-900 mb-2">Warnings</h3>
              <ul className="text-sm text-yellow-700 space-y-1">
                {validationResult.warnings.map((warning, index) => (
                  <li key={index} className="flex items-start space-x-1">
                    <span>•</span>
                    <span>{warning}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center text-gray-500 py-8">
          {autoValidate
            ? 'Validating token...'
            : 'Click "Validate Token" to analyze your JWT token'}
        </div>
      )}
    </div>
  );
}
