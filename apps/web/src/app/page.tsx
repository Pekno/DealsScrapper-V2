import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { useAuth } from '@/features/auth/hooks/useAuth';
import DealsRadarLoader from '@/shared/ui/DealsRadarLoader';

export default function Home() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  // Redirect authenticated users to their main workspace
  useEffect(() => {
    if (!loading && user) {
      navigate('/filters', { replace: true });
    }
  }, [user, loading, navigate]);

  // Show loading while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <DealsRadarLoader
          message="Loading DealsScrapper..."
          subtext="Checking your authentication status"
          size="lg"
        />
      </div>
    );
  }

  // Show loading while redirecting authenticated users
  if (user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <DealsRadarLoader
          message="Welcome back!"
          subtext="Taking you to your filters..."
          size="md"
        />
      </div>
    );
  }
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="z-10 w-full max-w-4xl text-center space-y-8">
        {/* Hero Section */}
        <div className="space-y-6">
          <div className="flex items-center justify-center gap-4 mb-4">
            <img
              src="/logos/logo-with-text.svg"
              alt="DealsScraper"
              className="h-36 w-auto"
            />
          </div>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Discover the best deals with intelligent filtering and real-time
            notifications
          </p>
        </div>

        {/* CTA Section */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-xl p-8 space-y-6">
          <h2 className="text-2xl font-bold text-gray-900">
            Ready to Find Your Perfect Deal?
          </h2>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link
              to="/login"
              className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-semibold rounded-full hover:bg-blue-700 transition-colors shadow-lg hover:shadow-xl transform hover:-translate-y-1"
            >
              Sign In
            </Link>

            <Link
              to="/register"
              className="inline-flex items-center px-6 py-3 bg-white text-blue-600 font-semibold rounded-full border-2 border-blue-600 hover:bg-blue-50 transition-colors"
            >
              Create Account
            </Link>
          </div>

          <div className="text-sm text-gray-500">
            Join thousands of smart shoppers finding the best deals
          </div>
        </div>

        {/* Features Preview */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Link
            to="/login"
            className="block p-6 bg-white rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-lg transition-all group"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 14.414V20a1 1 0 01-.553.894l-4 2A1 1 0 017 22v-7.586L3.293 6.707A1 1 0 013 6V4z" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900">Smart Filters</h3>
            </div>
            <p className="text-sm text-gray-600">
              Create intelligent filters to find exactly what you&apos;re looking for
            </p>
          </Link>

          <Link
            to="/login"
            className="block p-6 bg-white rounded-xl border border-gray-200 hover:border-green-300 hover:shadow-lg transition-all group"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center group-hover:bg-green-200 transition-colors">
                <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900">Create Filter</h3>
            </div>
            <p className="text-sm text-gray-600">
              Build custom filters with advanced rule-based logic
            </p>
          </Link>

          <div className="p-6 bg-white rounded-xl border border-gray-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900">Real-time Notifications</h3>
            </div>
            <p className="text-sm text-gray-600">
              Get instant alerts when deals match your criteria
            </p>
          </div>

          <div className="p-6 bg-white rounded-xl border border-gray-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900">Multi-site Tracking</h3>
            </div>
            <p className="text-sm text-gray-600">
              Monitor deals across multiple websites simultaneously
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-sm text-gray-500">
          <p>Modern deal aggregation platform with intelligent filtering</p>
        </div>
      </div>
    </main>
  );
}
