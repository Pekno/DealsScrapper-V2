# LLM-Based Extraction — Collapsed into the Scraper

## Context

DealsScrapper currently extracts listing fields using declarative CSS selector configs per site (`apps/scraper/src/adapters/*/*.field-config.ts`), walked by `field-extractor.service.ts`. This is brittle: any class-name change on Dealabs/Vinted/LeBonCoin silently breaks extraction, and onboarding a new site requires hand-tuning tens of selectors.

**Outcome.** A small local LLM (Qwen2.5-3B via Ollama) takes a curated Markdown representation of a single listing and returns a structured JSON object. All LLM logic lives **directly inside `apps/scraper/`** — no separate extractor service, no HTTP hop between services. The scraper keeps its adapters and listing-level boundary (`getListingSelector()`) and calls Ollama directly via an `OllamaService` NestJS module inside the scraper.

Why **not** a separate service:

1. **No architectural benefit here.** The only win of network isolation was keeping the scraper away from Ollama — but there is no security or reliability reason to do that. A direct call is simpler.
2. **One fewer container.** No extra Dockerfile, no Docker network to manage, no health-check hop, no HTTP serialization overhead.
3. **Matches existing pattern for internal concerns.** The queue consumer (BullMQ), the puppeteer pool, and scraping logic all live in the scraper — LLM extraction is similarly internal.
4. **Simpler dependency graph.** No `ExtractorClientService`, no `EXTRACTOR_URL` env var, no 503/504 error mapping between services.

Why **TypeScript** (no Zod):

- Zod removed per user decision. Per-site output schemas are plain JSON Schema objects (written by hand), passed directly to Ollama's `format` parameter for constrained generation. Validation of LLM output uses lightweight type-guard functions that check required fields, no schema library needed.
- Shared types (`UniversalListing`, `DealabsData`, etc.) from `packages/shared-types/` remain the canonical shape — site JSON Schema objects are written to match them and checked at build time via TypeScript type guards (`satisfies` expressions where helpful).

## Decisions (locked)

| Decision | Choice |
|---|---|
| Model | `qwen2.5:3b-instruct` via Ollama, CPU-only acceptable |
| Rollout | Replace per site immediately — no dual-path fallback |
| Prompt delivery | Runtime `system` field on each request, composed in TS |
| Few-shot examples | `fixtures/*.html` + `*.expected.json` per site, loaded at module init |
| Network topology | Scraper → Ollama directly. Ollama exposed on `127.0.0.1:11434` (dev) / internal Docker network (prod) |
| LLM extraction home | `apps/scraper/src/llm-extraction/` (new sub-tree inside the scraper) |
| LLM JSON enforcement | Pass per-site plain JSON Schema to Ollama via `format` — runner enforces structure server-side |
| Schema validation | Lightweight TypeScript type-guard functions (no Zod, no schema library) |
| Ollama port (dev/test) | 11434 (dev), 11435 (test) |

## Resume checklist

**How to resume in a new context window.** Read this file top to bottom once, then find the first unchecked `- [ ]` below and continue from there. Phases are strictly ordered — don't jump ahead. After completing a task, edit this file to flip `[ ]` → `[x]`. Commit the plan file alongside code changes so the state stays accurate on every branch.

Key orientation before touching code:
- Scraper adapter pattern: `apps/scraper/src/adapters/base/site-adapter.interface.ts`, then `apps/scraper/src/adapters/dealabs/dealabs.adapter.ts`
- Extraction flow entry point: `apps/scraper/src/extraction/unified-extraction.service.ts`
- Current field-config to be replaced: `apps/scraper/src/adapters/dealabs/dealabs.field-config.ts` (already deleted)
- Shared types (canonical output): `packages/shared-types/src/deals.ts` (`UniversalListing`, `DealabsData`, `VintedData`, `LeBonCoinData`)
- Shared config pattern: `packages/shared-config/src/` (model after `getRedisConfig()`)
- CLI service registry: `packages/cli/src/lib/constants.ts`
- Compose files: `docker-compose.dev.yml`, `docker-compose.test.yml`, `docker-compose.prod.yml`

