/**
 * @fileoverview Shared health module for standardized health endpoints
 * Provides ready-to-use health endpoints that services can import and customize
 */

import { DynamicModule, Module, Type, Provider } from '@nestjs/common';
import { BaseHealthService } from './services/base-health.service.js';
import { BaseHealthController } from './controllers/base-health.controller.js';
import type { HealthConfig } from './interfaces/health.interface.js';

/**
 * Shared health module providing standardized health endpoints
 * Services can import this module to automatically get /health, /health/ready, and /health/live endpoints
 */
@Module({})
export class SharedHealthModule {
  /**
   * Create a dynamic health module for a service
   * @param config Health configuration for the service
   * @returns Dynamic module with health endpoints
   *
   * @example
   * ```typescript
   * // In your service's app.module.ts
   * @Module({
   *   imports: [
   *     SharedHealthModule.forRoot({
   *       serviceName: 'scraper',
   *       version: '1.0.0',
   *       environment: process.env.NODE_ENV || 'development',
   *     }),
   *   ],
   * })
   * export class AppModule {}
   * ```
   */
  static forRoot(config: HealthConfig): DynamicModule {
    return {
      module: SharedHealthModule,
      providers: [
        {
          provide: 'HEALTH_CONFIG',
          useValue: config,
        },
        {
          provide: BaseHealthService,
          useFactory: (healthConfig: HealthConfig) => {
            return new BaseHealthService(healthConfig);
          },
          inject: ['HEALTH_CONFIG'],
        },
      ],
      controllers: [BaseHealthController],
      exports: [BaseHealthService, 'HEALTH_CONFIG'],
      global: false,
    };
  }

  /**
   * Create a health module for root async configuration
   * Useful when config needs to be loaded asynchronously (e.g., from ConfigService)
   * @param options Async configuration options
   * @returns Dynamic module with health endpoints
   *
   * @example
   * ```typescript
   * // In your service's app.module.ts
   * @Module({
   *   imports: [
   *     SharedHealthModule.forRootAsync({
   *       imports: [WorkerHealthModule], // Import modules that provide dependencies
   *       useFactory: (configService: ConfigService) => ({
   *         serviceName: configService.get('SERVICE_NAME', 'unknown'),
   *         version: configService.get('APP_VERSION', '1.0.0'),
   *         environment: configService.get('NODE_ENV', 'development'),
   *       }),
   *       inject: [ConfigService],
   *       healthServiceFactory: {
   *         useFactory: (workerHealth, config) => new CustomHealthService(workerHealth, config),
   *         inject: [WorkerHealthService, ConfigService],
   *       },
   *     }),
   *   ],
   * })
   * export class AppModule {}
   * ```
   */
  static forRootAsync(options: {
    imports?: Array<Type<unknown> | DynamicModule>;
    useFactory: (...args: unknown[]) => HealthConfig | Promise<HealthConfig>;
    inject?: Array<Type | string | symbol>;
    healthServiceFactory?: {
      useFactory: (
        ...args: unknown[]
      ) => BaseHealthService | Promise<BaseHealthService>;
      inject?: Array<Type | string | symbol>;
    };
  }): DynamicModule {
    const providers: Provider[] = [
      {
        provide: 'HEALTH_CONFIG',
        useFactory: options.useFactory,
        inject: options.inject || [],
      },
    ];

    if (options.healthServiceFactory) {
      // Use the custom health service factory - allows full control over dependency injection
      providers.push({
        provide: BaseHealthService,
        useFactory: options.healthServiceFactory.useFactory,
        inject: options.healthServiceFactory.inject || [],
      });
    } else {
      // Use the default BaseHealthService
      providers.push({
        provide: BaseHealthService,
        useFactory: (healthConfig: HealthConfig) => {
          return new BaseHealthService(healthConfig);
        },
        inject: ['HEALTH_CONFIG'],
      });
    }

    return {
      module: SharedHealthModule,
      imports: options.imports || [],
      providers,
      controllers: [BaseHealthController],
      exports: [BaseHealthService, 'HEALTH_CONFIG'],
      global: false,
    };
  }
}
