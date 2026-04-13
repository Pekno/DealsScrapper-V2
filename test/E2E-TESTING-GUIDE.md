# Complete E2E Testing Guide

This guide explains how to run comprehensive end-to-end tests across the entire DealScrapper platform.

## Overview

The complete E2E testing suite validates the entire system including:
- **All 4 services**: API, Notifier, Scheduler, Scraper
- **Real external services**: PostgreSQL, Redis, Elasticsearch, MailHog  
- **Cross-service integration**: Authentication, notifications, job processing
- **Global scenarios**: Complete user workflows spanning multiple services

## Quick Start

### 🚀 Run Complete E2E Test Suite

```bash
# Complete E2E testing workflow (recommended)
pnpm test:e2e:complete
```

This single command:
1. **Starts** all required test services (PostgreSQL, Redis, Elasticsearch, MailHog)
2. **Sets up** the test database with proper schema and migrations
3. **Runs** all individual service e2e tests (API, Notifier, Scheduler, Scraper)  
4. **Runs** global cross-service integration scenarios
5. **Stops** all test services automatically

### 🤖 CI/CD Version (with error handling)

```bash
# For CI/CD pipelines - ensures services stop even on test failure
pnpm test:e2e:ci
```

## Step-by-Step Commands

If you need to run parts of the workflow separately:

### 1. Start Test Services
```bash
pnpm run test:e2e:complete:services:start
# Starts: PostgreSQL (port 5433), Redis (port 6380), Elasticsearch (port 9201), MailHog (ports 1025/8025)
```

### 2. Setup Test Database
```bash
pnpm run test:e2e:complete:db:setup
# Runs migrations and sets up clean test database
```

### 3. Run Individual Service Tests
```bash
pnpm run test:e2e:complete:services:tests
# Runs: API e2e, Notifier e2e, Scheduler e2e, Scraper e2e
```

### 4. Run Global Cross-Service Tests
```bash
pnpm run test:e2e:complete:global:tests
# Runs: Authentication flow, Deal alert flow, other integration scenarios
```

### 5. Stop Test Services
```bash
pnpm run test:e2e:complete:services:stop
# Cleans up all Docker test containers
```

## Individual Service Testing

You can also test services individually (services must be running first):

```bash
# Start services first
pnpm run test:e2e:complete:services:start
pnpm run test:e2e:complete:db:setup

# Then test individual services
pnpm test:api:e2e        # API service tests
pnpm test:notifier:e2e   # Notifier service tests  
pnpm test:scheduler:e2e  # Scheduler service tests
pnpm test:scraper:e2e    # Scraper service tests

# Stop services when done
pnpm run test:e2e:complete:services:stop
```

## External Services Matrix

Each service integrates with real external services during testing:

| Service | Database | Redis | Elasticsearch | Email/MailHog | Test Count |
|---------|----------|-------|--------------|---------------|------------|
| **API** | ✅ Real | ✅ Real | ❌ N/A | ❌ N/A | 44 tests |
| **Notifier** | ✅ Real | ✅ Real | ❌ N/A | ✅ Real | ~15 tests |
| **Scheduler** | ✅ Real | ✅ Real | ❌ N/A | ❌ N/A | ~10 tests |
| **Scraper** | ✅ Real | ✅ Real | ✅ Real | ❌ N/A | 22 tests |
| **Global** | ✅ Real | ✅ Real | ✅ Real | ✅ Real | ~5 tests |

## Test Service Details

### Docker Test Services
```yaml
# Automatically started by test:e2e:complete
services:
  - postgres-test:5432 → localhost:5433
  - redis-test:6379 → localhost:6380  
  - elasticsearch-test:9200 → localhost:9201
  - mailhog-test:1025/8025 → localhost:1025/8025
```

### Test Environment Configuration
Tests use `.env.test` with isolated test service ports to avoid conflicts.

## Expected Test Output

The complete E2E suite runs approximately:
- **~96 total tests** across all services and global scenarios
- **~5-10 minutes** execution time (depending on system performance)
- **Verbose output** showing individual test results
- **Clear error reporting** if any tests fail

## Testing Workflow

```
🚀 Starting Complete E2E Test Suite...
├── 📦 Starting test services (PostgreSQL, Redis, Elasticsearch, MailHog)...
├── ⏳ Waiting for services to be ready...
├── 🗄️ Setting up test database...
├── 🧪 Running individual service e2e tests...
│   ├── API e2e tests (44 tests)
│   ├── Notifier e2e tests (~15 tests)  
│   ├── Scheduler e2e tests (~10 tests)
│   └── Scraper e2e tests (22 tests)
├── 🌐 Running global cross-service e2e scenarios...
│   ├── Authentication Flow E2E
│   └── Deal Alert Flow E2E  
├── 🛑 Stopping test services...
└── ✅ Complete E2E Test Suite finished!
```

## Troubleshooting

### Services Won't Start
```bash
# Check Docker and clean up any existing containers
docker ps -a
pnpm run test:services:clean

# Then retry
pnpm test:e2e:complete
```

### Tests Fail Due to Port Conflicts
```bash
# Check what's using test ports
ss -tlnp | grep -E ":(5433|6380|9201|1025|8025)"

# Kill conflicting processes or use different ports in .env.test
```

### Database Connection Issues
```bash
# Manually verify database setup
pnpm run test:db:setup

# Check database is accessible
psql postgresql://test:test@localhost:5433/dealscrapper_test -c "SELECT 1;"
```

### Individual Service Test Failures
```bash
# Run with verbose output to debug
TEST_VERBOSE=true pnpm test:api:e2e

# Check service logs
pnpm run test:services:logs
```

## CI/CD Integration

For automated testing environments, use:

```bash
# In your CI/CD pipeline
pnpm test:e2e:ci
```

This command:
- ✅ Automatically cleans up services even if tests fail
- ✅ Returns proper exit codes for pipeline status
- ✅ Provides clear success/failure reporting
- ✅ Handles timeout and error scenarios gracefully

## Performance Considerations

- **Parallel execution**: Individual service tests run sequentially to avoid resource conflicts
- **Resource usage**: Requires ~2GB RAM and significant CPU during execution
- **Docker requirements**: Ensure Docker has sufficient memory allocation (>4GB recommended)
- **Test isolation**: Each service properly cleans up data between test runs

## Best Practices

1. **Run complete suite before major deployments**
2. **Use in CI/CD pipelines for comprehensive validation**  
3. **Run individual service tests during development for faster feedback**
4. **Monitor test execution times and investigate slow tests**
5. **Ensure test services are properly stopped to free resources**

---

**Total Test Coverage**: ~96 comprehensive E2E tests  
**Execution Time**: ~5-10 minutes  
**Services Validated**: API, Notifier, Scheduler, Scraper + Global Integration  
**External Dependencies**: PostgreSQL, Redis, Elasticsearch, MailHog