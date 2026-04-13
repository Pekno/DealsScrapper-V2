import { Link } from 'react-router-dom';

/**
 * Custom 404 Not Found Page
 * Branded, visually engaging error page with a "lost deal" theme
 */
export default function NotFound() {
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
              id="grid-dots"
              x="0"
              y="0"
              width="32"
              height="32"
              patternUnits="userSpaceOnUse"
            >
              <circle cx="2" cy="2" r="1.5" fill="#3b82f6" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid-dots)" />
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
        {/* Illustration: broken magnifying glass / empty search */}
        <div className="mx-auto mb-8 w-28 h-28 relative">
          <svg
            viewBox="0 0 120 120"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-full h-full"
          >
            {/* Magnifying glass body */}
            <circle
              cx="52"
              cy="52"
              r="30"
              stroke="#c7d2fe"
              strokeWidth="6"
              fill="#eef2ff"
            />
            {/* Glass shine */}
            <path
              d="M38 38 C42 34, 48 32, 52 34"
              stroke="#e0e7ff"
              strokeWidth="3"
              strokeLinecap="round"
              fill="none"
            />
            {/* Handle */}
            <line
              x1="74"
              y1="74"
              x2="100"
              y2="100"
              stroke="#a5b4fc"
              strokeWidth="8"
              strokeLinecap="round"
            />
            {/* Question mark inside glass */}
            <text
              x="52"
              y="60"
              textAnchor="middle"
              fontSize="28"
              fontWeight="700"
              fill="#818cf8"
              fontFamily="Inter, system-ui, sans-serif"
            >
              ?
            </text>
            {/* Small sparkle - top right */}
            <g transform="translate(88, 18)">
              <line
                x1="0"
                y1="6"
                x2="0"
                y2="-6"
                stroke="#c7d2fe"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <line
                x1="-6"
                y1="0"
                x2="6"
                y2="0"
                stroke="#c7d2fe"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </g>
            {/* Small sparkle - left */}
            <g transform="translate(14, 36)">
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
          </svg>
        </div>

        {/* 404 label */}
        <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-600 text-xs font-semibold tracking-wider uppercase px-3 py-1.5 rounded-full mb-5">
          <span className="w-1.5 h-1.5 bg-blue-400 rounded-full" />
          Error 404
        </div>

        {/* Heading */}
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">
          Deal not found
        </h1>

        {/* Description */}
        <p className="text-gray-500 text-sm sm:text-base leading-relaxed mb-8 max-w-sm mx-auto">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
          Let&apos;s get you back to hunting deals.
        </p>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white font-semibold rounded-full hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20 hover:shadow-xl hover:shadow-blue-600/25 text-sm"
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
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            Back to Home
          </Link>

          <Link
            to="/filters"
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
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
            </svg>
            View Filters
          </Link>
        </div>
      </div>

      {/* Footer help text */}
      <p className="relative z-10 mt-8 text-xs text-gray-400">
        If you keep seeing this page,{' '}
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
