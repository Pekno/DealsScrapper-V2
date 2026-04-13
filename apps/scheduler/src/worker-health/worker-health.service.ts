import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { COMMON_CONFIG, extractErrorMessage } from '@dealscrapper/shared';
import axios, { AxiosResponse } from 'axios';
import type {
  WorkerMetrics,
  WorkerCapacity,
  WorkerHealthStatus,
  CachedHealthStatus,
} from '../types/scheduler.types.js';

/**
 * Health check configuration constants
 */
const HEALTH_CHECK_CONFIG = {
  REQUEST_TIMEOUT_MS: COMMON_CONFIG.TIMEOUTS.FAST,
  CACHE_DURATION_MS: COMMON_CONFIG.TIMEOUTS.HEALTH_CHECK, // 10 seconds
  STALE_THRESHOLD_MS: 5 * 60 * 1000, // 5 minutes - keep specific for business logic
  MAX_CONCURRENT_CHECKS: COMMON_CONFIG.PERFORMANCE.MAX_CONCURRENT / 2, // Half of max concurrent
  HEALTH_ENDPOINT: '/health',
} as const;

/**
 * Service for managing worker health monitoring with on-demand health checks
 * Implements efficient caching and parallel health verification
 */
@Injectable()
export class WorkerHealthService {
  private readonly logger = new Logger(WorkerHealthService.name);
  private readonly registeredWorkers = new Map<string, WorkerMetrics>();
  private readonly healthCache = new Map<string, CachedHealthStatus>();

