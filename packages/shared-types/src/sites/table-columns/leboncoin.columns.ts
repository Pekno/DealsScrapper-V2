/**
 * LeBonCoin-Specific Table Columns
 */
import type { TableColumnDefinition } from './table-column.types.js';

export const LEBONCOIN_COLUMNS: TableColumnDefinition[] = [
  {
    key: 'city',
    label: 'Location',
    sortable: false,
    defaultVisible: false,
    align: 'left',
    format: 'text',
    width: '120px',
  },
  {
    key: 'condition',
    label: 'Condition',
    sortable: false,
    defaultVisible: false,
    align: 'left',
    format: 'text',
    width: '100px',
  },
  {
    key: 'proSeller',
    label: 'Pro',
    sortable: false,
    defaultVisible: false,
    align: 'center',
    format: 'boolean',
    width: '60px',
  },
  {
    key: 'shippingCost',
    label: 'Shipping',
    sortable: false,
    defaultVisible: false,
    align: 'right',
    format: 'currency',
    width: '80px',
  },
  {
    key: 'urgentFlag',
    label: 'Urgent',
    sortable: false,
    defaultVisible: false,
    align: 'center',
    format: 'boolean',
    width: '60px',
  },
];
