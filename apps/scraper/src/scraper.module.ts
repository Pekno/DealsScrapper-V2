import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bull';
import { PrismaModule, PrismaService } from '@dealscrapper/database';
import {
  SharedConfigModule,
  SharedConfigService,
} from '@dealscrapper/shared-config';
import { SharedHealthModule } from '@dealscrapper/shared-health';

import { CategoryDiscoveryModule } from './category-discovery/category-discovery.module.js';
// Legacy PageScrapingModule and DealExtractionModule removed - replaced by multi-site processors
import { PuppeteerPoolModule } from './puppeteer-pool/puppeteer-pool.module.js';
import { PuppeteerPoolService } from './puppeteer-pool/puppeteer-pool.service.js';
import { JobProcessorModule } from './job-processor/job-processor.module.js';
import { FilterMatchingModule } from './filter-matching/filter-matching.module.js';
import { NotificationModule } from './notification/notification.module.js';
// Removed CategoryMonitorModule - monitoring handled by scheduler
import { ScraperHealthService } from './health/scraper-health.service.js';
import { DealElasticSearchModule } from './elasticsearch/elasticsearch.module.js';
import { WorkerRegistrationModule } from './worker-registration/worker-registration.module.js';

@Module({
  imports: [
    // SharedConfigModule with strict environment validation
    SharedConfigModule.forRoot({
      serviceName: 'SCRAPER',
      envConfig: {
        // Infrastructure & Common
        NODE_ENV: 'REQUIRED', // Currently defaults to 'development'
        DATABASE_URL: 'REQUIRED', // Required by Prisma, no fallback
        LOG_LEVEL: 'REQUIRED', // Currently defaults to 'debug'
        SCRAPER_PORT: 'REQUIRED', // Currently defaults to 3002
        APP_VERSION: 'REQUIRED', // Currently defaults to '1.0.0'

        // Redis Configuration (Critical for job processing)
        REDIS_HOST: 'REQUIRED', // Currently defaults to 'localhost'
        REDIS_PORT: 'REQUIRED', // Currently defaults to 6379
        REDIS_DB: 'REQUIRED', // Currently defaults to 1

        // Elasticsearch Configuration
        ELASTICSEARCH_NODE: 'REQUIRED', // Currently defaults to 'http://localhost:9200'

        // Puppeteer Configuration
        PUPPETEER_MAX_INSTANCES: 'REQUIRED', // Currently defaults to 3

        // Worker Configuration
        WORKER_ID: 'REQUIRED', // Currently auto-generated
        WORKER_ENDPOINT: 'REQUIRED', // Currently auto-generated
        WORKER_MAX_CONCURRENT_JOBS: 'REQUIRED', // Currently defaults to 3
        WORKER_MAX_MEMORY_MB: 'REQUIRED', // Currently defaults to 2048
        HOSTNAME: 'REQUIRED', // Currently defaults to 'worker'

        // Scraping Configuration
        PAGES_PER_CATEGORY: 'REQUIRED', // Currently defaults to '5'
        SCHEDULER_URL: 'REQUIRED', // Currently defaults to 'http://localhost:3004'

        // Optional Variables
        PUPPETEER_EXECUTABLE_PATH: 'OPTIONAL', // undefined is acceptable
        REDIS_PASSWORD: 'OPTIONAL', // undefined is acceptable (no auth)
      },
    }),
    // ScheduleModule.forRoot() removed - workers don't run scheduled tasks
    BullModule.forRootAsync({
      useFactory: (sharedConfig: SharedConfigService) => {
        // CRITICAL: Exclude commandTimeout for Bull v4 processors
        // Bull uses BRPOP (blocking Redis command) which needs to wait indefinitely for jobs.
        // The 5-second commandTimeout from getRedisConfig() causes "Command timed out" errors.
        // See: https://github.com/OptimalBits/bull/issues/1873
        const { commandTimeout, ...bullRedisConfig } = sharedConfig.getBullMQRedisConfig();

        return {
          redis: bullRedisConfig,
          defaultJobOptions: {
            removeOnComplete: 5,
            removeOnFail: 10,
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
    // Shared health module with scraper-specific health service
    SharedHealthModule.forRootAsync({
      useFactory: (sharedConfig: SharedConfigService) => ({
        serviceName: 'scraper',
        version: sharedConfig.get('APP_VERSION'),
        environment: sharedConfig.get('NODE_ENV'),
      }),
      inject: [SharedConfigService],
      healthServiceFactory: {
        useFactory: (
          puppeteerPool: PuppeteerPoolService,
          prisma: PrismaService,
          sharedConfig: SharedConfigService
        ) => new ScraperHealthService(puppeteerPool, prisma, sharedConfig),
        inject: [PuppeteerPoolService, PrismaService, SharedConfigService],
      },
    }),
    PrismaModule,
    DealElasticSearchModule,
    PuppeteerPoolModule,
    JobProcessorModule.register(),
    CategoryDiscoveryModule,
    // Legacy PageScrapingModule and DealExtractionModule removed - replaced by multi-site processors
    FilterMatchingModule,
    NotificationModule,
    // CategoryMonitorModule removed - monitoring handled by scheduler
    WorkerRegistrationModule,
  ],
  providers: [],
})
export class ScraperModule {}
