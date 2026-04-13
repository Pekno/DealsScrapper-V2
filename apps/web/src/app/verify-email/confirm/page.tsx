import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { Button } from '@/shared/ui/Button';
import { apiClient } from '@/shared/lib/api';
import { dataCy } from '@/shared/lib/test-utils';

function ConfirmEmailContent() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { refreshUser } = useAuth();

  const [status, setStatus] = useState<
    'verifying' | 'success' | 'error' | 'expired'
  >('verifying');
  const [message, setMessage] = useState<string>('');
  const [hasVerified, setHasVerified] = useState(false);

  useEffect(() => {
    const token = searchParams.get('token');

    // Prevent multiple verification attempts
    if (!token || hasVerified) {
      if (!token) {
        // No token provided - redirect to login instead of showing error
        navigate('/login');
        return;
      }
      return;
    }

    const verifyEmail = async () => {
      try {
        setHasVerified(true); // Prevent multiple attempts

        const response = await apiClient.verifyEmail(token);

        if (response.success) {
          setStatus('success');
          setMessage('Email verified successfully');

          // Clean up any stored pending verification email
          if (typeof window !== 'undefined') {
            localStorage.removeItem('pendingVerificationEmail');
          }

          // Refresh user data to get updated verification status
          try {
            await refreshUser();
          } catch (error) {}

          // Redirect to filters after a brief delay
          setTimeout(() => {
            navigate('/filters');
          }, 3000);
        } else {
          if (response.error?.includes('Invalid')) {
            setStatus('error');
            setMessage('Invalid verification token');
          } else if (response.error?.includes('expired')) {
            setStatus('expired');
            setMessage(
              'This verification link has expired. Please request a new one.'
            );
          } else {
            setStatus('error');
            setMessage(response.error || 'Invalid verification token');
          }
        }
      } catch (error) {
        setStatus('error');
        setMessage('An unexpected error occurred during verification.');
        console.error('Email verification error:', error);
      }
    };

    verifyEmail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount, token from searchParams is stable

  const getStatusIcon = () => {
    switch (status) {
      case 'verifying':
        return (
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        );
      case 'success':
        return (
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
        );
      case 'expired':
        return (
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-yellow-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
        );
      case 'error':
      default:
        return (
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
        );
    }
  };

  const getStatusTitle = () => {
    switch (status) {
      case 'verifying':
        return 'Verifying Your Email...';
      case 'success':
        return 'Email Verified!';
      case 'expired':
        return 'Link Expired';
      case 'error':
      default:
        return 'Verification Failed';
    }
  };

  const getActionButtons = () => {
    switch (status) {
      case 'success':
        return (
          <div className="space-y-4">
            <Button
              onClick={() => {
                if (!hasVerified) {
                  setHasVerified(true);
                }
                navigate('/filters');
              }}
              variant="primary"
              size="lg"
              fullWidth
              {...dataCy('login-link')}
            >
              Login
            </Button>
          </div>
        );
      case 'expired':
        return (
          <div className="space-y-4">
            <Button
              onClick={() => navigate('/verify-email?context=expired')}
              variant="primary"
              size="lg"
              fullWidth
            >
              Request New Verification Link
            </Button>
            <Link to="/login">
              <Button variant="outline" size="lg" fullWidth>
                Sign In to Your Account
              </Button>
            </Link>
          </div>
        );
      case 'error':
        return (
          <div className="space-y-4">
            <Button
              onClick={() => navigate('/verify-email?context=error')}
              variant="primary"
              size="lg"
              fullWidth
            >
              Request New Verification Link
            </Button>
            <Link to="/register">
              <Button variant="outline" size="lg" fullWidth>
                Create New Account
              </Button>
            </Link>
          </div>
        );
      case 'verifying':
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
      <div className="w-full max-w-md">
        {/* Logo and Header */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-block">
            <img
              src="/logos/logo-with-text.svg"
              alt="DealsScraper"
              className="h-36 w-auto mx-auto mb-2"
            />
          </Link>
        </div>

        {/* Verification Status Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-200">
          <div
            className="text-center"
            {...dataCy(
              status === 'success'
                ? 'verification-success'
                : status === 'error'
                  ? 'verification-error'
                  : 'verification-loading'
            )}
          >
            {getStatusIcon()}

            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              {getStatusTitle()}
            </h2>

            <p className="text-gray-600 mb-6">{message}</p>

            {status === 'success' && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                <div className="flex items-center justify-center">
                  <div className="flex-shrink-0">
                    <svg
                      className="h-5 w-5 text-green-400"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-green-800">
                      You can now access all features and start creating deal
                      filters!
                    </p>
                  </div>
                </div>
              </div>
            )}

            {getActionButtons()}

            {status === 'success' && (
              <div className="mt-6 text-center">
                <div className="flex items-center justify-center space-x-2 text-gray-600">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  <span className="text-xs">
                    Redirecting to your filters in a few seconds...
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Help Footer */}
        <div className="mt-8 text-center">
          <p className="text-xs text-gray-500">
            Having trouble?{' '}
            <a
              href="mailto:support@dealsscrapper.com"
              className="text-blue-600 hover:text-blue-500"
            >
              Contact support
            </a>{' '}
            or{' '}
            <Link to="/login" className="text-blue-600 hover:text-blue-500">
              try signing in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ConfirmEmailPage() {
  return <ConfirmEmailContent />;
}
