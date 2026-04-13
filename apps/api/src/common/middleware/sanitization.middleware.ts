import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { SanitizationResult } from '../types/middleware.types.js';
import { createServiceLogger } from '@dealscrapper/shared-logging';
import { apiLogConfig } from '../../config/logging.config.js';
/**
 * Advanced input sanitization middleware
 * Provides XSS protection and NoSQL injection prevention
 * Uses battle-tested regex patterns for robust security
 */

@Injectable()
export class SanitizationMiddleware implements NestMiddleware {
  private readonly logger = createServiceLogger(apiLogConfig);

  /**
   * Comprehensive XSS protection patterns
   * Based on OWASP recommendations and security best practices
   */
  private readonly xssPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
    /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi,
    /<embed\b[^>]*>/gi,
    /<link\b[^>]*>/gi,
    /<meta\b[^>]*>/gi,
    /javascript:/gi,
    /vbscript:/gi,
    /on\w+\s*=/gi,
    /<\s*\w*\s*[^>]*(?:href|src|action)\s*=\s*["']?\s*javascript:/gi,
  ];

  /**
   * MongoDB operator patterns for injection prevention
   * Covers common NoSQL injection vectors
   */
  private readonly mongoOperators = [
    '\\$ne',
    '\\$gt',
    '\\$gte',
    '\\$lt',
    '\\$lte',
    '\\$in',
    '\\$nin',
    '\\$exists',
    '\\$regex',
    '\\$where',
    '\\$expr',
    '\\$jsonSchema',
    '\\$mod',
    '\\$all',
    '\\$elemMatch',
    '\\$size',
    '\\$type',
    '\\$geoIntersects',
    '\\$geoWithin',
    '\\$near',
    '\\$nearSphere',
    '\\$text',
    '\\$search',
    '\\$language',
    '\\$caseSensitive',
    '\\$diacriticSensitive',
  ];

  use(req: Request, res: Response, next: NextFunction) {
    // Skip sanitization for Swagger documentation routes and assets
    if (
      req.path?.startsWith('/docs') ||
      req.path?.startsWith('/api/docs') ||
      req.path?.includes('swagger-ui') ||
      req.path?.startsWith('/docs-json') ||
      req.path?.endsWith('.css') ||
      req.path?.endsWith('.js')
    ) {
      return next();
    }

    // Apply custom sanitization only (temporarily disable mongo sanitize due to compatibility issues)
    try {
      // Sanitize string inputs to prevent XSS and basic NoSQL injection
      if (req.body && typeof req.body === 'object') {
        req.body = this.sanitizeObject(req.body);
      }

      // Safely sanitize query parameters by replacing individual properties
      if (req.query && typeof req.query === 'object') {
        try {
          const sanitizedQuery = this.sanitizeObject(req.query);
          // Clear existing query properties and set sanitized ones
          const queryKeys = Object.keys(req.query);
          for (const key of queryKeys) {
            delete (req.query as Record<string, unknown>)[key];
          }
          Object.assign(req.query, sanitizedQuery);
        } catch (queryError) {
          this.logger.warn('Failed to sanitize query parameters:', queryError);
        }
      }

      // Safely sanitize params by replacing individual properties
      if (req.params && typeof req.params === 'object') {
        try {
          const sanitizedParams = this.sanitizeObject(req.params);
          const paramsKeys = Object.keys(req.params);
          for (const key of paramsKeys) {
            delete (req.params as Record<string, unknown>)[key];
          }
          Object.assign(req.params, sanitizedParams);
        } catch (paramsError) {
          this.logger.warn('Failed to sanitize params:', paramsError);
        }
      }

      next();
    } catch (error) {
      this.logger.error('Error in sanitization middleware:', error);
      next();
    }
  }

  /**
   * Sanitize string inputs against XSS and NoSQL injection
   * @param obj - The object to sanitize
   * @returns Sanitized object
   */
  private sanitizeObject<T>(obj: T): T {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj === 'string') {
      let sanitized: string = obj;

      // Apply XSS protection patterns
      for (const pattern of this.xssPatterns) {
        sanitized = sanitized.replace(pattern, '');
      }

      // Apply NoSQL injection protection
      const mongoRegex = new RegExp(this.mongoOperators.join('|'), 'gi');
      sanitized = sanitized.replace(mongoRegex, '');

      // Log suspicious patterns for monitoring
      if (sanitized !== obj) {
        this.logger.warn(
          `🧹 Sanitized potentially dangerous input: ${obj.substring(0, 100)}...`
        );
      }

      return sanitized as unknown as T;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.sanitizeObject(item)) as unknown as T;
    }

    if (typeof obj === 'object') {
      const sanitized: SanitizationResult = {};
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          // Comprehensive NoSQL injection protection
          if (typeof key === 'string') {
            // Block keys starting with $ or containing dangerous patterns
            if (
              key.startsWith('$') ||
              key.includes('__proto__') ||
              key.includes('constructor') ||
              key.includes('prototype')
            ) {
              this.logger.warn(`🚨 Blocked potentially dangerous key: ${key}`);
              continue; // Skip this key entirely
            }
            sanitized[key] = this.sanitizeObject((obj as Record<string, unknown>)[key]);
          }
        }
      }
      return sanitized as unknown as T;
    }

    return obj;
  }
}
