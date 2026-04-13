/**
 * @fileoverview API service logging configuration
 */

import type { ServiceLogConfig } from '@dealscrapper/shared-logging';

export const apiLogConfig: ServiceLogConfig = {
  serviceName: 'api',
  defaultLevel: 'info',
  files: {
    filename: 'api_%DATE%.log',
    errorFilename: 'api_error_%DATE%.log',
    exceptionFilename: 'api_exceptions_%DATE%.log',
    rejectionFilename: 'api_rejections_%DATE%.log',
    symlinkName: 'api_current.log',
  },
  maxSize: '20m',
  maxFiles: '14d',
  consoleEnabled: true,
  fileEnabled: true,
};
