/**
 * Custom Error Page
 * Branded error page matching the app's visual language.
 */
import { Link } from 'react-router-dom';

export default function ErrorPage() {
  const handleRetry = () => {
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex flex-col items-center justify-center px-4 py-12 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        {/* Floating grid dots */}
        <svg
          className="absolute top-0 left-0 w-full h-full opacity-[0.03]"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <pattern
              id="error-grid-dots"
              x="0"
              y="0"
              width="32"
              height="32"
              patternUnits="userSpaceOnUse"
            >
              <circle cx="2" cy="2" r="1.5" fill="#3b82f6" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#error-grid-dots)" />
        </svg>

        {/* Large faded gradient circles */}
        <div className="absolute -top-32 -right-32 w-96 h-96 bg-blue-200/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-48 -left-24 w-[32rem] h-[32rem] bg-indigo-200/15 rounded-full blur-3xl" />
      </div>

      {/* Logo */}
      <div className="relative z-10 mb-10">
        <Link to="/" className="inline-block">
          <img
            src="/logos/logo-with-text.svg"
            alt="DealsScraper"
            className="h-12 w-auto opacity-80 hover:opacity-100 transition-opacity"
          />
        </Link>
      </div>

      {/* Main card */}
      <div className="relative z-10 bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200/60 p-10 sm:p-14 max-w-lg w-full text-center">
        {/* Illustration: warning/alert shield */}
        <div className="mx-auto mb-8 w-28 h-28 relative">
          <svg
            viewBox="0 0 120 120"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-full h-full"
          >
            {/* Outer circle background */}
            <circle
              cx="60"
              cy="58"
              r="34"
              fill="#eef2ff"
              stroke="#c7d2fe"
              strokeWidth="4"
            />
            {/* Warning triangle */}
            <path
              d="M60 34 L82 74 L38 74 Z"
              fill="#fef3c7"
              stroke="#f59e0b"
              strokeWidth="3"
              strokeLinejoin="round"
            />
            {/* Exclamation mark - stem */}
            <line
              x1="60"
              y1="46"
              x2="60"
              y2="60"
              stroke="#d97706"
              strokeWidth="4"
              strokeLinecap="round"
            />
            {/* Exclamation mark - dot */}
            <circle cx="60" cy="67" r="2.5" fill="#d97706" />
            {/* Lightning bolt accent - top right */}
            <path
              d="M90 22 L86 32 L92 30 L88 40"
              stroke="#a5b4fc"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            {/* Small sparkle - top left */}
            <g transform="translate(22, 28)">
              <line
                x1="0"
                y1="5"
                x2="0"
                y2="-5"
                stroke="#c7d2fe"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <line
                x1="-5"
                y1="0"
                x2="5"
                y2="0"
                stroke="#c7d2fe"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </g>
            {/* Small sparkle - bottom right */}
            <g transform="translate(96, 72)">
              <line
                x1="0"
                y1="4"
                x2="0"
                y2="-4"
                stroke="#e0e7ff"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              <line
                x1="-4"
                y1="0"
                x2="4"
                y2="0"
                stroke="#e0e7ff"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </g>
            {/* Circular motion lines */}
            <path
              d="M28 80 C24 76, 22 70, 22 64"
              stroke="#e0e7ff"
              strokeWidth="2"
              strokeLinecap="round"
              fill="none"
            />
            <path
              d="M92 80 C96 76, 98 70, 98 64"
              stroke="#e0e7ff"
              strokeWidth="2"
              strokeLinecap="round"
              fill="none"
            />
          </svg>
        </div>

        {/* Error 500 label */}
        <div className="inline-flex items-center gap-2 bg-amber-50 text-amber-600 text-xs font-semibold tracking-wider uppercase px-3 py-1.5 rounded-full mb-5">
          <span className="w-1.5 h-1.5 bg-amber-400 rounded-full" />
          Error 500
        </div>

        {/* Heading */}
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">
          Something went wrong
        </h1>

        {/* Description */}
        <p className="text-gray-500 text-sm sm:text-base leading-relaxed mb-8 max-w-sm mx-auto">
          An unexpected error occurred while loading this page. You can try
          again or head back to the home page.
        </p>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
          <button
            type="button"
            onClick={handleRetry}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white font-semibold rounded-full hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20 hover:shadow-xl hover:shadow-blue-600/25 text-sm cursor-pointer"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
            Try again
          </button>

          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white text-gray-700 font-medium rounded-full border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-colors text-sm"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            Go Home
          </Link>
        </div>
      </div>

      {/* Footer help text */}
      <p className="relative z-10 mt-8 text-xs text-gray-400">
        If the problem persists,{' '}
        <a
          href="mailto:support@dealsscrapper.com"
          className="text-blue-500 hover:text-blue-600 underline underline-offset-2"
        >
          contact support
        </a>
      </p>
    </div>
  );
}
