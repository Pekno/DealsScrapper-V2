---
name: db-migrate
description: "Prisma database migration workflow for DealsScrapper. Use this skill whenever the user wants to add/modify/remove database fields, create a new model, change relationships, or anything involving the Prisma schema. Also use when the user says 'add a field', 'update the schema', 'create a migration', 'change the model', or asks about database structure changes. This ensures the full workflow is followed: schema change, migration, client regeneration, and cross-service type verification."
argument-hint: "[description of the change]"
---

# Database Migration Workflow

You are performing a Prisma schema change for DealsScrapper. The change requested: ``

## Critical Rules

- **NEVER use `select` in Prisma queries** — ALWAYS use `include`. This is a project-wide rule because `select` breaks TypeScript typing.
- **Use `@@map()` for table names** (snake_case) and `@map()` for column names
- **Always add `@@index()` for foreign keys** and frequently queried fields
- **All changes go through the packages-expert agent** — it owns `packages/database/`

## Workflow

### Step 1: Understand the current schema
Read `packages/database/prisma/schema.prisma` to understand the existing models and relationships before making changes.

### Step 2: Plan the change
Before modifying anything, describe:
- What models are affected
- What fields are being added/modified/removed
- Whether any relationships change
- Whether this is a breaking change for existing data (needs data migration or default values)

Present this plan to the user for confirmation.

### Step 3: Modify the Prisma schema
**Delegate to: packages-expert agent**

Edit `packages/database/prisma/schema.prisma` following these conventions:
```prisma
model Example {
  id        String   @id @default(cuid())
  newField  String?  @map("new_field")    // snake_case in DB
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  // Relations
  relatedId String @map("related_id")
  related   Related @relation(fields: [relatedId], references: [id])

  @@index([relatedId])
  @@map("examples")
}
```

### Step 4: Create and apply migration
Run these commands:
```bash
pnpm cli db migrate    # Creates migration SQL and applies it
pnpm cli db generate   # Regenerates Prisma Client with new types
```

If the migration requires a name, use a descriptive one like `add_view_count_to_deals` or `create_price_history_table`.

### Step 5: Verify types compile
```bash
pnpm cli check types   # TypeScript type checking across all services
```

If there are type errors in services that depend on the changed model, those services need updating too. Coordinate with the appropriate service agents.

### Step 6: Update shared types if needed
If the schema change affects shared interfaces (e.g., `ArticleWithExtensions`, DTOs), update them in `packages/shared-types/`.

### Step 7: Verify tests still pass
```bash
pnpm cli test unit     # Run unit tests to catch regressions
```

## Common Patterns

### Adding a field with a default (non-breaking)
```prisma
model Deal {
  viewCount Int @default(0) @map("view_count")  // Safe — existing rows get 0
}
```

### Adding a nullable field (non-breaking)
```prisma
model User {
  avatarUrl String? @map("avatar_url")  // Safe — existing rows get null
}
```

### Adding a required field (BREAKING — needs default or data migration)
```prisma
model User {
  role String @default("user") @map("role")  // Needs default for existing rows
}
```

### Adding a new model with relations
Make sure to add the relation on BOTH sides and add `@@index` on foreign keys.

## Completion Checklist

- [ ] Schema modified correctly
- [ ] Migration created and applied
- [ ] Prisma Client regenerated
- [ ] Types compile across all services
- [ ] Shared types updated if needed
- [ ] Tests pass
