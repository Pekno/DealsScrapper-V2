import type { ServiceLogConfig } from '@dealscrapper/shared-logging';

/**
 * Logging configuration for the scheduler service
 * Uses structured logging with timestamped files for production debugging
 */
export const schedulerLogConfig: ServiceLogConfig = {
  serviceName: 'scheduler',
  defaultLevel: 'info',
  files: {
    filename: 'scheduler_%DATE%.log',
    errorFilename: 'scheduler_error_%DATE%.log',
    exceptionFilename: 'scheduler_exceptions_%DATE%.log',
    rejectionFilename: 'scheduler_rejections_%DATE%.log',
    symlinkName: 'scheduler_current.log',
  },
  maxSize: '20m',
  maxFiles: '14d',
  consoleEnabled: true,
  fileEnabled: true,
};
