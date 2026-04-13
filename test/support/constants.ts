/**
 * Test Constants and Configuration
 * Centralized configuration for Cypress tests
 */

/**
 * Maximum timeouts for various operations
 * These should be used sparingly - prefer cy.intercept/wait patterns
 */
export const TIMEOUTS = {
  // Email delivery (MailHog polling)
  EMAIL_DELIVERY: 30000,

  // Service health checks
  SERVICE_HEALTH: 10000,

  // Worker pool registration wait time (workers register after service startup)
  WORKER_POOL_READY: 30000,

  // Database operations via cy.task()
  DATABASE_OPERATION: 5000,

  // Filter matching and scraping operations
  FILTER_MATCHING: 15000,
  SCRAPING_OPERATION: 20000,

  // Page loads and navigation
  PAGE_LOAD: 30000,
  PAGE_TRANSITION: 10000,

  // API responses (fallback when intercept not available)
  API_RESPONSE: 10000,

  // UI element interactions
  ELEMENT_VISIBLE: 10000,
  ANIMATION: 1000,

  // Polling intervals
  EMAIL_POLL_INTERVAL: 2000,
  STATUS_POLL_INTERVAL: 1000,
} as const;

/**
 * API Route patterns for cy.intercept()
 */
export const API_ROUTES = {
  // Authentication
  LOGIN: '**/auth/login',
  REGISTER: '**/auth/register',
  LOGOUT: '**/auth/logout',
  VERIFY_EMAIL: '**/auth/verify-email*',
  REFRESH_TOKEN: '**/auth/refresh',

  // Filters
  FILTERS_LIST: '**/filters',
  FILTERS_CREATE: '**/filters',
  FILTERS_UPDATE: '**/filters/*',
  FILTERS_DELETE: '**/filters/*',
  FILTERS_DETAIL: '**/filters/*',

  // Categories
  CATEGORIES_LIST: '**/categories',
  CATEGORIES_SEARCH: '**/categories\?find=*&siteId=*',

  // Matches
  MATCHES_LIST: '**/filters/*/matches',

  // User
  USER_PROFILE: '**/users/profile',
  USER_UPDATE: '**/users/me',

  // Notifications
  NOTIFICATIONS_LIST: '**/notifications',
  NOTIFICATIONS_READ: '**/notifications/*/read',

  // Password reset
  FORGOT_PASSWORD: '**/auth/forgot-password',
  RESET_PASSWORD: '**/auth/reset-password',

  // Admin
  ADMIN_DASHBOARD: '**/admin/dashboard',
  ADMIN_HEALTH_API: '**/admin/health/api',
  ADMIN_HEALTH_NOTIFIER: '**/admin/health/notifier',
  ADMIN_HEALTH_SCHEDULER: '**/admin/health/scheduler',
  ADMIN_METRICS: '**/admin/metrics',
  ADMIN_USERS: '**/admin/users',
  ADMIN_USER_ROLE: '**/admin/users/*/role',
  ADMIN_USER_DELETE: '**/admin/users/*',
  ADMIN_USER_RESET_PASSWORD: '**/admin/users/*/reset-password',
} as const;

/**
 * Test user configurations
 */
export const TEST_USERS = {
  DEFAULT: {
    email: 'user@example.com',
    password: 'StrongP@ssw0rd',
    firstName: 'John',
    lastName: 'Doe',
  },
  ADMIN: {
    email: 'admin@example.com',
    password: 'AdminP@ssw0rd',
    firstName: 'Admin',
    lastName: 'User',
  },
} as const;

/**
 * Data-cy attribute selectors (for reference and autocomplete)
 */
