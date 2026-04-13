import { PrismaService } from '@dealscrapper/database';
import { Logger } from '@nestjs/common';
import type {
  RepositoryError,
  PaginationOptions,
  PaginatedResult,
} from './interfaces.js';

/**
 * Generic type representing any Prisma model delegate.
 *
 * This type uses a minimal interface with loosely-typed methods to be compatible
 * with any Prisma-generated delegate type. The actual type safety is enforced
 * at the repository implementation level where specific Prisma types are used.
 *
 * Why this approach:
 * 1. Prisma delegates have complex generic signatures that are hard to replicate
 * 2. Prisma uses different types for `WhereInput` vs `WhereUniqueInput`
 * 3. Prisma's `createMany` uses `CreateManyInput` which differs from `CreateInput`
 * 4. Each repository implementation uses the actual Prisma delegate directly
 *
 * The base repository methods handle the type casting internally, ensuring
 * type safety while allowing any Prisma delegate to be returned by getModel().
 */
export interface PrismaModelDelegate {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  findUnique(args: any): Promise<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  findFirst(args: any): Promise<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  findMany(args?: any): Promise<any[]>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  create(args: any): Promise<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  update(args: any): Promise<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updateMany(args: any): Promise<{ count: number }>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  upsert(args: any): Promise<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete(args: any): Promise<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  deleteMany(args: any): Promise<{ count: number }>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  count(args?: any): Promise<number>;
}

/**
 * Base repository interface that all repositories should implement
 * Provides common patterns for database operations with type safety
 */
export interface BaseRepository<T, CreateInput, UpdateInput, WhereInput> {
  /**
   * Find a single entity by unique identifier
   * @param where - Unique identifier criteria
   * @returns Entity or null if not found
   */
  findUnique(where: WhereInput): Promise<T | null>;

  /**
   * Find multiple entities based on criteria
   * @param where - Search criteria (optional)
   * @returns Array of matching entities
   */
  findMany(where?: WhereInput): Promise<T[]>;

