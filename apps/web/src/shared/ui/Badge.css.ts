/**
 * Badge component styles using Vanilla Extract
 * Following the design system from the create filter mockup
 */
import { style, styleVariants } from '@vanilla-extract/css';

const baseBadge = style({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.375rem',
  borderRadius: '9999px',
  fontWeight: '500',
  transition: 'all 0.2s ease-in-out',
  whiteSpace: 'nowrap',
  maxWidth: 'fit-content',
});

const badgeVariants = styleVariants({
  default: [
    baseBadge,
    {
      backgroundColor: '#F3F4F6',
      color: '#374151',
      border: '1px solid #D1D5DB',
    },
  ],

  success: [
    baseBadge,
    {
      backgroundColor: '#DCFCE7',
      color: '#166534',
      border: '1px solid #BBF7D0',
    },
  ],

  warning: [
    baseBadge,
    {
      backgroundColor: '#FEF3C7',
      color: '#92400E',
      border: '1px solid #FDE68A',
    },
  ],

  danger: [
    baseBadge,
    {
      backgroundColor: '#FEE2E2',
      color: '#991B1B',
      border: '1px solid #FECACA',
    },
  ],

  info: [
    baseBadge,
    {
      backgroundColor: '#DBEAFE',
      color: '#1E40AF',
      border: '1px solid #BFDBFE',
    },
  ],

  // Accent variant used for category pills in the mockup
  accent: [
    baseBadge,
    {
      backgroundColor: '#E0E7FF', // Light blue background
      color: '#0F62FE', // Primary blue text
      border: '1px solid #C7D2FE',
    },
  ],
});

const badgeSizes = styleVariants({
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

const icon = style({
  display: 'flex',
  alignItems: 'center',
  flexShrink: 0,
});

const text = style({
  display: 'flex',
  alignItems: 'center',
  flexShrink: 1,
  minWidth: 0, // Allow text truncation if needed
});

const removeButton = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  padding: '0.125rem',
  borderRadius: '50%',
  backgroundColor: 'transparent',
  border: 'none',
  cursor: 'pointer',
  color: 'inherit',
  transition: 'all 0.2s ease-in-out',

  ':hover': {
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    color: '#EF4444', // Red on hover
  },

  ':focus': {
    outline: 'none',
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
});

const removeIcon = style({
  width: '1rem',
  height: '1rem',
});

export const badge = {
  base: baseBadge,
  variants: badgeVariants,
  sizes: badgeSizes,
  icon,
  text,
  removeButton,
  removeIcon,
};
