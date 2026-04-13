# Scheduler Service - Job Orchestration Engine

## Overview

The Scheduler Service is the **central orchestrator** of DealsScapper's distributed scraping architecture. It intelligently creates, distributes, and optimizes scraping jobs across multiple worker instances using site-specific BullMQ queues.

**Key Responsibilities:**
- **Adaptive Scheduling** - Dynamically adjusts scraping frequency based on user activity and category metrics
- **URL Filter Optimization** - Reduces scraping overhead by 60-95% through intelligent query parameter generation
- **Job Distribution** - Routes jobs to isolated per-site queues (Dealabs, Vinted, LeBonCoin)
- **Worker Health Monitoring** - Tracks worker registration, heartbeats, and automatic failover
- **Category Discovery** - Orchestrates discovery of new deal categories across the worker pool
- **Category Sync** - Daily synchronization of category metadata across all sites

## Architecture

### Service Interactions

```mermaid
graph TD
    subgraph "Coordination Layer"
        A[Scheduler Service]
    end

    subgraph "Communication & State"
        B[Redis Queues & State]
    end

    subgraph "Worker Pool"
        C(Scraper Worker 1)
        D(Scraper Worker 2)
        E(...)
    end

    subgraph "Data Source"
        F[PostgreSQL Database]
    end

    subgraph "Upstream Services"
        G[API Service]
    end

    A -- Creates Jobs --> B
    A -- Monitors Worker Health --> B
    C -- Consumes Jobs & Reports Health --> B
    D -- Consumes Jobs & Reports Health --> B
    E -- Consumes Jobs & Reports Health --> B
    A -- Reads Categories/Filters --> F
    G -- Signals Filter Changes --> A
```

### Directory Structure

```
apps/scheduler/
├── src/
│   ├── adaptive-scheduler/      # Dynamic interval calculation & job triggering
│   ├── url-filter-optimizer/    # Filter-to-URL optimization (60-95% scraping reduction)
│   ├── job-distributor/         # Multi-site job routing via per-site BullMQ queues
│   ├── scheduled-job/           # ScheduledJob lifecycle & reference counting
│   ├── worker-health/           # Worker registration, heartbeats, health checks
│   ├── category-discovery/      # Orchestrates daily/manual category discovery
│   ├── category-sync/           # Daily category metadata synchronization
│   ├── repositories/            # Category & ScheduledJob data access layer
│   ├── health/                  # Custom health endpoint with worker pool checks
│   ├── config/                  # Logging configuration
│   ├── types/                   # TypeScript type definitions
│   └── main.ts                  # Application entry point & bootstrap
├── test/
│   └── unit/
│       ├── adaptive-scheduler/
│       └── url-filter-optimizer/
├── Dockerfile
└── README.md
```

---

## Internal Services

### AdaptiveSchedulerService (`adaptive-scheduler/adaptive-scheduler.service.ts`)

Core scheduling brain that dynamically adjusts scraping frequency per category. On startup, it loads all active `ScheduledJob` records, calculates an optimal polling interval for each based on user count, deal volume, category temperature, and time-of-day, then sets up recurring `setInterval` timers. Each tick triggers a scrape job via the `MultiSiteJobDistributorService` and updates `nextScheduledAt`. An hourly `@Cron` re-optimizes all intervals to react to changing metrics.

**Key behaviors:**
- Interval bounded between 5 min (popular categories) and 30 min (niche categories)
- Frequency multipliers: user count (up to 70% faster), deal activity, peak hours (43% faster), hot categories (25% faster)
- Priority classification: `high` (50+ users or temp > 200), `normal`, `low` (< 10 users, low temp/deals)
- Race condition protection via per-category scheduling locks
- Overdue job recovery on startup (immediate execution for missed schedules)

**Depends on:** `ScheduledJobService`, `MultiSiteJobDistributorService`, `PrismaService`

---

### UrlFilterOptimizerService (`url-filter-optimizer/url-filter-optimizer.service.ts`)

Analyzes all active user filters for a category and generates optimized URL query parameters that pre-filter results at the source website, reducing scraped data volume by 60-95%.