  /**
   * Find entities with pagination support
   * @param where - Search criteria (optional)
   * @param pagination - Pagination options
   * @returns Paginated result with entities and metadata
   */
  findManyPaginated(
    where?: WhereInput,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<T>>;

  /**
   * Count entities matching criteria
   * @param where - Search criteria (optional)
   * @returns Count of matching entities
   */
  count(where?: WhereInput): Promise<number>;

  /**
   * Create a new entity
   * @param data - Entity creation data
   * @returns Created entity
   */
  create(data: CreateInput): Promise<T>;

  /**
   * Create multiple entities in a transaction
   * @param data - Array of entity creation data
   * @returns Array of created entities
   */
  createMany(data: CreateInput[]): Promise<T[]>;

  /**
   * Update an existing entity
   * @param where - Unique identifier criteria
   * @param data - Update data
   * @returns Updated entity
   */
  update(where: WhereInput, data: UpdateInput): Promise<T>;

  /**
   * Update multiple entities matching criteria
   * @param where - Search criteria
   * @param data - Update data
   * @returns Number of updated entities
   */
  updateMany(where: WhereInput, data: UpdateInput): Promise<number>;

  /**
   * Delete an entity
   * @param where - Unique identifier criteria
   * @returns Deleted entity
   */
  delete(where: WhereInput): Promise<T>;

  /**
   * Delete multiple entities matching criteria
   * @param where - Search criteria
   * @returns Number of deleted entities
   */
  deleteMany(where: WhereInput): Promise<number>;

  /**
   * Create or update an entity (upsert operation)
   * @param where - Unique identifier criteria
   * @param create - Data for creation if entity doesn't exist
   * @param update - Data for update if entity exists
   * @returns Created or updated entity
   */
  upsert(
    where: WhereInput,
    create: CreateInput,
    update: UpdateInput
  ): Promise<T>;

  /**
   * Check if an entity exists
   * @param where - Search criteria
   * @returns True if entity exists, false otherwise
   */
  exists(where: WhereInput): Promise<boolean>;
}

/**
 * Abstract base repository implementation
 * Provides common dependency injection, error handling, and utility patterns
 * Contains 13 generic CRUD methods to eliminate code duplication across repositories
 */
export abstract class AbstractBaseRepository<
  T,
  CreateInput,
  UpdateInput,
  WhereInput,
> implements BaseRepository<T, CreateInput, UpdateInput, WhereInput>
{
  protected readonly logger = new Logger(this.constructor.name);
  
  constructor(protected readonly prisma: PrismaService) {}

  /**
   * Get the Prisma model delegate for this repository
   * Each repository must implement this to return the correct model
   * The returned delegate is loosely typed to be compatible with any Prisma model.
   * @example protected getModel() { return this.prisma.article; }
   */
  protected abstract getModel(): PrismaModelDelegate;

  /**
   * Get default includes for queries
   * Override in child classes for repository-specific includes
   * @returns Prisma include object
   */
  protected getDefaultIncludes(): Record<string, boolean | object> | undefined {
    return {};
  }

  /**
   * Get default ordering for queries
   * Override in child classes for repository-specific ordering
   * @returns Prisma orderBy object
   */
  protected getDefaultOrderBy(): Record<string, 'asc' | 'desc'> | Record<string, 'asc' | 'desc'>[] | undefined {
    return { createdAt: 'desc' };
  }

  /**
   * Get required fields for entity creation
   * Override in child classes to validate required fields
   * @returns Array of required field names
   */
  protected getRequiredCreateFields(): string[] {
    return [];
  }

  // ==================== CRUD Methods ====================

  /**
   * Performs a health check by executing a simple count query
   * @returns true if database is accessible, false otherwise
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.count();
      return true;
    } catch (error) {
      this.logger.error('Repository health check failed', error);
      return false;
    }
  }

  /**
   * Count entities matching the where clause
   * @param where Optional filter criteria
   * @returns Number of matching entities
   */
  async count(where?: WhereInput): Promise<number> {
    return this.executeWithErrorHandling(
      'count',
      () => this.getModel().count({ where }),
      { where }
    );
  }

  /**
   * Check if an entity exists
   * @param where Unique identifier
   * @returns true if entity exists, false otherwise
   */
  async exists(where: WhereInput): Promise<boolean> {
    const entity = await this.findUnique(where);
    return entity !== null;
  }

  /**
   * Find a single entity by unique identifier
   * @param where Unique identifier
   * @returns Entity if found, null otherwise
   */
  async findUnique(where: WhereInput): Promise<T | null> {
    return this.executeWithErrorHandling(
      'findUnique',
      () =>
        this.getModel().findUnique({
          where,
          include: this.getDefaultIncludes(),
        }),
      { where }
    );
  }

  /**
   * Find multiple entities
   * @param where Optional filter criteria
   * @returns Array of matching entities
   */
  async findMany(where?: WhereInput): Promise<T[]> {
    return this.executeWithErrorHandling(
      'findMany',
      () =>
        this.getModel().findMany({
          where,
          include: this.getDefaultIncludes(),
          orderBy: this.getDefaultOrderBy(),
        }),
      { where }
    );
  }

  /**
   * Create a new entity
   * @param data Entity creation data
   * @returns Created entity
   */
  async create(data: CreateInput): Promise<T> {
    this.validateRequiredFields(
      data as Record<string, unknown>,
      this.getRequiredCreateFields()
    );

    return this.executeWithErrorHandling(
      'create',
      () =>
        this.getModel().create({
          data,
          include: this.getDefaultIncludes(),
        }),
      { data }
    );
  }

  /**
   * Update an existing entity
   * @param where Unique identifier
   * @param data Update data
   * @returns Updated entity
   */
  async update(where: WhereInput, data: UpdateInput): Promise<T> {
    return this.executeWithErrorHandling(
      'update',
      () =>
        this.getModel().update({
          where,
          data,
          include: this.getDefaultIncludes(),
        }),
      { where, data }
    );
  }

  /**
   * Delete an entity
   * @param where Unique identifier
   * @returns Deleted entity
   */
  async delete(where: WhereInput): Promise<T> {
    return this.executeWithErrorHandling(
      'delete',
      () =>
        this.getModel().delete({
          where,
          include: this.getDefaultIncludes(),
        }),
      { where }
    );
  }

  /**
   * Create or update an entity
   * @param where Unique identifier
   * @param create Data for creation
   * @param update Data for update
   * @returns Created or updated entity
   */
  async upsert(
    where: WhereInput,
    create: CreateInput,
    update: UpdateInput
  ): Promise<T> {
    return this.executeWithErrorHandling(
      'upsert',
      () =>
        this.getModel().upsert({
          where,
          create,
          update,
          include: this.getDefaultIncludes(),
        }),
      { where, create, update }
    );
  }

  /**
   * Create multiple entities
   * @param data Array of creation data
   * @returns Array of created entities
   */
  async createMany(data: CreateInput[]): Promise<T[]> {
    return this.executeWithErrorHandling(
      'createMany',
      async () => {
        const results = await Promise.all(
          data.map((item) => this.create(item))
        );
        return results;
      },
      { count: data.length }
    );
  }

  /**
   * Update multiple entities
   * @param where Filter criteria
   * @param data Update data
   * @returns Number of updated entities
   */
  async updateMany(where: WhereInput, data: UpdateInput): Promise<number> {
    return this.executeWithErrorHandling(
      'updateMany',
      async () => {
        const result = await this.getModel().updateMany({ where, data });
        return result.count;
      },
      { where, data }
    );
  }

  /**
   * Delete multiple entities
   * @param where Filter criteria
   * @returns Number of deleted entities
   */
  async deleteMany(where: WhereInput): Promise<number> {
    return this.executeWithErrorHandling(
      'deleteMany',
      async () => {
        const result = await this.getModel().deleteMany({ where });
        return result.count;
      },
      { where }
    );
  }

  /**
   * Find entities with pagination
   * @param where Optional filter criteria
   * @param pagination Pagination options (page, limit, offset)
   * @returns Paginated result with data and metadata
   */
  async findManyPaginated(
    where?: WhereInput,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<T>> {
    this.validatePagination(pagination);

    const page = pagination?.page || 1;
    const limit = Math.min(pagination?.limit || 50, 100);
    const skip = pagination?.offset ?? (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.executeWithErrorHandling<T[]>(
        'findManyPaginated',
        () =>
          this.getModel().findMany({
            where,
            skip,
            take: limit,
            orderBy: this.getDefaultOrderBy(),
            include: this.getDefaultIncludes(),
          }),
        { where, pagination }
      ),
      this.count(where),
    ]);

    return {
      data,
      pagination: this.calculatePaginationMetadata(total, pagination),
    };
  }

  // ==================== Utility Methods ====================

  /**
   * Handle common database errors and provide meaningful error messages
   * @param error - Database error to handle
   * @param operation - Operation that failed
   * @param context - Additional context for debugging
   * @throws RepositoryError with additional context
   */
  protected handleDatabaseError(
    error: unknown,
    operation: string,
    context?: Record<string, unknown>
  ): never {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const repositoryError: RepositoryError = {
      operation,
      originalError: errorMessage,
      context,
      timestamp: new Date().toISOString(),
    };

    // Log error for monitoring
    this.logger.error('Repository Error', repositoryError);

    throw new Error(
      `${operation} failed: ${errorMessage}${context ? ` - Context: ${JSON.stringify(context)}` : ''}`
    );
  }

  /**
   * Validate that required fields are present
   * @param data - Data to validate
   * @param requiredFields - Array of required field names
   * @throws Error if any required field is missing
   */
  protected validateRequiredFields(
    data: Record<string, unknown>,
    requiredFields: string[]
  ): void {
    const missingFields = requiredFields.filter(
      (field) =>
        data[field] === undefined || data[field] === null || data[field] === ''
    );

    if (missingFields.length > 0) {
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }
  }

  /**
   * Validate pagination parameters
   * @param pagination - Pagination options to validate
   * @throws Error if pagination parameters are invalid
   */
  protected validatePagination(pagination?: PaginationOptions): void {
    if (!pagination) return;

    if (pagination.page && pagination.page < 1) {
      throw new Error('Page number must be greater than 0');
    }

    if (pagination.limit && (pagination.limit < 1 || pagination.limit > 1000)) {
      throw new Error('Limit must be between 1 and 1000');
    }
  }

  /**
   * Calculate pagination metadata
   * @param total - Total number of entities
   * @param pagination - Pagination options
   * @returns Pagination metadata
   */
  protected calculatePaginationMetadata(
    total: number,
    pagination?: PaginationOptions
  ): PaginatedResult<T>['pagination'] {
    if (!pagination) {
      return {
        total,
        page: 1,
        limit: total,
        pages: 1,
        hasNext: false,
        hasPrev: false,
      };
    }

    const page = pagination.page || 1;
    const limit = pagination.limit || 50;
    const pages = Math.ceil(total / limit);

    return {
      total,
      page,
      limit,
      pages,
      hasNext: page < pages,
      hasPrev: page > 1,
    };
  }

  /**
   * Execute a database operation with error handling
   * @param operation - Operation name for logging
   * @param dbOperation - Database operation to execute
   * @param context - Additional context for error handling
   * @returns Result of the database operation
   */
  protected async executeWithErrorHandling<TResult>(
    operation: string,
    dbOperation: () => Promise<TResult>,
    context?: Record<string, unknown>
  ): Promise<TResult> {
    try {
      return await dbOperation();
    } catch (error) {
      this.handleDatabaseError(error, operation, context);
    }
  }
}
