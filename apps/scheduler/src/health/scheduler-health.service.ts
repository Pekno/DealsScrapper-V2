/**
 * @fileoverview Custom health service for scheduler with worker and job management health checks
 * Extends the base health service with worker pool and job queue monitoring
 */

import { Injectable, Logger } from '@nestjs/common';
import { SharedConfigService } from '@dealscrapper/shared-config';
import {
  BaseHealthService,
  type DependencyStatus,
} from '@dealscrapper/shared-health';
import { WorkerHealthService } from '../worker-health/worker-health.service.js';

/**
 * Custom health service for scheduler with worker and job management health checks
 * Provides comprehensive health monitoring for job scheduling and worker management
 */
@Injectable()
export class SchedulerHealthService extends BaseHealthService {
  protected override readonly logger = new Logger(SchedulerHealthService.name);

  constructor(
    private readonly workerHealth: WorkerHealthService,
    private readonly sharedConfig: SharedConfigService
  ) {
    super({
      serviceName: 'scheduler',
      version: sharedConfig.get<string>('APP_VERSION'),
      environment: sharedConfig.get<string>('NODE_ENV'),
    });

    // Register custom dependency health checkers
    this.registerHealthChecker('workerPool', () => this.checkWorkerPool());

    this.logger.log(
      '🏥 SchedulerHealthService initialized with worker pool health checker'
    );
  }

  /**
   * Add scheduler-specific data to the general /health endpoint
   */
  protected async getCustomHealthData(): Promise<Record<string, unknown>> {
    try {
      const allWorkers = this.workerHealth.getAllRegisteredWorkers();
      const availableWorkers = await this.workerHealth.getAvailableWorkers();

      return {
        workers: {
          total: allWorkers.length,
          available: availableWorkers.length,
          busy: allWorkers.length - availableWorkers.length,
          details: allWorkers.map((worker) => ({
            id: worker.id,
            endpoint: worker.endpoint,
            site: worker.site ?? null,
            status: worker.status,
            currentLoad: worker.currentLoad,
            maxConcurrentJobs: worker.capacity.maxConcurrentJobs,
            supportedJobTypes: worker.capacity.supportedJobTypes,
            lastHeartbeat: worker.lastHeartbeat.toISOString(),
          })),
        },
      };
    } catch (error) {
      this.logger.error('Failed to get custom health data:', error);
      return {
        workers: {
          total: 0,
          available: 0,
          busy: 0,
          details: [],
          error: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }

  /**
   * Check worker pool health and availability
   */
  private async checkWorkerPool(): Promise<DependencyStatus> {
    try {
      const allWorkers = this.workerHealth.getAllRegisteredWorkers();
      const availableWorkers = await this.workerHealth.getAvailableWorkers();

      // No workers registered
      if (allWorkers.length === 0) {
        return 'unhealthy';
      }

      // Check for stale workers (no heartbeat in last 5 minutes)
      const now = new Date();
      const staleWorkers = allWorkers.filter(
        (worker) =>
          now.getTime() - worker.lastHeartbeat.getTime() > 5 * 60 * 1000
      );

      // More than 50% of workers are stale
      if (staleWorkers.length > allWorkers.length * 0.5) {
        return 'unhealthy';
      }

      // Less than 25% workers available
      const availabilityPercentage =
        (availableWorkers.length / allWorkers.length) * 100;
      if (availabilityPercentage < 25) {
        return 'degraded';
      }

      return 'healthy';
    } catch (error) {
      this.logger.error('Worker pool health check failed:', error);
      return 'unhealthy';
    }
  }
}
