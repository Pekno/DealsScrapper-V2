---
name: api-architecture
description: >
  Load this skill when working on the NestJS API service (apps/api/). Contains module structure,
  key features, data model requirements, testing setup, and critical gotchas (siteId required,
  enabledSites removed, temperature in extension table). Invoke at the start of any task in
  apps/api/ to understand the service structure before making changes.
---

# API Service Architecture (apps/api/)

**Port**: 3001 | **Package**: `@dealscrapper/api`

## Module Structure

```
apps/api/src/
├── main.ts              # Bootstrap (GlobalJwtAuthGuard applied globally)
├── app.module.ts        # Root module
├── auth/                # JWT auth, registration, login, email verification
├── users/               # User profile, notification preferences
├── filters/             # Filter CRUD, expressions, matching stats
├── categories/          # Category listing and refresh
├── articles/            # Article/deal endpoints
├── sites/               # Site management (GET /api/sites)
├── health/              # Health check (public)
├── common/              # Shared utilities, decorators, dev seeder
├── config/              # Config module
└── repositories/        # Data access layer (all extend AbstractBaseRepository)
```

## Key Features

### Authentication
- JWT-based via Passport.js — access tokens (15min) + refresh tokens (7d) with rotation
- `GlobalJwtAuthGuard` applied via `APP_GUARD` — **all routes protected by default**
- Use `@Public()` decorator to opt out on specific endpoints
- Email verification required for sensitive operations via `@RequireEmailVerification()`

### Filter System
- Complex rule expressions (AND/OR/NOT, 27+ operators) on `RawDeal` objects
- **Sites derived from categories** — Filter has no `enabledSites` field; backend derives target sites from `filter.categories[].siteId`
- Notification settings per filter
- Rule engine lives in `apps/scraper/src/filter-matching/rule-engine.service.ts`

### API Documentation
- Swagger UI: `http://localhost:3001/api/docs`
- OpenAPI spec auto-generated from decorators

## Critical Data Model Facts

| Fact | Detail |
|---|---|
| `Article.siteId` | **REQUIRED** — always provide when creating articles in tests or seeds |
| `Filter.enabledSites` | **REMOVED** — do not reference this field anywhere |
| `temperature` | In `ArticleDealabs` extension table, NOT in base `Article` |
| Sites from categories | `filter.categories[].siteId` → target sites |

## Testing

```bash
pnpm test:api:unit    # Unit tests (~/apps/api/test/unit/)
pnpm test:api:e2e     # Integration/E2E tests
```

### Dev Seeded User
Available automatically in dev/test:
```typescript
{ email: 'user@example.com', password: 'StrongP@ssw0rd', emailVerified: true }
```

### Test Article Pattern
```typescript
// ✅ Always include siteId
const article = await prisma.article.create({
  data: { externalId: 'test-123', siteId: 'dealabs', title: 'Test', url: '...' }
});
```

## Endpoints Summary

| Group | Base Path | Note |
|---|---|---|
| Auth | `/auth` | register, login, refresh, logout (most are @Public) |
| Users | `/users` | profile, notification preferences |
| Filters | `/filters` | CRUD, toggle, matches, stats, test |
| Categories | `/categories` | list, refresh |
| Sites | `/sites` | GET only — frontend uses this for column metadata |
| Health | `/health` | @Public |

See `api-endpoints` skill for full endpoint specs.

## Logging

```typescript
import { createServiceLogger } from '@dealscrapper/shared-logging';
private readonly logger = createServiceLogger('api-{module-name}');
```

Never use `new Logger()` from `@nestjs/common`.
