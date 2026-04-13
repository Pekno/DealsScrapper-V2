---
name: database-schema
description: >
  Load this skill when working with database models, writing Prisma queries, or needing to
  understand data relationships in DealsScrapper. Contains all core models (Site, User, Filter,
  Article, Category, Match, Notification, ScheduledJob), their fields, relationships, cascade
  rules, and critical breaking changes from the multi-site migration. Invoke for any task
  involving data modeling, schema changes, or cross-model queries.
---

# DealsScrapper — Database Schema

## Core Models

### Site
Multi-site support with branding:
```prisma
model Site {
  id        String    @id  // 'dealabs', 'vinted', 'leboncoin'
  name      String         // Display name
  color     String         // Brand color (hex)
  isActive  Boolean   @default(true)
  iconUrl   String?
  categories Category[]
  articles   Article[]
}
```

### User
Authentication and preferences:
- Email/password authentication with bcrypt
- Email verification flow (`emailVerified`, `verificationToken`)
- Login attempt tracking (`loginAttempts`, `lockedUntil`)
- Notification preferences stored as JSONB in `notificationPreferences`

### Filter
User-defined deal filters:
- Complex `filterExpression` JSON field (rule-based with AND/OR/operators)
- Category associations via `FilterCategory` join table
- **`enabledSites` field was REMOVED** — sites are derived: Filter → FilterCategory → Category → Site
- Notification settings: `immediateNotifications`, `digestFrequency`, `maxNotificationsPerDay`
- Performance tracking: `totalMatches`, `matchesLast24h`, `lastMatchAt`

### Article (Universal Deal)
Core deal data across all sites:
- **`siteId` is REQUIRED** (FK to Site with cascade delete)
- Universal fields: `title`, `description`, `url`, `imageUrl`, `currentPrice`, `category`, `isActive`, `isExpired`
- Semi-universal fields: `location` (LeBonCoin), `publishedAt` (Dealabs/LeBonCoin)
- Composite unique key: `@@unique([siteId, externalId])`

### Article Extension Tables (Site-Specific)
Site-specific fields live in extension tables — NO `@relation` in these tables; the application layer joins Article with its extension:

```
ArticleDealabs    → temperature, merchant, discount, freeShipping, merchantRating
ArticleVinted     → favoriteCount, brand, size, condition, sellerRating
ArticleLeBonCoin  → location, proSeller, urgentFlag, deliveryOptions
```

**Key**: `temperature` is in `ArticleDealabs`, NOT in base `Article`.

### Category
Hierarchical categories per site:
- `siteId` FK (cascade delete)
- `parentId` self-referencing FK (cascade delete on parent delete)
- `sourceUrl` for scraping
- Stats: `dealCount`, `avgTemperature`
- Unique constraint: `@@unique([siteId, sourceUrl])`

### Match & Notification
- **Match**: Links Filter to Article with a score; triggers notification creation
- **Notification**: Delivery tracking per user — `sent`, `sentAt`, `failed`, `isRead`, `readAt`

### Scheduling
- **ScheduledJob**: 1:1 with Category; tracks scraping frequency, `filterCount` (users monitoring this category), `optimizedQuery`
- **ScrapingJob**: Execution history with status and timing

## Cascade Delete Chains

```
User → Filter → FilterCategory
     → Filter → Match → Notification
     → UserSession
     → Notification

Site → Category → Article → Match
     → Category → FilterCategory
     → Category (parent) → Category (children) → ScheduledJob → ScrapingJob
```

## Key Patterns

### NEVER `select`, ALWAYS `include`
Maintains full TypeScript typing — see `prisma-standards` skill for details.

### Site-Specific Extensions
Use the wrapper pattern: no `@relation` in extension tables. Application layer joins base Article with the appropriate extension based on `siteId`.

## Breaking Changes (Multi-Site Migration)

These fields were **removed** — do NOT reference them:
- `Filter.enabledSites` → derived from categories now
- `Category.source` → replaced by `Category.siteId`
- `Category.parentSlug` → replaced by `Category.parentId`
- `Article.source` → replaced by `Article.siteId`

These fields were **added** as required:
- `Article.siteId` — REQUIRED, will fail without it
- `Category.siteId` — REQUIRED

## Shared Types (sites module)

Field definitions live in `packages/shared-types/src/sites/`:
```typescript
import { getFieldsForSites, getColumnsForSites } from '@dealscrapper/shared-types/sites/field-definitions';
import { SiteFilterRule, validateSiteFilterExpression } from '@dealscrapper/shared-types/sites/filter-rules';
import { getColumnsForSites, TableColumnDefinition } from '@dealscrapper/shared-types/sites/table-columns';
```

Type naming uses `Site` prefix to avoid collisions: `SiteFieldDefinition`, `SiteFilterRule`, `SiteRuleGroup`.
