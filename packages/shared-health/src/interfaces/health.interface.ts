/**
 * @fileoverview Health check interfaces for standardized health endpoints
 * Provides consistent health check structures across all services
 */

/**
 * Base health data included in all health responses
 */
export interface BaseHealthData {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  service: string;
  uptime: number;
}

/**
 * Dependency health status
 */
export type DependencyStatus = 'healthy' | 'unhealthy' | 'degraded' | 'unknown';

/**
 * Standard dependencies that services might check
 */
export interface StandardDependencies {
  database?: DependencyStatus;
  redis?: DependencyStatus;
  queue?: DependencyStatus;
  externalApi?: DependencyStatus;
  [key: string]: DependencyStatus | undefined;
}

/**
 * Readiness check data - indicates if service is ready to receive traffic
 * Used for Kubernetes readiness probes
 */
export interface ReadinessData extends BaseHealthData {
  dependencies: StandardDependencies;
  ready: boolean;
}

/**
 * Liveness check data - indicates if service is alive and responsive
 * Used for Kubernetes liveness probes
 */
export interface LivenessData extends BaseHealthData {
  alive: boolean;
  memoryUsage: {
    used: number;
    total: number;
    percentage: number;
  };
  cpuUsage?: {
    percentage: number;
  };
}

/**
 * General health check data - can include any custom service data
 * This is the most flexible endpoint for service-specific health info
 */
export interface HealthData extends BaseHealthData {
  version?: string;
  environment?: string;
  [key: string]: unknown; // Allow custom service-specific data
}

/**
 * Health check configuration for services
 */
export interface HealthConfig {
  serviceName: string;
  version?: string;
  environment?: string;
  dependenciesToCheck?: (keyof StandardDependencies)[];
  customHealthChecks?: Record<string, () => Promise<any>>;
}

/**
 * Health checker function signature for custom dependency checks
 */
export type HealthChecker = () => Promise<DependencyStatus>;

/**
 * Health checkers registry for services to register custom dependency checks
 */
export interface HealthCheckersRegistry {
  [dependencyName: string]: HealthChecker;
}
