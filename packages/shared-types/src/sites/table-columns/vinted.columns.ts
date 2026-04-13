/**
 * Vinted-Specific Table Columns
 */
import type { TableColumnDefinition } from './table-column.types.js';

export const VINTED_COLUMNS: TableColumnDefinition[] = [
  {
    key: 'brand',
    label: 'Brand',
    sortable: false,
    defaultVisible: false,
    align: 'left',
    format: 'text',
    width: '120px',
  },
  {
    key: 'size',
    label: 'Size',
    sortable: false,
    defaultVisible: false,
    align: 'center',
    format: 'text',
    width: '60px',
  },
  {
    key: 'condition',
    label: 'Condition',
    sortable: false,
    defaultVisible: false,
    align: 'left',
    format: 'text',
    width: '120px',
  },
  {
    key: 'favoriteCount',
    label: 'Favorites',
    sortable: false,
    defaultVisible: false,
    align: 'center',
    format: 'number',
    width: '80px',
  },
  {
    key: 'color',
    label: 'Color',
    sortable: false,
    defaultVisible: false,
    align: 'left',
    format: 'text',
    width: '80px',
  },
];
