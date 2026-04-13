import { Module } from '@nestjs/common';

// Repositories
import {
  FilterRepository,
  ArticleRepository,
  MatchRepository,
  CategoryRepository,
} from '../repositories/index.js';

// Services
import {
  FilterEvaluationService,
  DealPersistenceService,
} from '../services/index.js';

// Rule Engine Service (required by FilterEvaluationService)
import { RuleEngineService } from '../filter-matching/rule-engine.service.js';

// ElasticSearch Module (required by DealPersistenceService)
import { DealElasticSearchModule } from '../elasticsearch/elasticsearch.module.js';

// Notification Module (required by DealPersistenceService)
import { NotificationModule } from '../notification/notification.module.js';

/**
 * Shared module containing all repositories and specialized services
 * Provides centralized dependency injection for the new architecture
 *
 * This module follows the Repository Pattern and SOLID principles:
 * - Single Responsibility: Each repository handles one entity type
 * - Dependency Inversion: Services depend on repository abstractions
 * - Open/Closed: Easy to extend with new repositories/services
 */
@Module({
  imports: [
    // Import ElasticSearch module for DealPersistenceService dependency
    DealElasticSearchModule,
    // Import Notification module for DealPersistenceService dependency
    NotificationModule,
  ],
  providers: [
    // Repositories for data access layer
    FilterRepository,
    ArticleRepository,
    MatchRepository,
    CategoryRepository,

    // Rule engine service (required by FilterEvaluationService)
    RuleEngineService,

    // Specialized services for business logic layer
    FilterEvaluationService,
    DealPersistenceService,
  ],
  exports: [
    // Export all repositories for dependency injection
    FilterRepository,
    ArticleRepository,
    MatchRepository,
    CategoryRepository,

    // Export rule engine service
    RuleEngineService,

    // Export all services for dependency injection
    FilterEvaluationService,
    DealPersistenceService,
  ],
})
export class SharedModule {}
