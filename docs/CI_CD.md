# CI/CD Pipeline

## Overview

DealsScrapper uses GitHub Actions with 2 workflows that leverage existing pnpm scripts, keeping CI consistent with local development.

| Workflow | Trigger | Duration | What it does |
|----------|---------|----------|-------------|
| `pr-tests.yml` | PR to `main`/`develop` | ~15-20 min | Runs full test suite via `pnpm test:complete` |
| `release-docker.yml` | GitHub Release or manual | ~30-45 min | Builds & publishes Docker images for all 5 services |

---

## PR Tests Workflow

Runs the same command locally and in CI:

```bash
pnpm test:complete
```

This internally runs (via `scripts/test-complete-with-timing.sh`):
1. Start Docker containers (PostgreSQL, Redis, Elasticsearch, MailHog)
2. Setup test database
3. Unit tests for all services (API, Scraper, Notifier, Scheduler)
4. E2E tests for all services
5. Cypress E2E tests
6. Cleanup

**Failed runs upload artifacts**: coverage reports, Cypress screenshots/videos, service logs.

---

## Docker Build & Publish Workflow

Triggered by creating a GitHub Release or manually via the Actions tab.

```bash
# What the workflow runs per service:
docker build -f Dockerfile.global --build-arg SERVICE=api -t dealscrapper/api:1.0.0 .
```

**Published images** (for each of: api, scraper, notifier, scheduler, web):
```
dealscrapper/<service>:<version>
dealscrapper/<service>:latest
```

---

## Setup (One-Time)

### 1. Docker Hub

1. Create organization `dealscrapper` on [Docker Hub](https://hub.docker.com/)
2. Select Free plan (public repositories)

### 2. GitHub Secrets

**Settings > Secrets and variables > Actions > New repository secret**

| Secret | Description | How to get it |
|--------|-------------|---------------|
| `DOCKER_USERNAME` | Docker Hub username | Your login |
| `DOCKER_PASSWORD` | Docker Hub **access token** (not password!) | Docker Hub > Account Settings > Security > New Access Token |

### 3. Workflow Configuration

In `.github/workflows/release-docker.yml`, verify:
```yaml
env:
  DOCKER_ORG: dealscrapper  # Change if different org name
```

---

## Creating a Release

### Via GitHub UI (Recommended)

1. **Releases** > **Draft a new release**
2. **Choose a tag** > Create new tag (e.g., `v1.0.0`)
3. Fill release notes, click **Publish release**
4. GitHub Actions automatically builds and publishes Docker images

### Via CLI

```bash
git tag -a v1.0.0 -m "Release version 1.0.0"
git push origin v1.0.0
gh release create v1.0.0 --title "DealsScrapper v1.0.0" --notes "Release notes here"
```

### Manual Trigger

```bash
gh workflow run release-docker.yml -f tag=v1.0.0
gh run watch
```

---

## Testing Workflows

### Method 1: Local with `act`

```bash
# Install
brew install act  # macOS
choco install act-cli  # Windows

# Test PR workflow
act pull_request -W .github/workflows/pr-tests.yml

# Test release workflow
act workflow_dispatch -W .github/workflows/release-docker.yml --input tag=test-v1.0.0

# With secrets
echo "DOCKER_USERNAME=user\nDOCKER_PASSWORD=token" > .secrets
act --secret-file .secrets

# Dry run
act -n
```

**Limitations**: May not perfectly replicate GitHub env, Docker-in-Docker can be tricky.

### Method 2: Draft PR (Most Reliable)

```bash
git checkout -b test/workflow
echo "test" >> TEST.md && git add . && git commit -m "test: workflow"
git push origin test/workflow
# Open DRAFT PR on GitHub, watch Checks tab
# Clean up after:
git push origin --delete test/workflow && git checkout main && git branch -D test/workflow
```

### Method 3: Test Individual Steps Locally

```bash
pnpm test:complete                                          # What PR workflow runs
./scripts/build-docker-images.sh --service api --org test   # What release workflow runs
```

---

## Debugging

```bash
# View workflow logs
gh run list --workflow=pr-tests.yml
gh run view <run-id> --log

# Enable debug mode (add as GitHub Secrets)
ACTIONS_RUNNER_DEBUG=true
ACTIONS_STEP_DEBUG=true
```

**Common issues**:
- Tests fail in CI but pass locally: check env vars, database connectivity
- Docker build fails: verify secrets, org name, check build logs
- PNPM version mismatch: ensure `package.json`, `Dockerfile.global`, and workflow files all use the same version

---

## Security

- Use **Access Tokens**, not passwords for Docker Hub
- Rotate tokens periodically
- Enable 2FA on Docker Hub
- Never commit secrets to the repository