export const SELECTORS = {
  // Authentication
  AUTH: {
    EMAIL_INPUT: '[data-cy=email-input]',
    PASSWORD_INPUT: '[data-cy=password-input]',
    CONFIRM_PASSWORD_INPUT: '[data-cy=confirm-password-input]',
    FIRST_NAME_INPUT: '[data-cy=first-name-input]',
    LAST_NAME_INPUT: '[data-cy=last-name-input]',
    LOGIN_SUBMIT: '[data-cy=login-submit]',
    REGISTER_SUBMIT: '[data-cy=register-submit]',
    LOGOUT_BUTTON: '[data-cy=logout-button]',
    USER_MENU: '[data-cy=user-menu]',
    TERMS_CHECKBOX: '[data-cy=terms-checkbox]',
  },

  // Filters
  FILTERS: {
    CREATE_BUTTON: '[data-cy=create-filter-button]',
    FILTER_CARD: '[data-cy=filter-card]',
    FILTER_GRID: '[data-cy=filter-grid]',
    FILTER_FORM: '[data-cy=filter-form]',
    NAME_INPUT: '[data-cy=filter-name-input]',
    DESCRIPTION_INPUT: '[data-cy=filter-description-input]',
    SUBMIT_CREATE: '[data-cy=create-filter-submit]',
    SUBMIT_UPDATE: '[data-cy=update-filter-submit]',
    EDIT_BUTTON: '[data-cy=edit-filter-button]',
    DELETE_BUTTON: '[data-cy=delete-filter-button]',
    CANCEL_BUTTON: '[data-cy=cancel-edit-button]',
    SEARCH_INPUT: '[data-cy=filter-search-input]',
  },

  // Categories
  CATEGORIES: {
    SEARCH_INPUT: '[data-cy=category-search-input]',
    SEARCH_DROPDOWN: '[data-cy=category-search-dropdown]',
    OPTION_PREFIX: '[data-cy^="category-option-"]',
    SELECTED_PREFIX: '[data-cy^="selected-category-"]',
  },

  // Sites (multi-site support)
  SITES: {
    SELECTOR: '[data-cy=site-selector]',
    SITE_BUTTON: (siteName: string) => `[data-cy=site-selector-${siteName}]`,
    ERROR: '[data-cy=site-selector-error]',
    COUNT: '[data-cy=site-selector-count]',
  },

  // Rules
  RULES: {
    ADD_BUTTON: '[data-cy=add-rule-button]',
    FIELD_SELECT: (index: number) => `[data-cy=rule-field-select-${index}]`,
    OPERATOR_SELECT: (field: string, index: number) =>
      `[data-cy=rule-operator-select-${field}-${index}]`,
    VALUE_INPUT: (field: string, operator: string, index: number) =>
      `[data-cy=rule-value-input-${field}-${operator}-${index}]`,
    FIELD_OPTION: (field: string) => `[data-cy=field-option-${field}]`,
    OPERATOR_OPTION: (operator: string) =>
      `[data-cy=operator-option-${operator}]`,
  },

  // Notifications
  NOTIFICATIONS: {
    IMMEDIATE_CHECKBOX_LABEL:
      '[data-cy=immediate-notifications-checkbox-label]',
  },

  // Password reset
  PASSWORD_RESET: {
    FORGOT_EMAIL: '[data-cy=forgot-password-email]',
    FORGOT_SUBMIT: '[data-cy=forgot-password-submit]',
    FORGOT_CONFIRMATION: '[data-cy=forgot-password-confirmation]',
    RESET_NEW_PASSWORD: '[data-cy=reset-password-new]',
    RESET_CONFIRM_PASSWORD: '[data-cy=reset-password-confirm]',
    RESET_SUBMIT: '[data-cy=reset-password-submit]',
    RESET_SUCCESS: '[data-cy=reset-password-success]',
    RESET_ERROR: '[data-cy=reset-password-error]',
  },

  // Toast notifications
  TOAST: {
    SUCCESS: '[data-cy=toast-success]',
    ERROR: '[data-cy=toast-error]',
    TITLE: '[data-cy=toast-title]',
    MESSAGE: '[data-cy=toast-message]',
  },

  // Error states
  ERRORS: {
    LOGIN_ERROR: '[data-cy=login-error]',
    REGISTRATION_ERROR: '[data-cy=registration-error]',
    FORM_VALIDATION_ERRORS: '[data-cy=form-validation-errors]',
    FILTER_CREATION_ERROR: '[data-cy=filter-creation-error]',
  },

  // Modals
  MODAL: {
    DELETE_CONFIRMATION: '[data-cy=delete-confirmation-modal]',
    CONFIRM_DELETE: '[data-cy=confirm-delete-button]',
    CANCEL_DELETE: '[data-cy=cancel-delete-button]',
  },

  // Admin
  ADMIN: {
    // Tabs
    TAB_DASHBOARD: '[data-cy=admin-tab-dashboard]',
    TAB_USERS: '[data-cy=admin-tab-users]',

    // Dashboard content
    DASHBOARD_CONTENT: '[data-cy=admin-dashboard-content]',
    SERVICE_HEALTH_SECTION: '[data-cy=service-health-section]',
    SYSTEM_METRICS_SECTION: '[data-cy=system-metrics-section]',
    SERVICE_HEALTH_CARD: (name: string) =>
      `[data-cy=service-health-card-${name}]`,
    METRIC_CARD: (label: string) => `[data-cy=metric-card-${label}]`,
    METRIC_VALUE: '[data-cy=metric-value]',
    SCRAPER_WORKER_CARD: '[data-cy=scraper-worker-card]',
    METRICS_CARD: '[data-cy=metrics-card]',
    DEV_HINT: '[data-cy=admin-dev-hint]',

    // Users content
    USERS_CONTENT: '[data-cy=admin-users-content]',
    USER_SEARCH: '[data-cy=admin-user-search]',
    USER_TABLE: '[data-cy=admin-user-table]',
    USER_ROW: (email: string) => `[data-cy="admin-user-row-${email}"]`,
    USER_ACTIONS: (email: string) => `[data-cy="admin-user-actions-${email}"]`,
    ACTION_TOGGLE_ROLE: '[data-cy=admin-action-toggle-role]',
    ACTION_RESET_PASSWORD: '[data-cy=admin-action-reset-password]',
    ACTION_DELETE_USER: '[data-cy=admin-action-delete-user]',

    // Pagination
    PAGINATION: '[data-cy=admin-pagination]',
    PAGINATION_INFO: '[data-cy=admin-pagination-info]',
    PAGINATION_PREV: '[data-cy=admin-pagination-prev]',
    PAGINATION_NEXT: '[data-cy=admin-pagination-next]',
    PAGINATION_PAGE: '[data-cy=admin-pagination-page]',

    // Reset password modal
    RESET_PASSWORD_MODAL: '[data-cy=admin-reset-password-modal]',
    RESET_PASSWORD_CONFIRM: '[data-cy=admin-reset-password-confirm]',
    RESET_PASSWORD_CANCEL: '[data-cy=admin-reset-password-cancel]',
    RESET_PASSWORD_DONE: '[data-cy=reset-password-done]',
    TEMP_PASSWORD: '[data-cy=admin-temp-password]',
    COPY_PASSWORD: '[data-cy=admin-copy-password]',
    RESET_URL: '[data-cy=admin-reset-url]',
    COPY_RESET_URL: '[data-cy=copy-reset-url]',

    // Feedback
    FEEDBACK_SUCCESS: '[data-cy=admin-feedback-success]',
    FEEDBACK_ERROR: '[data-cy=admin-feedback-error]',
  },
} as const;

