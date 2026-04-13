/**
 * SiteSelector Styles
 * Vanilla Extract styles for the multi-site selector component
 */
import { style, styleVariants } from '@vanilla-extract/css';

export const siteSelector = {
  container: style({
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    marginBottom: '24px',
  }),

  label: style({
    fontSize: '14px',
    fontWeight: 600,
    color: '#1a1a1a',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  }),

  required: style({
    color: '#ef4444',
    fontSize: '14px',
  }),

  description: style({
    fontSize: '13px',
    color: '#666',
    marginTop: '-8px',
  }),

  grid: style({
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: '12px',
    '@media': {
      '(max-width: 640px)': {
        gridTemplateColumns: '1fr',
      },
    },
  }),

  siteButton: style({
    display: 'flex',
    alignItems: 'center',
    padding: '12px 16px',
    border: '2px solid #e5e7eb',
    borderRadius: '8px',
    backgroundColor: 'white',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    fontSize: '14px',
    fontWeight: 500,
    textAlign: 'left',
    ':hover': {
      borderColor: '#d1d5db',
      backgroundColor: '#f9fafb',
    },
    ':focus': {
      outline: 'none',
      boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.1)',
    },
  }),

  siteButtonSelected: style({
    borderWidth: '2px',
    fontWeight: 600,
    ':hover': {
      opacity: 0.9,
    },
  }),

  siteButtonDisabled: style({
    opacity: 0.5,
    cursor: 'not-allowed',
    pointerEvents: 'none',
    ':hover': {
      borderColor: '#e5e7eb',
      backgroundColor: 'white',
    },
  }),

  siteContent: style({
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    width: '100%',
  }),

  colorIndicator: style({
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    flexShrink: 0,
  }),

  siteName: style({
    flex: 1,
    fontSize: '14px',
    color: '#1a1a1a',
  }),

  checkmark: style({
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#10b981',
    flexShrink: 0,
  }),

  errorMessage: style({
    fontSize: '13px',
    color: '#ef4444',
    marginTop: '-4px',
  }),

  selectedCount: style({
    fontSize: '13px',
    color: '#666',
    fontWeight: 500,
    marginTop: '-4px',
  }),
};
