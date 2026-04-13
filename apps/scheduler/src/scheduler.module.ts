import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bull';
import { PrismaModule } from '@dealscrapper/database';
import {
  SharedConfigModule,
  SharedConfigService,
} from '@dealscrapper/shared-config';
import { SharedHealthModule } from '@dealscrapper/shared-health';

import { JobDistributorModule } from './job-distributor/job-distributor.module.js';
import { WorkerHealthModule } from './worker-health/worker-health.module.js';
import { WorkerHealthService } from './worker-health/worker-health.service.js';
import { CategoryDiscoveryOrchestratorModule } from './category-discovery/category-discovery-orchestrator.module.js';
import { AdaptiveSchedulerModule } from './adaptive-scheduler/adaptive-scheduler.module.js';
import { ScheduledJobModule } from './scheduled-job/scheduled-job.module.js';
import { UrlFilterOptimizerModule } from './url-filter-optimizer/url-filter-optimizer.module.js';
import { SchedulerHealthService } from './health/scheduler-health.service.js';
import { SchedulerDebugController } from './scheduler.controller.debug.js';

/**
 * Main scheduler/orchestrator service module
 * Coordinates job distribution, worker health monitoring, and adaptive scheduling
 */

// Debug controller will be added conditionally in module factory

@Module({
  imports: [
    // SharedConfigModule with strict environment validation
    SharedConfigModule.forRoot({
      serviceName: 'SCHEDULER',
      envConfig: {
        // Infrastructure & Common
        NODE_ENV: 'REQUIRED', // Currently defaults to 'development'
        DATABASE_URL: 'REQUIRED', // Required by Prisma, no fallback
        LOG_LEVEL: 'REQUIRED', // Currently defaults to 'info'
        SCHEDULER_PORT: 'REQUIRED', // Currently defaults to 3004
        APP_VERSION: 'REQUIRED', // Currently defaults to '1.0.0'

        // Redis Configuration
        REDIS_HOST: 'REQUIRED', // Currently defaults to 'localhost'
        REDIS_PORT: 'REQUIRED', // Currently defaults to 6379
        REDIS_DB: 'REQUIRED', // Currently defaults to 1

        // Feature Configuration
        URL_OPTIMIZATION_ENABLED: 'REQUIRED', // Currently defaults to false

        // Optional Variables
        REDIS_PASSWORD: 'OPTIONAL', // undefined is acceptable (no auth)
      },
    }),
    ScheduleModule.forRoot(),
    BullModule.forRootAsync({
      useFactory: (sharedConfig: SharedConfigService) => ({
        redis: sharedConfig.getBullMQRedisConfig(),
      }),
      inject: [SharedConfigService],
    }),
    BullModule.registerQueue(
      { name: 'jobs' } // Single consolidated queue
    ),
    PrismaModule,
    // Shared health module with scheduler-specific health service
    SharedHealthModule.forRootAsync({
      imports: [WorkerHealthModule],
      useFactory: (sharedConfig: SharedConfigService) => ({
        serviceName: 'scheduler',
        version: sharedConfig.get('APP_VERSION'),
        environment: sharedConfig.get('NODE_ENV'),
      }),
      inject: [SharedConfigService],
      // Use custom health service factory to inject SchedulerHealthService
      healthServiceFactory: {
        useFactory: (
          workerHealth: WorkerHealthService,
          sharedConfig: SharedConfigService
        ) => new SchedulerHealthService(workerHealth, sharedConfig),
        inject: [WorkerHealthService, SharedConfigService],
      },
    }),
    JobDistributorModule,
    CategoryDiscoveryOrchestratorModule,
    AdaptiveSchedulerModule,
    ScheduledJobModule,
    UrlFilterOptimizerModule,
  ],
  controllers: [
    // Conditionally include debug controller in test environment
    ...(process.env.NODE_ENV === 'test' ? [SchedulerDebugController] : []),
  ],
  providers: [],
})
export class SchedulerModule {}
