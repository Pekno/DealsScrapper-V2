/**
 * Toast component styles
 * Provides styled notification toasts with animations and variants
 */
import { style, keyframes, createVar } from '@vanilla-extract/css';

// CSS custom properties for dynamic positioning
export const toastOffsetVar = createVar();

// Animation keyframes
const slideInUp = keyframes({
  from: {
    opacity: 0,
    transform: `translateY(100%)`,
  },
  to: {
    opacity: 1,
    transform: 'translateY(0)',
  },
});

const slideOutDown = keyframes({
  from: {
    opacity: 1,
    transform: 'translateY(0)',
  },
  to: {
    opacity: 0,
    transform: 'translateY(100%)',
  },
});

const progressBarAnimation = keyframes({
  from: { width: '100%' },
  to: { width: '0%' },
});

// Toast container positioned at bottom of screen
export const toastContainer = style({
  position: 'fixed',
  bottom: '1rem',
  right: '1rem',
  left: '1rem',
  zIndex: 1050, // Higher than modal (1000) but below tooltip (1060)
  pointerEvents: 'none',

  '@media': {
    '(min-width: 640px)': {
      left: 'auto',
      minWidth: '20rem',
      maxWidth: '28rem',
    },
  },
});

// Individual toast
export const toast = style({
  backgroundColor: 'white',
  border: '1px solid #e5e7eb',
  borderRadius: '0.75rem',
  boxShadow:
    '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
  marginBottom: '0.5rem',
  padding: '1rem',
  pointerEvents: 'auto',
  position: 'relative',
  transform: toastOffsetVar,
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  width: '100%',

  // Entrance animation
  selectors: {
    '&[data-state="entering"]': {
      animation: `${slideInUp} 0.3s cubic-bezier(0.4, 0, 0.2, 1)`,
    },
    '&[data-state="exiting"]': {
      animation: `${slideOutDown} 0.2s cubic-bezier(0.4, 0, 0.2, 1)`,
    },
  },
});

// Toast variants
export const toastVariants = {
  success: style({
    borderLeftColor: '#10b981',
    borderLeftWidth: '4px',
  }),
  error: style({
    borderLeftColor: '#ef4444',
    borderLeftWidth: '4px',
  }),
  warning: style({
    borderLeftColor: '#f59e0b',
    borderLeftWidth: '4px',
  }),
  info: style({
    borderLeftColor: '#3b82f6',
    borderLeftWidth: '4px',
  }),
};

// Toast content area
export const toastContent = style({
  display: 'flex',
  alignItems: 'flex-start',
  gap: '0.75rem',
});

// Toast icon
export const toastIcon = style({
  flexShrink: 0,
  height: '1.25rem',
  width: '1.25rem',
  marginTop: '0.125rem',
});

export const toastIconVariants = {
  success: style({
    color: '#10b981',
  }),
  error: style({
    color: '#ef4444',
  }),
  warning: style({
    color: '#f59e0b',
  }),
  info: style({
    color: '#3b82f6',
  }),
};

// Toast text content
export const toastText = style({
  flex: 1,
  minWidth: 0,
});

// Toast title
export const toastTitle = style({
  fontSize: '0.875rem',
  fontWeight: 600,
  color: '#111827',
  marginBottom: '0.25rem',
});

// Toast message
export const toastMessage = style({
  fontSize: '0.875rem',
  color: '#6b7280',
  lineHeight: 1.4,
});

// Close button
export const toastCloseButton = style({
  alignItems: 'center',
  backgroundColor: 'transparent',
  border: 'none',
  borderRadius: '0.375rem',
  color: '#9ca3af',
  cursor: 'pointer',
  display: 'flex',
  flexShrink: 0,
  height: '1.5rem',
  justifyContent: 'center',
  marginLeft: '0.5rem',
  marginTop: '0.125rem',
  padding: '0.125rem',
  transition: 'color 0.15s ease-in-out',
  width: '1.5rem',

  ':hover': {
    color: '#6b7280',
  },

  ':focus': {
    color: '#6b7280',
    outline: '2px solid #3b82f6',
    outlineOffset: '2px',
  },
});

// Close icon
export const toastCloseIcon = style({
  height: '1rem',
  width: '1rem',
});

// Progress bar for auto-dismiss
export const toastProgressBar = style({
  position: 'absolute',
  bottom: 0,
  left: 0,
  height: '2px',
  borderBottomLeftRadius: '0.75rem',
  borderBottomRightRadius: '0.75rem',
  transition: 'width linear',
});

export const progressBarVariants = {
  success: style({
    backgroundColor: '#10b981',
    selectors: {
      '&[data-animated="true"]': {
        animation: `${progressBarAnimation} var(--duration) linear`,
      },
    },
  }),
  error: style({
    backgroundColor: '#ef4444',
    selectors: {
      '&[data-animated="true"]': {
        animation: `${progressBarAnimation} var(--duration) linear`,
      },
    },
  }),
  warning: style({
    backgroundColor: '#f59e0b',
    selectors: {
      '&[data-animated="true"]': {
        animation: `${progressBarAnimation} var(--duration) linear`,
      },
    },
  }),
  info: style({
    backgroundColor: '#3b82f6',
    selectors: {
      '&[data-animated="true"]': {
        animation: `${progressBarAnimation} var(--duration) linear`,
      },
    },
  }),
};

// Screen reader only text
export const srOnly = style({
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: 0,
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
});
