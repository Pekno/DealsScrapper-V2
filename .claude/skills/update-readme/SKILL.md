---
name: update-readme
description: "Update or refresh a service's README.md with accurate, comprehensive documentation derived from reading the actual source code. Use this skill whenever the user asks to 'update readme', 'refresh readme', 'document service', 'write readme', 'update docs', or wants to generate/regenerate documentation for any service in the monorepo. Also trigger when the user says a README is outdated or asks for service documentation. Works for any app (api, scraper, scheduler, notifier, web) or package."
argument-hint: "[service-name: api|scraper|scheduler|notifier|web]"
---

# Update Service README

You are generating a comprehensive, accurate README.md for a DealsScrapper service by reading the actual source code. The goal is documentation that helps developers understand the service's architecture, internals, and integration points at a glance.

## Step 0: Determine Target Service

The service argument may be provided (e.g. `api`, `scraper`). If not:
1. Check if there's a recently opened file that indicates which service (look at conversation context)
2. Ask the user which service to document

Map the argument to a path:
- `api` -> `apps/api/`
- `scraper` -> `apps/scraper/`
- `scheduler` -> `apps/scheduler/`
- `notifier` -> `apps/notifier/`
- `web` -> `apps/web/`
- A package name -> `packages/<name>/`

## Step 1: Deep-Read the Service Source Code

This is the most important step. You cannot write good documentation without reading the code. Do all of this before writing a single line of the README.

### 1a. Discover the file structure
```
find apps/<service>/src -type f -name "*.ts" | sort
```
This gives you the complete list of source files.

### 1b. Read the entry points first
- `src/main.ts` — bootstrap logic, what gets initialized on startup, ports, swagger setup
- `src/<service>.module.ts` — the root NestJS module; tells you which sub-modules are imported and therefore which are actually wired in (vs dead code)

### 1c. Read every service file (`*.service.ts`)
For each service file, extract:
- **Purpose**: What does this service do? (first line of the class JSDoc or infer from methods)
- **Key methods**: Public methods and their behavior (especially cron jobs, event handlers, main business logic)
- **Dependencies**: Constructor-injected services (tells you what it depends on)
- **Notable implementation details**: Caching strategies, retry logic, rate limiting, state management patterns

### 1d. Read controllers (`*.controller.ts`)
Extract the API endpoints: HTTP method, path, what they do, request/response shape.

### 1e. Read modules (`*.module.ts`)
Understand which providers are registered, which modules are imported/exported. This tells you the dependency graph.

### 1f. Read type definitions (`types/`, `*.types.ts`, `*.dto.ts`)
Understand the data shapes flowing through the service.

### 1g. Read repositories if they exist (`repositories/`, `*.repository.ts`)
Understand database access patterns.

### 1h. Read config files (`config/`)
Environment variables, feature flags, configuration constants.

### 1i. Check what tests exist
```
find apps/<service>/test -type f -name "*.spec.ts" | sort
```

### 1j. Read the existing README.md (if any)
Note what's there — you'll preserve any still-accurate content and fix what's outdated.

## Step 2: Read the Reference README

Read `apps/scheduler/README.md` as the gold standard for format and depth. Your output should match this structure and level of detail. Pay special attention to the **Internal Services** section — each service gets a full paragraph plus key behaviors and dependencies.

## Step 3: Write the README

Generate the README with these sections, in this order. Every section must be derived from what you actually read in the source code — never guess or hallucinate features.

### Section Structure

```markdown
# <Service Name> - <One-Line Role Description>

## Overview
- 1-2 sentence description of what this service does in the system
- **Key Responsibilities:** bullet list of 4-6 main things it does

## Architecture
### Service Interactions
- Mermaid graph showing how this service connects to other services, databases, queues
- Derive this from the imports, injected services, and HTTP calls in the code

### Directory Structure
- Tree view of src/ with one-line comments per directory

---

## Internal Services
This is the MOST IMPORTANT section. For each *.service.ts file:

### ServiceClassName (`path/to/service.ts`)

Opening paragraph (3-5 sentences): What this service does, how it works at a high level, what role it plays in the broader service. Be specific — mention actual method names, data flows, algorithms.

**Key behaviors:**
- Bullet list of 4-8 specific behaviors (mention method names, cron schedules, thresholds, strategies)

**Depends on:** `ServiceA`, `ServiceB`, `PrismaService`

---
(repeat for each service, separated by ---)

Also document repositories, adapters, and other significant classes the same way.

---

## Core Features
### 1. Feature Name
Brief explanation with a concrete example (code block or before/after comparison)

(repeat for 2-5 core features)

---

## Tech Stack
| Technology | Purpose |
|------------|---------|
| ... | ... |

---

## Getting Started
### Prerequisites
### Running the Service

---

## API Endpoints
Use tables:
| Method | Path | Description |
Group by controller/domain.

---

## Testing
- How to run tests (actual commands from package.json or CLI)
- What test files exist and what they cover

---

## Integration with Other Services
- How this service interacts with each other service it touches
- What data flows between them

---

## Troubleshooting
- 3-5 common issues with symptoms and solutions
```

## Writing Guidelines

1. **Accuracy over completeness** — Only document what you verified in the source code. If a module exists but isn't imported in the root module, note that ("not yet wired into the main module").

2. **Internal Services depth** — Each service description should be a real paragraph that someone could read and understand the service without opening the file. Mention actual config values, thresholds, algorithms, cron expressions.

3. **Dependency lines matter** — The `**Depends on:**` line for each service helps developers understand the coupling. List only constructor-injected dependencies.

4. **Mermaid diagrams** — Keep them simple. Show the service, its databases, queues, and connections to other DealsScrapper services. Don't try to show every internal class.

5. **API endpoints** — Use tables, not verbose code blocks. Group logically.

6. **No invented features** — If you see a TODO or placeholder method, document it as such. Don't describe it as working functionality.

7. **CLI commands** — Use `pnpm cli` and `pnpm dev:<service>` commands from CLAUDE.md, not raw npm scripts.

## Step 4: Write the File

Write the README to `apps/<service>/README.md` (or `packages/<name>/README.md`).

Tell the user what you documented and highlight anything notable you found (dead code, unregistered modules, missing tests, etc.).
