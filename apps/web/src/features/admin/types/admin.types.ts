/**
 * Admin dashboard and user management types
 */

export interface ServiceHealth {
  status: string;
  details?: Record<string, unknown>;
}

export interface DashboardMetrics {
  totalUsers: number;
  totalFilters: number;
  totalMatches: number;
  activeSessions: number;
}

export interface DashboardData {
  services: {
    api: ServiceHealth;
    scraper: ServiceHealth;
    notifier: ServiceHealth;
    scheduler: ServiceHealth;
  };
  metrics: DashboardMetrics;
}

export interface ScraperBrowserPool {
  totalInstances: number;
  availableInstances: number;
  busyInstances: number;
  queuedRequests: number;
  utilizationPercentage: number;
  healthStatus: string;
}

export interface ScraperScrapingStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgWaitTime: number;
}

export interface ScraperWorker {
  id: string;
  site?: string;
  status: string;
  endpoint: string;
  currentLoad: number;
  maxConcurrentJobs: number;
  supportedJobTypes: string[];
  lastHeartbeat: string;
  browserPool?: ScraperBrowserPool;
  scraping?: ScraperScrapingStats;
}

export interface SchedulerHealthResponse {
  scheduler: ServiceHealth;
  scrapers: ScraperWorker[];
}

export interface AdminUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  emailVerified: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface PaginatedUsers {
  data: AdminUser[];
  pagination: PaginationMeta;
}

export interface ResetPasswordResponseData {
  resetUrl: string;
}

export type ResetPasswordResponse = ResetPasswordResponseData | null;