**How it works:**
1. Receives filter-change events with affected category IDs
2. Fetches all active filters for each category from the database
3. Extracts filter conditions (rules/conditions arrays or single conditions)
4. Resolves each field to a site-specific `UrlParamConfig` via `SiteFieldDefinition` metadata
5. Collects range constraints (min/max) and consolidates across multiple filters into the broadest range
6. Applies safety buffers (e.g. temperature gets a configurable buffer from field definitions)
7. Generates the final query string and stores it in the `ScheduledJob.optimizedQuery` column

**Supported URL param types:** `range` (min/max params), `custom_range` (single param with `min-max` syntax), `text` (search keywords), `boolean_map` (true/false value mapping), `set` (comma-separated values with optional ID mapping)

**Per-site configs** are defined in `site-url-configs.ts`, mapping universal fields (price, title) to site-specific URL params and defining always-appended params (sort order, hide expired, etc.).

**Depends on:** `PrismaService`, `SharedConfigService`

---

### MultiSiteJobDistributorService (`job-distributor/multi-site-job-distributor.service.ts`)

Routes scrape and discovery jobs to isolated per-site BullMQ queues. Each supported site (Dealabs, Vinted, LeBonCoin) has its own queue to prevent cross-site interference and enable independent scaling.

**Key behaviors:**
- Deduplication: checks waiting/active/delayed jobs before creating new ones for the same category
- Scrape jobs include the `optimizedQuery` from ScheduledJob (falls back to universal params)
- Discovery jobs are distributed with configurable priority (low for cron, high for manual)
- Provides queue stats (waiting, active, completed, failed) per site for monitoring
- Supports pause/resume/clear per queue

**Queue names** are derived from `SiteSource` enum via `getSiteQueueName()` from `@dealscrapper/shared-types`.

**Depends on:** BullMQ queues (injected via `@InjectQueue`)

---

### ScheduledJobService (`scheduled-job/scheduled-job.service.ts`)

Manages the `ScheduledJob` lifecycle with reference counting tied to filter-category associations. Ensures a 1:1 relationship between `Category` and `ScheduledJob`.

**Key behaviors:**
- `ensureScheduledJobsForCategories()`: creates or increments filter count when filters are created/updated
- `cleanupUnusedScheduledJobs()`: recounts active filters; removes the ScheduledJob if count reaches zero
- `getActiveScheduledJobs()`: returns jobs where `isActive=true` and `filterCount > 0`, ordered by category user count
- `updateExecutionStats()`: tracks total executions, success rate, and rolling average execution time
- `updateNextScheduledTime()`: sets the next scheduled execution timestamp

**Depends on:** `PrismaService`

---

### WorkerHealthService (`worker-health/worker-health.service.ts`)

Manages scraper worker registration, heartbeats, and on-demand health verification with intelligent caching.

**Key behaviors:**
- Workers register with an endpoint URL, capacity (max concurrent jobs, supported job types), and optional site affiliation
- `getAvailableWorkers()`: performs batched HTTP health checks (with 10s cache) and returns only workers with available capacity
- Load tracking: workers report current job count via heartbeat; unregistered workers get a 401
- Stale cleanup: `@Cron(EVERY_5_MINUTES)` removes workers with no heartbeat for 5+ minutes
- Health check results are cached briefly to avoid retry storms on failures

**Depends on:** `axios` (HTTP health checks)

---

### CategoryDiscoveryOrchestrator (`category-discovery/category-discovery-orchestrator.service.ts`)

Orchestrates category discovery by distributing discovery jobs to site-specific queues for parallel processing by scraper workers.

**Key behaviors:**
- `@Cron('0 2 * * *')`: daily scheduled discovery at 2 AM for all sites (low priority)
- `triggerManualDiscovery()`: API-triggered discovery for a single site or all sites (high priority)
- `isDiscoveryActive()`: checks aggregate queue stats across all site queues
- `getDiscoveryStatus()`: returns per-site queue metrics and system health status (operational/degraded/error)
- Errors on individual sites don't block discovery for other sites

**Depends on:** `MultiSiteJobDistributorService`

---

### CategorySyncService (`category-sync/category-sync.service.ts`)

Daily category metadata synchronization service. Coordinates with the scraper service to discover and upsert categories in the database.

**Key behaviors:**
- `@Cron('0 3 * * *')`: runs at 3 AM, syncs all sites in parallel via `Promise.allSettled`
- `syncSiteCategories()`: calls scraper service for category metadata, then upserts each category
- Upsert uses composite key `[siteId, sourceUrl]`; preserves existing metrics (dealCount, userCount, popularBrands)
- Resolves parent-child relationships via slug lookup during upsert
- `triggerManualSync()`: API endpoint for admin/testing
- `getSyncStatus()`: returns category counts by site and last sync timestamp