---

### Phase 0 — Undo extractor-as-separate-service work (already done in Phase 1–3)

> These items clean up the now-obsolete `apps/extractor/` service and related wiring that was built before the architecture decision to collapse into the scraper. Skip any item already gone.

- [x] Delete `apps/extractor/` entirely
- [x] Remove `extractor` from `packages/cli/src/lib/constants.ts` (`ALL_APP_SERVICES`, `getServiceDefinitions()`)
- [x] Remove `extractor: 3005` from `packages/cli/src/commands/status.ts` `SERVICE_PORTS`
- [x] Remove `dev:extractor`, `start:extractor`, `test:extractor:unit`, `test:extractor:e2e` from root `package.json`
- [x] Remove `EXTRACTOR_URL`, `EXTRACTOR_TIMEOUT_MS` from `packages/shared-config/src/` (env schema + `getExtractorConfig()` helper)
- [x] Remove `ExtractRequest`, `ExtractResponse`, `ExtractMeta`, `ExtractorErrorCode` from `packages/shared-types/src/extractor.ts` (kept `SiteId`, `UniversalListing`, site data types which are still useful)
- [x] Remove the `ExtractorClientModule` import from `apps/scraper/src/scraper.module.ts` and remove `EXTRACTOR_URL`/`EXTRACTOR_TIMEOUT_MS` from its env schema
- [x] Delete `apps/scraper/src/extractor-client/` directory (all files)
- [x] Remove extractor health checker from `apps/scraper/src/health/` (the one that hit `GET {EXTRACTOR_URL}/health/ready`)
- [x] Remove `scraper-extractor` and `extractor-ollama` Docker networks from all three compose files; remove the containerized `extractor` service entries. Prod now uses `scraper-ollama` internal network directly between scraper and ollama.
- [x] Verify: `docker compose -f docker-compose.dev.yml config --quiet` green + same for `.test.yml` and `.prod.yml`
- [x] Verify: `pnpm --filter @dealscrapper/scraper build` green
- [x] Verify: `pnpm cli check types` — scraper/api/web/notifier all green; scheduler has pre-existing type errors in `test/factories/category.factory.ts` (unrelated to Phase 0)

---

### Phase 1 — Infra: Ollama in Docker Compose ✅

- [x] `docker-compose.dev.yml` — `ollama` service present (image `ollama/ollama:0.4.7`, port `127.0.0.1:11434:11434`, `ollama_data` volume, healthcheck).
- [x] `docker-compose.test.yml` — `ollama-test` service + `ollama-test-model-pull` sidecar present.
- [x] `docker-compose.prod.yml` — `ollama` on `scraper-ollama` internal network; scrapers join same network with `OLLAMA_URL: http://ollama:11434`.
- [x] `packages/cli/src/lib/constants.ts` — `'ollama-test'` in `INFRA_SERVICES`.
- [x] `packages/cli/src/commands/status.ts` — `'ollama-test'` in `INFRA_DISPLAY` (port 11435).
- [x] `packages/cli/src/commands/infra-start.ts` — health timeout already bumped.
- [x] `.env.example` — `OLLAMA_URL`, `OLLAMA_MODEL`, `LLM_CONCURRENCY`, `LLM_TIMEOUT_MS` present.
- [x] Verify: all three compose files `config --quiet` green.
- [ ] Verify: `pnpm cli infra start` brings Ollama up (requires Docker — manual check).

---

### Phase 2 — Shared config: Ollama vars ✅

