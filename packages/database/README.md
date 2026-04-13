# 📊 @dealscrapper/database

![TypeScript](https://img.shields.io/badge/TypeScript-100%25-blue)
![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Database-336791)

> Prisma schema, migrations, and type-safe database client for all DealsScapper services

## 📋 Overview

This package provides the **single source of truth** for database schema, entity types, and database access across all DealsScapper services. It uses Prisma as the ORM layer for type-safe database operations with PostgreSQL.

**Key Benefits:**
- ✅ Single schema definition for all services
- ✅ Automatic TypeScript type generation
- ✅ Type-safe database queries
- ✅ Database migration management
- ✅ Zero-cost abstractions (types removed at runtime)

## 🎯 Scope

**Included:**
- ✅ Prisma schema definition (`schema.prisma`)
- ✅ Database migrations
- ✅ Prisma Client generation
- ✅ NestJS `PrismaService` and `PrismaModule`
- ✅ Entity type exports (`User`, `Filter`, `Article`, etc.)
- ✅ Custom type extensions (API contracts, domain types)

**NOT Included:**
- ❌ Business logic (belongs in services)
- ❌ Repository implementations (use `@dealscrapper/shared-repository`)
- ❌ Database connection pooling config (handled by Prisma)

## 📦 Installation

```json
{
  "dependencies": {
    "@dealscrapper/database": "workspace:*"
  }
}
```

## 🚀 Quick Start

### Using Prisma Client

```typescript
import { PrismaService, User, Prisma } from '@dealscrapper/database';
import { Injectable } from '@nestjs/common';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async createUser(email: string, password: string): Promise<User> {
    return this.prisma.user.create({
      data: { email, password }
    });
  }

  async getUserWithFilters(userId: string): Promise<User | null> {
    // ✅ ALWAYS use include, NEVER select
    return this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        filters: {
          include: {
            categories: {
              include: {
                category: true
              }
            }
          }
        }
      }
    });
  }
}
```

### Setting Up PrismaModule in Your Service

```typescript
// apps/api/src/app.module.ts
import { Module } from '@nestjs/common';
import { PrismaModule } from '@dealscrapper/database';

@Module({
  imports: [
    PrismaModule,  // ✅ Import once, use everywhere
    // ... other modules
  ],
})
export class AppModule {}
```

## 📖 Database Schema

### Multi-Site Architecture

The database supports multiple deal sources (Dealabs, Vinted, LeBonCoin) using a **base + extension** pattern:

- **Article**: Universal fields shared by all sites (`siteId` REQUIRED)
- **ArticleDealabs/ArticleVinted/ArticleLeBonCoin**: Site-specific extension tables
- **Site**: Site definitions with branding (color, icon)

### Core Models

#### Site
Site definitions with branding for multi-site support.

```prisma
model Site {
  id        String    @id         // 'dealabs', 'vinted', 'leboncoin'
  name      String                // Display name
  color     String                // Brand color (hex)
  isActive  Boolean   @default(true)
  iconUrl   String?

  // Relations
  categories  Category[]
  articles    Article[]
}
```

#### User
User accounts with authentication and preferences.

```prisma
model User {
  id               String    @id @default(cuid())
  email            String    @unique
  password         String
  emailVerified    Boolean   @default(false)
  emailVerifiedAt  DateTime?
  lastLoginAt      DateTime?

  // Relations
  filters          Filter[]
  notifications    Notification[]
  sessions         UserSession[]
}
```

#### Filter
User-defined deal filters with complex filtering expressions.

> **IMPORTANT**: Filters do NOT have an `enabledSites` field. Sites are derived from:
> `Filter → FilterCategory → Category → Site`

```prisma
model Filter {
  id                String   @id @default(cuid())
  userId            String
  name              String
  filterExpression  Json     // Complex filtering rules (see FLEXIBLE_FILTERING_GUIDE.md)
  active            Boolean  @default(true)

  // Notification settings
  immediateNotifications  Boolean  @default(true)
  digestFrequency         String?  // 'daily', 'weekly', 'never'
  maxNotificationsPerDay  Int      @default(10)

  // Relations
  user              User              @relation(...)
  matches           Match[]
  categories        FilterCategory[]  // Sites derived from these categories
}
```

#### Article (Base)
Base article with universal fields. **`siteId` is REQUIRED**.

```prisma
model Article {
  id          String    @id @default(cuid())
  siteId      String                      // REQUIRED - FK to Site
  externalId  String                      // Source system ID
  url         String
  title       String
  description String?
  currentPrice Decimal?
  imageUrl    String?
  publishedAt DateTime?
  scrapedAt   DateTime  @default(now())
  isActive    Boolean   @default(true)
  isExpired   Boolean   @default(false)

  // Relations
  site        Site      @relation(fields: [siteId], references: [id], onDelete: Cascade)
  category    Category? @relation(...)
  matches     Match[]

  @@unique([siteId, externalId])  // Composite unique constraint
}
```

#### Article Extensions (Site-Specific)

**ArticleDealabs** - Community deals platform:
```prisma
model ArticleDealabs {
  id                 String   @id          // Same as Article.id
  temperature        Int      @default(0)  // Community heat score
  merchant           String?               // Store name
  originalPrice      Decimal?              // Original price
  discountPercentage Float?                // Discount %
  freeShipping       Boolean  @default(false)
}
```

**ArticleVinted** - Fashion marketplace:
```prisma
model ArticleVinted {
  id             String   @id
  brand          String?               // Product brand
  size           String?               // Item size
  condition      String?               // Condition (New, Good, etc.)
  favoriteCount  Int?                  // Favorites count
  color          String?               // Item color
  sellerRating   Float?                // Seller rating
}
```

**ArticleLeBonCoin** - Classifieds:
```prisma
model ArticleLeBonCoin {
  id              String   @id
  city            String?               // Location city
  proSeller       Boolean?              // Professional seller
  urgentFlag      Boolean?              // Urgent listing
  shippingCost    Decimal?              // Shipping cost
  deliveryOptions String[]              // Available delivery methods
}
```

#### Match
Records when an article matches a user filter.

```prisma
model Match {
  id          String   @id @default(cuid())
  filterId    String
  articleId   String
  matchedAt   DateTime @default(now())
  notified    Boolean  @default(false)

  // Relations
  filter      Filter   @relation(...)
  article     Article  @relation(...)
}
```

#### Category
Hierarchical product categories.

```prisma
model Category {
  id          String   @id @default(cuid())
  name        String   @unique
  slug        String   @unique
  parentSlug  String?
  level       Int
  isActive    Boolean  @default(true)

  // Statistics
  dealCount   Int      @default(0)
  userCount   Int      @default(0)

  // Relations
  articles    Article[]
  filters     FilterCategory[]
}
```

#### Notification
Notification delivery tracking.

```prisma
model Notification {
  id          String   @id @default(cuid())
  userId      String
  type        String   // "email", "websocket"
  status      String   // "pending", "sent", "failed"
  payload     Json
  sentAt      DateTime?

  // Relations
  user        User     @relation(...)
}
```

#### ScheduledJob & ScrapingJob
Job tracking for scheduler and scraper services.

```prisma
model ScheduledJob {
  id          String   @id @default(cuid())
  name        String   @unique
  cronPattern String
  enabled     Boolean  @default(true)
  lastRun     DateTime?
  nextRun     DateTime?
}

model ScrapingJob {
  id          String   @id @default(cuid())
  status      String   // "pending", "running", "completed", "failed"
  startedAt   DateTime?
  completedAt DateTime?
  articlesScraped Int  @default(0)
  errors      Json?
}
```

## 📖 API Reference

### PrismaService

NestJS-compatible Prisma Client wrapper with lifecycle hooks.

```typescript
import { PrismaService } from '@dealscrapper/database';

@Injectable()
export class MyService {
  constructor(private readonly prisma: PrismaService) {}

  async doSomething() {
    // Access Prisma Client methods
    await this.prisma.user.findMany();
    await this.prisma.filter.create({ data: {...} });
  }
}
```

**Lifecycle Hooks:**
- `onModuleInit()` - Connects to database
- `onModuleDestroy()` - Disconnects gracefully

### Entity Types

Import Prisma-generated entity types:

```typescript
import { User, Filter, Article, Category, Match, Notification } from '@dealscrapper/database';

// Use as TypeScript types
function processUser(user: User): void {
  console.log(user.email);  // ✅ Type-safe
  console.log(user.filters); // ✅ Type-safe
}
```

### Prisma Namespace

Import Prisma namespace for input types:

```typescript
import { Prisma } from '@dealscrapper/database';

// Create input types
const createUserData: Prisma.UserCreateInput = {
  email: 'user@example.com',
  password: 'hashed_password'
};

// Where input types
const whereUser: Prisma.UserWhereUniqueInput = {
  email: 'user@example.com'
};

// Include types
const userWithFilters: Prisma.UserInclude = {
  filters: true
};
```

### Custom Types

#### API Response Types

```typescript
import { ApiResponse, PaginatedResponse } from '@dealscrapper/database';

const response: ApiResponse<User> = {
  success: true,
  data: user,
  timestamp: new Date()
};

const paginated: PaginatedResponse<Filter> = {
  data: filters,
  total: 100,
  page: 1,
  pageSize: 20
};
```

#### Domain Types

```typescript
import { FilterExpression, RuleGroup } from '@dealscrapper/database';

const expression: FilterExpression = {
  operator: 'AND',
  rules: [
    { field: 'price', operator: '<=', value: 50 },
    { field: 'category', operator: '==', value: 'electronics' }
  ]
};
```

## 💡 Examples

### Example 1: Creating a User with Filters (API Service)

```typescript
// apps/api/src/users/users.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService, User, Prisma } from '@dealscrapper/database';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async createUserWithFilters(
    email: string,
    password: string,
    filterName: string
  ): Promise<User> {
    // ✅ Use Prisma's create with nested data
    return this.prisma.user.create({
      data: {
        email,
        password,
        filters: {
          create: {
            name: filterName,
            filterExpression: { operator: 'AND', rules: [] }
          }
        }
      },
      // ✅ ALWAYS include, NEVER select
      include: {
        filters: true
      }
    });
  }
}
```

### Example 2: Complex Query with Relations (API Service)

```typescript
// Get user with all their filters and matched articles
async getUserDashboard(userId: string) {
  return this.prisma.user.findUnique({
    where: { id: userId },
    include: {
      filters: {
        include: {
          matches: {
            include: {
              article: {
                include: {
                  category: true
                }
              }
            },
            orderBy: { matchedAt: 'desc' },
            take: 10  // Latest 10 matches per filter
          },
          categories: {
            include: {
              category: true
            }
          }
        },
        where: { active: true }
      },
      notifications: {
        where: {
          status: 'pending'
        },
        orderBy: { createdAt: 'desc' }
      }
    }
  });
}
```

### Example 3: Transaction for Match Creation (Scraper Service)

```typescript
// apps/scraper/src/matching/matching.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService, Match, Article, Filter } from '@dealscrapper/database';

@Injectable()
export class MatchingService {
  constructor(private readonly prisma: PrismaService) {}

  async createMatchAndUpdateStats(
    filterId: string,
    articleId: string
  ): Promise<Match> {
    // ✅ Use Prisma transactions for atomicity
    return this.prisma.$transaction(async (tx) => {
      // Create match
      const match = await tx.match.create({
        data: {
          filterId,
          articleId,
          matchedAt: new Date(),
          notified: false
        }
      });

      // Update filter statistics
      await tx.filter.update({
        where: { id: filterId },
        data: {
          totalMatches: { increment: 1 },
          matchesLast24h: { increment: 1 },
          lastMatchAt: new Date()
        }
      });

      return match;
    });
  }
}
```

### Example 4: Bulk Insert with createMany (Scraper Service)

```typescript
// Insert multiple scraped articles
async bulkInsertArticles(articles: Array<{url: string; title: string; price: number}>) {
  // ✅ Use createMany for batch inserts
  const result = await this.prisma.article.createMany({
    data: articles.map(article => ({
      url: article.url,
      title: article.title,
      price: article.price,
      scrapedAt: new Date()
    })),
    skipDuplicates: true  // Skip articles with duplicate URLs
  });

  return result.count;  // Number of articles inserted
}
```

### Example 5: Search with Pagination (API Service)

```typescript
async searchArticles(query: string, page: number = 1, limit: number = 20) {
  const skip = (page - 1) * limit;

  const [articles, total] = await Promise.all([
    this.prisma.article.findMany({
      where: {
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } }
        ]
      },
      include: {
        category: true
      },
      orderBy: { heat: 'desc' },
      skip,
      take: limit
    }),
    this.prisma.article.count({
      where: {
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } }
        ]
      }
    })
  ]);

  return {
    articles,
    total,
    page,
    pageSize: limit,
    totalPages: Math.ceil(total / limit)
  };
}
```

## ✅ Best Practices

### Do's ✅

1. **ALWAYS use `include`, NEVER use `select`**

   ```typescript
   // ✅ GOOD - Maintains full type safety
   const user = await prisma.user.findUnique({
     where: { id },
     include: {
       filters: true,
       notifications: true
     }
   });
   // Type: User & { filters: Filter[], notifications: Notification[] }

   // ❌ BAD - Breaks type safety, loses relation types
   const user = await prisma.user.findUnique({
     where: { id },
     select: {
       id: true,
       email: true
     }
   });
   // Type: { id: string, email: string } - Lost all other fields!
   ```

2. **Use Prisma-generated types**

   ```typescript
   // ✅ GOOD - Use Prisma types
   import { User, Prisma } from '@dealscrapper/database';

   const data: Prisma.UserCreateInput = { email, password };
   const user: User = await prisma.user.create({ data });

   // ❌ BAD - Custom types duplicate Prisma
   interface CustomUser {
     id: string;
     email: string;
   }
   ```

3. **Use transactions for multi-step operations**

   ```typescript
   // ✅ GOOD - Atomic transaction
   await prisma.$transaction(async (tx) => {
     const user = await tx.user.create({ data: userData });
     await tx.filter.create({ data: { userId: user.id, ...filterData } });
   });

   // ❌ BAD - Non-atomic, can leave orphaned data
   const user = await prisma.user.create({ data: userData });
   await prisma.filter.create({ data: { userId: user.id, ...filterData } });
   ```

4. **Use indexes for frequently queried fields**

   Already defined in schema:
   ```prisma
   @@index([email])
   @@index([active])
   @@index([userId])
   ```

5. **Use connection pooling in production**

   ```typescript
   // Configured in schema.prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")  // Includes pool config
   }
   ```

### Don'ts ❌

1. **Don't use raw SQL unless absolutely necessary**

   ```typescript
   // ❌ BAD - Loses type safety
   const users = await prisma.$queryRaw`SELECT * FROM users WHERE email = ${email}`;

   // ✅ GOOD - Type-safe Prisma query
   const users = await prisma.user.findMany({ where: { email } });
   ```

2. **Don't create duplicate type definitions**

   ```typescript
   // ❌ BAD - Duplicates Prisma type
   interface UserDto {
     id: string;
     email: string;
     filters: Filter[];
   }

   // ✅ GOOD - Use Prisma.UserGetPayload
   type UserWithFilters = Prisma.UserGetPayload<{
     include: { filters: true }
   }>;
   ```

3. **Don't bypass PrismaService**

   ```typescript
   // ❌ BAD - Creates separate connection
   import { PrismaClient } from '@prisma/client';
   const prisma = new PrismaClient();

   // ✅ GOOD - Use injected PrismaService
   constructor(private readonly prisma: PrismaService) {}
   ```

4. **Don't ignore migration warnings**

   ```bash
   # ⚠️ Always review migration changes
   pnpm db:migrate
   # Check generated migration file before applying
   ```

5. **Don't use `any` for JSON fields**

   ```typescript
   // ❌ BAD
   const expression: any = filter.filterExpression;

   // ✅ GOOD - Use Prisma.JsonValue
   const expression: Prisma.JsonValue = filter.filterExpression;
   ```

## 🔧 Database Management

### Generating Prisma Client

After any schema changes:

```bash
# Generate Prisma Client (required before building)
pnpm db:generate
```

### Creating Migrations

```bash
# Create a new migration
pnpm db:migrate

# Give it a descriptive name when prompted:
# e.g., "add_user_email_verified_field"
```

### Applying Migrations

```bash
# Development: Apply migrations
pnpm db:migrate

# Production: Deploy migrations
pnpm db:deploy
```

### Resetting Database (Development Only!)

```bash
# ⚠️ DESTRUCTIVE - Drops all data
pnpm db:reset

# Alternatively, reset and seed
pnpm db:reset --skip-seed
```

### Opening Prisma Studio

```bash
# Visual database browser
pnpm db:studio

# Opens at http://localhost:5555
```

### Validating Schema

```bash
# Check schema for errors
pnpm db:validate
```

## 🔍 TypeScript

### Type Inference with GetPayload

Use `Prisma.UserGetPayload` to infer types from queries:

```typescript
// Define query shape
const userWithFiltersQuery = {
  include: {
    filters: {
      include: {
        categories: {
          include: {
            category: true
          }
        }
      }
    }
  }
} satisfies Prisma.UserInclude;

// Infer type from query
type UserWithFilters = Prisma.UserGetPayload<{
  include: typeof userWithFiltersQuery
}>;

// Use in function
function processUser(user: UserWithFilters) {
  user.filters.forEach(filter => {
    filter.categories.forEach(fc => {
      console.log(fc.category.name);  // ✅ Fully type-safe
    });
  });
}
```

### Conditional Types

```typescript
// Type for create vs update
type UserInput<T extends 'create' | 'update'> =
  T extends 'create' ? Prisma.UserCreateInput : Prisma.UserUpdateInput;

function saveUser<T extends 'create' | 'update'>(
  type: T,
  data: UserInput<T>
) {
  // Implementation
}
```

## 🔗 Related Packages

- [@dealscrapper/shared-repository](../shared-repository/README.md) - Repository pattern (depends on this package)
- [@dealscrapper/shared-types](../shared-types/README.md) - Additional type definitions
- [@dealscrapper/shared-health](../shared-health/README.md) - Uses PrismaService for health checks

## 🐛 Troubleshooting

### Issue: "Cannot find module '@prisma/client'"

**Cause**: Prisma Client not generated

**Solution**:
```bash
pnpm db:generate
pnpm build
```

---

### Issue: Migration conflicts

**Error**: "Migration X conflicts with Y"

**Solution**:
```bash
# Option 1: Create a new migration that resolves conflicts
pnpm db:migrate

# Option 2 (dev only): Reset and recreate migrations
pnpm db:reset
```

---

### Issue: Type errors after schema changes

**Cause**: Prisma Client not regenerated

**Solution**:
```bash
pnpm db:generate  # Regenerate types
pnpm build        # Rebuild packages
```

---

### Issue: Connection pool exhausted

**Cause**: Too many Prisma instances or unclosed connections

**Solution**:
```typescript
// ✅ Use PrismaService (singleton)
constructor(private readonly prisma: PrismaService) {}

// ❌ Don't create new PrismaClient instances
const prisma = new PrismaClient();  // ❌
```

---

### Issue: Slow queries

**Solution**:
1. Add indexes for frequently queried fields
2. Use `include` judiciously (don't include unnecessary relations)
3. Use pagination for large datasets
4. Check query performance in Prisma Studio

```prisma
// Add index
@@index([fieldName])
```

### Cascade Deletes

All relations use `onDelete: Cascade` for data integrity:

- **User cascade**: User → Filter → Match → Notification
- **User cascade**: User → UserSession
- **User cascade**: User → Notification
- **Site cascade**: Site → Category → Article → Match
- **Site cascade**: Site → Category → FilterCategory
- **Category cascade**: Category → ScheduledJob → ScrapingJob
- **Category cascade**: Category (parent) → Category (children)
- **Filter cascade**: Filter → FilterCategory
- **Filter cascade**: Filter → Match → Notification

## 📊 Database Statistics

Current schema size:
- **14 models** (User, UserSession, Filter, Article, Site, ArticleDealabs, ArticleVinted, ArticleLeBonCoin, Match, Category, etc.)
- **~80 fields** across all models
- **15+ indexes** for query optimization
- **Full ACID compliance** via PostgreSQL
- **3 site-specific extension tables** for multi-site support

## 📚 Further Reading

- [Prisma Documentation](https://www.prisma.io/docs)
- [Prisma Best Practices](https://www.prisma.io/docs/guides/performance-and-optimization)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Database Migrations Guide](https://www.prisma.io/docs/concepts/components/prisma-migrate)

---

**🚀 The foundation of DealsScapper's data layer - type-safe, performant, and reliable!**
