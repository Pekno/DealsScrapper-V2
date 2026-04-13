---
name: add-site
description: "Step-by-step workflow for adding a new website/scraping target to DealsScrapper. Use this skill whenever the user wants to add support for a new site (e.g., Amazon, eBay, Rakuten, HotUKDeals), create a new scraper adapter, or asks 'how do I add a new site?'. This is a complex multi-service workflow that touches shared-types, scraper adapters, database schema, Elasticsearch, and frontend — this skill ensures nothing is missed."
argument-hint: "[site-name]"
---

# Add New Site Workflow

You are guiding the implementation of a new scraping target for DealsScrapper. This is a multi-service, multi-step workflow. The site name is: ``.

## Before You Start

1. Read the full guide at `ADDING_NEW_SITE.md` in the project root — it has the architecture diagram and complete code examples
2. Study an existing adapter as reference: read `apps/scraper/src/adapters/dealabs/` for a complete, working example
3. Ask the user about the target site:
   - What's the site URL?
   - What unique data fields does the site have? (e.g., temperature for Dealabs, rating for Amazon)
   - Does it require Puppeteer (dynamic JS content) or is static HTML sufficient?
   - Any known anti-scraping measures?

## Implementation Steps

Follow these steps IN ORDER. Each step should be delegated to the appropriate agent. Mark each step complete before moving on.

### Step 1: Add to SiteSource enum
**Owner: packages-expert agent**
- File: `packages/shared-types/src/site-source.ts`
- Add the new site to the `SiteSource` enum (lowercase, URL-safe value)

### Step 2: Define site-specific fields and table columns
**Owner: packages-expert agent**
- Create field definitions in `packages/shared-types/src/sites/field-definitions/`
- Create table column definitions in `packages/shared-types/src/sites/table-columns/`
- Export from the appropriate index files
- Look at existing sites (dealabs, vinted, leboncoin) for the pattern

### Step 3: Add site definition
**Owner: api-backend agent**
- File: `apps/api/src/sites/definitions/site.definitions.ts`
- Add to `SITE_DEFINITIONS` with: name, baseUrl, categoryDiscoveryUrl, color, iconUrl

### Step 4: Create the scraper adapter
**Owner: scraper-worker agent**
- Create directory: `apps/scraper/src/adapters/{site}/`
- Implement: `{site}.adapter.ts` (implements `ISiteAdapter`)
- Implement: `{site}.field-config.ts` (CSS selectors for field extraction)
- Optionally: `{site}.transformers.ts` for data transforms
- Register in `apps/scraper/src/adapters/adapters.module.ts`

### Step 5: Create category discovery adapter
**Owner: scraper-worker agent**
- Create: `apps/scraper/src/category-discovery/{site}/`
- Implement `ICategoryDiscoveryAdapter`
- Register in category discovery module and adapter registry

### Step 6: Create database extension table
**Owner: packages-expert agent**
- Add `Article{Site}` model to `packages/database/prisma/schema.prisma`
- Add relation from `Article` model
- Run migration: `pnpm cli db migrate`
- Regenerate client: `pnpm cli db generate`

### Step 7: Update ArticleWrapper
**Owner: packages-expert agent**
- Add extension type to `ArticleWithExtensions`
- Add case to `getExtension()` method
- Add to include config

### Step 8: Add Elasticsearch mapping
**Owner: scraper-worker agent**
- Add site-specific field mapping in `apps/scraper/src/elasticsearch/mappings/`

### Step 9: Write tests
**Owner: scraper-worker agent**
- Create: `apps/scraper/src/adapters/{site}/__tests__/{site}.adapter.spec.ts`
- Test: properties, URL building, category extraction, HTML validation
- Use a real HTML fixture if possible

### Step 10: Frontend integration (optional)
**Owner: web-frontend agent**
- Add extension type to frontend types if needed
- Create display components for site-specific badges/data

## Completion Checklist

Before reporting done, verify:
- [ ] SiteSource enum updated
- [ ] Field definitions and table columns created
- [ ] Site definition added to API
- [ ] Scraper adapter created and registered
- [ ] Category discovery adapter created and registered
- [ ] Database extension table with migration
- [ ] ArticleWrapper updated
- [ ] Elasticsearch mapping added
- [ ] Unit tests written and passing
- [ ] Types compile across all services (`pnpm cli check types`)
