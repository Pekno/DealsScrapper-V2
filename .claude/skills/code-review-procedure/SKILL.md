---
name: code-review-procedure
description: >
  Load this skill when performing a code quality review or shared package audit for any
  DealsScrapper service. Contains the 8-phase review procedure (type safety, SOLID, clean code,
  logging migration, tests, documentation) and the 8-phase shared package usage audit procedure.
  Invoke when asked to review, audit, or assess code quality for any service. The detailed phase
  checklists are in references/ — read them when executing a full review.
---

# DealsScrapper — Code Review & Audit Procedures

## When to Use What

- **Full code quality review** → follow the 8-phase Quality Review procedure
- **Shared package compliance audit** → follow the 8-phase Package Audit procedure
- **Quick spot-check** → use the grading scales below

Read the detailed procedure files from `references/` when executing a full review:
- `references/quality-review-phases.md` — Step-by-step phases 0-7
- `references/package-audit-phases.md` — Step-by-step phases 0-8

---

## Quality Review — Summary

**8 mandatory phases, in order:**

| Phase | Name | Critical Check |
|---|---|---|
| 0 | Complete Coverage Verification | Map ALL files before starting |
| 1 | Discovery & Analysis | Understand architecture and dependencies |
| 2 | Type Safety | Zero `any` types |
| 3 | SOLID Principles | SRP, DI, interface segregation |
| 4 | Clean Code | **Logging migration (MANDATORY)** |
| 5 | Documentation | JSDoc on all public APIs |
| 6 | Test Verification | Tests pass, no fake tests |
| 7 | Final Coverage Verification | Confirm zero logging violations |

### 🚨 Logging: Automatic F-Grade

Any `new Logger()` from `@nestjs/common` = **automatic F-grade for Phase 4**.

```typescript
// ❌ FORBIDDEN
import { Logger } from '@nestjs/common';
private readonly logger = new Logger(MyService.name);

// ✅ REQUIRED
import { createServiceLogger } from '@dealscrapper/shared-logging';
private readonly logger = createServiceLogger('service-name');
```

### Overall Grade Formula
```
Overall = (TypeSafety × 0.25) + (SOLID × 0.20) + (CleanCode × 0.25) + (Docs × 0.15) + (Tests × 0.15)
```

Any logging violations → maximum **B grade** regardless of other scores.

---

## Package Audit — Summary

**8 phases checking shared package compliance:**

| Phase | What's Checked |
|---|---|
| 0 | Inventory all shared package exports first |
| 1 | Type definitions — duplicated vs properly imported |
| 2 | Config — `SharedConfigService` used, no direct `process.env` |
| 3 | Logging — `createServiceLogger`, no `new Logger()` |
| 4 | Repository pattern — extends base classes |
| 5 | Utility functions — no duplicated shared utilities |
| 6 | Response formatting — `StandardApiResponse` used |
| 7 | Health checks — `shared-health` interfaces used |
| 8 | Prisma — NEVER `select`, ALWAYS `include` |

**Coverage score**: (correct usages / total opportunities) × 100

---

## Quick Grading Scale

| Grade | Score | Meaning |
|---|---|---|
| A+ | 95-100% | Perfect — ship it |
| A | 90-94% | Excellent — minor notes only |
| B | 80-89% | Good — some improvements recommended |
| C | 70-79% | Acceptable — several issues |
| F | <70% | Critical issues — block until fixed |

**Instant F triggers:**
- Any `new Logger()` usage
- Any Prisma `select` usage
- Fake tests (assertions that always pass)
- >10 untyped `any` usages

---

## Report Template

```markdown
# Code Quality Review: {Service}

## Summary
- **Overall Grade**: {grade} ({score}/100)
- **Files Reviewed**: {n}/{total}
- **Critical Issues**: {count}

## Phase Scores
- Phase 2 — Type Safety: {grade} — {X} `any` types
- Phase 3 — SOLID: {grade} — {notes}
- Phase 4 — Clean Code: {grade} — {X} logging violations
- Phase 5 — Documentation: {grade} — {coverage}%
- Phase 6 — Tests: {grade} — {pass}/{total} passing

## Issues Found
### 🚨 Critical (must fix)
1. ...

### ⚠️ High Priority (should fix)
1. ...

## Verification
✅ All 8 phases completed
✅ Zero logging violations confirmed
✅ All tests passing
```
