/**
 * Input component styles using Vanilla Extract
 * Following the design system from the create filter mockup
 */
import { style, styleVariants } from '@vanilla-extract/css';

const container = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
});

const fullWidth = style({
  width: '100%',
});

const errorContainer = style({});

const label = style({
  fontSize: '0.875rem',
  fontWeight: '500',
  color: '#374151',
  lineHeight: '1.25rem',
  display: 'flex',
  alignItems: 'center',
  gap: '0.25rem',
});

const required = style({
  color: '#EF4444',
  fontSize: '0.875rem',
  fontWeight: 'normal',
});

const wrapper = style({
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
});

const baseInput = style({
  display: 'block',
  width: '100%',
  borderRadius: '0.75rem', // rounded-xl
  border: '1px solid #D1D5DB',
  backgroundColor: 'white',
  color: '#1F2937',
  fontSize: '1rem',
  lineHeight: '1.5rem',
  transition: 'all 0.3s ease-in-out',

  '::placeholder': {
    color: '#9CA3AF',
  },

  ':focus': {
    outline: 'none',
    borderColor: '#0F62FE',
    boxShadow: '0 0 0 3px rgba(15, 98, 254, 0.1)',
  },

  ':disabled': {
    backgroundColor: '#F9FAFB',
    color: '#6B7280',
    cursor: 'not-allowed',
    opacity: 0.7,
  },
});

const inputSizes = styleVariants({
  sm: [
    baseInput,
    {
      padding: '0.5rem 0.75rem',
      fontSize: '0.875rem',
      lineHeight: '1.25rem',
    },
  ],

  md: [
    baseInput,
    {
      padding: '0.75rem 1rem',
      fontSize: '1rem',
      lineHeight: '1.5rem',
    },
  ],

  lg: [
    baseInput,
    {
      padding: '1rem 1.25rem',
      fontSize: '1.125rem',
      lineHeight: '1.75rem',
    },
  ],
});

const withLeftIcon = style({
  paddingLeft: '2.5rem',
});

const withRightIcon = style({
  paddingRight: '2.5rem',
});

const errorState = style({
  borderColor: '#EF4444',

  ':focus': {
    borderColor: '#EF4444',
    boxShadow: '0 0 0 3px rgba(239, 68, 68, 0.1)',
  },
});

const leftIcon = style({
  position: 'absolute',
  left: '0.75rem',
  top: '50%',
  transform: 'translateY(-50%)',
  color: '#6B7280',
  pointerEvents: 'none',
  zIndex: 1,

  selectors: {
    [`${errorState} &`]: {
      color: '#EF4444',
    },
  },
});

const rightIcon = style({
  position: 'absolute',
  right: '0.75rem',
  top: '50%',
  transform: 'translateY(-50%)',
  color: '#6B7280',
  pointerEvents: 'none',
  zIndex: 1,

  selectors: {
    [`${errorState} &`]: {
      color: '#EF4444',
    },
  },
});

const errorText = style({
  fontSize: '0.875rem',
  color: '#EF4444',
  lineHeight: '1.25rem',
  marginTop: '0.25rem',
});

export const input = {
  container,
  fullWidth,
  errorContainer,
  label,
  required,
  wrapper,
  base: baseInput,
  sizes: inputSizes,
  withLeftIcon,
  withRightIcon,
  error: errorState,
  leftIcon,
  rightIcon,
  errorText,
};
