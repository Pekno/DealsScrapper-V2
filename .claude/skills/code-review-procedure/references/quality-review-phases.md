# Quality Review — Detailed Phase Procedures

## Phase 0: Complete Coverage Verification (MANDATORY FIRST)

1. List ALL directories in `apps/{service}/src` recursively
2. Find ALL TypeScript files (`*.ts`) in the service
3. Document: total directories, total files, estimated complexity

**Success**: Full directory tree mapped, all files identified, scope documented.

---

## Phase 1: Discovery & Analysis

1. Read `apps/{service}/src/main.ts` entry point
2. Identify all NestJS module classes
3. Check `apps/{service}/package.json` for dependencies
4. Identify shared package usage: `@dealscrapper/database`, `shared-types`, `shared-logging`, `shared-config`, `shared-repository`
5. Find all services (`class.*Service`) and repositories (`class.*Repository`)

---

## Phase 2: Type Safety Review

Search patterns to run:
```bash
# Find any types
grep -r ": any" apps/{service}/src --include="*.ts"
grep -r ": any\[\]" apps/{service}/src --include="*.ts"
grep -r "Array<any>" apps/{service}/src --include="*.ts"
```

For each `any` found:
1. Read the full class/method context
2. Determine correct type (shared types, Prisma types, `unknown` with guard, or new interface)
3. Fix the type
4. Verify TypeScript compiles: `pnpm cli check types`

**Grading**: A+ (0 any) → A (1-2 justified) → B (3-5) → C (6-10) → F (>10)

---

## Phase 3: SOLID Principles Review

Check for:
- **SRP**: Services doing multiple unrelated things; God classes; mixed concerns
- **OCP**: Hardcoded logic that should be configurable; switch statements needing polymorphism
- **DIP**: Constructor dependencies injected (not `new Service()` inside classes)
- **ISP**: Large interfaces forcing unnecessary implementation

**Grading**: A+ (perfect) → A (minor, justified) → B (some violations) → C (multiple) → F (major architectural issues)

---

## Phase 4: Clean Code Review (LOGGING IS MANDATORY)

### A. Naming: clear, descriptive, consistent camelCase/PascalCase

### B. Function complexity: methods >50 lines should be refactored; nesting >3 levels

### C. Code duplication: extract repeated validation/error handling

### D. 🚨 LOGGING MIGRATION (MANDATORY — AUTOMATIC F IF VIOLATED)

**Search:**
```bash
grep -r "new Logger(" apps/{service}/src --include="*.ts"
grep -r "from '@nestjs/common'" apps/{service}/src --include="*.ts" | grep Logger
```

**Forbidden pattern:**
```typescript
import { Logger } from '@nestjs/common';
private readonly logger = new Logger(MyService.name);
```

**Required pattern:**
```typescript
import { createServiceLogger } from '@dealscrapper/shared-logging';
private readonly logger = createServiceLogger('service-name');
```

For EACH violation: read the file → find the class → replace Logger → verify no instances remain.

**Service name guidelines**: kebab-case, descriptive — `'user-service'`, `'notification-gateway'`

### E. Error handling: proper try-catch, meaningful messages, no swallowed exceptions

### F. Magic numbers/strings: extract to constants; use `SharedConfigService` for config values

**Grading**: A+ (perfect + logging migrated) → A (minor, no logging violations) → F (ANY logging violation)

---

## Phase 5: Documentation Review

- All exported classes need class-level JSDoc
- All public methods need `@param`, `@returns`, `@throws`, `@example`
- Complex logic needs inline comments explaining "why"
- Search for `// TODO|// FIXME|// HACK` — document in issues if found

**Grading**: A+ (100%) → A (90%+) → B (70%+) → C (50%+) → F (<50%)

---

## Phase 6: Test Verification

```bash
pnpm test:{service}:unit
pnpm test:{service}:e2e
```

Check test files:
- Proper describe/it structure and naming
- Arrange-Act-Assert pattern
- No fake/placeholder tests (`expect(true).toBe(true)`)
- Mocks reset between tests
- Edge cases covered (error paths, boundaries)
- Coverage >80% for services; >90% for critical paths

**Grading**: A+ (90%+ coverage, high quality) → A (80%+) → B (70%+) → C (60%+) → F (<60% or fake tests)

---

## Phase 7: Final Coverage Verification (MANDATORY LAST)

1. Re-list all directories — same count as Phase 0?
2. **Final logging check** (MANDATORY):
   ```bash
   grep -r "new Logger(" apps/{service}/src --include="*.ts"
   ```
   Expected: no results. If any found → return to Phase 4.

3. Checklist:
   - [ ] All directories from Phase 0 reviewed
   - [ ] Zero `any` types remaining
   - [ ] Zero `new Logger()` instances remaining
   - [ ] All SOLID violations addressed
   - [ ] All documentation added
   - [ ] All tests passing

4. Generate summary report with: files reviewed, issues found/fixed, test status, final grade.

---

## Grade Calculation

```
Overall = (TypeSafety × 0.25) + (SOLID × 0.20) + (CleanCode × 0.25) + (Docs × 0.15) + (Tests × 0.15)
```

**Logging violations → maximum B grade overall, regardless of other scores.**