**Note:** Currently, actual HTTP-based discovery from the scraper is a placeholder (returns empty array) since discovery is handled asynchronously via `CategoryDiscoveryOrchestrator` job queue. This module is not yet wired into the main `SchedulerModule`.

**Depends on:** `PrismaService`, `HttpService`

---

### SchedulerHealthService (`health/scheduler-health.service.ts`)

Custom health endpoint extending `BaseHealthService` from `@dealscrapper/shared-health`. Adds worker pool health monitoring to the standard `/health` response.

**Key behaviors:**
- Registers a `workerPool` health checker that evaluates worker availability
- Returns `unhealthy` if no workers registered or > 50% are stale
- Returns `degraded` if < 25% workers have available capacity
- `/health` response includes detailed worker info: per-worker ID, endpoint, site, status, load, capacity, last heartbeat

**Depends on:** `WorkerHealthService`, `SharedConfigService`

---

### Repositories (`repositories/`)

**CategoryModelRepository** (`category.repository.ts`): Extends `BaseCategoryRepository` with scheduler-specific queries: categories with filters, categories without scheduled jobs, popular categories, scheduling metrics dashboard. Default includes: `scheduledJob` and active `filters`.

**ScheduledJobRepository** (`scheduled-job.repository.ts`): Full CRUD + specialized queries: jobs due for execution, jobs by filter count range, low success rate detection, high execution frequency tracking, comprehensive statistics, and stale job cleanup.

---

## Core Features

### 1. URL Filter Optimization

**Problem:** Without optimization, scraping a category retrieves ALL deals, even if users only care about a subset.

**Solution:** The URL Filter Optimizer generates a single optimized URL per category that pre-filters at the source.

**Example:**

```
WITHOUT OPTIMIZATION:
URL: https://www.dealabs.com/groupe/gaming-laptops
Result: Scrapes 5000 deals -> Filters in-memory -> Keeps 250 matches (95% waste)

WITH OPTIMIZATION:
URL: https://www.dealabs.com/groupe/gaming-laptops?temperatureFrom=85&priceTo=1500&hide_expired=true&hide_local=true&sortBy=new
Result: Scrapes ~300 relevant deals (94% reduction)
```

**Per-site URL configs** (`site-url-configs.ts`):

| Site | Universal Fields | Always-On Params |
|------|-----------------|------------------|
| Dealabs | `currentPrice` -> `priceFrom`/`priceTo` | `hide_expired=true`, `hide_local=true`, `sortBy=new` |
| Vinted | `currentPrice` -> `price_from`/`price_to` | `currency=EUR`, `order=newest_first` |
| LeBonCoin | `title` -> `text`, `currentPrice` -> `price` (custom range) | `sort=time`, `order=desc` |

### 2. Adaptive Scheduling Algorithm

Dynamically adjusts scraping frequency based on:
- **User count** - More users monitoring = higher frequency (up to 70% faster)
- **Deal activity** - More deals = higher frequency
- **Category temperature** - Hot categories (> 100) get 25% boost
- **Peak hours** - Business hours (9-14, 18-20) get 43% boost

**Interval bounds:** 5 minutes (max frequency) to 30 minutes (min frequency)

### 3. Multi-Site Job Distribution

Isolated BullMQ queues per site prevent cross-site interference:

```
┌──────────────────────┐
│  jobs-dealabs        │  <- Dealabs scrape + discovery jobs
├──────────────────────┤
│  jobs-vinted         │  <- Vinted scrape + discovery jobs
├──────────────────────┤
│  jobs-leboncoin      │  <- LeBonCoin scrape + discovery jobs
└──────────────────────┘
```

Each queue handles both `scrape` and `discovery` job types with exponential backoff retry.

### 4. Worker Health Monitoring

- Registration with endpoint, capacity, and site affiliation
- On-demand health checks with 10s caching
- Automatic stale worker cleanup every 5 minutes
- Load-aware worker selection (only workers with available capacity)

### 5. Category Discovery

- Daily automated discovery at 2 AM via cron
- Manual trigger via API for immediate discovery
- Jobs distributed to per-site queues for parallel processing
- Auto-triggers initial discovery on startup if database has no categories

