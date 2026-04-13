import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedRequest } from '@dealscrapper/shared-types';

/**
 * Metadata key for the RequireEmailVerification decorator
 */
export const EMAIL_VERIFICATION_REQUIRED_KEY = 'emailVerificationRequired';

/**
 * Guard that enforces email verification requirement for protected endpoints
 * Only allows access if the authenticated user has a verified email address
 */
@Injectable()
export class EmailVerifiedGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  /**
   * Determines if the current user can access the protected resource
   * @param context - Execution context containing request information
   * @returns True if email verification is not required or user email is verified
   * @throws ForbiddenException if email verification is required but user email is not verified
   */
  canActivate(context: ExecutionContext): boolean {
    // Check if email verification is required for this endpoint
    const emailVerificationRequired = this.reflector.getAllAndOverride<boolean>(
      EMAIL_VERIFICATION_REQUIRED_KEY,
      [context.getHandler(), context.getClass()]
    );

    // If email verification is not required, allow access
    if (!emailVerificationRequired) {
      return true;
    }

    // Get the authenticated user from the request
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    // Ensure user is authenticated (this should be handled by JWT guard first)
    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    // Check if user's email is verified
    if (!user.emailVerified) {
      throw new ForbiddenException(
        'Email verification required. Please verify your email address to access this resource.'
      );
    }

    return true;
  }
}
