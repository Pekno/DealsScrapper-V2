---
name: api-auth
description: >
  Load this skill when working on authentication in the API service (apps/api/src/auth/).
  Contains JWT strategy, guards (GlobalJwtAuth, EmailVerified, LocalAuth, AuthRateLimit),
  decorators (@Public, @CurrentUser, @RequireEmailVerification), registration/login/refresh flows,
  account locking, and email verification. Invoke when implementing or debugging auth-related
  endpoints, guards, or security features.
---

# API Authentication System (apps/api/src/auth/)

## Strategy Overview

Passport.js + JWT strategy. All routes protected by `GlobalJwtAuthGuard` (applied globally via `APP_GUARD`). Opt out with `@Public()`.

**Token expiry**: Access = 15min (`JWT_EXPIRES_IN`) | Refresh = 7 days (`JWT_REFRESH_EXPIRES_IN`)

## JWT Payload

```typescript
// Access token
{ sub: string; email: string; iat: number; exp: number; }

// Refresh token
{ sub: string; email: string; type: 'refresh'; iat: number; exp: number; }
```

`JwtStrategy.validate()` fetches user from DB by `payload.sub`, checks account lock, returns `AuthenticatedUser`.

## Guards

| Guard | File | Purpose |
|---|---|---|
| `GlobalJwtAuthGuard` | `guards/global-jwt-auth.guard.ts` | Applied globally — all routes; respects `@Public()` |
| `EmailVerifiedGuard` | `guards/email-verified.guard.ts` | Checks `user.emailVerified === true`; throws `ForbiddenException` |
| `LocalAuthGuard` | `guards/local-auth.guard.ts` | Login endpoint — validates username/password via `LocalStrategy` |
| `AuthRateLimitGuard` | `guards/auth-rate-limit.guard.ts` | 5 requests/15min per IP on auth endpoints |

## Decorators

```typescript
@Public()                        // Skip GlobalJwtAuthGuard on this route
@CurrentUser()                   // Extract AuthenticatedUser from request (injected by Passport)
@RequireEmailVerification()      // Enforce email verified before access
```

Usage:
```typescript
@Public()
@Post('login')
async login() { ... }

@Get('sensitive')
@RequireEmailVerification()
async sensitive(@CurrentUser() user: AuthenticatedUser) { ... }
```

## Authentication Flows

### Registration (`POST /auth/register`)
1. Validate email uniqueness
2. Hash password (bcrypt, 12 rounds)
3. Create user
4. Generate verification token (JWT, 24h, signed with `EMAIL_VERIFICATION_SECRET`)
5. Queue `email-verification` job to notifier via BullMQ
6. Return access + refresh tokens

### Login (`POST /auth/login`)
1. Validate email exists
2. Check account lock (`lockedUntil > now` → throw Unauthorized)
3. Compare password (bcrypt — constant-time)
4. Handle failed login: increment `loginAttempts`; if ≥5 → set `lockedUntil = now + 15min`
5. On success: reset `loginAttempts`, update `lastLoginAt`
6. Return access + refresh tokens + user

### Token Refresh (`POST /auth/refresh`)
1. Verify refresh token signature + expiry
2. Validate user not locked
3. Generate NEW access + refresh tokens (rotation — old token invalidated)

### Email Verification
1. `POST /auth/send-verification` — queues `email-verification` job
2. Link: `{WEB_APP_URL}/auth/verify-email?token={JWT}`
3. `GET /auth/verify-email?token=...` — validates JWT, sets `emailVerified = true`

## Account Security

- **Account locking**: 5 failed login attempts → locked 15 minutes → `lockedUntil` field
- **Refresh token rotation**: every refresh generates new tokens — prevents reuse attacks
- **Bcrypt**: 12 rounds (configurable via `BCRYPT_ROUNDS`)
- **Rate limiting**: 5/15min on auth endpoints; 100/15min global

## Required Env Vars

```
JWT_SECRET               # Access token signing
JWT_REFRESH_SECRET       # Refresh token signing
EMAIL_VERIFICATION_SECRET # Email verification token signing
JWT_EXPIRES_IN           # Default: '15m'
JWT_REFRESH_EXPIRES_IN   # Default: '7d'
EMAIL_VERIFICATION_EXPIRES_IN # Default: '24h'
BCRYPT_ROUNDS            # Default: 12
```

## Key Files

- `auth.service.ts` — core logic (login, register, refresh)
- `auth.controller.ts` — REST endpoints
- `strategies/jwt.strategy.ts` — token validation
- `services/email-verification.service.ts` — verification flow
- `guards/global-jwt-auth.guard.ts` — global enforcement
