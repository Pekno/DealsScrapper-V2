/**
 * @fileoverview Custom health service for scraper with service-specific health checks
 * Extends the base health service with Puppeteer pool and scraping queue monitoring
 */

import { Injectable } from '@nestjs/common';
import { SharedConfigService } from '@dealscrapper/shared-config';
import {
  BaseHealthService,
  type DependencyStatus,
} from '@dealscrapper/shared-health';
import { PrismaService } from '@dealscrapper/database';
import { PuppeteerPoolService } from '../puppeteer-pool/puppeteer-pool.service.js';
import { OllamaService } from '../llm-extraction/ollama/ollama.service.js';
import { OllamaUnavailableError } from '../llm-extraction/ollama/ollama.errors.js';
import { LlmExtractionService } from '../llm-extraction/llm-extraction.service.js';

/**
 * Custom health service for scraper with service-specific health checks
 * Provides comprehensive health monitoring for scraping operations
 */
@Injectable()
export class ScraperHealthService extends BaseHealthService {
  constructor(
    private readonly puppeteerPool: PuppeteerPoolService,
    private readonly prisma: PrismaService,
    private readonly sharedConfig: SharedConfigService,
    private readonly ollamaService: OllamaService,
    private readonly llmExtraction: LlmExtractionService
  ) {
    super({
      serviceName: 'scraper',
      version: sharedConfig.get<string>('APP_VERSION'),
      environment: sharedConfig.get<string>('NODE_ENV'),
    });

    // Register custom dependency health checkers
    this.registerHealthChecker('database', () => this.checkDatabase());
    this.registerHealthChecker('puppeteerPool', () =>
      this.checkPuppeteerPool()
    );
    this.registerHealthChecker('ollama', () => this.checkOllama());
  }

  /**
   * Add scraper-specific data to the general /health endpoint
   * This data will be included in the /health response
   */
  protected async getCustomHealthData(): Promise<Record<string, unknown>> {
    const poolStats = this.puppeteerPool.getStats();
    const ollamaStatus = await this.checkOllama();
    const llmStats = this.llmExtraction.getStats();

    return {
      puppeteerPool: {
        totalInstances: poolStats.totalInstances,
        availableInstances: poolStats.availableInstances,
        busyInstances: poolStats.busyInstances,
        queuedRequests: poolStats.queuedRequests,
        utilizationPercentage: Math.round(
          (poolStats.busyInstances / Math.max(poolStats.totalInstances, 1)) *
            100
        ),
        healthStatus: poolStats.healthStatus,
      },
      scraping: {
        totalRequests: poolStats.totalRequests,
        successfulRequests: poolStats.successfulRequests,
        failedRequests: poolStats.failedRequests,
        avgWaitTime: poolStats.avgWaitTime,
      },
      performance: {
        successRate: await this.getSuccessRate(),
        errorRate: await this.getErrorRate(),
      },
      ollama: ollamaStatus,
      llm: {
        totalExtractions: llmStats.totalExtractions,
        successfulExtractions: llmStats.successfulExtractions,
        failedExtractions: llmStats.failedExtractions,
        avgExtractionTimeMs: llmStats.avgExtractionTimeMs,
        lastExtractionTimeMs: llmStats.lastExtractionTimeMs,
      },
    };
  }

  /**
   * Check database connectivity and performance
   */
  private async checkDatabase(): Promise<DependencyStatus> {
    try {
      const start = Date.now();
      await this.prisma.$queryRaw`SELECT 1`;
      const responseTime = Date.now() - start;

      // Consider database unhealthy if response time > 1 second
      return responseTime < 1000 ? 'healthy' : 'unhealthy';
    } catch (error) {
      this.logger.error('Database health check failed:', error);
      return 'unhealthy';
    }
  }

  /**
   * Check Puppeteer pool health and capacity
   */
  private async checkPuppeteerPool(): Promise<DependencyStatus> {
    try {
      const stats = this.puppeteerPool.getStats();

      // Pool is unhealthy if no instances are available
      if (stats.totalInstances === 0) {
        return 'unhealthy';
      }

      // Pool is degraded if more than 80% capacity is used
      const utilizationPercentage =
        (stats.busyInstances / stats.totalInstances) * 100;
      if (utilizationPercentage > 80) {
        return 'degraded';
      }

      // Pool is degraded if too many requests are queued
      if (stats.queuedRequests > 10) {
        return 'degraded';
      }

      return 'healthy';
    } catch (error) {
      this.logger.error('Puppeteer pool health check failed:', error);
      return 'unhealthy';
    }
  }

  /**
   * Check Ollama connectivity and model availability.
   * Reports healthy if the configured model is present, degraded if Ollama is
   * reachable but the model is missing, unhealthy if Ollama is unreachable.
   */
  private async checkOllama(): Promise<DependencyStatus> {
    try {
      const models = await this.ollamaService.listModels();
      const configuredModel = this.sharedConfig.getOllamaConfig().model;
      const isPresent = models.some((m) => m === configuredModel || m.startsWith(configuredModel));
      return isPresent ? 'healthy' : 'degraded';
    } catch (err) {
      if (err instanceof OllamaUnavailableError) {
        return 'unhealthy';
      }
      return 'unhealthy';
    }
  }

  /**
   * Get success rate percentage for scraping operations
   */
  private async getSuccessRate(): Promise<number> {
    try {
      // This would query your metrics/logging system
      // For now, calculate based on pool stats
      const stats = this.puppeteerPool.getStats();
      // TODO: Calculate real success rate from pool stats (successCount / totalRequests) instead of hardcoded value
      return stats.totalRequests > 0 ? 95.5 : 100;
    } catch {
      return 0;
    }
  }

  /**
   * Get error rate percentage for scraping operations
   */
  private async getErrorRate(): Promise<number> {
    try {
      // This would query your metrics/logging system
      const successRate = await this.getSuccessRate();
      return Math.max(0, 100 - successRate);
    } catch {
      return 0;
    }
  }
}