/**
 * Test data factories
 */
export const TEST_DATA = {
  /**
   * Generate unique test user data
   */
  createUser: () => ({
    email: `test.user.${Date.now()}@example.com`,
    password: 'TestPassword123!',
    firstName: 'Test',
    lastName: 'User',
  }),

  /**
   * Generate unique filter data
   */
  createFilter: (overrides?: Partial<FilterData>) => ({
    name: `Test Filter ${Date.now()}`,
    description: `Test filter for automation testing - ${Date.now()}`,
    rules: [
      {
        field: 'title',
        operator: 'CONTAINS',
        value: 'laptop',
        weight: 1.0,
      },
      {
        field: 'currentPrice',
        operator: '<',
        value: '1000',
        weight: 0.8,
      },
    ],
    categories: ['accessoires-gaming', 'high-tech'],
    immediateNotifications: true,
    ...overrides,
  }),
} as const;

/**
 * TypeScript types for test data
 */
export interface FilterData {
  name: string;
  description: string;
  rules: Array<{
    field: string;
    operator: string;
    value: string;
    weight?: number;
  }>;
  categories: string[];
  immediateNotifications: boolean;
  /** Sites to enable for this filter (multi-site support) */
  enabledSites?: Array<'dealabs' | 'vinted' | 'leboncoin'>;
}

export interface UserData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

/**
 * Retry configuration for flaky operations
 */
export const RETRY_CONFIG = {
  ATTEMPTS: 3,
  DELAY: 1000,
} as const;
