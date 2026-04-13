# Docker Build Guide

## Quick Start

```bash
pnpm cli docker build                        # Build all services locally
pnpm cli docker build --service api           # Build specific service
pnpm cli docker build --push                  # Build and push to Docker Hub
```

Or use the script directly:

```bash
./scripts/build-docker-images.sh [OPTIONS]
```

### Options

| Option | Default | Description |
|--------|---------|-------------|
| `--org ORG` | `dealscrapper` | Docker Hub organization |
| `--version VERSION` | `latest` | Image version tag |
| `--platforms ARCH` | `linux/amd64` | Target platforms |
| `--push` | `false` | Push to Docker Hub |
| `--service SERVICE` | All | Build only one service |

---

## Usage Examples

```bash
# Local development
./scripts/build-docker-images.sh
./scripts/build-docker-images.sh --service scraper
./scripts/build-docker-images.sh --version dev-$(git rev-parse --short HEAD)

# Production release
./scripts/build-docker-images.sh --version 1.0.0 --push

# Multi-architecture (requires Docker Buildx)
./scripts/build-docker-images.sh --version 1.0.0 --platforms linux/amd64,linux/arm64 --push

# Test environment
./scripts/build-docker-images.sh --org dealscrapper-test
```

---

## Build Architecture

The `Dockerfile.global` uses multi-stage builds:

```
Stage 1: Base      → Node.js + pnpm (rarely changes)
Stage 2: Pruner    → turbo prune (changes with dependencies)
Stage 3: Builder   → Install deps, copy source, build TypeScript
Stage 4: Runner    → Minimal production image
```

**Layer caching**: Dependencies are installed before source code is copied. If source changes but dependencies don't, Docker reuses the dependency layer.

---

## Optimizations

### Cypress Binary Skip

Cypress (~400MB) is only needed for E2E tests in CI, not in Docker images:

```dockerfile
ENV CYPRESS_INSTALL_BINARY=0
RUN pnpm install --frozen-lockfile --prefer-offline
```

This saves ~400MB and 30-60s per build. Cypress is still available in GitHub Actions where `pnpm install` runs without this env var.

### Smart Build Detection

The test services script checks if images exist before building:
- **First run**: Builds images (~10-15 min)
- **Subsequent runs**: Uses cached images (~30s)
- **90% faster** repeated test runs

### Unified Build Script

Same script for all environments (test, CI, production) - single source of truth.

---

## Expected Image Sizes

| Service | Size |
|---------|------|
| API | ~400-500MB |
| Scraper | ~600-700MB (includes Chromium) |
| Notifier | ~400-500MB |
| Scheduler | ~400-500MB |
| Web | ~500-600MB |

---

## Multi-Architecture Setup

```bash
# One-time setup
docker buildx create --name multiplatform-builder --use

# Build for both architectures
./scripts/build-docker-images.sh --platforms linux/amd64,linux/arm64 --push
```

---

## Docker Hub Authentication

```bash
# Local
docker login

# CI/CD - set GitHub secrets:
# DOCKER_USERNAME - Docker Hub username
# DOCKER_PASSWORD - Docker Hub access token
```

---

## Troubleshooting

**Multi-platform build fails** (`docker: 'buildx' is not a docker command`):
```bash
docker buildx install
docker buildx create --name multiplatform-builder --use
```

**Images too large**: Check `docker images | grep dealscrapper` against expected sizes above.

**Cypress still being downloaded**: Verify `CYPRESS_INSTALL_BINARY=0` is set before `pnpm install` in Dockerfile.
