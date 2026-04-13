/**
 * @fileoverview Shared logging types and interfaces
 */

import { LogLevel } from '@nestjs/common';
import * as winston from 'winston';

/**
 * Supported service names for logging configuration
 */
export type ServiceName = 'api' | 'scraper' | 'notifier' | 'scheduler';

/**
 * Log file naming configuration
 */
export interface LogFileConfig {
  /** Main log file pattern */
  filename: string;
  /** Error-only log file pattern */
  errorFilename: string;
  /** Exception log file pattern */
  exceptionFilename: string;
  /** Rejection log file pattern */
  rejectionFilename: string;
  /** Current log symlink name */
  symlinkName: string;
}

/**
 * Service-specific logging configuration
 */
export interface ServiceLogConfig {
  /** Service name */
  serviceName: ServiceName;
  /** Default log level */
  defaultLevel: string;
  /** Log file configuration */
  files: LogFileConfig;
  /** Maximum file size before rotation */
  maxSize: string;
  /** How long to keep log files */
  maxFiles: string;
  /** Console logging enabled */
  consoleEnabled: boolean;
  /** File logging enabled */
  fileEnabled: boolean;
}

/**
 * Enhanced logger interface compatible with NestJS
 */
export interface IEnhancedLogger {
  log(message: string, context?: string): void;
  error(message: string, trace?: string, context?: string): void;
  warn(message: string, context?: string): void;
  debug(message: string, context?: string): void;
  verbose(message: string, context?: string): void;
  setLogLevels(levels: LogLevel[]): void;
  getWinstonLogger(): winston.Logger;
  child(context: string): winston.Logger;
  flush(): Promise<void>;
}

/**
 * Logger configuration options
 */
export interface LoggerOptions {
  /** Override default log level */
  level?: string;
  /** Custom log directory */
  logDir?: string;
  /** Enable/disable console logging */
  console?: boolean;
  /** Enable/disable file logging */
  file?: boolean;
}
