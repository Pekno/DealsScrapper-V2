/**
 * Filters Feature - Barrel Export
 * Re-exports all filters-related components, hooks, types, and API
 */

// Components
export { FilterCard } from './components/FilterCard';
export { FilterGrid } from './components/FilterGrid';
export { CreateFilterForm } from './components/CreateFilterForm';
export { FilterDetailPage } from './components/FilterDetailPage';
export { CategorySelector } from './components/CategorySelector';
export { RuleBuilder } from './components/RuleBuilder';
export { CategoryTags } from './components/CategoryTags';
export { MetricsBadge } from './components/MetricsBadge';
export { SmartScrapingStatus } from './components/SmartScrapingStatus';

// Rule components
export { RuleValueInput } from './components/RuleValueInput';
export {
  FieldSelector,
  OperatorSelector,
  ValueInput,
  LogicalOperatorToggle,
  ActionButtons,
  RemoveButton,
  RuleLoadingSpinner,
  ErrorDisplay,
} from './components/RuleComponents';

// Hooks
export { useFilterForm } from './hooks/useFilterForm';
export { useFilterDetail } from './hooks/useFilterDetail';
export { useFilterStats } from './hooks/useFilterStats';
export { useFilterMatches } from './hooks/useFilterMatches';
export { useCategorySearch } from './hooks/useCategorySearch';
export { useRealTimeFilterRefresh } from './hooks/useRealTimeFilterRefresh';
export { useSmartFilterScrapingStatus } from './hooks/useSmartFilterScrapingStatus';
export { useTableColumns } from './hooks/useTableColumns';

// API
export { filtersApi } from './api/filters.api';

// Types
export type * from './types/filter.types';
