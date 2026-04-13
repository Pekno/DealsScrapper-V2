# 📦 DealsScapper Shared Packages

> Centralized infrastructure and utilities for the DealsScapper microservices architecture

This directory contains shared packages used across all DealsScapper services (API, Web, Scraper, Notifier, Scheduler). Each package provides a specific layer of functionality, from database access to logging to type definitions.

## 🎯 Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Service Layer                            │
│  (apps/api, apps/scraper, apps/notifier, etc.)             │
└─────────────────────────────────────────────────────────────┘
                          │
                          ├─────────────────────────┐
                          ▼                         ▼
┌─────────────────────────────────┐   ┌──────────────────────┐
│   @dealscrapper/shared-repository│   │  @dealscrapper/      │
│   Repository Pattern & Base      │   │  shared-types        │
│   Classes for Data Access        │   │  TypeScript DTOs     │
└─────────────────────────────────┘   └──────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│            @dealscrapper/database (Prisma)                   │
│   Schema, Types, and Database Client                        │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                   PostgreSQL Database                        │
└─────────────────────────────────────────────────────────────┘

Cross-Cutting Concerns:
┌───────────────────┐  ┌───────────────────┐  ┌─────────────┐
│ shared-logging    │  │ shared-health     │  │ shared      │
│ Winston Loggers   │  │ Health Endpoints  │  │ Utilities   │
└───────────────────┘  └───────────────────┘  └─────────────┘
         ▲                      ▲                     ▲
         └──────────────────────┴─────────────────────┘
                   Used by ALL services
```

## 📚 Package Index

### 1. 📊 **[@dealscrapper/database](./database/README.md)**
**Prisma schema, migrations, and database client**

- **Purpose**: Central database schema and type definitions
- **Key Exports**: `PrismaClient`, `PrismaService`, Entity types (`User`, `Filter`, `Article`, etc.)
- **Used by**: All services for database access

```typescript
import { PrismaService, User, Filter } from '@dealscrapper/database';
```

---

### 2. 🗂️ **[@dealscrapper/shared-repository](./shared-repository/README.md)**
**Repository pattern base classes for consistent data access**

- **Purpose**: Eliminates 80%+ code duplication across services
- **Key Exports**: `AbstractBaseRepository`, `BaseCategoryRepository`, `BaseFilterRepository`
- **Used by**: API, Scraper, Notifier for database queries

```typescript
import { AbstractBaseRepository } from '@dealscrapper/shared-repository';
```

---

### 3. 🏷️ **[@dealscrapper/shared-types](./shared-types/README.md)**
**TypeScript interfaces and DTOs for cross-service communication**

- **Purpose**: Type-safe contracts between services
- **Key Exports**: Filtering types, Deal DTOs, Scraping interfaces
- **Used by**: All services for type definitions

```typescript
import { FilterDto, DealDto, ScrapingResult } from '@dealscrapper/shared-types';
```

---

### 4. 📝 **[@dealscrapper/shared-logging](./shared-logging/README.md)**
**Winston-based logging service with file rotation**

- **Purpose**: Standardized logging across all services
- **Key Exports**: `EnhancedLoggerService`, `createServiceLogger`
- **Used by**: All services for logging

```typescript
import { createServiceLogger } from '@dealscrapper/shared-logging';
const logger = createServiceLogger('api');
```

---

### 5. ❤️ **[@dealscrapper/shared-health](./shared-health/README.md)**
**Health check endpoints and dependency monitoring**

- **Purpose**: Standardized `/health`, `/ready`, `/live` endpoints
- **Key Exports**: `SharedHealthModule`, `BaseHealthService`
- **Used by**: All services for Kubernetes readiness/liveness probes

```typescript
import { SharedHealthModule } from '@dealscrapper/shared-health';
```

---

### 6. ⚙️ **[@dealscrapper/shared-config](./shared-config/README.md)**
**Type-safe configuration management and validation**

- **Purpose**: Centralized environment variable handling
- **Key Exports**: `SharedConfigService`, `RedisConfig`, `DatabaseConfig`
- **Used by**: All services for configuration

```typescript
import { SharedConfigService } from '@dealscrapper/shared-config';
```

---

### 7. 🛠️ **[@dealscrapper/shared](./shared/README.md)**
**Common utility functions and helpers**

- **Purpose**: Reusable utilities to avoid duplication
- **Key Exports**: `extractErrorMessage`, `delay`, `retryWithBackoff`
- **Used by**: All services for common operations

```typescript
import { extractErrorMessage, delay } from '@dealscrapper/shared';
```

---

## 🔗 Package Dependency Graph

```
shared-repository
    └── database
    └── shared (utils)

