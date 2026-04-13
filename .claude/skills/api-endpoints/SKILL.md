---
name: api-endpoints
description: >
  Load this skill when you need the full REST API endpoint reference for DealsScrapper.
  Contains all endpoints (auth, users, filters, categories, health), request/response shapes,
  HTTP status codes, rate limits, and authentication headers. Invoke when implementing API
  calls from the frontend, writing controller tests, or checking what endpoints exist.
---

# DealsScrapper API Endpoint Reference

**Base URL**: `http://localhost:3001`  
**Swagger**: `http://localhost:3001/api/docs`  
**Auth header**: `Authorization: Bearer <access_token>`

---

## Rate Limits

| Scope | Endpoints | Limit |
|---|---|---|
| Global | All | 100 req / 15 min per IP |
| Auth | `/auth/login`, `/auth/register`, `/auth/send-verification` | 5 req / 15 min per IP |

Rate-limit response headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, `Retry-After`

Account locking: 5 failed login attempts locks the account for 15 minutes; resets on success.

---

## HTTP Status Codes

| Code | Meaning |
|---|---|
| 200 | Success (GET / PATCH / DELETE) |
| 201 | Created (POST) |
| 400 | Validation / bad input |
| 401 | Missing or invalid JWT / bad credentials |
| 403 | Email not verified / insufficient permissions |
| 404 | Resource not found |
| 409 | Conflict (e.g. email already exists) |
| 429 | Rate limit exceeded |
| 503 | Health check failed |

**Error response shape**:
```json
{ "statusCode": 400, "message": "...", "error": "Bad Request", "timestamp": "...", "path": "..." }
```

---

## Auth Endpoints — `/auth`

All public unless noted. Auth-specific rate limit applies to register, login, send-verification.

### POST /auth/register — Public
```typescript
// Body
{ email: string; password: string; /* min 8 chars */ firstName?: string; lastName?: string; }

// 201 Created
{ accessToken: string; refreshToken: string; user: { id, email, firstName, lastName, emailVerified: false } }
// 409 email exists | 400 validation
```

### POST /auth/login — Public
```typescript
// Body
{ email: string; password: string; }

// 200 OK — same shape as register response
// 401 invalid credentials or account locked
```

### POST /auth/refresh — Public
```typescript
// Body
{ refreshToken: string; }

// 200 OK — token rotation: old token invalidated
{ accessToken: string; refreshToken: string; }
// 401 invalid/expired token
```

### POST /auth/logout — JWT Required
```typescript
// Body
{ refreshToken: string; }
// 200 { message: "Logged out successfully" }
```

### POST /auth/logout-all — JWT Required
```typescript
// No body
// 200 { message: "Logged out from all devices" }
```

### POST /auth/send-verification — JWT Required
```typescript
// No body
// 200 { message: "Verification email sent" }
// Sends link: {WEB_APP_URL}/auth/verify-email?token={JWT} — expires 24h
// 400 if already verified
```

### GET /auth/verify-email — Public
```typescript
// Query: ?token=<jwt>
// 200 { message: "Email verified successfully" }
// 400 invalid/expired token or already verified | 404 user not found
```

---

## User Endpoints — `/users` (JWT Required)

### GET /users/profile
```typescript
// 200 OK
{
  id, email, firstName, lastName, emailVerified, createdAt, updatedAt,
  notificationPreferences: {
    email: boolean; inApp: boolean;
    frequency: 'immediate' | 'daily' | 'weekly';
    quietHours: { enabled: boolean; start: string; end: string; timezone?: string; };
  } | null
}
```

### PATCH /users/profile
```typescript
// Body
{ firstName?: string; lastName?: string; }
// 200 — returns updated user (id, email, firstName, lastName, emailVerified, updatedAt)
```

### PATCH /users/notifications
```typescript
// Body (all optional)
{
  email?: boolean; inApp?: boolean;
  frequency?: 'immediate' | 'daily' | 'weekly';
  quietHours?: { enabled: boolean; start: string; end: string; timezone?: string; };
  categories?: { dealMatch?: boolean; digest?: boolean; system?: boolean; priceAlert?: boolean; };
  filters?: { minScore?: number; maxPerDay?: number; preferredMerchants?: string[]; blockedKeywords?: string[]; };
}
// 200 { message: "Notification preferences updated", preferences: { ...updated } }
```

