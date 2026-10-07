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
  OllamaConfig,
} from './interfaces/config.interface.js';
export {
  DEFAULT_REDIS_CONFIG,
  defaultRedisRetryStrategy,
  DEFAULT_OLLAMA_CONFIG,
} from './interfaces/config.interface.js';
