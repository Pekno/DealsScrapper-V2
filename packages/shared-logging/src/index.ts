/**
 * @fileoverview Shared logging package exports
 */

// Main logger service
export {
  EnhancedLoggerService,
  createServiceLogger,
} from './logger.service.js';

// Types and interfaces
export type {
  ServiceName,
  LogFileConfig,
  ServiceLogConfig,
  IEnhancedLogger,
  LoggerOptions,
} from './types.js';

// Note: Service configurations are now maintained in each service's config folder
