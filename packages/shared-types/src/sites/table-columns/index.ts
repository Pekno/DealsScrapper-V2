/**
 * Table Columns Registry
 * Aggregates all column definitions and provides utility functions
 */
import { UNIVERSAL_COLUMNS } from './universal.columns.js';
import { DEALABS_COLUMNS } from './dealabs.columns.js';
import { VINTED_COLUMNS } from './vinted.columns.js';
import { LEBONCOIN_COLUMNS } from './leboncoin.columns.js';
import type { TableColumnDefinition } from './table-column.types.js';

/**
 * Registry of columns by site
 */
export const COLUMN_REGISTRY: Record<string, TableColumnDefinition[]> = {
  universal: UNIVERSAL_COLUMNS,
  dealabs: DEALABS_COLUMNS,
  vinted: VINTED_COLUMNS,
  leboncoin: LEBONCOIN_COLUMNS,
};

/**
 * Get columns for specific site IDs
 * @param siteIds Array of site IDs to get columns for
 * @returns Array of column definitions (universal + site-specific)
 */
export function getColumnsForSites(siteIds: string[]): TableColumnDefinition[] {
  // Start with universal columns
  const columns = [...COLUMN_REGISTRY.universal];

  // Add site-specific columns
  for (const siteId of siteIds) {
    if (COLUMN_REGISTRY[siteId]) {
      columns.push(...COLUMN_REGISTRY[siteId]);
    }
  }

  // Deduplicate columns by key (keep first occurrence)
  const seen = new Set<string>();
  return columns.filter((col) => {
    if (seen.has(col.key)) {
      return false;
    }
    seen.add(col.key);
    return true;
  });
}

/**
 * Get only visible columns for specific site IDs
 * @param siteIds Array of site IDs
 * @returns Array of columns marked as defaultVisible
 */
export function getVisibleColumnsForSites(siteIds: string[]): TableColumnDefinition[] {
  return getColumnsForSites(siteIds).filter((col) => col.defaultVisible !== false);
}

/**
 * Get a column definition by key
 * @param key Column key
 * @param siteIds Optional site IDs to search in
 * @returns Column definition or undefined
 */
export function getColumnByKey(
  key: string,
  siteIds?: string[]
): TableColumnDefinition | undefined {
  const searchSites = siteIds || Object.keys(COLUMN_REGISTRY);

  for (const siteId of ['universal', ...searchSites]) {
    const columns = COLUMN_REGISTRY[siteId];
    if (columns) {
      const column = columns.find((col) => col.key === key);
      if (column) {
        return column;
      }
    }
  }
  return undefined;
}

// Re-export types and individual column arrays
export * from './table-column.types.js';
export { UNIVERSAL_COLUMNS, DEALABS_COLUMNS, VINTED_COLUMNS, LEBONCOIN_COLUMNS };