- [x] `OLLAMA_URL`, `OLLAMA_MODEL`, `LLM_CONCURRENCY`, `LLM_TIMEOUT_MS` in `packages/shared-config/src/interfaces/config.interface.ts` (`OllamaConfig`, `DEFAULT_OLLAMA_CONFIG`).
- [x] `getOllamaConfig()` helper in `shared-config.service.ts`, exported from `index.ts`.
- [x] Add `OLLAMA_URL` / `OLLAMA_MODEL` / `LLM_CONCURRENCY` / `LLM_TIMEOUT_MS` to the scraper's `SharedConfigModule.forRoot` env schema in `apps/scraper/src/scraper.module.ts` (needed for Phase 3).
- [x] `pnpm --filter @dealscrapper/shared-config build` green.

---

### Phase 3 — LLM extraction core inside the scraper

All new files live under `apps/scraper/src/llm-extraction/`.

**Ollama client:**
- [x] Write `apps/scraper/src/llm-extraction/ollama/ollama.module.ts` — NestJS module, exports `OllamaService`.
- [x] Write `apps/scraper/src/llm-extraction/ollama/ollama.service.ts` — wraps `ollama` npm client (`new Ollama({ host: OLLAMA_URL })`). Exposes `generate({ system, prompt, format, signal }): Promise<string>`. One retry on JSON parse failure. Maps network errors → `OllamaUnavailableError`, timeouts → `OllamaTimeoutError`.
- [x] Write `apps/scraper/src/llm-extraction/ollama/ollama.errors.ts`.
- [x] Write `apps/scraper/src/llm-extraction/ollama/__tests__/ollama.service.spec.ts` — mock `ollama` npm client; cover happy path, bad-JSON retry, timeout, unavailable.

**HTML-to-Markdown:**
- [x] Write `apps/scraper/src/llm-extraction/html-to-markdown/html-to-markdown.module.ts`.
- [x] Write `apps/scraper/src/llm-extraction/html-to-markdown/html-to-markdown.service.ts` — two-stage: cheerio pre-clean (strip `script`, `style`, `svg`, `noscript`, `on*` attrs, base64 `src=`, tracking attrs) → `TurndownService` conversion (resolve relative URLs against `sourceUrl`, keep `alt`/`title`, drop classes/ids) → cap at 3500 chars.
- [x] Write `apps/scraper/src/llm-extraction/html-to-markdown/__tests__/html-to-markdown.service.spec.ts` — dirty-HTML fixtures, assert cleanup + structure preserved + abs URLs + size cap.

**Site interface & registry (no Zod):**
- [x] Write `apps/scraper/src/llm-extraction/sites/site.interface.ts` — `LlmSiteModule` interface: `{ siteId: SiteId; systemPrompt: string; buildUserPrompt(markdown: string): string; jsonSchema: object; validate(raw: unknown): UniversalListingFor<SiteId>; getExamples(): LlmExample[] }`. The `jsonSchema` field is a plain JSON Schema object. `validate` is a type-guard function that throws `LlmValidationError` on failure.
- [x] Write `apps/scraper/src/llm-extraction/sites/site.registry.ts` — `LlmSiteRegistry` NestJS service, registers all `LlmSiteModule`s via DI multi-provider, exposes `get(siteId)` throwing `UnknownSiteError`.
- [x] Write `apps/scraper/src/llm-extraction/sites/llm.errors.ts` — `UnknownSiteError`, `LlmValidationError`.

**Extraction orchestrator:**
- [x] Write `apps/scraper/src/llm-extraction/llm-extraction.module.ts` — imports `OllamaModule`, `HtmlToMarkdownModule`, registers site modules as multi-providers, exports `LlmExtractionService`.
- [x] Write `apps/scraper/src/llm-extraction/llm-extraction.service.ts` — orchestrates: site lookup → `htmlToMarkdown.prepare()` → build system + user prompt → `ollamaService.generate({ format: site.jsonSchema, ... })` → `JSON.parse(raw)` → `site.validate(parsed)` → return `UniversalListing`. Wraps Ollama call in a simple inline semaphore bounded by `LLM_CONCURRENCY` (default 2). Maps errors to structured types for callers.
- [x] Write `apps/scraper/src/llm-extraction/__tests__/llm-extraction.service.spec.ts` — `@nestjs/testing` TestingModule with mocked `OllamaService` and `HtmlToMarkdownService`; cover happy path, unknown site, validation failure, ollama down, timeout.

