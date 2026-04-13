/**
 * Types barrel exports
 * Provides clean imports for TypeScript types
 */

// Filter-related types
export type {
  Filter,
  FilterWithMetrics,
  FilterListResponse,
  CreateFilterRequest,
  UpdateFilterRequest,
  Category,
  FilterStats,
  RuleBasedFilterExpression,
  FilterRule,
  FilterRuleGroup,
  LogicalOperator,
  FilterableField,
  FilterOperator,
  FilterFieldDefinition,
  FilterOperatorDefinition,
  DigestFrequency,
} from '@/features/filters/types/filter.types';

// Article/Product-related types
export type {
  Article,
  ArticleWithMatch,
  ArticleListResponse,
  ArticleQuery,
  ArticleSortField,
  SortConfig,
  TableColumn,
  HeatConfig,
  ProductTooltip,
  ArticleGenerator,
  TableState,
  TableAction,
} from './article';

// Notification-related types
export type {
  WebSocketNotification,
  EnhancedWebSocketNotification,
  NotificationEventHandlers,
} from '../lib/websocket';
