import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { SharedConfigService } from '@dealscrapper/shared-config';
import { SchedulerModule } from './scheduler.module.js';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { createServiceLogger } from '@dealscrapper/shared-logging';
import { schedulerLogConfig } from './config/logging.config.js';
import { AdaptiveSchedulerService } from './adaptive-scheduler/adaptive-scheduler.service.js';
import { CategoryDiscoveryOrchestrator } from './category-discovery/category-discovery-orchestrator.service.js';

/**
 * Bootstrap function for the scheduler/orchestrator service
 * Initializes job distribution, worker health monitoring, and adaptive scheduling
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(SchedulerModule);

  // Get shared configuration service early
  const sharedConfig = app.get(SharedConfigService);
  const configService = app.get(ConfigService);

  // Initialize enhanced logger service with scheduler config
  const logger = createServiceLogger(schedulerLogConfig, {
    level: sharedConfig.get('LOG_LEVEL'),
  });
  app.useLogger(logger);

  // Enable global validation with proper error handling
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strip unknown properties
      forbidNonWhitelisted: true, // Reject unknown properties
      transform: true, // Transform payloads to DTO instances
      transformOptions: {
        enableImplicitConversion: true, // Convert string numbers to actual numbers
      },
      disableErrorMessages: false, // Keep detailed error messages
    })
  );

  // Log environment information
  const nodeEnv = process.env.NODE_ENV || 'development';
  logger.log(`🌍 Environment: ${nodeEnv.toUpperCase()}`);
  logger.log(
    '📁 Enhanced logging enabled - scheduler logs in ./logs/scheduler_*.log'
  );

  // Setup Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('Dealscrapper Scheduler API')
    .setDescription(
      'API for the Dealscrapper job scheduling and orchestration service'
    )
    .setVersion('1.0')
    .addTag('scheduler', 'Core scheduling and orchestration operations')
    .addTag('jobs', 'Scraping job management and monitoring')
    .addTag('workers', 'Worker health monitoring and management')
    .addTag(
      'category-discovery',
      'Category discovery and validation operations'
    )
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // Initialize adaptive scheduling system
  try {
    const adaptiveScheduler = app.get(AdaptiveSchedulerService);
    await adaptiveScheduler.initializeScheduling();
    logger.log('⚡ Adaptive scheduler initialized successfully');
  } catch (error) {
    logger.error(
      `❌ Failed to initialize adaptive scheduler: ${(error as Error).message}`
    );
    logger.warn('🔧 Scheduler will continue without adaptive scheduling');
  }

  // Verify category discovery orchestrator is ready
  // If no categories exist in the database, trigger initial discovery for all sites
  try {
    const categoryDiscovery = app.get(CategoryDiscoveryOrchestrator);
    const discoveryStatus = await categoryDiscovery.getDiscoveryStatus();
    logger.log(
      `🔍 Category discovery orchestrator ready (Queue: ${discoveryStatus.queueStatus.waiting} waiting, ${discoveryStatus.queueStatus.active} active)`
    );

    // Auto-trigger category discovery if database has no categories
    const { PrismaService } = await import('@dealscrapper/database');
    const prisma = app.get(PrismaService);
    const categoryCount = await prisma.category.count();
    if (categoryCount === 0) {
      logger.log('📂 No categories found in database — triggering initial category discovery for all sites...');
      const result = await categoryDiscovery.triggerManualDiscovery('startup-auto-init');
      if (result.success) {
        logger.log(`✅ Initial category discovery jobs queued: ${result.message}`);
      } else {
        logger.warn(`⚠️ Failed to queue initial category discovery: ${result.error}`);
      }
    } else {
      logger.log(`📂 Categories already populated (${categoryCount} categories) — skipping startup discovery`);
    }
  } catch (error) {
    logger.warn(
      `⚠️ Category discovery status check failed: ${(error as Error).message}`
    );
  }

  const port = sharedConfig.getServicePort();

  await app.listen(port);

  logger.log(`🚀 Scheduler is running on: http://localhost:${port}`);
  logger.log(
    `📚 Scheduler API documentation: http://localhost:${port}/api/docs`
  );
  logger.log(`📊 Job distribution and queue management active`);
  logger.log(`💓 Worker health monitoring with on-demand checks`);
  logger.log(`🔍 Category discovery orchestration enabled`);
  logger.log(
    `🌐 Category discovery API: POST ${port}/category-discovery/trigger`
  );
  logger.log(`📈 Discovery status API: GET ${port}/category-discovery/status`);
  logger.log(`⚡ Adaptive scheduling based on user activity and metrics`);
  logger.log(`🎯 Intelligent job routing across priority queues`);

  // Graceful shutdown handling
  process.on('SIGTERM', async () => {
    logger.log('🛑 SIGTERM received, shutting down gracefully...');

    const adaptiveScheduler = app.get(AdaptiveSchedulerService);
    adaptiveScheduler.clearAllSchedules();

    await app.close();
    logger.log('✅ Scheduler service shutdown complete');
  });
}

bootstrap().catch((error) => {
  const logger = createServiceLogger(schedulerLogConfig);
  logger.error('💥 Failed to start scheduler service:', error);
  process.exit(1);
});
