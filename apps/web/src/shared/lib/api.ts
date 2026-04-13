/**
 * API Client for DealsScrapper Backend Services
 * Handles communication with all backend services (API, Scraper, Notifier, Scheduler)
 */

import { loggers } from './debug';
import { getRuntimeConfig } from './runtime-config';

const log = loggers.api;

function getApiBaseUrl() { return getRuntimeConfig().API_URL; }
function getScraperBaseUrl() { return getRuntimeConfig().SCRAPER_URL; }
function getNotifierBaseUrl() { return getRuntimeConfig().NOTIFIER_URL; }
function getSchedulerBaseUrl() { return getRuntimeConfig().SCHEDULER_URL; }

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  expires_in: string;
  user: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    emailVerified: boolean;
    role: string;
    createdAt: Date;
  };
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface RegistrationData {
  user: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    emailVerified: boolean;
    role: string;
    createdAt: Date;
  };
  nextStep: 'verify-email';
}

export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface UpdateProfileRequest {
  firstName?: string;
  lastName?: string;
  email?: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

// Re-export filter types for convenience
export type {
  Filter,
  FilterWithMetrics,
  FilterListResponse,
  CreateFilterRequest,
  UpdateFilterRequest,
  Category,
  FilterStats,
  RuleBasedFilterExpression,
  FilterRule,
  FilterRuleGroup,
} from '@/features/filters/types/filter.types';

// Re-export article types for convenience
export type { ArticleListResponse } from '../types/article';

// Backend API response types for matches endpoint
export interface BackendMatchResponseDto {
  id: string;
  filterId: string;
  filterName: string;
  articleId: string;
  score: number;
  notified: boolean;
  notifiedAt?: Date;
  createdAt: Date;
  article: {
    id: string;
    title: string;
    currentPrice: number;
    originalPrice?: number;
    temperature: number;
    merchant: string;
    category: string;
    url: string;
    imageUrl?: string;
    publishedAt?: Date;
    scrapedAt: Date;
    expiresAt?: Date;
    siteId: string;
  };
}

export interface BackendMatchListResponseDto {
  matches: BackendMatchResponseDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

class ApiClient {
  private _lastTokenState: string | null = null;

  private getAuthHeaders(): HeadersInit {
    const token = this.getToken();
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  private async handleResponse<T>(response: Response): Promise<ApiResponse<T>> {
    try {
      const responseData = await response.json();

      if (!response.ok) {
        // Handle 401 Unauthorized - token expired or invalid
        if (response.status === 401) {
          log.warn('Authentication failed - token may be expired');
          this.removeToken();
          // Note: We intentionally do NOT hard-redirect here via window.location.href.
          // The AuthProvider's initializeAuth() sets user to null on auth failure,
          // and page-level useEffects handle redirecting to /login when user is null.
          // A hard redirect here would cause cascading failures when multiple concurrent
          // API calls are in-flight (e.g., admin dashboard health checks + getProfile).
        }

        return {
          success: false,
          error: (responseData?.message ||
            responseData?.error ||
            `HTTP ${response.status}`) as string,
        };
      }

      // Backend returns StandardApiResponse<T> format: { success: boolean, data: T, message?: string }
      // We need to extract the actual data from the 'data' property
      if (responseData?.success === true && responseData?.data !== undefined) {
        return {
          success: true,
          data: responseData.data as T,
        };
      }

      // Fallback for responses that don't follow StandardApiResponse format
      return {
        success: true,
        data: responseData as T,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  getToken(): string | null {
    if (typeof window === 'undefined') return null;
    try {
      const token = localStorage.getItem('auth_token');

      // Only log token retrieval when there are actual changes (not periodic checks)
      const shouldDebugLog =
        process.env.NODE_ENV === 'development' &&
        (!this._lastTokenState || this._lastTokenState !== (token || '')) &&
        Math.random() < 0.1; // Only log 10% of the time to reduce spam

      if (shouldDebugLog) {
        const timestamp = new Date().toISOString();
        const hasToken = !!token;

        // Store last token state to avoid repeated logging
        this._lastTokenState = token || '';

        // Only do comprehensive debugging if there are actual issues
        if (!token && localStorage.length === 0) {
          log.warn(
            'localStorage is completely empty - possible storage corruption or incognito mode'
          );
        }

        // Verify token format if present and changed
        if (token) {
          const tokenParts = token.split('.');
          if (tokenParts.length !== 3) {
            log.warn(
              'Token format appears invalid - expected 3 parts (header.payload.signature), got:',
              tokenParts.length
            );
          }
        }
      }

      return token;
    } catch (error) {
      log.error('Error reading token from localStorage:', error);

      // Attempt localStorage recovery with enhanced diagnostics
      try {
        localStorage.setItem('test_recovery', 'test');
        const recovered = localStorage.getItem('test_recovery');
        localStorage.removeItem('test_recovery');

        if (recovered === 'test') {
          // Try to get token again after recovery
          const retryToken = localStorage.getItem('auth_token');
          return retryToken;
        } else {
          log.error(
            'localStorage recovery failed - storage may be corrupted or disabled'
          );
        }
      } catch (recoveryError) {
        log.error('localStorage recovery attempt failed:', recoveryError);
      }

      return null;
    }
  }

  setToken(token: string): void {
    if (typeof window === 'undefined') return;
    try {
      // Validate token before storing
      if (!token || typeof token !== 'string' || token.trim().length === 0) {
        throw new Error('Invalid token provided');
      }

      localStorage.setItem('auth_token', token);

      // Update tracking state and only log when necessary
      this._lastTokenState = token;

      // Verify token was actually stored
      const storedToken = localStorage.getItem('auth_token');
      if (storedToken !== token) {
        throw new Error('Token verification failed after storage');
      }
    } catch (error) {
      log.error('Error storing token in localStorage:', error);

      // Attempt to clear corrupted storage and retry once
      try {
        localStorage.removeItem('auth_token');
        localStorage.setItem('auth_token', token);

        const retryVerification = localStorage.getItem('auth_token');
        if (retryVerification !== token) {
          throw new Error('Token storage failed even after retry');
        }
      } catch (retryError) {
        log.error('Token storage retry failed:', retryError);
        throw retryError; // Re-throw to indicate storage failure
      }
    }
  }

  removeToken(): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem('auth_token');

      // Update tracking state
      this._lastTokenState = null;

      // Verify token was actually removed
      const remainingToken = localStorage.getItem('auth_token');
      if (remainingToken !== null) {
        log.warn(
          'Token still exists after removal attempt, forcing cleanup...'
        );
        // Force cleanup by setting to empty and removing again
        localStorage.setItem('auth_token', '');
        localStorage.removeItem('auth_token');

        const finalCheck = localStorage.getItem('auth_token');
        if (finalCheck !== null) {
          log.error(
            'Unable to remove token from localStorage - storage may be corrupted'
          );
        }
      }
    } catch (error) {
      log.error('Error removing token from localStorage:', error);
    }
  }

  // Authentication Methods
  async login(credentials: LoginRequest): Promise<ApiResponse<LoginResponse>> {
    const response = await fetch(`${getApiBaseUrl()}/auth/login`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(credentials),
    });

    return this.handleResponse<LoginResponse>(response);
  }

  async register(
    userData: RegisterRequest
  ): Promise<ApiResponse<RegistrationData>> {
    const response = await fetch(`${getApiBaseUrl()}/auth/register`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(userData),
    });

    return this.handleResponse<RegistrationData>(response);
  }

  async logout(): Promise<ApiResponse<void>> {
    const response = await fetch(`${getApiBaseUrl()}/auth/logout`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
    });

    return this.handleResponse<void>(response);
  }

  async getProfile(): Promise<ApiResponse<User>> {
    const response = await fetch(`${getApiBaseUrl()}/users/profile`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });

    const result = await this.handleResponse<User>(response);

    if (!result.success) {
      log.warn('Profile request failed:', result.error);
    }

    return result;
  }

  async refreshToken(): Promise<ApiResponse<{ access_token: string }>> {
    const response = await fetch(`${getApiBaseUrl()}/auth/refresh`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
    });

    return this.handleResponse<{ access_token: string }>(response);
  }

  async resendVerificationEmail(
    userId: string
  ): Promise<ApiResponse<{ message: string }>> {
    const response = await fetch(`${getApiBaseUrl()}/auth/resend-verification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId }),
    });

    return this.handleResponse<{ message: string }>(response);
  }

  async verifyEmail(token: string): Promise<ApiResponse<{ message: string }>> {
    const response = await fetch(
      `${getApiBaseUrl()}/auth/verify-email?token=${encodeURIComponent(token)}`,
      {
        method: 'GET',
        headers: this.getAuthHeaders(),
      }
    );

    return this.handleResponse<{ message: string }>(response);
  }

  // User Profile Management Methods
  async updateProfile(
    userData: UpdateProfileRequest
  ): Promise<ApiResponse<User>> {
    const response = await fetch(`${getApiBaseUrl()}/users/profile`, {
      method: 'PATCH',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(userData),
    });

    return this.handleResponse<User>(response);
  }

  async changePassword(
    passwordData: ChangePasswordRequest
  ): Promise<ApiResponse<void>> {
    const response = await fetch(`${getApiBaseUrl()}/users/change-password`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(passwordData),
    });

    return this.handleResponse<void>(response);
  }

  // Health Check Methods
  async checkApiHealth(): Promise<
    ApiResponse<{ status: string; timestamp: string }>
  > {
    const response = await fetch(`${getApiBaseUrl()}/health`);
    return this.handleResponse<{ status: string; timestamp: string }>(response);
  }

  async checkScraperHealth(): Promise<
    ApiResponse<{ status: string; timestamp: string }>
  > {
    const response = await fetch(`${getScraperBaseUrl()}/health`);
    return this.handleResponse<{ status: string; timestamp: string }>(response);
  }

  async checkNotifierHealth(): Promise<
    ApiResponse<{ status: string; timestamp: string }>
  > {
    const response = await fetch(`${getNotifierBaseUrl()}/health`);
    return this.handleResponse<{ status: string; timestamp: string }>(response);
  }

  async checkSchedulerHealth(): Promise<
    ApiResponse<{ status: string; timestamp: string }>
  > {
    const response = await fetch(`${getSchedulerBaseUrl()}/health`);
    return this.handleResponse<{ status: string; timestamp: string }>(response);
  }

  // Filter Management (API Service)
  async getFilters(query?: {
    page?: number;
    limit?: number;
    active?: boolean;
    category?: string;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<
    ApiResponse<
      import('@/features/filters/types/filter.types').FilterListResponse
    >
  > {
    const queryParams = new URLSearchParams();
    if (query) {
      Object.entries(query).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, String(value));
        }
      });
    }

    const url = queryParams.toString()
      ? `${getApiBaseUrl()}/filters?${queryParams.toString()}`
      : `${getApiBaseUrl()}/filters`;

    const response = await fetch(url, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });

    return this.handleResponse<
      import('@/features/filters/types/filter.types').FilterListResponse
    >(response);
  }

  async getFilter(
    filterId: string
  ): Promise<
    ApiResponse<import('@/features/filters/types/filter.types').Filter>
  > {
    const response = await fetch(`${getApiBaseUrl()}/filters/${filterId}`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });

    return this.handleResponse<
      import('@/features/filters/types/filter.types').Filter
    >(response);
  }

  async createFilter(
    filterData: import('@/features/filters/types/filter.types').CreateFilterRequest
  ): Promise<
    ApiResponse<import('@/features/filters/types/filter.types').Filter>
  > {
    const response = await fetch(`${getApiBaseUrl()}/filters`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(filterData),
    });

    return this.handleResponse<
      import('@/features/filters/types/filter.types').Filter
    >(response);
  }

  async updateFilter(
    filterId: string,
    filterData: import('@/features/filters/types/filter.types').UpdateFilterRequest
  ): Promise<
    ApiResponse<import('@/features/filters/types/filter.types').Filter>
  > {
    const response = await fetch(`${getApiBaseUrl()}/filters/${filterId}`, {
      method: 'PATCH',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(filterData),
    });

    return this.handleResponse<
      import('@/features/filters/types/filter.types').Filter
    >(response);
  }

  async deleteFilter(filterId: string): Promise<ApiResponse<void>> {
    const response = await fetch(`${getApiBaseUrl()}/filters/${filterId}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders(),
    });

    return this.handleResponse<void>(response);
  }

  async toggleFilterActive(
    filterId: string
  ): Promise<
    ApiResponse<import('@/features/filters/types/filter.types').Filter>
  > {
    const response = await fetch(`${getApiBaseUrl()}/filters/${filterId}/toggle`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
    });

    return this.handleResponse<
      import('@/features/filters/types/filter.types').Filter
    >(response);
  }

  async getFilterMatches(
    filterId: string,
    page: number = 1,
    limit: number = 20,
    search?: string,
    sortBy?: string,
    sortOrder?: 'asc' | 'desc'
  ): Promise<ApiResponse<BackendMatchListResponseDto>> {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });

    if (search) {
      params.append('search', search);
    }

    if (sortBy) {
      params.append('sortBy', sortBy);
    }

    if (sortOrder) {
      params.append('sortOrder', sortOrder);
    }

    const response = await fetch(
      `${getApiBaseUrl()}/filters/${filterId}/matches?${params.toString()}`,
      {
        method: 'GET',
        headers: this.getAuthHeaders(),
      }
    );

    return this.handleResponse<BackendMatchListResponseDto>(response);
  }

  async getFilterStats(
    filterId: string
  ): Promise<
    ApiResponse<import('@/features/filters/types/filter.types').FilterStats>
  > {
    const response = await fetch(`${getApiBaseUrl()}/filters/${filterId}/stats`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });

    return this.handleResponse<
      import('@/features/filters/types/filter.types').FilterStats
    >(response);
  }

  async testFilter(filterData: {
    filterExpression: import('@/features/filters/types/filter.types').RuleBasedFilterExpression;
  }): Promise<
    ApiResponse<{
      valid: boolean;
      message: string;
      sampleMatches: number;
      estimatedMatchRate: number;
      avgScore: number;
    }>
  > {
    const response = await fetch(`${getApiBaseUrl()}/filters/test`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(filterData),
    });

    return this.handleResponse<{
      valid: boolean;
      message: string;
      sampleMatches: number;
      estimatedMatchRate: number;
      avgScore: number;
    }>(response);
  }

  async getFilterCount(): Promise<ApiResponse<number>> {
    const response = await fetch(`${getApiBaseUrl()}/filters/count`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });

    return this.handleResponse<number>(response);
  }

  async getFilterScrapingStatus(
    filterId: string
  ): Promise<
    ApiResponse<
      import('@/features/filters/types/filter.types').FilterScrapingStatus
    >
  > {
    const response = await fetch(
      `${getApiBaseUrl()}/filters/${filterId}/scraping-status`,
      {
        method: 'GET',
        headers: this.getAuthHeaders(),
      }
    );

    return this.handleResponse<
      import('@/features/filters/types/filter.types').FilterScrapingStatus
    >(response);
  }

  // Categories (API Service)
  async getCategories(
    find?: string
  ): Promise<
    ApiResponse<import('@/features/filters/types/filter.types').Category[]>
  > {
    const url = find
      ? `${getApiBaseUrl()}/categories?find=${encodeURIComponent(find)}`
      : `${getApiBaseUrl()}/categories`;

    const response = await fetch(url, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });

    return this.handleResponse<
      import('@/features/filters/types/filter.types').Category[]
    >(response);
  }

  // Generic HTTP Methods (defaults to API service)
  async get<T>(endpoint: string, baseUrl?: string): Promise<ApiResponse<T>> {
    const response = await fetch(`${baseUrl || getApiBaseUrl()}${endpoint}`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });

    return this.handleResponse<T>(response);
  }

  async post<T>(
    endpoint: string,
    data?: unknown,
    baseUrl?: string
  ): Promise<ApiResponse<T>> {
    const response = await fetch(`${baseUrl || getApiBaseUrl()}${endpoint}`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: data ? JSON.stringify(data) : undefined,
    });

    return this.handleResponse<T>(response);
  }

  async put<T>(
    endpoint: string,
    data?: unknown,
    baseUrl?: string
  ): Promise<ApiResponse<T>> {
    const response = await fetch(`${baseUrl || getApiBaseUrl()}${endpoint}`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: data ? JSON.stringify(data) : undefined,
    });

    return this.handleResponse<T>(response);
  }

  async delete<T>(endpoint: string, baseUrl?: string): Promise<ApiResponse<T>> {
    const response = await fetch(`${baseUrl || getApiBaseUrl()}${endpoint}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders(),
    });

    return this.handleResponse<T>(response);
  }

  async patch<T>(
    endpoint: string,
    data?: unknown,
    baseUrl?: string
  ): Promise<ApiResponse<T>> {
    const response = await fetch(`${baseUrl || getApiBaseUrl()}${endpoint}`, {
      method: 'PATCH',
      headers: this.getAuthHeaders(),
      body: data ? JSON.stringify(data) : undefined,
    });

    return this.handleResponse<T>(response);
  }

  // Notification-specific methods (use NOTIFIER service)
  async getNotifications<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.get<T>(endpoint, getNotifierBaseUrl());
  }

  async postNotification<T>(
    endpoint: string,
    data?: unknown
  ): Promise<ApiResponse<T>> {
    return this.post<T>(endpoint, data, getNotifierBaseUrl());
  }

  async putNotification<T>(
    endpoint: string,
    data?: unknown
  ): Promise<ApiResponse<T>> {
    return this.put<T>(endpoint, data, getNotifierBaseUrl());
  }

  async deleteNotification<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.delete<T>(endpoint, getNotifierBaseUrl());
  }

  // Admin methods
  async getAdminDashboard(): Promise<
    ApiResponse<import('@/features/admin/types/admin.types').DashboardData>
  > {
    return this.get<import('@/features/admin/types/admin.types').DashboardData>(
      '/admin/dashboard'
    );
  }

  async getAdminHealthApi(): Promise<
    ApiResponse<import('@/features/admin/types/admin.types').ServiceHealth>
  > {
    return this.get<import('@/features/admin/types/admin.types').ServiceHealth>(
      '/admin/health/api'
    );
  }

  async getAdminHealthNotifier(): Promise<
    ApiResponse<import('@/features/admin/types/admin.types').ServiceHealth>
  > {
    return this.get<import('@/features/admin/types/admin.types').ServiceHealth>(
      '/admin/health/notifier'
    );
  }

  async getAdminHealthScheduler(): Promise<
    ApiResponse<import('@/features/admin/types/admin.types').SchedulerHealthResponse>
  > {
    return this.get<import('@/features/admin/types/admin.types').SchedulerHealthResponse>(
      '/admin/health/scheduler'
    );
  }

  async getAdminMetrics(): Promise<
    ApiResponse<import('@/features/admin/types/admin.types').DashboardMetrics>
  > {
    return this.get<import('@/features/admin/types/admin.types').DashboardMetrics>(
      '/admin/metrics'
    );
  }

  async getAdminUsers(params?: {
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<
    ApiResponse<import('@/features/admin/types/admin.types').PaginatedUsers>
  > {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, String(value));
        }
      });
    }
    const queryString = queryParams.toString();
    const endpoint = queryString
      ? `/admin/users?${queryString}`
      : '/admin/users';
    return this.get<
      import('@/features/admin/types/admin.types').PaginatedUsers
    >(endpoint);
  }

  async updateUserRole(
    userId: string,
    role: string
  ): Promise<
    ApiResponse<import('@/features/admin/types/admin.types').AdminUser>
  > {
    return this.patch<import('@/features/admin/types/admin.types').AdminUser>(
      `/admin/users/${userId}/role`,
      { role }
    );
  }

  async deleteUser(userId: string): Promise<ApiResponse<null>> {
    return this.delete<null>(`/admin/users/${userId}`);
  }

  async resetUserPassword(
    userId: string
  ): Promise<
    ApiResponse<
      import('@/features/admin/types/admin.types').ResetPasswordResponse
    >
  > {
    return this.post<
      import('@/features/admin/types/admin.types').ResetPasswordResponse
    >(`/admin/users/${userId}/reset-password`);
  }

  async forgotPassword(email: string): Promise<ApiResponse<null>> {
    return this.post<null>('/auth/forgot-password', { email });
  }

  async validateResetToken(
    token: string
  ): Promise<ApiResponse<{ valid: boolean; message?: string }>> {
    const response = await fetch(
      `${getApiBaseUrl()}/auth/validate-reset-token?token=${encodeURIComponent(token)}`,
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      }
    );

    return this.handleResponse<{ valid: boolean; message?: string }>(response);
  }

  async resetPassword(token: string, newPassword: string): Promise<ApiResponse<null>> {
    return this.post<null>('/auth/reset-password', { token, newPassword });
  }
}

// Export singleton instance
export const apiClient = new ApiClient();

// Export the class for testing purposes
export { ApiClient };
