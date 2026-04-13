/**
 * Section component styles using Vanilla Extract
 * Unified section component following the CreateFilterForm design patterns
 */
import { style } from '@vanilla-extract/css';

export const section = style({
  backgroundColor: 'white',
  borderRadius: '1rem', // rounded-2xl
  border: '1px solid #E5E7EB',
  boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
  overflow: 'visible', // Allow dropdowns and tooltips to be visible outside the section
});

export const sectionHeader = style({
  display: 'flex',
  alignItems: 'center',
  gap: '0.75rem',
  padding: '1.5rem 2rem 1rem 2rem',
  borderBottom: '1px solid #F3F4F6',

  '@media': {
    '(max-width: 768px)': {
      padding: '1.25rem 1.5rem 1rem 1.5rem',
    },
  },
});

export const sectionHeaderClickable = style({
  cursor: 'pointer',
  transition: 'background-color 150ms ease-in-out',
  borderTopLeftRadius: '1rem',
  borderTopRightRadius: '1rem',

  ':hover': {
    backgroundColor: '#F9FAFB',
  },

  ':focus': {
    outline: 'none',
  },
});

export const sectionIcon = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '2rem',
  height: '2rem',
  backgroundColor: '#DBEAFE',
  color: '#0F62FE',
  borderRadius: '0.5rem',
  flexShrink: 0,
});

export const sectionTitle = style({
  fontSize: '1.5rem',
  fontWeight: '700',
  color: '#1F2937',
  lineHeight: '1.3',
  flex: 1, // Take up remaining space, pushing chevron to the right
});

export const sectionContent = style({
  padding: '1.5rem 2rem 2rem 2rem',

  '@media': {
    '(max-width: 768px)': {
      padding: '1.25rem 1.5rem 1.75rem 1.5rem',
    },
  },
});

export const chevronIcon = style({
  width: '1.25rem',
  height: '1.25rem',
  color: '#6B7280',
  transition: 'transform 200ms ease-in-out',
  transform: 'rotate(0deg)',
  flexShrink: 0,
});

export const chevronCollapsed = style({
  transform: 'rotate(-90deg)',
});