---

## Tech Stack

| Technology | Purpose |
|------------|---------|
| **NestJS** | Framework for service architecture |
| **BullMQ** | Redis-backed job queue system (per-site queues) |
| **Prisma** | Database ORM for category & job data |
| **Redis** | Job queue backend & worker state |
| **@nestjs/schedule** | Cron-based scheduled tasks |
| **axios** | Worker health check HTTP calls |
| **Swagger** | API documentation |

---

## Getting Started

### Prerequisites

```bash
# Running Docker services
pnpm cli infra start  # PostgreSQL + Redis + Elasticsearch + MailHog

# Environment variables
DATABASE_URL=postgresql://user:pass@localhost:5432/dealscrapper
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=1
SCHEDULER_PORT=3004
URL_OPTIMIZATION_ENABLED=true
```

### Running the Service

```bash
# Development mode (with hot-reload)
pnpm dev:scheduler

# Verify service health
curl http://localhost:3004/health

# Swagger API docs
open http://localhost:3004/api/docs
```

---

## API Endpoints

### Health & Documentation

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check with worker pool status |
| GET | `/api/docs` | Swagger API documentation |

### Worker Management

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/workers/health` | Worker health overview |
| POST | `/api/workers/register` | Register a new worker |
| POST | `/api/workers/heartbeat` | Worker heartbeat update |
| POST | `/api/workers/unregister` | Unregister a worker |

### Scheduled Jobs

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/scheduled-jobs` | Active scheduled jobs |
| GET | `/api/scheduled-jobs/metrics` | Scheduling performance metrics |

### Category Discovery

| Method | Path | Description |
|--------|------|-------------|
| POST | `/category-discovery/trigger` | Trigger manual discovery |
| GET | `/category-discovery/status` | Discovery status & queue metrics |

### Queue Stats

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/queues/stats` | Per-site queue statistics |

---

## Testing

```bash
# All scheduler tests
pnpm test:scheduler:unit

# Specific test file
pnpm jest apps/scheduler/test/unit/adaptive-scheduler/adaptive-scheduler.service.spec.ts

# With coverage
pnpm test:scheduler:unit --coverage
```

### Test Coverage

**URL Filter Optimizer Tests:**
- Temperature/price/merchant constraint extraction (all operators)
- Multi-field filter analysis and consolidation
- Safety buffer application
- Query string generation
- Legacy filter format support

**Adaptive Scheduler Tests:**
- Optimal interval calculation
- Peak hours and hot category multipliers
- Priority determination
- Schedule initialization, updates, and overdue recovery
- Interval bounding

---

## Integration with Other Services

### API Service
- **Filter Change Events** -> Triggers URL optimization recalculation
- **User/Filter CRUD** -> Updates category `userCount`, triggers ScheduledJob lifecycle

### Scraper Workers
- **Receive Jobs** from per-site BullMQ queues
- **Report Health** via registration + heartbeat
- **Execute Scraping** using optimized URLs from `optimizedQuery`
- **Process Discovery** jobs to find new categories

### Database (PostgreSQL via Prisma)
- **Reads:** Category, Filter, ScheduledJob, FilterCategory tables
- **Writes:** ScheduledJob (optimizedQuery, nextScheduledAt, execution stats)

### Redis
- **BullMQ Queues:** Per-site job distribution (jobs-dealabs, jobs-vinted, jobs-leboncoin)
- **Worker State:** Registration, heartbeats, health tracking (in-memory, not persisted to Redis)

---

## Troubleshooting

### URL Optimization Not Applied
1. Check `URL_OPTIMIZATION_ENABLED=true` in environment
2. Verify filters use the `rules` format in `filterExpression`
3. Check that the field has a `urlParam` in its `SiteFieldDefinition` or in `site-url-configs.ts`

### Scheduling Not Running
1. Check `pnpm cli logs scheduler` for initialization errors
2. Verify active ScheduledJobs exist with `filterCount > 0`
3. Ensure categories are active and have `userCount > 0`

### Workers Not Receiving Jobs
1. Check worker registration: `curl http://localhost:3004/api/workers/health`
2. Check queue depth via queue stats endpoint
3. Verify scraper workers are consuming from the correct site queue

### Full Reset
```bash
pnpm cli dev reset  # Stop services, clean artifacts, reinstall, reinitialize
```
