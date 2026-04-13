// Repository implementations
export * from './filter.repository.js';
export * from './article.repository.js';
export * from './match.repository.js';
export * from './category.repository.js';
export * from './notification.repository.js';
export * from './scraping-job.repository.js';

// Repository interfaces for dependency injection
export type { IFilterRepository } from './filter.repository.js';
export type { IArticleRepository } from './article.repository.js';
export type {
  IMatchRepository,
  MatchCreateData,
  MatchWithRelations,
} from './match.repository.js';
export type { ICategoryRepository } from './category.repository.js';
export type {
  INotificationRepository,
  MatchNotificationContent,
} from './notification.repository.js';
