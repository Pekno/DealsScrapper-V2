# API Service - Central Backend Gateway

## Overview

The API Service is the **primary backend** of the DealsScapper platform, serving as the single gateway between the Next.js frontend and all backend microservices. It handles authentication, user management, filter CRUD, category browsing, article search, and administrative operations.

**Key Responsibilities:**
- **Authentication & Authorization** - JWT-based login/register with refresh tokens, email verification, account lockout, and role-based access control
- **Filter Management** - Full CRUD for rule-based deal filters with real-time article matching and scheduler notifications
- **Category Browsing** - Hierarchical category listing, search, and site filtering with display path generation
- **Article Search** - Elasticsearch-powered full-text search with site-specific filtering (Dealabs, Vinted, LeBonCoin)
- **Admin Dashboard** - Platform metrics, user management, service health aggregation, and password resets
- **Site Management** - Code-to-database site sync on startup, public site metadata endpoints

## Architecture

### Service Interactions

```mermaid
graph TD
    subgraph "Frontend"
        A[Web App - Next.js]
    end

    subgraph "API Service"
        B[NestJS API :3001]
    end

    subgraph "Data Stores"
        C[PostgreSQL]
        D[Redis / BullMQ]
        E[Elasticsearch]
    end

    subgraph "Backend Services"
        F[Scheduler :3004]
        G[Notifier :3003]
        H[Scraper :3002]
    end

    A -- REST + JWT --> B
    B -- Prisma ORM --> C
    B -- Notification Queue --> D
    B -- Article Search --> E
    B -- Filter Change Events --> F
    B -- Health Checks --> F
    B -- Health Checks --> G
    B -- Health Checks --> H
```

### Directory Structure

```
apps/api/src/
├── admin/                     # Admin dashboard, user management, health aggregation
├── articles/                  # Elasticsearch article search and retrieval
├── auth/                      # Authentication, JWT, email verification
│   ├── decorators/            # @CurrentUser, @Public, @Roles, @RequireEmailVerification
│   ├── dto/                   # Login, Register, RefreshToken, EmailVerification DTOs
│   ├── guards/                # GlobalJwtAuth, LocalAuth, RolesGuard, AuthRateLimit
│   ├── services/              # EmailVerificationService
│   └── strategies/            # JWT and Local Passport strategies
├── categories/                # Category listing, search, tree, discovery trigger
│   ├── dto/                   # CategoryDto
│   └── utils/                 # Display path building, selectability logic
├── common/                    # Shared middleware and utilities
│   ├── middleware/             # CORS, rate limiting, security headers, sanitization, request logging
│   ├── services/              # DatabaseSeederService
│   └── types/                 # Middleware type definitions
├── config/                    # Logging configuration
├── filters/                   # Filter CRUD, matching, statistics, scraping status
│   ├── dto/                   # CreateFilter, UpdateFilter, FilterQuery, TestFilter, FilterResponse
│   ├── services/              # FilterMatcherService
│   ├── types/                 # FilterExpression, FilterQuery, RuleBasedFilter types
│   ├── utils/                 # Filter expression conversion, field validation
│   └── validation/            # Site field constants, ValidateSiteFields decorator
├── health/                    # ApiHealthService (database + auth checks)
├── repositories/              # UserRepository, FilterRepository, CategoryRepository
├── sites/                     # Site CRUD and startup sync
│   ├── definitions/           # SITE_DEFINITIONS (Dealabs, Vinted, LeBonCoin)
│   ├── dto/                   # SiteResponseDto
│   └── services/              # SiteSyncService (code-to-DB on startup)
├── users/                     # User profile, notification preferences
│   └── dto/                   # UpdateProfile, UpdateNotificationPreferences
├── app.module.ts              # Root module with global guards and BullMQ
└── main.ts                    # Bootstrap, Swagger, middleware stack, Redis check, DB seeding
```

---

## Internal Services

### AuthService (`auth/auth.service.ts`)

Handles the complete authentication lifecycle: credential validation, JWT generation, session management, and user registration. On login, `validateUser()` checks account lock status (15-minute lockout after 5 failed attempts via `MAX_LOGIN_ATTEMPTS`), verifies email is confirmed, and compares bcrypt-hashed passwords (12 rounds). Successful login creates a `UserSession` record with a UUID refresh token (7-day expiry) and returns a signed JWT access token. Registration via `register()` hashes the password, creates the user, and queues a verification email; it also supports re-registration for unverified accounts by updating credentials and resending verification.

