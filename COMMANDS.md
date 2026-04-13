# DealScrapper Commands Reference

This document provides a comprehensive reference for all available commands in the DealScrapper project.

## 🚀 Quick Start Commands

```bash
# Initial project setup
pnpm run setup              # Install dependencies, start Docker, run migrations

# Start development environment
pnpm run dev                # Start all services in development mode
pnpm run dev:api            # Start only API in development mode
pnpm run dev:scraper        # Start only Scraper in development mode

# Start Docker services
pnpm run docker:up          # Start PostgreSQL, Redis containers
pnpm run docker:down        # Stop all containers
```

## 🏗️ Build Commands

```bash
# Build all applications
pnpm run build              # Build all apps for production

# Build individual applications
pnpm run build:api          # Build API for production
pnpm run build:scraper      # Build Scraper for production
```

## 🎯 Start Commands

```bash
# Development mode (with file watching)
pnpm run dev                # Start all services with hot reload
pnpm run dev:api            # Start API with hot reload
pnpm run dev:scraper        # Start Scraper with hot reload

# Production mode (from built files)
pnpm run start              # Start all services in production mode
pnpm run start:api          # Start API in production mode
pnpm run start:scraper      # Start Scraper in production mode
pnpm run start:prod         # Start all services in production mode
pnpm run start:prod:api     # Start API in production mode
pnpm run start:prod:scraper # Start Scraper in production mode
```

## 🧪 Testing Commands

### Quick Test Commands (Recommended)

```bash
# Complete test suite with beautiful timing reports
pnpm test:complete         # Full suite: infra + build + all tests + cleanup

# Individual test suites with statistics
pnpm test:unit:all         # All unit tests with timing & stats
pnpm test:integration:all  # All integration tests with timing & stats
pnpm test:integration      # Cypress E2E tests (cross-service)
```

### Individual Service Tests

```bash
# API Service
pnpm test:api:unit         # API unit tests
pnpm test:api:e2e          # API integration tests

# Scraper Service
pnpm test:scraper:unit     # Scraper unit tests
pnpm test:scraper:e2e      # Scraper integration tests

# Notifier Service
pnpm test:notifier:unit    # Notifier unit tests
pnpm test:notifier:e2e     # Notifier integration tests

# Scheduler Service
pnpm test:scheduler:unit   # Scheduler unit tests
pnpm test:scheduler:e2e    # Scheduler integration tests

# Web Frontend
pnpm test:web              # Web frontend tests
pnpm test:web:watch        # Web tests in watch mode
```

### Test Environment Management

```bash
# Infrastructure
pnpm test:infra:start      # Start Docker services (PostgreSQL, Redis, etc.)
pnpm test:infra:stop       # Stop Docker infrastructure

# Application Services
pnpm test:build            # Build all services (TypeScript compilation)
pnpm test:services:start   # Start all services on host with .env.test
pnpm test:services:stop    # Stop all services

# Combined
pnpm test:env:full         # Infra + Build + Services (full setup)
pnpm test:env:stop         # Stop services + infrastructure (full cleanup)
```

**📚 For detailed documentation, see [scripts/README.md](./scripts/)**

## 🔧 Development Tools

```bash
# Code quality
pnpm run lint               # Run linting on all packages
pnpm run lint:fix           # Run linting and fix issues automatically
pnpm run format             # Format code with Prettier
pnpm run format:check       # Check code formatting
pnpm run type-check         # Run TypeScript type checking
pnpm run clean              # Clean build artifacts

# Project maintenance
pnpm run verify             # Verify all commands work correctly
```

## 🗄️ Database Commands

```bash
# Prisma operations
pnpm run db:generate        # Generate Prisma client
pnpm run db:migrate         # Run database migrations
pnpm run db:studio          # Open Prisma Studio (database GUI)
pnpm run db:seed            # Seed database with initial data
pnpm run db:reset           # Reset database (⚠️ destructive)
```

## 🐳 Docker Commands

```bash
# Container management
pnpm run docker:up          # Start all containers (PostgreSQL, Redis)
pnpm run docker:down        # Stop all containers
pnpm run docker:logs        # View container logs
pnpm run docker:clean       # Stop containers and remove volumes (⚠️ destructive)
```

## 📊 API Documentation

Once the API is running, you can access:

- **Swagger UI**: `http://localhost:3001/api/docs`
- **API Base URL**: `http://localhost:3001`

## 🕷️ Scraper Endpoints

When the scraper is running, monitoring endpoints are available:

- **Category Monitor Status**: `http://localhost:3002/category-monitor/status`
- **Category Analysis**: `http://localhost:3002/category-monitor/analysis`
- **Scrape Queue Stats**: `http://localhost:3002/scrape-queue/stats`

## ⚡ Common Development Workflows

### Starting Development

```bash
# 1. Initial setup (first time)
pnpm run setup

# 2. Start development environment
pnpm run dev

# 3. In another terminal, check API documentation
open http://localhost:3001/api/docs
```

### Running Tests

```bash
# Quick test check
pnpm run test:api:unit
pnpm run test:scraper:unit

# Full test suite
pnpm run test:full

# Test with coverage
pnpm run test:coverage
```

### Code Quality Check

```bash
# Format and lint
pnpm run format
pnpm run lint:fix

# Type checking
pnpm run type-check

# Build check
pnpm run build
```

### Database Operations

```bash
# After schema changes
pnpm run db:generate
pnpm run db:migrate

# View data
pnpm run db:studio

# Reset for clean start (⚠️ destructive)
pnpm run db:reset
```

## 🔍 Command Verification

To verify all commands are working correctly:

```bash
pnpm run verify
```

This will check:

- ✅ All package.json scripts are properly defined
- ✅ Commands execute without errors
- ✅ Dependencies are correctly installed
- ✅ Build processes work

## 📝 Notes

- **Port Configuration**:
  - API: `http://localhost:3001`
  - Scraper: `http://localhost:3002`
  - PostgreSQL: `localhost:5432`
  - Redis: `localhost:6379`

- **Environment Files**:
  - Copy `.env.example` to `.env` in each app directory
  - Configure database URLs and API keys as needed

- **Dependencies**:
  - Node.js ≥ 20.0.0
  - pnpm ≥ 8.0.0
  - Docker and Docker Compose

## 🆘 Troubleshooting

### Command Fails

```bash
# Check if all dependencies are installed
pnpm install

# Verify Docker is running
pnpm run docker:up

# Check if database is accessible
pnpm run db:studio
```

### Build Errors

```bash
# Clean and rebuild
pnpm run clean
pnpm run db:generate
pnpm run build
```

### Test Failures

```bash
# Reset test environment
pnpm run test:setup
pnpm run test:db:setup
```

For more detailed troubleshooting, run individual commands with verbose output to see specific error messages.
