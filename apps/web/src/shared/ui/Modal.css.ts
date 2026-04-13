/**
 * Modal component styles
 * Provides a reusable modal overlay and dialog system
 */
import { style, globalStyle, keyframes } from '@vanilla-extract/css';

// Animation keyframes
const fadeIn = keyframes({
  from: { opacity: 0 },
  to: { opacity: 1 },
});

const slideInUp = keyframes({
  from: {
    opacity: 0,
    transform: 'translateY(16px) scale(0.95)',
  },
  to: {
    opacity: 1,
    transform: 'translateY(0) scale(1)',
  },
});

// Modal overlay that covers the entire screen
export const overlay = style({
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
  animation: `${fadeIn} 0.15s ease-out`,
  padding: '1rem',
});

// Modal container
export const modal = style({
  backgroundColor: 'white',
  borderRadius: '0.75rem',
  boxShadow:
    '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  maxHeight: '90vh',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  animation: `${slideInUp} 0.2s ease-out`,
  position: 'relative',
});

// Modal variants for different sizes
export const modalVariants = {
  sm: style({
    width: '100%',
    maxWidth: '28rem', // 448px
  }),
  md: style({
    width: '100%',
    maxWidth: '32rem', // 512px
  }),
  lg: style({
    width: '100%',
    maxWidth: '42rem', // 672px
  }),
  xl: style({
    width: '100%',
    maxWidth: '48rem', // 768px
  }),
  full: style({
    width: '100%',
    maxWidth: 'none',
    height: '100%',
    maxHeight: 'none',
    borderRadius: 0,
    '@media': {
      '(min-width: 768px)': {
        width: '90vw',
        height: '90vh',
        borderRadius: '0.75rem',
      },
    },
  }),
};

// Modal header
export const header = style({
  padding: '1.5rem 1.5rem 1rem',
  borderBottom: '1px solid #e5e7eb',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  flexShrink: 0,
});

// Modal title
export const title = style({
  fontSize: '1.125rem',
  fontWeight: 600,
  color: '#111827',
  margin: 0,
});

// Close button
export const closeButton = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '2rem',
  height: '2rem',
  borderRadius: '0.5rem',
  border: 'none',
  backgroundColor: 'transparent',
  color: '#6b7280',
  cursor: 'pointer',
  transition: 'all 0.15s ease-in-out',

  ':hover': {
    backgroundColor: '#f3f4f6',
    color: '#374151',
  },

  ':focus': {
    outline: '2px solid #3b82f6',
    outlineOffset: '2px',
  },
});

// Modal body
export const body = style({
  flex: 1,
  overflowY: 'auto',
  padding: '1rem 1.5rem',
});

// Modal footer
export const footer = style({
  padding: '1rem 1.5rem 1.5rem',
  borderTop: '1px solid #e5e7eb',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: '0.75rem',
  flexShrink: 0,
});

// Close icon
export const closeIcon = style({
  width: '1.25rem',
  height: '1.25rem',
});

// Prevent body scroll when modal is open
globalStyle('body.modal-open', {
  overflow: 'hidden',
});