**Key behaviors:**
- `validateUser()` enforces account lockout (`lockedUntil`) and email verification before password check
- `login()` generates JWT with `JwtPayload` (sub, email, emailVerified, role) and stores refresh token in `UserSession`
- `register()` validates password strength (8+ chars, uppercase, lowercase, digit), allows re-registration for unverified accounts
- `refreshToken()` looks up `UserSession` by refresh token, validates expiry, and issues a new access token
- `logout()` and `logoutAll()` delete session records (single or all for a user)
- `handleFailedLogin()` increments `loginAttempts` and locks account at 5 failures for 15 minutes

**Depends on:** `UsersService`, `JwtService`, `SharedConfigService`, `PrismaService`, `EmailVerificationService`

---

### EmailVerificationService (`auth/services/email-verification.service.ts`)

Manages the email verification workflow using purpose-scoped JWT tokens and the BullMQ notification queue. `generateVerificationToken()` signs a JWT with `EMAIL_VERIFICATION_SECRET` and `EMAIL_VERIFICATION_EXPIRES_IN` (default 24h) containing `userId`, `email`, and `purpose: 'email-verification'`. The `sendVerificationEmail()` method validates user existence and verification status, generates the token, builds a verification URL pointing to the web app (`WEB_APP_URL/verify-email/confirm?token=...`), and pushes an `email-verification` job to the `notifications` BullMQ queue with high priority, 3 attempts, and exponential backoff (2s base). A 5-second timeout prevents hangs if Redis is unavailable.

**Key behaviors:**
- `generateVerificationToken()` creates purpose-scoped JWTs with configurable secret and expiry
- `sendVerificationEmail()` queues notification with 5s Redis timeout to prevent bootstrap hangs
- `verifyEmailToken()` validates token signature, expiry, and purpose field
- `processEmailVerification()` decodes token, verifies user/email match, and calls `usersService.verifyEmail()`
- `resendVerificationEmailByUserId()` silently succeeds regardless of user existence (prevents enumeration)

**Depends on:** `JwtService`, `SharedConfigService`, `UsersService`, `Queue` (notifications)

---

### UsersService (`users/users.service.ts`)

Provides core user CRUD operations backed by Prisma. Offers `findByEmail()` and `findById()` for lookups, `create()` for registration, `update()` for general updates, and specialized methods `updateProfile()` and `updateNotificationPreferences()` that strip the password from the returned object. The `verifyEmail()` method sets `emailVerified: true` and records `emailVerifiedAt`.

**Key behaviors:**
- `findByEmail()` / `findById()` for user lookups (returns full user including password hash)
- `create()` accepts email, hashed password, optional firstName/lastName
- `updateProfile()` updates name, timezone, locale and strips password from response
- `updateNotificationPreferences()` toggles emailNotifications, marketingEmails, weeklyDigest
- `verifyEmail()` marks email as verified with timestamp
- `delete()` removes user record

**Depends on:** `PrismaService`

---

### FiltersService (`filters/filters.service.ts`)

The largest service in the API, managing the full filter lifecycle with scheduler integration and article matching. On `create()`, it validates the filter expression structure, verifies all category IDs exist in the database, creates the filter with category associations, notifies the scheduler service via HTTP POST to `/scheduled-jobs/filter-change`, and asynchronously matches existing articles (last 30 days, up to 1000) against the new filter using `FilterMatcherService`. On `update()`, if matching criteria changed (expression or categories), it deletes all existing matches and re-evaluates. `getMatches()` loads `ArticleWrapper` instances to include site-specific extension data (temperature, merchant, originalPrice for Dealabs). `getScrapingStatus()` returns per-category scheduled job info and latest execution details.

**Key behaviors:**
- `create()` validates expression, creates filter with categories, notifies scheduler, async-matches existing articles
- `update()` detects matching criteria changes, deletes old matches, re-evaluates if expression or categories changed
- `remove()` deletes filter and notifies scheduler for cleanup
- `toggleActive()` flips active state and notifies scheduler
- `findAll()` supports pagination, search (name/description), active filter, category filter, sorting
- `getMatches()` loads ArticleWrappers for site-specific extension data, supports search/sort/pagination
- `getFilterStats()` calculates totalMatches, matchesLast24h/7d, avgScore, topScore, lastMatchAt in parallel
- `getScrapingStatus()` returns per-category scheduledJob and latestExecution data
- `notifySchedulerService()` sends filter-change events via HTTP (fails silently)
- `matchExistingArticlesForFilter()` evaluates up to 1000 recent articles using FilterMatcherService

