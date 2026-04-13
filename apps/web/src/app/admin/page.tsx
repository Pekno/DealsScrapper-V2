import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import AppLayout from '@/shared/layout/AppLayout';
import { PageHeader } from '@/shared/ui/PageHeader';
import { Button } from '@/shared/ui/Button';
import { Badge } from '@/shared/ui/Badge';
import { Modal } from '@/shared/ui/Modal';
import { DeleteConfirmationModal } from '@/shared/ui/DeleteConfirmationModal';
import { LoadingSpinner, Skeleton } from '@/shared/ui/LoadingSpinner';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { apiClient } from '@/shared/lib/api';
import { useToast } from '@/shared/lib/toast-context';
import type {
  ServiceHealth,
  DashboardMetrics,
  SchedulerHealthResponse,
  ScraperWorker,
  AdminUser,
  PaginationMeta,
} from '@/features/admin/types/admin.types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const USERS_PER_PAGE = 10;

type TabType = 'dashboard' | 'users';

// ---------------------------------------------------------------------------
// Inline SVG icons used throughout the page
// ---------------------------------------------------------------------------

const RefreshIcon: React.FC<{ className?: string }> = ({
  className = 'w-4 h-4',
}) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
    />
  </svg>
);

const CheckIcon: React.FC<{ className?: string }> = ({
  className = 'w-4 h-4',
}) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M5 13l4 4L19 7"
    />
  </svg>
);

const XIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M6 18L18 6M6 6l12 12"
    />
  </svg>
);

const CopyIcon: React.FC<{ className?: string }> = ({
  className = 'w-4 h-4',
}) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
    />
  </svg>
);

const EllipsisIcon: React.FC<{ className?: string }> = ({
  className = 'w-5 h-5',
}) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
    />
  </svg>
);

const SearchIcon: React.FC<{ className?: string }> = ({
  className = 'w-5 h-5',
}) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
    />
  </svg>
);

const ShieldIcon: React.FC<{ className?: string }> = ({
  className = 'w-5 h-5',
}) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
    />
  </svg>
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getStatusVariant(
  status: string
): 'success' | 'warning' | 'danger' | 'default' {
  const lower = status.toLowerCase();
  if (lower === 'healthy' || lower === 'ok') return 'success';
  if (lower === 'degraded') return 'warning';
  if (lower === 'unhealthy' || lower === 'unreachable' || lower === 'error')
    return 'danger';
  return 'default';
}

function getStatusColor(status: string): string {
  const lower = status.toLowerCase();
  if (lower === 'healthy' || lower === 'ok') return 'bg-emerald-500';
  if (lower === 'degraded') return 'bg-amber-500';
  return 'bg-red-500';
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'Invalid date';
  }
}

function formatDetailValue(value: unknown): string {
  if (value === null || value === undefined) return 'N/A';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return value.toLocaleString();
  if (typeof value === 'string') return value;
  return String(value);
}

/** Fields already shown elsewhere in the card — skip them from the details list */
const HIDDEN_HEALTH_FIELDS = new Set([
  'status',
  'timestamp',
  'service',
  'workers',
]);

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

