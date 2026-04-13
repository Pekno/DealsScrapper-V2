---
name: prisma-standards
description: >
  Load this skill when writing or reviewing ANY Prisma queries in the DealsScrapper codebase.
  Contains the critical rule (NEVER select, ALWAYS include), query patterns, transaction usage,
  and migration workflow. Invoke when working on repositories, database queries, or anything
  touching the Prisma client in api, scraper, scheduler, notifier, or packages-expert work.
---

# DealsScrapper — Prisma Standards

## 🚨 CRITICAL RULE: NEVER `select`, ALWAYS `include`

Using `select` breaks TypeScript typing and creates partial types that are incompatible with the rest of the codebase.

```typescript
// ❌ NEVER DO THIS — Breaks typing
const users = await prisma.user.findMany({
  select: { id: true, email: true }
});
// Type becomes { id: string; email: string } — missing fields!

// ✅ ALWAYS DO THIS — Maintains full types
const users = await prisma.user.findMany({
  include: { filters: true }
});
// Type is User & { filters: Filter[] } — fully typed!
```

**Any `select` usage is a critical violation.** This rule has no exceptions.

## Query Patterns

### Finding Records

```typescript
// Find unique
const user = await prisma.user.findUnique({
  where: { id: userId },
  include: { filters: true }
});

// Find many with conditions
const filters = await prisma.filter.findMany({
  where: { userId, active: true },
  include: { categories: true }
});
```

### Creating Records

```typescript
const filter = await prisma.filter.create({
  data: {
    name: 'My Filter',
    userId: user.id,
    filterExpression: { type: 'AND', rules: [] }
  },
  include: { user: true, categories: true }
});
```

### Updating Records

```typescript
const updated = await prisma.filter.update({
  where: { id: filterId },
  data: { active: false },
  include: { categories: true }
});
```

## Transactions

Use transactions for operations that must succeed or fail together:

```typescript
await prisma.$transaction(async (tx) => {
  const user = await tx.user.create({ data: userData });
  await tx.filter.create({ data: { ...filterData, userId: user.id } });
});
```

## Migrations Workflow

```bash
pnpm cli db generate    # After schema changes — regenerates Prisma client
pnpm cli db migrate     # Creates migration file + applies to DB
pnpm cli db push        # Push schema without creating migration file (dev only)
```

**Rules:**
- Always run `db generate` after schema changes
- Never modify migration files after they've been applied
- Coordinate with packages-expert agent for schema changes

## Key Schema Gotchas

- `Article.siteId` is **REQUIRED** (not optional) — always provide it when creating articles
- `Filter.enabledSites` was **REMOVED** — sites are derived from `filter.categories[].siteId`
- `temperature` is in `ArticleDealabs` extension table, NOT in base `Article`
- Cascade deletes are set up throughout — deleting a User cascades to all their data
