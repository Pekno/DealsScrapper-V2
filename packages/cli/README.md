# @dealscrapper/cli

Cross-platform TypeScript CLI for DealsScapper development workflows. Replaces the previous bash scripts with a modern, interactive experience that works identically on Windows, Linux, and macOS.

## Usage

```bash
pnpm cli <command> [options]
```

Or directly:

```bash
tsx packages/cli/src/index.ts <command> [options]
```

## Commands

### Infrastructure

Manage test Docker containers (PostgreSQL, Redis, Elasticsearch, MailHog).

```bash
pnpm cli infra start    # Start containers, wait for health, push Prisma schema
pnpm cli infra stop     # Stop containers
```

### Services

Start/stop application services as background processes with health checks.

```bash
pnpm cli services start              # Start with test env (default)
pnpm cli services start --env dev    # Start with development env
pnpm cli services start --env prod   # Start with production env
pnpm cli services stop               # Stop all services (by PID or port scan)
```

**Startup sequence:**
1. Scheduler starts first (required for worker registration)
2. Once scheduler is healthy, remaining services start concurrently
3. Health checks poll `/health/ready` on each service
4. On failure, all services are stopped automatically

### Check

Code quality checks with optional per-service targeting.

```bash
pnpm cli check lint                     # Lint all services
pnpm cli check lint --fix               # Lint and auto-fix
pnpm cli check lint --service api       # Lint only API service
pnpm cli check format                   # Check formatting (Prettier)
pnpm cli check format --fix             # Auto-format
pnpm cli check types                    # TypeScript type checking
pnpm cli check types --service scraper  # Type-check one service
pnpm cli check all                      # Run all checks with timing report
pnpm cli check all --fix --service web  # Fix + target one service
```

### Build

Build application services (environment-agnostic, no env vars baked in).

```bash
pnpm cli build                  # Build all services (turbo-parallelized)
pnpm cli build --service api    # Build a specific service
```

### Database

Prisma database management.

```bash
pnpm cli db generate    # Generate Prisma client
pnpm cli db migrate     # Run migrations
pnpm cli db push        # Push schema to database
pnpm cli db studio      # Open Prisma Studio (interactive)
pnpm cli db seed        # Seed the database
pnpm cli db reset       # Reset database (with confirmation prompt)
```

### Docker

Build and push Docker images.

```bash
pnpm cli docker build                          # Build all services
pnpm cli docker build --service api            # Build one service
pnpm cli docker build --version v1.2.0 --push  # Tag and push to registry
pnpm cli docker build --platforms linux/amd64,linux/arm64  # Multi-arch
```

### Deploy

Production deployment via Docker Compose.

```bash
pnpm cli deploy up      # Orchestrated startup (infra first, then services)
pnpm cli deploy down    # Stop production stack
pnpm cli deploy logs    # View logs
pnpm cli deploy ps      # Show status
```

### Tests

Run test suites with timing reports.

```bash
pnpm cli test unit          # Unit tests for all 4 services
pnpm cli test integration   # E2E tests for all 4 services
pnpm cli test complete      # Full suite: infra -> build -> unit -> e2e -> cleanup
```

### Status

Health dashboard showing all services and infrastructure at a glance.

```bash
pnpm cli status    # Show running services, ports, PIDs, and Docker container health
```

### Logs

View service process logs.

```bash
pnpm cli logs api                # Last 50 lines of API logs
pnpm cli logs scraper --lines 100  # Last 100 lines
pnpm cli logs notifier --follow    # Tail mode (live follow)
pnpm cli logs web --err            # View error log
```

### Dev

Development workflow helpers.

```bash
pnpm cli dev setup    # Initialize development environment
pnpm cli dev reset    # Clean slate: stop services, clean, reinstall, setup
```

### Env

Environment configuration inspection.

```bash
pnpm cli env show                # Show dev env vars (secrets masked)
pnpm cli env show --env test     # Show test env vars
pnpm cli env validate            # Check required vars are present
pnpm cli env validate --env prod # Validate production config
```

## Architecture

```
src/
  index.ts                # Entry point - citty command router
  commands/
    infra-start.ts        # docker compose up + health wait + prisma push
    infra-stop.ts         # docker compose stop
    services-start.ts     # Phased service startup with health checks
    services-stop.ts      # PID file + port scan based shutdown
    docker-build.ts       # Docker image builds with multi-platform support
    deploy-prod.ts        # Production docker-compose orchestration
    test-unit.ts          # Unit test runner with timing
    test-integration.ts   # E2E test runner with timing
    test-complete.ts      # Full test suite orchestrator
    check.ts              # Code quality (lint, format, type-check)
    build.ts              # App build with per-service targeting
    db.ts                 # Prisma database management
    status.ts             # Health dashboard
    logs.ts               # Service log viewer
    dev.ts                # Dev setup and reset workflows
    env.ts                # Environment variable inspection
  lib/
    constants.ts          # Service definitions, ports, paths
    process-manager.ts    # Cross-platform spawn/kill/PID management
    health-check.ts       # HTTP health endpoint polling
    docker.ts             # Docker Compose detection and helpers
    env.ts                # Environment file resolution and parsing
    timing.ts             # Stopwatch and timing report utilities
    ui.ts                 # Styled terminal output (banners, tables)
```

## Libraries

| Library | Role |
|---------|------|
| [citty](https://github.com/unjs/citty) | Command routing, argument parsing, auto-generated help |
| [@clack/prompts](https://github.com/bombshell-dev/clack) | Spinners, styled logs, interactive prompts |
| [listr2](https://github.com/listr2/listr2) | Multi-step task orchestration with concurrent spinners |
| [picocolors](https://github.com/alexeyraspopov/picocolors) | Terminal colors |

## Cross-Platform Details

The CLI uses Node.js APIs that work identically across platforms:

- **Process spawning**: `child_process.spawn({ detached: true })` + `unref()` replaces `nohup`/`disown` (Linux) and `PowerShell Start-Process` (Windows)
- **Process killing**: `process.kill(pid)` with `taskkill` fallback on Windows
- **Health checks**: Built-in `fetch()` replaces `curl`
- **PID files**: Stored in `os.tmpdir()` (resolves to `/tmp` on Linux, `%TEMP%` on Windows)
- **Port scanning**: Single platform branch in `findPidByPort()` (`ss` on Linux, `netstat` on Windows)
- **Log tailing**: `fs.watchFile` + `fs.createReadStream` for cross-platform follow mode

No bash, no Git Bash, no PowerShell workarounds required.
