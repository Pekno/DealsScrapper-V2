/**
 * CreateFilterForm component styles using Vanilla Extract
 * Following the design system from the create filter mockup
 */
import { style, keyframes } from '@vanilla-extract/css';

const fadeIn = keyframes({
  '0%': { opacity: 0, transform: 'translateY(8px)' },
  '100%': { opacity: 1, transform: 'translateY(0)' },
});

const container = style({
  maxWidth: '1024px',
  margin: '0 auto',
  padding: '2rem 1rem',
  animation: `${fadeIn} 0.3s ease-out`,

  '@media': {
    '(min-width: 768px)': {
      padding: '2rem',
    },
  },
});

const header = style({
  marginBottom: '2rem',
  textAlign: 'left',
});

const title = style({
  fontSize: '2.5rem',
  fontWeight: '700',
  color: '#1F2937',
  lineHeight: '1.2',
  marginBottom: '0.5rem',

  '@media': {
    '(max-width: 768px)': {
      fontSize: '2rem',
    },
  },
});

const subtitle = style({
  fontSize: '1.125rem',
  color: '#6B7280',
  lineHeight: '1.6',
});

const errorAlert = style({
  backgroundColor: '#FEF2F2',
  border: '1px solid #FECACA',
  borderRadius: '0.75rem',
  padding: '1rem 1.25rem',
  marginBottom: '1.5rem',
});

const errorTitle = style({
  fontSize: '0.875rem',
  fontWeight: '600',
  color: '#991B1B',
  marginBottom: '0.25rem',
});

const errorMessage = style({
  fontSize: '0.875rem',
  color: '#B91C1C',
  lineHeight: '1.4',
});

const form = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '2rem',
});

const textarea = style({
  display: 'block',
  width: '100%',
  padding: '0.75rem 1rem',
  borderRadius: '0.75rem',
  border: '1px solid #D1D5DB',
  backgroundColor: 'white',
  color: '#1F2937',
  fontSize: '1rem',
  lineHeight: '1.5rem',
  resize: 'vertical',
  minHeight: '6rem',
  transition: 'all 0.3s ease-in-out',
  fontFamily: 'inherit',

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

const fieldError = style({
  fontSize: '0.875rem',
  color: '#EF4444',
  marginTop: '0.5rem',
  display: 'flex',
  alignItems: 'center',
  gap: '0.25rem',

  '::before': {
    content: '⚠',
    fontSize: '0.75rem',
    color: '#EF4444',
  },
});

const actions = style({
  display: 'flex',
  justifyContent: 'flex-end',
  paddingTop: '1.5rem',
  borderTop: '1px solid #F3F4F6',

  '@media': {
    '(max-width: 768px)': {
      justifyContent: 'stretch',
    },
  },
});

export const createFilterForm = {
  container,
  header,
  title,
  subtitle,
  errorAlert,
  errorTitle,
  errorMessage,
  form,
  textarea,
  fieldError,
  actions,
};
