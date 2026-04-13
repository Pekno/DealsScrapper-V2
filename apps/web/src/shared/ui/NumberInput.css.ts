/**
 * NumberInput component styles using Vanilla Extract
 * Following the design system from the create filter mockup
 * Beautiful custom controls replacing ugly browser number inputs
 */
import { style, styleVariants, keyframes } from '@vanilla-extract/css';

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
  borderRadius: '0.75rem', // rounded-xl
  border: '1px solid #D1D5DB',
  backgroundColor: 'white',
  transition: 'all 0.3s ease-in-out',
  overflow: 'hidden',

  ':hover': {
    borderColor: '#9CA3AF',
  },

  selectors: {
    '&:has(input:disabled)': {
      backgroundColor: '#F9FAFB',
      opacity: 0.7,
      cursor: 'not-allowed',
    },
  },
});

const wrapperSizes = styleVariants({
  sm: [
    wrapper,
    {
      minHeight: '2.25rem', // h-9
    },
  ],

  md: [
    wrapper,
    {
      minHeight: '2.75rem', // h-11
    },
  ],

  lg: [
    wrapper,
    {
      minHeight: '3.25rem', // h-13
    },
  ],
});

const focused = style({
  borderColor: '#0F62FE !important',
  boxShadow: '0 0 0 3px rgba(15, 98, 254, 0.1)',
});

const withButtons = style({
  paddingRight: '0.125rem', // pr-0.5 to give buttons some spacing from border
});

const error = style({
  borderColor: '#EF4444 !important',

  ':focus-within': {
    borderColor: '#EF4444 !important',
    boxShadow: '0 0 0 3px rgba(239, 68, 68, 0.1)',
  },
});

const disabled = style({
  backgroundColor: '#F9FAFB',
  opacity: 0.7,
  cursor: 'not-allowed',
});

const input = style({
  display: 'block',
  flex: 1,
  border: 'none',
  outline: 'none',
  backgroundColor: 'transparent',
  color: '#1F2937',
  fontSize: '1rem',
  lineHeight: '1.5rem',
  padding: '0.75rem 1rem',
  width: '100%',

  '::placeholder': {
    color: '#9CA3AF',
  },

  ':disabled': {
    color: '#6B7280',
    cursor: 'not-allowed',
  },

  // Remove number input spinners in all browsers
  selectors: {
    '&::-webkit-outer-spin-button': {
      WebkitAppearance: 'none',
      margin: 0,
    },
    '&::-webkit-inner-spin-button': {
      WebkitAppearance: 'none',
      margin: 0,
    },
    '&[type=number]': {
      MozAppearance: 'textfield',
    },
  },
});

const buttonGroup = style({
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  minHeight: '2.5rem',
  marginRight: '0.25rem', // mr-1
});

const button = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '1.75rem', // w-7
  flex: 1,
  border: 'none',
  borderRadius: '0.375rem', // rounded-md
  cursor: 'pointer',
  transition: 'all 0.2s ease-in-out',
  fontSize: '0.75rem',
  outline: 'none',
  backgroundColor: 'transparent',
  color: '#6B7280',

  ':focus': {
    outline: '2px solid #0F62FE',
    outlineOffset: '1px',
  },

  ':first-child': {
    marginBottom: '0.125rem', // mb-0.5
  },

  selectors: {
    '&:hover:not(:disabled)': {
      transform: 'scale(1.1)',
    },

    '&:active:not(:disabled)': {
      transform: 'scale(0.95)',
    },
  },
});

const buttonEnabled = style([
  button,
  {
    color: '#0F62FE',

    selectors: {
      '&:hover:not(:disabled)': {
        backgroundColor: '#F0F4F8',
        color: '#0D5CE8',
        transform: 'scale(1.1)',
      },

      '&:active:not(:disabled)': {
        backgroundColor: '#E5E7EB',
        color: '#0B52D1',
        transform: 'scale(0.95)',
      },
    },
  },
]);

const buttonDisabled = style([
  button,
  {
    color: '#D1D5DB',
    cursor: 'not-allowed',
    opacity: 0.5,

    selectors: {
      '&:hover': {
        transform: 'none',
        backgroundColor: 'transparent',
      },

      '&:active': {
        transform: 'none',
      },
    },
  },
]);

const errorText = style({
  fontSize: '0.875rem',
  color: '#EF4444',
  lineHeight: '1.25rem',
  marginTop: '0.25rem',
});

// Subtle animation for state changes
const fadeIn = keyframes({
  from: { opacity: 0, transform: 'translateY(-2px)' },
  to: { opacity: 1, transform: 'translateY(0)' },
});

const buttonGroupAnimation = style({
  animation: `${fadeIn} 0.2s ease-out`,
});

export const numberInput = {
  container,
  fullWidth,
  errorContainer,
  label,
  required,
  wrapper,
  sizes: wrapperSizes,
  focused,
  withButtons,
  error,
  disabled,
  input,
  buttonGroup,
  button,
  buttonEnabled,
  buttonDisabled,
  errorText,
};
