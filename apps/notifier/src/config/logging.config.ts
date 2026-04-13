/**
 * @fileoverview Notifier service logging configuration
 */

import type { ServiceLogConfig } from '@dealscrapper/shared-logging';

export const notifierLogConfig: ServiceLogConfig = {
  serviceName: 'notifier',
  defaultLevel: 'info',
  files: {
    filename: 'notifier_%DATE%.log',
    errorFilename: 'notifier_error_%DATE%.log',
    exceptionFilename: 'notifier_exceptions_%DATE%.log',
    rejectionFilename: 'notifier_rejections_%DATE%.log',
    symlinkName: 'notifier_current.log',
  },
  maxSize: '20m',
  maxFiles: '14d',
  consoleEnabled: true,
  fileEnabled: true,
};
