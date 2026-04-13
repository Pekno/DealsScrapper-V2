/**
 * Debug utility for conditional logging in development
 *
 * Usage:
 *   import { debug } from '@/shared/lib/debug';
 *   debug.log('Some debug info');
 *   debug.warn('A warning');
 *
 * In production, these calls are no-ops.
 */

const isDevelopment = process.env.NODE_ENV === 'development';

/** No-op function for production */
const noop = (..._args: unknown[]): void => {
  // Intentionally empty - all logging disabled in production
};

/**
 * Debug logging utility - only logs in development mode
 */
export const debug = {
  /** Log debug information (development only) */
  log: isDevelopment ? console.log.bind(console) : noop,
  /** Log warnings (development only) */
  warn: isDevelopment ? console.warn.bind(console) : noop,
  /** Log info messages (development only) */
  info: isDevelopment ? console.info.bind(console) : noop,
  /** Log debug-level messages (development only) */
  debug: isDevelopment ? console.debug.bind(console) : noop,
};

/**
 * Namespace-specific debug loggers
 * Create focused loggers for specific features
 */
export function createDebugLogger(namespace: string) {
  const prefix = `[${namespace}]`;

  return {
    log: isDevelopment
      ? (...args: unknown[]) => console.log(prefix, ...args)
      : noop,
    warn: isDevelopment
      ? (...args: unknown[]) => console.warn(prefix, ...args)
      : noop,
    info: isDevelopment
      ? (...args: unknown[]) => console.info(prefix, ...args)
      : noop,
    error: (...args: unknown[]) => console.error(prefix, ...args),
  };
}

/**
 * Pre-defined loggers for common features
 */
export const loggers = {
  api: createDebugLogger('API'),
  auth: createDebugLogger('Auth'),
  websocket: createDebugLogger('WebSocket'),
  notifications: createDebugLogger('Notifications'),
  filters: createDebugLogger('Filters'),
  realTime: createDebugLogger('RealTimeRefresh'),
};
