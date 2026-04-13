---
name: notifier-architecture
description: >
  Load this skill when working on the Notifier service (apps/notifier/). Contains the
  service's purpose, tech stack (NestJS, BullMQ, Socket.IO, Nodemailer, MJML), directory
  structure, key architectural patterns (unified payload, multi-channel delivery, job
  processing flow), queue job types, integration points, and logging requirements.
  Invoke at the start of any task in apps/notifier/.
---

# Notifier Service Architecture

## Overview

The Notifier Service delivers multi-channel notifications to users: deal alerts, system
notifications, and email verifications. It consumes jobs from Redis queues and delivers
via WebSocket and Email.

- **Port:** 3003
- **Package:** `@dealscrapper/notifier`
- **Entry point:** `apps/notifier/src/main.ts`

---

## Tech Stack

| Concern | Technology |
|---|---|
| Framework | NestJS (TypeScript) |
| Queue | BullMQ + Redis |
| Email transport | Nodemailer — Gmail OAuth2 (prod) / MailHog (test) |
| WebSocket | Socket.IO via `@nestjs/platform-socket.io` |
| Email templates | MJML compiled programmatically (no `.hbs`/`.mjml` files on disk) |
| Template engine | Handlebars (inline templates inside `TemplateService`) |
| Database | Prisma + PostgreSQL — preferences and delivery tracking |
| Auth | JWT for WebSocket connections |

---

## Directory Structure

```
apps/notifier/
├── src/
│   ├── processors/          # BullMQ job processors (notification.processor.ts)
│   ├── channels/            # Delivery channel implementations (email.service.ts)
│   ├── websocket/           # Socket.IO gateway (notification.gateway.ts)
│   ├── services/
│   │   ├── notification-preferences.service.ts
│   │   ├── delivery-tracking.service.ts
│   │   ├── user-status.service.ts
│   │   ├── rate-limiting.service.ts
│   │   ├── activity-tracking.service.ts
│   │   └── channel-health.service.ts
│   ├── templates/           # Template rendering (template.service.ts — inline MJML)
│   ├── repositories/        # Data access (notification.repository.ts, delivery-tracking.repository.ts)
│   ├── notifications/       # REST API for reading notifications
│   ├── jobs/                # Scheduled jobs (notification-cleanup.job.ts)
│   ├── auth/                # JWT guards and decorators
│   ├── health/              # Health monitoring endpoint
│   └── main.ts
├── test/
│   ├── unit/
│   └── e2e/
└── package.json
```

---

## Notification Types

| Type | Description |
|---|---|
| `DEAL_MATCH` | New deal matching a user filter |
| `SYSTEM` | System-wide announcements |
| `ALERT` | High-priority alerts |

---

## Data Model

```prisma
model Notification {
  id         String
  userId     String
  matchId    String?   // Link to Match for DEAL_MATCH
  type       String    // DEAL_MATCH | SYSTEM | ALERT
  subject    String?
  content    Json
  sent       Boolean
  sentAt     DateTime?
  failed     Boolean
  failReason String?
  isRead     Boolean
  readAt     DateTime?
}
```

---

## Key Architectural Patterns

### 1. Unified Notification Payload

All notifications use `UnifiedNotificationPayload`. This is the single source of truth
for notification content — stored in the `Notification` table, shared across channels,
avoiding duplication.

### 2. Multi-Channel Delivery

Channels selected dynamically based on:
- User online/offline status (Redis cache via `UserStatusService`)
- User preferences (Database via `NotificationPreferencesService`)
- Channel health metrics (Redis via `ChannelHealthService`)
- Notification priority

| Channel | Trigger condition |
|---|---|
| WebSocket | User is online |
| Email | User offline, or high-priority alert |

### 3. Job Processing Flow

```
Redis Queue (BullMQ)
  └─ NotificationProcessor
       ├── NotificationPreferencesService  — check user prefs
       ├── UserStatusService               — online/offline check
       ├── ChannelHealthService            — select healthy channels
       ├── DeliveryTrackingService         — create delivery record
       ├── NotificationGateway             — WebSocket send
       └── EmailService → TemplateService  — Email send
            └─ DeliveryTrackingService     — update result
```

### 4. Delivery Tracking

- Every notification creates a `Notification` DB record before sending.
- Delivery attempts tracked with status: `pending` / `delivered` / `failed`.
- Failed deliveries are automatically re-queued via `retry-notification` job.
- `ChannelHealthService` aggregates metrics in Redis for adaptive routing.

---

## Queue Job Types

| Job name | Purpose |
|---|---|
| `deal-match-found` | Deal match notification for a user |
| `system-notification` | Broadcast system alert |
| `email-verification` | Transactional verification email |
| `digest-notification` | Daily / weekly deal digest |
| `retry-notification` | Retry a previously failed delivery |

---

## Integration Points

| Dependency | How used |
|---|---|
| API Service | Enqueues `system-notification` jobs |
| Scraper Service | Enqueues `deal-match-found` jobs |
| Redis | BullMQ queues + user status + channel health cache |
| PostgreSQL | Preferences, notification records, delivery tracking |
| Gmail API (OAuth2) | Production email delivery |
| MailHog (SMTP) | Test environment email delivery |

WebSocket endpoint: `ws://localhost:3003/notifications`

---

## Critical Logging Rule

**ALL logging MUST use `createServiceLogger()` from `@dealscrapper/shared-logging`.**
Never use `new Logger()` from NestJS.

```typescript
// CORRECT
import { createServiceLogger } from '@dealscrapper/shared-logging';
const logger = createServiceLogger('NotificationProcessor');

// WRONG — do not use
import { Logger } from '@nestjs/common';
const logger = new Logger('NotificationProcessor');
```

---

## Testing

```bash
pnpm test:notifier:unit   # Unit tests
pnpm test:notifier:e2e    # Integration / E2E tests
```

- E2E tests send real emails via MailHog — validate via MailHog API.
- WebSocket tests use live Socket.IO connections.