---

## Filter Endpoints — `/filters` (JWT Required)

> **CRITICAL**: `enabledSites` is NOT accepted on create or update. Sites are automatically derived from the filter's `categoryIds`. A filter with no categories matches NO sites (effectively disabled).

### POST /filters — Email verification required
```typescript
// Body
{
  name: string;          // max 100 chars
  description?: string;
  expression: { operator: 'AND' | 'OR'; rules: Rule[]; };
  categoryIds?: string[]; // sites derived from these categories
  isActive?: boolean;    // default true
}

// 201 Created
{ id, name, description, expression, isActive, userId, categories: Category[], createdAt, updatedAt }
// 400 invalid expression | 403 email not verified
```

**Expression rule examples**:
```typescript
// Simple
{ field: 'price', operator: 'lessThan', value: 500 }

// Compound
{ operator: 'AND', rules: [
  { field: 'category', operator: 'equals', value: 'Electronics' },
  { field: 'price', operator: 'lessThan', value: 1000 }
]}
```

### GET /filters
```typescript
// Query (all optional)
{ skip?: number; take?: number; /* default 50, max 100 */ orderBy?: 'createdAt'|'updatedAt'|'name'; order?: 'asc'|'desc'; isActive?: boolean; search?: string; }
// 200 { filters: Filter[]; total: number; hasMore: boolean; }
```

### Simple filter endpoints (table)

| Method | Path | Description | Response |
|---|---|---|---|
| GET | `/filters/count` | Total filter count | `{ count: number }` |
| GET | `/filters/:id` | Get single filter | Filter object |
| PATCH | `/filters/:id` | Update filter (name, description, expression, isActive) | Updated filter |
| DELETE | `/filters/:id` | Delete filter | `{ message: "Filter deleted successfully" }` |
| POST | `/filters/:id/toggle` | Toggle isActive | `{ id, isActive }` |

All return `404` if filter not found or not owned by current user.

### GET /filters/:id/matches
```typescript
// Query: skip?, take?, orderBy?: 'createdAt'|'price'|'score', order?: 'asc'|'desc'
// 200 { matches: [{ dealId, title, price, merchant, url, score, matchedAt }], total: number }
```

### GET /filters/:id/stats
```typescript
// 200 { totalMatches, matchesToday, matchesThisWeek, averageScore, lastMatchAt: string|null }
```

### POST /filters/test — Test expression without saving
```typescript
// Body
{ expression: FilterExpression; limit?: number; /* default 10 */ }
// 200 { matches: DealSummary[]; totalMatches: number; isValid: boolean; validationErrors?: string[] }
```

### GET /filters/:id/scraping-status
```typescript
// 200 { isScrapingActive: boolean; lastScrapedAt: string|null; nextScrapeAt: string|null; scrapingFrequency: string }
```

---

## Category Endpoints — `/categories` (JWT Required)

### GET /categories
```typescript
// Query (all optional): search?, source?, skip?, take?
// 200 { categories: [{ id, name, slug, source, url, dealCount?, createdAt }], total: number }
```

### POST /categories/refresh — May require admin
```typescript
// No body
// 200 { message: "Category refresh triggered", jobId: string }
```

---

## Health — `/health` (Public)

### GET /health
```typescript
// 200 healthy / 503 unhealthy
{
  status: 'healthy' | 'unhealthy'; service: 'api'; version: string;
  environment: string; timestamp: string; uptime: number; // seconds
  checks: {
    database: { status: 'healthy'|'unhealthy'; responseTime: number; };
    redis:    { status: 'healthy'|'unhealthy'; responseTime: number; };
    scheduler: { status: 'healthy'|'unhealthy'; url: string; };
  }
}
```

---

## Pagination Shape

When endpoints support pagination the response follows:
```typescript
{ data: T[]; total: number; skip: number; take: number; hasMore: boolean; }
```
(Filters endpoint uses `filters` key instead of `data`.)

---

## Key Source Files

- `apps/api/src/auth/auth.controller.ts`
- `apps/api/src/users/users.controller.ts`
- `apps/api/src/filters/filters.controller.ts`
- `apps/api/src/categories/categories.controller.ts`