**Wire into scraper:**
- [x] Import `LlmExtractionModule` in `apps/scraper/src/scraper.module.ts`.
- [x] Register Ollama health checker in `apps/scraper/src/health/` — calls `OllamaService.list()`, reports `healthy` if model present, `degraded` if reachable but model missing, `unhealthy` if unreachable.
- [x] Add `ollama` as a dep to `apps/scraper/package.json` (`pnpm --filter @dealscrapper/scraper add ollama`).
- [x] Add `turndown` + `@types/turndown` to `apps/scraper/package.json` if not already present.

**Validate:**
- [x] `pnpm --filter @dealscrapper/scraper build` — green.
- [x] `pnpm --filter @dealscrapper/scraper test` — new unit tests green.

---

### Phase 4 — Pilot site: Dealabs

**LLM side (`apps/scraper/src/llm-extraction/sites/dealabs/`):**
- [x] Capture 3 real Dealabs listing HTML snippets (attach temporary logger in the adapter to dump `$.html($element)` for the first 3 listings, copy them out).
- [x] Write `apps/scraper/src/llm-extraction/sites/dealabs/dealabs.schema.ts` — exports `DEALABS_JSON_SCHEMA: object` (plain JSON Schema), and `validateDealabsListing(raw: unknown): UniversalListing & { dealabs: DealabsData }` type-guard function. Required fields: `externalId`, `title`, `url`, `currentPrice` (nullable int), `originalPrice` (nullable int), `merchant` (nullable), `publishedAt` (nullable ISO 8601), `temperature` (nullable int), `commentCount` (nullable int), `description` (nullable), `imageUrl` (nullable URL). Throws `LlmValidationError` if a required key is missing or a type assertion fails.
- [x] Write `apps/scraper/src/llm-extraction/sites/dealabs/dealabs.prompt.ts` — `DEALABS_SYSTEM_PROMPT` and `buildDealabsUserPrompt(markdown, examples)`.
- [x] Save `apps/scraper/src/llm-extraction/sites/dealabs/fixtures/dealabs-001.html` + `dealabs-001.expected.json`.
- [x] Save `apps/scraper/src/llm-extraction/sites/dealabs/fixtures/dealabs-002.html` + `dealabs-002.expected.json`.
- [x] Save `apps/scraper/src/llm-extraction/sites/dealabs/fixtures/dealabs-003.html` + `dealabs-003.expected.json`.
- [x] Write `apps/scraper/src/llm-extraction/sites/dealabs/fixtures/index.ts` — loads all `*.html` + matching `*.expected.json` at import, runs each expected through `validateDealabsListing` (throws at startup if fixture is invalid), exposes `getDealabsExamples(n)`.
- [x] Write `apps/scraper/src/llm-extraction/sites/dealabs/dealabs.site.ts` — implements `LlmSiteModule`, wires together `siteId`, `systemPrompt`, `buildUserPrompt`, `jsonSchema`, `validate`, `getExamples`.
- [x] Register `DealabsSite` as an `LlmSiteModule` multi-provider in `LlmExtractionModule`.
- [x] Write `apps/scraper/src/llm-extraction/sites/dealabs/__tests__/dealabs.live.spec.ts` — gated behind `LLM_TESTS=1`; for each fixture runs the full pipeline against live Ollama; asserts `validate` passes + required fields non-null + numeric bounds sane.

**Scraper adapter side:**
- [x] Edit `apps/scraper/src/adapters/dealabs/dealabs.adapter.ts` — inject `LlmExtractionService`, replace `this.fieldExtractor.extract(...)` call with `await this.llmExtraction.extract({ siteId: 'dealabs', listingHtml: $.html($element), sourceUrl })`. Normalization to `UniversalListing` + `DealabsData` stays.
- [x] Edit `apps/scraper/src/adapters/dealabs/dealabs.adapter.spec.ts` — mock `LlmExtractionService.extract`, assert adapter normalization still works.
- [x] Confirm `apps/scraper/src/adapters/dealabs/dealabs.field-config.ts` is already deleted (done in earlier work); grep for any remaining imports.

