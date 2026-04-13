# 🏷️ @dealscrapper/shared-types

![TypeScript](https://img.shields.io/badge/TypeScript-100%25-blue)
![Zero Dependencies](https://img.shields.io/badge/Dependencies-Zero-green)
![Type Definitions Only](https://img.shields.io/badge/Type-Definitions-purple)

> TypeScript interfaces and DTOs for type-safe cross-service communication

## 📋 Overview

This package provides shared TypeScript type definitions used across all DealsScapper services. These types define the contracts for data exchange between services, ensuring type safety and consistency throughout the platform.

**Key Benefits:**
- ✅ Type-safe communication between services
- ✅ Zero runtime overhead (types removed at compile time)
- ✅ Single source of truth for DTOs
- ✅ No dependencies (pure type definitions)
- ✅ Comprehensive filter and deal type system

## 🎯 Scope

**Included:**
- ✅ Deal/Article types (`RawDeal`, `ArticleWrapper`, `DealDto`)
- ✅ Multi-site types (`SiteSource` enum, site-specific extensions)
- ✅ Filter expression types (rule-based filtering system)
- ✅ Scraping result types
- ✅ Authentication types (JWT payloads, tokens)
- ✅ API response types
- ✅ Enum definitions

**NOT Included:**
- ❌ Prisma entity types (use `@dealscrapper/database`)
- ❌ Implementation logic (pure types only)
- ❌ Validation logic (use class-validator in services)

## 📦 Installation

```json
{
  "dependencies": {
    "@dealscrapper/shared-types": "workspace:*"
  }
}
```

## 🚀 Quick Start

### Importing Types

```typescript
import {
  RawDeal,
  FilterExpression,
  ScrapingResult,
  JwtPayload
} from '@dealscrapper/shared-types';

// Use in function signatures
function processDeal(deal: RawDeal): void {
  console.log(deal.title, deal.currentPrice);
}

// Use in class properties
class FilterService {
  validateExpression(expr: FilterExpression): boolean {
    // Implementation
  }
}
```

## 📖 API Reference

### Multi-Site Types

#### SiteSource

Enum defining supported deal sources:

```typescript
enum SiteSource {
  DEALABS = 'dealabs',
  VINTED = 'vinted',
  LEBONCOIN = 'leboncoin'
}
```

**Usage Example:**
```typescript
import { SiteSource } from '@dealscrapper/shared-types';

// Check site type
if (article.siteId === SiteSource.DEALABS) {
  // Access Dealabs-specific fields
  console.log(wrapper.dealabs?.temperature);
}
```

---

### Deal Types

#### RawDeal

Raw deal data as scraped from external sources. Now includes `siteId` (REQUIRED) and site-specific fields are separated.

```typescript
interface RawDeal {
  siteId: SiteSource;           // REQUIRED - which site this deal is from
  externalId: string;
  title: string;
  description?: string;
  category: string;
  categoryPath: string[];

  // Universal Pricing
  currentPrice?: number;

  // Universal Metadata
  publishedAt?: Date;
  expiresAt?: Date;
  url: string;
  imageUrl?: string;
  isExpired: boolean;
  isActive: boolean;

  // Site-specific fields (populated based on siteId)
  dealabs?: DealabsFields;      // Only for Dealabs deals
  vinted?: VintedFields;        // Only for Vinted deals
  leboncoin?: LeBonCoinFields;  // Only for LeBonCoin deals
}

// Dealabs-specific fields
interface DealabsFields {
  temperature: number;          // Community "heat" score
  merchant?: string;
  originalPrice?: number;
  discountPercentage?: number;
  freeShipping: boolean;
  commentCount: number;
  communityVerified: boolean;
  isCoupon: boolean;
}

// Vinted-specific fields
interface VintedFields {
  brand?: string;
  size?: string;
  condition?: string;
  favoriteCount?: number;
  color?: string;
  sellerRating?: number;
}

// LeBonCoin-specific fields
interface LeBonCoinFields {
  city?: string;
  proSeller?: boolean;
  urgentFlag?: boolean;
  shippingCost?: number;
  deliveryOptions?: string[];
}
```

#### ArticleWrapper

Unified wrapper combining base Article with site-specific extension:

```typescript
import { Article, ArticleDealabs, ArticleVinted, ArticleLeBonCoin } from '@dealscrapper/database';

interface ArticleWrapper {
  article: Article;               // Base article (universal fields)
  dealabs?: ArticleDealabs;       // Dealabs extension (if applicable)
  vinted?: ArticleVinted;         // Vinted extension (if applicable)
  leboncoin?: ArticleLeBonCoin;   // LeBonCoin extension (if applicable)
}
```

**Usage Example:**
```typescript
import { ArticleWrapper, SiteSource } from '@dealscrapper/shared-types';

// Create a Dealabs deal wrapper
const wrapper: ArticleWrapper = {
  article: {
    id: 'article-123',
    siteId: SiteSource.DEALABS,
    externalId: 'deal-12345',
    title: 'Samsung Galaxy S23 - 50% off',
    currentPrice: 399.99,
    url: 'https://example.com/deal/12345',
    scrapedAt: new Date(),
    isActive: true,
    isExpired: false,
  },
  dealabs: {
    id: 'article-123',
    temperature: 450,
    merchant: 'Amazon',
    originalPrice: 799.99,
    discountPercentage: 50,
    freeShipping: true,
  },
};

// Access site-specific data
if (wrapper.dealabs) {
  console.log(`Temperature: ${wrapper.dealabs.temperature}°`);
}
```

---

### Filter Types

#### FilterExpression

Root type for filter expressions (legacy tree-based system).

```typescript
interface FilterExpression {
  type: 'GROUP' | 'CONDITION';
  operator?: 'AND' | 'OR';
  field?: string;
  comparison?: '>' | '<' | '=' | '>=' | '<=' | 'CONTAINS' | 'REGEX';
  value?: FilterValue;
  children?: FilterExpression[];
}

type FilterValue = string | number | boolean | Date | string[] | number[];
```

**Usage Example:**
```typescript
const priceFilter: FilterExpression = {
  type: 'GROUP',
  operator: 'AND',
  children: [
    {
      type: 'CONDITION',
      field: 'currentPrice',
      comparison: '<=',
      value: 50
    },
    {
      type: 'CONDITION',
      field: 'category',
      comparison: '=',
      value: 'Electronics'
    }
  ]
};
```

#### Modern Rule-Based Filter System

The new rule-based system provides more flexibility and type safety.

##### FilterableField

All fields that can be filtered on, including site-specific fields:

```typescript
// Universal fields (available for all sites)
type UniversalField =
  | 'title'
  | 'description'
  | 'currentPrice'
  | 'publishedAt'
  | 'expiresAt'
  | 'url'
  | 'imageUrl'
  | 'categoryPath';

// Dealabs-specific fields
type DealabsField =
  | 'temperature'        // Community heat score
  | 'merchant'           // Store name
  | 'originalPrice'
  | 'discountPercentage'
  | 'freeShipping';

// Vinted-specific fields
type VintedField =
  | 'brand'
  | 'size'
  | 'condition'
  | 'favoriteCount'
  | 'color';

// LeBonCoin-specific fields
type LeBonCoinField =
  | 'city'
  | 'proSeller'
  | 'urgentFlag'
  | 'shippingCost';

// Computed/alias fields
type ComputedField =
  | 'age'              // Computed from scrapedAt (Universal)
  | 'discountPercent'  // Computed from prices (Dealabs only)
  | 'heat'             // Alias for temperature (Dealabs only)
  | 'price';           // Alias for currentPrice (Universal)

type FilterableField = UniversalField | DealabsField | VintedField | LeBonCoinField | ComputedField;
```

> **Note:** Site-specific fields like `temperature`, `brand`, and `city` are only available when filtering deals from that specific site. Universal fields work across all sites.

##### Rule

A single filtering condition:

```typescript
interface Rule {
  field: FilterableField;
  operator: RuleOperator;
  value: FilterValue;
}

type RuleOperator =
  | '=='  | '!='           // Equality
  | '>'   | '<'  | '>='  | '<='  // Comparison
  | 'contains' | 'not_contains'  // String matching
  | 'starts_with' | 'ends_with'  // String patterns
  | 'in' | 'not_in'              // Array membership
  | 'regex'                       // Regex matching
  | 'exists' | 'not_exists'      // Null checks
  | 'between';                    // Range checks
```

**Usage Examples:**
```typescript
// Price less than or equal to $50
const priceRule: Rule = {
  field: 'currentPrice',
  operator: '<=',
  value: 50
};

// Title contains "samsung"
const titleRule: Rule = {
  field: 'title',
  operator: 'contains',
  value: 'samsung'
};

// Category is one of multiple values
const categoryRule: Rule = {
  field: 'category',
  operator: 'in',
  value: ['Electronics', 'Computers', 'Phones']
};

// Price between $100 and $500
const priceRangeRule: Rule = {
  field: 'currentPrice',
  operator: 'between',
  value: [100, 500]
};

// Deal has free shipping
const shippingRule: Rule = {
  field: 'freeShipping',
  operator: '==',
  value: true
};
```

##### RuleGroup

Combines multiple rules with logical operators:

```typescript
interface RuleGroup {
  operator: 'AND' | 'OR';
  rules: (Rule | RuleGroup)[];
}
```

**Usage Example:**
```typescript
// Budget electronics: price <= $100 AND category = Electronics
const budgetElectronics: RuleGroup = {
  operator: 'AND',
  rules: [
    { field: 'currentPrice', operator: '<=', value: 100 },
    { field: 'category', operator: '==', value: 'Electronics' }
  ]
};

// Hot deals: temperature > 200 OR discount > 50%
const hotDeals: RuleGroup = {
  operator: 'OR',
  rules: [
    { field: 'temperature', operator: '>', value: 200 },
    { field: 'discountPercentage', operator: '>', value: 50 }
  ]
};

// Complex nested: (price <= $50 AND category = Electronics) OR (discount > 70%)
const complexFilter: RuleGroup = {
  operator: 'OR',
  rules: [
    {
      operator: 'AND',
      rules: [
        { field: 'currentPrice', operator: '<=', value: 50 },
        { field: 'category', operator: '==', value: 'Electronics' }
      ]
    },
    { field: 'discountPercentage', operator: '>', value: 70 }
  ]
};
```

---

### Scraping Types

#### ScrapingResult

Result of a scraping operation:

```typescript
interface ScrapingResult {
  success: boolean;
  deals: RawDeal[];
  errors: string[];
  metadata: {
    source: string;
    scrapedAt: Date;
    duration: number;      // milliseconds
    dealsProcessed: number;
    dealsMatched: number;
  };
}
```

**Usage Example:**
```typescript
// In scraper service
const result: ScrapingResult = {
  success: true,
  deals: [deal1, deal2, deal3],
  errors: [],
  metadata: {
    source: 'dealabs',
    scrapedAt: new Date(),
    duration: 5432,
    dealsProcessed: 150,
    dealsMatched: 12
  }
};
```

---

### Authentication Types

#### JwtPayload

JWT token payload structure:

```typescript
interface JwtPayload {
  sub: string;           // User ID
  email: string;
  iat?: number;          // Issued at
  exp?: number;          // Expiration
}
```

#### AuthTokens

Authentication token pair:

```typescript
interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}
```

**Usage Example:**
```typescript
// In auth service
function generateTokens(user: User): AuthTokens {
  const payload: JwtPayload = {
    sub: user.id,
    email: user.email
  };

  return {
    accessToken: this.jwtService.sign(payload, { expiresIn: '15m' }),
    refreshToken: this.jwtService.sign(payload, { expiresIn: '7d' })
  };
}
```

---

### Response Types

#### ApiResponse<T>

Standard API response wrapper:

```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: Date;
}
```

**Usage Example:**
```typescript
// Success response
const successResponse: ApiResponse<User> = {
  success: true,
  data: user,
  timestamp: new Date()
};

// Error response
const errorResponse: ApiResponse<never> = {
  success: false,
  error: 'User not found',
  message: 'No user exists with that email',
  timestamp: new Date()
};
```

#### PaginatedResponse<T>

Paginated data response:

```typescript
interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
```

**Usage Example:**
```typescript
const response: PaginatedResponse<RawDeal> = {
  data: deals,
  total: 1523,
  page: 1,
  pageSize: 20,
  totalPages: 77
};
```

---

### Enum Types

#### NotificationStatus

```typescript
enum NotificationStatus {
  PENDING = 'pending',
  SENT = 'sent',
  FAILED = 'failed'
}
```

#### NotificationType

```typescript
enum NotificationType {
  EMAIL = 'email',
  WEBSOCKET = 'websocket',
  PUSH = 'push'
}
```

---

## 💡 Examples

### Example 1: Filter Validation (API Service)

```typescript
// apps/api/src/filters/filters.service.ts
import { FilterExpression, Rule, RuleGroup } from '@dealscrapper/shared-types';

@Injectable()
export class FiltersService {
  validateFilterExpression(expr: FilterExpression | RuleGroup): boolean {
    if ('operator' in expr && 'rules' in expr) {
      // It's a RuleGroup
      return expr.rules.every(rule => this.validateRule(rule));
    }
    // It's a legacy FilterExpression
    return this.validateLegacyExpression(expr);
  }

  private validateRule(rule: Rule | RuleGroup): boolean {
    if ('rules' in rule) {
      // Nested RuleGroup
      return rule.rules.every(r => this.validateRule(r));
    }

    // Validate Rule
    const validFields = ['currentPrice', 'category', 'temperature', 'title'];
    return validFields.includes(rule.field);
  }
}
```

### Example 2: Deal Processing (Scraper Service)

```typescript
// apps/scraper/src/processing/deal-processor.ts
import { RawDeal, ScrapingResult } from '@dealscrapper/shared-types';

@Injectable()
export class DealProcessor {
  async processScrapedDeals(html: string): Promise<ScrapingResult> {
    const startTime = Date.now();
    const deals: RawDeal[] = [];
    const errors: string[] = [];

    try {
      // Extract deals from HTML
      const rawDeals = this.extractDealsFromHtml(html);

      for (const rawDeal of rawDeals) {
        try {
          const deal: RawDeal = {
            externalId: rawDeal.id,
            title: rawDeal.title,
            category: rawDeal.category,
            categoryPath: rawDeal.categoryPath,
            currentPrice: rawDeal.price,
            originalPrice: rawDeal.originalPrice,
            discountPercentage: this.calculateDiscount(rawDeal),
            merchant: rawDeal.merchant,
            freeShipping: rawDeal.shipping === 'free',
            temperature: rawDeal.heat,
            commentCount: rawDeal.comments,
            communityVerified: rawDeal.verified,
            url: rawDeal.url,
            isExpired: false,
            isCoupon: rawDeal.type === 'coupon',
            source: 'dealabs',
            isActive: true
          };

          deals.push(deal);
        } catch (err) {
          errors.push(`Failed to process deal: ${err.message}`);
        }
      }

      return {
        success: errors.length === 0,
        deals,
        errors,
        metadata: {
          source: 'dealabs',
          scrapedAt: new Date(),
          duration: Date.now() - startTime,
          dealsProcessed: rawDeals.length,
          dealsMatched: deals.length
        }
      };
    } catch (err) {
      return {
        success: false,
        deals: [],
        errors: [err.message],
        metadata: {
          source: 'dealabs',
          scrapedAt: new Date(),
          duration: Date.now() - startTime,
          dealsProcessed: 0,
          dealsMatched: 0
        }
      };
    }
  }
}
```

### Example 3: API Response Formatting (API Service)

```typescript
// apps/api/src/common/interceptors/response.interceptor.ts
import { ApiResponse } from '@dealscrapper/shared-types';
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map(data => ({
        success: true,
        data,
        timestamp: new Date()
      }))
    );
  }
}
```

### Example 4: Filter Builder (Web Service)

```typescript
// apps/web/src/features/filters/hooks/useFilterBuilder.ts
import { Rule, RuleGroup, FilterableField } from '@dealscrapper/shared-types';

export function useFilterBuilder() {
  const [filterGroup, setFilterGroup] = useState<RuleGroup>({
    operator: 'AND',
    rules: []
  });

  const addRule = (field: FilterableField, operator: string, value: any) => {
    const newRule: Rule = { field, operator, value };

    setFilterGroup(prev => ({
      ...prev,
      rules: [...prev.rules, newRule]
    }));
  };

  const addGroup = () => {
    const newGroup: RuleGroup = {
      operator: 'AND',
      rules: []
    };

    setFilterGroup(prev => ({
      ...prev,
      rules: [...prev.rules, newGroup]
    }));
  };

  return { filterGroup, addRule, addGroup };
}
```

## ✅ Best Practices

### Do's ✅

1. **Use shared types for cross-service communication**

   ```typescript
   // ✅ GOOD - Import from shared-types
   import { RawDeal } from '@dealscrapper/shared-types';

   function processDeal(deal: RawDeal): void {
     // Implementation
   }

   // ❌ BAD - Duplicate type definition
   interface CustomDeal {
     title: string;
     price: number;
   }
   ```

2. **Use discriminated unions for type safety**

   ```typescript
   // ✅ GOOD - Type guard works correctly
   if ('rules' in expression) {
     // TypeScript knows it's a RuleGroup
     expression.rules.forEach(rule => processRule(rule));
   }
   ```

3. **Export types explicitly**

   ```typescript
   // ✅ GOOD - Explicit exports
   export type { RawDeal, FilterExpression };
   export interface ScrapingResult { ... }
   ```

4. **Use readonly for immutable data**

   ```typescript
   // ✅ GOOD - Readonly array
   interface RawDeal {
     readonly categoryPath: readonly string[];
   }
   ```

5. **Document complex types with JSDoc**

   ```typescript
   /**
    * Represents a raw deal as scraped from external sources
    * @property externalId - Unique ID from the source website
    * @property temperature - Community "heat" score (0-1000+)
    */
   export interface RawDeal { ... }
   ```

### Don'ts ❌

1. **Don't duplicate Prisma types**

   ```typescript
   // ❌ BAD - Duplicates Prisma User type
   export interface User {
     id: string;
     email: string;
   }

   // ✅ GOOD - Use Prisma type
   import { User } from '@dealscrapper/database';
   ```

2. **Don't use `any` types**

   ```typescript
   // ❌ BAD
   export interface FilterExpression {
     value: any;
   }

   // ✅ GOOD
   export type FilterValue = string | number | boolean | Date;
   export interface FilterExpression {
     value: FilterValue;
   }
   ```

3. **Don't add runtime code to this package**

   ```typescript
   // ❌ BAD - This is a type-only package
   export function validateDeal(deal: RawDeal): boolean {
     return !!deal.title;
   }

   // ✅ GOOD - Types only
   export interface RawDeal {
     title: string;
   }
   ```

4. **Don't create overly complex nested types**

   ```typescript
   // ❌ BAD - Too complex
   type ComplexType<T> = T extends Array<infer U>
     ? U extends { data: infer D }
       ? D extends string
         ? StringProcessor<D>
         : NumberProcessor<D>
       : never
     : never;

   // ✅ GOOD - Simple, clear types
   type StringArray = string[];
   type DataObject = { data: string | number };
   ```

## 🔍 TypeScript

### Type Guards

Create type guards for discriminated unions:

```typescript
import { Rule, RuleGroup } from '@dealscrapper/shared-types';

function isRuleGroup(item: Rule | RuleGroup): item is RuleGroup {
  return 'rules' in item;
}

function isRule(item: Rule | RuleGroup): item is Rule {
  return 'field' in item && 'operator' in item;
}

// Usage
if (isRuleGroup(expression)) {
  expression.rules.forEach(/* ... */);  // ✅ Type-safe
}
```

### Utility Types

Combine with TypeScript utility types:

```typescript
import { RawDeal } from '@dealscrapper/shared-types';

// Create partial update type
type DealUpdate = Partial<RawDeal>;

// Pick specific fields
type DealSummary = Pick<RawDeal, 'title' | 'currentPrice' | 'merchant'>;

// Make fields required
type RequiredDeal = Required<Pick<RawDeal, 'title' | 'currentPrice'>>;
```

## 🔗 Related Packages

- [@dealscrapper/database](../database/README.md) - Prisma entity types (avoid duplication)
- [@dealscrapper/shared-repository](../shared-repository/README.md) - Uses these types for DTOs
- All services use these types for cross-service communication

## 🐛 Troubleshooting

### Issue: "Cannot find type X"

**Cause**: Type not exported from package

**Solution**: Check exports in `src/index.ts`:
```typescript
export type { RawDeal, FilterExpression } from './deals.js';
```

---

### Issue: Type mismatch between services

**Cause**: Services using different type definitions

**Solution**: Ensure all services import from shared-types:
```typescript
// ✅ All services use same type
import { RawDeal } from '@dealscrapper/shared-types';
```

---

### Issue: Circular dependency

**Cause**: Types importing from each other

**Solution**: Reorganize types to avoid circular imports:
```typescript
// ❌ BAD - Circular
// deals.ts imports filtering.ts
// filtering.ts imports deals.ts

// ✅ GOOD - Split into separate files
// deals.ts - pure deal types
// filtering.ts - pure filter types
// common.ts - shared types
```

## 📊 Package Statistics

- **~550 lines** of TypeScript type definitions
- **Zero dependencies** (pure types)
- **Zero runtime overhead** (types removed at compile)
- Used by **all 5 services**
- **Multi-site support**: SiteSource enum, ArticleWrapper, site-specific field types

## 📚 Further Reading

- [TypeScript Handbook - Types](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html)
- [TypeScript Utility Types](https://www.typescriptlang.org/docs/handbook/utility-types.html)
- [Discriminated Unions](https://www.typescriptlang.org/docs/handbook/unions-and-intersections.html#discriminating-unions)

---

**🚀 Type-safe communication across the DealsScapper platform!**
