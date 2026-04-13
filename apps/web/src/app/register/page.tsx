import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import DealsRadarLoader from '@/shared/ui/DealsRadarLoader';
import { dataCy } from '@/shared/lib/test-utils';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { user, register, loading } = useAuth();

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registrationSuccess, setRegistrationSuccess] = useState(false);
  const [registeredUserEmail, setRegisteredUserEmail] = useState<string>('');

  // Redirect if already authenticated
  useEffect(() => {
    if (user && !loading) {
      navigate('/filters');
    }
  }, [user, loading, navigate]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Clear error when user starts typing
    if (error) {
      setError(null);
    }
  };

  const validateForm = (): string | null => {
    if (
      !formData.firstName ||
      !formData.lastName ||
      !formData.email ||
      !formData.password ||
      !formData.confirmPassword
    ) {
      return 'Please fill in all fields';
    }

    if (formData.password.length < 8) {
      return 'Password must be at least 8 characters long';
    }

    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) {
      return 'Password must be stronger';
    }

    if (formData.password !== formData.confirmPassword) {
      return 'Passwords do not match';
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      return 'Please enter a valid email address';
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const result = await register(
        formData.email,
        formData.password,
        formData.firstName,
        formData.lastName
      );

      if (result.success) {
        // Set success flag and store email for verification redirect
        setRegistrationSuccess(true);
        setRegisteredUserEmail(formData.email);

        // Redirect to verification page after a brief delay
        setTimeout(() => {
          const userId = result.user?.id;
          const redirectUrl = userId
            ? `/verify-email?email=${encodeURIComponent(formData.email)}&userId=${encodeURIComponent(userId)}`
            : `/verify-email?email=${encodeURIComponent(formData.email)}`;
          navigate(redirectUrl);
        }, 2000);
      } else {
        setError(result.error || 'Registration failed');
      }
    } catch (err) {
      setError('An unexpected error occurred');
      console.error('Registration error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show loading spinner while checking auth state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <DealsRadarLoader
          message="Initializing..."
          subtext="Setting up your account creation experience"
          size="md"
        />
      </div>
    );
  }

  // Don't render register form if user is already authenticated
  if (user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <DealsRadarLoader
          message="Already signed in!"
          subtext="Taking you to your dashboard"
          size="md"
        />
      </div>
    );
  }

  // Show success state during registration process
  if (registrationSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center" {...dataCy('registration-success')}>
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
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Registration successful
          </h2>
          <p className="text-gray-600 mb-2">Welcome to DealsScrapper!</p>
          <p className="text-gray-600 mb-4">
            Please check your email{' '}
            {registeredUserEmail && (
              <span className="font-medium text-gray-800">
                ({registeredUserEmail})
              </span>
            )}{' '}
            to verify your account.
          </p>
          <div className="flex items-center justify-center space-x-2">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span className="text-gray-600">
              Redirecting to verification page...
            </span>
          </div>
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
          <p className="mt-2 text-gray-600">
            Join thousands of smart shoppers finding the best deals!
          </p>
        </div>

        {/* Register Form */}
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-200">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Error Message */}
            {error && (
              <div
                className="bg-red-50 border border-red-200 rounded-lg p-4"
                {...dataCy(
                  error.includes('Password must be stronger')
                    ? 'password-error'
                    : error.includes('Passwords do not match')
                      ? 'password-mismatch-error'
                      : 'registration-error'
                )}
              >
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
                    <p className="text-sm text-red-800">{error}</p>
                  </div>
                </div>
              </div>
            )}

            {/* First Name and Last Name Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="firstName"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  First Name
                </label>
                <Input
                  id="firstName"
                  name="firstName"
                  type="text"
                  autoComplete="given-name"
                  required
                  value={formData.firstName}
                  onChange={handleInputChange}
                  placeholder="Enter your first name"
                  disabled={isSubmitting}
                  className="w-full"
                  {...dataCy('first-name-input')}
                />
              </div>

              <div>
                <label
                  htmlFor="lastName"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Last Name
                </label>
                <Input
                  id="lastName"
                  name="lastName"
                  type="text"
                  autoComplete="family-name"
                  required
                  value={formData.lastName}
                  onChange={handleInputChange}
                  placeholder="Enter your last name"
                  disabled={isSubmitting}
                  className="w-full"
                  {...dataCy('last-name-input')}
                />
              </div>
            </div>

            {/* Email Field */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Email Address
              </label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={formData.email}
                onChange={handleInputChange}
                placeholder="Enter your email"
                disabled={isSubmitting}
                className="w-full"
                {...dataCy('email-input')}
              />
            </div>

            {/* Password Field */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Password
              </label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                value={formData.password}
                onChange={handleInputChange}
                placeholder="Enter your password"
                disabled={isSubmitting}
                className="w-full"
                {...dataCy('password-input')}
              />
              <div className="mt-2 text-xs text-gray-600">
                <p className="mb-1">Password must contain:</p>
                <ul className="space-y-1 ml-4">
                  <li
                    className={`flex items-center ${formData.password.length >= 8 ? 'text-green-600' : 'text-gray-500'}`}
                  >
                    <span className="mr-2">
                      {formData.password.length >= 8 ? '✓' : '•'}
                    </span>
                    At least 8 characters
                  </li>
                  <li
                    className={`flex items-center ${/(?=.*[a-z])/.test(formData.password) ? 'text-green-600' : 'text-gray-500'}`}
                  >
                    <span className="mr-2">
                      {/(?=.*[a-z])/.test(formData.password) ? '✓' : '•'}
                    </span>
                    One lowercase letter
                  </li>
                  <li
                    className={`flex items-center ${/(?=.*[A-Z])/.test(formData.password) ? 'text-green-600' : 'text-gray-500'}`}
                  >
                    <span className="mr-2">
                      {/(?=.*[A-Z])/.test(formData.password) ? '✓' : '•'}
                    </span>
                    One uppercase letter
                  </li>
                  <li
                    className={`flex items-center ${/(?=.*\d)/.test(formData.password) ? 'text-green-600' : 'text-gray-500'}`}
                  >
                    <span className="mr-2">
                      {/(?=.*\d)/.test(formData.password) ? '✓' : '•'}
                    </span>
                    One number
                  </li>
                </ul>
              </div>
            </div>

            {/* Confirm Password Field */}
            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Confirm Password
              </label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                value={formData.confirmPassword}
                onChange={handleInputChange}
                placeholder="Confirm your password"
                disabled={isSubmitting}
                className="w-full"
                {...dataCy('confirm-password-input')}
              />
            </div>

            {/* Terms Agreement */}
            <div className="flex items-start">
              <div className="flex items-center h-5">
                <input
                  id="terms"
                  name="terms"
                  type="checkbox"
                  required
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  {...dataCy('terms-checkbox')}
                />
              </div>
              <div className="ml-3 text-sm">
                <label htmlFor="terms" className="text-gray-700">
                  I agree to the{' '}
                  <a
                    href="#"
                    className="font-medium text-blue-600 hover:text-blue-500"
                  >
                    Terms of Service
                  </a>{' '}
                  and{' '}
                  <a
                    href="#"
                    className="font-medium text-blue-600 hover:text-blue-500"
                  >
                    Privacy Policy
                  </a>
                </label>
              </div>
            </div>

            {/* Submit Button */}
            <div>
              <Button
                type="submit"
                variant="primary"
                size="lg"
                disabled={isSubmitting}
                loading={isSubmitting}
                fullWidth
                {...dataCy('register-submit')}
              >
                {isSubmitting ? 'Creating account...' : 'Create Account'}
              </Button>
            </div>
          </form>

          {/* Sign In Link */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Already have an account?{' '}
              <Link
                to="/login"
                className="font-medium text-blue-600 hover:text-blue-500"
              >
                Sign in here
              </Link>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-xs text-gray-500">
            By creating an account, you&apos;ll be able to create custom
            filters, receive notifications, and track your favorite deals.
          </p>
        </div>
      </div>
    </div>
  );
}