database
    └── (no dependencies - foundational)

shared-types
    └── (no dependencies - type definitions only)

shared-logging
    └── (minimal dependencies - NestJS, Winston)

shared-health
    └── database (for PrismaService health checks)
    └── shared-config (for configuration)

shared-config
    └── (minimal dependencies - NestJS, Joi)

shared
    └── (no dependencies - pure utilities)
```

**Dependency Principles:**
- 📊 **database** is the foundation - no dependencies
- 🗂️ **shared-repository** depends on database
- 🏷️ **shared-types** has zero dependencies (pure types)
- 🛠️ **shared** has zero dependencies (pure utilities)
- Other packages have minimal, targeted dependencies

---

## 🚀 Quick Start

### Installation

All packages use **pnpm workspaces** and are referenced via the `workspace:*` protocol:

```json
{
  "dependencies": {
    "@dealscrapper/database": "workspace:*",
    "@dealscrapper/shared-repository": "workspace:*",
    "@dealscrapper/shared-types": "workspace:*",
    "@dealscrapper/shared-logging": "workspace:*",
    "@dealscrapper/shared-health": "workspace:*",
    "@dealscrapper/shared-config": "workspace:*",
    "@dealscrapper/shared": "workspace:*"
  }
}
```

### Building Packages

From the root directory:

```bash
# Build all packages
pnpm build

# Build specific package
pnpm --filter @dealscrapper/database build

# Build in watch mode for development
pnpm --filter @dealscrapper/shared-repository build:watch
```

### Development Workflow

```bash
# 1. Install dependencies
pnpm install

# 2. Generate Prisma Client (required first!)
pnpm db:generate

# 3. Build all packages
pnpm build

# 4. Start development servers
pnpm dev
```

---

## 📖 Usage Examples

### Example 1: Creating a Repository

```typescript
// apps/api/src/repositories/user.repository.ts
import { Injectable } from '@nestjs/common';
import { AbstractBaseRepository } from '@dealscrapper/shared-repository';
import { PrismaService, User, Prisma } from '@dealscrapper/database';

@Injectable()
export class UserRepository extends AbstractBaseRepository<
  User,
  Prisma.UserCreateInput,
  Prisma.UserUpdateInput,
  Prisma.UserWhereUniqueInput
> {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.executeWithErrorHandling(
      'findByEmail',
      () => this.prisma.user.findUnique({ where: { email } })
    );
  }
}
```

### Example 2: Using Shared Logging

```typescript
// apps/scraper/src/main.ts
import { createServiceLogger } from '@dealscrapper/shared-logging';

const logger = createServiceLogger('scraper');

logger.info('Scraper service starting...', { port: 3002 });
logger.error('Failed to scrape deal', { url, error: err.message });
logger.debug('Processing deal', { dealId, title });
```

### Example 3: Health Checks

```typescript
// apps/api/src/health/api-health.service.ts
import { Injectable } from '@nestjs/common';
import { BaseHealthService, HealthData } from '@dealscrapper/shared-health';
import { PrismaService } from '@dealscrapper/database';

@Injectable()
export class ApiHealthService extends BaseHealthService {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async getServiceHealth(): Promise<HealthData> {
    const dbHealthy = await this.checkDatabase();
    const redisHealthy = await this.checkRedis();

    return {
      status: dbHealthy && redisHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date(),
      uptime: process.uptime(),
      dependencies: {
        database: { status: dbHealthy ? 'healthy' : 'unhealthy' },
        redis: { status: redisHealthy ? 'healthy' : 'unhealthy' },
      },
    };
  }
}
```

---

## ✅ Best Practices

### 1. **Use Workspace References**

```json
// ✅ GOOD - Uses workspace protocol
{
  "dependencies": {
    "@dealscrapper/database": "workspace:*"
  }
}

