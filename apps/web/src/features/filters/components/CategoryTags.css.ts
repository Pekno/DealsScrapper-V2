/**
 * CategoryTags component styles using Vanilla Extract
 * Based on the mockup design with color-coded category tags
 */
import { style, styleVariants } from '@vanilla-extract/css';

export const container = style({
  display: 'flex',
  flexWrap: 'wrap',
  gap: '0.375rem', // 6px gap between tags
  alignItems: 'center',
});

export const categoryTag = style({
  cursor: 'pointer',
  transition: 'all 0.2s ease-in-out',

  ':hover': {
    opacity: 0.8,
    transform: 'translateY(-1px)',
  },

  ':active': {
    transform: 'translateY(0)',
  },
});

export const moreIndicator = style({
  opacity: 0.7,
  cursor: 'default',
});

// Color scheme variants for different category types
export const colorSchemes = styleVariants({
  blue: {
    backgroundColor: '#DBEAFE',
    color: '#1E40AF',
    border: '1px solid #BFDBFE',
  },

  green: {
    backgroundColor: '#DCFCE7',
    color: '#166534',
    border: '1px solid #BBF7D0',
  },

  purple: {
    backgroundColor: '#E9D5FF',
    color: '#7C2D12',
    border: '1px solid #DDD6FE',
  },

  yellow: {
    backgroundColor: '#FEF3C7',
    color: '#92400E',
    border: '1px solid #FDE68A',
  },

  pink: {
    backgroundColor: '#FCE7F3',
    color: '#BE185D',
    border: '1px solid #F9A8D4',
  },

  indigo: {
    backgroundColor: '#E0E7FF',
    color: '#3730A3',
    border: '1px solid #C7D2FE',
  },
});

export const tagSizes = styleVariants({
  sm: {
    padding: '0.25rem 0.5rem',
    fontSize: '0.75rem',
    lineHeight: '1rem',
  },

  md: {
    padding: '0.375rem 0.75rem',
    fontSize: '0.875rem',
    lineHeight: '1.25rem',
  },

  lg: {
    padding: '0.5rem 1rem',
    fontSize: '1rem',
    lineHeight: '1.5rem',
  },
});
