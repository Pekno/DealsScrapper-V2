import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { PrismaModule } from '@dealscrapper/database';
import {
  SharedConfigModule,
  SharedConfigService,
} from '@dealscrapper/shared-config';
import {
  SharedHealthModule,
  BaseHealthService,
} from '@dealscrapper/shared-health';

import { CategoryDiscoveryModule } from '../../src/category-discovery/category-discovery.module.js';
import { PuppeteerPoolModule } from '../../src/puppeteer-pool/puppeteer-pool.module.js';
import { JobProcessorModule } from '../../src/job-processor/job-processor.module.js';
import { FilterMatchingModule } from '../../src/filter-matching/filter-matching.module.js';
import { NotificationModule } from '../../src/notification/notification.module.js';
import { ScraperHealthService } from '../../src/health/scraper-health.service.js';
import { DealElasticSearchModule } from '../../src/elasticsearch/elasticsearch.module.js';
// NOTE: PageScrapingModule and DealExtractionModule were removed during architecture refactor
// NOTE: WorkerRegistrationModule excluded for testing

/**
 * Test-specific ScraperModule for e2e tests with real external service integration:
 * - Uses REAL Database (PostgreSQL) for data persistence
 * - Uses REAL Redis for Bull queues and caching
 * - Uses REAL Elasticsearch for deal indexing
 * - Excludes WorkerRegistrationModule to avoid scheduler service dependency
 * - Mocks Puppeteer browsers to prevent resource issues
 */
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

        // Worker Configuration (still needed for other services)
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
    BullModule.forRootAsync({
      useFactory: (sharedConfig: SharedConfigService) => ({
        redis: sharedConfig.getBullMQRedisConfig(),
        defaultJobOptions: {
          removeOnComplete: 5,
          removeOnFail: 10,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        },
      }),
      inject: [SharedConfigService],
    }),
    // Shared health module with scraper configuration
    SharedHealthModule.forRootAsync({
      useFactory: (sharedConfig: SharedConfigService) => ({
        serviceName: 'scraper',
        version: sharedConfig.get('APP_VERSION'),
        environment: sharedConfig.get('NODE_ENV'),
      }),
      inject: [SharedConfigService],
    }),
    PrismaModule,
    DealElasticSearchModule,
    PuppeteerPoolModule,
    JobProcessorModule,
    CategoryDiscoveryModule,
    FilterMatchingModule,
    NotificationModule,
    // PageScrapingModule and DealExtractionModule removed during architecture refactor
    // WorkerRegistrationModule excluded for testing
  ],
  providers: [
    // Override the base health service with our custom implementation
    {
      provide: BaseHealthService,
      useClass: ScraperHealthService,
    },
  ],
})
export class TestScraperModule {}
