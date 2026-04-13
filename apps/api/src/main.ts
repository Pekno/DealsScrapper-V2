import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { ValidationPipe, BadRequestException } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { SecurityHeadersMiddleware } from './common/middleware/security-headers.middleware.js';
import { RateLimitMiddleware } from './common/middleware/rate-limit.middleware.js';
import { SanitizationMiddleware } from './common/middleware/sanitization.middleware.js';
import { RequestLoggerMiddleware } from './common/middleware/request-logger.middleware.js';
import { CorsMiddleware } from './common/middleware/cors.middleware.js';
import { DatabaseSeederService } from './common/services/database-seeder.service.js';
import { SharedConfigService } from '@dealscrapper/shared-config';
import { createServiceLogger } from '@dealscrapper/shared-logging';
import { apiLogConfig } from './config/logging.config.js';
import { Queue } from 'bull';
import { getQueueToken } from '@nestjs/bull';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Get shared configuration service early
  const sharedConfig = app.get(SharedConfigService);

  // Initialize enhanced logger service with API config
  const customLogger = createServiceLogger(apiLogConfig, {
    level: sharedConfig.get('LOG_LEVEL'),
  });
  app.useLogger(customLogger);
  // Use the same logger for bootstrap messages
  const logger = customLogger;

  // Log environment information
  const nodeEnv = process.env.NODE_ENV || 'development';
  logger.log(`🌍 Environment: ${nodeEnv.toUpperCase()}`);
  logger.log('📁 Enhanced logging enabled - API logs in ./logs/api_*.log');

  // Apply security middleware in order
  app.use(
    new SecurityHeadersMiddleware().use.bind(new SecurityHeadersMiddleware())
  );
  // CORS with SharedConfigService
  const corsConfig = sharedConfig.getCorsConfig();
  app.use(
    new CorsMiddleware(corsConfig).use.bind(new CorsMiddleware(corsConfig))
  );
  app.use(
    new RequestLoggerMiddleware().use.bind(new RequestLoggerMiddleware())
  );
  app.use(new SanitizationMiddleware().use.bind(new SanitizationMiddleware()));

  // Rate limiting with SharedConfigService
  const rateLimitConfig = sharedConfig.getRateLimitConfig();
  app.use(
    new RateLimitMiddleware(rateLimitConfig).use.bind(
      new RateLimitMiddleware(rateLimitConfig)
    )
  );

  // Global validation pipe with enhanced options
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      // Always include validation error details in the exception so the
      // exception filter and response body carry the message array.
      // Production callers should not rely on these strings for logic.
      exceptionFactory: (errors) => {
        const messages = errors.flatMap((e) =>
          e.constraints ? Object.values(e.constraints) : []
        );
        logger.warn(
          `Validation failed: ${messages.join(' | ')}`,
          'ValidationPipe'
        );
        return new BadRequestException(messages);
      },
    })
  );

  // Swagger API documentation — disabled in production
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Dealscrapper API')
      .setDescription(
        'Production-ready API for managing deals, notifications, and user preferences with comprehensive authentication and security'
      )
      .setVersion('1.0')
      .addBearerAuth({
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      })
      .addTag('Authentication', 'User authentication and session management')
      .addTag('Users', 'User profile and notification preferences management')
      .addTag('Filters', 'Deal filter creation, management, and matching')
      .addTag('Categories', 'Browse and search available deal categories')
      .addTag('Health', 'Service health monitoring and diagnostics')
      .addTag('Admin', 'Administrative operations - dashboard, user management')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        docExpansion: 'none',
        filter: true,
        showRequestHeaders: true,
      },
      customSiteTitle: 'Dealscrapper API Documentation',
      useGlobalPrefix: false,
    });
  }

  // Check Redis connection and queue health before starting
  try {
    logger.log('🔍 Checking Redis connection and queue health...');

    const notificationQueue = app.get<Queue>(getQueueToken('notifications'));

    // Test Redis connection through Bull queue
    const redisClient = notificationQueue.client;
    const startTime = Date.now();

    // Test basic Redis connectivity
    await Promise.race([
      redisClient.ping(),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Redis ping timeout')), 3000);
      }),
    ]);

    const responseTime = Date.now() - startTime;
    logger.log(`✅ Redis connection healthy (${responseTime}ms response time)`);

    // Test queue operations
    const queueHealth = await notificationQueue.getWaiting();
    logger.log(
      `📋 Notification queue healthy (${queueHealth.length} waiting jobs)`
    );
  } catch (error) {
    logger.error('❌ Redis/Queue connection failed:', error.message);
    logger.warn(
      '⚠️  Email notifications will not work until Redis is available'
    );
    logger.warn(
      '💡 Start Redis: redis-server or docker run -d -p 6379:6379 redis:alpine'
    );

    // In development, continue without Redis for basic API functionality
    if (sharedConfig.isDevelopmentMode()) {
      logger.warn('🔧 Development mode: API will continue without Redis');
    } else {
      logger.error('🚨 Production mode: Redis is required, exiting...');
      process.exit(1);
    }
  }

  // Seed default development users
  const databaseSeeder = app.get(DatabaseSeederService);
  await databaseSeeder.seedDefaultUser();
  await databaseSeeder.seedAdminUser();

  // Get port from SharedConfigService
  const port = sharedConfig.getServicePort();
  await app.listen(port);

  logger.log(`🚀 API is running on: http://localhost:${port}`);
  logger.log(`📚 API documentation: http://localhost:${port}/api/docs`);
  logger.log(`🔒 Security headers and CSP protection enabled`);
  logger.log(`🧹 Input sanitization and XSS protection active`);
  const rateLimitStatus = rateLimitConfig.enabled
    ? `enabled (${rateLimitConfig.maxRequests} req/${Math.ceil(rateLimitConfig.windowMs / 60000)}min)`
    : 'disabled for tests';
  logger.log(`⏱️ Rate limiting ${rateLimitStatus}`);
  logger.log(`🌐 CORS configured for secure cross-origin requests`);
  logger.log(`🔑 JWT authentication with refresh tokens enabled`);
  logger.log(`📊 Request logging and monitoring active`);
}

bootstrap();
