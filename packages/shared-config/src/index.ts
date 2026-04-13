/**
 * @fileoverview Public exports for @dealscrapper/shared-config package
 * Provides centralized environment variable validation for all services
 */

export { SharedConfigModule } from './shared-config.module.js';
export { SharedConfigService } from './shared-config.service.js';
export type {
  SharedConfigOptions,
  RedisConfig,
  DatabaseConfig,
  JwtConfig,
  EmailConfig,
} from './interfaces/config.interface.js';
export {
  DEFAULT_REDIS_CONFIG,
  defaultRedisRetryStrategy,
} from './interfaces/config.interface.js';
