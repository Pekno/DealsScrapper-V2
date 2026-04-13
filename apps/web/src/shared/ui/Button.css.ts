/**
 * Button component styles using Vanilla Extract
 * Following the design system from the create filter mockup
 */
import { style, styleVariants, keyframes } from '@vanilla-extract/css';

const baseButton = style({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.5rem',
  borderRadius: '9999px', // Full rounded
  fontWeight: '600',
  border: 'none',
  cursor: 'pointer',
  transition: 'all 0.3s ease-in-out',
  fontFamily: 'inherit',
  textDecoration: 'none',
  outline: 'none',
  position: 'relative',

  ':focus': {
    outline: '2px solid #0F62FE',
    outlineOffset: '2px',
  },

  ':disabled': {
    cursor: 'not-allowed',
    opacity: 0.6,
  },
});

const buttonVariants = styleVariants({
  primary: [
    baseButton,
    {
      backgroundColor: '#0F62FE',
      color: 'white',
      boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',

      selectors: {
        '&:hover:not(:disabled)': {
          backgroundColor: '#0D5CE8',
          boxShadow:
            '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
          transform: 'translateY(-1px)',
        },
        '&:active:not(:disabled)': {
          backgroundColor: '#0B52D1',
          transform: 'translateY(0px)',
        },
      },
    },
  ],

  secondary: [
    baseButton,
    {
      backgroundColor: '#F0F4F8',
      color: '#1F2937',
      border: '1px solid #D1D5DB',

      selectors: {
        '&:hover:not(:disabled)': {
          backgroundColor: '#E5E7EB',
          boxShadow:
            '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
          transform: 'translateY(-1px)',
        },
        '&:active:not(:disabled)': {
          backgroundColor: '#D1D5DB',
          transform: 'translateY(0px)',
        },
      },
    },
  ],

  danger: [
    baseButton,
    {
      backgroundColor: '#EF4444',
      color: 'white',

      selectors: {
        '&:hover:not(:disabled)': {
          backgroundColor: '#DC2626',
          boxShadow:
            '0 10px 15px -3px rgba(239, 68, 68, 0.3), 0 4px 6px -2px rgba(239, 68, 68, 0.05)',
          transform: 'translateY(-1px)',
        },
        '&:active:not(:disabled)': {
          backgroundColor: '#B91C1C',
          transform: 'translateY(0px)',
        },
      },
    },
  ],

  ghost: [
    baseButton,
    {
      backgroundColor: 'transparent',
      color: '#6B7280',

      selectors: {
        '&:hover:not(:disabled)': {
          backgroundColor: '#F9FAFB',
          color: '#374151',
        },
        '&:active:not(:disabled)': {
          backgroundColor: '#F3F4F6',
        },
      },
    },
  ],

  outline: [
    baseButton,
    {
      backgroundColor: 'transparent',
      color: '#0F62FE',
      border: '1px solid #0F62FE',

      selectors: {
        '&:hover:not(:disabled)': {
          backgroundColor: '#0F62FE',
          color: 'white',
          boxShadow: '0 4px 6px -1px rgba(15, 98, 254, 0.2)',
          transform: 'translateY(-1px)',
        },
        '&:active:not(:disabled)': {
          backgroundColor: '#0D5CE8',
          transform: 'translateY(0px)',
        },
      },
    },
  ],
});

const buttonSizes = styleVariants({
  sm: {
    padding: '0.5rem 1rem',
    fontSize: '0.875rem',
    lineHeight: '1.25rem',
  },

  md: {
    padding: '0.75rem 1.5rem',
    fontSize: '1rem',
    lineHeight: '1.5rem',
  },

  lg: {
    padding: '1rem 2rem',
    fontSize: '1.125rem',
    lineHeight: '1.75rem',
  },
});

const buttonStates = style({
  opacity: 0.6,
  cursor: 'not-allowed',
  transform: 'none !important',
});

const fullWidth = style({
  width: '100%',
});

// Spinner animation styles
const spinAnimation = keyframes({
  from: { transform: 'rotate(0deg)' },
  to: { transform: 'rotate(360deg)' },
});

const spinner = style({
  width: '1rem',
  height: '1rem',
  animation: `${spinAnimation} 1s linear infinite`,
});

const spinnerCircle = style({
  opacity: 0.25,
});

const spinnerPath = style({
  opacity: 0.75,
});

const icon = style({
  display: 'flex',
  alignItems: 'center',
});

const loadingText = style({
  opacity: 0.7,
});

const buttonText = style({
  display: 'inline-block',
});

export const button = {
  base: baseButton,
  variants: buttonVariants,
  sizes: buttonSizes,
  disabled: buttonStates,
  fullWidth,
  spinner,
  spinnerCircle,
  spinnerPath,
  icon,
  loadingText,
  text: buttonText,
};

