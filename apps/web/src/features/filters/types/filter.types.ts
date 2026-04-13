/**
 * Frontend types for the RuleBuilder component
 * Based on backend rule-based-filter.types.ts
 * Uses shared-types for field definitions to ensure consistency with backend
 */

// Import field definitions from shared-types
import type { FilterableField as SharedFilterableField } from '@dealscrapper/shared-types';
import {
  ALL_SITE_FIELD_DEFINITIONS,
  getFieldsForSites,
  type SiteFieldDefinition,
} from '@dealscrapper/shared-types';

export type FilterableField = SharedFilterableField;

export type FilterOperator =
  // Numeric operators
  | '='
  | '!='
  | '>'
  | '>='
  | '<'
  | '<='
  // String operators
  | 'CONTAINS'
  | 'NOT_CONTAINS'
  | 'STARTS_WITH'
  | 'ENDS_WITH'
  | 'REGEX'
  | 'NOT_REGEX'
  | 'EQUALS'
  | 'NOT_EQUALS'
  // Array operators
  | 'IN'
  | 'NOT_IN'
  | 'INCLUDES_ANY'
  | 'INCLUDES_ALL'
  | 'NOT_INCLUDES_ANY'
  // Boolean operators
  | 'IS_TRUE'
  | 'IS_FALSE'
  // Date operators
  | 'BEFORE'
  | 'AFTER'
  | 'BETWEEN'
  | 'OLDER_THAN'
  | 'NEWER_THAN';

export type LogicalOperator = 'AND' | 'OR' | 'NOT';

export interface FilterRule {
  field: FilterableField;
  operator: FilterOperator;
  /** Rule value - includes number[] for BETWEEN operator tuples */
  value: string | string[] | number | number[] | boolean;
  caseSensitive?: boolean;
  weight?: number;
  /** Site this rule applies to (required for site-specific fields like temperature, brand, etc.) */
  siteSpecific?: string;
}

export interface FilterRuleGroup {
  logic: LogicalOperator;
  rules: (FilterRule | FilterRuleGroup)[];
  weight?: number;
}

export interface RuleBasedFilterExpression {
  rules: (FilterRule | FilterRuleGroup)[];
  matchLogic?: LogicalOperator;
  minScore?: number;
  scoreMode?: 'weighted' | 'percentage' | 'points';
}

// Field definitions with types and labels for the UI
export interface FilterFieldDefinition {
  key: FilterableField;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'array';
  description: string;
  operators: FilterOperator[];
  /** Sites this field is available for, or 'universal' for all sites */
  sites: string[] | 'universal';
  // Numeric field properties for NumberInput component
  min?: number;
  max?: number;
  step?: number;
  precision?: number;
}

// Operator definitions for the UI
export interface FilterOperatorDefinition {
  key: FilterOperator;
  label: string;
  description: string;
  valueType: 'single' | 'double' | 'array' | 'none';
  supportedFieldTypes: ('string' | 'number' | 'boolean' | 'date' | 'array')[];
}

// UI-specific types for the RuleBuilder component
export interface RuleBuilderProps {
  rules: (FilterRule | FilterRuleGroup)[];
  onRulesChange: (rules: (FilterRule | FilterRuleGroup)[]) => void;
  availableFields: FilterFieldDefinition[];
  operators: FilterOperatorDefinition[];
  className?: string;
  disabled?: boolean;
  // Enhanced operator selector options
  enhancedOperatorSelector?: boolean;
  showOperatorIcons?: boolean;
  groupOperatorsByType?: boolean;
  compactOperatorSelector?: boolean;
}

export interface RuleGroupProps {
  group: FilterRuleGroup;
  onChange: (group: FilterRuleGroup) => void;
  onRemove: () => void;
  level: number;
  availableFields: FilterFieldDefinition[];
  operators: FilterOperatorDefinition[];
  disabled?: boolean;
  /** Whether to show the remove button (overrides level-based logic) */
  showRemoveButton?: boolean;
  // Enhanced operator selector options
  enhancedOperatorSelector?: boolean;
  showOperatorIcons?: boolean;
  groupOperatorsByType?: boolean;
  compactOperatorSelector?: boolean;
}

export interface RuleItemProps {
  rule: FilterRule;
  onChange: (rule: FilterRule) => void;
  onRemove: () => void;
  availableFields: FilterFieldDefinition[];
  operators: FilterOperatorDefinition[];
  disabled?: boolean;
  showRemoveButton?: boolean;
  // Enhanced operator selector options
  enhancedOperatorSelector?: boolean;
  showOperatorIcons?: boolean;
  groupOperatorsByType?: boolean;
  compactOperatorSelector?: boolean;
  // For indexed data-cy attributes in testing
  index?: number;
}

// Helper function to map Filter to FilterWithMetrics for UI compatibility
export function mapFilterToFilterWithMetrics(
  filter: Filter
): FilterWithMetrics {
  return {
    ...filter,
    isActive: filter.active,
    totalDeals: filter.totalMatches,
    newDeals: filter.matchesLast24h,
  };
}

