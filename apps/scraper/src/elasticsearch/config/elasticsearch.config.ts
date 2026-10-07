/**
 * @fileoverview ElasticSearch connection configuration
 * Centralized configuration following SOLID single responsibility principle
 */

import { COMMON_CONFIG, extractErrorMessage } from '@dealscrapper/shared';

/**
 * Core ElasticSearch configuration constants
 * Immutable configuration values for consistent behavior across the application
 */
export const ELASTICSEARCH_CONFIG = {
  /** Connection and performance settings */
  CONNECTION: {
    DEFAULT_URL: 'http://localhost:9200',
    MAX_RETRIES: COMMON_CONFIG.RETRIES.MAX_ATTEMPTS_DATABASE,
    REQUEST_TIMEOUT: COMMON_CONFIG.TIMEOUTS.ELASTICSEARCH,
    PING_TIMEOUT: COMMON_CONFIG.TIMEOUTS.ELASTICSEARCH,
  },
} as const;

/**
 * Build ElasticSearch connection configuration from environment variables
 * Provides flexible configuration for different environments
 *
 * @returns ElasticSearch client configuration object
 */
export function buildElasticSearchConnectionConfig() {
  const elasticsearchUrl = process.env.ELASTICSEARCH_NODE ??
    ELASTICSEARCH_CONFIG.CONNECTION.DEFAULT_URL;

  return {
    node: elasticsearchUrl,
    maxRetries: ELASTICSEARCH_CONFIG.CONNECTION.MAX_RETRIES,
    requestTimeout: ELASTICSEARCH_CONFIG.CONNECTION.REQUEST_TIMEOUT,
    pingTimeout: ELASTICSEARCH_CONFIG.CONNECTION.PING_TIMEOUT,
    // Security disabled to match docker-compose configuration
    ssl: {
      rejectUnauthorized: false,
    },
  };
}

/**
 * Validate that required environment variables are set
 * Ensures proper configuration before starting the service
 *
 * @throws Error if critical configuration is missing
 */
export function validateElasticSearchConfiguration(): void {
  const requiredEnvVars: string[] = [
    // ElasticSearch URL is required, but has defaults
  ];

  const missingVars = requiredEnvVars.filter(
    (envVar) => !process.env[envVar]
  );

  if (missingVars.length > 0) {
    throw new Error(
      `Missing required ElasticSearch environment variables: ${missingVars.join(', ')}`
    );
  }

  // Validate URL format
  const elasticsearchUrl = process.env.ELASTICSEARCH_NODE ??
    ELASTICSEARCH_CONFIG.CONNECTION.DEFAULT_URL;

  try {
    new URL(elasticsearchUrl);
  } catch (error) {
    throw new Error(
      `Invalid ElasticSearch URL: ${elasticsearchUrl}. Error: ${extractErrorMessage(error)}`
    );
  }
}