**Depends on:** `PrismaService`, `HttpService`, `SharedConfigService`, `FilterMatcherService`

---

### FilterMatcherService (`filters/services/filter-matcher.service.ts`)

Implements the rule-based filter matching engine. `matchArticle()` fetches all active filters whose categories match the article's site, then evaluates each filter's expression tree against the article. `evaluateFilterExpression()` supports boolean evaluation (AND/OR/NOT across top-level rules) and score-based evaluation (weighted, percentage, or points modes with a `minScore` threshold). Individual rules are evaluated by `evaluateRule()`, which handles site-specific rule skipping (rules with `siteSpecific` that don't match the article's source are treated as passing). Field values are extracted from both the base `Article` and site-specific extension, with computed field support for aliases like `price` (currentPrice), `heat` (temperature), `discountPercent`, and `age` (hours since scrape).

**Key behaviors:**
- `matchArticle()` queries active filters by category site match, evaluates each expression
- `evaluateFilterExpression()` supports AND/OR/NOT boolean logic and score-based matching (minScore + scoreMode)
- `evaluateRule()` skips site-specific rules that don't match article source (returns true to not break match)
- `getFieldValue()` resolves base fields, extension fields, and computed aliases (price, heat, discountPercent, age)
- Supports operators: `=`, `!=`, `>`, `>=`, `<`, `<=`, `CONTAINS`, `NOT_CONTAINS`, `STARTS_WITH`, `ENDS_WITH`, `REGEX`, `NOT_REGEX`, `EQUALS`, `NOT_EQUALS`, `IN`, `NOT_IN`, `INCLUDES_ANY`, `INCLUDES_ALL`, `NOT_INCLUDES_ANY`, `IS_TRUE`, `IS_FALSE`, `BEFORE`, `AFTER`, `BETWEEN`, `OLDER_THAN`, `NEWER_THAN`
- `evaluateRuleGroup()` handles nested logical groups with recursive evaluation

**Depends on:** `PrismaService`

---

### CategoriesService (`categories/categories.service.ts`)

Provides category browsing, search, and discovery trigger functionality. `findAll()` queries active categories with optional text search (name, slug, description with case-insensitive matching) and site filtering (comma-separated siteIds), including parent hierarchy up to grandparent level for display path generation. Search results are limited to 50 and ordered by name; non-search results are ordered by hierarchy level. `findBySite()` returns categories for a specific site. `getCategoryTree()` returns categories in hierarchical order (level, parentId, name). `triggerCategoryDiscovery()` makes an HTTP POST to the scheduler's `/category-discovery/trigger` endpoint and handles 409 (already running) and other errors.

**Key behaviors:**
- `findAll()` supports text search across name/slug/description, site filtering, and hierarchy ordering
- `findBySite()` returns active categories for a specific site ordered by level and name
- `getCategoryTree()` returns hierarchical category structure, optionally including inactive categories
- `triggerCategoryDiscovery()` proxies to scheduler service with proper error handling (409 Conflict, 503 Unavailable)
- `mapToCategoryDto()` builds `displayPath` and evaluates `isSelectable` per category

**Depends on:** `PrismaService`, `SharedConfigService`

---

### ArticlesService (`articles/articles.service.ts`)

Elasticsearch-powered article search service. `search()` converts DTO parameters into an Elasticsearch bool query with must clauses for full-text search (title boosted 2x, description), site filtering, price range, category, and site-specific filters (Dealabs temperature/community verified/free shipping; Vinted favorite count/brand/size/condition; LeBonCoin city/postcode/region/pro seller/urgent). Results are sorted by `scrapedAt` descending. After getting article IDs from Elasticsearch, it loads full `ArticleWrapper` instances from PostgreSQL via Prisma to include site-specific extension data. `getById()` loads a single article by ID.

**Key behaviors:**
- `search()` builds multi-clause Elasticsearch bool queries with site-specific filter support
- Full-text search on title (2x boost) and description using `multi_match` / `best_fields`
- Loads ArticleWrappers from PostgreSQL after ES search for complete extension data
- `getById()` loads single article with full extension data
- `wrapperToResponseDto()` maps Dealabs, Vinted, and LeBonCoin extensions to typed DTOs

