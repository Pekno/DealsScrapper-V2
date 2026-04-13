# LeBonCoin E2E Test Plan

**Status**: Documented (Implementation Pending - Jest Config Resolution)

**Last Updated**: 2025-01-19

---

## Overview

This document outlines the comprehensive end-to-end (E2E) testing strategy for the LeBonCoin integration in the DealsScapper scraper service. Due to the current jest configuration issue, these tests are documented but not yet implemented.

---

## Test Scenarios

### 1. Full Scraping Flow

**Objective**: Verify the complete scraping pipeline for LeBonCoin listings

**Test Steps**:
1. Trigger scrape job via scheduler for a specific LeBonCoin category (e.g., "9" - Immobilier)
2. Verify job routes to `jobs-leboncoin` queue (not `jobs-vinted` or `jobs-dealabs`)
3. Verify `LeBonCoinScrapeProcessor` processes the job
4. Verify `LeBonCoinAdapter` extracts listings from the page
5. Verify Articles saved to database with proper structure
6. Verify `ArticleLeBonCoin` extensions created with site-specific data
7. Verify all LeBonCoin-specific fields populated correctly

**Expected Results**:
- Job completes successfully without errors
- All 20+ listings extracted from page
- Database records created:
  - `Article` table: Base article data
  - `ArticleLeBonCoin` table: LeBonCoin-specific extensions
  - `Category` relationship: Linked to correct category
- All required fields populated (no null values for required fields)

**Key Validations**:
```typescript
// Article validation
expect(article.source).toBe('leboncoin');
expect(article.externalId).toMatch(/^[0-9]+$/); // Numeric ID
expect(article.title).toBeTruthy();
expect(article.price).toBeGreaterThan(0);
expect(article.url).toContain('leboncoin.fr');

// ArticleLeBonCoin extension validation
expect(extension.city).toBeTruthy();
expect(extension.postcode).toMatch(/^[0-9]{5}$/); // French postcode
expect(extension.region).toBeTruthy();
expect(extension.categoryAttributes).toBeDefined(); // JSON field
```

---

### 2. Category Discovery Flow

**Objective**: Verify category discovery adapter finds all LeBonCoin categories

**Test Steps**:
1. Trigger category sync for LeBonCoin
2. Verify `LeBonCoinCategoryDiscoveryAdapter.discoverCategories()` executes
3. Verify categories discovered via one of three strategies:
   - Strategy 1: API endpoint
   - Strategy 2: Web scraping
   - Strategy 3: Database fallback
4. Verify hierarchy preserved (parent-child relationships)
5. Verify categories upserted to database
6. Verify tree structure correct (no circular references)

**Expected Results**:
- At least 47 categories discovered (10 main + 37 sub)
- Hierarchy structure preserved:
  - Level 1 categories: `parentSlug = null`
  - Level 2 categories: `parentSlug` points to valid parent
- All categories have:
  - Valid slug (numeric ID: "2", "9", "15", etc.)
  - Non-empty name
  - Valid sourceUrl
  - Correct source: "leboncoin"

**Key Validations**:
```typescript
const categories = await adapter.discoverCategories();

// Count validation
expect(categories.length).toBeGreaterThanOrEqual(47);

// Hierarchy validation
const mainCategories = categories.filter(c => c.parentSlug === null);
expect(mainCategories.length).toBeGreaterThanOrEqual(10);

const subCategories = categories.filter(c => c.parentSlug !== null);
expect(subCategories.length).toBeGreaterThanOrEqual(37);

// Structure validation
for (const cat of categories) {
  expect(cat.slug).toMatch(/^[0-9]+$/);
  expect(cat.name).toBeTruthy();
  expect(cat.url).toContain('leboncoin.fr');

  // Verify parent exists if parentSlug is set
  if (cat.parentSlug) {
    const parent = categories.find(c => c.slug === cat.parentSlug);
    expect(parent).toBeDefined();
  }
}
```

---

### 3. Queue Integration

**Objective**: Verify job routing to correct queue

**Test Steps**:
1. Distribute scrape job for LeBonCoin category
2. Verify job routes to `jobs-leboncoin` queue (not `jobs-vinted` or `jobs-dealabs`)
3. Verify `LeBonCoinScrapeProcessor` handles the job
4. Verify job completes successfully
5. Verify job status updated in database/queue

