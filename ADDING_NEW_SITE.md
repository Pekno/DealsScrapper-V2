# Adding a New Site to DealsScrapper

This guide explains how to add support for a new website (e.g., Amazon, eBay, Rakuten) to the DealsScrapper platform. Follow these steps in order to ensure proper integration across all services.

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Step 1: Add Site to SiteSource Enum](#step-1-add-site-to-sitesource-enum)
4. [Step 2: Add Site Definition](#step-2-add-site-definition)
5. [Step 3: Create Site Adapter](#step-3-create-site-adapter)
6. [Step 4: Define Site-Specific Fields](#step-4-define-site-specific-fields)
7. [Step 5: Add Filter Field Definitions](#step-5-add-filter-field-definitions)
8. [Step 6: Create Database Extension Table](#step-6-create-database-extension-table)
9. [Step 7: Update ArticleWrapper](#step-7-update-articlewrapper)
10. [Step 8: Add Elasticsearch Mapping](#step-8-add-elasticsearch-mapping)
11. [Step 9: Testing](#step-9-testing)
12. [Step 10: Frontend Integration](#step-10-frontend-integration)
13. [Checklist](#checklist)

---

## Overview

DealsScrapper uses a **multi-site architecture** where each site has:

- **Site Adapter**: Scrapes and extracts data from the website
- **Site-Specific Extension Table**: Stores unique fields (e.g., temperature for Dealabs, brand for Vinted)
- **Filter Field Definitions**: Defines which fields users can filter on
- **ArticleWrapper**: Unified access pattern for articles with their extensions

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        SITE ADDITION FLOW                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. SiteSource Enum ──► 2. Site Definition ──► 3. Site Adapter  │
│         │                       │                     │          │
│         ▼                       ▼                     ▼          │
│  shared-types/           api/sites/            scraper/adapters/ │
│  site-source.ts          definitions/          {site}/           │
│                                                                  │
│  4. Field Definitions ──► 5. Filter Rules ──► 6. DB Extension   │
│         │                       │                     │          │
│         ▼                       ▼                     ▼          │
│  shared-types/sites/     shared-types/sites/   database/schema   │
│  {site}/fields.ts        {site}/filter-rules.ts                  │
│                                                                  │
│  7. ArticleWrapper ──► 8. Elasticsearch ──► 9. Tests            │
│         │                       │                     │          │
│         ▼                       ▼                     ▼          │
│  shared-types/article/   scraper/elasticsearch/ scraper/test/    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Prerequisites

Before adding a new site, ensure you understand:

- The target website's HTML structure
- What unique data fields the site provides
- Rate limiting and scraping policies of the target site
- TypeScript and NestJS patterns used in this project

---

## Step 1: Add Site to SiteSource Enum

**File**: `packages/shared-types/src/site-source.ts`

Add the new site to the `SiteSource` enum:

```typescript
/**
 * Supported site sources for the scraper
 * Each site has its own adapter and extension table
 */
export enum SiteSource {
  DEALABS = 'dealabs',
  VINTED = 'vinted',
  LEBONCOIN = 'leboncoin',
  // Add your new site here:
  AMAZON = 'amazon',
}
```

**Important**: The enum value should be:
- Lowercase
- URL-safe (no spaces or special characters)
- Match the database Site.id exactly

---

## Step 2: Add Site Definition

**File**: `apps/api/src/sites/definitions/site.definitions.ts`

Add the site configuration to `SITE_DEFINITIONS`:

```typescript
export const SITE_DEFINITIONS: Record<string, SiteDefinition> = {
  // ... existing sites ...

  amazon: {
    name: 'Amazon',                                    // Display name
    baseUrl: 'https://www.amazon.fr',                  // Homepage URL
    categoryDiscoveryUrl: 'https://www.amazon.fr/gp/browse.html', // Category listing URL
    color: '#FF9900',                                  // Brand color (hex)
    iconUrl: 'https://example.com/amazon-icon.png',   // Optional icon URL
  },
} as const;
```

**What happens automatically**:
- On API startup, `SiteSyncService` upserts this to the database
- The `Site` record is created with `baseUrl` and `categoryDiscoveryUrl`
- No manual database migration needed for the Site record itself

---

## Step 3: Create Site Adapter

Create a new directory for your site adapter:

```
apps/scraper/src/adapters/
├── amazon/                          # New site directory
│   ├── amazon.adapter.ts            # Main adapter class
│   ├── amazon.field-config.ts       # Field extraction configuration
│   ├── amazon.url-optimizer.ts      # URL optimization (optional)
│   └── __tests__/
│       └── amazon.adapter.spec.ts   # Unit tests
```

### 3.1 Create the Adapter Class

**File**: `apps/scraper/src/adapters/amazon/amazon.adapter.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';
import * as cheerio from 'cheerio';
import type { CheerioAPI, Cheerio } from 'cheerio';
import type { Element } from 'domhandler';
import { SiteSource } from '@dealscrapper/shared-types';
import type {
  ISiteAdapter,
  UniversalListing,
} from '../base/site-adapter.interface.js';
import { FieldExtractorService } from '../../field-extraction/field-extractor.service.js';
import { amazonFieldConfig } from './amazon.field-config.js';

// Define site-specific data interface
export interface AmazonData {
  type: typeof SiteSource.AMAZON;
  rating: number | null;           // Product rating (1-5)
  reviewCount: number;             // Number of reviews
  isPrime: boolean;                // Prime eligible
  seller: string | null;           // Seller name
  fulfillment: string | null;      // FBA, FBM, etc.
  stockStatus: string | null;      // In stock, limited, etc.
  couponDiscount: number | null;   // Coupon discount percentage
}

@Injectable()
export class AmazonAdapter implements ISiteAdapter {
  // Required properties from ISiteAdapter
  readonly siteId = SiteSource.AMAZON;
  readonly baseUrl = 'https://www.amazon.fr';
  readonly displayName = 'Amazon';
  readonly colorCode = '#FF9900';

  private readonly logger = new Logger(AmazonAdapter.name);

  constructor(
    private readonly fieldExtractor: FieldExtractorService,
  ) {}

  /**
   * Extracts listings from Amazon HTML page
   */
  extractListings(html: string, sourceUrl: string): UniversalListing[] {
    this.validateHtml(html);

    const $ = cheerio.load(html);
    const selector = this.getListingSelector();
    const listings: UniversalListing[] = [];

    $(selector).each((index, element) => {
      try {
        const listing = this.extractSingleListing($, $(element), sourceUrl);
        if (listing) {
          listings.push(listing);
        }
      } catch (error) {
        this.logger.warn(`Failed to extract listing [${index}]: ${error}`);
      }
    });

    return listings;
  }

  /**
   * Extracts a single listing from an HTML element
   */
  private extractSingleListing(
    $: CheerioAPI,
    $element: Cheerio<Element>,
    sourceUrl: string,
  ): UniversalListing | null {
    // Extract common fields using field extractor
    const fields = this.fieldExtractor.extractFields($, $element, amazonFieldConfig);

    if (!fields.externalId || !fields.title) {
      return null; // Skip invalid listings
    }

    // Build site-specific data
    const siteSpecificData: AmazonData = {
      type: SiteSource.AMAZON,
      rating: this.extractRating($, $element),
      reviewCount: this.extractReviewCount($, $element),
      isPrime: this.extractIsPrime($, $element),
      seller: fields.seller || null,
      fulfillment: this.extractFulfillment($, $element),
      stockStatus: this.extractStockStatus($, $element),
      couponDiscount: this.extractCouponDiscount($, $element),
    };

    return {
      externalId: fields.externalId,
      title: fields.title,
      description: fields.description || null,
      url: this.buildProductUrl(fields.externalId),
      imageUrl: fields.imageUrl || null,
      siteId: this.siteId,
      currentPrice: fields.currentPrice || null,
      originalPrice: fields.originalPrice || null,
      merchant: fields.merchant || 'Amazon',
      location: null,
      publishedAt: new Date(),
      isActive: true,
      categorySlug: this.extractCategorySlug(sourceUrl),
      siteSpecificData,
    };
  }

  /**
   * Builds category URL for scraping
   */
  buildCategoryUrl(categorySlug: string, page: number = 1): string {
    return `${this.baseUrl}/s?rh=n%3A${categorySlug}&page=${page}`;
  }

  /**
   * Extracts category slug from URL
   */
  extractCategorySlug(url: string): string {
    const match = url.match(/n[=:](\d+)/);
    return match ? match[1] : 'unknown';
  }

  /**
   * Returns CSS selector for listing elements
   */
  getListingSelector(): string {
    return '[data-component-type="s-search-result"]';
  }

  /**
   * Extracts total element count from page
   */
  extractElementCount(html: string): number | undefined {
    const $ = cheerio.load(html);
    const countText = $('.s-result-count').text();
    const match = countText.match(/(\d+)\s+résultats/);
    return match ? parseInt(match[1], 10) : undefined;
  }

  /**
   * Validates HTML structure
   */
  validateHtml(html: string): void {
    if (!html || html.length < 1000) {
      throw new Error('Invalid or empty HTML content');
    }
    if (html.includes('captcha') || html.includes('robot')) {
      throw new Error('Captcha detected - request blocked');
    }
  }

  // Site-specific extraction methods
  private extractRating($: CheerioAPI, $el: Cheerio<Element>): number | null {
    const ratingText = $el.find('.a-icon-star-small .a-icon-alt').text();
    const match = ratingText.match(/([\d,]+)\s+sur\s+5/);
    return match ? parseFloat(match[1].replace(',', '.')) : null;
  }

  private extractReviewCount($: CheerioAPI, $el: Cheerio<Element>): number {
    const countText = $el.find('.a-size-base.s-underline-text').text();
    return parseInt(countText.replace(/\s/g, ''), 10) || 0;
  }

  private extractIsPrime($: CheerioAPI, $el: Cheerio<Element>): boolean {
    return $el.find('.s-prime').length > 0;
  }

  private extractFulfillment($: CheerioAPI, $el: Cheerio<Element>): string | null {
    if ($el.find('[aria-label*="Expédié par Amazon"]').length > 0) {
      return 'FBA';
    }
    return 'FBM';
  }

  private extractStockStatus($: CheerioAPI, $el: Cheerio<Element>): string | null {
    const stockText = $el.find('.a-color-price').text();
    if (stockText.includes('En stock')) return 'in_stock';
    if (stockText.includes('Plus que')) return 'limited';
    if (stockText.includes('Indisponible')) return 'out_of_stock';
    return null;
  }

  private extractCouponDiscount($: CheerioAPI, $el: Cheerio<Element>): number | null {
    const couponText = $el.find('.s-coupon-clipped, .s-coupon-unclipped').text();
    const match = couponText.match(/(\d+)\s*%/);
    return match ? parseInt(match[1], 10) : null;
  }

  private buildProductUrl(asin: string): string {
    return `${this.baseUrl}/dp/${asin}`;
  }
}
```

### 3.2 Create Field Configuration

**File**: `apps/scraper/src/adapters/amazon/amazon.field-config.ts`

```typescript
import type { FieldExtractionConfig } from '../../field-extraction/field-extractor.service.js';

/**
 * Field extraction configuration for Amazon listings
 * Maps CSS selectors to data fields
 */
export const amazonFieldConfig: FieldExtractionConfig = {
  externalId: {
    selector: '[data-asin]',
    attribute: 'data-asin',
  },
  title: {
    selector: 'h2 a span',
    type: 'text',
  },
  currentPrice: {
    selector: '.a-price .a-offscreen',
    type: 'price',
    transform: (value) => {
      const match = value.match(/([\d,]+)/);
      return match ? parseFloat(match[1].replace(',', '.')) : null;
    },
  },
  originalPrice: {
    selector: '.a-price[data-a-strike] .a-offscreen',
    type: 'price',
    transform: (value) => {
      const match = value.match(/([\d,]+)/);
      return match ? parseFloat(match[1].replace(',', '.')) : null;
    },
  },
  imageUrl: {
    selector: '.s-image',
    attribute: 'src',
  },
  merchant: {
    selector: '.a-size-small .a-color-secondary',
    type: 'text',
  },
};
```

### 3.3 Create Category Discovery Adapter

Create a category discovery adapter to discover available categories from the site.

**File**: `apps/scraper/src/category-discovery/amazon/amazon-category-discovery.adapter.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { SiteSource } from '@dealscrapper/shared-types';
import type {
  ICategoryDiscoveryAdapter,
  CategoryMetadata,
  CategoryNode,
} from '../base/category-discovery-adapter.interface.js';

const AMAZON_DISCOVERY_CONFIG = {
  BASE_URL: 'https://www.amazon.fr',
  CATEGORIES_URL: 'https://www.amazon.fr/gp/browse.html',
  REQUEST_TIMEOUT_MS: 30000,
  MAX_CATEGORY_NAME_LENGTH: 100,
} as const;

@Injectable()
export class AmazonCategoryDiscoveryAdapter implements ICategoryDiscoveryAdapter {
  readonly siteId = SiteSource.AMAZON;
  readonly baseUrl = AMAZON_DISCOVERY_CONFIG.BASE_URL;

  private readonly logger = new Logger(AmazonCategoryDiscoveryAdapter.name);

  /**
   * Discovers all categories from Amazon
   */
  async discoverCategories(): Promise<CategoryMetadata[]> {
    this.logger.log('🔍 Starting Amazon category discovery...');

    const response = await axios.get(AMAZON_DISCOVERY_CONFIG.CATEGORIES_URL, {
      timeout: AMAZON_DISCOVERY_CONFIG.REQUEST_TIMEOUT_MS,
    });

    const $ = cheerio.load(response.data);
    const categories: CategoryMetadata[] = [];

    // Extract categories from navigation
    $('a[href*="/b?node="]').each((_, element) => {
      const $el = $(element);
      const href = $el.attr('href') || '';
      const name = $el.text().trim();

      if (name && href) {
        const slug = this.extractSlugFromUrl(href);
        if (slug) {
          categories.push({
            slug,
            name: this.cleanCategoryName(name),
            url: href.startsWith('http') ? href : `${this.baseUrl}${href}`,
            parentId: null,
          });
        }
      }
    });

    this.logger.log(`✅ Amazon discovery completed: ${categories.length} categories`);
    return this.deduplicateCategories(categories);
  }

  /**
   * Builds hierarchical category tree
   */
  async buildCategoryTree(): Promise<CategoryNode[]> {
    const categories = await this.discoverCategories();
    return categories.map((cat) => ({ ...cat, children: [] }));
  }

  private extractSlugFromUrl(url: string): string | null {
    const match = url.match(/node[=:](\d+)/);
    return match ? match[1] : null;
  }

  private cleanCategoryName(name: string): string {
    return name
      .trim()
      .replace(/\s+/g, ' ')
      .substring(0, AMAZON_DISCOVERY_CONFIG.MAX_CATEGORY_NAME_LENGTH);
  }

  private deduplicateCategories(categories: CategoryMetadata[]): CategoryMetadata[] {
    return categories.filter(
      (cat, index, arr) => arr.findIndex((c) => c.slug === cat.slug) === index
    );
  }
}
```

### 3.4 Register the Category Discovery Adapter

**File**: `apps/scraper/src/category-discovery/category-discovery.module.ts`

```typescript
import { AmazonCategoryDiscoveryAdapter } from './amazon/amazon-category-discovery.adapter.js';

@Module({
  providers: [
    // ... existing adapters ...
    AmazonCategoryDiscoveryAdapter,  // Add here
    CategoryDiscoveryAdapterRegistry,
  ],
  exports: [
    // ... existing exports ...
    AmazonCategoryDiscoveryAdapter,  // Export here
  ],
})
```

**File**: `apps/scraper/src/category-discovery/category-discovery-adapter.registry.ts`

Add the adapter to the registry constructor:

```typescript
import { AmazonCategoryDiscoveryAdapter } from './amazon/amazon-category-discovery.adapter.js';

constructor(
  private readonly dealabsAdapter: DealabsCategoryDiscoveryAdapter,
  private readonly vintedAdapter: VintedCategoryDiscoveryAdapter,
  private readonly leboncoinAdapter: LeBonCoinCategoryDiscoveryAdapter,
  private readonly amazonAdapter: AmazonCategoryDiscoveryAdapter,  // Add here
) {
  this.adapters = new Map<string, ICategoryDiscoveryAdapter>();
  this.adapters.set(SiteSource.DEALABS, this.dealabsAdapter);
  this.adapters.set(SiteSource.VINTED, this.vintedAdapter);
  this.adapters.set(SiteSource.LEBONCOIN, this.leboncoinAdapter);
  this.adapters.set(SiteSource.AMAZON, this.amazonAdapter);  // Add here
  // ...
}
```

### 3.5 Register the Scrape Adapter

**File**: `apps/scraper/src/adapters/adapters.module.ts`

Add your adapter to the module:

```typescript
import { AmazonAdapter } from './amazon/amazon.adapter.js';

@Module({
  providers: [
    DealabsAdapter,
    VintedAdapter,
    LeBonCoinAdapter,
    AmazonAdapter,  // Add here
    // ... other adapters
  ],
  exports: [
    DealabsAdapter,
    VintedAdapter,
    LeBonCoinAdapter,
    AmazonAdapter,  // Export here
  ],
})
export class AdaptersModule {}
```

---

## Step 4: Define Site-Specific Fields

Create field definitions for the frontend filter builder.

**File**: `packages/shared-types/src/sites/amazon/fields.ts`

```typescript
import type { SiteFieldDefinition } from '../types.js';

/**
 * Amazon-specific field definitions
 * These fields are available for filtering and display
 */
export const AMAZON_FIELDS: SiteFieldDefinition[] = [
  {
    key: 'rating',
    label: 'Rating',
    type: 'number',
    description: 'Product rating (1-5 stars)',
    operators: ['>=', '<=', '=', 'between'],
    validation: { min: 0, max: 5 },
    icon: 'star',
  },
  {
    key: 'reviewCount',
    label: 'Review Count',
    type: 'number',
    description: 'Number of customer reviews',
    operators: ['>=', '<=', '=', 'between'],
    validation: { min: 0 },
    icon: 'message',
  },
  {
    key: 'isPrime',
    label: 'Prime Eligible',
    type: 'boolean',
    description: 'Product is Prime eligible',
    operators: ['='],
    icon: 'badge',
  },
  {
    key: 'seller',
    label: 'Seller',
    type: 'string',
    description: 'Seller name',
    operators: ['=', 'contains', 'startsWith'],
    suggestions: ['Amazon', 'Warehouse Deals'],
    icon: 'store',
  },
  {
    key: 'fulfillment',
    label: 'Fulfillment',
    type: 'enum',
    description: 'Fulfillment method',
    operators: ['=', 'in'],
    enumValues: ['FBA', 'FBM', 'Amazon'],
    icon: 'truck',
  },
  {
    key: 'stockStatus',
    label: 'Stock Status',
    type: 'enum',
    description: 'Current stock availability',
    operators: ['=', 'in'],
    enumValues: ['in_stock', 'limited', 'out_of_stock', 'preorder'],
    icon: 'package',
  },
  {
    key: 'couponDiscount',
    label: 'Coupon Discount',
    type: 'number',
    description: 'Available coupon discount percentage',
    operators: ['>=', '<=', '=', 'between'],
    validation: { min: 0, max: 100 },
    suffix: '%',
    icon: 'ticket',
  },
];

export default AMAZON_FIELDS;
```

---

## Step 5: Add Filter Field Definitions

Define which fields can be used in filter rules.

**File**: `packages/shared-types/src/sites/amazon/filter-rules.ts`

```typescript
import type { FilterRuleDefinition } from '../types.js';
import { AMAZON_FIELDS } from './fields.js';

/**
 * Filter rule definitions for Amazon
 * Controls how users can create filter rules for Amazon deals
 */
export const AMAZON_FILTER_RULES: FilterRuleDefinition[] = AMAZON_FIELDS.map(field => ({
  field: field.key,
  label: field.label,
  type: field.type,
  operators: field.operators,
  validation: field.validation,
  // Site-specific flag for the rule builder
  siteSpecific: true,
  siteId: 'amazon',
}));

export default AMAZON_FILTER_RULES;
```

### 5.1 Export from Sites Index

**File**: `packages/shared-types/src/sites/index.ts`

```typescript
// ... existing exports ...

// Amazon
export { AMAZON_FIELDS } from './amazon/fields.js';
export { AMAZON_FILTER_RULES } from './amazon/filter-rules.js';
```

---

## Step 6: Create Database Extension Table

Add a Prisma model for site-specific data.

**File**: `packages/database/prisma/schema.prisma`

Add the extension model:

```prisma
// Amazon-specific article data
model ArticleAmazon {
  id              String   @id @default(cuid())
  articleId       String   @unique
  rating          Float?
  reviewCount     Int      @default(0)
  isPrime         Boolean  @default(false)
  seller          String?
  fulfillment     String?  // 'FBA', 'FBM', 'Amazon'
  stockStatus     String?  // 'in_stock', 'limited', 'out_of_stock'
  couponDiscount  Int?     // Percentage
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  // Relation to base article
  article Article @relation(fields: [articleId], references: [id], onDelete: Cascade)

  @@index([articleId])
  @@index([rating])
  @@index([isPrime])
  @@map("article_amazon")
}
```

Update the `Article` model to include the relation:

```prisma
model Article {
  // ... existing fields ...

  // Site-specific extensions (only one will be populated based on siteId)
  dealabs   ArticleDealabs?
  vinted    ArticleVinted?
  leboncoin ArticleLeBonCoin?
  amazon    ArticleAmazon?    // Add this line

  // ... rest of model ...
}
```

### 6.1 Run Migration

```bash
# Generate migration
pnpm db:migrate --name add_amazon_extension

# Generate Prisma client
pnpm db:generate
```

---

## Step 7: Update ArticleWrapper

Add Amazon support to the ArticleWrapper class.

**File**: `packages/shared-types/src/article/article-wrapper.ts`

```typescript
// Add to the ArticleWithExtensions type
export type ArticleWithExtensions = Article & {
  dealabs?: ArticleDealabs | null;
  vinted?: ArticleVinted | null;
  leboncoin?: ArticleLeBonCoin | null;
  amazon?: ArticleAmazon | null;  // Add this
};

// Update getExtension method
getExtension(): ArticleDealabs | ArticleVinted | ArticleLeBonCoin | ArticleAmazon | null {
  switch (this.article.siteId) {
    case SiteSource.DEALABS:
      return this.article.dealabs ?? null;
    case SiteSource.VINTED:
      return this.article.vinted ?? null;
    case SiteSource.LEBONCOIN:
      return this.article.leboncoin ?? null;
    case SiteSource.AMAZON:
      return this.article.amazon ?? null;  // Add this
    default:
      return null;
  }
}

// Update the include configuration
static getIncludeConfig() {
  return {
    dealabs: true,
    vinted: true,
    leboncoin: true,
    amazon: true,  // Add this
    category: true,
  };
}
```

---

## Step 8: Add Elasticsearch Mapping

Add the site-specific fields to the Elasticsearch index mapping.

**File**: `apps/scraper/src/elasticsearch/mappings/article-index-mapping.ts`

```typescript
// Add Amazon-specific mappings
amazon: {
  type: 'object',
  properties: {
    rating: { type: 'float' },
    reviewCount: { type: 'integer' },
    isPrime: { type: 'boolean' },
    seller: {
      type: 'text',
      fields: { keyword: { type: 'keyword' } }
    },
    fulfillment: { type: 'keyword' },
    stockStatus: { type: 'keyword' },
    couponDiscount: { type: 'integer' },
  },
},
```

---

## Step 9: Testing

### 9.1 Unit Tests for Adapter

**File**: `apps/scraper/src/adapters/amazon/__tests__/amazon.adapter.spec.ts`

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { AmazonAdapter } from '../amazon.adapter.js';
import { FieldExtractorService } from '../../../field-extraction/field-extractor.service.js';
import { SiteSource } from '@dealscrapper/shared-types';

describe('AmazonAdapter', () => {
  let adapter: AmazonAdapter;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AmazonAdapter,
        {
          provide: FieldExtractorService,
          useValue: {
            extractFields: jest.fn().mockReturnValue({
              externalId: 'B08N5WRWNW',
              title: 'Test Product',
              currentPrice: 29.99,
            }),
          },
        },
      ],
    }).compile();

    adapter = module.get<AmazonAdapter>(AmazonAdapter);
  });

  describe('properties', () => {
    it('should have correct siteId', () => {
      expect(adapter.siteId).toBe(SiteSource.AMAZON);
    });

    it('should have correct baseUrl', () => {
      expect(adapter.baseUrl).toBe('https://www.amazon.fr');
    });
  });

  describe('buildCategoryUrl()', () => {
    it('should build category URL with page', () => {
      const url = adapter.buildCategoryUrl('16435121031', 2);
      expect(url).toBe('https://www.amazon.fr/s?rh=n%3A16435121031&page=2');
    });

    it('should default to page 1', () => {
      const url = adapter.buildCategoryUrl('16435121031');
      expect(url).toContain('page=1');
    });
  });

  describe('extractCategorySlug()', () => {
    it('should extract category ID from URL', () => {
      const slug = adapter.extractCategorySlug(
        'https://www.amazon.fr/s?rh=n:16435121031&page=1'
      );
      expect(slug).toBe('16435121031');
    });
  });

  describe('getListingSelector()', () => {
    it('should return correct selector', () => {
      expect(adapter.getListingSelector()).toBe(
        '[data-component-type="s-search-result"]'
      );
    });
  });

  describe('validateHtml()', () => {
    it('should throw on empty HTML', () => {
      expect(() => adapter.validateHtml('')).toThrow('Invalid or empty HTML');
    });

    it('should throw on captcha detection', () => {
      const html = '<html>captcha verification required</html>'.repeat(100);
      expect(() => adapter.validateHtml(html)).toThrow('Captcha detected');
    });

    it('should pass valid HTML', () => {
      const html = '<html>'.repeat(200) + '</html>';
      expect(() => adapter.validateHtml(html)).not.toThrow();
    });
  });
});
```

### 9.2 Run Tests

```bash
# Run adapter tests
pnpm test:scraper:unit -- --grep "AmazonAdapter"

# Run all scraper tests
pnpm test:scraper:unit
```

---

## Step 10: Frontend Integration

### 10.1 Add Site to Frontend Types

**File**: `apps/web/src/shared/types/article.ts`

```typescript
// Add Amazon extension type
export interface AmazonExtension {
  rating: number | null;
  reviewCount: number;
  isPrime: boolean;
  seller: string | null;
  fulfillment: string | null;
  stockStatus: string | null;
  couponDiscount: number | null;
}

// Update ArticleSiteExtension union
export type ArticleSiteExtension =
  | DealabsExtension
  | VintedExtension
  | LeBonCoinExtension
  | AmazonExtension;
```

### 10.2 Add Site Display Component (Optional)

If the site needs special display logic:

**File**: `apps/web/src/features/articles/components/AmazonBadges.tsx`

```typescript
import { SiteSource } from '@dealscrapper/shared-types';
import type { AmazonExtension } from '@/shared/types/article';

interface AmazonBadgesProps {
  extension: AmazonExtension;
}

export function AmazonBadges({ extension }: AmazonBadgesProps) {
  return (
    <div className="flex gap-2">
      {extension.isPrime && (
        <span className="badge badge-prime">Prime</span>
      )}
      {extension.rating && (
        <span className="badge badge-rating">
          ⭐ {extension.rating.toFixed(1)}
        </span>
      )}
      {extension.couponDiscount && (
        <span className="badge badge-coupon">
          -{extension.couponDiscount}% coupon
        </span>
      )}
    </div>
  );
}
```

---

## Checklist

Use this checklist when adding a new site:

### Core Implementation

- [ ] Add site to `SiteSource` enum (`packages/shared-types/src/site-source.ts`)
- [ ] Add site definition (`apps/api/src/sites/definitions/site.definitions.ts`)
- [ ] Create scrape adapter directory (`apps/scraper/src/adapters/{site}/`)
- [ ] Implement scrape adapter class with `ISiteAdapter` interface
- [ ] Create field extraction config
- [ ] Register scrape adapter in `AdaptersModule`

### Category Discovery

- [ ] Create category discovery adapter (`apps/scraper/src/category-discovery/{site}/`)
- [ ] Implement `ICategoryDiscoveryAdapter` interface
- [ ] Register in `CategoryDiscoveryModule`
- [ ] Add to `CategoryDiscoveryAdapterRegistry` constructor

### Types & Fields

- [ ] Define site-specific data interface in adapter
- [ ] Create field definitions (`packages/shared-types/src/sites/{site}/fields.ts`)
- [ ] Create filter rules (`packages/shared-types/src/sites/{site}/filter-rules.ts`)
- [ ] Export from sites index

### Database

- [ ] Add extension model to Prisma schema
- [ ] Add relation to Article model
- [ ] Run migration
- [ ] Regenerate Prisma client

### ArticleWrapper

- [ ] Add extension type to `ArticleWithExtensions`
- [ ] Add case to `getExtension()` method
- [ ] Add to include config

### Elasticsearch

- [ ] Add mapping for site-specific fields

### Testing

- [ ] Write adapter unit tests
- [ ] Test HTML extraction with real samples
- [ ] Test category URL building
- [ ] Integration test with scraper pipeline

### Frontend (Optional)

- [ ] Add extension type to frontend types
- [ ] Create display components if needed
- [ ] Add site icon/branding

### Documentation

- [ ] Update this guide if you found improvements
- [ ] Add site-specific notes to README if needed

---

## Troubleshooting

### Common Issues

**1. Adapter not found at runtime**

Ensure you've:
- Registered the adapter in `AdaptersModule`
- Exported it from the module
- The `siteId` matches `SiteSource` enum exactly

**2. Database migration fails**

Check that:
- The extension table name uses `@@map("article_{site}")`
- The `articleId` foreign key references `Article.id`
- You've run `pnpm db:generate` after migration

**3. Filter rules not appearing**

Verify:
- Fields are exported from `packages/shared-types/src/sites/index.ts`
- The `siteId` in filter rules matches exactly
- Frontend is importing from the correct path

**4. Elasticsearch indexing errors**

Ensure:
- Mapping types match the data types
- Nested objects use `type: 'object'` with `properties`
- Index is recreated after mapping changes

---

## See Also

- [Site Adapter Interface](./apps/scraper/src/adapters/base/site-adapter.interface.ts)
- [Existing Adapters](./apps/scraper/src/adapters/) - Reference implementations
- [ArticleWrapper](./packages/shared-types/src/article/) - Unified article access
- [Filter System](./packages/shared-types/src/filtering.ts) - How filters work

---

*Last updated: December 2025*