**Depends on:** `ElasticsearchService`, `PrismaService`

---

### AdminService (`admin/admin.service.ts`)

Administrative operations service providing dashboard metrics, user management, and service health aggregation. `getDashboardMetrics()` fetches remote service health (scraper, notifier, scheduler) via parallel HTTP calls with 5-second timeout, and platform metrics (user/filter/match/session counts) from the database. `getSchedulerHealth()` additionally fetches per-scraper-worker health in parallel from each worker's `/health` endpoint using worker details from the scheduler response. User management includes paginated listing with search, role updates, deletion (with self-deletion prevention), and password resets using randomly generated 12-character temporary passwords with guaranteed character class diversity.

**Key behaviors:**
- `getDashboardMetrics()` aggregates API (self), scraper, notifier, scheduler health with parallel HTTP calls
- `getSchedulerHealth()` fetches scheduler health then per-worker health in parallel from worker endpoints
- `getUsers()` supports paginated listing with search via UserRepository
- `updateUserRole()` changes user role (USER/ADMIN)
- `deleteUser()` prevents self-deletion, verifies user exists
- `resetUserPassword()` generates 12-char temp password with uppercase, lowercase, digit, special character
- `fetchServiceHealth()` unwraps StandardApiResponse wrappers from health endpoints

**Depends on:** `PrismaService`, `UserRepository`, `HttpService`, `SharedConfigService`

---

### SitesService (`sites/sites.service.ts`)

Read-only service for site metadata. `findAll()` returns active sites ordered by name. `findOne()` returns a specific site by ID, throwing `NotFoundException` if not found or inactive. `findAllIncludingInactive()` returns all sites for admin use. Sites are synced from code definitions by `SiteSyncService` on startup.

**Key behaviors:**
- `findAll()` returns active sites ordered by name
- `findOne()` validates site exists and is active
- `findAllIncludingInactive()` for admin endpoints
- Maps database `Site` entity to `SiteResponseDto` (id, name, color, isActive, iconUrl)

**Depends on:** `PrismaService`

---

### SiteSyncService (`sites/services/site-sync.service.ts`)

Runs on module initialization (`OnModuleInit`) to synchronize site definitions from code constants (`SITE_DEFINITIONS`) to the database. Upserts all defined sites (Dealabs, Vinted, LeBonCoin) with their metadata (name, baseUrl, categoryDiscoveryUrl, color, iconUrl). Sites removed from code definitions are deactivated (never deleted to preserve foreign key integrity).

**Key behaviors:**
- `onModuleInit()` triggers `syncSites()` automatically on startup
- Upserts sites using code-defined `SITE_DEFINITIONS` as source of truth
- Deactivates database sites not present in code definitions (preserves data integrity)
- `forceSync()` allows manual re-synchronization

**Depends on:** `PrismaService`

---

### ApiHealthService (`health/api-health.service.ts`)

Custom health service extending `BaseHealthService` from `@dealscrapper/shared-health`. Registers two dependency health checkers: `database` (raw SQL ping with 1-second degraded threshold, required tables check) and `authentication` (JWT sign/verify test, recent failed login count with 100+ threshold for degraded). The custom health data includes database stats, auth stats, API endpoint counts, rate limiting status, CORS configuration, and performance metrics (response time, throughput, error rate -- currently hardcoded placeholders).

**Key behaviors:**
- Registers `database` checker: SQL ping, response time threshold (>1s = degraded), required tables check
- Registers `authentication` checker: JWT sign/verify test, >100 recent failures = degraded
- `getCustomHealthData()` returns database stats, auth stats, API info, and performance metrics
- `checkRequiredTables()` validates User, Filter, UserSession, Category tables exist
- JwtService is optional (may be null during factory creation before AuthModule loads)

**Depends on:** `PrismaService`, `JwtService` (optional), `SharedConfigService`

---

### DatabaseSeederService (`common/services/database-seeder.service.ts`)

Seeds development users on startup (skipped in production). `seedDefaultUser()` creates `user@example.com` / `StrongP@ssw0rd` with pre-verified email. `seedAdminUser()` creates or promotes an admin user using `ADMIN_EMAIL` / `ADMIN_PASSWORD` environment variables (defaults to `admin@example.com` / `AdminP@ssw0rd`). Both methods are idempotent and log credentials on creation.