**Validation (Dealabs pilot):**
- [x] `pnpm --filter @dealscrapper/scraper test` — unit tests green (pre-existing failures in vinted/leboncoin/field-extractor unchanged).
- [x] `pnpm cli build --service scraper` — green.
- [x] `pnpm cli check types` — green on new files; pre-existing errors in vinted/leboncoin adapter specs unchanged.
- [x] Per-site validator unit tests (`dealabs.schema.spec.ts`, `vinted.schema.spec.ts`, `leboncoin.schema.spec.ts`) cover happy path, nullable propagation (no fabricated defaults), and `LlmValidationError` cases.
- [ ] `pnpm cli check types` + `pnpm cli check lint` — green across workspace.
- [ ] `LLM_TESTS=1 pnpm --filter @dealscrapper/scraper test` — live-Ollama fixture tests green (requires ollama up + model pulled).
- [ ] Manual sanity: `pnpm cli services start --env dev`, then trigger a Dealabs scrape; `pnpm cli logs scraper --follow` shows listings extracted with LLM latency logs.
- [ ] `curl http://localhost:3002/health` — scraper reports `ollama: healthy`.

---

### Phase 5 — Vinted

- [x] Capture 3 real Vinted listing fixtures.
- [x] Create `apps/scraper/src/llm-extraction/sites/vinted/` — `vinted.schema.ts` (plain JSON Schema + `validateVintedListing`), `vinted.prompt.ts`, `vinted.site.ts`, `fixtures/` (3 pairs + `index.ts`).
- [x] Register `VintedSite` in `LlmExtractionModule`.
- [x] Write `vinted.live.spec.ts` (gated behind `LLM_TESTS=1`).
- [x] Edit `apps/scraper/src/adapters/vinted/vinted.adapter.ts` — swap extraction call to `LlmExtractionService`.
- [x] Edit `vinted.adapter.spec.ts` — mock `LlmExtractionService`.
- [x] Delete `apps/scraper/src/adapters/vinted/vinted.field-config.ts` if it exists.
- [x] Run unit + type + lint checks.

---

### Phase 6 — LeBonCoin

- [x] Capture 3 real LeBonCoin listing fixtures.
- [x] Create `apps/scraper/src/llm-extraction/sites/leboncoin/` — same structure.
- [x] Register `LeBonCoinSite` in `LlmExtractionModule`.
- [x] Write `leboncoin.live.spec.ts` (gated).
- [x] Edit `apps/scraper/src/adapters/leboncoin/leboncoin.adapter.ts` — swap extraction call. Fixed `getListingSelector()` bug: was `article[data-qa-id="aditem_container"]`, now `[data-qa-id="aditem_container"]`.
- [x] Edit `leboncoin.adapter.spec.ts`.
- [x] Delete `apps/scraper/src/adapters/leboncoin/leboncoin.field-config.ts` if it exists.
- [x] Run unit + type + lint checks.

---

### Phase 7 — Cleanup sweep

- [x] Delete `apps/scraper/src/field-extraction/field-extractor.service.ts`.
- [x] Delete `apps/scraper/src/field-extraction/field-mapping-config.interface.ts`.
- [x] Delete `apps/scraper/src/field-extraction/` tests.
- [x] Grep for any remaining imports of `FieldExtractorService` / `FieldMappingConfig` — clean up.
- [x] Ensure `apps/extractor/` is fully gone (Phase 0 follow-up).
- [ ] Run `pnpm cli check all --fix` — green across workspace.
- [ ] Run `pnpm cli test complete` — full suite green.
- [ ] Update `.claude/memories/service-scraper/` to reflect the new LLM extraction flow.
- [ ] Create `.claude/memories/general/techd-llm-extraction-architecture.md` documenting the collapsed architecture.

