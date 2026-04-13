// Export all shared types organized by domain
export * from './deals.js';
export * from './scraping.js';
export * from './filtering.js';
export * from './filter-utils.js';
export * from './enums.js';
export * from './responses.js';
export * from './auth.js';
export * from './notifications.js';
export * from './queues.js';
export * from './site-source.js';

// Sites module (field definitions, filter rules, table columns)
export * from './sites/index.js';

// NOTE: ArticleWrapper is NOT exported here to avoid pulling in @prisma/client
// dependency for web/frontend consumers. Backend services should import from
// '@dealscrapper/shared-types/article' instead.