**Key behaviors:**
- `seedDefaultUser()` creates dev user with pre-verified email (skipped in production)
- `seedAdminUser()` creates admin or promotes existing user to ADMIN role
- Idempotent: skips if user already exists with correct role
- Uses configurable `BCRYPT_ROUNDS` (default 12)

**Depends on:** `PrismaService`

---

### Repositories (`repositories/`)

**UserRepository** (`user.repository.ts`): Extends `AbstractBaseRepository` with user-specific operations: `findByEmail()`, `findByEmailVerified()`, `findRecentlyActive()`, `updateLastLogin()`, `incrementLoginAttempts()`, `resetLoginAttempts()`, `lockUser()`, `verifyEmail()`, `updateNotificationPreferences()`, `getUsersForDigest()`, and `searchUsers()` (multi-term search across email/firstName/lastName with pagination). Used primarily by `AdminService`.

**FilterRepository** (`filter.repository.ts`): Extends `BaseFilterRepository` with API-specific operations: `findUserFilterLibrary()` (active-first, popularity-sorted), `updateUserFilterPreferences()` (with digest frequency and notification limit validation), `getUserFilterAnalytics()` (parallel aggregate queries for dashboard), `duplicateFilterForUser()` (copies filter with categories, starts inactive). Includes extensive alias methods for backward compatibility.

**CategoryRepository** (`category.repository.ts`): Extends `BaseCategoryRepository` with API-specific operations: `findInactiveCategories()`, `findCategoryWithFilters()`, `getCategoryHierarchy()`, `getCategoryStatistics()`, `updateUserCategoryPreferences()`, `findMostPopularCategories()`, `searchCategoriesByName()`, `upsertBySiteAndSourceUrl()`, `findBySite()`, `getCategoryTreeBySite()`, and `findBySlugAndSite()`. Includes alias methods for backward compatibility.

---

## Core Features

### 1. Authentication System

JWT-based authentication with refresh tokens and email verification:

- **Access tokens** signed with `JWT_SECRET`, expiry configured via `JWT_EXPIRES_IN` (default 15m)
- **Refresh tokens** stored as UUID in `UserSession` table with 7-day expiry, IP and user-agent tracking
- **Account lockout** after 5 failed login attempts for 15 minutes
- **Email verification** via purpose-scoped JWT tokens queued through BullMQ to the Notifier service
- **Re-registration** allowed for unverified accounts (updates credentials, resends verification)
- **Password requirements**: 8+ characters, uppercase, lowercase, digit

### 2. Rule-Based Filter Matching

Filters use a `RuleBasedFilterExpression` JSON structure supporting:

- **Logical operators**: AND, OR, NOT at both top-level (`matchLogic`) and nested groups
- **Comparison operators**: `=`, `!=`, `>`, `>=`, `<`, `<=`, `BETWEEN`
- **String operators**: `CONTAINS`, `NOT_CONTAINS`, `STARTS_WITH`, `ENDS_WITH`, `REGEX`, `EQUALS`, `IN`
- **Array operators**: `INCLUDES_ANY`, `INCLUDES_ALL`, `NOT_INCLUDES_ANY`
- **Boolean operators**: `IS_TRUE`, `IS_FALSE`
- **Date operators**: `BEFORE`, `AFTER`, `BETWEEN`, `OLDER_THAN`, `NEWER_THAN`
- **Score-based matching**: weighted, percentage, or points mode with `minScore` threshold
- **Site-specific rules**: rules with `siteSpecific` are skipped (not failed) for non-matching sites
- **Computed fields**: `price` (currentPrice), `heat` (temperature), `discountPercent`, `age` (hours since scrape)

### 3. Scheduler Integration

Filter lifecycle events (create, update, delete, toggle) notify the Scheduler service via HTTP POST to `/scheduled-jobs/filter-change` with `filterId`, `action`, and `categoryIds`. This triggers ScheduledJob creation/cleanup and URL filter optimization. Notification failures are logged but don't block filter operations.

### 4. Existing Article Matching

When a filter is created or its matching criteria change, the service asynchronously evaluates up to 1000 recent articles (last 30 days) from the filter's categories using `ArticleWrapper` and `FilterMatcherService`, creating matches in bulk with `skipDuplicates`. This provides immediate results without waiting for new scrapes.

### 5. Security Middleware Stack

