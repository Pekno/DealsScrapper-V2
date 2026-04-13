import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { SharedConfigService } from '@dealscrapper/shared-config';
import { ScraperModule } from './scraper.module.js';
import { Logger } from '@nestjs/common';
import { PuppeteerPoolService } from './puppeteer-pool/puppeteer-pool.service.js';
// Removed AdaptiveSchedulerService - now consuming jobs from external scheduler
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { WorkerRegistrationService } from './worker-registration/worker-registration.service.js';
import { createServiceLogger } from '@dealscrapper/shared-logging';
import { scraperLogConfig } from './config/logging.config.js';
import { getAllSiteQueueNames, getSiteQueueName, SiteSource } from '@dealscrapper/shared-types';

/**
 * Get the configured site from environment variable
 * Returns null if SCRAPER_SITE is not set or set to "all"
 */
function getConfiguredSite(): SiteSource | null {
  const scraperSite = process.env.SCRAPER_SITE?.toLowerCase();

  if (!scraperSite || scraperSite === 'all') {
    return null; // Process all sites
  }

  // Validate the site value
  const validSites = Object.values(SiteSource);
  if (validSites.includes(scraperSite as SiteSource)) {
    return scraperSite as SiteSource;
  }

  return null;
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(ScraperModule);

  // Get shared configuration service early
  const sharedConfig = app.get(SharedConfigService);
  const configService = app.get(ConfigService);

  // Enable graceful shutdown hooks for proper cleanup
  app.enableShutdownHooks();

  // Initialize enhanced logger service with scraper config
  const customLogger = createServiceLogger(scraperLogConfig, {
    level: sharedConfig.get('LOG_LEVEL'),
  });
  app.useLogger(customLogger);
  const logger = new Logger('ScraperBootstrap');

  // Log environment information
  const nodeEnv = process.env.NODE_ENV || 'development';
  logger.log(`🌍 Environment: ${nodeEnv.toUpperCase()}`);
  logger.log(
    '📁 Enhanced logging enabled - scraper logs in ./logs/scraper_*.log'
  );

  // Setup Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('Dealscrapper Scraper API')
    .setDescription('API for the Dealscrapper scraping service')
    .setVersion('1.0')
    .addTag('scraper')
    .addTag('health')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // Initialize Puppeteer pool (optional for development)
  try {
    const puppeteerPool = app.get(PuppeteerPoolService);
    await puppeteerPool.initialize();
    logger.log(
      `🌐 Puppeteer pool initialized with ${sharedConfig.get('PUPPETEER_MAX_INSTANCES')} max instances`
    );
  } catch (error) {
    logger.warn(
      `⚠️ Puppeteer pool initialization failed: ${(error as Error).message}`
    );
    logger.warn(
      `🔧 Scraper will run without Puppeteer (API endpoints will still work)`
    );
  }

  // Check ElasticSearch connectivity
  try {
    const { DealElasticSearchService } = await import(
      './elasticsearch/services/deal-elasticsearch.service.js'
    );
    const elasticSearchService = app.get(DealElasticSearchService);
    // The service initializes automatically via onModuleInit, so just check if it's available
    logger.log(
      `🔍 ElasticSearch dual index system ready (deduplication & evolution tracking)`
    );
  } catch (error) {
    logger.warn(
      `⚠️ ElasticSearch service initialization issue: ${(error as Error).message}`
    );
    logger.warn(`🔧 Scraper will continue without ElasticSearch features`);
  }

  // Check Redis connectivity before starting job processor
  const configuredSite = getConfiguredSite();
  const targetQueueName = configuredSite
    ? getSiteQueueName(configuredSite)
    : getSiteQueueName(SiteSource.DEALABS); // Fallback for multi-site mode

  logger.log(`🔍 Validating Redis connection for queue: ${targetQueueName}...`);
  try {
    const { getQueueToken } = await import('@nestjs/bull');

    // Get the queue for this scraper's configured site
    const jobQueue = app.get(getQueueToken(targetQueueName));

    // Test Redis connection with a simple ping
    const pingResult = await jobQueue.client.ping();
    logger.debug(`📡 Redis ping response: ${pingResult}`);

    // Test queue operations
    const queueName = jobQueue.name;
    logger.debug(`📋 Queue name: ${queueName}`);

    // Get basic queue information to ensure it's accessible
    const waiting = await jobQueue.getWaiting();
    const active = await jobQueue.getActive();
    logger.debug(
      `📊 Queue status - Waiting: ${waiting.length}, Active: ${active.length}`
    );

    logger.log(`✅ Redis connection verified for queue: ${targetQueueName}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('❌ Redis connection failed!');
    logger.error(`❌ Error: ${errorMessage}`);
    logger.error('💡 Please ensure Redis server is running and accessible');
    const redisConfig = sharedConfig.getRedisConfig();
    logger.error(`💡 Check Redis configuration:`);
    logger.error(`   Host: ${redisConfig.host}`);
    logger.error(`   Port: ${redisConfig.port}`);
    logger.error(`   Database: ${redisConfig.db}`);
    if (redisConfig.password) {
      logger.error('   Authentication: Yes (password configured)');
    } else {
      logger.error('   Authentication: No (no password configured)');
    }
    logger.error(
      '🛑 Scraper service cannot start without Redis (required for job processing)'
    );
    logger.error('🔧 Fix Redis connection and restart the service');

    // Graceful shutdown
    try {
      await app.close();
    } catch (closeError) {
      logger.warn(`⚠️ Error during app shutdown: ${closeError}`);
    }

    process.exit(1);
  }

  // Log job processor readiness
  // Site-specific processors handle both scrape and discovery jobs from their respective queues
  if (configuredSite) {
    logger.log(`⚡ Job processor initialized for site-dedicated mode`);
    logger.log(`🎯 Processing jobs from queue: ${targetQueueName}`);
    logger.log(`📊 Processor handles: @Process('scrape') and @Process('discovery') for ${configuredSite.toUpperCase()}`);
  } else {
    const siteQueues = getAllSiteQueueNames();
    logger.log(`⚡ Job processors initialized and ready to consume jobs from scheduler queues`);
    logger.log(`🎯 Multi-site processors ready for both scrape and discovery jobs: ${siteQueues.join(', ')}`);
    logger.log(`📊 Each processor handles: @Process('scrape') and @Process('discovery')`);
  }

  const port = sharedConfig.getServicePort();

  // Initialize worker registration service
  try {
    const workerRegistration = app.get(WorkerRegistrationService);
    const workerInfo = workerRegistration.getWorkerInfo();
    logger.log(
      `🔗 Worker registration service ready - ID: ${workerInfo.workerId}`
    );
    logger.log(`📡 Worker endpoint: ${workerInfo.endpoint} (Port: ${port})`);
    logger.log(
      `📡 Will register with scheduler at: ${sharedConfig.get('SCHEDULER_URL')}`
    );
  } catch (error) {
    logger.warn(
      `⚠️ Worker registration service initialization failed: ${(error as Error).message}`
    );
    logger.warn(`🔧 Scraper will run without scheduler integration`);
  }

  await app.listen(port);
  logger.log(`🚀 Scraper is running on: http://localhost:${port}`);
  logger.log(`📚 Scraper API documentation: http://localhost:${port}/api/docs`);
  logger.log(`📊 Page-based incremental scraping enabled`);
  logger.log(`🌐 Puppeteer browser pool for dynamic content scraping`);
  logger.log(`⚡ Bull queue system for job processing from scheduler`);
  logger.log(`🔗 Job consumer for scheduler-distributed scraping tasks`);
  logger.log(`🔍 Filter matching and deal evaluation engine`);
  logger.log(`📈 Real-time scraping metrics and health monitoring`);
}

bootstrap().catch((error) => {
  const logger = new Logger('ScraperBootstrap');
  logger.error(
    'Failed to start scraper service:',
    error?.message || 'Unknown error'
  );
  logger.error('Error stack:', error?.stack);
  logger.error('Full error object:', error);
  process.exit(1);
});
