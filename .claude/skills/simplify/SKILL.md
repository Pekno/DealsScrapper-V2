---
name: simplify
description: "Code cleanup and simplification pass for DealsScrapper. Use this skill whenever the user wants to clean up code, remove dead code, fix bad comments, eliminate unused imports, reduce complexity, or tidy up after a vibecoding session. Trigger on: 'simplify', 'clean up', 'dead code', 'messy', 'refactor for clarity', 'too much cruft', 'tidy up', or when code quality is visibly poor after rapid iteration."
argument-hint: "[service or directory path, e.g., 'scraper', 'apps/scheduler/src/', 'all']"
---

# Code Simplification Pass

Target: ``

This skill delegates to the **code-simplifier agent** with specific guidelines for the DealsScrapper codebase. The core problem: rapid vibecoding sessions leave behind dead code, misleading comments, unused imports, and duplicated logic that accumulates over time.

## Step 1: Determine Scope

Map the argument to a directory:
- `api` → `apps/api/src/`
- `scraper` → `apps/scraper/src/`
- `scheduler` → `apps/scheduler/src/`
- `notifier` → `apps/notifier/src/`
- `web` → `apps/web/src/`
- `packages` → `packages/`
- `all` → run per-service, one at a time
- A specific path → use as-is

## Step 2: Delegate to code-simplifier agent

Pass the target directory to the code-simplifier agent. It will:
1. Read EVERY `.ts` file (excluding `*.spec.ts`)
2. Identify and fix issues
3. Verify with build + tests

## What to Target (Priority Order)

### Priority 1: Dead Code and Leftovers
These are the most common vibecoding artifacts:
- **Unused imports** — imports that were added during exploration but never used
- **Commented-out code blocks** — old code left "just in case" instead of being deleted (git has history)
- **Unused variables and functions** — declared but never referenced
- **Empty catch blocks** — `catch (e) {}` that silently swallow errors
- **Console.log statements** — debug logging left in production code (use the project's Winston logger instead)
- **TODO/FIXME/HACK comments that are stale** — if the TODO was done or is no longer relevant, remove it

### Priority 2: Bad Comments
Comments that hurt more than they help:
- **Comments that restate the code** — `// increment counter` above `counter++`
- **Outdated comments** — describe behavior the code no longer has
- **Section divider comments** — `// ========== SECTION ==========` (use proper functions/files instead)
- **Commented-out alternatives** — `// could also do it this way...`
- **Over-documented obvious code** — every line doesn't need a comment

The rule: if a comment doesn't explain WHY something non-obvious was done, it probably shouldn't exist.

### Priority 3: Duplication
- Near-identical code blocks across files → extract to shared utility
- Repeated mapping/transformation logic → reusable mapper
- Copy-pasted validation patterns → shared validator

### Priority 4: Type Safety
- Replace `any` with proper types (Prisma-generated types preferred)
- Add missing return types on exported functions
- Use type guards instead of type assertions

## What NOT to Touch

- **Test files** (`*.spec.ts`) — never modify
- **Config files** (`package.json`, `tsconfig.json`, etc.) — never modify
- **Business logic** — don't change what the code does, only how it's expressed
- **Don't add new dependencies**
- **Don't add comments or docstrings** to code you didn't otherwise change

## Step 3: Verify

After changes, the code-simplifier agent must:
```bash
pnpm cli build                    # Build passes
pnpm cli test unit                # Unit tests pass (or the specific service)
```

If tests fail due to the simplification changes, fix the source code (not the tests).

## Output

Report back with:
- Files read vs files modified
- Summary of changes per file (1-line each)
- Build and test status
