---
name: web-architecture
description: >
  Load this skill when working on the Next.js web frontend (apps/web/). Contains directory
  structure, component organization (5 categories), core features (auth, filter builder,
  real-time notifications, dynamic table columns), API integration patterns, WebSocket setup,
  and critical gotchas. Invoke at the start of any task in apps/web/.
---

# Web Frontend Architecture

## Overview

Next.js 15.1.8 application with App Router and React 19. Production-ready with authentication,
real-time WebSocket notifications, and a visual rule-based filter builder.

- **Port:** 3000
- **Package:** `@dealscrapper/web`

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router), React 19 |
| Language | TypeScript 5.8.3 (strict mode) |
| Styling | Vanilla Extract (`.css.ts`) + Tailwind CSS 3.4 |
| State / Data | TanStack React Query 5, Context API |
| Forms | React Hook Form 7 + Zod validation |
| Real-time | Socket.IO (connects to Notifier on port 3003) |
| Testing | Jest 30 + React Testing Library |

---

## CRITICAL GOTCHAS (Read First)

**1. Price field name**
Use `currentPrice` — NOT `price` — when accessing article/deal price data in columns, display
components, and filter fields.

**2. Never send `enabledSites` from the frontend**
Do NOT include `enabledSites` in filter create or update request bodies. The backend derives
it automatically from the selected categories. Sending it will cause incorrect behavior.

**3. Dynamic table columns — temperature is Dealabs-only**
`ProductsTable` adapts columns based on which sites are being displayed. The `temperature`
column must only appear for Dealabs deals. Check `siteSource` before rendering site-specific
columns.

**4. WebSocket URL**
Connect to `ws://localhost:3003/notifications` (Notifier service). Do not point at the API.

**5. Styling — Vanilla Extract only**
All component styles live in `.css.ts` files using Vanilla Extract. Never add inline `style`
objects or ad-hoc Tailwind classes outside the designated style files. Follow the existing
pattern in the nearest `.css.ts` file.

---

## Directory Structure

```
apps/web/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── dashboard/          # Main user dashboard
│   │   ├── filters/            # Filter list + detail views
│   │   ├── create-filter/      # Advanced filter builder
│   │   ├── login/              # Authentication
│   │   ├── register/           # User registration
│   │   ├── verify-email/       # Email verification flow
│   │   ├── settings/           # User preferences
│   │   └── test-notifications/ # Dev testing page
│   ├── components/             # Organized component library (5 categories)
│   │   ├── display/            # Read-only display components
│   │   ├── form/               # Form inputs with validation
│   │   ├── interactive/        # User interaction components
│   │   ├── layout/             # Application shell and navigation
│   │   ├── specialized/        # Domain-specific components
│   │   └── ui/                 # Reusable UI primitives
│   ├── hooks/                  # Custom React hooks
│   ├── lib/                    # Core utilities and services
│   └── types/                  # TypeScript type definitions
└── mockup/                     # Design mockups and specs
```

---

## Component Organization (5 Categories)

### 1. Display (`components/display/`)
Read-only components that present data without user interaction.
- `CategoryTags` — tag display for filter categories
- `FilterCard` — filter overview cards with metrics
- `MetricsBadge` — statistics display badges
- `EmptyState` — empty state placeholders

### 2. Form (`components/form/`)
Form inputs, validation, and complex form UIs.
- `RuleBuilder` — visual rule editor (core feature, see Filter System below)
- `CategorySelector` — multi-select category picker
- `SearchInput` — debounced search with validation
- `NotificationSettings` — user preference forms
- `FormField` — reusable form field wrapper
- `RuleComponents` — building blocks for the rule system

### 3. Interactive (`components/interactive/`)
Components that manage user interaction and data display.
- `FilterGrid` — grid layout for filter management
- `ProductsTable` — deal table with sorting and dynamic columns
- `NavigationMenu` — main navigation system
- `CreateFilterForm` — complete filter creation form