**Expected Results**:
- Job appears in `jobs-leboncoin` queue
- Job does NOT appear in other queues
- Processor picks up job within expected time
- Job completes with status: "completed"
- No jobs left in "failed" or "stuck" states

**Key Validations**:
```typescript
// Queue routing validation
const leboncoinQueue = await getQueue('jobs-leboncoin');
const jobs = await leboncoinQueue.getJobs(['waiting', 'active']);
expect(jobs.length).toBeGreaterThan(0);

const job = jobs.find(j => j.data.categoryId === '9');
expect(job).toBeDefined();
expect(job.name).toBe('scrape-leboncoin-category');

// Job completion validation
await job.waitUntilFinished(queueEvents);
expect(job.finishedOn).toBeDefined();
expect(job.failedReason).toBeUndefined();
```

---

### 4. Location Parsing

**Objective**: Verify location field extraction and parsing

**Test Scenarios**:

| Input Location String | Expected City | Expected Postcode | Expected Region |
|---|---|---|---|
| `"Paris 75001, Île-de-France"` | `"Paris"` | `"75001"` | `"Île-de-France"` |
| `"Lyon 69002, Auvergne-Rhône-Alpes"` | `"Lyon"` | `"69002"` | `"Auvergne-Rhône-Alpes"` |
| `"Marseille 13001, Provence-Alpes-Côte d'Azur"` | `"Marseille"` | `"13001"` | `"Provence-Alpes-Côte d'Azur"` |
| `"Bordeaux 33000"` | `"Bordeaux"` | `"33000"` | `null` (not provided) |
| `"75008 Paris"` | `"Paris"` | `"75008"` | `null` |
| `"Nice"` | `"Nice"` | `null` | `null` |

**Test Steps**:
1. Extract listing with various location formats
2. Verify location parsed correctly using `transformLocation()` transformer
3. Verify city, postcode, region extracted independently
4. Verify graceful handling of partial data

**Key Validations**:
```typescript
const transformer = transformers.location;

// Test standard format
const result1 = transformer('Paris 75001, Île-de-France');
expect(result1.city).toBe('Paris');
expect(result1.postcode).toBe('75001');
expect(result1.region).toBe('Île-de-France');

// Test partial format
const result2 = transformer('Bordeaux 33000');
expect(result2.city).toBe('Bordeaux');
expect(result2.postcode).toBe('33000');
expect(result2.region).toBeNull();

// Test city only
const result3 = transformer('Nice');
expect(result3.city).toBe('Nice');
expect(result3.postcode).toBeNull();
expect(result3.region).toBeNull();
```

---

### 5. Category Attributes (JSON Field)

**Objective**: Verify category-specific attributes extracted correctly

**Test Scenarios**:

#### 5.1: Real Estate Listing (Immobilier)
```typescript
const realEstateAttributes = {
  rooms: 3,
  surface: 65, // m²
  propertyType: 'apartment',
  floor: 2,
  furnished: false,
  energyClass: 'C'
};

// Validation
expect(extension.categoryAttributes).toEqual(
  expect.objectContaining({
    rooms: expect.any(Number),
    surface: expect.any(Number),
    propertyType: expect.stringMatching(/apartment|house|studio/)
  })
);
```

#### 5.2: Vehicle Listing (Véhicules)
```typescript
const vehicleAttributes = {
  mileage: 85000, // km
  year: 2018,
  fuel: 'diesel',
  transmission: 'manual',
  horsepower: 110,
  doors: 5
};

// Validation
expect(extension.categoryAttributes).toEqual(
  expect.objectContaining({
    mileage: expect.any(Number),
    year: expect.any(Number),
    fuel: expect.stringMatching(/diesel|gasoline|electric|hybrid/)
  })
);
```

#### 5.3: Electronics Listing (Multimédia)
```typescript
const electronicsAttributes = {
  brand: 'Apple',
  model: 'iPhone 13',
  storage: '128GB',
  condition: 'good',
  warranty: false
};

// Validation
expect(extension.categoryAttributes).toEqual(
  expect.objectContaining({
    brand: expect.any(String),
    model: expect.any(String),
    condition: expect.stringMatching(/new|good|fair|poor/)
  })
);
```

---

### 6. Error Handling and Retry Logic

**Objective**: Verify robust error handling

**Test Scenarios**:

#### 6.1: Network Timeout
- Simulate network timeout during scraping
- Verify job retries (up to 3 attempts)
- Verify backoff delay applied
- Verify final failure logged correctly

