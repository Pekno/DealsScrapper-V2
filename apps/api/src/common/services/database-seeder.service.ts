import { Injectable } from '@nestjs/common';
import { PrismaService, Role } from '@dealscrapper/database';
import * as bcrypt from 'bcryptjs';
import { createServiceLogger } from '@dealscrapper/shared-logging';
import { apiLogConfig } from '../../config/logging.config.js';

@Injectable()
export class DatabaseSeederService {
  private readonly logger = createServiceLogger(apiLogConfig);

  constructor(private prisma: PrismaService) {}

  async seedDefaultUser(): Promise<void> {
    if (process.env.NODE_ENV === 'production') {
      this.logger.warn('🚫 Skipping dev user seeding in production');
      return;
    }

    const defaultUser = {
      email: 'user@example.com',
      password: 'StrongP@ssw0rd',
      firstName: 'John',
      lastName: 'Doe',
    };

    try {
      // Check if user already exists
      const existingUser = await this.prisma.user.findUnique({
        where: { email: defaultUser.email },
      });

      if (existingUser) {
        this.logger.log(
          `👤 Default dev user already exists: ${defaultUser.email}`
        );
        return;
      }

      // Hash password
      const saltRounds = parseInt(process.env.BCRYPT_ROUNDS || '12');
      const hashedPassword = await bcrypt.hash(
        defaultUser.password,
        saltRounds
      );

      // Create user
      await this.prisma.user.create({
        data: {
          email: defaultUser.email,
          password: hashedPassword,
          firstName: defaultUser.firstName,
          lastName: defaultUser.lastName,
          emailVerified: true, // Pre-verified for dev convenience
          emailNotifications: true,
          marketingEmails: false,
          weeklyDigest: true,
          timezone: 'UTC',
          locale: 'en',
        },
      });

      this.logger.log(`✅ User created successfully`);
    } catch (error) {
      this.logger.error(
        `❌ Failed to create default dev user:`,
        (error as Error).message
      );
    }
  }

  async seedAdminUser(): Promise<void> {
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminEmail) {
      this.logger.log('ADMIN_EMAIL not set — skipping admin user seeding');
      return;
    }

    try {
      const existingUser = await this.prisma.user.findUnique({
        where: { email: adminEmail },
      });

      const saltRounds = parseInt(process.env.BCRYPT_ROUNDS || '12');

      if (existingUser) {
        if (existingUser.role === Role.ADMIN) {
          this.logger.log(
            `👤 Admin user already exists: ${adminEmail}`
          );
          return;
        }

        // Promote existing user to admin
        await this.prisma.user.update({
          where: { email: adminEmail },
          data: { role: Role.ADMIN },
        });

        this.logger.log(`⬆️ Promoted existing user to admin: ${adminEmail}`);
        return;
      }

      if (!adminPassword) {
        this.logger.warn(`ADMIN_PASSWORD not set — cannot create new admin user for ${adminEmail}, skipping`);
        return;
      }

      // Create admin user
      const hashedPassword = await bcrypt.hash(adminPassword, saltRounds);

      await this.prisma.user.create({
        data: {
          email: adminEmail,
          password: hashedPassword,
          firstName: 'Admin',
          lastName: 'User',
          role: Role.ADMIN,
          emailVerified: true,
          emailNotifications: true,
          marketingEmails: false,
          weeklyDigest: true,
          timezone: 'UTC',
          locale: 'en',
        },
      });

      this.logger.log('✅ User created successfully');
    } catch (error) {
      this.logger.error(
        `❌ Failed to seed admin user:`,
        (error as Error).message
      );
    }
  }
}
