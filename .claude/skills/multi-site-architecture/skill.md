---
name: multi-site-architecture
description: >
  Load this skill when working on any multi-site feature in DealsScrapper: adding a new site/adapter,
  modifying the Article base model or extension tables (ArticleDealabs, ArticleVinted, ArticleLeBonCoin),
  implementing the declarative field mapping system, working on multi-queue job routing, site-specific
  category discovery, filter system with enabledSites/siteSpecific rules, frontend SiteSelector or
  site-aware components, or ElasticSearch multi-site indexing.
  Use proactively whenever the user mentions Vinted, LeBonCoin, ISiteAdapter, ArticleWrapper,
  FieldMappingConfig, IUrlOptimizer, MultiSiteJobDistributor, SiteSource, or asks about
  "adding a site", "new site support", "site-specific fields", or "multi-site".
---

# Multi-Site Architecture Reference

## Architecture Principles

- **Adapter Pattern**: Each site has an `ISiteAdapter` implementation. The `AdapterRegistry` factory maps `SiteSource → ISiteAdapter`.
- **Wrapper Pattern**: `ArticleWrapper { base: Article, extension: SiteExtension, source: string }` — 2-step load (base first, then extension by `source` discriminator).
- **Repository Pattern**: `ArticleRepository` is the **sole entry point** for reading/writing articles. All writes use `prisma.$transaction` (atomic base + extension creation).
- **Declarative Field Mapping**: CSS selectors are declared in config objects (`FieldMappingConfig`), not in imperative code. The shared `FieldExtractorService` handles all extraction.
- **Multi-Queue Isolation**: Separate BullMQ queues per site (`jobs-dealabs`, `jobs-vinted`, `jobs-leboncoin`). Queue failures don't cross-contaminate.
- **Optional URL Optimization**: `IUrlOptimizer` is optional per adapter. Check `if (adapter.urlOptimizer)` before using.

---

## Database Schema

### Base Article Model (`articles` table)
Universal fields only — ZERO site-specific fields, ZERO relations to extension tables.

```prisma
model Article {
  id            String   @id @default(cuid())
  externalId    String                         // Site's native ID (NOT globally unique)
  source        String                         // 'dealabs' | 'vinted' | 'leboncoin'
  title         String
  description   String?
  url           String
  imageUrl      String?
  currentPrice  Float?
  categoryId    String
  categoryPath  String[]                       // Breadcrumb trail
  location      String?                        // Only LeBonCoin uses this prominently
  publishedAt   DateTime?
  isActive      Boolean  @default(true)
  isExpired     Boolean  @default(false)
  scrapedAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  category      Category @relation(...)
  matches       Match[]
  @@unique([source, externalId])               // Same externalId allowed on different sites
  @@map("articles")
}
```

**Key design decisions:**
- `@@unique([source, externalId])` — not `externalId @unique` (different sites can reuse IDs)
- NO `temperature`, `commentCount`, `merchant`, `originalPrice` on the base model
- NO Prisma `@relation` from Article to extension tables

### Extension Tables (linked via `articleId @id`)

| Table | Key Fields |
|---|---|
| `article_dealabs` | `temperature`, `commentCount`, `communityVerified`, `originalPrice`, `discountPercentage`, `merchant`, `freeShipping`, `isCoupon`, `expiresAt` |
| `article_vinted` | `favoriteCount`, `viewCount`, `boosted`, `brand`, `size`, `color`, `condition`, `sellerName`, `sellerRating`, `buyerProtectionFee` |
| `article_leboncoin` | `city`, `postcode`, `department`, `region`, `proSeller`, `sellerName`, `urgentFlag`, `topAnnonce`, `deliveryOptions`, `shippingCost`, `condition`, `attributes` (Json) |

Extension tables use `articleId String @id` — **no `@relation` directive** (intentional, managed in app layer).

### Category Model (multi-site aware)
```prisma
model Category {
  source    String   // 'dealabs' | 'vinted' | 'leboncoin'
  slug      String
  @@unique([source, slug])
}
```

### Filter Model (site selection)
```prisma
model Filter {
  enabledSites  String[] @default(["dealabs"])  // ['dealabs', 'vinted', 'leboncoin']
  // FilterCategory join table for many-to-many with Category
}
```

---

## Scraper Adapters

