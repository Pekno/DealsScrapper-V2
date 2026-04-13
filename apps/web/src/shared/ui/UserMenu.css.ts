/**
 * UserMenu component styles
 * Provides a dropdown menu for user profile actions
 */
import { style, keyframes } from '@vanilla-extract/css';

// Animation keyframes
const slideDown = keyframes({
  from: {
    opacity: 0,
    transform: 'translateY(-4px) scale(0.95)',
  },
  to: {
    opacity: 1,
    transform: 'translateY(0) scale(1)',
  },
});

// Container for the user menu
export const container = style({
  position: 'relative',
  display: 'inline-block',
});

// Trigger button (user profile area)
export const trigger = style({
  width: '100%',
  background: 'transparent',
  border: 'none',
  padding: 0,
  margin: 0,
  cursor: 'pointer',
  outline: 'none',

  ':focus': {
    outline: '2px solid #3b82f6',
    outlineOffset: '2px',
    borderRadius: '0.5rem',
  },
});

// Dropdown menu
export const dropdown = style({
  position: 'absolute',
  bottom: '100%',
  left: 0,
  right: 0,
  marginBottom: '0.5rem',
  backgroundColor: 'white',
  borderRadius: '0.75rem',
  boxShadow:
    '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
  border: '1px solid #e5e7eb',
  zIndex: 1000,
  animation: `${slideDown} 0.15s ease-out`,
  minWidth: '200px',
  overflow: 'hidden',
});

// Menu item
export const menuItem = style({
  display: 'flex',
  alignItems: 'center',
  width: '100%',
  padding: '0.75rem 1rem',
  border: 'none',
  background: 'transparent',
  textAlign: 'left',
  fontSize: '0.875rem',
  fontWeight: 500,
  color: '#374151',
  cursor: 'pointer',
  transition: 'all 0.15s ease-in-out',
  gap: '0.75rem',

  ':hover': {
    backgroundColor: '#f3f4f6',
    color: '#111827',
  },

  ':focus': {
    outline: 'none',
    backgroundColor: '#f3f4f6',
    color: '#111827',
  },

  ':first-child': {
    borderTopLeftRadius: '0.75rem',
    borderTopRightRadius: '0.75rem',
  },

  ':last-child': {
    borderBottomLeftRadius: '0.75rem',
    borderBottomRightRadius: '0.75rem',
  },
});

// Menu item variants
export const menuItemVariants = {
  default: style({}),
  danger: style({
    color: '#dc2626',

    ':hover': {
      backgroundColor: '#fef2f2',
      color: '#dc2626',
    },

    ':focus': {
      backgroundColor: '#fef2f2',
      color: '#dc2626',
    },
  }),
};

// Menu item icon
export const menuItemIcon = style({
  width: '1.125rem',
  height: '1.125rem',
  flexShrink: 0,
});

// Menu divider
export const divider = style({
  height: '1px',
  backgroundColor: '#e5e7eb',
  margin: '0.25rem 0',
});

// Backdrop for mobile
export const backdrop = style({
  position: 'fixed',
  inset: 0,
  zIndex: 999,
  background: 'transparent',
});