  /**
   * Registers a new worker in the system
   * @param workerId - Unique identifier for the worker
   * @param endpoint - Worker's health check endpoint URL
   * @param capacity - Worker's processing capacity information
   * @returns Promise that resolves when worker is registered
   */
  async registerWorker(
    workerId: string,
    endpoint: string,
    capacity: WorkerCapacity,
    site?: string
  ): Promise<void> {
    try {
      // Validate input parameters
      if (!workerId || typeof workerId !== 'string') {
        throw new Error(`Invalid worker ID: ${workerId}`);
      }
      if (!endpoint || typeof endpoint !== 'string') {
        throw new Error(`Invalid endpoint: ${endpoint}`);
      }
      if (!capacity || typeof capacity !== 'object') {
        throw new Error(`Invalid capacity object`);
      }
      if (
        typeof capacity.maxConcurrentJobs !== 'number' ||
        capacity.maxConcurrentJobs <= 0
      ) {
        throw new Error(
          `Invalid maxConcurrentJobs: ${capacity.maxConcurrentJobs}`
        );
      }
      if (
        !Array.isArray(capacity.supportedJobTypes) ||
        capacity.supportedJobTypes.length === 0
      ) {
        throw new Error(
          `Invalid supportedJobTypes: ${capacity.supportedJobTypes}`
        );
      }

      const normalizedEndpoint = this.normalizeEndpoint(endpoint);

      const workerMetrics: WorkerMetrics = {
        id: workerId,
        endpoint: normalizedEndpoint,
        ...(site ? { site } : {}),
        capacity,
        currentLoad: 0,
        lastHeartbeat: new Date(),
        status: 'active',
      };

      this.registeredWorkers.set(workerId, workerMetrics);

      this.logger.log(
        `Registered worker ${workerId} at ${normalizedEndpoint} with capacity: ${capacity.maxConcurrentJobs} jobs`
      );
    } catch (error) {
      this.logger.error(`Failed to register worker ${workerId}:`, error);
      throw new Error(
        `Worker registration failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Unregisters a worker from the system
   * @param workerId - Worker identifier to remove
   * @returns Promise that resolves when worker is unregistered
   */
  async unregisterWorker(workerId: string): Promise<void> {
    this.registeredWorkers.delete(workerId);
    this.healthCache.delete(workerId);

    this.logger.log(`Unregistered worker ${workerId}`);
  }

  /**
   * Retrieves all workers that are currently healthy and available for job processing
   * Performs on-demand health checks with intelligent caching
   * @returns Array of healthy worker metrics
   */
  async getAvailableWorkers(): Promise<WorkerMetrics[]> {
    const allWorkers = Array.from(this.registeredWorkers.values());

    if (allWorkers.length === 0) {
      this.logger.debug('No workers registered');
      return [];
    }

    // Perform health checks in batches to avoid overwhelming workers
    const healthCheckBatches = this.createHealthCheckBatches(allWorkers);
    const healthyWorkers: WorkerMetrics[] = [];

    for (const batch of healthCheckBatches) {
      const batchResults = await Promise.allSettled(
        batch.map((worker) => this.verifyWorkerHealth(worker))
      );

      batch.forEach((worker, index) => {
        const result = batchResults[index];
        if (result.status === 'fulfilled' && result.value.isHealthy) {
          // Update worker status based on health check
          const updatedWorker: WorkerMetrics = {
            ...worker,
            currentLoad: result.value.currentLoad ?? worker.currentLoad,
            lastHeartbeat: new Date(),
            status: 'active',
          };

          this.registeredWorkers.set(worker.id, updatedWorker);

          // Only include workers with available capacity
          if (
            updatedWorker.currentLoad < updatedWorker.capacity.maxConcurrentJobs
          ) {
            healthyWorkers.push(updatedWorker);
          }
        } else {
          // Mark worker as inactive
          this.updateWorkerStatus(worker.id, 'inactive');
        }
      });
    }

    this.logger.debug(
      `Health check completed: ${healthyWorkers.length}/${allWorkers.length} workers available`
    );

    return healthyWorkers;
  }

  /**
   * Gets all registered workers regardless of health status
   * @returns Array of all worker metrics
   */
  getAllRegisteredWorkers(): WorkerMetrics[] {
    return Array.from(this.registeredWorkers.values());
  }

  /**
   * Updates the current load for a specific worker
   * @param workerId - Worker identifier
   * @param currentLoad - Current number of active jobs
   */
  /**
   * Checks if a worker is currently registered
   * @param workerId - Worker identifier to check
   * @returns True if worker is registered, false otherwise
   */
  isWorkerRegistered(workerId: string): boolean {
    return this.registeredWorkers.has(workerId);
  }

  updateWorkerLoad(workerId: string, currentLoad: number): void {
    try {
      // Validate input parameters
      if (!workerId || typeof workerId !== 'string') {
        throw new Error(`Invalid worker ID: ${workerId}`);
      }
      if (
        typeof currentLoad !== 'number' ||
        currentLoad < 0 ||
        !Number.isFinite(currentLoad)
      ) {
        throw new Error(`Invalid current load value: ${currentLoad}`);
      }

      const worker = this.registeredWorkers.get(workerId);
      if (worker) {
        const updatedWorker: WorkerMetrics = {
          ...worker,
          currentLoad,
          lastHeartbeat: new Date(),
        };
        this.registeredWorkers.set(workerId, updatedWorker);
        this.logger.debug(
          `Updated load for worker ${workerId}: ${currentLoad}`
        );
      } else {
        this.logger.warn(
          `💔 Heartbeat received from unregistered worker: ${workerId}. Worker needs to re-register.`
        );
        throw new UnauthorizedException(
          `Worker ${workerId} is not registered. Please register first.`
        );
      }
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error; // Re-throw authorization errors as-is
      }
      this.logger.error(`Failed to update worker load for ${workerId}:`, error);
      throw new Error(
        `Failed to update worker load: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Periodic cleanup of stale worker registrations and expired cache entries
   * Runs every 5 minutes to maintain system hygiene
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async cleanupStaleRegistrations(): Promise<void> {
    const now = Date.now();
    const staleThreshold = now - HEALTH_CHECK_CONFIG.STALE_THRESHOLD_MS;
    const staleWorkers: string[] = [];
    const expiredCacheKeys: string[] = [];

    this.logger.debug(
      `🧹 Starting cleanup: ${this.registeredWorkers.size} workers registered, stale threshold: ${new Date(staleThreshold).toISOString()}`
    );

    // Identify stale workers - log all workers for debugging
    for (const [workerId, worker] of this.registeredWorkers.entries()) {
      const heartbeatAge = now - worker.lastHeartbeat.getTime();
      const heartbeatTime = worker.lastHeartbeat.getTime();

      this.logger.debug(
        `🔍 Worker ${workerId}: last heartbeat ${worker.lastHeartbeat.toISOString()} (${Math.round(heartbeatAge / 1000)}s ago), threshold: ${heartbeatTime < staleThreshold ? 'STALE' : 'ACTIVE'}`
      );

      if (heartbeatTime < staleThreshold) {
        this.logger.debug(
          `💀 Marking worker ${workerId} as stale (last heartbeat: ${worker.lastHeartbeat.toISOString()}, age: ${Math.round(heartbeatAge / 1000)}s)`
        );
        staleWorkers.push(workerId);
      }
    }

    // Identify expired cache entries
    for (const [workerId, cachedHealth] of this.healthCache.entries()) {
      if (cachedHealth.timestamp < staleThreshold) {
        expiredCacheKeys.push(workerId);
      }
    }

    // Clean up stale registrations
    staleWorkers.forEach((workerId) => {
      const worker = this.registeredWorkers.get(workerId);
      this.logger.log(
        `🗑️ Removing stale worker: ${workerId} (last heartbeat: ${worker?.lastHeartbeat.toISOString()})`
      );
      this.registeredWorkers.delete(workerId);
      this.healthCache.delete(workerId);
    });

    // Clean up expired cache entries
    expiredCacheKeys.forEach((workerId) => {
      this.healthCache.delete(workerId);
    });

    if (staleWorkers.length > 0 || expiredCacheKeys.length > 0) {
      this.logger.log(
        `🧹 Cleanup completed: removed ${staleWorkers.length} stale workers, ${expiredCacheKeys.length} expired cache entries`
      );
    } else {
      this.logger.debug(`🧹 Cleanup completed: no stale workers found`);
    }
  }

  /**
   * Verifies the health of a specific worker with caching optimization
   */
  private async verifyWorkerHealth(
    worker: WorkerMetrics
  ): Promise<WorkerHealthStatus> {
    // Check cache first
    const cached = this.healthCache.get(worker.id);
    if (
      cached &&
      Date.now() - cached.timestamp < HEALTH_CHECK_CONFIG.CACHE_DURATION_MS
    ) {
      return cached.status;
    }

    // Perform actual health check
    const startTime = Date.now();

    try {
      const response: AxiosResponse = await axios.get(
        `${worker.endpoint}${HEALTH_CHECK_CONFIG.HEALTH_ENDPOINT}`,
        {
          timeout: HEALTH_CHECK_CONFIG.REQUEST_TIMEOUT_MS,
          headers: {
            'User-Agent': '@dealscrapper/scheduler',
            Accept: 'application/json',
          },
        }
      );

      const responseTime = Date.now() - startTime;
      const healthStatus: WorkerHealthStatus = {
        isHealthy: response.status === 200,
        currentLoad: response.data?.currentLoad ?? worker.currentLoad,
        lastCheck: new Date(),
        responseTime,
      };

      // Cache the successful result
      this.healthCache.set(worker.id, {
        status: healthStatus,
        timestamp: Date.now(),
      });

      return healthStatus;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage = extractErrorMessage(error);

      const failureStatus: WorkerHealthStatus = {
        isHealthy: false,
        error: errorMessage,
        lastCheck: new Date(),
        responseTime,
      };

      // Cache failure status briefly to avoid retry storms
      this.healthCache.set(worker.id, {
        status: failureStatus,
        timestamp: Date.now(),
      });

      this.logger.debug(
        `Health check failed for worker ${worker.id}: ${errorMessage}`
      );
      return failureStatus;
    }
  }

  /**
   * Creates batches for parallel health checking to avoid overwhelming workers
   */
  private createHealthCheckBatches(
    workers: WorkerMetrics[]
  ): WorkerMetrics[][] {
    const batches: WorkerMetrics[][] = [];
    const batchSize = HEALTH_CHECK_CONFIG.MAX_CONCURRENT_CHECKS;

    for (let i = 0; i < workers.length; i += batchSize) {
      batches.push(workers.slice(i, i + batchSize));
    }

    return batches;
  }

  /**
   * Updates the status of a worker
   */
  private updateWorkerStatus(
    workerId: string,
    status: WorkerMetrics['status']
  ): void {
    const worker = this.registeredWorkers.get(workerId);
    if (worker) {
      const updatedWorker: WorkerMetrics = {
        ...worker,
        status,
        lastHeartbeat: new Date(),
      };
      this.registeredWorkers.set(workerId, updatedWorker);
    }
  }

  /**
   * Normalizes endpoint URLs to ensure consistent format
   */
  private normalizeEndpoint(endpoint: string): string {
    // Remove trailing slash and ensure HTTP protocol
    let normalized = endpoint.replace(/\/$/, '');

    if (
      !normalized.startsWith('http://') &&
      !normalized.startsWith('https://')
    ) {
      normalized = `http://${normalized}`;
    }

    return normalized;
  }
}
