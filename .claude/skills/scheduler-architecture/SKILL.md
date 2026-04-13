---
name: scheduler-architecture
description: >
  Load this skill when working on the Scheduler service (apps/scheduler/). Contains the
  service's purpose, job distribution strategy, adaptive scheduling algorithm, ScheduledJob
  model, cron job types, BullMQ integration, worker health monitoring, API endpoints, and
  integration points. Invoke at the start of any task in apps/scheduler/.
---

# Scheduler Service Architecture

## Overview

The Scheduler Service is the **central orchestrator** of DealsScapper's distributed scraping architecture. It manages job distribution, worker health monitoring, adaptive scheduling, and URL filter optimization.

**Port:** 3004
**Tech Stack:** NestJS, BullMQ, Node-cron, Redis
**Location:** `apps/scheduler/`

## Core Responsibilities

1. **Job Distribution** - Creates and distributes scraping jobs to the worker pool
2. **Worker Health Monitoring** - Tracks worker registration, heartbeats, and availability
3. **Adaptive Scheduling** - Dynamically adjusts scraping frequency based on user activity and metrics
4. **URL Filter Optimization** - Generates optimized scraping URLs based on user filters (60-95% data reduction)
5. **Category Discovery** - Orchestrates discovery of new deal categories across workers

## Directory Structure

```
apps/scheduler/
├── src/
│   ├── job-distributor/            # Job creation and distribution
│   │   ├── consolidated-job-distributor.service.ts
│   │   └── job-distributor.module.ts
│   ├── worker-health/              # Worker lifecycle management
│   │   ├── worker-health.service.ts
│   │   ├── worker.controller.ts
│   │   ├── dto/
│   │   │   ├── worker-registration.dto.ts
│   │   │   ├── worker-heartbeat.dto.ts
│   │   │   └── worker-unregistration.dto.ts
│   │   └── worker-health.module.ts
│   ├── adaptive-scheduler/         # Dynamic frequency adjustment
│   │   ├── adaptive-scheduler.service.ts
│   │   └── adaptive-scheduler.module.ts
│   ├── url-filter-optimizer/       # URL query parameter optimization
│   │   ├── url-filter-optimizer.service.ts
│   │   └── url-filter-optimizer.module.ts
│   ├── category-discovery/         # Category discovery orchestration
│   │   ├── category-discovery-orchestrator.service.ts
│   │   ├── category-discovery.controller.ts
│   │   └── category-discovery-orchestrator.module.ts
│   ├── scheduled-job/              # ScheduledJob lifecycle
│   │   ├── scheduled-job.service.ts
│   │   ├── scheduled-job.controller.ts
│   │   └── scheduled-job.module.ts
│   ├── repositories/               # Database access layer
│   │   ├── scheduled-job.repository.ts
│   │   └── category.repository.ts
│   ├── types/
│   │   ├── job.types.ts           # Consolidated job types (CURRENT)
│   │   └── scheduler.types.ts     # Legacy types (DEPRECATED)
│   ├── health/
│   │   └── scheduler-health.service.ts
│   ├── config/
│   │   └── logging.config.ts
│   ├── scheduler.module.ts
│   ├── scheduler.controller.debug.ts  # Debug endpoints (test env only)
│   └── main.ts
├── test/
│   ├── unit/
│   ├── e2e/
│   ├── helpers/
│   └── factories/
└── jest.config.mjs
```

## ScheduledJob Model

```prisma
model ScheduledJob {
  id                  String
  categoryId          String    // 1:1 with Category
  isActive            Boolean
  maxRetries          Int
  timeoutMs           Int
  totalExecutions     Int
  successfulRuns      Int
  lastExecutionAt     DateTime?
  nextScheduledAt     DateTime?
  avgExecutionTimeMs  Int?
  filterCount         Int       // Number of users monitoring this category
  optimizedQuery      String?   // URL optimization parameter
}
```

## Key Design Patterns

### Consolidated Queue Architecture

- **Single queue** (`jobs`) instead of multiple priority queues
- Jobs differentiated by BullMQ priority levels (1-10)
- Simplifies worker implementation and monitoring

### Adaptive Frequency Calculation

- Base interval: 10 minutes
- Adjusts based on: user count, deal velocity, category temperature, time of day
- Bounds: 5 min (minimum) to 30 min (maximum)
- Popular categories (high `filterCount`) scraped more frequently

