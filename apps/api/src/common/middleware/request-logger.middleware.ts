import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { ExtendedRequest } from '../types/middleware.types.js';
import { createServiceLogger } from '@dealscrapper/shared-logging';
import { apiLogConfig } from '../../config/logging.config.js';

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private logger = createServiceLogger(apiLogConfig);

  use(req: ExtendedRequest, res: Response, next: NextFunction) {
    const requestId = uuidv4();
    const startTime = Date.now();

    // Skip logging for health endpoints
    const isHealthEndpoint = req.url.includes('/health');

    // Add request ID to the request object
    req.requestId = requestId;

    // Add request ID to response headers for tracking
    res.setHeader('X-Request-ID', requestId);

    // Log incoming request (skip for health endpoints)
    if (!isHealthEndpoint) {
      this.logger.log(
        `Incoming ${req.method} ${req.url} - IP: ${req.ip} - User-Agent: ${req.get('User-Agent')} - Request ID: ${requestId}`
      );
    }

    // Override res.end to log response
    const originalEnd = res.end;
    res.end = function (
      chunk?: string | Buffer,
      encodingOrCb?: BufferEncoding | (() => void),
      cb?: () => void
    ): Response {
      const duration = Date.now() - startTime;
      const contentLength = res.get('Content-Length') || chunk?.length || 0;

      // Log response (skip for health endpoints)
      if (!isHealthEndpoint) {
        const logLevel = res.statusCode >= 400 ? 'warn' : 'log';
        const logMessage = `${req.method} ${req.url} - ${res.statusCode} - ${duration}ms - ${contentLength} bytes - Request ID: ${requestId}`;

        if (logLevel === 'warn') {
          this.logger.warn(logMessage);
          // Log validation/error response body so the reason for 4xx is visible
          if (chunk) {
            try {
              const body = JSON.parse(chunk.toString());
              const detail = Array.isArray(body.message)
                ? body.message.join(' | ')
                : body.message;
              if (detail) {
                this.logger.warn(
                  `Response body for ${req.method} ${req.url}: ${detail}`,
                );
              }
            } catch {
              // Non-JSON body — ignore
            }
          }
        } else {
          this.logger.log(logMessage);
        }
      }

      // Call original end with proper parameter handling
      if (typeof encodingOrCb === 'function') {
        return originalEnd.call(res, chunk, encodingOrCb);
      } else {
        return originalEnd.call(res, chunk, encodingOrCb, cb);
      }
    }.bind(this);

    next();
  }
}