/**
 * Convert SiteFieldDefinition from shared-types to FilterFieldDefinition for UI
 */
function convertToFilterFieldDefinition(
  field: SiteFieldDefinition
): FilterFieldDefinition {
  return {
    key: field.key as FilterableField,
    label: field.label,
    type: field.type,
    description: field.description || '',
    operators: field.operators as FilterOperator[],
    sites: field.sites,
    min: field.min,
    max: field.max,
    step: field.step,
    precision: field.precision,
  };
}

/**
 * Field definitions derived from shared-types
 * These are the complete set of filterable fields from all sites
 */
export const FIELD_DEFINITIONS: FilterFieldDefinition[] =
  ALL_SITE_FIELD_DEFINITIONS.map(convertToFilterFieldDefinition);

/**
 * Get field definitions available for specific sites
 * @param siteIds Array of site IDs (e.g., ['dealabs', 'vinted'])
 * @returns Array of FilterFieldDefinition available for those sites
 */
export function getAvailableFieldDefinitions(
  siteIds: string[]
): FilterFieldDefinition[] {
  return getFieldsForSites(siteIds).map(convertToFilterFieldDefinition);
}

export const OPERATOR_DEFINITIONS: FilterOperatorDefinition[] = [
  // Numeric operators
  {
    key: '=',
    label: 'Equals',
    description: 'Exactly equal to',
    valueType: 'single',
    supportedFieldTypes: ['number', 'string'],
  },
  {
    key: '!=',
    label: 'Not equals',
    description: 'Not equal to',
    valueType: 'single',
    supportedFieldTypes: ['number', 'string'],
  },
  {
    key: '>',
    label: 'Greater than',
    description: 'Greater than',
    valueType: 'single',
    supportedFieldTypes: ['number'],
  },
  {
    key: '>=',
    label: 'Greater than or equal',
    description: 'Greater than or equal to',
    valueType: 'single',
    supportedFieldTypes: ['number'],
  },
  {
    key: '<',
    label: 'Less than',
    description: 'Less than',
    valueType: 'single',
    supportedFieldTypes: ['number'],
  },
  {
    key: '<=',
    label: 'Less than or equal',
    description: 'Less than or equal to',
    valueType: 'single',
    supportedFieldTypes: ['number'],
  },

  // String operators
  {
    key: 'CONTAINS',
    label: 'Contains',
    description: 'Contains the text',
    valueType: 'single',
    supportedFieldTypes: ['string'],
  },
  {
    key: 'NOT_CONTAINS',
    label: 'Does not contain',
    description: 'Does not contain the text',
    valueType: 'single',
    supportedFieldTypes: ['string'],
  },
  {
    key: 'STARTS_WITH',
    label: 'Starts with',
    description: 'Starts with the text',
    valueType: 'single',
    supportedFieldTypes: ['string'],
  },
  {
    key: 'ENDS_WITH',
    label: 'Ends with',
    description: 'Ends with the text',
    valueType: 'single',
    supportedFieldTypes: ['string'],
  },
  {
    key: 'REGEX',
    label: 'Matches regex',
    description: 'Matches regular expression',
    valueType: 'single',
    supportedFieldTypes: ['string'],
  },
  {
    key: 'NOT_REGEX',
    label: 'Does not match regex',
    description: 'Does not match regular expression',
    valueType: 'single',
    supportedFieldTypes: ['string'],
  },
  {
    key: 'EQUALS',
    label: 'Equals',
    description: 'Exactly equal to',
    valueType: 'single',
    supportedFieldTypes: ['string'],
  },
  {
    key: 'NOT_EQUALS',
    label: 'Not equals',
    description: 'Not equal to',
    valueType: 'single',
    supportedFieldTypes: ['string'],
  },

  // Array operators
  {
    key: 'IN',
    label: 'In',
    description: 'Is one of the values',
    valueType: 'array',
    supportedFieldTypes: ['string', 'number'],
  },
  {
    key: 'NOT_IN',
    label: 'Not in',
    description: 'Is not one of the values',
    valueType: 'array',
    supportedFieldTypes: ['string', 'number'],
  },
  {
    key: 'INCLUDES_ANY',
    label: 'Includes any',
    description: 'Includes any of the values',
    valueType: 'array',
    supportedFieldTypes: ['string'],
  },
  {
    key: 'INCLUDES_ALL',
    label: 'Includes all',
    description: 'Includes all of the values',
    valueType: 'array',
    supportedFieldTypes: ['string'],
  },

  // Boolean operators
  {
    key: 'IS_TRUE',
    label: 'Is true',
    description: 'Is true',
    valueType: 'none',
    supportedFieldTypes: ['boolean'],
  },
  {
    key: 'IS_FALSE',
    label: 'Is false',
    description: 'Is false',
    valueType: 'none',
    supportedFieldTypes: ['boolean'],
  },

  // Range operators
  {
    key: 'BETWEEN',
    label: 'Between',
    description: 'Between two values (inclusive)',
    valueType: 'double',
    supportedFieldTypes: ['number', 'date'],
  },

  // Date operators
  {
    key: 'BEFORE',
    label: 'Before',
    description: 'Before this date',
    valueType: 'single',
    supportedFieldTypes: ['date'],
  },
  {
    key: 'AFTER',
    label: 'After',
    description: 'After this date',
    valueType: 'single',
    supportedFieldTypes: ['date'],
  },
  {
    key: 'OLDER_THAN',
    label: 'Older than',
    description: 'Older than (hours)',
    valueType: 'single',
    supportedFieldTypes: ['date', 'number'],
  },
  {
    key: 'NEWER_THAN',
    label: 'Newer than',
    description: 'Newer than (hours)',
    valueType: 'single',
    supportedFieldTypes: ['date', 'number'],
  },
];