---

## Service topology (post-collapse)

```
┌─────────────────────────────────────────────────┐
│  scraper (NestJS, Port 3002)                    │
│                                                 │
│  PuppeteerPool → Adapter → LlmExtractionService │
│                               │                 │
│                          OllamaService          │
└───────────────────────────────┼─────────────────┘
                                │
                    direct HTTP (11434)
                                │
                        ┌───────▼──────┐
                        │    ollama    │
                        │  qwen2.5:3b  │
                        └──────────────┘
```

In prod, `ollama` is on a `scraper-ollama` internal network. In dev/test it's `127.0.0.1:11434` (dev) / `127.0.0.1:11435` (test).

---

## New directory layout (inside scraper)

```
apps/scraper/src/llm-extraction/
├── llm-extraction.module.ts       # root module, exports LlmExtractionService
├── llm-extraction.service.ts      # orchestrator + semaphore
├── __tests__/
│   └── llm-extraction.service.spec.ts
├── ollama/
│   ├── ollama.module.ts
│   ├── ollama.service.ts          # wraps npm `ollama` client
│   ├── ollama.errors.ts
│   └── __tests__/ollama.service.spec.ts
├── html-to-markdown/
│   ├── html-to-markdown.module.ts
│   ├── html-to-markdown.service.ts
│   └── __tests__/html-to-markdown.service.spec.ts
└── sites/
    ├── site.interface.ts          # LlmSiteModule interface
    ├── site.registry.ts           # LlmSiteRegistry
    ├── llm.errors.ts              # UnknownSiteError, LlmValidationError
    ├── dealabs/
    │   ├── dealabs.schema.ts      # plain JSON Schema + validate fn
    │   ├── dealabs.prompt.ts
    │   ├── dealabs.site.ts
    │   ├── fixtures/
    │   │   ├── index.ts
    │   │   ├── dealabs-001.html + .expected.json
    │   │   ├── dealabs-002.html + .expected.json
    │   │   └── dealabs-003.html + .expected.json
    │   └── __tests__/dealabs.live.spec.ts   # LLM_TESTS=1 gated
    ├── vinted/...
    └── leboncoin/...
```

---

## Schema validation approach (no Zod)

Per-site schema pattern — two exports per site:

```ts
// dealabs.schema.ts
import type { UniversalListing } from '@dealscrapper/shared-types';
import type { DealabsData } from '@dealscrapper/shared-types';
import { LlmValidationError } from '../llm.errors';

export const DEALABS_JSON_SCHEMA = {
  type: 'object',
  required: ['externalId', 'title', 'url'],
  properties: {
    externalId:    { type: 'string' },
    title:         { type: 'string' },
    description:   { type: ['string', 'null'] },
    url:           { type: 'string' },
    imageUrl:      { type: ['string', 'null'] },
    currentPrice:  { type: ['integer', 'null'] },
    originalPrice: { type: ['integer', 'null'] },
    merchant:      { type: ['string', 'null'] },
    publishedAt:   { type: ['string', 'null'] },
    temperature:   { type: ['integer', 'null'] },
    commentCount:  { type: ['integer', 'null'] },
  },
  additionalProperties: false,
} as const;

type DealabsLlmOutput = UniversalListing & { dealabs: DealabsData };

export function validateDealabsListing(raw: unknown): DealabsLlmOutput {
  if (typeof raw !== 'object' || raw === null) throw new LlmValidationError('not an object');
  const r = raw as Record<string, unknown>;
  if (typeof r.externalId !== 'string') throw new LlmValidationError('missing externalId');
  if (typeof r.title !== 'string')      throw new LlmValidationError('missing title');
  if (typeof r.url !== 'string')        throw new LlmValidationError('missing url');
  // ... remaining field assertions
  return r as unknown as DealabsLlmOutput;
}
```

The `DEALABS_JSON_SCHEMA` object is passed as-is to Ollama's `format` parameter. No schema library needed at runtime.

---

## Internal flow (`llm-extraction.service.ts`)

