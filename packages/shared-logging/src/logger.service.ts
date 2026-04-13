/**
 * @fileoverview Enhanced logging service with file persistence for all services
 */

import type { Injectable, LogLevel } from '@nestjs/common';
import * as winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import type {
  IEnhancedLogger,
  LoggerOptions,
  ServiceLogConfig,
} from './types.js';

/**
 * Enhanced logging service with file persistence and service-specific configuration
 * Can be used across all services (api, scraper, notifier) with appropriate configs
 */
export class EnhancedLoggerService implements IEnhancedLogger {
  private readonly winston: winston.Logger;

  constructor(config: ServiceLogConfig, options?: Partial<LoggerOptions>) {
    // Override defaults with provided options
    const logLevel =
      options?.level || process.env.LOG_LEVEL || config.defaultLevel;
    const logDir = options?.logDir || join(process.cwd(), 'logs');
    const consoleEnabled = options?.console ?? config.consoleEnabled;
    const fileEnabled = options?.file ?? config.fileEnabled;

    // Ensure log directory exists
    if (fileEnabled && !existsSync(logDir)) {
      mkdirSync(logDir, { recursive: true });
    }

    // Define log info interface for winston printf
    // TransformableInfo from winston includes all log properties
    interface LogInfo {
      timestamp?: unknown;
      level: unknown;
      message: unknown;
      context?: unknown;
      [key: string]: unknown;
    }

    // Console format with colors for development
    const consoleFormat = winston.format.combine(
      winston.format.timestamp({ format: 'MM/DD/YYYY, hh:mm:ss A' }),
      winston.format.colorize({ all: true }),
      winston.format.printf((info: LogInfo) => {
        const contextStr = info.context ? `[${String(info.context)}] ` : '';
        const timestamp = String(info.timestamp ?? new Date().toLocaleString());
        const level = String(info.level);
        const message = String(info.message);
        return `[Nest] ${process.pid}  - ${timestamp}     ${level} ${contextStr}${message}`;
      })
    );

    // File format without colors for clean file logs
    const fileFormat = winston.format.combine(
      winston.format.timestamp({ format: 'MM/DD/YYYY, hh:mm:ss A' }),
      winston.format.printf((info: LogInfo) => {
        const contextStr = info.context ? `[${String(info.context)}] ` : '';
        const timestamp = String(info.timestamp ?? new Date().toLocaleString());
        const level = String(info.level).toUpperCase().padStart(7);
        const message = String(info.message);
        return `[Nest] ${process.pid}  - ${timestamp}     ${level} ${contextStr}${message}`;
      })
    );

    // Build transports array
    const transports: winston.transport[] = [];

    // Console transport
    if (consoleEnabled) {
      transports.push(
        new winston.transports.Console({
          format: consoleFormat,
          handleExceptions: true,
          handleRejections: true,
        })
      );
    }

    // File transports
    if (fileEnabled) {
      // Main log file
      transports.push(
        new DailyRotateFile({
          filename: join(logDir, config.files.filename),
          datePattern: 'YYYY-MM-DD',
          format: fileFormat,
          handleExceptions: true,
          handleRejections: true,
          maxSize: config.maxSize,
          maxFiles: config.maxFiles,
          createSymlink: true,
          symlinkName: config.files.symlinkName,
        })
      );

      // Error-only file
      transports.push(
        new DailyRotateFile({
          filename: join(logDir, config.files.errorFilename),
          datePattern: 'YYYY-MM-DD',
          format: fileFormat,
          level: 'error',
          handleExceptions: true,
          handleRejections: true,
          maxSize: config.maxSize,
          maxFiles: '30d', // Keep error logs longer
        })
      );
    }

    // Exception handlers (only if file logging enabled)
    const exceptionHandlers: winston.transport[] = [];
    const rejectionHandlers: winston.transport[] = [];

    if (fileEnabled) {
      exceptionHandlers.push(
        new DailyRotateFile({
          filename: join(logDir, config.files.exceptionFilename),
          datePattern: 'YYYY-MM-DD',
          format: fileFormat,
          maxSize: config.maxSize,
          maxFiles: '30d',
        })
      );

      rejectionHandlers.push(
        new DailyRotateFile({
          filename: join(logDir, config.files.rejectionFilename),
          datePattern: 'YYYY-MM-DD',
          format: fileFormat,
          maxSize: config.maxSize,
          maxFiles: '30d',
        })
      );
    }

    this.winston = winston.createLogger({
      level: logLevel,
      transports,
      exceptionHandlers:
        exceptionHandlers.length > 0 ? exceptionHandlers : undefined,
      rejectionHandlers:
        rejectionHandlers.length > 0 ? rejectionHandlers : undefined,
    });

    // Log initialization
    this.winston.info(
      `Enhanced logger initialized for ${config.serviceName} service`,
      {
        context: 'EnhancedLoggerService',
      }
    );

    if (fileEnabled) {
      this.winston.info(`Log files saved to: ${logDir}`, {
        context: 'EnhancedLoggerService',
      });
    }
  }

  /**
   * Log an informational message
   */
  log(message: string, context?: string): void {
    this.winston.info(message, { context });
  }

  /**
   * Log an error message
   */
  error(message: string, trace?: string, context?: string): void {
    this.winston.error(message, { context, trace });
  }

  /**
   * Log a warning message
   */
  warn(message: string, context?: string): void {
    this.winston.warn(message, { context });
  }

  /**
   * Log a debug message
   */
  debug(message: string, context?: string): void {
    this.winston.debug(message, { context });
  }

  /**
   * Log a verbose message
   */
  verbose(message: string, context?: string): void {
    this.winston.verbose(message, { context });
  }

  /**
   * Set log levels dynamically
   */
  setLogLevels(levels: LogLevel[]): void {
    const winstonLevel = levels.includes('verbose')
      ? 'verbose'
      : levels.includes('debug')
        ? 'debug'
        : levels.includes('log')
          ? 'info'
          : levels.includes('warn')
            ? 'warn'
            : levels.includes('error')
              ? 'error'
              : 'info';

    this.winston.level = winstonLevel;
  }

  /**
   * Get the underlying Winston logger instance
   */
  getWinstonLogger(): winston.Logger {
    return this.winston;
  }

  /**
   * Create a child logger with specific context
   */
  child(context: string): winston.Logger {
    return this.winston.child({ context });
  }

  /**
   * Flush pending log writes (for graceful shutdown)
   */
  async flush(): Promise<void> {
    return new Promise((resolve) => {
      this.winston.on('finish', resolve);
      this.winston.end();
    });
  }
}

/**
 * Factory function to create logger with service config
 */
export function createServiceLogger(
  config: ServiceLogConfig,
  options?: Partial<LoggerOptions>
): EnhancedLoggerService {
  return new EnhancedLoggerService(config, options);
}