Applied in order during bootstrap:
1. **SecurityHeadersMiddleware** - CSP, X-Content-Type-Options, X-Frame-Options, X-XSS-Protection
2. **CorsMiddleware** - Configured via `SharedConfigService.getCorsConfig()`
3. **RequestLoggerMiddleware** - Logs method, URL, status, response time
4. **SanitizationMiddleware** - Strips HTML tags, prevents script injection
5. **RateLimitMiddleware** - Configurable via `RATE_LIMIT_WINDOW_MS` / `RATE_LIMIT_MAX_REQUESTS`

Global `ValidationPipe` with `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`.

Global guards: `GlobalJwtAuthGuard` (all routes require JWT unless `@Public()`), `RolesGuard` (checks `@Roles()` decorator).

---

## Tech Stack

| Technology | Purpose |
|------------|---------|
| **NestJS** | Backend framework with module/controller/service architecture |
| **Prisma** | Database ORM for PostgreSQL |
| **Passport + JWT** | Authentication strategies (JWT and Local) |
| **BullMQ** | Redis-backed notification queue (email verification) |
| **Elasticsearch** | Article full-text search with site-specific filtering |
| **class-validator** | DTO validation with decorators |
| **bcryptjs** | Password hashing (12 rounds) |
| **Winston** | Structured logging with daily rotation |
| **Swagger** | API documentation at `/api/docs` |
| **@nestjs/axios** | HTTP client for service-to-service communication |

---

## Getting Started

### Prerequisites

```bash
# Running Docker infrastructure
pnpm cli infra start  # PostgreSQL, Redis, Elasticsearch, MailHog

# Key environment variables
DATABASE_URL=postgresql://user:pass@localhost:5432/dealscrapper
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=your-secret
JWT_REFRESH_SECRET=your-refresh-secret
EMAIL_VERIFICATION_SECRET=your-email-secret
WEB_APP_URL=http://localhost:3000
SCHEDULER_URL=http://localhost:3004
NOTIFIER_URL=http://localhost:3003
```

### Running the Service

```bash
# Development mode (with hot-reload)
pnpm dev:api

# Verify service health
curl http://localhost:3001/health

# Swagger API docs
open http://localhost:3001/api/docs
```

### Development Users (Seeded Automatically)

| Role | Email | Password |
|------|-------|----------|
| User | `user@example.com` | `StrongP@ssw0rd` |
| Admin | `admin@example.com` | `AdminP@ssw0rd` |

---

## API Endpoints

### Authentication

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/register` | Public | Register new user (rate limited) |
| POST | `/auth/login` | Public | Login with email/password (rate limited) |
| POST | `/auth/refresh` | Public | Refresh access token (rate limited) |
| POST | `/auth/logout` | JWT | Invalidate refresh token |
| POST | `/auth/logout-all` | JWT | Invalidate all user sessions |
| POST | `/auth/send-verification` | JWT | Send/resend verification email |
| POST | `/auth/resend-verification` | Public | Resend verification by userId (rate limited) |
| GET | `/auth/verify-email?token=` | Public | Verify email with JWT token |

### Users

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/users/profile` | JWT | Get current user profile |
| PATCH | `/users/profile` | JWT | Update profile (name, timezone, locale) |
| PATCH | `/users/notifications` | JWT | Update notification preferences |

### Filters

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/filters` | JWT | Create new filter |
| GET | `/filters` | JWT | List filters (paginated, searchable, filterable) |
| GET | `/filters/count` | JWT | Get total filter count |
| GET | `/filters/:id` | JWT | Get filter details with stats |
| PATCH | `/filters/:id` | JWT | Update filter |
| DELETE | `/filters/:id` | JWT | Delete filter |
| POST | `/filters/:id/toggle` | JWT | Toggle filter active/inactive |
| GET | `/filters/:id/matches` | JWT | Get matched deals (paginated, searchable) |
| GET | `/filters/:id/stats` | JWT | Get filter statistics |
| GET | `/filters/:id/scraping-status` | JWT | Get per-category scraping job status |

### Categories

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/categories` | JWT | List categories (search via `find`, filter via `siteId`) |
| GET | `/categories/by-site?siteId=` | JWT | Get categories for a specific site |
| GET | `/categories/tree?siteId=` | JWT | Get hierarchical category tree |
| POST | `/categories/refresh` | Admin | Trigger category discovery via scheduler |

### Articles

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/articles/search` | JWT | Elasticsearch search with site-specific filters |
| GET | `/articles/:id` | JWT | Get single article with extension data |

### Sites

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/sites` | Public | Get all active sites (metadata for frontend) |
| GET | `/sites/:id` | Public | Get specific site by ID |
| GET | `/sites/admin/all` | Admin | Get all sites including inactive |