```ts
async extract(req: { siteId: SiteId; listingHtml: string; sourceUrl: string }): Promise<UniversalListing> {
  const site = this.registry.get(req.siteId);               // → UnknownSiteError
  const markdown = this.htmlToMarkdown.prepare(req.listingHtml, req.sourceUrl);
  const system = site.systemPrompt;
  const user = site.buildUserPrompt(markdown);
  const started = Date.now();
  const raw = await this.semaphore.run(() =>
    this.ollama.generate({
      system,
      prompt: user,
      format: site.jsonSchema,
      options: { temperature: 0, num_ctx: 8192 },
    })
  );                                                         // → OllamaUnavailable/Timeout
  const parsed = JSON.parse(raw);                            // → SyntaxError (retry once)
  return site.validate(parsed);                              // → LlmValidationError
}
```

The semaphore is an inline promise queue bounded by `LLM_CONCURRENCY` (default 2).

---

## Testing strategy

1. **`ollama.service.spec.ts`** — mock `ollama` npm client; happy path, bad-JSON retry, timeout → `OllamaTimeoutError`, connection error → `OllamaUnavailableError`.
2. **`html-to-markdown.service.spec.ts`** — dirty-HTML fixtures; assert scripts/styles gone, headings/links/prices preserved, relative URLs resolved, output under size cap.
3. **`llm-extraction.service.spec.ts`** — `@nestjs/testing` TestingModule with mocked `OllamaService`, `HtmlToMarkdownService`, `LlmSiteRegistry`; cover happy path, unknown site, validation failure, ollama down, timeout.
4. **Adapter unit tests** — for each adapter, mock `LlmExtractionService.extract`, verify normalization to `UniversalListing` + site extension.
5. **Live-Ollama fixture tests** (`sites/<site>/__tests__/*.live.spec.ts`) — **gated behind `LLM_TESTS=1`**. For each fixture run full pipeline against real Ollama; assert `validate` passes, required fields non-null, numeric fields within sanity bounds. Do not assert exact strings.

`pnpm cli test unit` stays fast — live-Ollama tests are gated.
`LLM_TESTS=1 pnpm --filter @dealscrapper/scraper test` runs them when Ollama is up.

---

## Scraper env vars added

Via `apps/scraper/src/scraper.module.ts` `SharedConfigModule.forRoot`:

| Var | Required | Default |
|---|---|---|
| `OLLAMA_URL` | REQUIRED | — |
| `OLLAMA_MODEL` | OPTIONAL | `qwen2.5:3b-instruct` |
| `LLM_CONCURRENCY` | OPTIONAL | `2` |
| `LLM_TIMEOUT_MS` | OPTIONAL | `30000` |

---

## Open risks (flagged, not blocking)

- **CPU latency.** 3B on pure CPU is ~1–3s per listing. For a 60-listing category page that's 60–180s serialized. Knobs: raise `LLM_CONCURRENCY`, batch listings into one prompt, or downgrade to 1.5B.
- **Context window.** `num_ctx: 8192` with Markdown-formatted listings (~3500 chars cap) leaves room for system prompt + 2–3 few-shot pairs.
- **Markdown drops attribute hints.** Classes like `.price-sale` and `itemprop` attrs vanish. Fine for all current sites (prices render as visible text). If a future site needs attribute hints, extend `HtmlToMarkdownService` to accept a per-site callback that appends a `## Extracted attributes` block. Don't build until needed.
- **Prompt drift.** No dual-path fallback means a bad prompt edit can silently tank extraction quality. Mitigation: live-Ollama fixture tests gate every PR that touches `sites/<site>/`.
- **Ollama `format: <json_schema>` is a newer feature.** Pin `ollama/ollama` to a known-good tag (e.g. `0.4.x` or newer) in compose, not `:latest`.
- **Single point of failure.** Ollama down = scraping stalls. Scraper health check now reports `ollama` status directly, and a downed Ollama fails scrapes fast rather than producing garbage.
