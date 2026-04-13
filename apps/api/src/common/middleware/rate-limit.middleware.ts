import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction, RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  enabled?: boolean;
}

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private limiter: RequestHandler;
  private isEnabled: boolean;

  constructor(config?: RateLimitConfig) {
    const rateLimitConfig = config || {
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
      maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
      enabled: true,
    };

    this.isEnabled = rateLimitConfig.enabled !== false;

    if (process.env.NODE_ENV === 'test' && !process.env.TEST_RATE_LIMITING) {
      this.isEnabled = false;
    }

    if (this.isEnabled) {
      this.limiter = rateLimit({
        windowMs: rateLimitConfig.windowMs,
        max: rateLimitConfig.maxRequests,
        message: {
          error: 'Too many requests from this IP, please try again later.',
          retryAfter: Math.ceil(rateLimitConfig.windowMs / 1000),
        },
        standardHeaders: true,
        legacyHeaders: false,
        skip: (req: Request) => {
          return (
            req.path?.includes('/health') ||
            req.path?.includes('/metrics') ||
            req.path?.endsWith('.css') ||
            req.path?.endsWith('.js')
          );
        },
      });
    }
  }

  use(req: Request, res: Response, next: NextFunction) {
    if (!this.isEnabled) {
      return next();
    }

    this.limiter(req, res, next);
  }
}

export function createAuthRateLimiter(): RequestHandler {
  if (process.env.NODE_ENV === 'test' && !process.env.TEST_RATE_LIMITING) {
    return (req: Request, res: Response, next: NextFunction) => next();
  }

  return rateLimit({
    windowMs: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS || '900000'),
    max: parseInt(process.env.AUTH_RATE_LIMIT_MAX_REQUESTS || '5'),
    message: {
      error: 'Too many authentication attempts, please try again later.',
      retryAfter: Math.ceil(
        parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS || '900000') / 1000
      ),
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
  });
}

export const authRateLimiter: RequestHandler = createAuthRateLimiter();
