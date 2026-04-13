import { Injectable } from '@nestjs/common';
import { PrismaService } from '@dealscrapper/database';

export interface User {
  id: string;
  email: string;
  password: string;
  role: string;
  createdAt: Date;
  updatedAt: Date;
  emailVerified: boolean;
  emailVerifiedAt?: Date | null;
  lastLoginAt?: Date | null;
  passwordChangedAt?: Date | null;
  loginAttempts: number;
  lockedUntil?: Date | null;
  firstName?: string | null;
  lastName?: string | null;
  timezone?: string | null;
  locale?: string | null;
  emailNotifications: boolean;
  marketingEmails: boolean;
  weeklyDigest: boolean;
}

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  /**
   * Finds a user by their email address
   * @param email - The email address to search for
   * @returns The user if found, null otherwise
   */
  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  /**
   * Finds a user by their unique identifier
   * @param id - The unique identifier of the user
   * @returns The user if found, null otherwise
   */
  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  /**
   * Creates a new user account
   * @param data - User creation data including email and password
   * @param data.email - User's email address
   * @param data.password - User's hashed password
   * @param data.firstName - Optional first name
   * @param data.lastName - Optional last name
   * @returns The newly created user
   */
  async create(data: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
  }): Promise<User> {
    return this.prisma.user.create({
      data,
    });
  }

  /**
   * Updates user account information
   * @param id - The unique identifier of the user to update
   * @param data - Partial user data to update
   * @returns The updated user
   */
  async update(
    id: string,
    data: Partial<{
      email: string;
      password: string;
      firstName: string;
      lastName: string;
      timezone: string;
      locale: string;
      emailNotifications: boolean;
      marketingEmails: boolean;
      weeklyDigest: boolean;
      passwordChangedAt: Date;
    }>
  ): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data,
    });
  }

  /**
   * Updates user profile information (name, timezone, locale)
   * @param id - The unique identifier of the user to update
   * @param data - Profile data to update
   * @param data.firstName - Optional first name
   * @param data.lastName - Optional last name
   * @param data.timezone - Optional timezone
   * @param data.locale - Optional locale
   * @returns The updated user without password field
   */
  async updateProfile(
    id: string,
    data: {
      firstName?: string;
      lastName?: string;
      timezone?: string;
      locale?: string;
    }
  ): Promise<Omit<User, 'password'>> {
    const user = await this.prisma.user.update({
      where: { id },
      data,
    });

    return this.excludePassword(user);
  }

  /**
   * Updates user notification preferences
   * @param id - The unique identifier of the user to update
   * @param data - Notification preferences to update
   * @param data.emailNotifications - Enable/disable email notifications
   * @param data.marketingEmails - Enable/disable marketing emails
   * @param data.weeklyDigest - Enable/disable weekly digest
   * @returns The updated user without password field
   */
  async updateNotificationPreferences(
    id: string,
    data: {
      emailNotifications?: boolean;
      marketingEmails?: boolean;
      weeklyDigest?: boolean;
    }
  ): Promise<Omit<User, 'password'>> {
    const user = await this.prisma.user.update({
      where: { id },
      data,
    });

    return this.excludePassword(user);
  }

  /**
   * Deletes a user account
   * @param id - The unique identifier of the user to delete
   * @returns The deleted user
   */
  async delete(id: string): Promise<User> {
    return this.prisma.user.delete({
      where: { id },
    });
  }

  /**
   * Marks a user's email as verified and records verification timestamp
   * @param userId - Unique identifier of the user to verify
   * @returns Updated user with verification status
   * @throws Error if user not found
   */
  async verifyEmail(userId: string): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        emailVerified: true,
        emailVerifiedAt: new Date(),
      },
    });
  }

  /**
   * Helper method to exclude password from user object
   * @param user - The user object with password
   * @returns The user object without password field
   */
  private excludePassword(user: User): Omit<User, 'password'> {
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword as Omit<User, 'password'>;
  }
}