### 4. Layout (`components/layout/`)
Application shell, navigation, and page structure.
- `AppLayout` — main application shell with sidebar
- `Header` — top navigation with user menu
- `Sidebar` — left navigation panel

### 5. UI Primitives (`components/ui/`)
Low-level reusable elements.
- `Button`, `Input`, `Modal` — basic interactive elements
- `Badge`, `Section`, `PageHeader` — layout and display utilities
- `UserMenu`, `SettingsModal` — user interface elements
- `ProductCard`, `IconButton` — specialized UI components

### Specialized (`components/specialized/`)
Domain-specific components with business logic.
- `NotificationBell` — real-time notification indicator
- `NotificationPanel` — notification management interface
- `RuleOperatorSelector` — advanced rule configuration
- `RuleValueInput` — dynamic value input with validation
- `LogicalOperatorToggle` — AND/OR logic switching

---

## Core Features

### Authentication
**File:** `src/lib/auth-context.tsx`

- JWT-based auth with automatic token refresh
- `localStorage` persistence for login state
- Protected routes with automatic redirection
- Email verification workflow
- User profile management

### Filter Builder
**Files:** `src/app/create-filter/`, `src/components/form/RuleBuilder.tsx`

Visual rule builder with nested AND/OR groups. Supports 30+ filterable fields:

| Category | Fields |
|---|---|
| Deal basics | title, description, model, category |
| Pricing | `currentPrice`, originalPrice, discountPercentage, discountAmount |
| Merchant | merchant, storeLocation, freeShipping |
| Community | temperature, commentCount, communityVerified |
| Logistics | geographicRestrictions, membershipRequired |
| Dates | publishedAt, expiresAt |
| Media | url, imageUrl |

**Site-Category UI Flow:**
1. User selects sites (e.g., Dealabs, Amazon)
2. `CategorySelector` shows only categories from selected sites
3. User selects categories
4. Backend derives `enabledSites` from the selected categories — frontend sends nothing for this field

### Dynamic Table Columns
**File:** `src/components/interactive/ProductsTable.tsx`

Columns adapt based on which sites are active. Rules:
- Always use `currentPrice` as the column key for price data (not `price`)
- `temperature` column: only render for Dealabs deals (check `siteSource === 'DEALABS'`)
- Shipping info may vary by site
- `siteSource` field indicates origin (DEALABS, AMAZON, etc.)

### Real-Time Notifications
**Files:** `src/lib/websocket.ts`, `src/hooks/useNotifications.ts`

- Socket.IO connection to Notifier service at `ws://localhost:3003/notifications`
- JWT authentication passed with WebSocket handshake
- Automatic reconnection with exponential backoff
- Three notification types: `DEAL_MATCH`, `SYSTEM`, `ALERT`
- Persistent notification history with read/unread status

---

## API Integration

### HTTP Client
**File:** `src/lib/api.ts`

- Centralized client with automatic JWT token management
- Base URL: `http://localhost:3001` (API service)
- Typed responses using `@dealscrapper/shared-types`
- Request/response interceptors for logging and error handling

### Service Endpoints
| Service | Port | Used For |
|---|---|---|
| API | 3001 | Auth, user management, filters, deals |
| Notifier | 3003 | WebSocket notifications, preferences |

### Filter API Contract
- **Create/Update:** Omit `enabledSites` entirely — backend derives it from categories
- **Price field:** Always reference `currentPrice` in request/response handling
- **Site-specific fields:** Fields like `temperature` may be `null` for non-Dealabs articles

---

## Styling Rules

- All styles are in `.css.ts` files (Vanilla Extract) — never inline style objects
- Tailwind utility classes are available but scoped to the Tailwind config
- Use existing style files in the same component directory as the reference
- Mobile-first responsive design throughout

---

## Testing

```bash
pnpm test:web           # Unit tests
pnpm test:web:watch     # Watch mode
pnpm test:coverage      # Coverage report
```

- Jest 30 with jsdom environment
- React Testing Library for component tests
- Mock API calls and auth context via test utilities in `src/` test setup
