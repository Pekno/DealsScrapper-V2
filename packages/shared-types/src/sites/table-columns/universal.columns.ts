/**
 * Universal Table Columns
 * Columns displayed for all sites
 */
import type { TableColumnDefinition } from './table-column.types.js';

export const UNIVERSAL_COLUMNS: TableColumnDefinition[] = [
  {
    key: 'title',
    label: 'Product Name',
    sortable: false,
    defaultVisible: true,
    align: 'left',
    format: 'text',
  },
  {
    key: 'currentPrice',
    label: 'Price',
    sortable: true,
    sortMode: 'server',
    defaultVisible: true,
    align: 'right',
    format: 'currency',
    width: '100px',
  },
  {
    key: 'score',
    label: 'Score',
    sortable: true,
    sortMode: 'server',
    defaultVisible: true,
    align: 'center',
    format: 'number',
    width: '80px',
  },
  {
    key: 'publishedAt',
    label: 'Date',
    sortable: true,
    sortMode: 'server',
    defaultVisible: true,
    align: 'center',
    format: 'date',
    width: '120px',
  },
  {
    key: 'siteDetails',
    label: 'Details',
    sortable: false,
    defaultVisible: true,
    align: 'left',
    format: 'custom',
    width: '200px',
  },
];
