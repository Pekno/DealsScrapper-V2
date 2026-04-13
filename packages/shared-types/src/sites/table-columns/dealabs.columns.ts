/**
 * Dealabs-Specific Table Columns
 */
import type { TableColumnDefinition } from './table-column.types.js';

export const DEALABS_COLUMNS: TableColumnDefinition[] = [
  {
    key: 'temperature',
    label: 'Heat',
    sortable: true,
    sortMode: 'client',
    defaultVisible: false,
    align: 'center',
    format: 'number',
    width: '80px',
  },
  {
    key: 'originalPrice',
    label: 'Original',
    sortable: false,
    defaultVisible: false,
    align: 'right',
    format: 'currency',
    width: '100px',
  },
  {
    key: 'discountPercentage',
    label: 'Discount',
    sortable: false,
    defaultVisible: false,
    align: 'center',
    format: 'percentage',
    width: '80px',
  },
  {
    key: 'merchant',
    label: 'Shop',
    sortable: false,
    defaultVisible: false,
    align: 'left',
    format: 'text',
    width: '120px',
  },
  {
    key: 'freeShipping',
    label: 'Free Ship',
    sortable: false,
    defaultVisible: false,
    align: 'center',
    format: 'boolean',
    width: '80px',
  },
];
