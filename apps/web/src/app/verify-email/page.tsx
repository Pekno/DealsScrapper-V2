import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { Button } from '@/shared/ui/Button';
import { apiClient } from '@/shared/lib/api';
import { dataCy } from '@/shared/lib/test-utils';

function VerifyEmailContent() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading } = useAuth();

  const [email, setEmail] = useState<string>('');
  const [userId, setUserId] = useState<string | null>(null);
  const [isResending, setIsResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [context, setContext] = useState<'initial' | 'expired' | 'error'>(
    'initial'
  );

  // Get email, userId, and context from URL params or user context
  useEffect(() => {
    const emailFromParams = searchParams.get('email');
    const userIdFromParams = searchParams.get('userId');
    const contextFromParams = searchParams.get('context');

    // Set context based on URL parameter
    if (contextFromParams === 'expired') {
      setContext('expired');
    } else if (contextFromParams === 'error') {
      setContext('error');
    } else {
      setContext('initial');
    }

    // Get userId from params or localStorage
    if (userIdFromParams) {
      setUserId(userIdFromParams);
      // Store userId in localStorage for persistence
      if (typeof window !== 'undefined') {
        localStorage.setItem('pendingVerificationUserId', userIdFromParams);
      }
    } else if (typeof window !== 'undefined') {
      const storedUserId = localStorage.getItem('pendingVerificationUserId');
      if (storedUserId) {
        setUserId(storedUserId);
      }
    }

    // Only set email if we have a legitimate context or came from registration
    if (emailFromParams) {
      setEmail(emailFromParams);
    } else if (
      contextFromParams === 'expired' ||
      contextFromParams === 'error'
    ) {
      // For error/expired contexts, try to get email from localStorage or user
      if (user?.email) {
        setEmail(user.email);
      } else {
        const storedEmail =
          typeof window !== 'undefined'
            ? localStorage.getItem('pendingVerificationEmail')
            : null;
        if (storedEmail) {
          setEmail(storedEmail);
        }
      }
    } else {
      // For direct access without context, only show if there's a stored pending email
      const storedEmail =
        typeof window !== 'undefined'
          ? localStorage.getItem('pendingVerificationEmail')
          : null;
      if (storedEmail) {
        setEmail(storedEmail);
      } else {
        // No legitimate verification context - redirect to login
        navigate('/login');
        return;
      }
    }
  }, [searchParams, user, navigate]);

  // Store email in localStorage for direct access scenarios
  useEffect(() => {
    if (email && typeof window !== 'undefined') {
      localStorage.setItem('pendingVerificationEmail', email);
    }
  }, [email]);

  // Redirect authenticated users to dashboard if they somehow end up here
  useEffect(() => {
    if (user && !loading && user.email) {
      // Clean up localStorage and redirect to dashboard
      if (typeof window !== 'undefined') {
        localStorage.removeItem('pendingVerificationEmail');
        localStorage.removeItem('pendingVerificationUserId');
      }
      // If user is authenticated and presumably verified, redirect to dashboard
      // Note: In a real implementation, you'd check if user.emailVerified or similar
      navigate('/filters');
    }
  }, [user, loading, navigate]);

  // Cleanup localStorage when component unmounts
  useEffect(() => {
    return () => {
      // Clean up on unmount if user navigates away
      if (typeof window !== 'undefined' && user) {
        localStorage.removeItem('pendingVerificationEmail');
        localStorage.removeItem('pendingVerificationUserId');
      }
    };
  }, [user]);

  // Cooldown timer for resend button
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => {
        setResendCooldown(resendCooldown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleResendVerification = async () => {
    if (!userId) {
      setResendError(
        'User ID not found. Please try registering again or contact support.'
      );
      return;
    }

    setIsResending(true);
    setResendError(null);
    setResendSuccess(false);

    try {
      const response = await apiClient.resendVerificationEmail(userId);

      if (response.success) {
        setResendSuccess(true);
        setResendCooldown(60); // 60 second cooldown
      } else {
        setResendError(
          response.error || 'Failed to resend verification email'
        );
      }
    } catch (error) {
      setResendError(
        'Unable to resend verification email. Please try again or contact support.'
      );
      console.error('Resend verification error:', error);
    } finally {
      setIsResending(false);
    }
  };

  // Show loading spinner while checking auth state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="flex items-center space-x-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="text-gray-600">Loading...</span>
        </div>
      </div>
    );
  }

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

        {/* Verification Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-200">
          {/* Success Icon */}
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {context === 'initial'
                ? 'Check Your Email'
                : 'Verification Required'}
            </h2>
            <p className="text-gray-600" {...dataCy('verification-message')}>
              {context === 'expired'
                ? 'Your verification link has expired. We can send you a new one to complete your account setup.'
                : context === 'error'
                  ? 'There was an issue with your verification link. Please request a new verification email to activate your account.'
                  : "We've sent a verification link to verify your email address and activate your account."}
            </p>
          </div>

          {/* Email Display */}
          {email && (
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-gray-400 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207"
                  />
                </svg>
                <span
                  className="text-sm font-medium text-gray-700"
                  {...dataCy('verification-email')}
                >
                  {email}
                </span>
              </div>
            </div>
          )}

          {/* Instructions */}
          <div className="space-y-4 mb-6">
            <div className="flex items-start">
              <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mr-3 mt-0.5">
                <span className="text-blue-600 text-sm font-semibold">1</span>
              </div>
              <p className="text-sm text-gray-600">
                Open your email inbox and look for a message from DealsScrapper
              </p>
            </div>

            <div className="flex items-start">
              <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mr-3 mt-0.5">
                <span className="text-blue-600 text-sm font-semibold">2</span>
              </div>
              <p className="text-sm text-gray-600">
                Click the &quot;Verify Email Address&quot; button in the email
              </p>
            </div>

            <div className="flex items-start">
              <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mr-3 mt-0.5">
                <span className="text-blue-600 text-sm font-semibold">3</span>
              </div>
              <p className="text-sm text-gray-600">
                You&apos;ll be redirected back to start creating your first deal
                filter
              </p>
            </div>
          </div>

          {/* Success/Error Messages for Resend */}
          {resendSuccess && (
            <div
              className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6"
              {...dataCy('resend-success-message')}
            >
              <div className="flex items-center">
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
                    Verification email sent successfully! Please check your
                    inbox.
                  </p>
                </div>
              </div>
            </div>
          )}

          {resendError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg
                    className="h-5 w-5 text-red-400"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-800">{resendError}</p>
                </div>
              </div>
            </div>
          )}

          {/* Resend Button */}
          <div className="space-y-4">
            <Button
              onClick={handleResendVerification}
              variant="outline"
              size="lg"
              disabled={!userId || isResending || resendCooldown > 0}
              loading={isResending}
              fullWidth
              {...dataCy('resend-verification-button')}
            >
              {resendCooldown > 0
                ? `Resend in ${resendCooldown}s`
                : isResending
                  ? 'Sending...'
                  : 'Resend verification email'}
            </Button>

            {/* Help Text */}
            <div className="text-center">
              <p className="text-xs text-gray-500 mb-4">
                Didn&apos;t receive the email? Check your spam folder or try
                resending.
              </p>
            </div>

            {/* Action Links */}
            <div className="flex flex-col space-y-2">
              <Link
                to="/login"
                className="text-center text-sm text-blue-600 hover:text-blue-500 font-medium"
              >
                Already verified? Sign in here
              </Link>

              <Link
                to="/register"
                className="text-center text-sm text-gray-600 hover:text-gray-500"
              >
                Use a different email address
              </Link>
            </div>
          </div>
        </div>

        {/* Footer Help */}
        <div className="mt-8 text-center">
          <p className="text-xs text-gray-500">
            Having trouble? Contact us at{' '}
            <a
              href="mailto:support@dealsscrapper.com"
              className="text-blue-600 hover:text-blue-500"
            >
              support@dealsscrapper.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return <VerifyEmailContent />;
}
