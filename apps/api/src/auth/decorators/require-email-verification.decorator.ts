import { SetMetadata } from '@nestjs/common';
import { EMAIL_VERIFICATION_REQUIRED_KEY } from '../guards/email-verified.guard.js';

/**
 * Decorator that marks an endpoint as requiring email verification
 * Use this decorator on controllers or methods that should only be accessible
 * to users with verified email addresses
 *
 * @example
 * ```typescript
 * @RequireEmailVerification()
 * @Get('sensitive-data')
 * async getSensitiveData() {
 *   // Only users with verified emails can access this
 * }
 * ```
 *
 * @example
 * ```typescript
 * @RequireEmailVerification()
 * @Controller('premium')
 * export class PremiumController {
 *   // All endpoints in this controller require email verification
 * }
 * ```
 */
export const RequireEmailVerification = () =>
  SetMetadata(EMAIL_VERIFICATION_REQUIRED_KEY, true);
