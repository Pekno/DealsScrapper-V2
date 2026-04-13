/**
 * useTableColumns - Hook for getting table column definitions based on selected sites
 * Uses shared-types column definitions for consistency with backend
 */

import { useMemo } from 'react';
import {
  getColumnsForSites,
  getVisibleColumnsForSites,
  getColumnByKey,
  SiteSource,
  type TableColumnDefinition,
} from '@dealscrapper/shared-types';

/**
 * Extended column definition with UI-specific properties
 */
export interface UITableColumn extends TableColumnDefinition {
  /** Whether the column is currently visible */
  isVisible: boolean;
  /** Column order index */
  order: number;
}

/**
 * Hook return type
 */
export interface UseTableColumnsResult {
  /** All available columns for the selected sites */
  allColumns: TableColumnDefinition[];
  /** Only visible columns (defaultVisible = true) */
  visibleColumns: TableColumnDefinition[];
  /** Get a specific column by key */
  getColumn: (key: string) => TableColumnDefinition | undefined;
  /** Check if a column is sortable */
  isColumnSortable: (key: string) => boolean;
  /** Get sort mode for a column */
  getColumnSortMode: (key: string) => 'client' | 'server' | 'none';
  /** Get column keys that are sortable via server */
  serverSortableColumns: string[];
  /** Get column keys that are sortable via client */
  clientSortableColumns: string[];
}

/**
 * Hook to get table column definitions based on selected sites
 *
 * @param siteIds Array of site IDs (e.g., ['dealabs', 'vinted'])
 * @returns Object with column definitions and helper functions
 */
export function useTableColumns(siteIds: string[]): UseTableColumnsResult {
  // All available sites for fallback
  const allSites = [SiteSource.DEALABS, SiteSource.VINTED, SiteSource.LEBONCOIN];

  // Get all columns for the selected sites
  const allColumns = useMemo(() => {
    if (siteIds.length === 0) {
      // If no sites selected, show all columns
      return getColumnsForSites(allSites);
    }
    return getColumnsForSites(siteIds);
  }, [siteIds]);

  // Get only visible columns
  const visibleColumns = useMemo(() => {
    if (siteIds.length === 0) {
      return getVisibleColumnsForSites(allSites);
    }
    return getVisibleColumnsForSites(siteIds);
  }, [siteIds]);

  // Get a specific column by key
  const getColumn = useMemo(() => {
    return (key: string): TableColumnDefinition | undefined => {
      return getColumnByKey(key, siteIds.length > 0 ? siteIds : undefined);
    };
  }, [siteIds]);

  // Check if a column is sortable
  const isColumnSortable = useMemo(() => {
    return (key: string): boolean => {
      const column = getColumnByKey(key, siteIds.length > 0 ? siteIds : undefined);
      return column?.sortable ?? false;
    };
  }, [siteIds]);

  // Get sort mode for a column
  const getColumnSortMode = useMemo(() => {
    return (key: string): 'client' | 'server' | 'none' => {
      const column = getColumnByKey(key, siteIds.length > 0 ? siteIds : undefined);
      if (!column?.sortable) return 'none';
      return column.sortMode ?? 'none';
    };
  }, [siteIds]);

  // Get server-sortable column keys
  const serverSortableColumns = useMemo(() => {
    return allColumns
      .filter((col) => col.sortable && col.sortMode === 'server')
      .map((col) => col.key);
  }, [allColumns]);

  // Get client-sortable column keys
  const clientSortableColumns = useMemo(() => {
    return allColumns
      .filter((col) => col.sortable && col.sortMode === 'client')
      .map((col) => col.key);
  }, [allColumns]);

  return {
    allColumns,
    visibleColumns,
    getColumn,
    isColumnSortable,
    getColumnSortMode,
    serverSortableColumns,
    clientSortableColumns,
  };
}

/**
 * Export column types and utilities from shared-types for convenience
 */
export type { TableColumnDefinition };
export { getColumnsForSites, getVisibleColumnsForSites, getColumnByKey };
