/**
 * @fileoverview Shared health package exports
 * Provides standardized health endpoints for all services
 */

// Module
export { SharedHealthModule } from './shared-health.module.js';

// Services
export { BaseHealthService } from './services/base-health.service.js';

// Controllers
export { BaseHealthController } from './controllers/base-health.controller.js';

// Interfaces and Types
export type {
  BaseHealthData,
  HealthData,
  ReadinessData,
  LivenessData,
  HealthConfig,
  HealthChecker,
  HealthCheckersRegistry,
  DependencyStatus,
  StandardDependencies,
} from './interfaces/health.interface.js';
