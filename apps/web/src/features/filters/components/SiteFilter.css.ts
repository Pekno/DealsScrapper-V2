/**
 * SiteFilter Styles
 * Vanilla Extract styles for the site filter component
 */
import { style } from '@vanilla-extract/css';

export const siteFilter = {
  container: style({
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  }),

  label: style({
    fontSize: '14px',
    fontWeight: 600,
    color: '#374151',
  }),

  buttonGroup: style({
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
  }),

  filterButton: style({
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 16px',
    fontSize: '14px',
    fontWeight: 500,
    color: '#6B7280',
    backgroundColor: 'white',
    border: '2px solid #E5E7EB',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    ':hover': {
      borderColor: '#D1D5DB',
      backgroundColor: '#F9FAFB',
    },
    ':disabled': {
      opacity: 0.5,
      cursor: 'not-allowed',
    },
  }),

  filterButtonActive: style({
    fontWeight: 600,
    backgroundColor: '#EFF6FF',
    borderColor: '#3B82F6',
    color: '#1E40AF',
  }),

  checkmark: style({
    fontSize: '14px',
    fontWeight: 'bold',
  }),

  count: style({
    fontSize: '13px',
    color: '#6B7280',
    fontWeight: 500,
  }),
};
