# Shared Package Usage Audit — Detailed Phase Procedures

## Phase 0: Inventory Shared Package Exports (MANDATORY FIRST)

Before scanning the service, understand what's available:

1. **shared-types**: `RawDeal`, `FilterExpression`, `FilterRule`, `StandardApiResponse`, `JwtPayload`, `AuthenticatedUser`, `ScrapeJobStatus`, `NotificationPriority`; subpath: `/enums`, `/deals`, `/filtering`, `/sites/*`
2. **shared-config**: `SharedConfigService` with `get()`, `getOrThrow()`, `getRedisConfig()`, `getJwtConfig()`
3. **shared-logging**: `createServiceLogger()` factory
4. **shared-repository**: `AbstractBaseRepository`, `BaseCategoryRepository`, `BaseFilterRepository`; utilities: `executeWithErrorHandling`, `calculatePaginationMetadata`
5. **shared-health**: `BaseHealthService`, `BaseHealthController`, `SharedHealthModule`
6. **database**: All Prisma types (`User`, `Filter`, `Article`, `Category`, `Match`, etc.), `PrismaService`, `PrismaModule`

**Create inventory list** before scanning — you can't find duplicates without knowing what exists.

---

## Phase 1: Type Definitions Audit

Search for locally defined types:
```bash
grep -rn "^export\s\+(interface|type|enum)" apps/{service}/src --include="*.ts"
```

For each type found, check if it exists in shared packages. Categorize:
- ✅ **Correctly imported** from shared package
- ⚠️ **Duplicate** — same type defined locally, should import instead
- 🔄 **Variant** — similar but with service-specific additions (acceptable)
- 🆕 **Should be shared** — used across multiple services, move to shared-types

---

## Phase 2: Configuration Usage Audit

```bash
grep -rn "process\.env\." apps/{service}/src --include="*.ts"
```

Every `process.env` access in a NestJS service should be replaced with `SharedConfigService.get()`.

**Acceptable exceptions**: `main.ts` bootstrap (before NestJS DI), test files, middleware instantiated before DI.

---

## Phase 3: Logging Usage Audit

```bash
grep -rn "new Logger(" apps/{service}/src --include="*.ts"
grep -rn "createServiceLogger(" apps/{service}/src --include="*.ts"
```

- **A+**: 100% using `createServiceLogger`
- **F**: Any `new Logger()` found (critical issue, must fix)

---

## Phase 4: Repository Pattern Audit

Check each repository in `apps/{service}/src/repositories/`:
- Extends `AbstractBaseRepository` or a specialized base (`BaseCategoryRepository`, `BaseFilterRepository`)
- Uses `executeWithErrorHandling()` from base
- Uses `calculatePaginationMetadata()` from base
- No duplicated pagination logic (`skip/take` without using base utilities)

---

## Phase 5: Utility Functions Audit

Look for locally defined utilities that already exist in `@dealscrapper/shared`:
- `extractErrorMessage` — converting errors to strings
- `delay` — async delays
- `retryWithBackoff` — retry logic
- `COMMON_CONFIG` — timeout/batch size constants

Categorize: service-specific (keep local) vs generic (consolidate).

---

## Phase 6: Response Formatting Audit

```bash
grep -rn "success: true\|success: false" apps/{service}/src --include="*.ts"
grep -rn "StandardApiResponse" apps/{service}/src --include="*.ts"
grep -rn "createSuccessResponse" apps/{service}/src --include="*.ts"
```

Controllers should use `StandardApiResponse<T>` type and `createSuccessResponse()` helper — not manually construct `{ success: true, data: ... }`.

---

## Phase 7: Health Check Audit

```bash
grep -rn "from '@dealscrapper/shared-health'" apps/{service}/src --include="*.ts"
```

Health services should extend `BaseHealthService` and register checkers via `registerHealthChecker()`.

---

## Phase 8: Prisma Usage Audit (Backend Only)

```bash
grep -rn "select:" apps/{service}/src --include="*.ts"
```

**Any `select:` usage is a CRITICAL violation** — must use `include:` instead.

---

## Coverage Score

```
Coverage = (correct shared package usages / total opportunities) × 100
```

| Grade | Coverage |
|---|---|
| A+ | 95-100% |
| A | 90-94% |
| B | 80-89% |
| C | 70-79% |
| D | 60-69% |
| F | <60% |

---

## Report Format

```markdown
# {Service} — Shared Package Usage Audit

**Overall Grade**: {grade} ({coverage}%)

## Findings by Package

### shared-types: {grade}
- Correctly imported: {list}
- Local duplicates: {list with file:line}

### shared-config: {grade}
- SharedConfigService used: {count} services
- Direct process.env (acceptable): {list with rationale}
- Direct process.env (violation): {list with file:line}

### shared-logging: {grade}
- createServiceLogger: {count} usages
- new Logger() violations: {list with file:line}

### shared-repository: {grade}
- Extends base: {list}
- Missing base extension: {list}

### Prisma: {grade}
- select violations: {count, file:line}

## Priority Fixes

### 🚨 Critical
1. {issue} — {file:line} — {fix}

### ⚠️ High Priority
1. {issue} — {file:line} — {fix}
```