#### 6.2: Invalid Listing Data
- Encounter listing with missing required fields
- Verify validation fails gracefully
- Verify listing skipped (not saved to database)
- Verify scraping continues for other listings

#### 6.3: Database Connection Lost
- Simulate database connection failure
- Verify job pauses and retries
- Verify no data loss
- Verify recovery after reconnection

**Key Validations**:
```typescript
// Retry logic validation
const job = await queue.getJob(jobId);
expect(job.attemptsMade).toBeLessThanOrEqual(3);
expect(job.failedReason).toContain('timeout');

// Error logging validation
const logs = await getJobLogs(jobId);
expect(logs).toContain('Retrying scrape job');
expect(logs).toContain('Attempt 2 of 3');
```

---

### 7. Performance and Load Testing

**Objective**: Verify system handles expected load

**Test Scenarios**:

#### 7.1: Concurrent Scraping
- Queue 10 LeBonCoin category jobs simultaneously
- Verify all jobs complete successfully
- Verify no race conditions
- Verify database integrity maintained

#### 7.2: Large Category Scraping
- Scrape category with 100+ listings
- Verify all listings extracted
- Verify pagination handled correctly
- Verify memory usage stays within limits

#### 7.3: Rate Limiting
- Verify rate limiting applied to LeBonCoin requests
- Verify delays between requests (e.g., 1-2 seconds)
- Verify no IP bans or blocks

**Key Validations**:
```typescript
// Concurrent jobs validation
const jobs = await Promise.all([
  queueJob({ categoryId: '2' }), // Véhicules
  queueJob({ categoryId: '9' }), // Immobilier
  queueJob({ categoryId: '15' }), // Mode
  // ... 7 more
]);

await Promise.all(jobs.map(j => j.waitUntilFinished()));

const completedCount = jobs.filter(j => j.isCompleted()).length;
expect(completedCount).toBe(10);
```

---

## Test Data Setup

### Database Seeding
```bash
# Seed LeBonCoin categories
pnpm exec tsx packages/database/prisma/seed-leboncoin-categories.ts

# Verify seeding
psql $DATABASE_URL -c "SELECT COUNT(*) FROM categories WHERE source = 'leboncoin';"
# Expected: 47
```

### Test Fixtures
- HTML fixture files located at: `apps/scraper/test/fixtures/leboncoin/`
- Sample listing HTML: `leboncoin-listing-sample.html` (0.78 MB)
- Sample category page: `leboncoin-category-page.html`

---

## Implementation Status

### Completed
- [x] Test plan documented
- [x] Test scenarios defined
- [x] Validation criteria established
- [x] Test data requirements identified

### Pending (Blocked by Jest Config Issue)
- [ ] Implement E2E test suite
- [ ] Set up test database
- [ ] Create test fixtures
- [ ] Configure test runner
- [ ] Add CI/CD integration

---

## Manual Verification

Until E2E tests are implemented, perform manual verification:

### Checklist
- [ ] Run seed script: `pnpm exec tsx packages/database/prisma/seed-leboncoin-categories.ts`
- [ ] Verify 47 categories in database
- [ ] Test category discovery adapter manually
- [ ] Extract sample listing with real HTML
- [ ] Verify all fields populated correctly
- [ ] Verify location parsing works with various formats
- [ ] Verify category attributes stored as JSON
- [ ] Check queue routing (inspect Redis)

---

## Notes

1. **Jest Configuration Issue**: The scraper service currently has a jest configuration issue preventing test execution. Once resolved, implement the tests defined in this plan.

2. **Test Fixtures**: Real LeBonCoin HTML fixtures have been collected and analyzed. These should be used for testing to ensure realistic scenarios.

3. **Rate Limiting**: LeBonCoin may have strict rate limiting. E2E tests should use mocked responses where possible to avoid hitting live site.

4. **Authentication**: Some LeBonCoin features may require authentication. Document any auth requirements for future testing.

5. **Dynamic Content**: LeBonCoin uses JavaScript for dynamic content loading. Puppeteer-based tests may be required instead of simple HTTP requests.

---

## Future Improvements

- Add visual regression testing for scraper UI (if any)
- Add performance benchmarks (scraping speed, memory usage)
- Add integration tests with other services (API, Notifier)
- Add smoke tests for production deployments
- Add monitoring and alerting for scraping failures

---

**End of E2E Test Plan**
