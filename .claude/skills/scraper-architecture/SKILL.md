---
name: scraper-architecture
description: >
  Load this skill when working on the Scraper service (apps/scraper/). Contains module
  structure (PuppeteerPoolModule, JobProcessorModule, CategoryDiscoveryModule, FilterMatchingModule,
  DealElasticSearchModule, WorkerRegistrationModule), site adapters (Dealabs, Vinted, LeBonCoin),
  data flow, Elasticsearch dual-index system, Dealabs-specific scraping details (rate limiting,
  dynamic content, anti-scraping measures), and configuration. Invoke at the start of any
  task in apps/scraper/.
---

# Scraper Service Architecture

## Overview

- **Package:** `@dealscrapper/scraper`
- **Port:** 3002
- **Location:** `apps/scraper/`
- **Purpose:** Deal extraction from multiple sites using Puppeteer and BullMQ

## Module Structure

| Module | Purpose |
|--------|---------|
| `PuppeteerPoolModule` | Browser pool management and lifecycle |
| `JobProcessorModule` | BullMQ job consumption and multi-site processing |
| `CategoryDiscoveryModule` | Category discovery and monitoring |
| `FilterMatchingModule` | Filter evaluation engine |
| `NotificationModule` | Notification queue integration |
| `DealElasticSearchModule` | Elasticsearch indexing (dual-index) |
| `WorkerRegistrationModule` | Scheduler registration |

> The legacy `PageScrapingModule` and `DealExtractionModule` no longer exist. Their functionality is fully absorbed by `JobProcessorModule`.

## Key Components

### PuppeteerPoolModule
- Manages concurrent Puppeteer browser instances
- Handles page lifecycle and cleanup
- Configurable via `PUPPETEER_MAX_INSTANCES` (default: 3)
- Stats endpoint: `GET /puppeteer-pool/stats`

### JobProcessorModule
- Consumes scraping jobs from BullMQ
- Routes jobs to site-specific adapters
- Retry handling with exponential backoff
- Concurrency controlled via `WORKER_MAX_CONCURRENT_JOBS` (default: 3)

### Site Adapters (`/adapters`)
- `DealabsAdapter` — Dealabs.com
- `VintedAdapter` — Vinted.fr
- `LeBonCoinAdapter` — LeBonCoin.fr

### FilterMatchingModule
- Rule engine that evaluates user filters against scraped deals
- Triggers notification queue entries for matching deals

### DealElasticSearchModule
- Dual-index system: `deals-current` and `deals-historical`
- Deduplication by URL hash
- Price change tracking across scrape cycles
- Graceful degradation if Elasticsearch is unavailable

## Data Flow

```
Scheduler → ScrapingJob (DB) → BullMQ queue
  → JobProcessorModule picks up job
  → Site adapter extracts deals (Puppeteer)
  → Articles stored in PostgreSQL
  → Deals indexed in Elasticsearch (dual-index)
  → FilterMatchingModule evaluates filters
  → Matching deals queued for notification
```

## Endpoints

- `GET /health` — Health check
- `GET /puppeteer-pool/stats` — Browser pool statistics

## Dealabs Adapter Details

The `DealabsAdapter` implements the most complex scraping logic in the service.

### URL Construction
- Builds URLs dynamically from a category slug
- Supports query parameters for filtering (e.g., `price_max`, `sort`)

### Dynamic Content Handling
- Uses Puppeteer to render JavaScript-heavy pages
- Waits for content to fully load before extracting
- Blocks images and stylesheets for faster page load

### CSS Selectors
- Uses a list of modern, robust CSS selectors covering multiple Dealabs page layouts
- Handles deal title, price, heat score, and post timestamp

### Time Parsing
- Parses relative timestamps (e.g., `"2h"`, `"30m"`) to determine deal age

### Rate Limiting & Anti-Scraping
- Delays between requests to avoid triggering rate limits
- Rotating user agents on each request
- Realistic viewport dimensions set on every page
- Respects `robots.txt` — does not scrape disallowed paths
- Retry mechanism with exponential backoff on failure

### Heat Score
- Community-driven metric extracted per deal
- Historical tracking is a future enhancement — currently only the latest value is stored

### Category Scraping
- Adapter is fully generic: scrapes any category slug passed to it by the scheduler

## Critical Logging Rule

**ALL logging in `apps/scraper/` MUST use `createServiceLogger()` from `@dealscrapper/shared-logging`.** Never use `new Logger()` from NestJS.

```typescript
// WRONG
import { Logger } from '@nestjs/common';
private readonly logger = new Logger(MyService.name);

// CORRECT
import { createServiceLogger } from '@dealscrapper/shared-logging';
private readonly logger = createServiceLogger('MyService');
```

## Configuration

| Variable | Default | Purpose |
|----------|---------|---------|
| `PUPPETEER_HEADLESS` | `true` | Run browsers headless |
| `PUPPETEER_MAX_INSTANCES` | `3` | Max concurrent browser instances |
| `SCRAPE_TIMEOUT_MS` | — | Per-page timeout |
| `WORKER_MAX_CONCURRENT_JOBS` | `3` | Max parallel BullMQ jobs |

## Testing

```bash
pnpm test:scraper:unit    # Unit tests
pnpm test:scraper:e2e     # Integration tests
```
