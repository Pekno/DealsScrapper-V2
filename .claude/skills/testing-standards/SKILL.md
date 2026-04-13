---
name: testing-standards
description: >
  Load this skill when writing, reviewing, or running tests in the DealsScrapper codebase.
  Contains mandatory testing rules: no fake tests, Arrange-Act-Assert pattern, unit/integration/E2E
  categories, mocking guidelines, and coverage requirements. Invoke before writing any test file
  or assessing test quality.
---

# DealsScrapper — Testing Standards

## Core Rule: NO FAKE TESTS

Every test must:
- Actually test the functionality it claims to test
- Have meaningful assertions that can fail
- Fail when the code is broken
- Pass when the code works correctly

```typescript
// ❌ FAKE TEST — Never do this
it('should create user', () => {
  expect(true).toBe(true);
});

// ✅ REAL TEST — Always do this
it('should create user with valid data', async () => {
  const result = await userService.create(validUserData);
  expect(result.id).toBeDefined();
  expect(result.email).toBe(validUserData.email);
});
```

## Test Structure: Arrange-Act-Assert

```typescript
it('should update filter name', async () => {
  // Arrange
  const filter = await createTestFilter();
  const newName = 'Updated Filter';

  // Act
  const updated = await filterService.update(filter.id, { name: newName });

  // Assert
  expect(updated.name).toBe(newName);
});
```

## Test Categories

| Type | Scope | Dependencies | Command |
|---|---|---|---|
| **Unit** | Isolated function/method | Mocked | `pnpm test:<service>:unit` |
| **Integration/E2E** | Modules together, endpoints | Real DB (test instance) | `pnpm test:<service>:e2e` |
| **Cypress E2E** | Full user flows | Running services | `pnpm test:e2e` |

## Mocking Guidelines
- Mock external APIs and services (HTTP calls, email providers, Redis in unit tests)
- Use NestJS dependency injection for testability — inject mocks via `moduleRef`
- Prefer spies over full mocks when you only need to observe calls
- Reset mocks between tests (`jest.clearAllMocks()` in `beforeEach`)
- For integration tests: use real DB test instance, not mocked Prisma

## Test Data
- When creating test articles, `siteId` is **REQUIRED**:
```typescript
const testArticle = await prisma.article.create({
  data: {
    externalId: 'test-123',
    siteId: 'dealabs',  // REQUIRED — will fail without this
    title: 'Test Deal',
    url: 'https://example.com/deal',
  }
});
```

## Coverage
- Aim for meaningful coverage, not 100% for its own sake
- **Critical paths must be tested** (auth flows, filter evaluation, notification delivery)
- **Error handling must be tested** — test what happens when things fail
- Target: >80% for services; >90% for core business logic

## Per-Service Commands
```bash
pnpm test:api:unit         # API unit tests
pnpm test:api:e2e          # API integration tests
pnpm test:scraper:unit     # Scraper unit tests
pnpm test:notifier:unit    # Notifier unit tests
pnpm test:scheduler:unit   # Scheduler unit tests
pnpm test:web              # Web frontend tests
pnpm cli test unit         # All unit tests
pnpm cli test complete     # Full suite (infra → build → unit → e2e)
```
