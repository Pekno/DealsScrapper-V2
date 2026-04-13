import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { authRateLimiter } from '../../common/middleware/rate-limit.middleware.js';

/**
 * Rate limiting guard for authentication endpoints
 * Applies stricter rate limits to prevent brute force attacks
 */
@Injectable()
export class AuthRateLimitGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    return new Promise<boolean>((resolve, reject) => {
      const next: NextFunction = (error?: Error | 'route' | 'router') => {
        if (error) {
          reject(
            new HttpException(
              {
                error:
                  'Too many authentication attempts, please try again later.',
                retryAfter: 900, // 15 minutes
              },
              HttpStatus.TOO_MANY_REQUESTS
            )
          );
        } else {
          resolve(true);
        }
      };

      authRateLimiter(request, response, next);
    });
  }
}
