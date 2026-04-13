import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule, PrismaService } from '@dealscrapper/database';
import {
  SharedConfigModule,
  SharedConfigService,
} from '@dealscrapper/shared-config';
import { SharedHealthModule } from '@dealscrapper/shared-health';
import { AuthModule } from './auth/auth.module.js';
import { UsersModule } from './users/users.module.js';
import { FiltersModule } from './filters/filters.module.js';
import { CategoriesModule } from './categories/categories.module.js';
import { ArticlesModule } from './articles/articles.module.js';
import { SitesModule } from './sites/sites.module.js';
import { AdminModule } from './admin/admin.module.js';
import { ApiHealthService } from './health/api-health.service.js';
import { BullModule } from '@nestjs/bull';
import { GlobalJwtAuthGuard } from './auth/guards/global-jwt-auth.guard.js';
import { RolesGuard } from './auth/guards/roles.guard.js';
import { DatabaseSeederService } from './common/services/database-seeder.service.js';

@Module({
  imports: [
    // SharedConfigModule with strict environment validation
    SharedConfigModule.forRoot({
      serviceName: 'API',
      envConfig: {
        // Infrastructure & Common
        NODE_ENV: 'REQUIRED', // Currently defaults to 'development'
        DATABASE_URL: 'REQUIRED', // Required by Prisma, no fallback
        PORT: 'REQUIRED', // Currently defaults to 3001
        LOG_LEVEL: 'REQUIRED', // Currently defaults to 'info'
        APP_VERSION: 'REQUIRED', // Currently defaults to '1.0.0'
        APP_NAME: 'REQUIRED', // Application name

        // Redis Configuration
        REDIS_HOST: 'REQUIRED', // Currently defaults to 'localhost'
        REDIS_PORT: 'REQUIRED', // Currently defaults to 6379
        REDIS_DB: 'REQUIRED', // Currently defaults to 1

        // Authentication & Security
        JWT_SECRET: 'REQUIRED', // Critical for auth, no fallback
        JWT_EXPIRES_IN: 'REQUIRED', // Currently defaults to '15m'
        JWT_REFRESH_SECRET: 'REQUIRED', // Required for refresh tokens
        JWT_REFRESH_EXPIRES_IN: 'REQUIRED', // Required for refresh tokens
        EMAIL_VERIFICATION_SECRET: 'REQUIRED', // Currently falls back to JWT_SECRET
        EMAIL_VERIFICATION_EXPIRES_IN: 'REQUIRED', // Currently defaults to '24h'
        PASSWORD_RESET_SECRET: 'REQUIRED', // Secret for password reset JWT tokens
        PASSWORD_RESET_EXPIRES_IN: 'OPTIONAL', // Default: '30m' (set in PasswordResetService)
        BCRYPT_ROUNDS: 'REQUIRED', // Currently defaults to '12'

        // API Configuration
        WEB_APP_URL: 'REQUIRED', // Currently defaults to 'http://localhost:3000'
        CORS_ORIGIN: 'REQUIRED', // Currently defaults to 'http://localhost:3000'
        SCHEDULER_URL: 'REQUIRED', // Required for external service health checks
        NOTIFIER_URL: 'REQUIRED', // Required for notifier health checks

        // Rate Limiting
        RATE_LIMIT_WINDOW_MS: 'REQUIRED', // Currently defaults to '900000'
        RATE_LIMIT_MAX_REQUESTS: 'REQUIRED', // Currently defaults to '100'
        AUTH_RATE_LIMIT_WINDOW_MS: 'REQUIRED', // Auth-specific rate limiting
        AUTH_RATE_LIMIT_MAX_REQUESTS: 'REQUIRED', // Auth-specific rate limiting
      },
    }),
    // Shared health module with API configuration and custom health service
    SharedHealthModule.forRootAsync({
      useFactory: (sharedConfig: SharedConfigService) => ({
        serviceName: 'api',
        version: sharedConfig.get('APP_VERSION'),
        environment: sharedConfig.get('NODE_ENV'),
      }),
      inject: [SharedConfigService],
      healthServiceFactory: {
        useFactory: (prisma: PrismaService, sharedConfig: SharedConfigService) =>
          new ApiHealthService(prisma, null, sharedConfig),
        inject: [PrismaService, SharedConfigService],
      },
    }),
    BullModule.forRootAsync({
      useFactory: (sharedConfig: SharedConfigService) => ({
        redis: sharedConfig.getBullMQRedisConfig(),
      }),
      inject: [SharedConfigService],
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    FiltersModule,
    CategoriesModule,
    ArticlesModule,
    SitesModule,
    AdminModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: GlobalJwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    DatabaseSeederService,
  ],
})
export class AppModule {}