### ISiteAdapter Interface
**File**: `apps/scraper/src/adapters/base/site-adapter.interface.ts`

```typescript
export enum SiteSource { DEALABS = 'dealabs', VINTED = 'vinted', LEBONCOIN = 'leboncoin' }

export interface ISiteAdapter {
  readonly siteId: SiteSource;
  readonly baseUrl: string;
  readonly displayName: string;
  readonly colorCode: string;       // Hex, used by frontend
  readonly urlOptimizer?: IUrlOptimizer;  // Optional — not all sites support it

  extractListings(html: string, sourceUrl: string): UniversalListing[];
  buildCategoryUrl(categorySlug: string, page?: number): string;
  extractCategorySlug(url: string): string;
  extractElementCount(html: string): number | undefined;
  getListingSelector(): string;
  validateHtml(html: string): void;
}
```

### UniversalListing (shared type in `@dealscrapper/shared-types`)
```typescript
export interface UniversalListing {
  externalId: string;
  title: string;
  description: string | null;
  url: string;
  imageUrl: string | null;
  source: SiteSource;
  currentPrice: number | null;
  originalPrice: number | null;   // Dealabs-only, null for others
  merchant: string | null;        // Dealabs-only, null for others
  location: string | null;
  publishedAt: Date;
  isActive: boolean;
  categorySlug: string;
  siteSpecificData: DealabsData | VintedData | LeBonCoinData;  // discriminated union by `type`
}
```

### AdapterRegistry
**File**: `apps/scraper/src/adapters/adapter.registry.ts`

Injectable NestJS service. Holds `Map<SiteSource, ISiteAdapter>`. Use `getAdapter(siteId)` to resolve the correct adapter at runtime.

### File Locations
```
apps/scraper/src/adapters/
├── base/
│   ├── site-adapter.interface.ts
│   ├── category-discovery-adapter.interface.ts
│   └── url-optimizer.interface.ts
├── adapter.registry.ts
├── dealabs/
│   ├── dealabs.adapter.ts
│   ├── dealabs.field-config.ts
│   ├── dealabs.transformers.ts
│   ├── dealabs-url-optimizer.ts
│   └── dealabs-category-discovery.adapter.ts
├── vinted/
│   ├── vinted.adapter.ts
│   ├── vinted.field-config.ts
│   └── vinted-url-optimizer.ts
└── leboncoin/
    ├── leboncoin.adapter.ts
    └── leboncoin.field-config.ts  (no url optimizer)
```

---

## Declarative Field Mapping System

**File**: `apps/scraper/src/field-extraction/`

The goal: **zero extraction code per field**. Declare selectors in a config; `FieldExtractorService` handles extraction, fallback chains, transforms, parsing, and validation.

### FieldMappingConfig structure
```typescript
export interface FieldMapping {
  selectors: string[];              // Fallback chain — first match wins
  strategy: 'text' | 'attribute' | 'html' | 'regex' | 'custom';
  attribute?: string;               // For 'attribute' strategy
  regex?: string | RegExp;          // For 'regex' strategy
  regexGroup?: number;
  required?: boolean;               // If true and fails → listing discarded
  default?: any;
  transform?: Array<TransformFunction | string>;  // Built-ins: 'sanitize', 'trim', 'lowercase', 'uppercase'
  parser?: 'integer' | 'float' | 'price' | 'date' | 'relativeDate' | 'boolean' | 'url';
  validator?: { min?, max?, minLength?, maxLength?, pattern?, enum? };
}
```

### How adapters use it
```typescript
// In adapter.extractListings():
const extracted = this.fieldExtractor.extract($, $(element), dealabsFieldConfig, {
  siteId: this.siteId,
  siteBaseUrl: this.baseUrl,
  sourceUrl,
});
// Then map extracted fields to UniversalListing
```

**Rule**: All sites must use declarative configs. No ad-hoc `extractX()` helpers scattered through services.

---

## Job Routing & Queues

### Queue Names
- `jobs-dealabs`, `jobs-vinted`, `jobs-leboncoin`

### MultiSiteJobDistributorService
**File**: `apps/scheduler/src/job-distributor/multi-site-job-distributor.service.ts`

Holds `Map<SiteSource, Queue>`. Injects `@InjectQueue('jobs-dealabs')` etc. Routes jobs via `distributeScrapeJob(categorySlug, targetSite)`.

