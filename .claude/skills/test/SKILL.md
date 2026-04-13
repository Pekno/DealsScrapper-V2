---
name: test
description: "Smart test runner for DealsScrapper. Use this skill whenever the user asks to run tests, verify their changes, check if something works, or says 'run tests', 'does this pass?', 'test this', 'check my changes'. This skill determines which service and test type to run based on what was changed, avoiding unnecessary full-suite runs."
argument-hint: "[service or scope, e.g., 'api', 'scraper', 'all', 'unit', 'integration']"
---

# Smart Test Runner

Run the right tests for the right scope. Argument: ``

## Step 1: Determine What Changed

If no specific scope was given, figure out what needs testing:

1. Run `git diff --name-only HEAD` to see modified files
2. Map changed files to services:
   - `apps/api/` → API service
   - `apps/scraper/` → Scraper service
   - `apps/scheduler/` → Scheduler service
   - `apps/notifier/` → Notifier service
   - `apps/web/` → Web frontend
   - `packages/database/` → All services (schema change affects everything)
   - `packages/shared-types/` → All services (type change affects everything)
   - `packages/shared-*` → All services

## Step 2: Run the Tests

### Per-service unit tests
```bash
pnpm test:api:unit          # API unit tests
pnpm test:scraper:unit      # Scraper unit tests
pnpm test:scheduler:unit    # Scheduler unit tests
pnpm test:notifier:unit     # Notifier unit tests
```

### All unit tests (with timing report)
```bash
pnpm cli test unit
```

### Integration tests (requires infrastructure running)
```bash
pnpm cli test integration
```

### Full suite (infra → build → unit → integration → cleanup)
```bash
pnpm cli test complete
```

### E2E tests
```bash
pnpm test:e2e
```

## Step 3: Interpret Results

- If tests pass: report success with timing
- If tests fail: read the error output, identify the failing test, and explain what went wrong
- If the failure is in code you just changed: offer to fix it
- If the failure is pre-existing: note it as pre-existing and move on

## Decision Matrix

| User says | Action |
|-----------|--------|
| "test" / "run tests" (no scope) | Detect changed files → run affected service unit tests |
| "test api" / "test the API" | `pnpm test:api:unit` |
| "test scraper" | `pnpm test:scraper:unit` |
| "test scheduler" | `pnpm test:scheduler:unit` |
| "test notifier" | `pnpm test:notifier:unit` |
| "test all" / "full tests" | `pnpm cli test unit` |
| "integration tests" | `pnpm cli test integration` (warn if infra not running) |
| "complete test" / "full suite" | `pnpm cli test complete` |
| "e2e" / "end to end" | `pnpm test:e2e` |
| "types" / "typecheck" | `pnpm cli check types` |

## Important

- Before running integration tests, check if infrastructure is running with `pnpm cli status`
- If infra isn't running and integration tests are needed, ask the user before starting it
- Never start services without user permission
- Keep test output concise — summarize results, don't dump raw output unless the user asks
