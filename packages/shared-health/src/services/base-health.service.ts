/**
 * @fileoverview Base health service providing standard health check functionality
 * Services can extend this to add custom health checks and data
 */

import { Injectable, Logger } from '@nestjs/common';
import type {
  BaseHealthData,
  HealthData,
  ReadinessData,
  LivenessData,
  HealthConfig,
  HealthChecker,
  HealthCheckersRegistry,
  DependencyStatus,
  StandardDependencies,
} from '../interfaces/health.interface.js';

/**
 * Base health service providing standard health check implementations
 * Services can extend this class to add custom health checks and data
 */
@Injectable()
export class BaseHealthService {
  protected readonly logger = new Logger(BaseHealthService.name);
  protected readonly startTime: Date;
  protected readonly config: HealthConfig;
  protected readonly healthCheckers: HealthCheckersRegistry = {};

  constructor(config: HealthConfig) {
    this.config = config;
    this.startTime = new Date();
    this.logger.log(`🏥 Health service initialized for ${config.serviceName}`);
  }

  /**
   * Register a custom dependency health checker
   * @param dependencyName Name of the dependency (e.g., 'database', 'redis')
   * @param checker Function that returns the health status of the dependency
   */
  registerHealthChecker(dependencyName: string, checker: HealthChecker): void {
    this.healthCheckers[dependencyName] = checker;
    this.logger.debug(`📝 Registered health checker for ${dependencyName}`);
  }

  /**
   * Get base health data that's included in all health responses
   * @returns Base health information
   */
  protected getBaseHealthData(): BaseHealthData {
    const uptime = Math.floor((Date.now() - this.startTime.getTime()) / 1000);

    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: this.config.serviceName,
      uptime,
    };
  }

  /**
   * Check the health status of registered dependencies
   * @returns Object containing health status of each dependency
   */
  protected async checkDependencies(): Promise<StandardDependencies> {
    const dependencies: StandardDependencies = {};
    const checkPromises: Array<Promise<void>> = [];

    // Check each registered health checker
    for (const [name, checker] of Object.entries(this.healthCheckers)) {
      const checkPromise = this.executeHealthCheck(name, checker).then(
        (status) => {
          dependencies[name] = status;
        }
      );
      checkPromises.push(checkPromise);
    }

    // Wait for all checks to complete
    await Promise.allSettled(checkPromises);

    return dependencies;
  }

  /**
   * Execute a single health check with error handling
   * @param name Name of the dependency being checked
   * @param checker Health checker function
   * @returns Health status of the dependency
   */
  private async executeHealthCheck(
    name: string,
    checker: HealthChecker
  ): Promise<DependencyStatus> {
    try {
      this.logger.debug(`🔍 Checking health of ${name}`);
      const status = await Promise.race([
        checker(),
        this.timeoutPromise(5000), // 5 second timeout
      ]);
      this.logger.debug(`✅ ${name} health check: ${status}`);
      return status;
    } catch (error) {
      this.logger.warn(
        `❌ ${name} health check failed:`,
        error instanceof Error ? error.message : error
      );
      return 'unhealthy';
    }
  }

  /**
   * Create a timeout promise for health checks
   * @param ms Timeout in milliseconds
   * @returns Promise that rejects after timeout
   */
  private timeoutPromise(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Health check timeout')), ms);
    });
  }

  /**
   * Get memory usage information
   * @returns Memory usage statistics
   */
  protected getMemoryUsage() {
    const memInfo = process.memoryUsage();
    return {
      used: memInfo.heapUsed,
      total: memInfo.heapTotal,
      percentage: Math.round((memInfo.heapUsed / memInfo.heapTotal) * 100),
    };
  }

  /**
   * Override this method in services to add custom health data
   * @returns Custom health data specific to the service
   */
  protected async getCustomHealthData(): Promise<Record<string, any>> {
    return {};
  }

  /**
   * Get general health status with optional custom data
   * Used for the main /health endpoint
   * @returns Complete health information
   */
  async getHealth(): Promise<HealthData> {
    const baseData = this.getBaseHealthData();
    const customData = await this.getCustomHealthData();

    return {
      ...baseData,
      version: this.config.version,
      environment: this.config.environment,
      ...customData,
    };
  }

  /**
   * Get readiness status - indicates if service is ready to receive traffic
   * Used for Kubernetes readiness probes (/health/ready)
   * @returns Readiness check information
   */
  async getReadiness(): Promise<ReadinessData> {
    const baseData = this.getBaseHealthData();
    const dependencies = await this.checkDependencies();

    // Service is ready if all dependencies are healthy
    const dependencyValues = Object.values(dependencies);
    const ready =
      dependencyValues.length === 0 ||
      dependencyValues.every((status) => status === 'healthy');

    const status = ready ? 'healthy' : 'degraded';

    return {
      ...baseData,
      status,
      dependencies,
      ready,
    };
  }

  /**
   * Get liveness status - indicates if service is alive and responsive
   * Used for Kubernetes liveness probes (/health/live)
   * @returns Liveness check information
   */
  async getLiveness(): Promise<LivenessData> {
    const baseData = this.getBaseHealthData();
    const memoryUsage = this.getMemoryUsage();

    // Service is alive if memory usage is not critical (< 95%)
    const alive = memoryUsage.percentage < 95;
    const status = alive ? 'healthy' : 'unhealthy';

    return {
      ...baseData,
      status,
      alive,
      memoryUsage,
    };
  }

  /**
   * Get service uptime in seconds
   * @returns Uptime in seconds
   */
  getUptime(): number {
    return Math.floor((Date.now() - this.startTime.getTime()) / 1000);
  }

  /**
   * Get service start time
   * @returns Date when service was started
   */
  getStartTime(): Date {
    return this.startTime;
  }
}
