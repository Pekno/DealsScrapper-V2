/**
 * @fileoverview Base health controller providing standard health endpoints
 * All services inherit these three endpoints: /health, /health/ready, /health/live
 */

import { Controller, Get, Logger, SetMetadata } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
  createSuccessResponse,
  createErrorResponse,
  type StandardApiResponse,
} from '@dealscrapper/shared-types';
import { BaseHealthService } from '../services/base-health.service.js';
import type {
  HealthData,
  ReadinessData,
  LivenessData,
} from '../interfaces/health.interface.js';

/**
 * Public decorator to bypass authentication for health endpoints
 * Uses the same metadata key as the API service's Public decorator
 */
const Public = () => SetMetadata('isPublic', true);

/**
 * Base health controller providing standard health check endpoints
 * Services automatically inherit these endpoints when using SharedHealthModule
 */
@Controller('health')
@ApiTags('Health')
export class BaseHealthController {
  protected readonly logger = new Logger(BaseHealthController.name);

  constructor(protected readonly healthService: BaseHealthService) {}

  /**
   * General health check endpoint
   * Returns overall service health with optional custom data
   * @returns Service health status and information
   */
  @Get()
  @Public()
  @ApiOperation({
    summary: 'Get service health status',
    description:
      'Returns the overall health status of the service including uptime, version, and custom service-specific data.',
  })
  @ApiResponse({
    status: 200,
    description: 'Health status retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Service is healthy' },
        data: {
          type: 'object',
          description:
            'Health data including base fields and service-specific custom data (e.g., workers for scheduler)',
          properties: {
            status: {
              type: 'string',
              enum: ['healthy', 'unhealthy', 'degraded'],
              example: 'healthy',
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T00:00:00.000Z',
            },
            service: { type: 'string', example: 'scraper' },
            uptime: {
              type: 'number',
              example: 3600,
              description: 'Uptime in seconds',
            },
            version: { type: 'string', example: '1.0.0' },
            environment: { type: 'string', example: 'development' },
          },
          additionalProperties: true,
        },
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: 'Health check failed',
  })
  async getHealth(): Promise<StandardApiResponse<HealthData>> {
    try {
      const healthData = await this.healthService.getHealth();

      const message =
        healthData.status === 'healthy'
          ? 'Service is healthy'
          : `Service status: ${healthData.status}`;

      this.logger.debug(`🏥 Health check completed: ${healthData.status}`);
      return createSuccessResponse(healthData, message);
    } catch (error) {
      this.logger.error('❌ Health check failed:', error);
      return createErrorResponse(
        'Health check failed',
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * Readiness probe endpoint for Kubernetes
   * Checks if service is ready to receive traffic
   * @returns Service readiness status including dependency health
   */
  @Get('ready')
  @Public()
  @ApiOperation({
    summary: 'Get service readiness status',
    description:
      'Kubernetes readiness probe. Indicates if the service is ready to receive traffic by checking dependencies.',
  })
  @ApiResponse({
    status: 200,
    description: 'Readiness status retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Service is ready' },
        data: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              enum: ['healthy', 'unhealthy', 'degraded'],
              example: 'healthy',
            },
            timestamp: { type: 'string', format: 'date-time' },
            service: { type: 'string', example: 'scraper' },
            uptime: { type: 'number', example: 3600 },
            ready: { type: 'boolean', example: true },
            dependencies: {
              type: 'object',
              description: 'Service-specific dependency health statuses',
              additionalProperties: {
                type: 'string',
                enum: ['healthy', 'unhealthy', 'degraded', 'unknown'],
              },
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 503,
    description: 'Service not ready',
  })
  async getReadiness(): Promise<StandardApiResponse<ReadinessData>> {
    try {
      const readinessData = await this.healthService.getReadiness();

      const message = readinessData.ready
        ? 'Service is ready'
        : 'Service is not ready - dependency issues detected';

      this.logger.debug(
        `🔍 Readiness check completed: ready=${readinessData.ready}`
      );
      return createSuccessResponse(readinessData, message);
    } catch (error) {
      this.logger.error('❌ Readiness check failed:', error);
      return createErrorResponse(
        'Readiness check failed',
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * Liveness probe endpoint for Kubernetes
   * Checks if service is alive and responsive
   * @returns Service liveness status including resource usage
   */
  @Get('live')
  @Public()
  @ApiOperation({
    summary: 'Get service liveness status',
    description:
      'Kubernetes liveness probe. Indicates if the service is alive and responsive by checking resource usage.',
  })
  @ApiResponse({
    status: 200,
    description: 'Liveness status retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Service is alive' },
        data: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              enum: ['healthy', 'unhealthy', 'degraded'],
              example: 'healthy',
            },
            timestamp: { type: 'string', format: 'date-time' },
            service: { type: 'string', example: 'scraper' },
            uptime: { type: 'number', example: 3600 },
            alive: { type: 'boolean', example: true },
            memoryUsage: {
              type: 'object',
              properties: {
                used: {
                  type: 'number',
                  example: 50000000,
                  description: 'Memory used in bytes',
                },
                total: {
                  type: 'number',
                  example: 100000000,
                  description: 'Total memory in bytes',
                },
                percentage: {
                  type: 'number',
                  example: 50,
                  description: 'Memory usage percentage',
                },
              },
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 503,
    description: 'Service not alive',
  })
  async getLiveness(): Promise<StandardApiResponse<LivenessData>> {
    try {
      const livenessData = await this.healthService.getLiveness();

      const message = livenessData.alive
        ? 'Service is alive'
        : 'Service liveness issues detected';

      this.logger.debug(
        `💓 Liveness check completed: alive=${livenessData.alive}`
      );
      return createSuccessResponse(livenessData, message);
    } catch (error) {
      this.logger.error('❌ Liveness check failed:', error);
      return createErrorResponse(
        'Liveness check failed',
        error instanceof Error ? error.message : String(error)
      );
    }
  }
}
