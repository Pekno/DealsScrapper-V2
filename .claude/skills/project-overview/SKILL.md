---
name: project-overview
description: >
  Load this skill when you need context about the DealsScrapper project: what it is, its services,
  tech stack, monorepo structure, and inter-service communication. Invoke when onboarding to a task,
  when you need to understand how services relate, or when asked about the overall architecture.
---

# DealsScrapper — Project Overview

## What It Is

A modern **deal aggregation platform** that:
- Scrapes deals from multiple sites (Dealabs, Vinted, LeBonCoin)
- Lets users create filters with complex rule expressions (AND/OR/REGEX/CONTAINS, 27+ operators)
- Sends real-time and email notifications when matching deals are found
- Provides a web UI for managing filters and viewing deals

## Monorepo Structure

```
dealscrapper_v2/
├── apps/
│   ├── api/          # NestJS REST API (Port 3001)
│   ├── web/          # Next.js 15 frontend (Port 3000)
│   ├── scraper/      # Puppeteer scraping workers (Port 3002)
│   ├── notifier/     # Email + WebSocket notifications (Port 3003)
│   └── scheduler/    # Cron job orchestration (Port 3004)
├── packages/
│   ├── database/       # Prisma schema, client, migrations
│   ├── shared-types/   # TypeScript interfaces, enums, DTOs
│   ├── shared-config/  # Environment config (SharedConfigService)
│   ├── shared-logging/ # Winston logger (createServiceLogger)
│   ├── shared/         # Common utilities (extractErrorMessage, delay)
│   ├── shared-repository/ # Base repository patterns
│   └── shared-health/  # Health check infrastructure
└── test/             # Cypress E2E tests
```

## Service Communication

```
Web (3000) ←─HTTP──→ API (3001) ←─Prisma──→ PostgreSQL
                         │
                         ├──→ BullMQ (Redis) ──→ Scraper (3002)
                         │                            │
                         └──→ BullMQ (Redis) ──→ Notifier (3003)
                                                      │
Web (3000) ←──WebSocket (Socket.IO)──────────────────┘
Scheduler (3004) ──→ BullMQ (Redis) ──→ Scraper (3002)
```

## Tech Stack

| Layer | Technology |
|---|---|
| Backend services | NestJS, TypeScript, Express |
| Frontend | Next.js 15.1.8, React 19, TypeScript |
| Database | PostgreSQL via Prisma ORM |
| Queue/Cache | Redis + BullMQ |
| Search | Elasticsearch (dual-index: current + historical) |
| Scraping | Puppeteer (browser pool) + Cheerio |
| Real-time | Socket.IO |
| Styling | Vanilla Extract + Tailwind CSS |
| Monorepo | PNPM workspaces + Turborepo |
| Testing | Jest + Cypress |
| Infra | Docker Compose (PostgreSQL, Redis, Elasticsearch, MailHog) |

## Multi-Site Architecture

Sites supported: **Dealabs**, **Vinted**, **LeBonCoin**

Each site has:
- A `Site` record in DB (id, name, color, isActive)
- Site-specific categories (Category.siteId)
- Site-specific article extension table (ArticleDealabs, ArticleVinted, ArticleLeBonCoin)
- A dedicated scraper adapter

## Package Manager

**ALWAYS use PNPM** — never npm or yarn:
```bash
pnpm install        # Install deps
pnpm add <package>  # Add package
pnpm dev            # Start all services with hot-reload
```
