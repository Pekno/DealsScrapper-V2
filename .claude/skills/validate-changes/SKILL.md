---
name: validate-changes
description: "Targeted test runner for validating code changes. Sub-agents MUST use this skill after making any code changes to run only the specific tests related to what was modified — never the full test suite unless explicitly requested. Use this whenever you need to validate changes, verify a fix, confirm refactoring didn't break anything, or check that new code works. Triggers on: 'validate my changes', 'run targeted tests', 'check if this works', 'verify the fix', or when a sub-agent finishes implementing a change."
argument-hint: "[optional: 'full' to run full service suite — requires a reason]"
---

# Validate Changes — Targeted Test Runner

Run only the tests that matter for what you just changed. This saves tokens and time compared to running the full suite.

## When to Use This

After making any code change — bug fix, new feature, refactoring — invoke this skill to verify your changes didn't break anything. The goal is surgical precision: run only the test files that cover the code you touched.

## Step 1: Identify Changed Files

Determine which source files were modified. Use one of these approaches depending on context:

1. **You already know what you changed** — use that list directly (preferred, fastest)
2. **Check git** — run `git diff --name-only HEAD` to see unstaged changes, or `git diff --name-only --cached` for staged changes

Filter to only source files (ignore `*.spec.ts`, `*.md`, config files). Focus on `apps/` and `packages/` directories.

## Step 2: Map Source Files to Test Files

For each changed source file, find its corresponding test file(s). The project uses these patterns:

### Pattern mapping

Given a source file `apps/{service}/src/{path}/{name}.ts`:

| Priority | Test location | Example |
|----------|--------------|---------|
| 1 | `apps/{service}/test/unit/{path}/{name}.spec.ts` | `apps/api/src/filters/filters.service.ts` → `apps/api/test/unit/filters/filters.service.spec.ts` |
| 2 | `apps/{service}/src/{path}/__tests__/{name}.spec.ts` | `apps/scraper/src/adapters/dealabs/dealabs.adapter.ts` → `apps/scraper/src/adapters/dealabs/__tests__/dealabs.adapter.spec.ts` |
| 3 | Partial name match in `test/unit/` | `apps/api/src/auth/strategies/jwt.strategy.ts` → `apps/api/test/unit/auth/auth.service.spec.ts` (related module) |

### How to discover test files

Use `Glob` to find matching test files. For a changed file like `apps/api/src/filters/filters.service.ts`:

```
# Exact match patterns (try these first)
Glob: apps/api/test/unit/**/filters.service.spec.ts
Glob: apps/api/src/**/filters.service.spec.ts

# Broader module match (if exact match fails)
Glob: apps/api/test/unit/filters/**/*.spec.ts
```

### Special cases

- **`packages/database/` changes** (schema, migrations) → run ALL service test suites (schema affects everything)
- **`packages/shared-types/` changes** → run test suites for services that import the changed types
- **`packages/shared-utils/` changes** → run test suites for services that use the changed utility
- **Config files** (`jest.config`, `tsconfig`) → run that service's full test suite
- **No test file found** → report this clearly and suggest the agent create a test file

## Step 3: Run the Targeted Tests

### Running individual test files

Execute tests from the **service's root directory** using its dotenv + jest setup. The command pattern is:

```bash
cd apps/{service} && pnpm dotenv -e ../../.env.test -- jest --forceExit --detectOpenHandles --verbose --testPathPattern="{pattern}" --passWithNoTests
```

Where `{pattern}` is a regex matching the test file path(s). Examples:

```bash
# Single test file
cd apps/api && pnpm dotenv -e ../../.env.test -- jest --forceExit --detectOpenHandles --verbose --testPathPattern="test/unit/filters/filters.service.spec.ts" --passWithNoTests

# Multiple test files in the same service (use regex OR)
cd apps/scraper && pnpm dotenv -e ../../.env.test -- jest --forceExit --detectOpenHandles --verbose --testPathPattern="test/unit/filter-matching/rule-engine|test/unit/notification/notification.service" --passWithNoTests

# Test files across services — run separate commands per service
```

### Important execution notes

- Always run from the service's directory (`cd apps/{service}`)
- Always include `--passWithNoTests` to avoid false failures
- Always include `--forceExit --detectOpenHandles` to prevent hanging
- Use `--verbose` so the output shows which tests ran and their status
- Set a reasonable timeout (60s should be enough for targeted tests)
- If a test file is in `src/__tests__/`, the `--testPathPattern` still works — Jest searches all files matching the pattern regardless of `testMatch` config

## Step 4: Interpret and Act on Results

### Tests pass
Report concisely: "Ran X test(s) covering [changed modules] — all passing."

### Tests fail
1. Read the failure output carefully
2. Identify if the failure is caused by your changes or pre-existing
3. If caused by your changes: fix the code and re-run the same targeted tests
4. If pre-existing: note it and move on — don't fix unrelated failures

### No test files found
Report: "No test files found for [changed files]. Consider creating tests for: [list of untested files]."
Only create new tests if the user or task explicitly asks for it.

## Full Suite Mode (Use Sparingly)

If the argument is `full`, run the full service test suite instead of targeted tests. This should only happen when:
- The user explicitly requests it
- Changes are so broad that targeting individual files isn't practical (e.g., changing a core utility used everywhere)
- Schema/migration changes that affect all services

```bash
# Full service suite
pnpm test:{service}:unit

# Full monorepo suite
pnpm cli test unit
```

When running full suite, state the reason clearly: "Running full [service] test suite because: [reason]."

## Decision Flowchart

```
Changed files identified
    │
    ├─ packages/database/ changed? → Run ALL service suites (schema affects everything)
    │
    ├─ packages/shared-*/ changed? → Run suites for affected services
    │
    ├─ apps/{service}/src/ changed?
    │   ├─ Found matching test files? → Run those specific tests
    │   └─ No matching tests? → Report gap, suggest creation
    │
    ├─ Config files changed? → Run that service's full suite
    │
    └─ Only docs/README changed? → Skip tests, nothing to validate
```

## What NOT to Do

- Do NOT run `pnpm cli test unit` (full monorepo) unless explicitly asked or schema changed
- Do NOT run `pnpm test:{service}:unit` when you can target specific files
- Do NOT run tests for services unaffected by your changes
- Do NOT run integration tests unless the changes specifically affect integration points and infra is running
- Do NOT ignore test failures — either fix them or explicitly note them as pre-existing
