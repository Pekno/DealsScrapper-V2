---
name: api-filtering
description: >
  Load this skill when working on the filter system in DealsScrapper — filter expressions,
  rule evaluation, operators, scoring, or filter-related API endpoints. Contains the
  RuleBasedFilterExpression structure, 27+ operators, filterable fields, scoring modes,
  and critical data model changes (enabledSites removed, RawDeal-based filtering).
  Invoke when implementing or debugging filter creation, evaluation logic, or the rule engine.
---

# Rule-Based Filtering System (apps/api/ + apps/scraper/)

## Core Architecture

Filtering happens **during scraping** on `RawDeal` objects — before database insertion.

```
Web Page → RawDeal → Filter Evaluation → Article (if matches)
```

Rule engine: `apps/scraper/src/filter-matching/rule-engine.service.ts`  
Method: `evaluateFilterExpression(expression, deal): RuleEvaluationResult`

## Filter Expression Structure

```typescript
interface RuleBasedFilterExpression {
  rules: (FilterRule | FilterRuleGroup)[];
  matchLogic?: 'AND' | 'OR' | 'NOT';  // How to combine top-level rules
  minScore?: number;                   // Minimum score threshold (default: 50)
  scoreMode?: 'weighted' | 'percentage' | 'points';
}

interface FilterRule {
  field: FilterableField;   // keyof RawDeal or computed field
  operator: FilterOperator; // 27+ operators
  value: any;
  caseSensitive?: boolean;
  weight?: number;          // Scoring weight (default: 1.0)
}

interface FilterRuleGroup {
  logic: 'AND' | 'OR' | 'NOT';
  rules: (FilterRule | FilterRuleGroup)[];
  weight?: number;
}
```

## Operators (27+)

```typescript
// Numeric
'=', '!=', '>', '>=', '<', '<='

// String
'CONTAINS', 'NOT_CONTAINS', 'STARTS_WITH', 'ENDS_WITH', 'REGEX', 'NOT_REGEX'

// Array
'IN', 'NOT_IN', 'INCLUDES_ANY', 'INCLUDES_ALL'

// Boolean
'IS_TRUE', 'IS_FALSE'

// Date
'BEFORE', 'AFTER', 'BETWEEN', 'OLDER_THAN', 'NEWER_THAN'
```

## Filterable Fields

**Direct RawDeal fields** (reliable):
- `title`, `description`, `brand`, `model`, `category`, `merchant`
- `currentPrice`, `freeShipping`, `publishedAt`
- `temperature` (Dealabs-specific — in `ArticleDealabs` extension)

**Computed/alias fields**:
- `price` → alias for `currentPrice`
- `heat` → alias for `temperature`
- `age` → hours since `publishedAt`
- `discountPercent` → calculated from prices
- `rating` → alias for `merchantRating`

**Field reliability**:
- ✅ Reliable: `currentPrice`, `temperature`, `title`, `merchant`, `category`, `freeShipping`
- ⚠️ Sometimes available: `originalPrice`, `discountPercentage`, `merchantRating`
- ❌ Unreliable: `stockLevel` (heuristic), `viewCount` (hardcoded 0)

## Example Filter

```typescript
{
  rules: [
    { field: 'category', operator: 'IN', value: ['laptops', 'computers'], weight: 1.0 },
    { field: 'price', operator: 'BETWEEN', value: [800, 1500], weight: 1.5 },
    { field: 'heat', operator: '>=', value: 100, weight: 2.0 },
    {
      logic: 'OR', weight: 1.2,
      rules: [
        { field: 'title', operator: 'REGEX', value: '.*(rtx|gaming).*', caseSensitive: false },
        { field: 'description', operator: 'INCLUDES_ANY', value: ['RTX', 'gaming'] }
      ]
    }
  ],
  matchLogic: 'AND',
  minScore: 75,
  scoreMode: 'weighted'
}
```

## API Contract

**Filter create/update requests do NOT include `enabledSites`** — it was removed from the Filter model. Backend derives target sites from `filter.categories[].siteId`.

```typescript
// ✅ Correct filter create request
{
  name: 'Gaming Deals',
  expression: { rules: [...], matchLogic: 'AND' },
  categoryIds: ['cat-dealabs-tech', 'cat-vinted-gaming']
  // NO enabledSites!
}
```

Site derivation: a filter with Dealabs categories → matches Dealabs articles only.

## Scoring

- Each rule contributes a weighted score (default weight: 1.0)
- Groups have collective weights
- `minScore` threshold gates match/no-match
- `scoreMode` options: `weighted` (default), `percentage`, `points`

## Database Storage

Filters stored as JSON in `Filter.filterExpression` field. Uses `convertFilterExpressionForDb()` to handle Date serialization. Backward compatible with filter table.

## Testing

When writing filter tests, always include `siteId` in test articles:
```typescript
const article = await prisma.article.create({
  data: { externalId: 'test-123', siteId: 'dealabs', title: 'RTX 4090', url: '...' }
});
```
