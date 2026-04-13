---
name: coding-principles
description: >
  Load this skill at the start of ANY task in the DealsScrapper codebase. Contains mandatory
  coding standards: CLEAN/SOLID/DRY/KISS principles, TypeScript strict-typing rules, code style
  conventions, and the critical logging requirement (createServiceLogger — never new Logger).
  All agents should invoke this before writing or reviewing any code.
---

# DealsScrapper — Coding Principles

## CLEAN Code / SOLID / DRY / KISS

- **Single Responsibility**: Each class/module has one job
- **Open/Closed**: Open for extension, closed for modification
- **Dependency Inversion**: Depend on abstractions; use NestJS DI, no `new Service()` inside classes
- **DRY**: Extract common logic; reuse shared packages — don't copy-paste across services
- **KISS**: Simple solutions first; add complexity only when genuinely needed
- **Error handling**: Always handle explicitly; log with context; never swallow exceptions

## TypeScript Standards

### NEVER use `any`
```typescript
// ❌ DON'T
function process(data: any): any { ... }
// ✅ DO
function process(data: ProcessInput): ProcessOutput { ... }
```

### Always define return types
```typescript
// ❌ DON'T
function getUser(id: string) { ... }
// ✅ DO
function getUser(id: string): Promise<User> { ... }
```

### Other rules
- Use interfaces for object shapes; type aliases for unions/primitives
- Strict null checks — prefer `undefined` over `null`, use `?.` and `??`
- Use type guards (`obj is User`) instead of `as SomeType` casts
- Named exports and barrel `index.ts` files for packages

## Code Style

### Naming
| Pattern | Convention | Example |
|---|---|---|
| Variables/Functions | camelCase | `getUserById`, `filterCount` |
| Classes/Interfaces | PascalCase | `UserService`, `FilterRepository` |
| Constants | SCREAMING_SNAKE_CASE | `MAX_RETRIES` |
| Files | kebab-case | `user.service.ts` |
| Booleans | `is`/`has`/`should` prefix | `isActive`, `hasPermission` |

### NestJS file suffixes
`.service.ts` / `.controller.ts` / `.module.ts` / `.dto.ts` / `.spec.ts` / `.guard.ts` / `.repository.ts`

### Formatting
- Prettier: 2-space indent, single quotes, trailing commas, 100-char line width
- Import order: external → internal (`@dealscrapper/`) → relative

### Comments
- Code should be self-documenting — comments only for non-obvious logic
- JSDoc on all public/exported APIs

## 🚨 CRITICAL: Logging Rule

**ALL services MUST use `createServiceLogger()` from `@dealscrapper/shared-logging`.**

**`new Logger()` from `@nestjs/common` is FORBIDDEN — automatic F-grade in code reviews.**

```typescript
// ❌ FORBIDDEN
import { Logger } from '@nestjs/common';
export class MyService {
  private readonly logger = new Logger(MyService.name);
}

// ✅ REQUIRED
import { createServiceLogger } from '@dealscrapper/shared-logging';
export class MyService {
  private readonly logger = createServiceLogger('my-service');
}
```

**Service name convention**: kebab-case, descriptive — `'user-service'`, `'notification-gateway'`, `'channel-health'`

This applies to ALL files including `main.ts` bootstrap code — use `createServiceLogger('service-bootstrap')`.

## Security
- Validate all user inputs at system boundaries
- Sanitize data before storage/display
- Use `SharedConfigService` for env vars — never `process.env` directly in services
- Follow OWASP guidelines; no `dangerouslySetInnerHTML` without sanitization
