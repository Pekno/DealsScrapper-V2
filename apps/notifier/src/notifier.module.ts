import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '@dealscrapper/database';
import {
  SharedConfigModule,
  SharedConfigService,
} from '@dealscrapper/shared-config';
import {
  SharedHealthModule,
  BaseHealthService,
} from '@dealscrapper/shared-health';

// Import modules
import { WebSocketModule } from './websocket/websocket.module.js';
import { ProcessorsModule } from './processors/processors.module.js';
import { ServicesModule } from './services/services.module.js';
import { ChannelsModule } from './channels/channels.module.js';
import { JobsModule } from './jobs/jobs.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { NotifierHealthService } from './health/notifier-health.service.js';

@Module({
  imports: [
    // SharedConfigModule with strict environment validation
    SharedConfigModule.forRoot({
      serviceName: 'NOTIFIER',
      envConfig: {
        // Infrastructure & Common
        NODE_ENV: 'REQUIRED', // Currently defaults to 'development'
        DATABASE_URL: 'REQUIRED', // Required by Prisma, no fallback
        LOG_LEVEL: 'REQUIRED', // Currently defaults to 'info'
        NOTIFIER_PORT: 'REQUIRED', // Currently defaults to 3003
        APP_NAME: 'REQUIRED', // Currently defaults to 'DealScrapper'
        APP_VERSION: 'REQUIRED', // Currently defaults to '1.0.0'

        // Authentication
        JWT_SECRET: 'REQUIRED', // Currently defaults to 'dev-secret-key'
        JWT_EXPIRES_IN: 'REQUIRED', // Currently defaults to '24h'

        // Redis Configuration
        REDIS_HOST: 'REQUIRED', // Currently defaults to 'localhost'
        REDIS_PORT: 'REQUIRED', // Currently defaults to 6379
        REDIS_DB: 'REQUIRED', // Currently defaults to 1 or 0

        // Email Provider Selection — optional; leave unset to disable email sending entirely
        EMAIL_PROVIDER: 'OPTIONAL', // 'gmail' | 'resend' | 'mailhog' | unset = disabled

        // Email Configuration (Gmail OAuth2) - OPTIONAL, only needed when EMAIL_PROVIDER=gmail
        GMAIL_CLIENT_ID: 'OPTIONAL',
        GMAIL_CLIENT_SECRET: 'OPTIONAL',
        GMAIL_REFRESH_TOKEN: 'OPTIONAL',
        GMAIL_USER_EMAIL: 'OPTIONAL',
        GMAIL_REDIRECT_URI: 'OPTIONAL',

        // Email Configuration (Resend) - OPTIONAL, only needed when EMAIL_PROVIDER=resend
        RESEND_API_KEY: 'OPTIONAL',

        // Email Configuration (MailHog/Test) - OPTIONAL, only needed when EMAIL_PROVIDER=mailhog
        EMAIL_HOST: 'OPTIONAL',
        EMAIL_PORT: 'OPTIONAL',

        // Email Branding & Content — only required when EMAIL_PROVIDER is set
        FROM_EMAIL: 'OPTIONAL',
        FROM_NAME: 'OPTIONAL',
        WEB_APP_URL: 'REQUIRED', // Currently defaults to 'http://localhost:3000'
        BRAND_PRIMARY_COLOR: 'REQUIRED', // Currently defaults to '#3B82F6'
        SUPPORT_EMAIL: 'REQUIRED', // Currently defaults to 'support@dealscrapper.com'

        // Optional Variables
        REDIS_PASSWORD: 'OPTIONAL', // undefined is acceptable (no auth)
        BRAND_LOGO_URL: 'OPTIONAL', // undefined is acceptable
        UNSUBSCRIBE_BASE_URL: 'OPTIONAL', // undefined is acceptable
      },
    }),

    // Database
    PrismaModule,

    // JWT for authentication
    JwtModule.registerAsync({
      useFactory: async (sharedConfig: SharedConfigService) => {
        const jwtConfig = sharedConfig.getJwtConfig();
        return {
          secret: jwtConfig.secret,
          signOptions: {
            expiresIn: jwtConfig.expiresIn,
          },
        };
      },
      inject: [SharedConfigService],
    }),

    // Bull Queue for Redis (Bull v4, NOT BullMQ - use standard Redis config)
    BullModule.forRootAsync({
      useFactory: async (sharedConfig: SharedConfigService) => {
        // CRITICAL: Exclude commandTimeout for Bull v4 processors
        // Bull uses BRPOP (blocking Redis command) which needs to wait indefinitely for jobs.
        // The 5-second commandTimeout from getRedisConfig() causes "Command timed out" errors.
        // See: https://github.com/OptimalBits/bull/issues/1873
        const { commandTimeout, ...bullRedisConfig } = sharedConfig.getBullMQRedisConfig();

        return {
          redis: bullRedisConfig,
          defaultJobOptions: {
            removeOnComplete: 100,
            removeOnFail: 50,
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 2000,
            },
          },
        };
      },
      inject: [SharedConfigService],
    }),

    // Register notification queue - MUST be in same module as BullModule.forRootAsync
    BullModule.registerQueue({
      name: 'notifications',
    }),

    // Shared health module with notifier configuration
    SharedHealthModule.forRootAsync({
      useFactory: (sharedConfig: SharedConfigService) => ({
        serviceName: 'notifier',
        version: sharedConfig.get('APP_VERSION'),
        environment: sharedConfig.get('NODE_ENV'),
      }),
      inject: [SharedConfigService],
    }),

    // Feature modules
    WebSocketModule,
    ProcessorsModule,
    ServicesModule,
    ChannelsModule,
    JobsModule,
    NotificationsModule,
  ],
  controllers: [],
  providers: [
    // Override the base health service with our custom implementation
    {
      provide: BaseHealthService,
      useClass: NotifierHealthService,
    },
  ],
})
export class NotifierModule {}
