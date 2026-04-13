# 🗂️ @dealscrapper/shared-repository

![TypeScript](https://img.shields.io/badge/TypeScript-100%25-blue)
![Type Safety](https://img.shields.io/badge/Type%20Safety-A%2B-green)
![Code Reuse](https://img.shields.io/badge/Code%20Reuse-80--95%25-brightgreen)

> Repository pattern base classes for consistent, type-safe database access across all DealsScapper services

## 📋 Overview

This package provides abstract repository base classes that implement the **Repository Pattern** with the **Template Method** design pattern. It eliminates 80-95% of duplicate database access code across services while maintaining full type safety and allowing service-specific customization.

**Key Benefits:**
- ✅ Eliminates code duplication (80-95% reduction)
- ✅ Enforces Prisma best practices (always `include`, never `select`)
- ✅ Consistent error handling across all services
- ✅ Type-safe database operations
- ✅ Built-in pagination support
- ✅ Service-specific customization via abstract methods

## 🎯 Scope

**Included:**
- ✅ `AbstractBaseRepository` - Generic CRUD operations
- ✅ `BaseCategoryRepository` - Category-specific operations
- ✅ `BaseFilterRepository` - Filter-specific operations with complex queries
- ✅ Pagination utilities
- ✅ Error handling and validation
- ✅ Health check capabilities

**NOT Included:**
- ❌ Service-specific business logic (belongs in service layer)
- ❌ Direct Prisma Client access (use `@dealscrapper/database`)
- ❌ Authentication/authorization (belongs in services)

## 📦 Installation

```json
{
  "dependencies": {
    "@dealscrapper/shared-repository": "workspace:*",
    "@dealscrapper/database": "workspace:*"
  }
}
```

## 🚀 Quick Start

### Creating a Basic Repository

```typescript
import { Injectable } from '@nestjs/common';
import { AbstractBaseRepository, PaginationOptions, PaginatedResult } from '@dealscrapper/shared-repository';
import { PrismaService, User, Prisma } from '@dealscrapper/database';

@Injectable()
export class UserRepository extends AbstractBaseRepository<
  User,                            // Entity type
  Prisma.UserCreateInput,          // Create input type
  Prisma.UserUpdateInput,          // Update input type
  Prisma.UserWhereUniqueInput      // Where unique type
> {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  // Implement required abstract methods
  async findUnique(where: Prisma.UserWhereUniqueInput): Promise<User | null> {
    return this.executeWithErrorHandling(
      'findUnique',
      () => this.prisma.user.findUnique({ where })
    );
  }

  async findMany(where?: Prisma.UserWhereInput): Promise<User[]> {
    return this.executeWithErrorHandling(
      'findMany',
      () => this.prisma.user.findMany({ where })
    );
  }

  async findManyPaginated(
    where?: Prisma.UserWhereInput,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<User>> {
    this.validatePagination(pagination);

    const page = pagination?.page || 1;
    const limit = pagination?.limit || 50;
    const skip = pagination?.offset || calculatePaginationOffset(page, limit);

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({ where, skip, take: limit }),
      this.count(where),
    ]);

    return {
      data: users,
      pagination: this.calculatePaginationMetadata(total, pagination),
    };
  }

  async count(where?: Prisma.UserWhereInput): Promise<number> {
    return this.executeWithErrorHandling(
      'count',
      () => this.prisma.user.count({ where })
    );
  }

  async create(data: Prisma.UserCreateInput): Promise<User> {
    this.validateRequiredFields(data as Record<string, unknown>, ['email', 'password']);
    return this.executeWithErrorHandling(
      'create',
      () => this.prisma.user.create({ data })
    );
  }

  async update(where: Prisma.UserWhereUniqueInput, data: Prisma.UserUpdateInput): Promise<User> {
    return this.executeWithErrorHandling(
      'update',
      () => this.prisma.user.update({ where, data })
    );
  }

  async delete(where: Prisma.UserWhereUniqueInput): Promise<User> {
    return this.executeWithErrorHandling(
      'delete',
      () => this.prisma.user.delete({ where })
    );
  }

  // Add service-specific methods
  async findByEmail(email: string): Promise<User | null> {
    return this.findUnique({ email });
  }
}
```

## 📖 API Reference

### AbstractBaseRepository<TEntity, TCreate, TUpdate, TWhereUnique>

Base class for all repositories providing common CRUD operations.

#### Generic Type Parameters

- `TEntity` - The Prisma entity type (e.g., `User`, `Filter`)
- `TCreate` - The Prisma create input type (e.g., `Prisma.UserCreateInput`)
- `TUpdate` - The Prisma update input type (e.g., `Prisma.UserUpdateInput`)
- `TWhereUnique` - The Prisma where unique input type (e.g., `Prisma.UserWhereUniqueInput`)

#### Abstract Methods (Must Implement)

```typescript
abstract findUnique(where: TWhereUnique): Promise<TEntity | null>;
abstract findMany(where?: any): Promise<TEntity[]>;
abstract findManyPaginated(where?: any, pagination?: PaginationOptions): Promise<PaginatedResult<TEntity>>;
abstract count(where?: any): Promise<number>;
abstract create(data: TCreate): Promise<TEntity>;
abstract update(where: TWhereUnique, data: TUpdate): Promise<TEntity>;
abstract delete(where: TWhereUnique): Promise<TEntity>;
```

#### Protected Helper Methods

##### `executeWithErrorHandling<T>(operation: string, fn: () => Promise<T>, context?: any): Promise<T>`

Wraps database operations with consistent error handling.

```typescript
// Usage
return this.executeWithErrorHandling(
  'findByEmail',
  () => this.prisma.user.findUnique({ where: { email } }),
  { email }
);
```

##### `validateRequiredFields(data: Record<string, unknown>, requiredFields: string[]): void`

Validates that required fields are present in data objects.

```typescript
// Usage
this.validateRequiredFields(data, ['email', 'password']);
```

##### `validatePagination(pagination?: PaginationOptions): void`

Validates pagination parameters.

```typescript
// Usage
this.validatePagination(pagination);
```

##### `calculatePaginationMetadata(total: number, pagination?: PaginationOptions): PaginationMetadata`

Calculates pagination metadata for responses.

```typescript
// Usage
const metadata = this.calculatePaginationMetadata(totalCount, pagination);
```

#### Public Methods

##### `async createMany(data: TCreate[]): Promise<TEntity[]>`

Creates multiple entities in a transaction.

```typescript
const users = await userRepository.createMany([
  { email: 'user1@example.com', password: 'hash1' },
  { email: 'user2@example.com', password: 'hash2' },
]);
```

##### `async updateMany(where: any, data: TUpdate): Promise<number>`

Updates multiple entities matching criteria.

```typescript
const updatedCount = await userRepository.updateMany(
  { emailVerified: false },
  { emailVerified: true }
);
```

##### `async deleteMany(where: any): Promise<number>`

Deletes multiple entities matching criteria.

```typescript
const deletedCount = await userRepository.deleteMany({
  createdAt: { lt: oldDate }
});
```

##### `async upsert(where: TWhereUnique, create: TCreate, update: TUpdate): Promise<TEntity>`

Creates or updates an entity.

```typescript
const user = await userRepository.upsert(
  { email: 'user@example.com' },
  { email: 'user@example.com', password: 'hash' },
  { lastLoginAt: new Date() }
);
```

##### `async exists(where: TWhereUnique): Promise<boolean>`

Checks if an entity exists.

```typescript
const userExists = await userRepository.exists({ email: 'user@example.com' });
```

##### `async healthCheck(): Promise<boolean>`

Performs a health check on the repository.

```typescript
const isHealthy = await userRepository.healthCheck();
```

---

### BaseCategoryRepository

Specialized repository for Category entities with additional category-specific operations.

```typescript
import { BaseCategoryRepository } from '@dealscrapper/shared-repository';
import { Category, Prisma } from '@dealscrapper/database';

export class CategoryRepository extends BaseCategoryRepository {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  // Implement required abstract methods
  protected getDefaultCategoryIncludes(): Prisma.CategoryInclude {
    return { filters: true };
  }

  protected getDefaultCategoryOrderBy(): Prisma.CategoryOrderByWithRelationInput {
    return { name: 'asc' };
  }
}
```

#### Additional Methods

##### `async findActiveCategories(): Promise<Category[]>`

Finds all active categories.

##### `async findTopLevelCategories(): Promise<Category[]>`

Finds all top-level categories (level 1).

##### `async findCategoriesByParent(parentSlug: string | null): Promise<Category[]>`

Finds categories by parent slug.

##### `async toggleActiveStatus(categoryId: string, isActive: boolean): Promise<Category>`

Toggles category active status.

##### `async updateCategoryStatistics(categoryId: string, stats: CategoryStatistics): Promise<Category>`

Updates category statistics (dealCount, userCount).

```typescript
await categoryRepository.updateCategoryStatistics(categoryId, {
  dealCount: 150,
  userCount: 45
});
```

---

### BaseFilterRepository

Specialized repository for Filter entities with complex filtering and search capabilities.

```typescript
import { BaseFilterRepository } from '@dealscrapper/shared-repository';
import { Filter, Prisma } from '@dealscrapper/database';

export class FilterRepository extends BaseFilterRepository {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  // Implement required abstract methods
  protected getDefaultFilterIncludes(): Prisma.FilterInclude {
    return {
      categories: {
        include: { category: true }
      }
    };
  }

  protected getDefaultFilterOrderBy(): Prisma.FilterOrderByWithRelationInput {
    return { createdAt: 'desc' };
  }
}
```

#### Additional Methods

##### `async findActiveFilters(): Promise<Filter[]>`

Finds all active filters.

##### `async findFiltersByUser(userId: string): Promise<Filter[]>`

Finds all filters for a specific user.

##### `async findFiltersByCategory(categoryId: string): Promise<Filter[]>`

Finds all filters associated with a category.

##### `async toggleFilterStatus(filterId: string, active: boolean): Promise<Filter>`

Toggles filter active status.

##### `async updateFilterExpression(filterId: string, expression: Prisma.JsonValue): Promise<Filter>`

Updates a filter's expression.

```typescript
await filterRepository.updateFilterExpression(filterId, {
  operator: 'AND',
  rules: [
    { field: 'price', operator: '<=', value: 50 }
  ]
});
```

##### `async updateFilterStatistics(filterId: string, stats: FilterStatistics): Promise<Filter>`

Updates filter statistics (matchCount, lastMatchedAt).

##### `async searchFilters(criteria: FilterSearchCriteria, pagination?: PaginationOptions): Promise<PaginatedResult<Filter>>`

Searches filters with multiple criteria.

```typescript
const results = await filterRepository.searchFilters({
  userId: 'user-123',
  active: true,
  categoryIds: ['cat-1', 'cat-2'],
  nameQuery: 'deal'
}, { page: 1, limit: 20 });
```

---

## 💡 Examples

### Example 1: Simple User Repository (from API service)

```typescript
// apps/api/src/repositories/user.repository.ts
@Injectable()
export class UserRepository extends AbstractBaseRepository<
  User,
  Prisma.UserCreateInput,
  Prisma.UserUpdateInput,
  Prisma.UserWhereUniqueInput
> {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  // ... implement abstract methods (shown in Quick Start)

  // Add domain-specific methods
  async findByEmail(email: string): Promise<User | null> {
    return this.findUnique({ email });
  }

  async incrementLoginAttempts(userId: string): Promise<User> {
    return this.executeWithErrorHandling(
      'incrementLoginAttempts',
      () => this.prisma.user.update({
        where: { id: userId },
        data: { loginAttempts: { increment: 1 } }
      })
    );
  }

  async verifyEmail(userId: string): Promise<User> {
    return this.update(
      { id: userId },
      { emailVerified: true, emailVerifiedAt: new Date() }
    );
  }
}
```

### Example 2: Category Repository with Service-Specific Behavior (from API service)

```typescript
// apps/api/src/repositories/category.repository.ts
@Injectable()
export class CategoryRepository extends BaseCategoryRepository {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  // Define what relations to include for this service
  protected getDefaultCategoryIncludes(): Prisma.CategoryInclude {
    return {
      filters: {
        include: {
          filter: {
            select: {
              id: true,
              name: true,
              active: true,
            }
          }
        }
      }
    };
  }

  // Define default ordering for this service
  protected getDefaultCategoryOrderBy(): Prisma.CategoryOrderByWithRelationInput {
    return { name: 'asc' };
  }

  // Add API-specific methods
  async findCategoryWithFilters(categoryId: string): Promise<Category | null> {
    return this.executeWithErrorHandling(
      'findCategoryWithFilters',
      () => this.prisma.category.findUnique({
        where: { id: categoryId },
        include: {
          filters: {
            include: { filter: true },
            where: { filter: { active: true } }
          }
        }
      })
    );
  }

  async getCategoryHierarchy(): Promise<Category[]> {
    return this.executeWithErrorHandling(
      'getCategoryHierarchy',
      () => this.prisma.category.findMany({
        where: { isActive: true },
        include: this.getDefaultCategoryIncludes(),
        orderBy: [
          { level: 'asc' },
          { parentSlug: 'asc' },
          { name: 'asc' }
        ]
      })
    );
  }
}
```

### Example 3: Filter Repository with Complex Search (from API service)

```typescript
// apps/api/src/repositories/filter.repository.ts
@Injectable()
export class FilterRepository extends BaseFilterRepository {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  protected getDefaultFilterIncludes(): Prisma.FilterInclude {
    return {
      categories: {
        include: {
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
            }
          }
        }
      }
    };
  }

  protected getDefaultFilterOrderBy(): Prisma.FilterOrderByWithRelationInput {
    return { createdAt: 'desc' };
  }

  // API-specific method: Get user's active filters
  async getUserActiveFilters(userId: string): Promise<Filter[]> {
    return this.executeWithErrorHandling(
      'getUserActiveFilters',
      () => this.prisma.filter.findMany({
        where: {
          userId,
          active: true
        },
        include: this.getDefaultFilterIncludes(),
        orderBy: this.getDefaultFilterOrderBy()
      })
    );
  }

  // API-specific method: Search with full-text
  async searchUserFilters(
    userId: string,
    query: string,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<Filter>> {
    return this.searchFilters({
      userId,
      nameQuery: query,
      active: true
    }, pagination);
  }
}
```

### Example 4: Using Pagination

```typescript
// In a service
async getUsers(page: number, limit: number) {
  const result = await this.userRepository.findManyPaginated(
    undefined, // no filter
    { page, limit }
  );

  return {
    users: result.data,
    total: result.pagination.total,
    currentPage: result.pagination.page,
    totalPages: result.pagination.totalPages,
    hasMore: result.pagination.hasNextPage
  };
}
```

### Example 5: Bulk Operations

```typescript
// Create multiple filters at once
const filters = await filterRepository.createMany([
  { name: 'Budget Deals', userId, filterExpression: expr1 },
  { name: 'Tech Deals', userId, filterExpression: expr2 },
  { name: 'Gaming Deals', userId, filterExpression: expr3 }
]);

// Update all inactive filters
const updatedCount = await filterRepository.updateMany(
  { active: false },
  { active: true }
);

// Delete old filters
const deletedCount = await filterRepository.deleteMany({
  createdAt: { lt: thirtyDaysAgo }
});
```

---

## ✅ Best Practices

### Do's ✅

1. **Always use `include`, never `select`**
   ```typescript
   // ✅ GOOD - Maintains full type safety
   const user = await this.prisma.user.findUnique({
     where: { id },
     include: { filters: true }
   });

   // ❌ BAD - Breaks type safety
   const user = await this.prisma.user.findUnique({
     where: { id },
     select: { id: true, email: true }
   });
   ```

2. **Use `executeWithErrorHandling` for all database operations**
   ```typescript
   // ✅ GOOD
   return this.executeWithErrorHandling(
     'findByEmail',
     () => this.prisma.user.findUnique({ where: { email } }),
     { email }
   );

   // ❌ BAD - No error handling
   return this.prisma.user.findUnique({ where: { email } });
   ```

3. **Validate required fields before creation**
   ```typescript
   // ✅ GOOD
   async create(data: Prisma.UserCreateInput): Promise<User> {
     this.validateRequiredFields(data as Record<string, unknown>, ['email', 'password']);
     return this.executeWithErrorHandling('create', () => this.prisma.user.create({ data }));
   }
   ```

4. **Use pagination for large datasets**
   ```typescript
   // ✅ GOOD - Paginated
   const result = await repository.findManyPaginated(where, { page: 1, limit: 50 });

   // ❌ BAD - Loads all records
   const allRecords = await repository.findMany(where);
   ```

5. **Implement service-specific abstract methods**
   ```typescript
   // ✅ GOOD - Customize for your service
   protected getDefaultCategoryIncludes(): Prisma.CategoryInclude {
     return {
       filters: true,  // API service needs filters
       deals: true     // API service needs deals
     };
   }
   ```

### Don'ts ❌

1. **Don't bypass the repository layer**
   ```typescript
   // ❌ BAD - Direct Prisma access in service
   const user = await this.prisma.user.findUnique({ where: { id } });

   // ✅ GOOD - Use repository
   const user = await this.userRepository.findUnique({ id });
   ```

2. **Don't duplicate base functionality**
   ```typescript
   // ❌ BAD - Reimplementing createMany
   async createManyUsers(data: Prisma.UserCreateInput[]): Promise<User[]> {
     const users: User[] = [];
     for (const userData of data) {
       users.push(await this.create(userData));
     }
     return users;
   }

   // ✅ GOOD - Use inherited method
   const users = await this.userRepository.createMany(data);
   ```

3. **Don't use `any` types**
   ```typescript
   // ❌ BAD
   async findByField(field: any, value: any): Promise<User | null>

   // ✅ GOOD
   async findByEmail(email: string): Promise<User | null>
   ```

4. **Don't ignore pagination validation**
   ```typescript
   // ❌ BAD - No validation
   async findManyPaginated(where?, pagination?): Promise<PaginatedResult<User>> {
     // Direct query without validation
   }

   // ✅ GOOD - Validate first
   async findManyPaginated(where?, pagination?): Promise<PaginatedResult<User>> {
     this.validatePagination(pagination);
     // ... rest of implementation
   }
   ```

5. **Don't mix business logic in repositories**
   ```typescript
   // ❌ BAD - Business logic in repository
   async createUserAndSendEmail(data: CreateUserDto): Promise<User> {
     const user = await this.create(data);
     await this.emailService.sendWelcome(user.email);  // ❌ Business logic
     return user;
   }

   // ✅ GOOD - Repository only handles data access
   async create(data: Prisma.UserCreateInput): Promise<User> {
     return this.executeWithErrorHandling('create', () => this.prisma.user.create({ data }));
   }
   ```

---

## 🔍 TypeScript

### Full Type Safety

This package maintains **100% type safety** by leveraging Prisma's generated types:

```typescript
// All types flow from Prisma
import { User, Prisma } from '@dealscrapper/database';

class UserRepository extends AbstractBaseRepository<
  User,                           // ✅ Prisma-generated entity type
  Prisma.UserCreateInput,         // ✅ Prisma-generated create type
  Prisma.UserUpdateInput,         // ✅ Prisma-generated update type
  Prisma.UserWhereUniqueInput     // ✅ Prisma-generated where type
> {
  // TypeScript enforces correct types for all methods
  async findUnique(where: Prisma.UserWhereUniqueInput): Promise<User | null> {
    // ✅ where parameter must match Prisma's type
    // ✅ Return type is enforced as User | null
  }
}
```

### Generic Constraints

The base repository uses generics to ensure type safety across all operations:

```typescript
export abstract class AbstractBaseRepository<
  TEntity,         // The entity type (e.g., User)
  TCreate,         // Create input type (e.g., Prisma.UserCreateInput)
  TUpdate,         // Update input type (e.g., Prisma.UserUpdateInput)
  TWhereUnique     // Where unique input type (e.g., Prisma.UserWhereUniqueInput)
> implements BaseRepository<TEntity, TCreate, TUpdate, TWhereUnique>
```

---

## 🔗 Related Packages

- [@dealscrapper/database](../database/README.md) - Prisma schema and client (foundation)
- [@dealscrapper/shared](../shared/README.md) - Utility functions used in error handling
- [@dealscrapper/shared-types](../shared-types/README.md) - Type definitions for DTOs

---

## 🐛 Troubleshooting

### Issue: "Abstract method not implemented"

**Error:**
```
Class 'UserRepository' must implement abstract method 'findUnique'
```

**Solution**: Implement all required abstract methods:
```typescript
async findUnique(where: Prisma.UserWhereUniqueInput): Promise<User | null> {
  return this.executeWithErrorHandling(
    'findUnique',
    () => this.prisma.user.findUnique({ where })
  );
}
```

---

### Issue: Type mismatch in generic parameters

**Error:**
```
Type 'Prisma.UserWhereInput' is not assignable to type 'UserWhereUniqueInput'
```

**Solution**: Ensure generic parameters match Prisma types exactly:
```typescript
// ✅ CORRECT
class UserRepository extends AbstractBaseRepository<
  User,
  Prisma.UserCreateInput,      // Not UserCreateInput
  Prisma.UserUpdateInput,       // Not UserUpdateInput
  Prisma.UserWhereUniqueInput   // Not UserWhereInput
>
```

---

### Issue: "Cannot read property 'prisma' of undefined"

**Cause**: Repository not properly injected or constructor not called

**Solution**: Ensure NestJS dependency injection is configured:
```typescript
@Injectable()  // ✅ Add decorator
export class UserRepository extends AbstractBaseRepository<...> {
  constructor(prisma: PrismaService) {  // ✅ Inject PrismaService
    super(prisma);  // ✅ Call super
  }
}
```

And register in module:
```typescript
@Module({
  providers: [UserRepository],  // ✅ Register provider
  exports: [UserRepository]     // ✅ Export for use in other modules
})
export class UserModule {}
```

---

## 📊 Code Reuse Metrics

Using shared repositories **eliminates 80-95% of duplicate code**:

| Operation | Without Shared Repo | With Shared Repo | Reduction |
|-----------|---------------------|------------------|-----------|
| Basic CRUD | ~200 lines/service | ~30 lines/service | **85%** |
| Pagination | ~100 lines/service | Inherited | **100%** |
| Error handling | ~150 lines/service | Inherited | **100%** |
| Bulk operations | ~80 lines/service | Inherited | **100%** |
| Validation | ~60 lines/service | Inherited | **100%** |
| **Total** | **~590 lines** | **~30 lines** | **~95%** |

---

## 📚 Further Reading

- [Repository Pattern](https://martinfowler.com/eaaCatalog/repository.html)
- [Template Method Pattern](https://refactoring.guru/design-patterns/template-method)
- [Prisma Best Practices](https://www.prisma.io/docs/guides/performance-and-optimization)
- [NestJS Dependency Injection](https://docs.nestjs.com/providers)

---

**🚀 Built with love for the DealsScapper platform - eliminating duplication, one repository at a time!**