### Admin

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/admin/dashboard` | Admin | Platform metrics + service health |
| GET | `/admin/health/api` | Admin | API self-health |
| GET | `/admin/health/notifier` | Admin | Notifier service health |
| GET | `/admin/health/scheduler` | Admin | Scheduler + per-worker scraper health |
| GET | `/admin/metrics` | Admin | Platform metrics only |
| GET | `/admin/users` | Admin | List users (paginated, searchable) |
| PATCH | `/admin/users/:id/role` | Admin | Update user role |
| DELETE | `/admin/users/:id` | Admin | Delete user (cannot self-delete) |
| POST | `/admin/users/:id/reset-password` | Admin | Reset password to temporary value |

### Health

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | Public | Service health with database and auth checks |

---

## Testing

```bash
# Run all API unit tests
pnpm test:api:unit

# Run a specific test file
pnpm jest apps/api/test/unit/auth/auth.service.spec.ts

# Run with coverage
pnpm test:api:unit --coverage
```

### Test Coverage

| Domain | Test Files |
|--------|-----------|
| Admin | `admin.controller.spec.ts`, `admin.service.spec.ts` |
| Articles | `articles.controller.spec.ts`, `articles.service.spec.ts` |
| Auth | `auth.controller.spec.ts`, `auth.service.spec.ts`, `auth.service.security.spec.ts`, `email-verification.service.spec.ts`, `roles.guard.spec.ts` |
| Categories | `categories.controller.spec.ts`, `categories.service.spec.ts` |
| Filters | `filters.controller.spec.ts`, `filters.service.spec.ts`, `filter-matcher.service.spec.ts`, `validate-site-fields.decorator.spec.ts` |
| Security | `security-integration.spec.ts` |
| Sites | `sites.controller.spec.ts`, `sites.service.spec.ts` |
| Users | `users.service.spec.ts` |

---

## Integration with Other Services

### Scheduler Service
- **Filter Change Events**: On filter create/update/delete/toggle, the API sends HTTP POST to `SCHEDULER_URL/scheduled-jobs/filter-change` with `filterId`, `action`, and `categoryIds`
- **Category Discovery**: Admin endpoint proxies POST to `SCHEDULER_URL/category-discovery/trigger`
- **Health Checks**: Admin dashboard fetches scheduler health via GET `SCHEDULER_URL/health`

### Notifier Service
- **Email Verification**: Queues `email-verification` jobs to the `notifications` BullMQ queue with high priority
- **Health Checks**: Admin dashboard fetches notifier health via GET `NOTIFIER_URL/health`

### Scraper Workers
- **Health Checks**: Admin dashboard fetches per-worker health from endpoints reported by the scheduler

### Database (PostgreSQL via Prisma)
- **Reads**: User, Filter, FilterCategory, Match, Article, Category, Site, UserSession, ScheduledJob, ScrapingJob
- **Writes**: User (registration, login tracking, profile), Filter (CRUD), Match (bulk create), UserSession (create/delete), Site (upsert on startup)

### Elasticsearch
- **Reads**: Article search with full-text and structured queries against `articles` index

### Redis (BullMQ)
- **Writes**: Email verification notification jobs to `notifications` queue
- **Health**: Redis connectivity checked on startup (required in production, optional in development)

---

## Troubleshooting

### Redis Connection Failed on Startup
- In development, the API continues without Redis but email notifications will not work
- In production, the API exits with error if Redis is unavailable
- Check Redis: `pnpm cli status` or `redis-cli ping`

### Scheduler Notifications Failing
- Filter operations succeed even if scheduler is unreachable (notifications fail silently)
- Check `pnpm cli logs api` for "Failed to notify scheduler service" warnings
- Verify `SCHEDULER_URL` is correct and scheduler is running

### Email Verification Timing Out
- The service has a 5-second timeout for BullMQ queue operations
- If Redis is slow or unavailable, registration may throw a timeout error
- Check Redis health and the `notifications` queue

### Account Locked
- After 5 failed login attempts, accounts are locked for 15 minutes
- Admin can reset password via `POST /admin/users/:id/reset-password`
- Lock state is stored in `User.lockedUntil` field

### Article Search Returns Empty
- Verify Elasticsearch is running: `pnpm cli status`
- Check that articles have been indexed by the scraper service
- Verify the `articles` index exists in Elasticsearch
