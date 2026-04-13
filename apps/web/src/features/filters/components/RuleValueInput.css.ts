/**
 * RuleValueInput component styles using Vanilla Extract
 * Provides responsive, accessible styling for dynamic input types
 */
import { style } from '@vanilla-extract/css';

// Container styles for different input types
const baseContainer = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem',
  width: '100%',
});

// Single input container
export const singleInput = {
  container: style([
    baseContainer,
    {
      minWidth: '200px',
    },
  ]),
};

// Array input container
export const arrayInput = {
  container: style([
    baseContainer,
    {
      minWidth: '250px',
    },
  ]),
};

// Range input container
export const rangeInput = {
  container: style([
    baseContainer,
    {
      minWidth: '300px',
    },
  ]),
};

// No input container
export const noInput = {
  container: style([
    baseContainer,
    {
      minWidth: '200px',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem',
    },
  ]),

  message: style({
    fontSize: '0.875rem',
    color: '#6B7280',
    fontStyle: 'italic',
    textAlign: 'center',
    backgroundColor: '#F3F4F6',
    padding: '0.75rem 1rem',
    borderRadius: '0.5rem',
    border: '1px dashed #D1D5DB',
  }),
};

// Tag input styles (for array inputs)
export const tagInput = {
  container: style({
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    width: '100%',
  }),

  wrapper: style({
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    gap: '0.5rem',
    minHeight: '2.5rem',
    padding: '0.5rem',
    border: '1px solid #D1D5DB',
    borderRadius: '0.75rem',
    backgroundColor: 'white',
    transition: 'all 0.3s ease-in-out',

    ':focus-within': {
      borderColor: '#0F62FE',
      boxShadow: '0 0 0 3px rgba(15, 98, 254, 0.1)',
    },

    ':hover': {
      borderColor: '#9CA3AF',
    },
  }),

  tag: style({
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
    backgroundColor: '#EFF6FF',
    color: '#1D4ED8',
    border: '1px solid #DBEAFE',
    borderRadius: '0.375rem',
    padding: '0.25rem 0.5rem',
    fontSize: '0.875rem',
    fontWeight: '500',
    lineHeight: '1.25rem',
    maxWidth: '200px',

    ':hover': {
      backgroundColor: '#DBEAFE',
      borderColor: '#BFDBFE',
    },
  }),

  tagText: style({
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }),

  tagRemove: style({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '1rem',
    height: '1rem',
    borderRadius: '50%',
    border: 'none',
    backgroundColor: 'transparent',
    color: '#6B7280',
    cursor: 'pointer',
    fontSize: '0.875rem',
    fontWeight: 'bold',
    lineHeight: '1',
    transition: 'all 0.2s ease-in-out',

    ':hover': {
      backgroundColor: '#FEE2E2',
      color: '#EF4444',
    },

    ':focus': {
      outline: 'none',
      backgroundColor: '#FEE2E2',
      color: '#EF4444',
      boxShadow: '0 0 0 2px rgba(239, 68, 68, 0.2)',
    },
  }),

  input: style({
    flex: '1',
    minWidth: '120px',
    border: 'none',
    outline: 'none',
    fontSize: '1rem',
    lineHeight: '1.5rem',
    color: '#1F2937',
    backgroundColor: 'transparent',

    '::placeholder': {
      color: '#9CA3AF',
    },
  }),

  error: style({
    fontSize: '0.875rem',
    color: '#EF4444',
    lineHeight: '1.25rem',
  }),

  hint: style({
    fontSize: '0.75rem',
    color: '#6B7280',
    lineHeight: '1rem',
  }),
};

// Date range input styles
export const dateRange = {
  container: style({
    display: 'flex',
    alignItems: 'flex-end',
    gap: '1rem',
    width: '100%',

    '@media': {
      '(max-width: 640px)': {
        flexDirection: 'column',
        alignItems: 'stretch',
        gap: '0.75rem',
      },
    },
  }),

  field: style({
    flex: '1',
    minWidth: '140px',
  }),

  separator: style({
    fontSize: '0.875rem',
    fontWeight: '500',
    color: '#6B7280',
    paddingBottom: '0.5rem',
    whiteSpace: 'nowrap',

    '@media': {
      '(max-width: 640px)': {
        textAlign: 'center',
        paddingBottom: '0',
      },
    },
  }),
};

// Number range input styles
export const numberRange = {
  container: style({
    display: 'flex',
    alignItems: 'flex-end',
    gap: '1rem',
    width: '100%',

    '@media': {
      '(max-width: 640px)': {
        flexDirection: 'column',
        alignItems: 'stretch',
        gap: '0.75rem',
      },
    },
  }),

  field: style({
    flex: '1',
    minWidth: '100px',
  }),

  separator: style({
    fontSize: '0.875rem',
    fontWeight: '500',
    color: '#6B7280',
    paddingBottom: '0.5rem',
    whiteSpace: 'nowrap',

    '@media': {
      '(max-width: 640px)': {
        textAlign: 'center',
        paddingBottom: '0',
      },
    },
  }),
};

// Hint styles
export const hint = {
  container: style({
    marginTop: '0.25rem',
  }),

  text: style({
    fontSize: '0.75rem',
    color: '#6B7280',
    lineHeight: '1rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',

    '::before': {
      content: '💡',
      fontSize: '0.75rem',
      opacity: 0.7,
    },
  }),
};

// Loading and error states
export const states = {
  loading: style({
    opacity: 0.6,
    pointerEvents: 'none',
    position: 'relative',

    '::after': {
      content: '',
      position: 'absolute',
      top: '50%',
      left: '50%',
      width: '1rem',
      height: '1rem',
      border: '2px solid #E5E7EB',
      borderTop: '2px solid #0F62FE',
      borderRadius: '50%',
      animation: 'spin 1s linear infinite',
      transform: 'translate(-50%, -50%)',
    },
  }),

  error: style({
    borderColor: '#EF4444',

    ':focus-within': {
      borderColor: '#EF4444',
      boxShadow: '0 0 0 3px rgba(239, 68, 68, 0.1)',
    },
  }),

  disabled: style({
    opacity: 0.6,
    pointerEvents: 'none',
    backgroundColor: '#F9FAFB',
  }),
};

// Responsive utilities
export const responsive = {
  mobile: style({
    '@media': {
      '(max-width: 640px)': {
        width: '100%',
        minWidth: 'unset',
      },
    },
  }),

  tablet: style({
    '@media': {
      '(max-width: 1024px)': {
        maxWidth: '300px',
      },
    },
  }),
};

// Animation keyframes (need to be defined globally or in a separate file)
// For now, we'll use inline styles for simplicity
