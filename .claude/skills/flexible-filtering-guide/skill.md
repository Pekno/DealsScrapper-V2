---
name: flexible-filtering-guide
description: >
  Load this skill when working on filter expressions, rule definitions, operators, fields,
  scoring, or validation in DealsScrapper. Contains the complete filterable field catalogue
  (universal + site-specific), all 27+ operators with their types, scoring modes
  (weighted/percentage/points), logical grouping (AND/OR/NOT), and real-world filter examples.
  Use proactively when implementing or reviewing filter expressions, building the filter UI,
  writing filter evaluation logic, validating filter DTOs, or answering "what fields/operators
  are available" questions. Pair with `api-filtering` for engine internals.
---

# Flexible Filtering System — Reference Guide

## Filter Expression Structure

```typescript
{
  "rules": [ ...FilterRule | FilterRuleGroup ],
  "matchLogic": "AND" | "OR" | "NOT",  // How to combine top-level rules (default: AND)
  "minScore": 75,                       // Minimum score threshold (0–100, default: 50)
  "scoreMode": "weighted" | "percentage" | "points"  // Scoring strategy
}
```

### Rule (leaf node)
```typescript
{
  "field": "temperature",     // Field name (see field catalogue below)
  "operator": ">=",           // Operator (see operator list below)
  "value": 100,               // Value to compare against
  "weight": 2.0,              // Importance multiplier (default: 1.0)
  "caseSensitive": false      // String ops only (default: false)
}
```

### Rule Group (logical grouping with nested rules)
```typescript
{
  "logic": "AND" | "OR" | "NOT",
  "weight": 1.5,
  "rules": [ ...FilterRule | FilterRuleGroup ]
}
```

---

## Filterable Fields

### Universal (all sites)
| Field | Type | Notes |
|---|---|---|
| `title` | `string` | Deal/listing title |
| `description` | `string \| null` | |
| `currentPrice` | `number \| null` | |
| `publishedAt` | `Date \| null` | |
| `expiresAt` | `Date \| null` | |
| `scrapedAt` | `Date` | |
| `categoryPath` | `string[]` | Breadcrumb hierarchy |
| `url` | `string` | |
| `imageUrl` | `string \| null` | |

### Computed / Alias Fields
| Field | Type | Computed From |
|---|---|---|
| `price` | `number` | Alias for `currentPrice` |
| `heat` | `number` | Alias for `temperature` (Dealabs) |
| `age` | `number` | Hours since `scrapedAt` |
| `discountPercent` | `number` | `(originalPrice - currentPrice) / originalPrice * 100` |

### Dealabs-Specific (`ArticleDealabs` extension)
| Field | Type |
|---|---|
| `temperature` | `number` |
| `merchant` | `string \| null` |
| `originalPrice` | `number \| null` |
| `discountPercentage` | `number \| null` |
| `freeShipping` | `boolean` |

### Vinted-Specific (`ArticleVinted` extension)
| Field | Type |
|---|---|
| `brand` | `string \| null` |
| `size` | `string \| null` |
| `condition` | `string \| null` |
| `favoriteCount` | `number \| null` |
| `color` | `string \| null` |

### LeBonCoin-Specific (`ArticleLeBonCoin` extension)
| Field | Type |
|---|---|
| `city` | `string \| null` |
| `proSeller` | `boolean \| null` |
| `shippingCost` | `number \| null` |
| `urgentFlag` | `boolean \| null` |

> Site-specific fields are only evaluated when the article is from that site. They are silently skipped (not failed) for articles from other sites.

---

## Operators

### Numeric
`=`, `!=`, `>`, `>=`, `<`, `<=`, `BETWEEN` (value: `[min, max]`)

### String
`CONTAINS`, `NOT_CONTAINS`, `STARTS_WITH`, `ENDS_WITH`, `EQUALS`, `NOT_EQUALS`, `REGEX`, `NOT_REGEX`

### Array
`IN` (value is array), `NOT_IN`, `INCLUDES_ANY`, `INCLUDES_ALL`

### Boolean
`IS_TRUE`, `IS_FALSE`

### Date
`BEFORE`, `AFTER`, `BETWEEN` (value: `[date1, date2]`), `OLDER_THAN`, `NEWER_THAN`

---

## Scoring Modes

| Mode | Behaviour |
|---|---|
| `weighted` | Score = sum of matched rule weights / total weights × 100 (default) |
| `percentage` | Score = matched rules / total rules × 100 |
| `points` | Score = raw sum of matched rule weights |

A filter matches when `score >= minScore`.

Rules with higher `weight` contribute more to the score — useful for "nice to have" vs "must have" signals.

---

## Examples

### Hot gaming laptops (Dealabs)
```json
{
  "matchLogic": "AND",
  "minScore": 75,
  "scoreMode": "weighted",
  "rules": [
    { "field": "title", "operator": "REGEX", "value": ".*(gaming|rtx|geforce).*laptop.*", "caseSensitive": false, "weight": 1.3 },
    { "field": "temperature", "operator": ">=", "value": 100, "weight": 2.0 },
    { "field": "price", "operator": "BETWEEN", "value": [800, 1500], "weight": 1.5 },
    { "logic": "NOT", "weight": 0.8, "rules": [
        { "field": "title", "operator": "INCLUDES_ANY", "value": ["refurbished", "used", "damaged"], "caseSensitive": false }
    ]},
    { "logic": "OR", "weight": 0.6, "rules": [
        { "field": "merchant", "operator": "IN", "value": ["Amazon", "Fnac", "Boulanger"] },
        { "field": "freeShipping", "operator": "IS_TRUE", "value": true }
    ]},
    { "field": "age", "operator": "<=", "value": 12, "weight": 0.8 }
  ]
}
```

### Fashion (Vinted) — brand + size
```json
{
  "matchLogic": "AND",
  "minScore": 60,
  "scoreMode": "weighted",
  "rules": [
    { "field": "title", "operator": "REGEX", "value": ".*(nike|adidas).*", "caseSensitive": false, "weight": 1.5 },
    { "field": "title", "operator": "INCLUDES_ANY", "value": ["shoes", "sneakers", "chaussures", "baskets"], "caseSensitive": false, "weight": 1.2 },
    { "field": "size", "operator": "IN", "value": ["42", "43", "44"], "weight": 0.8 },
    { "field": "discountPercent", "operator": ">=", "value": 20, "weight": 1.0 }
  ]
}
```

### Nested AND + OR
```json
{
  "rules": [{
    "logic": "AND",
    "rules": [
      { "field": "category", "operator": "EQUALS", "value": "gaming" },
      { "logic": "OR", "rules": [
          { "field": "temperature", "operator": ">=", "value": 200 },
          { "field": "discountPercent", "operator": ">=", "value": 30 }
      ]}
    ]
  }]
}
```

---

## Key Design Rules

- Rules are evaluated with **short-circuit logic** for performance
- Regex patterns are compiled once and reused
- `caseSensitive` defaults to `false` for all string operators
- A `FilterRuleGroup` with `logic: "NOT"` passes when **none** of its child rules match
- The engine lives at `apps/scraper/src/filter-matching/rule-engine.service.ts` → `evaluateFilterExpression(expression, deal)`
- For engine internals, also load the `api-filtering` skill
