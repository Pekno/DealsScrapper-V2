# Release Process - Quick Reference

## 🚀 Standard Release Workflow

### 1. Prepare Release

```bash
# Ensure you're on main branch with latest code
git checkout main
git pull origin main

# Verify all tests pass locally
pnpm test:complete

# Build all services to verify
pnpm build
```

### 2. Create Release on GitHub

**Option A: GitHub Web UI** (Recommended)
1. Go to: `https://github.com/Pekno/DealsScrapper-V2/releases/new`
2. Click **"Choose a tag"** → Type `v1.0.0` → **"Create new tag"**
3. Release title: `DealsScrapper v1.0.0`
4. Write release notes (see template below)
5. Click **"Publish release"**

**Option B: GitHub CLI**
```bash
# Create and push tag
git tag -a v1.0.0 -m "Release version 1.0.0"
git push origin v1.0.0

# Create release
gh release create v1.0.0 \
  --title "DealsScrapper v1.0.0" \
  --notes-file RELEASE_NOTES.md
```

### 3. Monitor GitHub Actions

1. Go to **Actions** tab
2. Watch **"Build & Publish Docker Images"** workflow
3. All 5 services should build successfully
4. Images will be published to Docker Hub

### 4. Verify Release

```bash
# Check Docker Hub images
docker pull dealscrapper/api:1.0.0
docker pull dealscrapper/scraper:1.0.0
docker pull dealscrapper/notifier:1.0.0
docker pull dealscrapper/scheduler:1.0.0
docker pull dealscrapper/web:1.0.0

# Verify latest tag updated
docker pull dealscrapper/api:latest
```

### 5. Test Deployment

```bash
# Download deployment package from release
wget https://github.com/Pekno/DealsScrapper-V2/releases/download/v1.0.0/dealscrapper-deployment-1.0.0.tar.gz

# Extract and test
tar -xzf dealscrapper-deployment-1.0.0.tar.gz
cd deployment
cp .env.example .env

# Edit .env with test credentials
# Then deploy
docker-compose up -d

# Check all services are running
docker-compose ps
curl http://localhost:3000/health  # Web
curl http://localhost:3001/health  # API
```

---

## 📝 Release Notes Template

```markdown
## 🎉 DealsScrapper v1.0.0

### ✨ New Features
- Feature 1: Description
- Feature 2: Description

### 🐛 Bug Fixes
- Fix 1: Description
- Fix 2: Description

### 🔧 Improvements
- Improvement 1: Description
- Improvement 2: Description

### 📦 Docker Images
All images available at: https://hub.docker.com/u/dealscrapper

\`\`\`bash
docker pull dealscrapper/api:1.0.0
docker pull dealscrapper/scraper:1.0.0
docker pull dealscrapper/notifier:1.0.0
docker pull dealscrapper/scheduler:1.0.0
docker pull dealscrapper/web:1.0.0
\`\`\`

### 🚀 Quick Deploy
\`\`\`bash
wget https://github.com/Pekno/DealsScrapper-V2/releases/download/v1.0.0/dealscrapper-deployment-1.0.0.tar.gz
tar -xzf dealscrapper-deployment-1.0.0.tar.gz
cd deployment && cp .env.example .env
# Configure .env
docker-compose up -d
\`\`\`

### 📊 Statistics
- Services: 5 (API, Scraper, Notifier, Scheduler, Web)
- Tests passing: 100%
- Docker images: Multi-arch (AMD64 + ARM64)

---
**Full Changelog**: https://github.com/Pekno/DealsScrapper-V2/compare/v0.9.0...v1.0.0
```

---

## 🔖 Version Numbering (Semantic Versioning)

```
MAJOR.MINOR.PATCH
  |     |     |
  |     |     └─ Bug fixes (v1.0.1)
  |     └─────── New features (v1.1.0)
  └───────────── Breaking changes (v2.0.0)
```

**Examples:**
- `v1.0.0` - First stable release
- `v1.0.1` - Bug fix release
- `v1.1.0` - New feature added
- `v2.0.0` - Breaking API changes

---

## 🔥 Hotfix Release Process

For critical bug fixes that need immediate deployment:

```bash
# Create hotfix branch from main
git checkout -b hotfix/v1.0.1 main

# Make fixes
git commit -m "fix: critical bug in API authentication"

# Merge back to main
git checkout main
git merge hotfix/v1.0.1
git push origin main

# Create hotfix release
git tag -a v1.0.1 -m "Hotfix: Critical authentication bug"
git push origin v1.0.1

# Create release on GitHub (triggers Docker builds)
gh release create v1.0.1 \
  --title "DealsScrapper v1.0.1 (Hotfix)" \
  --notes "🔥 Critical fix for authentication issue"
```

---

## 📋 Pre-Release Checklist

Before creating a release:

- [ ] All tests passing on main branch
- [ ] Version number decided (semantic versioning)
- [ ] CHANGELOG.md updated
- [ ] Release notes drafted
- [ ] Docker Hub credentials valid
- [ ] GitHub Actions workflows working
- [ ] No open critical bugs
- [ ] Database migrations tested (if any)

---

## 🐳 Published Docker Images

After successful release, these images are available:

| Service | Image | Ports |
|---------|-------|-------|
| API | `dealscrapper/api:1.0.0` | 3001 |
| Scraper | `dealscrapper/scraper:1.0.0` | 3002 (internal) |
| Notifier | `dealscrapper/notifier:1.0.0` | 3003 (internal) |
| Scheduler | `dealscrapper/scheduler:1.0.0` | 3004 (internal) |
| Web | `dealscrapper/web:1.0.0` | 3000 |

**All services also tagged with:** `latest`

---

## 🎯 Common Commands

```bash
# View all releases
gh release list

# View specific release
gh release view v1.0.0

# Delete a release (if needed)
gh release delete v1.0.0

# Delete a tag (if needed)
git tag -d v1.0.0
git push origin :refs/tags/v1.0.0

# Manually trigger Docker build
gh workflow run release-docker.yml -f tag=v1.0.0
```

---

## ❓ FAQ

**Q: Can I create a release without tests?**
A: No, the release workflow assumes tests passed on main. Always merge PRs with passing tests first.

**Q: How long does the Docker build take?**
A: ~30-45 minutes for all 5 services (parallel builds).

**Q: Can I rebuild a specific service?**
A: Not directly. You can manually trigger the workflow for a specific tag.

**Q: What if Docker build fails?**
A: Check Actions logs, fix the issue, delete the release/tag, and create a new release.

**Q: Can I publish to a private Docker Hub?**
A: Yes, just ensure your Docker Hub organization/repository is private.

---

**Next Steps:** See [CI_CD.md](./CI_CD.md) for detailed GitHub Actions workflow documentation.
