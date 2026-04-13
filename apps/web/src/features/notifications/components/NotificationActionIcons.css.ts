import { style } from '@vanilla-extract/css';

export const actionContainer = style({
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
});

export const actionButton = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '20px',
  height: '20px',
  padding: '2px',
  borderRadius: '4px',
  border: 'none',
  backgroundColor: 'transparent',
  color: '#6b7280', // gray-500
  cursor: 'pointer',
  transition: 'all 0.2s ease',

  ':hover': {
    color: '#3b82f6', // blue-600
    backgroundColor: '#eff6ff', // blue-50
  },

  ':focus': {
    outline: '2px solid #3b82f6',
    outlineOffset: '2px',
  },
});

export const iconSvg = style({
  width: '12px',
  height: '12px',
  flexShrink: 0,
});

export const filterButton = style({
  ':hover': {
    color: '#7c3aed', // purple-600
    backgroundColor: '#faf5ff', // purple-50
  },
});