/** Renders health details in a readable format, filtering out redundant/nested fields */
function HealthDetailsDisplay({
  details,
}: {
  details: Record<string, unknown>;
}) {
  const entries = Object.entries(details).filter(
    ([key, value]) =>
      !HIDDEN_HEALTH_FIELDS.has(key) &&
      typeof value !== 'object'
  );

  if (entries.length === 0) return null;

  return (
    <div className="mt-2 space-y-1">
      {entries.map(([key, value]) => (
        <div key={key} className="flex justify-between text-xs">
          <span className="text-gray-500 capitalize">
            {key.replace(/([A-Z])/g, ' $1').trim()}
          </span>
          <span className="text-gray-700 font-medium">
            {key === 'uptime' && typeof value === 'number'
              ? formatUptime(value)
              : formatDetailValue(value)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Notification toast that auto-dismisses */
/** Single metric card */
function MetricCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div
      className="bg-white rounded-lg border border-gray-200 shadow-sm p-5 flex items-center gap-4"
      data-cy={`metric-card-${label.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex-shrink-0">
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900" data-cy="metric-value">
          {value.toLocaleString()}
        </p>
        <p className="text-sm text-gray-500">{label}</p>
      </div>
    </div>
  );
}

/** Loading skeleton for the users tab */
function UsersSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-10 w-64 bg-gray-200 rounded mb-6" />
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="h-12 bg-gray-100" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center px-6 py-4 border-t border-gray-100"
          >
            <Skeleton variant="text" width="25%" />
            <Skeleton variant="text" width="15%" className="ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Card-level loading spinner overlay */
function CardLoadingOverlay() {
  return (
    <div className="flex items-center justify-center py-8">
      <LoadingSpinner size="small" variant="primary" />
    </div>
  );
}

/** Card-level error display */
function CardErrorDisplay({
  error,
  onRetry,
}: {
  error: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex items-center gap-3 py-4">
      <XIcon className="w-5 h-5 text-red-400 flex-shrink-0" />
      <p className="text-sm text-red-700 flex-1">{error}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}

/** Actions dropdown for user rows - uses portal to avoid overflow clipping */
function UserActionsDropdown({
  user,
  onToggleRole,
  onResetPassword,
  onDelete,
}: {
  user: AdminUser;
  onToggleRole: (user: AdminUser) => void;
  onResetPassword: (user: AdminUser) => void;
  onDelete: (user: AdminUser) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number }>({
    top: 0,
    left: 0,
  });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setMenuPosition({
        top: rect.bottom + 4,
        left: rect.right - 192,
      });
    }
  }, [isOpen]);

  const newRole = user.role === 'ADMIN' ? 'USER' : 'ADMIN';

  const dropdownMenu = isOpen ? (
    <div
      ref={dropdownRef}
      className="w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-[9999]"
      style={{
        position: 'fixed',
        top: menuPosition.top,
        left: menuPosition.left,
      }}
    >
      <button
        type="button"
        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
        onClick={() => {
          onToggleRole(user);
          setIsOpen(false);
        }}
        data-cy="admin-action-toggle-role"
      >
        <ShieldIcon className="w-4 h-4 text-gray-400" />
        Set as {newRole}
      </button>
      <button
        type="button"
        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
        onClick={() => {
          onResetPassword(user);
          setIsOpen(false);
        }}
        data-cy="admin-action-reset-password"
      >
        <svg
          className="w-4 h-4 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
          />
        </svg>
        Reset Password
      </button>
      <div className="border-t border-gray-100 my-1" />
      <button
        type="button"
        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
        onClick={() => {
          onDelete(user);
          setIsOpen(false);
        }}
        data-cy="admin-action-delete-user"
      >
        <svg
          className="w-4 h-4 text-red-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
          />
        </svg>
        Delete User
      </button>
    </div>
  ) : null;

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={`Actions for ${user.email}`}
        aria-haspopup="true"
        aria-expanded={isOpen}
        data-cy={`admin-user-actions-${user.email}`}
      >
        <EllipsisIcon className="w-5 h-5" />
      </button>

      {dropdownMenu && createPortal(dropdownMenu, document.body)}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Independent card state hook
// ---------------------------------------------------------------------------

interface CardState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refreshing: boolean;
}

function useCardState<T>(
  fetchFn: () => Promise<{ success: boolean; data?: T; error?: string }>,
  shouldFetch: boolean,
  pollingIntervalMs?: number
): CardState<T> & { refresh: () => void } {
  const [state, setState] = useState<CardState<T>>({
    data: null,
    loading: true,
    error: null,
    refreshing: false,
  });

  const refreshingRef = useRef(false);

  const fetchData = useCallback(
    async (isRefresh: boolean) => {
      refreshingRef.current = true;
      if (isRefresh) {
        setState((prev) => ({ ...prev, refreshing: true, error: null }));
      } else {
        setState((prev) => ({
          ...prev,
          loading: prev.data === null,
          error: null,
        }));
      }

      try {
        const response = await fetchFn();
        if (response.success && response.data !== undefined) {
          refreshingRef.current = false;
          setState({
            data: response.data,
            loading: false,
            error: null,
            refreshing: false,
          });
        } else {
          refreshingRef.current = false;
          setState((prev) => ({
            ...prev,
            loading: false,
            error: response.error || 'Failed to load data',
            refreshing: false,
          }));
        }
      } catch {
        refreshingRef.current = false;
        setState((prev) => ({
          ...prev,
          loading: false,
          error: 'Failed to connect to the server.',
          refreshing: false,
        }));
      }
    },
    [fetchFn]
  );

  useEffect(() => {
    if (shouldFetch) {
      void fetchData(false);
    }
  }, [shouldFetch]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-polling: start interval after initial data is loaded
  const hasData = state.data !== null;
  useEffect(() => {
    if (!pollingIntervalMs || !shouldFetch || !hasData) return;

    const id = setInterval(() => {
      if (!refreshingRef.current) {
        void fetchData(true);
      }
    }, pollingIntervalMs);

    return () => clearInterval(id);
  }, [pollingIntervalMs, shouldFetch, hasData, fetchData]);

  const refresh = useCallback(() => {
    void fetchData(true);
  }, [fetchData]);

  return { ...state, refresh };
}

// ---------------------------------------------------------------------------
// Scraper Worker Tile
// ---------------------------------------------------------------------------

function ScraperWorkerTile({ worker }: { worker: ScraperWorker }) {
  const variant = getStatusVariant(worker.status);
  const dotColor = getStatusColor(worker.status);
  const siteName = worker.site
    ? worker.site.charAt(0).toUpperCase() + worker.site.slice(1)
    : null;

  const successRate =
    worker.scraping && worker.scraping.totalRequests > 0
      ? (
          (worker.scraping.successfulRequests / worker.scraping.totalRequests) *
          100
        ).toFixed(1)
      : null;

  return (
    <div
      className="bg-gray-50 rounded-lg border border-gray-200 p-4"
      data-cy="scraper-worker-card"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-gray-700 truncate">
            {siteName ?? worker.id}
          </h4>
          {siteName && (
            <p className="text-[11px] text-gray-400 truncate">{worker.id}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span
            className={`inline-block w-2 h-2 rounded-full ${dotColor}`}
          />
          <Badge variant={variant} size="sm">
            {worker.status}
          </Badge>
        </div>
      </div>

      <div className="space-y-1 text-xs">
        <div className="flex justify-between">
          <span className="text-gray-500">Load</span>
          <span className="text-gray-700 font-medium">
            {worker.currentLoad}/{worker.maxConcurrentJobs}
          </span>
        </div>

        {worker.browserPool ? (
          <>
            <div className="flex justify-between">
              <span className="text-gray-500">Browser Pool</span>
              <span className="text-gray-700 font-medium">
                Avail: {worker.browserPool.availableInstances}/
                {worker.browserPool.totalInstances}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Utilization</span>
              <span className="text-gray-700 font-medium">
                {worker.browserPool.utilizationPercentage.toFixed(0)}%
              </span>
            </div>
          </>
        ) : (
          <div className="flex justify-between">
            <span className="text-gray-500">Browser Pool</span>
            <span className="text-gray-400 font-medium">N/A</span>
          </div>
        )}

        {successRate !== null && (
          <div className="flex justify-between">
            <span className="text-gray-500">Success</span>
            <span className="text-gray-700 font-medium">{successRate}%</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dashboard Tab - independent per-card state
// ---------------------------------------------------------------------------

function DashboardTab({ isAdmin }: { isAdmin: boolean }) {
  const apiHealth = useCardState<ServiceHealth>(
    useCallback(() => apiClient.getAdminHealthApi(), []),
    isAdmin,
    30_000
  );

  const notifierHealth = useCardState<ServiceHealth>(
    useCallback(() => apiClient.getAdminHealthNotifier(), []),
    isAdmin,
    30_000
  );

  const schedulerHealth = useCardState<SchedulerHealthResponse>(
    useCallback(() => apiClient.getAdminHealthScheduler(), []),
    isAdmin,
    30_000
  );

  const metricsData = useCardState<DashboardMetrics>(
    useCallback(() => apiClient.getAdminMetrics(), []),
    isAdmin
  );

  return (
    <div className="space-y-6" data-cy="admin-dashboard-content">
      {/* Top row: API + Notifier cards */}
      <section data-cy="service-health-section">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Service Health
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* API card */}
          <div
            className="bg-white rounded-lg border border-gray-200 shadow-sm p-5"
            data-cy="service-health-card-api"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                API
              </h3>
              <button
                type="button"
                onClick={apiHealth.refresh}
                disabled={apiHealth.refreshing}
                className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50"
                aria-label="Refresh API health"
              >
                <RefreshIcon
                  className={`w-4 h-4 ${apiHealth.refreshing ? 'animate-spin' : ''}`}
                />
              </button>
            </div>
            {apiHealth.loading && !apiHealth.data ? (
              <CardLoadingOverlay />
            ) : apiHealth.error && !apiHealth.data ? (
              <CardErrorDisplay
                error={apiHealth.error}
                onRetry={apiHealth.refresh}
              />
            ) : apiHealth.data ? (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className={`inline-block w-2.5 h-2.5 rounded-full animate-pulse ${getStatusColor(apiHealth.data.status)}`}
                  />
                  <Badge variant={getStatusVariant(apiHealth.data.status)} size="sm">
                    {apiHealth.data.status}
                  </Badge>
                </div>
                {apiHealth.data.details && (
                  <HealthDetailsDisplay details={apiHealth.data.details} />
                )}
              </div>
            ) : null}
          </div>

          {/* Notifier card */}
          <div
            className="bg-white rounded-lg border border-gray-200 shadow-sm p-5"
            data-cy="service-health-card-notifier"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                Notifier
              </h3>
              <button
                type="button"
                onClick={notifierHealth.refresh}
                disabled={notifierHealth.refreshing}
                className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50"
                aria-label="Refresh Notifier health"
              >
                <RefreshIcon
                  className={`w-4 h-4 ${notifierHealth.refreshing ? 'animate-spin' : ''}`}
                />
              </button>
            </div>
            {notifierHealth.loading && !notifierHealth.data ? (
              <CardLoadingOverlay />
            ) : notifierHealth.error && !notifierHealth.data ? (
              <CardErrorDisplay
                error={notifierHealth.error}
                onRetry={notifierHealth.refresh}
              />
            ) : notifierHealth.data ? (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className={`inline-block w-2.5 h-2.5 rounded-full animate-pulse ${getStatusColor(notifierHealth.data.status)}`}
                  />
                  <Badge
                    variant={getStatusVariant(notifierHealth.data.status)}
                    size="sm"
                  >
                    {notifierHealth.data.status}
                  </Badge>
                </div>
                {notifierHealth.data.details && (
                  <HealthDetailsDisplay details={notifierHealth.data.details} />
                )}
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {/* Full-width Scheduler card with embedded scraper worker tiles */}
      <section>
        <div
          className="bg-white rounded-lg border border-gray-200 shadow-sm p-5"
          data-cy="service-health-card-scheduler"
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
              Scheduler
            </h3>
            <button
              type="button"
              onClick={schedulerHealth.refresh}
              disabled={schedulerHealth.refreshing}
              className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50"
              aria-label="Refresh Scheduler health"
            >
              <RefreshIcon
                className={`w-4 h-4 ${schedulerHealth.refreshing ? 'animate-spin' : ''}`}
              />
            </button>
          </div>

          {schedulerHealth.loading && !schedulerHealth.data ? (
            <CardLoadingOverlay />
          ) : schedulerHealth.error && !schedulerHealth.data ? (
            <CardErrorDisplay
              error={schedulerHealth.error}
              onRetry={schedulerHealth.refresh}
            />
          ) : schedulerHealth.data ? (
            (() => {
              const workers = schedulerHealth.data.scheduler.details?.workers as
                | { total?: number; available?: number; busy?: number }
                | undefined;
              return (
                <div>
                  {/* Scheduler status + worker summary */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-block w-2.5 h-2.5 rounded-full animate-pulse ${getStatusColor(schedulerHealth.data.scheduler.status)}`}
                      />
                      <Badge
                        variant={getStatusVariant(
                          schedulerHealth.data.scheduler.status
                        )}
                        size="sm"
                      >
                        {schedulerHealth.data.scheduler.status}
                      </Badge>
                    </div>
                    {workers && (
                      <span className="text-sm text-gray-500">
                        Workers: {workers.available ?? 0}/{workers.total ?? 0}{' '}
                        available
                      </span>
                    )}
                  </div>

                  {/* Scheduler details */}
                  {schedulerHealth.data.scheduler.details && (
                    <div className="mb-4">
                      <HealthDetailsDisplay
                        details={schedulerHealth.data.scheduler.details}
                      />
                    </div>
                  )}

                  {/* Registered Scrapers */}
                  <div className="border-t border-gray-100 pt-4">
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                      Registered Scrapers
                    </h4>
                    {schedulerHealth.data.scrapers.length === 0 ? (
                      <p className="text-sm text-gray-400 italic">
                        No scrapers registered
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {schedulerHealth.data.scrapers.map((worker) => (
                          <ScraperWorkerTile key={worker.id} worker={worker} />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()
          ) : null}
        </div>
      </section>

      {/* Full-width System Metrics card */}
      <section data-cy="system-metrics-section">
        <div
          className="bg-white rounded-lg border border-gray-200 shadow-sm p-5"
          data-cy="metrics-card"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              System Metrics
            </h2>
            <button
              type="button"
              onClick={metricsData.refresh}
              disabled={metricsData.refreshing}
              className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50"
              aria-label="Refresh metrics"
            >
              <RefreshIcon
                className={`w-4 h-4 ${metricsData.refreshing ? 'animate-spin' : ''}`}
              />
            </button>
          </div>

          {metricsData.loading && !metricsData.data ? (
            <CardLoadingOverlay />
          ) : metricsData.error && !metricsData.data ? (
            <CardErrorDisplay
              error={metricsData.error}
              onRetry={metricsData.refresh}
            />
          ) : metricsData.data ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <MetricCard
                label="Total Users"
                value={metricsData.data.totalUsers}
                icon={
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                    />
                  </svg>
                }
              />
              <MetricCard
                label="Total Filters"
                value={metricsData.data.totalFilters}
                icon={
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                    />
                  </svg>
                }
              />
              <MetricCard
                label="Total Matches"
                value={metricsData.data.totalMatches}
                icon={
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                }
              />
              <MetricCard
                label="Active Sessions"
                value={metricsData.data.activeSessions}
                icon={
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                }
              />
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Users Tab
// ---------------------------------------------------------------------------

function UsersTab({
  users,
  pagination,
  isLoading,
  searchQuery,
  onSearchChange,
  onPageChange,
  onToggleRole,
  onResetPassword,
  onDelete,
}: {
  users: AdminUser[];
  pagination: PaginationMeta | null;
  isLoading: boolean;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onPageChange: (page: number) => void;
  onToggleRole: (user: AdminUser) => void;
  onResetPassword: (user: AdminUser) => void;
  onDelete: (user: AdminUser) => void;
}) {
  return (
    <div className="space-y-4" data-cy="admin-users-content">
      {/* Search - always visible so it's never unmounted during typing */}
      <div className="max-w-sm">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <SearchIcon className="w-4 h-4 text-gray-400" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search users by email or name..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
            aria-label="Search users"
            data-cy="admin-user-search"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
              aria-label="Clear search"
            >
              <XIcon className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Show skeleton for initial load only (no data yet and no active search) */}
      {isLoading && users.length === 0 && !searchQuery ? (
        <UsersSkeleton />
      ) : (
      <>
      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table
            className="min-w-full divide-y divide-gray-200"
            data-cy="admin-user-table"
          >
            <thead className="bg-gray-50">
              <tr>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Email
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Name
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Role
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Verified
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Last Login
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <p className="text-sm text-gray-500">
                      {searchQuery
                        ? 'No users found matching your search.'
                        : 'No users found.'}
                    </p>
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr
                    key={user.id}
                    className="hover:bg-gray-50 transition-colors"
                    data-cy={`admin-user-row-${user.email}`}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-gray-900">
                        {user.email}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-700">
                        {[user.firstName, user.lastName]
                          .filter(Boolean)
                          .join(' ') || '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge
                        variant={user.role === 'ADMIN' ? 'accent' : 'default'}
                        size="sm"
                      >
                        {user.role}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {user.emailVerified ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600">
                          <CheckIcon className="w-4 h-4" />
                          <span className="text-xs font-medium">Yes</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-red-500">
                          <XIcon className="w-4 h-4" />
                          <span className="text-xs font-medium">No</span>
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-500">
                        {formatDate(user.lastLoginAt)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <UserActionsDropdown
                        user={user}
                        onToggleRole={onToggleRole}
                        onResetPassword={onResetPassword}
                        onDelete={onDelete}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Loading overlay for table refetches */}
        {isLoading && users.length > 0 && (
          <div className="px-6 py-2 bg-blue-50 border-t border-blue-100 flex items-center gap-2">
            <LoadingSpinner size="small" variant="primary" />
            <span className="text-xs text-blue-700">Updating...</span>
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div
          className="flex items-center justify-between pt-2"
          data-cy="admin-pagination"
        >
          <p className="text-sm text-gray-500" data-cy="admin-pagination-info">
            Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
            {pagination.total} users
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!pagination.hasPreviousPage}
              onClick={() => onPageChange(pagination.page - 1)}
              data-cy="admin-pagination-prev"
            >
              Previous
            </Button>
            <span
              className="text-sm text-gray-700 px-2"
              data-cy="admin-pagination-page"
            >
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={!pagination.hasNextPage}
              onClick={() => onPageChange(pagination.page + 1)}
              data-cy="admin-pagination-next"
            >
              Next
            </Button>
          </div>
        </div>
      )}
      </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Admin Content component
// ---------------------------------------------------------------------------

function AdminContent() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();

  // Tab state derived from URL
  const activeTab: TabType =
    (searchParams.get('tab') as TabType) || 'dashboard';

  // Users state
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [usersPagination, setUsersPagination] = useState<PaginationMeta | null>(
    null
  );
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersPage, setUsersPage] = useState(1);
  const [usersSearch, setUsersSearch] = useState('');

  // Modal state
  const [resetPasswordModal, setResetPasswordModal] = useState<{
    isOpen: boolean;
    user: AdminUser | null;
    resetUrl: string | null;
    emailSent: boolean;
    loading: boolean;
  }>({
    isOpen: false,
    user: null,
    resetUrl: null,
    emailSent: false,
    loading: false,
  });
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    user: AdminUser | null;
    loading: boolean;
  }>({
    isOpen: false,
    user: null,
    loading: false,
  });
  const [copied, setCopied] = useState(false);

  const { toast } = useToast();

  // Debounce ref for user search
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ------ Redirect non-admins ------
  useEffect(() => {
    if (!authLoading && user && user.role !== 'ADMIN') {
      navigate('/filters');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login');
    }
  }, [user, authLoading, navigate]);

  // ------ Data fetching ------

  const fetchUsers = useCallback(async (page: number, search: string) => {
    try {
      setUsersLoading(true);
      const response = await apiClient.getAdminUsers({
        page,
        limit: USERS_PER_PAGE,
        search: search || undefined,
      });
      if (response.success && response.data) {
        setUsers(response.data.data);
        setUsersPagination(response.data.pagination);
      }
    } catch {
      // Silently handle - the table will show empty
    } finally {
      setUsersLoading(false);
    }
  }, []);

  // Load users when tab changes to users or page/search changes
  useEffect(() => {
    if (user?.role === 'ADMIN' && activeTab === 'users') {
      void fetchUsers(usersPage, usersSearch);
    }
  }, [activeTab, usersPage, user]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced search for users
  useEffect(() => {
    if (activeTab !== 'users') return;

    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    searchDebounceRef.current = setTimeout(() => {
      setUsersPage(1);
      void fetchUsers(1, usersSearch);
    }, 400);

    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, [usersSearch]); // eslint-disable-line react-hooks/exhaustive-deps

  // ------ Handlers ------

  const handleTabChange = useCallback(
    (tab: TabType) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('tab', tab);
      navigate(`${pathname}?${params.toString()}`);
    },
    [navigate, pathname, searchParams]
  );

  const handleToggleRole = useCallback(async (targetUser: AdminUser) => {
    const newRole = targetUser.role === 'ADMIN' ? 'USER' : 'ADMIN';
    try {
      const response = await apiClient.updateUserRole(targetUser.id, newRole);
      if (response.success) {
        setUsers((prev) =>
          prev.map((u) =>
            u.id === targetUser.id ? { ...u, role: newRole } : u
          )
        );
        toast.success(`${targetUser.email} is now ${newRole}`);
      } else {
        toast.error(response.error || 'Failed to update role');
      }
    } catch {
      toast.error('Failed to update user role');
    }
  }, [toast]);

  const handleResetPasswordOpen = useCallback((targetUser: AdminUser) => {
    setResetPasswordModal({
      isOpen: true,
      user: targetUser,
      resetUrl: null,
      emailSent: false,
      loading: false,
    });
  }, []);

  const handleResetPasswordConfirm = useCallback(async () => {
    const targetUser = resetPasswordModal.user;
    if (!targetUser) return;

    setResetPasswordModal((prev) => ({ ...prev, loading: true }));

    try {
      const response = await apiClient.resetUserPassword(targetUser.id);
      if (response.success) {
        const resetUrl =
          response.data != null && 'resetUrl' in response.data
            ? response.data.resetUrl
            : null;
        setResetPasswordModal((prev) => ({
          ...prev,
          resetUrl,
          emailSent: resetUrl === null,
          loading: false,
        }));
      } else {
        toast.error(response.error || 'Failed to reset password');
        setResetPasswordModal((prev) => ({
          ...prev,
          isOpen: false,
          loading: false,
        }));
      }
    } catch {
      toast.error('Failed to reset password');
      setResetPasswordModal((prev) => ({
        ...prev,
        isOpen: false,
        loading: false,
      }));
    }
  }, [resetPasswordModal.user, toast]);

  const handleResetPasswordClose = useCallback(() => {
    setResetPasswordModal({
      isOpen: false,
      user: null,
      resetUrl: null,
      emailSent: false,
      loading: false,
    });
    setCopied(false);
  }, []);

  const handleCopyPassword = useCallback(async () => {
    if (resetPasswordModal.resetUrl) {
      try {
        await navigator.clipboard.writeText(resetPasswordModal.resetUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = resetPasswordModal.resetUrl;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    }
  }, [resetPasswordModal.resetUrl]);

  const handleDeleteOpen = useCallback((targetUser: AdminUser) => {
    setDeleteModal({ isOpen: true, user: targetUser, loading: false });
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    const targetUser = deleteModal.user;
    if (!targetUser) return;

    try {
      const response = await apiClient.deleteUser(targetUser.id);
      if (response.success) {
        setUsers((prev) => prev.filter((u) => u.id !== targetUser.id));
        setDeleteModal({ isOpen: false, user: null, loading: false });
        toast.success(`User ${targetUser.email} deleted`);
      } else {
        toast.error(response.error || 'Failed to delete user');
      }
    } catch {
      toast.error('Failed to delete user');
    }
  }, [deleteModal.user, toast]);

  const handleDeleteClose = useCallback(() => {
    setDeleteModal({ isOpen: false, user: null, loading: false });
  }, []);

  // ------ Guards ------

  if (authLoading) {
    return (
      <AppLayout currentPath={pathname}>
        <div className="flex items-center justify-center h-64">
          <div className="flex items-center space-x-2">
            <LoadingSpinner size="medium" variant="primary" />
            <span className="text-gray-600">Loading...</span>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!user || user.role !== 'ADMIN') {
    return null;
  }

  // ------ Render ------

  return (
    <AppLayout currentPath={pathname}>
      <div className="flex flex-col h-full">
        {/* Dev credentials hint */}
        {process.env.NODE_ENV !== 'production' && (
          <div
            className="px-8 py-2 bg-blue-50 border-b border-blue-200 text-sm text-blue-700"
            data-cy="admin-dev-hint"
          >
            Dev mode: Default admin login &mdash; admin@example.com / AdminP@ssw0rd
          </div>
        )}

        {/* Header */}
        <PageHeader
          title="Admin Dashboard"
          description="Monitor services and manage users"
        />

        {/* Tab Navigation */}
        <div className="px-8 border-b border-gray-200 bg-white">
          <nav className="flex gap-6" aria-label="Admin tabs">
            <button
              type="button"
              onClick={() => handleTabChange('dashboard')}
              className={`relative py-3 text-sm font-medium transition-colors ${
                activeTab === 'dashboard'
                  ? 'text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              aria-current={activeTab === 'dashboard' ? 'page' : undefined}
              data-cy="admin-tab-dashboard"
            >
              Dashboard
              {activeTab === 'dashboard' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-t" />
              )}
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('users')}
              className={`relative py-3 text-sm font-medium transition-colors ${
                activeTab === 'users'
                  ? 'text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              aria-current={activeTab === 'users' ? 'page' : undefined}
              data-cy="admin-tab-users"
            >
              Users
              {activeTab === 'users' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-t" />
              )}
            </button>
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 px-8 py-6 overflow-auto bg-gray-50">
          {activeTab === 'dashboard' && (
            <DashboardTab isAdmin={user.role === 'ADMIN'} />
          )}

          {activeTab === 'users' && (
            <UsersTab
              users={users}
              pagination={usersPagination}
              isLoading={usersLoading}
              searchQuery={usersSearch}
              onSearchChange={setUsersSearch}
              onPageChange={setUsersPage}
              onToggleRole={(u) => void handleToggleRole(u)}
              onResetPassword={handleResetPasswordOpen}
              onDelete={handleDeleteOpen}
            />
          )}
        </div>
      </div>

      {/* Reset Password Modal */}
      <Modal
        isOpen={resetPasswordModal.isOpen}
        onClose={handleResetPasswordClose}
        title="Reset Password"
        size="sm"
        data-cy="admin-reset-password-modal"
        footer={
          resetPasswordModal.resetUrl || resetPasswordModal.emailSent ? (
            <div className="flex justify-end">
              <Button
                variant="primary"
                size="md"
                onClick={handleResetPasswordClose}
                data-cy="reset-password-done"
              >
                Done
              </Button>
            </div>
          ) : (
            <div className="flex gap-3 justify-end">
              <Button
                variant="secondary"
                size="md"
                onClick={handleResetPasswordClose}
                disabled={resetPasswordModal.loading}
                data-cy="admin-reset-password-cancel"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={() => void handleResetPasswordConfirm()}
                loading={resetPasswordModal.loading}
                disabled={resetPasswordModal.loading}
                data-cy="admin-reset-password-confirm"
              >
                Reset Password
              </Button>
            </div>
          )
        }
      >
        {resetPasswordModal.emailSent ? (
          <div className="space-y-4">
            <div className="flex items-center justify-center">
              <div className="flex items-center justify-center w-12 h-12 bg-emerald-100 rounded-full">
                <CheckIcon className="w-6 h-6 text-emerald-600" />
              </div>
            </div>
            <div className="text-center">
              <h3 className="text-lg font-semibold text-gray-900 mb-1">
                Email Sent
              </h3>
              <p className="text-sm text-gray-600">
                Password reset email sent to user
              </p>
            </div>
          </div>
        ) : resetPasswordModal.resetUrl ? (
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-sm text-amber-800 font-medium mb-1">
                No email provider configured — share this link with the user
              </p>
              <p className="text-xs text-amber-700">
                For{' '}
                <strong>{resetPasswordModal.user?.email}</strong>
              </p>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
              <div className="flex items-center justify-between gap-3">
                <code
                  className="text-sm font-mono text-gray-900 break-all flex-1"
                  data-cy="admin-reset-url"
                >
                  {resetPasswordModal.resetUrl}
                </code>
                <button
                  type="button"
                  onClick={() => void handleCopyPassword()}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex-shrink-0 ${
                    copied
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                  aria-label="Copy reset URL to clipboard"
                  data-cy="copy-reset-url"
                >
                  {copied ? (
                    <>
                      <CheckIcon className="w-3.5 h-3.5" />
                      Copied
                    </>
                  ) : (
                    <>
                      <CopyIcon className="w-3.5 h-3.5" />
                      Copy
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-center">
              <div className="flex items-center justify-center w-12 h-12 bg-amber-100 rounded-full">
                <svg
                  className="w-6 h-6 text-amber-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.04c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"
                  />
                </svg>
              </div>
            </div>
            <div className="text-center">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Confirm Password Reset
              </h3>
              <p className="text-sm text-gray-600">
                This will generate a one-time password reset link for{' '}
                <strong>{resetPasswordModal.user?.email}</strong>. The
                user&apos;s current password will no longer work.
              </p>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete User Modal */}
      <DeleteConfirmationModal
        isOpen={deleteModal.isOpen}
        onClose={handleDeleteClose}
        onConfirm={handleDeleteConfirm}
        itemName={deleteModal.user?.email || ''}
        itemType="user"
        loading={deleteModal.loading}
        warningMessage={
          deleteModal.user
            ? `Are you sure you want to delete the user "${deleteModal.user.email}"? All their data including filters and matches will be permanently removed.`
            : ''
        }
      />
    </AppLayout>
  );
}

// ---------------------------------------------------------------------------
// Page export
// ---------------------------------------------------------------------------

export default function AdminPage() {
  return <AdminContent />;
}