// Category interface matching backend CategoryDto
export interface Category {
  id: string;
  name: string;
  slug: string;
  siteId: string; // 'dealabs' | 'vinted' | 'leboncoin'
  sourceUrl: string; // Original category page URL
  parentId?: string | null; // Parent category ID for hierarchy
  level: number;
  description?: string | null;
  dealCount: number;
  avgTemperature: number;
  popularBrands: string[];
  isActive: boolean;
  userCount: number;
  createdAt: Date;
  updatedAt: Date;
  color?: string; // UI-specific property for display
  displayPath: string; // Pre-built hierarchy string like "Femmes -> Vetements -> Shorts"
  isSelectable: boolean; // false for Level 0 categories (main tabs), true for Level 1+
}

// Digest frequency enum matching backend
export type DigestFrequency = 'hourly' | 'daily' | 'weekly' | 'disabled';

// Filter stats interface
export interface FilterStats {
  totalMatches: number;
  matchesLast24h: number;
  matchesLast7d: number;
  avgScore: number;
  topScore: number;
  lastMatchAt?: Date;
}

// Complete Filter interface matching backend FilterResponseDto
export interface Filter {
  id: string;
  userId: string;
  name: string;
  description?: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  enabledSites: string[]; // Multi-site support: ['dealabs', 'vinted', 'leboncoin']
  categories: Category[];
  filterExpression: RuleBasedFilterExpression;
  immediateNotifications: boolean;
  digestFrequency: DigestFrequency;
  maxNotificationsPerDay: number;
  totalMatches: number;
  matchesLast24h: number;
  lastMatchAt?: Date;
  stats?: FilterStats;
  nextScheduledAt?: Date;
}

// Extended interface for UI display with computed properties
export interface FilterWithMetrics extends Filter {
  // Computed UI properties
  isActive: boolean; // Maps to 'active' property
  totalDeals: number; // Maps to 'totalMatches'
  newDeals: number; // Maps to 'matchesLast24h'
}

// API response interfaces
export interface FilterListResponse {
  filters: Filter[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Create filter request interface matching backend CreateFilterDto
export interface CreateFilterRequest {
  name: string;
  description?: string;
  active?: boolean;
  categoryIds: string[];
  // enabledSites is derived from categories by backend - no longer sent in request
  filterExpression: RuleBasedFilterExpression;
  immediateNotifications?: boolean;
  digestFrequency?: DigestFrequency;
  maxNotificationsPerDay?: number;
}

// Update filter request interface
export interface UpdateFilterRequest {
  name?: string;
  description?: string;
  active?: boolean;
  categoryIds?: string[];
  // enabledSites is derived from categories by backend - no longer sent in request
  filterExpression?: RuleBasedFilterExpression;
  immediateNotifications?: boolean;
  digestFrequency?: DigestFrequency;
  maxNotificationsPerDay?: number;
}

// Scraping Status Types for Smart Polling
export interface ScheduledJob {
  id: string;
  nextScheduledAt: string; // ISO string
  isActive: boolean;
}

export interface LatestExecution {
  id: string;
  status: 'completed' | 'pending' | 'processing' | 'failed';
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
  executionTimeMs: number;
  dealsFound: number;
  dealsProcessed: number;
}

export interface CategoryScrapingStatus {
  categoryId: string;
  categoryName: string;
  scheduledJob: ScheduledJob;
  latestExecution?: LatestExecution;
}

export interface FilterScrapingStatus {
  categories: CategoryScrapingStatus[];
  nextScrapingAt: string; // ISO string - earliest next job across all categories
}

// Smart Polling State Machine
export type PollingMode = 'idle' | 'scheduled' | 'active' | 'cooldown';

export interface PollingState {
  mode: PollingMode;
  activeCategories: Set<string>;
  timers: Map<string, NodeJS.Timeout>;
  nextPollAt: Date | null;
  requestCount: number;
  savedRequests: number;
  lastModeChange: Date;
}
