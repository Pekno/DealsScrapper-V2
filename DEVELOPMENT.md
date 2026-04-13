# Development Guide

Everything developers need to know to contribute to and extend DealScrapper.

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Project Structure](#project-structure)
3. [CLI](#cli)
4. [Development Workflow](#development-workflow)
5. [Adding New Features](#adding-new-features)
6. [Testing](#testing)
7. [Code Quality](#code-quality)
8. [Troubleshooting](#troubleshooting)

---

## Getting Started

### Prerequisites

- **Node.js** 20+
- **Docker** & Docker Compose
- **PNPM** 8+ (install with `npm install -g pnpm`)

### Initial Setup

```bash
# Clone the repository
git clone https://github.com/Pekno/DealsScrapper-V2.git
cd DealsScrapper-V2

# Copy environment configuration
cp .env.example .env

# Install dependencies
pnpm install

# Start infrastructure (PostgreSQL, Redis, Elasticsearch, MailHog)
pnpm cli infra start

# Initialize database
pnpm cli db migrate
pnpm cli db generate

# Start all services in development mode
pnpm dev
```

### Service Ports

| Service | Port | URL |
|---------|------|-----|
| Web Frontend | 3000 | http://localhost:3000 |
| API | 3001 | http://localhost:3001/api/docs |
| Scraper | 3002 | http://localhost:3002/health |
| Notifier | 3003 | http://localhost:3003/health |
| Scheduler | 3004 | http://localhost:3004/health |

---

## Project Structure

For a complete architecture overview, see [ARCHITECTURE.md](./ARCHITECTURE.md).

```
dealscrapper-v2/
├── apps/                          # Microservices
│   ├── api/                       # REST API (NestJS)
│   ├── web/                       # Frontend (Next.js 15)
│   ├── scraper/                   # Scraping workers (Puppeteer)
│   ├── notifier/                  # Notifications (Email/WebSocket)
│   └── scheduler/                 # Job orchestration
│
├── packages/                      # Shared packages
│   ├── database/                  # Prisma schema & migrations
│   ├── shared-types/              # TypeScript types & interfaces
│   ├── shared-repository/         # Base repository pattern
│   ├── shared-logging/            # Winston logger
│   ├── shared-config/             # Configuration validation
│   ├── shared-health/             # Health check utilities
│   └── shared/                    # Common utilities
│
├── docs/                          # Documentation
├── scripts/                       # CI/CD & utility scripts
└── docker-compose.yml             # Infrastructure config
```

---

## CLI

The CLI (`pnpm cli`) is the primary interface for managing the project. See [COMMANDS.md](./COMMANDS.md) for the full reference.

### Most Used Commands

```bash
# Infrastructure
pnpm cli infra start               # Start Docker containers
pnpm cli infra stop                # Stop Docker containers
pnpm cli status                    # Health dashboard

# Development
pnpm dev                           # All services with hot-reload
pnpm dev:api                       # API only
pnpm dev:web                       # Web only

# Building
pnpm cli build                     # Build all services
pnpm cli build --service api       # Build a specific service

# Database
pnpm cli db migrate                # Run migrations
pnpm cli db generate               # Generate Prisma Client
pnpm cli db studio                 # Open Prisma Studio
pnpm cli db reset                  # Reset database

# Testing
pnpm cli test unit                 # Unit tests
pnpm cli test integration          # Integration tests
pnpm cli test complete             # Full suite

# Code Quality
pnpm cli check all                 # Lint + format + types
pnpm cli check all --fix           # Auto-fix everything
```

---

## Development Workflow

### Package Manager

**Always use PNPM** — never npm or yarn:

```bash
pnpm install                # Install all dependencies
pnpm add <package>          # Add to current workspace
pnpm add -w <package>       # Add to root workspace
pnpm add <package> --filter @dealscrapper/api  # Add to specific service
```

### Working with Services

Run commands for specific services using `--filter`:

```bash
pnpm build --filter @dealscrapper/api
pnpm test --filter @dealscrapper/scraper
pnpm lint --filter @dealscrapper/web
```

### Dev Mode

```bash
pnpm dev           # All services with hot-reload
pnpm dev:api       # API only (Port 3001)
pnpm dev:web       # Web only (Port 3000)
pnpm dev:scraper   # Scraper only (Port 3002)
pnpm dev:notifier  # Notifier only (Port 3003)
pnpm dev:scheduler # Scheduler only (Port 3004)
```

### Logs & Debugging

```bash
pnpm cli logs api                  # Last 50 lines
pnpm cli logs scraper --lines 100  # Last 100 lines
pnpm cli logs notifier --follow    # Tail mode
pnpm cli logs web --err            # Error log only
pnpm cli status                    # Service health dashboard
```

---

## Adding New Features

### Adding a New Site

See the comprehensive guide: **[ADDING_NEW_SITE.md](./ADDING_NEW_SITE.md)**

Quick summary of files to modify:

| Step | File | Purpose |
|------|------|---------|
| 1 | `packages/shared-types/src/site-source.ts` | Add to SiteSource enum |
| 2 | `apps/api/src/sites/definitions/site.definitions.ts` | Add site config |
| 3 | `apps/scraper/src/adapters/{site}/` | Create adapter class |
| 4 | `packages/shared-types/src/sites/{site}/` | Add field definitions |
| 5 | `packages/database/prisma/schema.prisma` | Add extension table |
| 6 | `packages/shared-types/src/article/` | Update ArticleWrapper |

### Adding a New API Endpoint

1. Create/update controller in `apps/api/src/{module}/`
2. Add DTOs for request/response validation
3. Update Swagger decorators for documentation
4. Add unit tests in `__tests__/` directory
5. Update E2E tests if needed

### Adding a New Shared Package

1. Create directory in `packages/{package-name}/`
2. Add `package.json` with proper naming (`@dealscrapper/{name}`)
3. Configure `tsconfig.json` extending root config
4. Export from `src/index.ts`
5. Add to root `tsconfig.json` paths

---

## Testing

### Test Types

| Type | Command | Description |
|------|---------|-------------|
| Unit | `pnpm cli test unit` | Isolated component tests |
| Integration | `pnpm cli test integration` | Service-level tests with real dependencies |
| E2E | `pnpm test:e2e` | Full stack with real services |
| Complete | `pnpm cli test complete` | Full suite: infra -> build -> unit -> e2e -> cleanup |

### Running Tests

```bash
# All tests
pnpm cli test unit

# Unit tests by service
pnpm test:api:unit
pnpm test:scraper:unit
pnpm test:notifier:unit
pnpm test:scheduler:unit

# E2E tests (requires Docker services)
pnpm test:e2e:complete      # Full suite with service management
pnpm test:api:e2e           # API E2E only
```

### E2E Testing

The complete E2E suite:
- Starts all test services (PostgreSQL, Redis, Elasticsearch, MailHog)
- Sets up test database with proper schema
- Runs all individual service tests
- Runs global cross-service integration scenarios
- Stops services automatically

For detailed testing documentation, see:
- [E2E Testing Guide](./docs/E2E-TESTING-GUIDE.md)
- [Scripts Documentation](./scripts/)

### Writing Tests

```typescript
describe('MyService', () => {
  let service: MyService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        MyService,
        { provide: DependencyService, useValue: mockDependency },
      ],
    }).compile();

    service = module.get<MyService>(MyService);
  });

  it('should do something', () => {
    expect(service.doSomething()).toBe(expected);
  });
});
```

---

## Code Quality

### TypeScript Guidelines

```typescript
// DO: Use proper types
function processArticle(article: ArticleWrapper): ProcessedResult {
  return { ... };
}

// DON'T: Use any
function processArticle(article: any): any {
  return { ... };
}
```

### Prisma Guidelines

```typescript
// DO: Use include for relations
const user = await prisma.user.findUnique({
  where: { id },
  include: { filters: true, sessions: true },
});

// DON'T: Use select (breaks typing)
const user = await prisma.user.findMany({
  select: { id: true, email: true },
});
```

### Import Guidelines

```typescript
// DO: Import from shared-types
import { SiteSource, ArticleWrapper } from '@dealscrapper/shared-types';

// DON'T: Duplicate type definitions locally
interface MySiteSource { ... }
```

### Linting & Formatting

```bash
pnpm cli check lint              # Run ESLint
pnpm cli check lint --fix        # Auto-fix
pnpm cli check format            # Check formatting
pnpm cli check format --fix      # Auto-format
pnpm cli check types             # TypeScript check
pnpm cli check all               # Everything
pnpm cli check all --fix         # Fix everything
```

---

## Troubleshooting

### Check What's Running

```bash
pnpm cli status                  # Service + infra health dashboard
```

### Port Already in Use

```bash
# Find process using port
ss -tlnp | grep :3001

# Kill process
kill -9 <PID>
```

### Database Issues

```bash
pnpm cli db reset                # Reset database
pnpm cli db push                 # Re-push schema
pnpm cli db generate             # Regenerate Prisma client
```

### Build Failures

```bash
pnpm cli dev reset               # Nuclear option: stop, clean, reinstall, reinitialize
```

### Docker Issues

```bash
# Reset all containers and volumes
docker-compose down -v
docker-compose up -d

# View logs
docker-compose logs -f postgres
docker-compose logs -f redis
```

### Module Resolution Errors

```bash
# Rebuild shared packages
pnpm cli build

# Regenerate Prisma client
pnpm cli db generate

# Clear TypeScript cache
rm -rf node_modules/.cache
```

---

## Additional Resources

| Resource | Description |
|----------|-------------|
| [Architecture](./ARCHITECTURE.md) | System design, services, data flow |
| [Commands Reference](./COMMANDS.md) | Complete command reference |
| [Adding New Sites](./ADDING_NEW_SITE.md) | Step-by-step site integration |
| [E2E Testing](./docs/E2E-TESTING-GUIDE.md) | End-to-end testing guide |
| [Production Deployment](./docs/PRODUCTION_DEPLOYMENT.md) | Deploy to production |
| [Packages Overview](./packages/) | Shared packages documentation |
