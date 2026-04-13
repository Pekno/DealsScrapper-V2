import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SharedConfigService } from '@dealscrapper/shared-config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { NotifierModule } from './notifier.module.js';
import { createServiceLogger } from '@dealscrapper/shared-logging';
import { notifierLogConfig } from './config/logging.config.js';

// Increase max listeners to prevent warnings from multiple logger instances
// Each logger registers exception/rejection handlers on the process object
process.setMaxListeners(20);

async function bootstrap() {
  const app = await NestFactory.create(NotifierModule);

  // Get shared configuration service early
  const sharedConfig = app.get(SharedConfigService);
  const configService = app.get(ConfigService);

  // Initialize enhanced logger service with Notifier config
  const customLogger = createServiceLogger(notifierLogConfig, {
    level: sharedConfig.get('LOG_LEVEL'),
  });
  app.useLogger(customLogger);
  const logger = createServiceLogger(notifierLogConfig);

  // Log environment information
  const nodeEnv = process.env.NODE_ENV || 'development';
  logger.log(`🌍 Environment: ${nodeEnv.toUpperCase()}`);
  logger.log(
    '📁 Enhanced logging enabled - Notifier logs in ./logs/notifier_*.log'
  );

  try {
    // Setup Swagger documentation
    const config = new DocumentBuilder()
      .setTitle('Dealscrapper Notifier API')
      .setDescription(
        'API for the Dealscrapper notification service with WebSocket support'
      )
      .setVersion('1.0')
      .addTag('Notifications', 'User notification management endpoints')
      .addTag('Tracking', 'Email tracking and analytics endpoints')
      .addTag('Health', 'Service health and status endpoints')
      .addTag('Cleanup', 'Data cleanup and maintenance endpoints')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);

    // Global validation pipe
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      })
    );

    // Enable CORS for WebSocket connections
    // Origins are environment-based: WEB_APP_URL for production, localhost:3000 for development
    const webAppUrl = sharedConfig.get('WEB_APP_URL');
    const corsOrigins = webAppUrl
      ? [webAppUrl, 'http://localhost:3000']
      : ['http://localhost:3000'];

    app.enableCors({
      origin: corsOrigins,
      credentials: true,
    });

    const port = sharedConfig.getServicePort();

    // Listen with timeout handling
    logger.log(`🚀 Starting Notifier service on port ${port}...`);
    await app.listen(port);

    logger.log(`🚀 Notifier is running on: http://localhost:${port}`);
    logger.log(
      `📚 Notifier API documentation: http://localhost:${port}/api/docs`
    );
    logger.log(`📡 WebSocket server ready for real-time connections`);
    logger.log(`⚡ Bull queue processors for notification delivery`);
    logger.log(`📧 Multi-channel notifications (Email, WebSocket)`);
    logger.log(`🛡️ Rate limiting and security monitoring active`);
    logger.log(`📊 Channel health monitoring and fallback systems`);
    logger.log(`🎨 Template engine for customizable notifications`);
    logger.log(`🌐 CORS enabled for secure WebSocket connections`);
  } catch (error) {
    logger.error('❌ Failed to start Notifier Service');
    if (error instanceof Error) {
      logger.error(`Error: ${error.message}`);
      logger.error(`Stack: ${error.stack}`);
    } else {
      logger.error(`Error details: ${String(error)}`);
    }
    process.exit(1);
  }
}

bootstrap();
