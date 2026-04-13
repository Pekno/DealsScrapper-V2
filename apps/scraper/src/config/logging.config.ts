/**
 * @fileoverview Scraper service logging configuration
 */

import type { ServiceLogConfig } from '@dealscrapper/shared-logging';

export const scraperLogConfig: ServiceLogConfig = {
  serviceName: 'scraper',
  defaultLevel: 'debug', // More verbose for scraper debugging
  files: {
    filename: 'scraper_%DATE%.log',
    errorFilename: 'scraper_error_%DATE%.log',
    exceptionFilename: 'scraper_exceptions_%DATE%.log',
    rejectionFilename: 'scraper_rejections_%DATE%.log',
    symlinkName: 'scraper_current.log',
  },
  maxSize: '50m', // Larger files for scraper (more verbose)
  maxFiles: '14d',
  consoleEnabled: true,
  fileEnabled: true,
};
