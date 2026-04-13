---
name: shared-packages
description: >
  Load this skill when importing from or working with the shared packages in DealsScrapper
  (packages/*). Contains all 7 packages, their exports, usage patterns, dependency graph,
  and critical import gotchas (ArticleWrapper not in index, SiteSource enum location).
  Invoke when you need to know what's available to import, how to use SharedConfigService,
  createServiceLogger, AbstractBaseRepository, or any shared utility.
---

# DealsScrapper — Shared Packages

## Package Overview

```
packages/
├── database/           → @dealscrapper/database     — Prisma schema, client, types
├── shared-types/       → @dealscrapper/shared-types — TypeScript interfaces, enums, DTOs
├── shared-config/      → @dealscrapper/shared-config — Environment config
├── shared-logging/     → @dealscrapper/shared-logging — Winston logger
├── shared/             → @dealscrapper/shared       — Common utilities
├── shared-repository/  → @dealscrapper/shared-repository — Base repository patterns
└── shared-health/      → @dealscrapper/shared-health — Health check infrastructure
```

All packages are `private: true` — not published to npm, only used internally via `workspace:*`.

## Dependency Graph

```
shared-types       → (no deps — pure TypeScript)
shared             → (no deps — pure utilities)
database           → @prisma/client
shared-logging     → winston, winston-daily-rotate-file
shared-config      → shared-logging, @nestjs/config
shared-health      → shared-types, @nestjs/swagger
shared-repository  → database
```

No circular dependencies — import direction is downward.

---

## @dealscrapper/database

```typescript
import { PrismaModule, PrismaService } from '@dealscrapper/database';
import type { User, Filter, Article, Category, Match, Notification } from '@dealscrapper/database';
// Also exports: UserSession, ScheduledJob, ScrapingJob, FilterCategory, Prisma, PrismaClient
```

In modules: `imports: [PrismaModule]` — provides `PrismaService` for injection.

---

## @dealscrapper/shared-types

Multiple entry points:
```typescript
// Main entry — exports: RawDeal, FilterExpression, FilterRule, StandardApiResponse, JwtPayload, AuthenticatedUser, enums
import { RawDeal, FilterExpression, ScrapeJobStatus } from '@dealscrapper/shared-types';

// Granular subpath imports (preferred for tree-shaking)
import { SiteSource } from '@dealscrapper/shared-types/enums';
import { NotificationPriority } from '@dealscrapper/shared-types/enums';

// Sites module (field definitions, filter rules, table columns)
import { getFieldsForSites, ALL_SITE_FIELD_DEFINITIONS } from '@dealscrapper/shared-types/sites/field-definitions';
import { SiteFilterRule, validateSiteFilterExpression } from '@dealscrapper/shared-types/sites/filter-rules';
import { getColumnsForSites, TableColumnDefinition } from '@dealscrapper/shared-types/sites/table-columns';
```

### ⚠️ CRITICAL: ArticleWrapper
`ArticleWrapper` is **NOT exported from `@dealscrapper/shared-types` main index**. Import it directly:
```typescript
import { ArticleWrapper } from '@dealscrapper/shared-types/article';
```

### SiteSource enum
```typescript
export enum SiteSource {
  DEALABS = 'dealabs',
  VINTED = 'vinted',
  LEBONCOIN = 'leboncoin',
}
```
This enum does NOT depend on `@prisma/client`.

---

## @dealscrapper/shared-config

```typescript
import { SharedConfigModule, SharedConfigService } from '@dealscrapper/shared-config';

// In AppModule
@Module({
  imports: [
    SharedConfigModule.forRoot({
      serviceName: 'API',
      envConfig: { DATABASE_URL: 'REQUIRED', JWT_SECRET: 'REQUIRED' }
    })
  ]
})

// In services
constructor(private configService: SharedConfigService) {}
const redisConfig = this.configService.getRedisConfig();
const jwtConfig = this.configService.getJwtConfig();
```

**Never use `process.env` directly in NestJS services** — always inject `SharedConfigService`.

---

## @dealscrapper/shared-logging

```typescript
import { createServiceLogger } from '@dealscrapper/shared-logging';

// In any service/class
private readonly logger = createServiceLogger('my-service');

this.logger.log('Message', 'Context');
this.logger.error('Error message', stack, 'Context');
this.logger.warn('Warning', 'Context');
```

**This is the ONLY acceptable way to log.** `new Logger()` from `@nestjs/common` is forbidden.

---

## @dealscrapper/shared

```typescript
import { extractErrorMessage, safeStringify, delay, retryWithBackoff, COMMON_CONFIG } from '@dealscrapper/shared';

// Error handling
try { ... } catch (error) {
  this.logger.error(extractErrorMessage(error));
}

// Delays
await delay(COMMON_CONFIG.TIMEOUTS.SHORT);
```

---

## @dealscrapper/shared-repository

```typescript
import { AbstractBaseRepository, BaseCategoryRepository, BaseFilterRepository } from '@dealscrapper/shared-repository';
import type { PaginatedResult, PaginationOptions } from '@dealscrapper/shared-repository';

@Injectable()
export class UserRepository extends AbstractBaseRepository<User, CreateUserInput, UpdateUserInput, UserWhereInput> {
  constructor(prisma: PrismaService) { super(prisma); }

  async findUnique(where: UserWhereInput): Promise<User | null> {
    return this.executeWithErrorHandling('findUnique', async () => {
      return this.prisma.user.findUnique({ where });  // include, not select!
    });
  }
}
```

Use `executeWithErrorHandling()` and `calculatePaginationMetadata()` from the base class.

---

## @dealscrapper/shared-health

```typescript
import { SharedHealthModule, BaseHealthService } from '@dealscrapper/shared-health';

@Injectable()
export class ApiHealthService extends BaseHealthService {
  constructor() {
    super({ serviceName: 'API', version: '1.0.0', environment: process.env.NODE_ENV });
    this.registerHealthChecker('database', async () => 'healthy');
  }
}
```

---

## Type Safety Pattern

```typescript
// ✅ Use Prisma types directly — don't duplicate
import { User, Filter } from '@dealscrapper/database';

// ✅ Create DTO by composing existing types
export interface UserPublicDto extends Omit<User, 'password'> {}

// ❌ Don't redefine what Prisma already provides
interface User { id: string; email: string; } // Already exists!
```