### MultiSiteScrapeProcessor
**File**: `apps/scraper/src/processors/multi-site-scrape.processor.ts`

Decorated with `@Processor('jobs-dealabs')`, `@Processor('jobs-vinted')`, `@Processor('jobs-leboncoin')`. Resolves the correct adapter from `AdapterRegistry` by `job.data.site`, then calls `UnifiedExtractionService.scrapeCategory(adapter, slug)`.

### Worker registration
Workers register with scheduler via worker-health channel, sending `{ workerId, site: SiteSource, capabilities }`. Scheduler routes only to queues with registered workers.

---

## Category Discovery

```typescript
export interface ICategoryDiscoveryAdapter {
  readonly siteId: SiteSource;
  discoverCategories(): Promise<CategoryMetadata[]>;
  buildCategoryTree(): Promise<CategoryNode[]>;
}
```

Each site has its own `*CategoryDiscoveryAdapter` that scrapes the site's navigation/sitemap. Persists to `Category` table with `source` field.

---

## Filter System (Multi-Site)

### `enabledSites` on Filter
Controls which sites a filter applies to. The UI uses this to dynamically show only categories from selected sites.

### `siteSpecific` on filter rules
```json
{
  "field": "temperature",
  "operator": "greaterThan",
  "value": 100,
  "siteSpecific": "dealabs"
}
```
Rules with `siteSpecific` are **skipped** (not failed) for articles from other sites.

### Filter matching
**File**: `apps/notifier/src/matching/multi-site-filter-matcher.service.ts`

```typescript
// If rule has siteSpecific and article.source !== siteSpecific → return true (skip)
if (siteSpecific && article.source !== siteSpecific) return true;
```

### Available filter fields
- **Common**: `COMMON_FILTER_FIELDS` — `title`, `currentPrice`, `category`, `location`, `publishedAt`
- **Site-specific**: `SITE_SPECIFIC_FIELDS[SiteSource]` — `temperature` (dealabs), `favoriteCount`/`condition`/`brand`/`size` (vinted), `urgentFlag`/`proSeller`/`city` (leboncoin)

---

## Frontend Components

### Site Registry Hook
`useSiteRegistry()` — fetches `GET /api/sites/available` which returns `[{ id, name, color, baseUrl }]` from `AdapterRegistry.getSiteMetadata()`. Cached 1 hour.

### Key Components
| Component | File | Purpose |
|---|---|---|
| `SiteSelector` | `apps/web/src/components/filters/SiteSelector.tsx` | Multi-select site badges with brand colors |
| `SiteSpecificField` | `apps/web/src/components/filters/SiteSpecificField.tsx` | Filter rule row with site affinity tag |
| `SiteBadge` | `apps/web/src/components/ui/SiteBadge.tsx` | Colored badge for article cards |

Frontend reads `site.color` (hex from adapter) for brand-colored UI. Categories dropdown updates dynamically based on selected `enabledSites`.

---

## ElasticSearch Strategy

- **Single index** `articles` for all sites (multi-site mapping)
- `source` field is a keyword — used for site-specific queries
- Site-specific fields stored as optional (null for other sites)
- `ArticleWrapper` serializes to `{ ...base, ...extension }` flat object for indexing
- When `source === 'dealabs'`, extension fields (`temperature`, etc.) appear in the document; they're absent for other sites

---

## Adding a New Site — Checklist

1. **packages-expert**: Add `ArticleNewSite` extension model, add `SiteSource.NEWSITE` enum value, add `NewSiteData` to `SiteSpecificData` union, add `SITE_SPECIFIC_FIELDS.newsite`
2. **scraper-worker**: Create `apps/scraper/src/adapters/newsite/` with `NewSiteAdapter`, `newsite.field-config.ts`, `newsite.transformers.ts` (optional), `NewSiteCategoryDiscoveryAdapter`. Register in `AdapterRegistry`.
3. **scheduler-service**: Add `@InjectQueue('jobs-newsite')`, register in `MultiSiteJobDistributorService`.
4. **packages-expert**: Run `pnpm cli db migrate` to apply schema changes.
5. **web-frontend**: `SiteSelector` and filter builder auto-update via `useSiteRegistry()` — no manual changes needed if adapter `displayName`/`colorCode` are set correctly.
