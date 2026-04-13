/**
 * Table Column Type Definitions
 */

/** Sort mode for table columns */
export type SortMode = 'client' | 'server' | 'none';

/** Definition of a table column */
export interface TableColumnDefinition {
  /** Unique column key (matches field name) */
  key: string;
  /** Display label for the column header */
  label: string;
  /** Whether the column is sortable */
  sortable: boolean;
  /** Sort mode: 'client' for in-memory, 'server' for API sorting */
  sortMode?: SortMode;
  /** Column width (CSS value) */
  width?: string;
  /** Whether column is visible by default */
  defaultVisible?: boolean;
  /** Column alignment */
  align?: 'left' | 'center' | 'right';
  /** Format type hint for rendering */
  format?: 'text' | 'number' | 'currency' | 'date' | 'boolean' | 'percentage' | 'custom';
}