### Reference Counting for ScheduledJobs

- 1:1 relationship between Category and ScheduledJob
- `filterCount` tracks number of active filters
- Automatically created when first filter added
- Automatically deleted when no filters remain

### URL Filter Optimization

- Analyzes all active filters for a category
- Generates single optimized query string stored in `ScheduledJob.optimizedQuery`
- Applied at scraping time for 60-95% data reduction

### On-Demand Health Checks

- No periodic health-check cron jobs
- Health verified when `getAvailableWorkers()` is called
- Intelligent caching (10s duration) to prevent request storms

## Job Coordination Flow

1. Scheduler creates `ScheduledJob` entries
2. Creates `ScrapingJob` execution records
3. Publishes jobs to BullMQ `jobs` queue with priority level
4. Monitors job completion status via worker heartbeats

## Cron Job Types

- **Category discovery** - Finds new deal categories across sites
- **Deal freshness checks** - Validates deals are still active
- **Expired deal cleanup** - Removes stale deal records
- **Statistics aggregation** - Computes execution metrics

## API Endpoints

### Health & Documentation

- `GET /health` - Service health check
- `GET /api/docs` - Swagger documentation

### Worker Management

- `POST /api/workers/register` - Register new scraper worker
- `POST /api/workers/heartbeat` - Worker health update
- `POST /api/workers/unregister` - Unregister worker
- `GET /api/workers/health` - All workers status

### Category Discovery

- `POST /category-discovery/trigger` - Manual discovery trigger
- `GET /category-discovery/status` - Discovery status

### Debug (Test Environment Only)

- Various endpoints via `SchedulerDebugController`

## Integration Points

| Service | Direction | Details |
|---|---|---|
| PostgreSQL | Read/Write | Category, Filter, ScheduledJob tables |
| Redis (BullMQ) | Write | Publishes to `jobs` queue |
| Scraper Workers | Bidirectional | Receives registrations/heartbeats; sends jobs |
| API Service | Receive | Filter change events trigger URL optimization |

## Bootstrap Process (`main.ts`)

```typescript
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(SchedulerModule);

  // Logging — uses createServiceLogger, NOT NestJS Logger
  const customLogger = createServiceLogger(schedulerLogConfig, { level: LOG_LEVEL });
  app.useLogger(customLogger);

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // Swagger at /api/docs
  SwaggerModule.setup('api/docs', app, document);

  // Initialize adaptive scheduling
  const adaptiveScheduler = app.get(AdaptiveSchedulerService);
  await adaptiveScheduler.initializeScheduling();

  await app.listen(port);

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    adaptiveScheduler.clearAllSchedules();
    await app.close();
  });
}
```

## Logging — CRITICAL RULE

**ALL logging MUST use `createServiceLogger()` from `@dealscrapper/shared-logging`.**
**NEVER use `new Logger()` from NestJS.**

```typescript
// WRONG
import { Logger } from '@nestjs/common';
private readonly logger = new Logger(MyService.name);

// CORRECT
import { createServiceLogger } from '@dealscrapper/shared-logging';
const logger = createServiceLogger(schedulerLogConfig, { level: LOG_LEVEL });
```

Log files are written to `./logs/scheduler_*.log` with daily rotation and 14-day retention.

## Environment Variables

```bash
SCHEDULER_PORT=3004
NODE_ENV=development
DATABASE_URL=postgresql://user:pass@localhost:5432/dealscrapper
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=1
REDIS_PASSWORD=optional
URL_OPTIMIZATION_ENABLED=true
LOG_LEVEL=info
```

## Shared Packages Used

- `@dealscrapper/database` - Prisma client and models
- `@dealscrapper/shared-config` - Environment configuration
- `@dealscrapper/shared-health` - Health check endpoints
- `@dealscrapper/shared-logging` - Winston logger (use `createServiceLogger`)
- `@dealscrapper/shared-repository` - Base repository patterns
- `@dealscrapper/shared-types` - TypeScript interfaces

## Testing

- **Unit tests:** All services tested independently with mocks
- **E2E tests:** Full integration scenarios against test database
- **Test factories:** Reusable factories for Category and ScheduledJob data
- Run with `pnpm cli test unit` or `pnpm cli test integration`
