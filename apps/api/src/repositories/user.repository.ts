import { Injectable } from '@nestjs/common';
import { PrismaService, Prisma } from '@dealscrapper/database';
import type { User } from '@dealscrapper/database';
import { AbstractBaseRepository } from '@dealscrapper/shared-repository';
import type {
  PaginationOptions,
  PaginatedResult,
} from '@dealscrapper/shared-repository';
import { calculatePaginationOffset } from '@dealscrapper/shared-repository';

/**
 * User repository interface defining all user-specific operations
 */
export interface IUserRepository {
  findByEmail(email: string): Promise<User | null>;
  findByEmailVerified(verified: boolean): Promise<User[]>;
  findRecentlyActive(days: number): Promise<User[]>;
  updateLastLogin(userId: string): Promise<User>;
  incrementLoginAttempts(userId: string): Promise<User>;
  resetLoginAttempts(userId: string): Promise<User>;
  lockUser(userId: string, until: Date): Promise<User>;
  verifyEmail(userId: string): Promise<User>;
  updateNotificationPreferences(
    userId: string,
    preferences: {
      emailNotifications?: boolean;
      marketingEmails?: boolean;
      weeklyDigest?: boolean;
    }
  ): Promise<User>;
  getUsersForDigest(frequency: 'daily' | 'weekly'): Promise<User[]>;
  searchUsers(
    query: string,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<User>>;
  healthCheck(): Promise<boolean>;
}

/**
 * User repository implementation with comprehensive user management operations
 */
@Injectable()
export class UserRepository
  extends AbstractBaseRepository<
    User,
    Prisma.UserCreateInput,
    Prisma.UserUpdateInput,
    Prisma.UserWhereUniqueInput
  >
  implements IUserRepository
{
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  protected getModel() {
    return this.prisma.user;
  }

  /**
   * Find user by unique identifier
   */
  async findUnique(where: Prisma.UserWhereUniqueInput): Promise<User | null> {
    return this.executeWithErrorHandling(
      'findUnique',
      () => this.prisma.user.findUnique({ where }),
      { where }
    );
  }

  /**
   * Find multiple users with optional filtering
   */
  async findMany(where?: Prisma.UserWhereInput): Promise<User[]> {
    return this.executeWithErrorHandling(
      'findMany',
      () => this.prisma.user.findMany({ where }),
      { where }
    );
  }

  /**
   * Find users with pagination support
   */
  async findManyPaginated(
    where?: Prisma.UserWhereInput,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<User>> {
    this.validatePagination(pagination);

    const page = pagination?.page || 1;
    const limit = pagination?.limit || 50;
    const skip = pagination?.offset || calculatePaginationOffset(page, limit);

    const [users, total] = await Promise.all([
      this.executeWithErrorHandling(
        'findManyPaginated',
        () =>
          this.prisma.user.findMany({
            where,
            skip,
            take: limit,
            orderBy: { createdAt: 'desc' },
          }),
        { where, pagination }
      ) as Promise<User[]>,
      this.count(where),
    ]);

    return {
      data: users,
      pagination: this.calculatePaginationMetadata(total, pagination),
    };
  }

  /**
   * Count users matching criteria
   */
  async count(where?: Prisma.UserWhereInput): Promise<number> {
    return this.executeWithErrorHandling(
      'count',
      () => this.prisma.user.count({ where }),
      { where }
    );
  }

  /**
   * Create a new user
   */
  async create(data: Prisma.UserCreateInput): Promise<User> {
    this.validateRequiredFields(data as Record<string, unknown>, [
      'email',
      'password',
    ]);

    return this.executeWithErrorHandling(
      'create',
      () => this.prisma.user.create({ data }),
      { data }
    );
  }

  /**
   * Create multiple users in a transaction
   */
  async createMany(data: Prisma.UserCreateInput[]): Promise<User[]> {
    return this.executeWithErrorHandling(
      'createMany',
      async () => {
        const users: User[] = [];
        for (const userData of data) {
          const user = await this.create(userData);
          users.push(user);
        }
        return users;
      },
      { count: data.length }
    );
  }

  /**
   * Update an existing user
   */
  async update(
    where: Prisma.UserWhereUniqueInput,
    data: Prisma.UserUpdateInput
  ): Promise<User> {
    return this.executeWithErrorHandling(
      'update',
      () => this.prisma.user.update({ where, data }),
      { where, data }
    );
  }

  /**
   * Update multiple users matching criteria
   */
  async updateMany(
    where: Prisma.UserWhereInput,
    data: Prisma.UserUpdateInput
  ): Promise<number> {
    const result = (await this.executeWithErrorHandling(
      'updateMany',
      () => this.prisma.user.updateMany({ where, data }),
      { where, data }
    )) as { count: number };
    return result.count;
  }

  /**
   * Delete a user
   */
  async delete(where: Prisma.UserWhereUniqueInput): Promise<User> {
    return this.executeWithErrorHandling(
      'delete',
      () => this.prisma.user.delete({ where }),
      { where }
    );
  }

  /**
   * Delete multiple users matching criteria
   */
  async deleteMany(where: Prisma.UserWhereInput): Promise<number> {
    const result = (await this.executeWithErrorHandling(
      'deleteMany',
      () => this.prisma.user.deleteMany({ where }),
      { where }
    )) as { count: number };
    return result.count;
  }

  /**
   * Create or update a user (upsert operation)
   */
  async upsert(
    where: Prisma.UserWhereUniqueInput,
    create: Prisma.UserCreateInput,
    update: Prisma.UserUpdateInput
  ): Promise<User> {
    return this.executeWithErrorHandling(
      'upsert',
      () => this.prisma.user.upsert({ where, create, update }),
      { where, create, update }
    );
  }

  /**
   * Check if a user exists
   */
  async exists(where: Prisma.UserWhereUniqueInput): Promise<boolean> {
    const user = await this.findUnique(where);
    return user !== null;
  }

  // User-specific methods

  /**
   * Find user by email address
   */
  async findByEmail(email: string): Promise<User | null> {
    return this.findUnique({ email });
  }

  /**
   * Find users by email verification status
   */
  async findByEmailVerified(verified: boolean): Promise<User[]> {
    return this.findMany({ emailVerified: verified });
  }

  /**
   * Find users who have been active recently
   */
  async findRecentlyActive(days: number): Promise<User[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    return this.findMany({
      lastLoginAt: {
        gte: cutoffDate,
      },
    });
  }

  /**
   * Update user's last login timestamp
   */
  async updateLastLogin(userId: string): Promise<User> {
    return this.update(
      { id: userId },
      {
        lastLoginAt: new Date(),
        loginAttempts: 0, // Reset login attempts on successful login
      }
    );
  }

  /**
   * Increment failed login attempts
   */
  async incrementLoginAttempts(userId: string): Promise<User> {
    return this.executeWithErrorHandling(
      'incrementLoginAttempts',
      () =>
        this.prisma.user.update({
          where: { id: userId },
          data: {
            loginAttempts: { increment: 1 },
          },
        }),
      { userId }
    );
  }

  /**
   * Reset failed login attempts to zero
   */
  async resetLoginAttempts(userId: string): Promise<User> {
    return this.update({ id: userId }, { loginAttempts: 0 });
  }

  /**
   * Lock user account until specified date
   */
  async lockUser(userId: string, until: Date): Promise<User> {
    return this.update({ id: userId }, { lockedUntil: until });
  }

  /**
   * Verify user's email address
   */
  async verifyEmail(userId: string): Promise<User> {
    return this.update(
      { id: userId },
      {
        emailVerified: true,
        emailVerifiedAt: new Date(),
      }
    );
  }

  /**
   * Update user's notification preferences
   */
  async updateNotificationPreferences(
    userId: string,
    preferences: {
      emailNotifications?: boolean;
      marketingEmails?: boolean;
      weeklyDigest?: boolean;
    }
  ): Promise<User> {
    return this.update({ id: userId }, preferences);
  }

  /**
   * Get users eligible for digest notifications
   */
  async getUsersForDigest(frequency: 'daily' | 'weekly'): Promise<User[]> {
    const digestField =
      frequency === 'daily' ? 'emailNotifications' : 'weeklyDigest';

    return this.findMany({
      [digestField]: true,
      emailVerified: true,
      lockedUntil: {
        lt: new Date(), // Not locked or lock has expired
      },
    });
  }

  /**
   * Search users by name or email
   */
  async searchUsers(
    query: string,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<User>> {
    const searchTerms = query
      .trim()
      .split(' ')
      .filter((term) => term.length > 0);

    const whereCondition: Prisma.UserWhereInput = {
      OR: [
        { email: { contains: query, mode: Prisma.QueryMode.insensitive } },
        { firstName: { contains: query, mode: Prisma.QueryMode.insensitive } },
        { lastName: { contains: query, mode: Prisma.QueryMode.insensitive } },
        ...(searchTerms.length > 1
          ? [
              {
                AND: [
                  {
                    firstName: {
                      contains: searchTerms[0],
                      mode: Prisma.QueryMode.insensitive,
                    },
                  },
                  {
                    lastName: {
                      contains: searchTerms[1],
                      mode: Prisma.QueryMode.insensitive,
                    },
                  },
                ],
              },
            ]
          : []),
      ],
    };

    return this.findManyPaginated(whereCondition, pagination);
  }

  /**
   * Repository health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.count();
      return true;
    } catch {
      return false;
    }
  }
}