// ❌ BAD - Hardcoded version
{
  "dependencies": {
    "@dealscrapper/database": "1.0.0"
  }
}
```

### 2. **Import from Package Root**

```typescript
// ✅ GOOD - Import from package root
import { PrismaService, User } from '@dealscrapper/database';

// ❌ BAD - Deep imports break encapsulation
import { PrismaService } from '@dealscrapper/database/dist/prisma.service';
```

### 3. **Use Prisma Types, Never `select`**

```typescript
// ✅ GOOD - Use include, maintains full types
const user = await prisma.user.findUnique({
  where: { id },
  include: { filters: true }
});

// ❌ BAD - select breaks typing
const user = await prisma.user.findUnique({
  where: { id },
  select: { id: true, email: true } // ❌ Loses type information
});
```

### 4. **Extend Shared Repositories**

```typescript
// ✅ GOOD - Extend base repository
export class CategoryRepository extends BaseCategoryRepository {
  // Add service-specific methods
}

// ❌ BAD - Duplicate base functionality
export class CategoryRepository {
  async findUnique() { /* ... duplicated code ... */ }
  async findMany() { /* ... duplicated code ... */ }
}
```

### 5. **Use Shared Utilities**

```typescript
// ✅ GOOD - Use shared utilities
import { extractErrorMessage } from '@dealscrapper/shared';
const message = extractErrorMessage(error);

// ❌ BAD - Duplicate error handling logic
const message = error instanceof Error ? error.message : 'Unknown error';
```

---

## 🔧 Maintenance

### Adding a New Shared Package

1. **Create package directory**:
   ```bash
   mkdir -p packages/my-new-package/src
   cd packages/my-new-package
   ```

2. **Initialize package.json**:
   ```json
   {
     "name": "@dealscrapper/my-new-package",
     "version": "1.0.0",
     "type": "module",
     "main": "./dist/index.js",
     "types": "./dist/index.d.ts",
     "scripts": {
       "build": "tsc",
       "build:watch": "tsc --watch"
     }
   }
   ```

3. **Create tsconfig.json** (extend from root)

4. **Add exports in src/index.ts**

5. **Update this README** with new package info

### Updating Package Dependencies

```bash
# Update specific package dependency
pnpm --filter @dealscrapper/database add prisma@latest

# Update all packages
pnpm update --recursive
```

---

## 🐛 Troubleshooting

### Issue: "Cannot find module '@dealscrapper/database'"

**Cause**: Packages not built or Prisma Client not generated

**Solution**:
```bash
pnpm db:generate  # Generate Prisma Client
pnpm build        # Build all packages
```

---

### Issue: Type errors after updating Prisma schema

**Cause**: Prisma Client not regenerated

**Solution**:
```bash
pnpm db:generate  # Regenerate Prisma Client
pnpm build        # Rebuild packages
```

---

### Issue: Circular dependency warnings

**Cause**: Packages importing each other incorrectly

**Solution**: Check dependency graph above. Only:
- `shared-repository` should import `database`
- `shared-health` should import `database` and `shared-config`
- Other packages should have minimal dependencies

---

## 📊 Package Statistics

| Package | Lines of Code | Dependencies | Used By |
|---------|---------------|--------------|---------|
| database | ~500 | Prisma | ALL services |
| shared-repository | ~2,100 | database, shared | API, Scraper, Notifier |
| shared-types | ~450 | None | ALL services |
| shared-logging | ~240 | Winston, NestJS | ALL services |
| shared-health | ~180 | database, shared-config | ALL services |
| shared-config | ~270 | NestJS, Joi | ALL services |
| shared | ~75 | None | ALL services |
| **TOTAL** | **~3,815** | - | - |

---

## 📚 Further Reading

- [Prisma Best Practices](https://www.prisma.io/docs/guides/performance-and-optimization)
- [NestJS Modules](https://docs.nestjs.com/modules)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [pnpm Workspaces](https://pnpm.io/workspaces)

---

## 🤝 Contributing

When adding or modifying shared packages:

1. ✅ Update package README
2. ✅ Add comprehensive JSDoc
3. ✅ Export types explicitly
4. ✅ Follow naming conventions
5. ✅ Add usage examples
6. ✅ Update this index README

---

**🚀 Built with TypeScript, Prisma, and NestJS for the DealsScapper microservices platform**
